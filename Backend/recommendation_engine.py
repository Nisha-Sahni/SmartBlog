import logging
import numpy as np
from semantic_search import semantic_search_engine

logger = logging.getLogger("smartblog.recommendation_engine")


class RecommendationEngine:
    """
    NLP-based Content-Based Recommendation Engine for SmartBlog.
    Constructs a personalized user profile vector using:
    - User's selected interests and preferred topics
    - Reading history (titles, topics, excerpts)
    - Saved / bookmarked blogs
    Calculates semantic cosine similarity against cached blog embeddings,
    applies topic affinity boosting, and generates human-readable recommendation reasons.
    """

    def __init__(self, search_engine=None):
        self.search_engine = search_engine or semantic_search_engine

    def build_user_profile_text(self, interests, reading_history, saved_blogs=None):
        """
        Builds a rich semantic profile string representing the user's preferences.
        Interests and reading patterns are weighted to provide strong semantic grounding.
        """
        parts = []

        # 1. Selected interests (Given strong priority)
        if interests:
            cleaned_interests = [str(i).strip() for i in interests if i and str(i).strip()]
            if cleaned_interests:
                # Emphasize preferred topics
                parts.append("Preferred topics, categories and interests: " + ", ".join(cleaned_interests) + ".")
                # Add topic keywords twice to heighten semantic weight
                parts.append("Interested in reading content about: " + " ".join(cleaned_interests) + ".")

        # 2. Reading history (Content previously read by the user)
        if reading_history:
            history_snippets = []
            for b in reading_history[:8]:
                title = (b.get("title") or "").strip()
                topic = (b.get("topic") or "").strip()
                subtitle = (b.get("subtitle") or b.get("description") or "").strip()
                content = (b.get("content") or "").strip()
                snippet = f"Read article: '{title}' ({topic})"
                if subtitle:
                    snippet += f" - {subtitle}"
                elif content:
                    snippet += f" - {content[:150]}"
                history_snippets.append(snippet)

            if history_snippets:
                parts.append("Recently read and engaged stories: " + " | ".join(history_snippets) + ".")

        # 3. Saved / bookmarked blogs
        if saved_blogs:
            saved_snippets = []
            for b in saved_blogs[:5]:
                title = (b.get("title") or "").strip()
                topic = (b.get("topic") or "").strip()
                if title:
                    saved_snippets.append(f"{title} ({topic})")
            if saved_snippets:
                parts.append("Saved bookmarks: " + ", ".join(saved_snippets) + ".")

        return " ".join(parts).strip()

    def generate_recommendations(
        self,
        user_id,
        interests,
        reading_history,
        candidate_blogs,
        saved_blogs=None,
        limit=6,
        allow_read_fallback=True
    ):
        """
        Generates personalized recommendations for the authenticated user.
        """
        if not candidate_blogs:
            return []

        # Ensure candidate blogs are indexed and cached
        self.search_engine.sync_blogs(candidate_blogs)

        read_blog_ids = {
            int(b["blog_id"])
            for b in reading_history
            if b.get("blog_id") is not None
        }

        # Filter candidate blogs to exclude already-read blogs when alternatives exist
        unread_candidates = [
            b for b in candidate_blogs
            if int(b.get("blog_id") or b.get("id")) not in read_blog_ids
        ]

        if unread_candidates:
            target_candidates = unread_candidates
        elif allow_read_fallback:
            target_candidates = candidate_blogs
        else:
            target_candidates = []

        if not target_candidates:
            return []

        user_profile_text = self.build_user_profile_text(
            interests=interests,
            reading_history=reading_history,
            saved_blogs=saved_blogs
        )

        # ----------------------------------------------------
        # NEW USER FALLBACK (No interests and no reading history)
        # ----------------------------------------------------
        if not user_profile_text:
            logger.info("New user %s with no profile signals; providing recency/popularity fallback.", user_id)
            results = []
            for b in target_candidates[:limit]:
                item = dict(b)
                item["relevance_score"] = 0.0
                item["similarity_score"] = 0.0
                item["recommendation_reason"] = "A recent story you haven't read"
                results.append(item)
            return results

        # ----------------------------------------------------
        # NLP SEMANTIC SIMILARITY SCORING
        # ----------------------------------------------------
        profile_vector = self.search_engine.model.encode(
            [user_profile_text],
            normalize_embeddings=True
        )[0]

        interest_words = set()
        for i in (interests or []):
            if i:
                cleaned = str(i).lower().strip()
                interest_words.add(cleaned)
                for word in cleaned.split():
                    if len(word) > 2:
                        interest_words.add(word)

        scored_blogs = []

        for b in target_candidates:
            b_id = int(b.get("blog_id") or b.get("id"))
            cache_key = f"{b_id}:all"
            cached = self.search_engine._cache.get(cache_key)
            if cached is None or "embedding" not in cached:
                # If for any reason not yet in cache, re-sync this blog
                self.search_engine.update_blog(b)
                cached = self.search_engine._cache.get(cache_key)
                if cached is None or "embedding" not in cached:
                    continue

            blog_vector = cached["embedding"]
            cos_sim = float(np.dot(blog_vector, profile_vector))

            # Topic boost if blog topic directly matches user interests
            blog_topic = (b.get("topic") or "").lower().strip()
            topic_boost = 0.0
            matched_interest_label = None

            for interest in (interests or []):
                cleaned_interest = str(interest).lower().strip()
                if (
                    cleaned_interest in blog_topic
                    or blog_topic in cleaned_interest
                    or any(w in blog_topic for w in cleaned_interest.split() if len(w) > 3)
                ):
                    topic_boost = 0.15
                    matched_interest_label = str(interest).strip()
                    break

            final_score = cos_sim + topic_boost

            # Generate personalized recommendation reason
            if matched_interest_label:
                reason = f"Based on your interest in {matched_interest_label}"
            elif reading_history:
                reason = "Based on your reading history"
            elif interests:
                reason = "Aligned with your selected topics"
            else:
                reason = "Recommended for you"

            item = dict(b)
            item["relevance_score"] = round(float(final_score), 4)
            item["similarity_score"] = round(float(cos_sim), 4)
            item["recommendation_reason"] = reason
            item["is_already_read"] = b_id in read_blog_ids
            scored_blogs.append(item)

        # Sort in descending order of relevance score, then recency
        scored_blogs.sort(
            key=lambda x: (
                x.get("relevance_score", 0),
                x.get("created_at") or "",
                x.get("blog_id") or 0
            ),
            reverse=True
        )

        return scored_blogs[:limit]


# Global instance
recommendation_engine = RecommendationEngine()

