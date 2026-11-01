
const API_BASE_URL = "http://127.0.0.1:5000";

// ==========================================
// CURRENT USER
// ==========================================

let currentUser = null;

try {
    currentUser = JSON.parse(localStorage.getItem("user") || "null");
} catch (error) {
    console.error("Could not read user:", error);
}

if (!currentUser?.user_id) {
    window.location.href = "login.html";
    throw new Error("No authenticated user found.");
}

const userKey = String(currentUser.user_id);

const PROFILE_KEY = `smartblog_profile_${userKey}`;
const PROFILE_PIC_KEY = `smartblog_profile_pic_${userKey}`;
const BLOGS_KEY = `smartblog_blogs_${userKey}`;
const SAVED_KEY = `smartblog_saved_blogs_${userKey}`;
const HISTORY_KEY = `smartblog_reading_history_${userKey}`;

// ==========================================
// STORAGE
// ==========================================

const defaultProfile = {
    name: currentUser.name || "User",
    username: (currentUser.name || "user")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ""),
    bio: "Student, curious learner, and aspiring developer. I love exploring ideas and sharing what I learn.",
    interests: ["Technology", "Programming", "Writing"]
};

function readStorage(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
    } catch (error) {
        console.error("Storage read error:", error);
        return fallback;
    }
}

function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// ==========================================
// IMAGE URL HANDLING
// ==========================================

function resolveImageUrl(url) {
    if (!url) return "";

    const value = String(url).trim();

    if (!value) return "";

    if (/^(https?:\/\/|data:|blob:)/i.test(value)) {
        return value;
    }

    if (value.startsWith("//")) {
        return window.location.protocol + value;
    }

    // Root-relative URL belonging to Flask.
    if (value.startsWith("/")) {
        return `${API_BASE_URL}${value}`;
    }

    // Common Flask upload paths.
    if (
        value.startsWith("uploads/") ||
        value.startsWith("static/uploads/")
    ) {
        return `${API_BASE_URL}/${value}`;
    }

    return value;
}

// ==========================================
// BLOG NORMALIZATION
// ==========================================

function normalizeBlogs(items) {
    if (!Array.isArray(items)) return [];

    return items.map((blog, index) => {
        if (!blog || typeof blog !== "object") return null;

        const blogId =
            blog.blog_id ??
            blog.id ??
            blog.blogId ??
            blog.blogID ??
            null;

        const originalCover =
            blog.cover_url ??
            blog.coverImage ??
            blog.imageUrl ??
            blog.image ??
            "";

        const fullContent = String(
            blog.content || blog.description || blog.excerpt || ""
        );

        const description = String(
            blog.subtitle || blog.excerpt || fullContent
        ).trim();

        const hasDatabaseId =
            blogId !== null && blogId !== "";

        return {
            ...blog,

            id: hasDatabaseId ? String(blogId) : String(index),
            blog_id: hasDatabaseId ? blogId : null,

            title: String(blog.title || blog.name || "Untitled blog"),
            subtitle: String(blog.subtitle || ""),
            content: fullContent,

            topic: String(
                blog.topic || blog.category || "General"
            ),

            // Original database value. Never replace this with
            // the resolved display URL.
            cover_url: originalCover,

            // Used only by the image element.
            image: resolveImageUrl(originalCover),

            description: description.length > 220
                ? description.slice(0, 220).trim() + "..."
                : description,

            link: hasDatabaseId
                ? `blog.html?id=${encodeURIComponent(String(blogId))}`
                : (
                    blog.link ||
                    blog.url ||
                    blog.href ||
                    blog.blogUrl ||
                    ""
                )
        };
    }).filter(Boolean);
}

// ==========================================
// INITIAL DATA
// ==========================================

let profile = readStorage(PROFILE_KEY, { ...defaultProfile });
let blogs = normalizeBlogs(readStorage(BLOGS_KEY, []));
let savedBlogs = normalizeBlogs(readStorage(SAVED_KEY, []));
let history = normalizeBlogs(readStorage(HISTORY_KEY, []));

