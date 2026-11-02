
const API_BASE = "http://127.0.0.1:5000";
const SAVED_KEY = "smartblog_saved_blogs_v1";

// ==========================================
// VERIFY LOGGED-IN USER
// ==========================================

let currentUser = null;
let authToken = null;

try {
    currentUser = JSON.parse(localStorage.getItem("user"));
    authToken = localStorage.getItem("token");
} catch (error) {
    console.error("Invalid stored user data:", error);
}

if (
    !currentUser ||
    !currentUser.user_id ||
    !authToken
) {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.replace("login.html");
    throw new Error("No valid logged-in user found.");
}

// ==========================================
// DASHBOARD ELEMENTS
// ==========================================

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchBtn");
const sidebarContainer = document.querySelector(".sidebar-topics");
const storyGrid = document.getElementById("storyGrid");
const emptyState = document.getElementById("emptyState");
const recsLoading = document.getElementById("recsLoading");
const refreshRecsBtn = document.getElementById("refreshRecsBtn");

let activeTopic = "All";
let userInterests = [];
let recommendedBlogs = [];

// ==========================================
// DISPLAY CURRENT USER
// ==========================================

function hydrateUserSession() {
    if (window.SmartBlogAuth) {
        const liveUser = window.SmartBlogAuth.getCurrentUser();
        if (liveUser) currentUser = liveUser;
    }
    const userName = (currentUser?.name || "User").trim();
    const firstName = userName.split(/\s+/)[0] || userName;
    const initial = firstName.charAt(0).toUpperCase() || "U";

    document.querySelectorAll(".small-avatar, .avatar, #userAvatar").forEach(el => {
        el.textContent = initial;
        el.style.cursor = "pointer";
        el.title = "View profile";
        el.onclick = (e) => {
            e.stopPropagation();
            window.location.href = "profile.html";
        };
    });

    const welcomeHeading = document.querySelector(".dashboard-welcome h1");
    if (welcomeHeading) {
        welcomeHeading.replaceChildren(
            document.createTextNode("Welcome back,"),
            document.createElement("br"),
            (() => {
                const nameElement = document.createElement("em");
                nameElement.textContent = firstName + ".";
                return nameElement;
            })()
        );
    }
}

hydrateUserSession();

// ==========================================
// SAVED BLOGS (LOCALSTORAGE)
// ==========================================

function getSavedBlogIds() {
    try {
        const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
        return saved.map(item => String(item.id || item.blog_id));
    } catch {
        return [];
    }
}

function toggleSaveBlog(blog, button) {
    try {
        const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
        const bId = String(blog.blog_id || blog.id);
        const index = saved.findIndex(item => String(item.id || item.blog_id) === bId);

        let isSaved = false;
        if (index >= 0) {
            saved.splice(index, 1);
            isSaved = false;
        } else {
            saved.push({
                id: blog.blog_id || blog.id,
                title: blog.title,
                topic: blog.topic,
                author: blog.author_name,
                image: blog.image || blog.cover_url
            });
            isSaved = true;
        }

        localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
        button.classList.toggle("saved", isSaved);
        button.textContent = isSaved ? "♥ Saved" : "♡ Save";
    } catch (e) {
        console.error("Save blog error:", e);
    }
}

// ==========================================
// CREATE STORY CARD
// ==========================================

