import os
import hashlib
import pickle
import logging
import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger("smartblog.semantic_search")


class SemanticSearchEngine:
    """
    NLP-based Semantic Search Engine for SmartBlog.
    Uses Sentence Transformers ('all-MiniLM-L6-v2') to compute dense semantic embeddings
    for blog titles, descriptions, topics, and content, and ranks search results using
    cosine similarity against user queries.
    """

    MODEL_NAME = "all-MiniLM-L6-v2"
    DEFAULT_THRESHOLD = 0.20

    def __init__(self, cache_dir=None, default_threshold=DEFAULT_THRESHOLD):
        self.default_threshold = default_threshold
        if cache_dir is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            cache_dir = os.path.join(base_dir, "cache")
        self.cache_dir = cache_dir
        self.cache_file = os.path.join(self.cache_dir, "blog_embeddings.pkl")
        self._model = None
        self._cache = {}
        self._load_cache()

    @property
    def model(self):
        """Lazy-load the SentenceTransformer model on first usage."""
        if self._model is None:
            logger.info("Initializing SentenceTransformer model: %s", self.MODEL_NAME)
            try:
                # Attempt offline local load first
                self._model = SentenceTransformer(
                    self.MODEL_NAME,
                    local_files_only=True
                )
            except Exception as e:
                logger.info("Local files only failed (%s), loading with standard loader...", e)
                self._model = SentenceTransformer(self.MODEL_NAME)
            logger.info("SentenceTransformer model loaded successfully.")
        return self._model

    def _load_cache(self):
        """Load cached embeddings from local disk."""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "rb") as f:
                    data = pickle.load(f)
                    if isinstance(data, dict):
                        self._cache = data
                        logger.info("Loaded %d cached embeddings from %s", len(self._cache), self.cache_file)
            except Exception as e:
                logger.warning("Failed to load embeddings cache: %s", e)
                self._cache = {}
        else:
            self._cache = {}

    def _save_cache(self):
        """Persist cached embeddings to local disk."""
        try:
            os.makedirs(self.cache_dir, exist_ok=True)
            with open(self.cache_file, "wb") as f:
                pickle.dump(self._cache, f)
        except Exception as e:
            logger.warning("Failed to save embeddings cache: %s", e)

    def _get_fields_key(self, fields):
        if not fields:
            return "all"
        cleaned = sorted(list({f.strip().lower() for f in fields if f and f.strip()}))
        return ",".join(cleaned) if cleaned else "all"

    def build_searchable_text(self, blog, fields=None):
        """
        Build text representation of a blog incorporating title, topic, description, and content.
        Can be scoped to specific fields if requested.
        """
        title = (blog.get("title") or "").strip()
        topic = (blog.get("topic") or "").strip()
        description = (blog.get("subtitle") or blog.get("description") or "").strip()
        content = (blog.get("content") or "").strip()

        fields_key = self._get_fields_key(fields)
        parts = []

        if fields_key == "all":
            if title:
                parts.append(f"Title: {title}")
            if topic:
                parts.append(f"Topic: {topic}")
            if description:
                parts.append(f"Description: {description}")
            if content:
                # Include leading excerpt/content up to 1000 characters
                parts.append(f"Content: {content[:1000]}")
        else:
            selected_fields = set(fields_key.split(","))
            if any(f in selected_fields for f in ("title", "titles")) and title:
                parts.append(f"Title: {title}")
            if any(f in selected_fields for f in ("topic", "topics", "category")) and topic:
                parts.append(f"Topic: {topic}")
            if any(f in selected_fields for f in ("description", "descriptions", "subtitle")) and description:
                parts.append(f"Description: {description}")
            if any(f in selected_fields for f in ("content", "contents", "body")) and content:
                parts.append(f"Content: {content[:1000]}")

        return " | ".join(parts) if parts else (title or content or "SmartBlog story")

    def _compute_hash(self, text):
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def sync_blogs(self, blogs, fields=None):
        """
        Ensure embeddings for all provided blogs are up-to-date in cache.
        Only generates embeddings for new or modified blogs.
        """
        if not blogs:
            return

        fields_key = self._get_fields_key(fields)
        current_cache_keys = set()
        blogs_to_encode = []

        for b in blogs:
            b_id = b.get("blog_id") or b.get("id")
            if b_id is None:
                continue
            b_id = int(b_id)
            cache_key = f"{b_id}:{fields_key}"
            current_cache_keys.add(cache_key)

            text = self.build_searchable_text(b, fields=fields)
            thash = self._compute_hash(text)

            cached = self._cache.get(cache_key)
            if cached is None or cached.get("hash") != thash:
                blogs_to_encode.append((cache_key, text, thash))

        if blogs_to_encode:
            logger.info("Encoding %d new/updated blogs for scope '%s'...", len(blogs_to_encode), fields_key)
            texts = [item[1] for item in blogs_to_encode]
            embeddings = self.model.encode(texts, normalize_embeddings=True)
            for (cache_key, text, thash), emb in zip(blogs_to_encode, embeddings):
                self._cache[cache_key] = {
                    "hash": thash,
                    "embedding": emb.astype(np.float32),
                    "text": text
                }
            self._save_cache()

    def update_blog(self, blog):
        """
        Explicitly update cached embedding for a newly created or edited blog.
        """
        b_id = blog.get("blog_id") or blog.get("id")
        if b_id is None:
            return
        b_id = int(b_id)

        # Invalidate any old scopes for this blog and recompute default "all" scope
        keys_to_remove = [k for k in self._cache if str(k).startswith(f"{b_id}:") or str(k) == str(b_id)]
        for k in keys_to_remove:
            del self._cache[k]

        text = self.build_searchable_text(blog)
        thash = self._compute_hash(text)
        emb = self.model.encode([text], normalize_embeddings=True)[0]
        self._cache[f"{b_id}:all"] = {
            "hash": thash,
            "embedding": emb.astype(np.float32),
            "text": text
        }
        self._save_cache()
        logger.info("Updated embedding cache for blog %d", b_id)

    def remove_blog(self, blog_id):
        """Remove a deleted blog from the embedding cache."""
        b_id = int(blog_id)
        keys_to_remove = [k for k in self._cache if str(k).startswith(f"{b_id}:") or str(k) == str(b_id)]
        if keys_to_remove:
            for k in keys_to_remove:
                del self._cache[k]
            self._save_cache()
            logger.info("Removed blog %d from embedding cache", b_id)

    def search(self, query, blogs, threshold=None, limit=50, fields=None):
        """
        Execute semantic search against blogs using cosine similarity.
        Returns a list of matching blog dicts sorted by relevance score descending.
        """
        if threshold is None:
            threshold = self.default_threshold
        try:
            threshold = float(threshold)
        except (ValueError, TypeError):
            threshold = self.default_threshold

        try:
            limit = int(limit)
        except (ValueError, TypeError):
            limit = 50

        query = (query or "").strip()
        if not blogs:
            return []

        # If query is empty, return all blogs unchanged without relevance filter
        if not query:
            return blogs[:limit]

        # Sync cache for the requested fields
        self.sync_blogs(blogs, fields=fields)

        fields_key = self._get_fields_key(fields)

        # Extract embeddings for candidate blogs
        valid_blogs = []
        embeddings_list = []
        for b in blogs:
            b_id = int(b.get("blog_id") or b.get("id"))
            cache_key = f"{b_id}:{fields_key}"
            cached = self._cache.get(cache_key)
            if cached is not None and "embedding" in cached:
                valid_blogs.append(b)
                embeddings_list.append(cached["embedding"])

        if not valid_blogs:
            return []

        # Generate query embedding
        query_vector = self.model.encode([query], normalize_embeddings=True)[0]

        # Calculate cosine similarity
        # Since embeddings are normalized unit vectors, cosine similarity is matrix-vector dot product
        blog_matrix = np.array(embeddings_list, dtype=np.float32)
        scores = np.dot(blog_matrix, query_vector)

        # Filter by threshold and build results
        results = []
        for b, score in zip(valid_blogs, scores):
            if score >= threshold:
                item = dict(b)
                item["relevance_score"] = round(float(score), 4)
                results.append(item)

        # Sort descending by relevance score, secondary by created_at or blog_id
        results.sort(
            key=lambda x: (
                x.get("relevance_score", 0),
                x.get("created_at") or "",
                x.get("blog_id") or 0
            ),
            reverse=True
        )

        return results[:limit]


# Global engine instance
semantic_search_engine = SemanticSearchEngine()