if (!profile || typeof profile !== "object") {
    profile = { ...defaultProfile };
}

// ==========================================
// PROFILE ELEMENTS
// ==========================================

const profileForm = document.getElementById("profileForm");
const profilePicInput = document.getElementById("profilePicInput");
const profilePicPreview = document.getElementById("profilePicPreview");
const profileAvatar = document.getElementById("profileAvatar");

// ==========================================
// DISPLAY PROFILE
// ==========================================

function displayProfile() {
    const name = profile.name || currentUser.name || "User";

    const displayName = document.getElementById("displayName");
    const displayUsername = document.getElementById("displayUsername");
    const displayBio = document.getElementById("displayBio");

    if (displayName) displayName.textContent = name;

    if (displayUsername) {
        displayUsername.textContent =
            "@" + (profile.username || defaultProfile.username);
    }

    if (displayBio) displayBio.textContent = profile.bio || "";

    const initial = name.trim().charAt(0).toUpperCase() || "?";

    if (profileAvatar) profileAvatar.textContent = initial;

    const sidebarAvatar = document.getElementById("sidebarAvatar");
    const sidebarName = document.getElementById("sidebarName");

    if (sidebarAvatar) sidebarAvatar.textContent = initial;
    if (sidebarName) sidebarName.textContent = name;

    const interestsContainer =
        document.getElementById("displayInterests");

    if (interestsContainer) {
        interestsContainer.replaceChildren();

        (Array.isArray(profile.interests) ? profile.interests : [])
            .forEach(interest => {
                const tag = document.createElement("span");
                tag.textContent = interest;
                interestsContainer.appendChild(tag);
            });
    }
}

// ==========================================
// PROFILE PICTURE
// ==========================================

function displayProfilePicture() {
    const picture = readStorage(PROFILE_PIC_KEY, "");

    if (picture && profilePicPreview && profileAvatar) {
        profilePicPreview.src = picture;
        profilePicPreview.classList.remove("hidden");
        profileAvatar.classList.add("hidden");
    } else {
        profilePicPreview?.classList.add("hidden");
        profileAvatar?.classList.remove("hidden");
    }
}

profilePicInput?.addEventListener("change", event => {
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

    if (file.size > 5 * 1024 * 1024) {
        alert("Please choose an image smaller than 5 MB.");
        profilePicInput.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = loadEvent => {
        const image = new Image();

        image.onload = () => {
            const canvas = document.createElement("canvas");
            const maxSize = 400;

            const scale = Math.min(
                1,
                maxSize / Math.max(image.width, image.height)
            );

            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);

            const context = canvas.getContext("2d");

            if (!context) {
                alert("Could not process this image.");
                return;
            }

            context.drawImage(
                image, 0, 0, canvas.width, canvas.height
            );

            try {
                const resized = canvas.toDataURL("image/jpeg", 0.8);
                writeStorage(PROFILE_PIC_KEY, resized);
                displayProfilePicture();
            } catch (error) {
                console.error(error);
                alert("Unable to save this picture.");
            }
        };

        image.onerror = () => alert("Could not load that image.");
        image.src = loadEvent.target.result;
    };

    reader.onerror = () => alert("Could not read the image.");
    reader.readAsDataURL(file);
});

// ==========================================
// PROFILE EDITOR
// ==========================================