function createStoryCard(blog, isLarge = false) {
    const article = document.createElement("article");
    article.className = `story-card ${isLarge ? "story-large" : ""}`.trim();
    article.dataset.topic = blog.topic || "General";
    article.dataset.search = `${blog.title} ${blog.subtitle || ""} ${blog.topic || ""} ${blog.author_name || ""}`.toLowerCase();

    const blogUrl = `blog.html?id=${blog.blog_id || blog.id}`;

    // Thumbnail / Image
    const imageLink = document.createElement("a");
    imageLink.className = "story-image";
    imageLink.href = blogUrl;

    const img = document.createElement("img");
    const fallbackImages = [
        "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80"
    ];
    const fallback = fallbackImages[(blog.blog_id || 0) % fallbackImages.length];
    img.src = blog.cover_url || blog.image || fallback;
    img.alt = blog.title || "Story thumbnail";
    img.loading = "lazy";
    img.onerror = () => { img.src = fallback; };
    imageLink.appendChild(img);

    const label = document.createElement("span");
    label.className = "image-label";
    label.textContent = (blog.topic || "Story").toUpperCase();
    imageLink.appendChild(label);

    // Body
    const body = document.createElement("div");
    body.className = "story-body";

    // Meta (author + reason)
    const metaContainer = document.createElement("div");
    metaContainer.style.display = "flex";
    metaContainer.style.flexWrap = "wrap";
    metaContainer.style.alignItems = "center";
    metaContainer.style.justifyContent = "space-between";
    metaContainer.style.gap = "6px";
    metaContainer.style.marginBottom = "6px";

    const meta = document.createElement(blog.author_id ? "a" : "span");
    meta.className = "meta";
    meta.textContent = `BY ${(blog.author_name || "SmartBlog Writer").toUpperCase()}`;
    if (blog.author_id) {
        meta.href = `profile.html?user_id=${blog.author_id}`;
        meta.title = `View ${(blog.author_name || "Author")}'s profile`;
        meta.style.textDecoration = "none";
        meta.style.color = "inherit";
    }
    metaContainer.appendChild(meta);

    if (blog.recommendation_reason) {
        const reasonSpan = document.createElement("span");
        reasonSpan.className = "recom-badge";
        reasonSpan.textContent = `✳ ${blog.recommendation_reason}`;
        metaContainer.appendChild(reasonSpan);
    }
    body.appendChild(metaContainer);

    // Title
    const h3 = document.createElement("h3");
    const titleLink = document.createElement("a");
    titleLink.href = blogUrl;
    titleLink.textContent = blog.title || "Untitled Story";
    h3.appendChild(titleLink);
    body.appendChild(h3);

    // Excerpt
    const p = document.createElement("p");
    const descText = blog.subtitle || blog.description || blog.content || "";
    p.textContent = descText.length > 170 ? descText.slice(0, 170) + "..." : descText;
    body.appendChild(p);

    // Footer
    const footer = document.createElement("div");
    footer.className = "story-footer";

    const readLink = document.createElement("a");
    readLink.className = "read-story-link";
    readLink.href = blogUrl;
    readLink.textContent = "Read Blog ↗";

    const saveBtn = document.createElement("button");
    saveBtn.className = "save-button";
    saveBtn.type = "button";
    const savedIds = getSavedBlogIds();
    const isSaved = savedIds.includes(String(blog.blog_id || blog.id));
    if (isSaved) {
        saveBtn.classList.add("saved");
        saveBtn.textContent = "♥ Saved";
    } else {
        saveBtn.textContent = "♡ Save";
    }
    saveBtn.addEventListener("click", () => toggleSaveBlog(blog, saveBtn));

    footer.append(readLink, saveBtn);
    body.appendChild(footer);

    article.append(imageLink, body);
    return article;
}

// ==========================================
// RENDER RECOMMENDATIONS
// ==========================================

function renderRecommendations(blogs) {
    if (!storyGrid) return;
    storyGrid.innerHTML = "";

    if (!blogs || !blogs.length) {
        if (emptyState) emptyState.hidden = false;
        return;
    }

    if (emptyState) emptyState.hidden = true;

    const fragment = document.createDocumentFragment();
    blogs.forEach((blog) => {
        // All recommendation cards are standardized uniformly
        const card = createStoryCard(blog, false);
        fragment.appendChild(card);
    });

    storyGrid.appendChild(fragment);
    filterStories();
}

// ==========================================
// LOAD RECOMMENDATIONS FROM BACKEND
// ==========================================

