
/**
 * SmartBlog — Profile & Public Author Page
 * Supports:
 * - Own profile and public author profiles
 * - Profile editing and picture upload
 * - Published and saved stories
 * - Story editing
 * - Dynamic interests sidebar
 * - Story cover image fallbacks
 */

const API_BASE_URL = "http://127.0.0.1:5000";

document.addEventListener("DOMContentLoaded", async () => {
    const auth = window.SmartBlogAuth;

    if (auth && !auth.requireAuth("login.html")) {
        return;
    }

    const token = auth
        ? auth.getToken()
        : localStorage.getItem("token");

    let currentUser = {};

    try {
        currentUser = auth
            ? auth.getCurrentUser() || {}
            : JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
        currentUser = {};
    }

    const currentUserId = currentUser?.user_id || currentUser?.id;

    const urlParams = new URLSearchParams(window.location.search);
    const paramUserId = urlParams.get("user_id") || urlParams.get("id");

    const targetUserId = paramUserId
        ? Number.parseInt(paramUserId, 10)
        : currentUserId;

    const isOwnProfile =
        !paramUserId ||
        String(targetUserId) === String(currentUserId);

    // ==========================================
    // ELEMENT REFERENCES
    // ==========================================

    const get = id => document.getElementById(id);

    const displayName = get("displayName");
    const displayUsername = get("displayUsername");
    const displayBio = get("displayBio");
    const displayInterests = get("displayInterests");

    const profileAvatar = get("profileAvatar");
    const profilePicPreview = get("profilePicPreview");
    const cameraIcon = get("cameraIcon");
    const avatarUploadLabel = get("avatarUploadLabel");
    const profilePicInput = get("profilePicInput");
    const reputationBadge = get("reputationBadge");

    const editProfileBtn = get("editProfileBtn");
    const messageUserBtn = get("messageUserBtn");
    const editProfileSection = get("editProfileSection");
    const closeEditSectionBtn = get("closeEditSectionBtn");
    const cancelEditBtn = get("cancelEditBtn");
    const profileForm = get("profileForm");

    const nameInput = get("nameInput");
    const usernameInput = get("usernameInput");
    const bioInput = get("bioInput");
    const interestsInput = get("interestsInput");

    const publishedCount = get("publishedCount");
    const savedCount = get("savedCount");
    const statReputation = get("statReputation");
    const savedStatCard = get("savedStatCard");

    const authoredHeading = get("authoredHeading");
    const blogsGrid = get("blogsGrid");
    const blogsEmpty = get("blogsEmpty");
    const blogsEmptyDesc = get("blogsEmptyDesc");
    const createStoryLink = get("createStoryLink");
    const emptyWriteBtn = get("emptyWriteBtn");

    const savedSection = get("savedSection");
    const savedGrid = get("savedGrid");
    const savedEmpty = get("savedEmpty");

    const editBlogModal = get("editBlogModal");
    const editBlogForm = get("editBlogForm");
    const closeEditBlogBtn = get("closeEditBlogBtn");
    const cancelEditBlogBtn = get("cancelEditBlogBtn");

    const profileSidebarTopics = document.querySelector(
        ".profile-page .sidebar-topics"
    );

    const profileButton = get("profileButton");
    const profileDropdown = get("profileDropdown");
    const logoutButton = get("logoutButton");

    const SAVED_KEY = "smartblog_saved_blogs_v1";

    let activeProfileData = null;
    let publishedBlogs = [];
    let savedBlogs = [];
    let currentlyEditingBlog = null;

    const fallbackPublishedCover =
        "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=85";

    const fallbackSavedCover =
        "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=800&q=85";


    // ==========================================
    // GENERAL HELPERS
    // ==========================================

    function escapeHTML(value) {
        if (value === null || value === undefined) return "";

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function calculateReadTime(content) {
        if (!content) return 3;

        const words = String(content).trim().split(/\s+/).length;

        return Math.max(1, Math.ceil(words / 180));
    }

    function formatDate(dateValue) {
        if (!dateValue) return "Recently";

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) return "Recently";

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function getBlogId(blog) {
        return blog?.blog_id ?? blog?.id ?? "";
    }

    function getBlogCover(blog) {
        const possibleFields = [
            blog?.cover_url,
            blog?.image,
            blog?.imageUrl,
            blog?.coverImage,
            blog?.image_url,
            blog?.thumbnail,
            blog?.thumbnail_url,
            blog?.cover,
            blog?.featured_image
        ];

        return possibleFields.find(value =>
            typeof value === "string" && value.trim()
        ) || "";
    }

    function getBlogLink(blog) {
        if (blog?.link) return blog.link;

        const id = getBlogId(blog);

        return id
            ? `blog.html?id=${encodeURIComponent(id)}`
            : "explore.html";
    }

    function addImageFallback(img, fallbackUrl) {
        img.addEventListener("error", () => {
            if (img.dataset.fallbackApplied === "true") return;

            img.dataset.fallbackApplied = "true";
            img.src = fallbackUrl;
        });
    }

    async function readResponse(response) {
        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                `Request failed (${response.status})`
            );
        }

        return data;
    }


    // ==========================================
    // 1. OWN PROFILE / PUBLIC PROFILE MODE
    // ==========================================

    function setupProfileViewMode() {
        if (isOwnProfile) {
            if (editProfileBtn) editProfileBtn.hidden = false;
            if (messageUserBtn) messageUserBtn.hidden = true;

            if (cameraIcon) cameraIcon.hidden = false;

            if (avatarUploadLabel) {
                avatarUploadLabel.style.cursor = "pointer";
            }

            if (profilePicInput) profilePicInput.disabled = false;

            if (savedStatCard) savedStatCard.hidden = false;
            if (savedSection) savedSection.hidden = false;

            if (createStoryLink) createStoryLink.hidden = false;
            if (emptyWriteBtn) emptyWriteBtn.hidden = false;

            const pageTitle = get("profilePageTitle");

            if (pageTitle) {
                pageTitle.innerHTML = "My profile<span>.</span>";
            }

            const eyebrow = get("profilePageEyebrow");

            if (eyebrow) eyebrow.textContent = "CREATOR SPACE";

        } else {
            if (editProfileBtn) editProfileBtn.hidden = true;

            if (messageUserBtn) {
                messageUserBtn.hidden = false;
                messageUserBtn.href =
                    `messages.html?user_id=${encodeURIComponent(targetUserId)}`;
            }

            if (cameraIcon) cameraIcon.hidden = true;

            if (avatarUploadLabel) {
                avatarUploadLabel.style.cursor = "default";
            }

            if (profilePicInput) profilePicInput.disabled = true;

            if (savedStatCard) savedStatCard.hidden = true;
            if (savedSection) savedSection.hidden = true;

            if (createStoryLink) createStoryLink.hidden = true;
            if (emptyWriteBtn) emptyWriteBtn.hidden = true;

            const pageTitle = get("profilePageTitle");

            if (pageTitle) {
                pageTitle.innerHTML = "Author profile<span>.</span>";
            }

            const eyebrow = get("profilePageEyebrow");

            if (eyebrow) eyebrow.textContent = "MEET THE WRITER";
        }
    }


    // ==========================================
    // 2. LOAD PROFILE
    // ==========================================

    async function loadProfile() {
        if (!targetUserId && token) {
            try {
                const meRes = await fetch(`${API_BASE_URL}/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (meRes.ok) {
                    const meData = await meRes.json();
                    if (meData.user) {
                        currentUser = meData.user;
                        targetUserId = meData.user.user_id;
                        isOwnProfile = true;
                        if (auth?.setCurrentUser) auth.setCurrentUser(currentUser);
                    }
                }
            } catch (err) {
                console.warn("Could not fetch authenticated profile /me:", err);
            }
        }

        if (!targetUserId) {
            if (displayName) {
                displayName.textContent = "Profile unavailable";
            }
            return;
        }

        if (isOwnProfile) {
            try {
                if (auth?.fetchCurrentUser) {
                    const freshUser = await auth.fetchCurrentUser(true);

                    if (freshUser) {
                        activeProfileData = freshUser;
                        currentUser = freshUser;
                    } else {
                        activeProfileData = currentUser;
                    }
                } else {
                    activeProfileData = currentUser;
                }
            } catch (error) {
                console.error("Could not refresh user:", error);
                activeProfileData = currentUser;
            }

        } else {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/users/${encodeURIComponent(targetUserId)}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                const data = await readResponse(response);

                activeProfileData = data.user || data;

            } catch (error) {
                console.error("Could not load public profile:", error);

                if (displayName) {
                    displayName.textContent = "Author profile unavailable";
                }

                if (blogsEmpty) blogsEmpty.hidden = false;

                return;
            }
        }

        renderProfileHero();

        await loadAuthoredBlogs();

        if (isOwnProfile) {
            loadSavedBlogs();
        }
    }


    // ==========================================
    // 3. PROFILE HERO
    // ==========================================

    function renderProfileHero() {
        if (!activeProfileData) return;

        const name = String(
            activeProfileData.name || "Writer"
        ).trim();

        const username =
            activeProfileData.username ||
            name.toLowerCase().replace(/[^a-z0-9_]/g, "") ||
            "writer";

        const initial = name.charAt(0).toUpperCase() || "U";

        const reputation =
            activeProfileData.reputation_points || 0;

        if (displayName) {
            displayName.textContent = name;
        }

        if (displayUsername) {
            displayUsername.textContent = `@${username}`;
        }

        if (profileAvatar) {
            profileAvatar.textContent = initial;
        }

        if (reputationBadge) {
            reputationBadge.textContent = `★ ${reputation} points`;
        }

        if (statReputation) {
            statReputation.textContent = reputation;
        }

        // Bio
        const bioKey = `smartblog_bio_${targetUserId}`;

        let savedBio = "";

        try {
            savedBio = localStorage.getItem(bioKey) || "";
        } catch {}

        if (displayBio) {
            displayBio.textContent = savedBio ||
                activeProfileData.bio ||
                (isOwnProfile
                    ? "Curious learner and writer on SmartBlog. Exploring ideas and sharing stories."
                    : "Writer and creator sharing stories on SmartBlog.");
        }

        // Interests
        const interests = Array.isArray(activeProfileData.interests)
            ? activeProfileData.interests
            : ["Technology", "Writing"];

        if (displayInterests) {
            displayInterests.innerHTML = "";

            interests.forEach(topic => {
                const span = document.createElement("span");

                span.textContent = topic;

                displayInterests.appendChild(span);
            });
        }

        // Update the left Interests panel using the same visual structure.
        renderSidebarInterests(interests);

        // Profile picture
        const pictureKey =
            `smartblog_profile_pic_${targetUserId}`;

        let savedPicture = null;

        try {
            savedPicture = localStorage.getItem(pictureKey);
        } catch {}

        if (savedPicture && profilePicPreview) {
            profilePicPreview.src = savedPicture;
            profilePicPreview.classList.remove("hidden");

            if (profileAvatar) {
                profileAvatar.classList.add("hidden");
            }
        } else {
            if (profilePicPreview) {
                profilePicPreview.classList.add("hidden");
            }

            if (profileAvatar) {
                profileAvatar.classList.remove("hidden");
            }
        }

        // Edit form values
        if (isOwnProfile) {
            if (nameInput) nameInput.value = name;

            if (usernameInput) {
                usernameInput.value = username;
            }

            if (bioInput) {
                bioInput.value = savedBio ||
                    activeProfileData.bio ||
                    "";
            }

            if (interestsInput) {
                interestsInput.value = interests.join(", ");
            }
        }
    }


    // ==========================================
    // 4. DYNAMIC INTERESTS SIDEBAR
    // ==========================================

    function renderSidebarInterests(interests) {
        if (!profileSidebarTopics) return;

        const colors = [
            "lime-dot",
            "lavender-dot",
            "pink-dot",
            "orange-dot",
            "blue-dot"
        ];

        profileSidebarTopics.innerHTML = "";

        const topics = Array.isArray(interests)
            ? interests.filter(Boolean)
            : [];

        const finalTopics = topics.length
            ? topics.slice(0, 8)
            : ["Technology", "Writing"];

        const forYouButton = document.createElement("button");

        forYouButton.type = "button";
        forYouButton.className = "topic-active";
        forYouButton.innerHTML = `<i class="lime-dot"></i> For you`;

        forYouButton.addEventListener("click", () => {
            profileSidebarTopics
                .querySelectorAll("button")
                .forEach(button => button.classList.remove("topic-active"));

            forYouButton.classList.add("topic-active");
        });

        profileSidebarTopics.appendChild(forYouButton);

        finalTopics.forEach((topic, index) => {
            const button = document.createElement("button");

            button.type = "button";

            const dotClass = colors[index % colors.length];

            const dot = document.createElement("i");
            dot.className = dotClass;

            button.appendChild(dot);
            button.appendChild(document.createTextNode(` ${topic}`));

            button.addEventListener("click", () => {
                profileSidebarTopics
                    .querySelectorAll("button")
                    .forEach(item => item.classList.remove("topic-active"));

                button.classList.add("topic-active");
            });

            profileSidebarTopics.appendChild(button);
        });
    }


    // ==========================================
    // 5. LOAD AUTHORED BLOGS
    // ==========================================

    async function loadAuthoredBlogs() {
        if (!blogsGrid) return;

        blogsGrid.innerHTML = `
            <div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--muted)">
                Loading stories...
            </div>
        `;

        try {
            const response = await fetch(
                `${API_BASE_URL}/authors/${encodeURIComponent(targetUserId)}/blogs`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await readResponse(response);

            publishedBlogs = Array.isArray(data.blogs)
                ? data.blogs
                : [];

            if (publishedCount) {
                publishedCount.textContent = publishedBlogs.length;
            }

            if (authoredHeading) {
                authoredHeading.innerHTML = isOwnProfile
                    ? "Published stories<span>.</span>"
                    : `Stories by ${escapeHTML(activeProfileData?.name || "Author")}<span>.</span>`;
            }

            renderAuthoredCards();

        } catch (error) {
            console.error("Error loading authored stories:", error);

            blogsGrid.innerHTML = "";

            if (blogsEmpty) {
                blogsEmpty.hidden = false;
            }

            if (blogsEmptyDesc) {
                blogsEmptyDesc.textContent =
                    "We couldn't load these stories. Please refresh and try again.";
            }
        }
    }


    // ==========================================
    // 6. RENDER AUTHORED STORY CARDS
    // ==========================================

    function renderAuthoredCards() {
        if (!blogsGrid) return;

        blogsGrid.innerHTML = "";

        if (!publishedBlogs.length) {
            if (blogsEmpty) blogsEmpty.hidden = false;
            return;
        }

        if (blogsEmpty) blogsEmpty.hidden = true;

        publishedBlogs.forEach(blog => {
            const card = document.createElement("article");

            const tpl = (blog.template_id || "scrapbook").toLowerCase();
            card.className = `profile-story-card template-${tpl}`;
            card.dataset.template = tpl;

            const blogId = getBlogId(blog);
            const readTime = calculateReadTime(blog.content);
            const date = formatDate(blog.created_at);
            const cover = getBlogCover(blog);

            const excerpt = blog.subtitle ||
                (blog.content
                    ? String(blog.content).substring(0, 110) + "..."
                    : "Read this story on SmartBlog.");

            card.innerHTML = `
                <img
                    class="story-card-image"
                    alt="${escapeHTML(blog.title || "Story cover")}"
                    loading="lazy"
                >

                <div class="story-card-body">

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span class="story-card-topic">
                            ${escapeHTML(blog.topic || "Story")}
                        </span>
                        <span class="story-card-template-tag">
                            ${escapeHTML(blog.template_id || "scrapbook")}
                        </span>
                    </div>

                    <h3>
                        <a href="${getBlogLink(blog)}">
                            ${escapeHTML(blog.title || "Untitled story")}
                        </a>
                    </h3>

                    <p>${escapeHTML(excerpt)}</p>

                    <div class="story-card-meta">
                        <span>${escapeHTML(date)}</span>
                        <span>${readTime} MIN READ</span>
                    </div>

                    <div class="story-card-actions">
                        ${
                            isOwnProfile
                                ? `<button type="button" class="edit-blog-btn">✎ Edit story</button>`
                                : `<a href="${getBlogLink(blog)}">Read story ↗</a>`
                        }
                    </div>

                </div>
            `;

            const image = card.querySelector(".story-card-image");

            image.src = cover || fallbackPublishedCover;

            addImageFallback(image, fallbackPublishedCover);

            if (isOwnProfile) {
                const editButton = card.querySelector(".edit-blog-btn");

                editButton?.addEventListener("click", () => {
                    openBlogEditor(blog);
                });
            }

            blogsGrid.appendChild(card);
        });
    }


    // ==========================================
    // 7. LOAD SAVED BLOGS
    // ==========================================

    function loadSavedBlogs() {
        try {
            const raw = localStorage.getItem(SAVED_KEY);

            savedBlogs = raw ? JSON.parse(raw) : [];

            if (!Array.isArray(savedBlogs)) {
                savedBlogs = [];
            }

        } catch {
            savedBlogs = [];
        }

        if (savedCount) {
            savedCount.textContent = savedBlogs.length;
        }

        renderSavedCards();
    }


    // ==========================================
    // 8. RENDER SAVED STORY CARDS
    // ==========================================

    function renderSavedCards() {
        if (!savedGrid) return;

        savedGrid.innerHTML = "";

        if (!savedBlogs.length) {
            if (savedEmpty) savedEmpty.hidden = false;
            return;
        }

        if (savedEmpty) savedEmpty.hidden = true;

        savedBlogs.forEach(blog => {
            const card = document.createElement("article");

            card.className = "profile-story-card";

            const cover = getBlogCover(blog);
            const excerpt =
                blog.description ||
                blog.subtitle ||
                "Saved story on SmartBlog.";

            card.innerHTML = `
                <img
                    class="story-card-image"
                    alt="${escapeHTML(blog.title || "Saved story cover")}"
                    loading="lazy"
                >

                <div class="story-card-body">

                    <span class="story-card-topic">
                        ${escapeHTML(blog.topic || "Story")}
                    </span>

                    <h3>
                        <a href="${getBlogLink(blog)}">
                            ${escapeHTML(blog.title || "Untitled story")}
                        </a>
                    </h3>

                    <p>${escapeHTML(excerpt)}</p>

                    <div class="story-card-meta">
                        <span>By ${escapeHTML(blog.author || "SmartBlog writer")}</span>
                        <span>Saved</span>
                    </div>

                    <div class="story-card-actions">
                        <button type="button" class="remove-saved-btn">
                            ✕ Remove
                        </button>
                    </div>

                </div>
            `;

            const image = card.querySelector(".story-card-image");

            image.src = cover || fallbackSavedCover;

            addImageFallback(image, fallbackSavedCover);

            const removeButton = card.querySelector(".remove-saved-btn");

            removeButton?.addEventListener("click", () => {
                const removedId = String(
                    getBlogId(blog) || blog.title
                );

                savedBlogs = savedBlogs.filter(item => {
                    const itemId = String(
                        getBlogId(item) || item.title
                    );

                    return itemId !== removedId;
                });

                try {
                    localStorage.setItem(
                        SAVED_KEY,
                        JSON.stringify(savedBlogs)
                    );
                } catch (error) {
                    console.error("Could not update saved stories:", error);
                }

                if (savedCount) {
                    savedCount.textContent = savedBlogs.length;
                }

                renderSavedCards();
            });

            savedGrid.appendChild(card);
        });
    }


    // ==========================================
    // 9. PROFILE PICTURE UPLOAD
    // ==========================================

    if (isOwnProfile && profilePicInput) {
        profilePicInput.addEventListener("change", event => {
            const file = event.target.files?.[0];

            if (!file) return;

            const allowedTypes = [
                "image/png",
                "image/jpeg",
                "image/webp"
            ];

            if (!allowedTypes.includes(file.type)) {
                alert("Please select a PNG, JPG or WEBP image.");
                profilePicInput.value = "";
                return;
            }

            if (file.size > 4 * 1024 * 1024) {
                alert("Please choose an image under 4 MB.");
                profilePicInput.value = "";
                return;
            }

            const reader = new FileReader();

            reader.onload = event => {
                const base64 = event.target.result;

                const pictureKey =
                    `smartblog_profile_pic_${currentUserId}`;

                try {
                    localStorage.setItem(pictureKey, base64);
                } catch {
                    alert("Could not save the image. Please choose a smaller image.");
                    return;
                }

                if (profilePicPreview) {
                    profilePicPreview.src = base64;
                    profilePicPreview.classList.remove("hidden");
                }

                if (profileAvatar) {
                    profileAvatar.classList.add("hidden");
                }

                alert("Profile picture updated!");
            };

            reader.onerror = () => {
                alert("Could not read this image. Please try another one.");
            };

            reader.readAsDataURL(file);
        });
    }


    // ==========================================
    // 10. EDIT PROFILE
    // ==========================================

    if (isOwnProfile) {
        editProfileBtn?.addEventListener("click", () => {
            editProfileSection?.classList.toggle("hidden");

            nameInput?.focus();
        });

        closeEditSectionBtn?.addEventListener("click", () => {
            editProfileSection?.classList.add("hidden");
        });

        cancelEditBtn?.addEventListener("click", () => {
            editProfileSection?.classList.add("hidden");
        });

        profileForm?.addEventListener("submit", async event => {
            event.preventDefault();

            const newName = nameInput?.value.trim() || "";
            const newBio = bioInput?.value.trim() || "";
            const interestsText = interestsInput?.value.trim() || "";

            const newInterests = interestsText
                ? [...new Set(
                    interestsText
                        .split(",")
                        .map(item => item.trim())
                        .filter(Boolean)
                )]
                : [];

            if (newName.length < 2) {
                alert("Name must be at least 2 characters.");
                return;
            }

            const submitButton = profileForm.querySelector(
                'button[type="submit"]'
            );

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Saving...";
            }

            try {
                const response = await fetch(`${API_BASE_URL}/me`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: newName,
                        email: currentUser?.email
                    })
                });

                const data = await readResponse(response);

                if (data.success === false) {
                    throw new Error(
                        data.message || "Failed to update profile."
                    );
                }

                // Update interests on the backend.
                // An empty array is also sent so users can clear interests.
                const interestsResponse = await fetch(
                    `${API_BASE_URL}/me/interests`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            interests: newInterests
                        })
                    }
                );

                const interestsData =
                    await readResponse(interestsResponse);

                if (interestsData.success === false) {
                    throw new Error(
                        interestsData.message ||
                        "Name was updated, but interests could not be saved."
                    );
                }

                // Save bio locally, matching the existing implementation.
                const bioKey =
                    `smartblog_bio_${currentUserId}`;

                localStorage.setItem(bioKey, newBio);

                // Update in-memory profile.
                activeProfileData = {
                    ...activeProfileData,
                    name: newName,
                    interests: newInterests,
                    bio: newBio
                };

                currentUser = {
                    ...currentUser,
                    ...activeProfileData
                };

                if (auth?.setCurrentUser) {
                    auth.setCurrentUser(currentUser);
                }

                renderProfileHero();

                editProfileSection?.classList.add("hidden");

                alert("Profile updated successfully!");

            } catch (error) {
                console.error("Profile update failed:", error);

                alert(
                    error.message ||
                    "Failed to update profile. Please try again."
                );

            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = "Save changes ↗";
                }
            }
        });
    }


    // ==========================================
    // 11. EDIT BLOG MODAL
    // ==========================================

    function openBlogEditor(blog) {
        if (!editBlogModal || !editBlogForm) return;

        currentlyEditingBlog = blog;

        const blogId = getBlogId(blog);

        if (get("editBlogId")) {
            get("editBlogId").value = blogId;
        }

        if (get("editBlogTitle")) {
            get("editBlogTitle").value = blog.title || "";
        }

        if (get("editBlogSubtitle")) {
            get("editBlogSubtitle").value = blog.subtitle || "";
        }

        if (get("editBlogTopic")) {
            get("editBlogTopic").value = blog.topic || "";
        }

        if (get("editBlogCover")) {
            get("editBlogCover").value = getBlogCover(blog);
        }

        if (get("editBlogContent")) {
            get("editBlogContent").value = blog.content || "";
        }

        editBlogModal.classList.remove("hidden");
    }

    function closeBlogEditor() {
        editBlogModal?.classList.add("hidden");

        currentlyEditingBlog = null;
    }

    closeEditBlogBtn?.addEventListener("click", closeBlogEditor);

    cancelEditBlogBtn?.addEventListener("click", closeBlogEditor);

    editBlogModal?.addEventListener("click", event => {
        if (event.target === editBlogModal) {
            closeBlogEditor();
        }
    });

    editBlogForm?.addEventListener("submit", async event => {
        event.preventDefault();

        if (!currentlyEditingBlog) return;

        const blogId = getBlogId(currentlyEditingBlog);

        const updatedData = {
            title: get("editBlogTitle")?.value.trim() || "",
            subtitle: get("editBlogSubtitle")?.value.trim() || "",
            topic: get("editBlogTopic")?.value.trim() || "",
            cover_url: get("editBlogCover")?.value.trim() || "",
            content: get("editBlogContent")?.value || ""
        };

        if (!updatedData.title || !updatedData.content.trim()) {
            alert("Title and content are required.");
            return;
        }

        const submitButton = editBlogForm.querySelector(
            'button[type="submit"]'
        );

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Saving...";
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/blogs/${encodeURIComponent(blogId)}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(updatedData)
                }
            );

            const data = await readResponse(response);

            if (data.success === false) {
                throw new Error(
                    data.message || "Failed to update story."
                );
            }

            closeBlogEditor();

            await loadAuthoredBlogs();

            alert("Your story has been updated successfully!");

        } catch (error) {
            console.error("Story update failed:", error);

            alert(
                error.message ||
                "Could not update story. Please try again."
            );

        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Save changes ↗";
            }
        }
    });


    // ==========================================
    // 12. PROFILE DROPDOWN — Handled globally by auth.js
    // ==========================================
    if (window.SmartBlogAuth && typeof window.SmartBlogAuth.setupProfileDropdowns === "function") {
        window.SmartBlogAuth.setupProfileDropdowns();
    }


    // ==========================================
    // 13. LOGOUT
    // ==========================================

    document.querySelectorAll(".logout-btn").forEach(button => {
        button.addEventListener("click", () => {
            if (auth?.logout) {
                auth.logout();
            } else {
                localStorage.removeItem("token");
                localStorage.removeItem("user");

                window.location.href = "login.html";
            }
        });
    });


    // ==========================================
    // 14. INITIALIZE PAGE
    // ==========================================

    setupProfileViewMode();

    await loadProfile();
});