function openEditor() {
    const section = document.getElementById("editProfileSection");
    if (!section) return;

    section.classList.remove("hidden");

    document.getElementById("nameInput").value = profile.name || "";
    document.getElementById("usernameInput").value =
        profile.username || "";
    document.getElementById("bioInput").value = profile.bio || "";

    document.getElementById("interestsInput").value =
        Array.isArray(profile.interests)
            ? profile.interests.join(", ")
            : "";

    section.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function closeEditor() {
    document.getElementById("editProfileSection")
        ?.classList.add("hidden");
}

document.getElementById("editProfileBtn")
    ?.addEventListener("click", openEditor);

document.getElementById("cancelEditBtn")
    ?.addEventListener("click", closeEditor);

profileForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const updatedName =
        document.getElementById("nameInput").value.trim() || "User";

    const updatedUsername =
        document.getElementById("usernameInput").value.trim();

    if (!/^[A-Za-z0-9_]+$/.test(updatedUsername)) {
        alert("Username can only contain letters, numbers and underscores.");
        return;
    }

    profile = {
        name: updatedName,
        username: updatedUsername,
        bio: document.getElementById("bioInput").value.trim(),
        interests: document.getElementById("interestsInput").value
            .split(",")
            .map(item => item.trim())
            .filter(Boolean)
    };

    try {
        // Save to backend MySQL database
        const token = localStorage.getItem("token");
        if (token && currentUser?.email) {
            try {
                const res = await fetch(`${API_BASE_URL}/me`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: updatedName,
                        email: currentUser.email
                    })
                });
                const resData = await res.json();
                if (!res.ok || !resData.success) {
                    throw new Error(resData.message || "Failed to update profile on server.");
                }
            } catch (err) {
                console.warn("Backend update failed, updating local state:", err);
            }
        }

        writeStorage(PROFILE_KEY, profile);

        currentUser.name = updatedName;
        if (window.SmartBlogAuth) {
            window.SmartBlogAuth.setCurrentUser(currentUser);
        } else {
            localStorage.setItem("user", JSON.stringify(currentUser));
        }

        displayProfile();
        closeEditor();
    } catch (error) {
        console.error(error);
        alert("Unable to save your profile.");
    }
});

// ==========================================
// EDIT BLOG MODAL
// ==========================================

const editBlogModal = document.getElementById("editBlogModal");
const editBlogForm = document.getElementById("editBlogForm");

let currentlyEditingBlog = null;

function openBlogEditor(blog) {
    if (!editBlogModal || !editBlogForm) {
        alert("Edit Blog form is missing from profile.html.");
        return;
    }

    if (blog.blog_id === null || blog.blog_id === undefined) {
        alert("This blog has no database ID and cannot be edited.");
        return;
    }

    currentlyEditingBlog = blog;

    document.getElementById("editBlogId").value = blog.blog_id;
    document.getElementById("editBlogTitle").value = blog.title || "";
    document.getElementById("editBlogSubtitle").value =
        blog.subtitle || "";
    document.getElementById("editBlogTopic").value =
        blog.topic || "";

    document.getElementById("editBlogCover").value =
        blog.cover_url || "";

    document.getElementById("editBlogContent").value =
        blog.content || "";

    editBlogModal.classList.remove("hidden");
    document.body.classList.add("modal-open");

    document.getElementById("editBlogTitle").focus();
}

function closeBlogEditor() {
    editBlogModal?.classList.add("hidden");
    document.body.classList.remove("modal-open");

    currentlyEditingBlog = null;
    editBlogForm?.reset();
}

document.getElementById("closeEditBlogBtn")
    ?.addEventListener("click", closeBlogEditor);

document.getElementById("cancelEditBlogBtn")
    ?.addEventListener("click", closeBlogEditor);

editBlogModal?.addEventListener("click", event => {
    if (event.target === editBlogModal) {
        closeBlogEditor();
    }
});

document.addEventListener("keydown", event => {
    if (
        event.key === "Escape" &&
        editBlogModal &&
        !editBlogModal.classList.contains("hidden")
    ) {
        closeBlogEditor();
    }
});

// ==========================================
// SAVE EDITED BLOG
// ==========================================