async function loadRecommendations() {
    if (recsLoading) recsLoading.hidden = false;
    if (emptyState) emptyState.hidden = true;

    try {
        const savedIds = getSavedBlogIds().join(",");
        let url = `${API_BASE}/recommendations?limit=8`;
        if (savedIds) {
            url += `&saved_ids=${encodeURIComponent(savedIds)}`;
        }

        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch recommendations: ${response.status}`);
        }

        const data = await response.json();
        if (data.success && Array.isArray(data.recommendations)) {
            recommendedBlogs = data.recommendations;
            renderRecommendations(recommendedBlogs);
        } else {
            renderRecommendations([]);
        }
    } catch (error) {
        console.error("Error loading recommendations:", error);
        renderRecommendations([]);
    } finally {
        if (recsLoading) recsLoading.hidden = true;
    }
}

// ==========================================
// SEARCH AND FILTER STORIES
// ==========================================

function filterStories() {
    if (!storyGrid) return;
    const cards = storyGrid.querySelectorAll(".story-card");
    const query = (searchInput ? searchInput.value : "").toLowerCase().trim();

    let visibleCount = 0;

    cards.forEach(card => {
        const topic = (card.dataset.topic || "").toLowerCase();
        const searchData = card.dataset.search || "";

        const matchesTopic = (
            activeTopic === "All" ||
            topic.includes(activeTopic.toLowerCase()) ||
            activeTopic.toLowerCase().includes(topic)
        );

        const matchesQuery = !query || searchData.includes(query);

        const show = matchesTopic && matchesQuery;
        card.hidden = !show;

        if (show) visibleCount++;
    });

    if (emptyState) {
        emptyState.hidden = visibleCount > 0;
    }
}

// ==========================================
// TOPIC FILTERING
// ==========================================

function chooseTopic(topic) {
    activeTopic = topic;

    document.querySelectorAll(".sidebar-topics button").forEach(button => {
        button.classList.toggle(
            "topic-active",
            button.dataset.topic === topic
        );
    });

    filterStories();
}

function createTopicButton(topic) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.topic = topic;

    const dot = document.createElement("i");
    const dotClasses = {
        All: "lime-dot",
        Technology: "lavender-dot",
        Lifestyle: "pink-dot",
        Creativity: "orange-dot",
        Learning: "blue-dot",
        Programming: "lavender-dot",
        "Health & Fitness": "lime-dot",
        Business: "orange-dot"
    };

    dot.className = dotClasses[topic] || "lime-dot";
    const label = topic === "All" ? "For you" : topic;

    button.appendChild(dot);
    button.appendChild(document.createTextNode(label));
    button.addEventListener("click", () => chooseTopic(topic));

    return button;
}

// ==========================================
// RENDER USER INTERESTS
// ==========================================

function renderInterests(interests) {
    if (!sidebarContainer) return;
    sidebarContainer.innerHTML = "";

    sidebarContainer.appendChild(createTopicButton("All"));

    interests.forEach(topic => {
        sidebarContainer.appendChild(createTopicButton(topic));
    });

    chooseTopic("All");
}

// ==========================================
// LOAD INTERESTS FOR CURRENT USER
// ==========================================

async function loadInterests() {
    try {
        const userId = currentUser.user_id;
        const response = await fetch(
            `${API_BASE}/interests/${encodeURIComponent(userId)}`,
            {
                headers: {
                    "Authorization": `Bearer ${authToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error("Could not fetch interests.");
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || "Could not load interests.");
        }

        userInterests = Array.isArray(data.interests) ? data.interests : [];
        renderInterests(userInterests);
    } catch (error) {
        console.error("Error loading interests:", error);
    }
}

// ==========================================
// LOAD READING HISTORY
// ==========================================

async function loadReadingHistory() {
    const historyCard = document.querySelector(".history-card");
    if (!historyCard) return;

    try {
        const response = await fetch(`${API_BASE}/reading-history`, {
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.success && data.reading_history && data.reading_history.length > 0) {
            const latest = data.reading_history[0];
            const readDate = latest.read_at ? new Date(latest.read_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Recently";
            
            historyCard.innerHTML = `
                <div class="history-icon">◷</div>
                <div style="flex: 1;">
                    <span class="meta" style="color: var(--olive); font-size: 8px;">READ ON ${readDate.toUpperCase()} · ${latest.topic.toUpperCase()}</span>
                    <strong style="display: block; margin: 4px 0;"><a href="blog.html?id=${latest.blog_id}" style="color: inherit; text-decoration: none;">${latest.title}</a></strong>
                    <p style="margin: 0; font-size: 10px; color: var(--muted);">${latest.subtitle || "Continue reading from where you left off."}</p>
                </div>
                <a href="blog.html?id=${latest.blog_id}" class="read-story-link" style="white-space: nowrap;">Continue ↗</a>
            `;
        }
    } catch (e) {
        console.debug("Reading history load note:", e);
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

if (searchInput) {
    searchInput.addEventListener("input", filterStories);
    searchInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            filterStories();
        }
    });
}

if (searchButton) {
    searchButton.addEventListener("click", filterStories);
}

if (refreshRecsBtn) {
    refreshRecsBtn.addEventListener("click", () => {
        loadRecommendations();
    });
}

// ==========================================
// INITIALIZE
// ==========================================

loadInterests();
loadRecommendations();
loadReadingHistory();
