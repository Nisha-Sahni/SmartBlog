
document.addEventListener("DOMContentLoaded", () => {

    // =========================================
    // ELEMENTS
    // =========================================

    const commentInput = document.getElementById("commentInput");
    const postCommentBtn = document.getElementById("postCommentBtn");
    const commentMessage = document.getElementById("commentMessage");
    const commentsList = document.getElementById("commentsList");
    const commentsCount = document.getElementById("commentsCount");

    const categoryElement = document.querySelector(".blog-page-category");
    const titleElement = document.querySelector(".blog-article > h1");
    const introductionElement = document.querySelector(".blog-introduction");
    const authorElement = document.querySelector(".blog-page-author strong");
    const authorAvatar = document.querySelector(".blog-page-avatar");
    const authorMeta = document.querySelector(".blog-page-author span");
    const coverImage = document.querySelector(".blog-cover img");
    const blogText = document.querySelector(".blog-text");
    const tagsContainer = document.querySelector(".blog-tags");

    // =========================================
    // CONFIGURATION
    // =========================================

    const API_URL = "http://127.0.0.1:5000";

    const params = new URLSearchParams(window.location.search);

    // Supports both ?id=2 and ?blog_id=2
    const blogId = params.get("id") || params.get("blog_id");

    // =========================================
    // VALIDATE BLOG ID
    // =========================================

    if (!blogId || !/^\d+$/.test(blogId) || Number(blogId) < 1) {

        if (titleElement) {
            titleElement.textContent = "Blog not found";
        }

        if (commentMessage) {
            commentMessage.textContent =
                "A valid blog ID is required.";
        }

        if (postCommentBtn) {
            postCommentBtn.disabled = true;
        }

        return;
    }

    // =========================================
    // LOAD BLOG DETAILS
    // =========================================

    async function loadBlog() {

        try {

            let blogUrl = `${API_URL}/blogs/${blogId}`;
            const reqHeaders = {};
            const token = localStorage.getItem("token");
            if (token) {
                reqHeaders["Authorization"] = `Bearer ${token}`;
            }
            try {
                const user = JSON.parse(localStorage.getItem("user") || "{}");
                if (user && user.user_id) {
                    blogUrl += `?user_id=${encodeURIComponent(user.user_id)}`;
                }
            } catch (_) {}

            const response = await fetch(
                blogUrl,
                { headers: reqHeaders }
            );

            const data = await response.json();

            if (!response.ok || !data.blog) {
                throw new Error(
                    data.message || "Could not load this blog."
                );
            }

            const blog = data.blog;

            // BLOG TITLE
            if (titleElement) {
                titleElement.textContent =
                    blog.title || "Untitled Blog";
            }

            // AUTHOR
            const authorName =
                blog.author_name || "SmartBlog User";

            if (authorElement) {
                authorElement.textContent = authorName;
            }

            if (authorAvatar) {
                authorAvatar.textContent =
                    authorName.charAt(0).toUpperCase();
            }

            // PUBLICATION DATE
            if (authorMeta) {

                const date = blog.created_at
                    ? new Date(blog.created_at)
                    : null;

                const formattedDate =
                    date && !Number.isNaN(date.getTime())
                        ? date.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                        })
                        : "";

                authorMeta.textContent = formattedDate
                    ? `Published ${formattedDate}`
                    : "Published on SmartBlog";
            }

            // ARTICLE CONTENT
            if (blogText) {

                blogText.replaceChildren();

                const content = blog.content || "";

                const paragraphs = content.split(/\n\s*\n/);

                paragraphs.forEach(paragraph => {

                    if (!paragraph.trim()) return;

                    const p = document.createElement("p");

                    p.textContent = paragraph.trim();

                    blogText.appendChild(p);

                });

                // Handle content with single line breaks
                if (!blogText.children.length && content.trim()) {

                    const p = document.createElement("p");

                    p.textContent = content.trim();

                    blogText.appendChild(p);
                }

                if (!content.trim()) {

                    const p = document.createElement("p");

                    p.textContent =
                        "No article content is available yet.";

                    blogText.appendChild(p);
                }
            }

            // REMOVE HARDCODED INTRODUCTION
            if (introductionElement) {
                introductionElement.remove();
            }

            // CATEGORY
            if (categoryElement) {
                categoryElement.textContent =
                    blog.topic || blog.category || "BLOG";
            }

            // COVER IMAGE
            // Only display an image if the API actually returns one.
            if (coverImage) {

                const coverContainer =
                    coverImage.closest(".blog-cover");

                const imageUrl = blog.cover_url || blog.image_url;

                if (imageUrl) {

                    coverImage.src = imageUrl;
                    coverImage.alt = blog.title || "Blog cover";

                    if (coverContainer) {
                        coverContainer.style.display = "";
                    }

                    coverImage.onerror = () => {
                        if (coverContainer) {
                            coverContainer.style.display = "none";
                        }
                    };

                } else if (coverContainer) {

                    coverContainer.style.display = "none";
                }
            }

            // TAGS
            // Only display tags if the API returns them.
            if (tagsContainer) {

                const tags = Array.isArray(blog.tags)
                    ? blog.tags
                    : [];

                tagsContainer.replaceChildren();

                if (tags.length > 0) {

                    tags.forEach(tag => {

                        const span = document.createElement("span");

                        span.textContent = tag;

                        tagsContainer.appendChild(span);
                    });

                    tagsContainer.style.display = "flex";

                } else {

                    tagsContainer.style.display = "none";
                }
            }

            // PAGE TITLE
            document.title =
                `${blog.title || "Blog"} | SmartBlog`;

        } catch (error) {

            console.error("Blog loading error:", error);

            if (titleElement) {
                titleElement.textContent = "Unable to load blog";
            }

            if (blogText) {

                blogText.replaceChildren();

                const message = document.createElement("p");

                message.textContent = error.message;

                blogText.appendChild(message);
            }

        }
    }


    // =========================================
    // LOAD COMMENTS
    // =========================================

    async function loadComments() {

        try {

            const response = await fetch(
                `${API_URL}/blogs/${blogId}/comments`
            );

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.message || "Could not load comments."
                );
            }

            commentsList.replaceChildren();

            const comments = data.comments || [];

            commentsCount.textContent =
                `${comments.length} comment${comments.length === 1 ? "" : "s"}`;

            if (comments.length === 0) {

                const emptyMessage = document.createElement("p");

                emptyMessage.textContent =
                    "Be the first to share your thoughts!";

                commentsList.appendChild(emptyMessage);

                return;
            }

            comments.forEach(comment => {

                const wrapper = document.createElement("div");

                wrapper.className = "comment";

                const avatar = document.createElement("div");

                avatar.className = "comment-avatar";

                avatar.textContent =
                    (comment.author_name || "U")
                        .charAt(0)
                        .toUpperCase();

                const details = document.createElement("div");

                const author = document.createElement("strong");

                author.textContent =
                    comment.author_name || "SmartBlog user";

                const date = document.createElement("small");

                date.textContent = comment.created_at
                    ? new Date(comment.created_at).toLocaleString()
                    : "";

                const text = document.createElement("p");

                text.textContent = comment.comment || "";

                details.append(author, date, text);

                wrapper.append(avatar, details);

                commentsList.appendChild(wrapper);

            });

        } catch (error) {

            console.error("Comment loading error:", error);

            if (commentMessage) {
                commentMessage.textContent = error.message;
            }

        }
    }


    // =========================================
    // POST COMMENT
    // =========================================

    async function postComment() {

        const comment = commentInput.value.trim();

        const token = localStorage.getItem("token");

        if (!comment) {

            commentMessage.textContent =
                "Please write a comment first.";

            return;
        }

        if (!token) {

            commentMessage.textContent =
                "Please log in to post a comment.";

            return;
        }

        postCommentBtn.disabled = true;

        commentMessage.textContent = "Posting...";

        try {

            const response = await fetch(
                `${API_URL}/blogs/${blogId}/comments`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        comment: comment
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.message || "Could not post comment."
                );
            }

            commentInput.value = "";

            commentMessage.textContent =
                "Comment posted successfully!";

            await loadComments();

        } catch (error) {

            console.error("Comment posting error:", error);

            commentMessage.textContent = error.message;

        } finally {

            postCommentBtn.disabled = false;

        }
    }


    // =========================================
    // EVENT LISTENER
    // =========================================

    if (postCommentBtn) {
        postCommentBtn.addEventListener("click", postComment);
    }


    // =========================================
    // INITIALIZE PAGE
    // =========================================

    loadBlog();
    loadComments();

});