editBlogForm?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentlyEditingBlog) return;

    const token = localStorage.getItem("token");

    if (!token) {
        alert("Your session has expired. Please log in again.");
        return;
    }

    const blog = currentlyEditingBlog;
    const blogId = blog.blog_id;

    const enteredCover =
        document.getElementById("editBlogCover").value.trim();

    const updatedBlog = {
        title: document.getElementById("editBlogTitle").value.trim(),
        subtitle: document.getElementById("editBlogSubtitle").value.trim(),
        topic: document.getElementById("editBlogTopic").value.trim(),
        content: document.getElementById("editBlogContent").value,
        cover_url: enteredCover || blog.cover_url || ""
    };

    if (!updatedBlog.title || !updatedBlog.content.trim()) {
        alert("Blog title and content are required.");
        return;
    }

    const saveButton =
        editBlogForm.querySelector('button[type="submit"]');

    const originalText = saveButton?.textContent || "Save changes";

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/blogs/${encodeURIComponent(blogId)}`,
            {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(updatedBlog)
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || `Update failed: ${response.status}`
            );
        }

        closeBlogEditor();

        await loadPublishedBlogs();

        alert("Your blog has been updated successfully!");

    } catch (error) {
        console.error("Blog update error:", error);
        alert(error.message || "Could not update your blog.");
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = originalText;
        }
    }
});

// ==========================================
// CREATE BLOG CARD
// ==========================================

function createBlogCard(blog, type) {
    const card = document.createElement("article");

    // Match the CSS class used by the published/saved card styles.
    card.className = "blog-card profile-story-card";

    if (blog.image) {
        const image = document.createElement("img");

        image.className = "story-image";
        image.src = blog.image;
        image.alt = `${blog.title} cover`;
        image.loading = "lazy";

        image.addEventListener("error", () => {
            console.error(
                "Blog cover could not be loaded. Original URL:",
                blog.cover_url,
                "Resolved URL:",
                image.src
            );

            image.remove();

            const fallback = document.createElement("div");
            fallback.className = "blog-image-fallback";
            fallback.textContent = "✳";

            const label = document.createElement("span");
            label.textContent = "A story by you";

            fallback.appendChild(label);
            card.insertBefore(fallback, card.firstChild);
        });

        card.appendChild(image);
    } else {
        const fallback = document.createElement("div");
        fallback.className = "blog-image-fallback";
        fallback.textContent = "✳";

        const label = document.createElement("span");
        label.textContent = "A story by you";

        fallback.appendChild(label);
        card.appendChild(fallback);
    }

    const content = document.createElement("div");
    content.className = "blog-card-content story-content";

    const topic = document.createElement("span");
    topic.className = "blog-topic story-topic";
    topic.textContent = blog.topic || "General";
    content.appendChild(topic);

    const title = document.createElement("h3");
    title.textContent = blog.title || "Untitled blog";
    content.appendChild(title);

    if (blog.description) {
        const description = document.createElement("p");
        description.textContent = blog.description;
        content.appendChild(description);
    }

    if (blog.created_at) {
        const date = document.createElement("span");
        date.className = "blog-date";

        const parsedDate = new Date(blog.created_at);

        date.textContent = Number.isNaN(parsedDate.getTime())
            ? ""
            : parsedDate.toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric"
            });

        content.appendChild(date);
    }

    const actions = document.createElement("div");
    actions.className = "blog-card-actions";

    const destination = document.createElement("a");
    destination.className = "story-link";

    if (blog.link) {
        destination.href = blog.link;
        destination.textContent = "Read blog →";
    } else {
        destination.href = "#";
        destination.textContent = "Preview unavailable";
        destination.setAttribute("aria-disabled", "true");
        destination.addEventListener("click", event => {
            event.preventDefault();
        });
    }

    actions.appendChild(destination);

    if (type === "published") {
        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.className = "edit-blog-button";
        editButton.textContent = "✎ Edit";

        editButton.addEventListener("click", () => {
            openBlogEditor(blog);
        });

        actions.appendChild(editButton);
    }

    if (type === "saved") {
        const removeButton = document.createElement("button");

        removeButton.type = "button";
        removeButton.className = "remove-saved-button";
        removeButton.textContent = "♥ Remove saved";

        removeButton.addEventListener("click", () => {
            savedBlogs = savedBlogs.filter(
                item => String(item.id) !== String(blog.id)
            );

            try {
                writeStorage(SAVED_KEY, savedBlogs);
                renderAllBlogSections();
            } catch (error) {
                console.error(error);
                alert("Could not update your reading list.");
            }
        });

        actions.appendChild(removeButton);
    }

    content.appendChild(actions);
    card.appendChild(content);

    return card;
}

// ==========================================
// RENDER BLOGS
// ==========================================

function renderBlogCards(containerId, emptyId, items, type) {
    const container = document.getElementById(containerId);
    const emptyMessage = document.getElementById(emptyId);

    if (!container) return;

    container.replaceChildren();

    const hasBlogs = Array.isArray(items) && items.length > 0;

    if (emptyMessage) {
        emptyMessage.hidden = hasBlogs;
        emptyMessage.style.display = hasBlogs ? "none" : "";
    }

    if (!hasBlogs) return;

    items.forEach(blog => {
        container.appendChild(createBlogCard(blog, type));
    });
}

function renderStats() {
    const published = document.getElementById("publishedCount");
    const saved = document.getElementById("savedCount");
    const read = document.getElementById("historyCount");

    if (published) published.textContent = blogs.length;
    if (saved) saved.textContent = savedBlogs.length;
    if (read) read.textContent = history.length;
}

function renderAllBlogSections() {
    renderBlogCards("blogsGrid", "blogsEmpty", blogs, "published");
    renderBlogCards("savedGrid", "savedEmpty", savedBlogs, "saved");
    renderStats();
}

// ==========================================
// LOAD PUBLISHED BLOGS FROM MYSQL
// ==========================================

async function loadPublishedBlogs() {
    const token = localStorage.getItem("token");

    if (!token) {
        console.error("Login token not found.");
        renderAllBlogSections();
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/authors/${encodeURIComponent(userKey)}/blogs`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json"
                }
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load blogs.");
        }

        if (!Array.isArray(data.blogs)) {
            throw new Error("Backend did not return a blogs array.");
        }

        blogs = normalizeBlogs(data.blogs);

        renderAllBlogSections();

        try {
            writeStorage(BLOGS_KEY, blogs);
        } catch (error) {
            console.warn("Could not cache blogs:", error);
        }

        console.log("Published blogs loaded:", blogs);

    } catch (error) {
        console.error("Published blogs loading error:", error);
        renderAllBlogSections();
    }
}

// ==========================================
// INITIALIZE PROFILE
// ==========================================

function initializeProfile() {
    profile = {
        ...defaultProfile,
        ...profile,
        interests: Array.isArray(profile.interests)
            ? profile.interests
            : defaultProfile.interests
    };

    displayProfile();
    displayProfilePicture();
    renderAllBlogSections();
}

initializeProfile();
loadPublishedBlogs();

// ==========================================
// AUTHOR RANKING
// ==========================================

async function loadAuthorRank() {
    const profileBio = document.getElementById("displayBio");
    if (!profileBio) return;

    let rankCard = document.getElementById("authorRankCard");

    if (!rankCard) {
        rankCard = document.createElement("section");
        rankCard.id = "authorRankCard";
        rankCard.className = "author-rank-card";
        profileBio.insertAdjacentElement("afterend", rankCard);
    }

    rankCard.textContent = "Loading author ranking...";

    try {
        const token = localStorage.getItem("token");

        const response = await fetch(
            `${API_BASE_URL}/authors/${encodeURIComponent(userKey)}/rank`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token || ""}`,
                    "Accept": "application/json"
                }
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load ranking.");
        }

        rankCard.replaceChildren();

        const heading = document.createElement("h3");
        heading.textContent = "🏆 Author Ranking";

        const rank = document.createElement("p");
        rank.textContent = `Global Rank: #${data.rank ?? "—"}`;

        const points = document.createElement("p");
        points.textContent =
            `Reputation Points: ${data.points ?? "—"}`;

        const level = document.createElement("p");
        level.textContent = `Author Level: ${data.level ?? "—"}`;

        rankCard.append(heading, rank, points, level);

    } catch (error) {
        console.error("Author ranking error:", error);
        rankCard.textContent =
            "Unable to load ranking. Please check that the backend is running.";
    }
}

loadAuthorRank();
