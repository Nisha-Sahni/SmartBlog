
const API_BASE = "http://127.0.0.1:5000";
const SAVED_KEY = "smartblog_saved_blogs_v1";

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");

const searchTitles = document.getElementById("searchTitles");
const searchDescriptions = document.getElementById("searchDescriptions");
const searchTopics = document.getElementById("searchTopics");

const filters = document.querySelectorAll(".filter");
const resultsGrid = document.getElementById("resultsGrid");
const resultCount = document.getElementById("resultCount");
const resultsHeading = document.getElementById("resultsHeading");
const emptyState = document.getElementById("emptyState");
const resetSearch = document.getElementById("resetSearch");
const searchStatus = document.getElementById("searchStatus");

let allBlogs = [];
let currentResults = [];
let selectedTopic = "All";
let searchRequestId = 0;

/* DATE */

function setCurrentDate() {
    const dateElement = document.getElementById("currentDate");

    if (dateElement) {
        dateElement.textContent = new Date()
            .toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric"
            })
            .toUpperCase();
    }
}

/* USER PROFILE */

function loadUserProfile() {
    try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const name = user.name || user.username || "User";

        document.getElementById("userName").textContent = name;
        document.getElementById("userAvatar").textContent =
            name.charAt(0).toUpperCase();
    } catch {
        document.getElementById("userName").textContent = "User";
        document.getElementById("userAvatar").textContent = "U";
    }
}

/* SAVED BLOGS */

function getSavedBlogs() {
    try {
        return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    } catch {
        return [];
    }
}

function saveBlog(blog) {
    const saved = getSavedBlogs();
    const exists = saved.some(item => String(item.id) === String(blog.id));

    if (exists) {
        const updated = saved.filter(
            item => String(item.id) !== String(blog.id)
        );
        localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
        return false;
    }

    saved.push(blog);
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    return true;
}

/* NORMALIZE BLOG DATA */

function normalizeBlog(blog) {
    return {
        id: blog.id ?? blog.blog_id,
        title: blog.title || "Untitled story",
        description: blog.subtitle || blog.description || blog.content || "",
        content: blog.content || "",
        topic: blog.topic || blog.category || "General",
        image: blog.cover_url || blog.image || blog.image_url || "",
        author: blog.author || blog.author_name || "SmartBlog Writer",
        createdAt: blog.created_at || blog.date || "",
        link: blog.link || `blog.html?id=${blog.id ?? blog.blog_id}`,
        relevanceScore: blog.relevance_score ?? blog.relevanceScore ?? null
    };
}

/* GET ACTIVE SEARCH FIELDS */

function getActiveSearchFields() {
    const fields = [];
    if (searchTitles && searchTitles.checked) fields.push("title");
    if (searchDescriptions && searchDescriptions.checked) fields.push("description");
    if (searchTopics && searchTopics.checked) fields.push("topic");
    return fields;
}

/* LOAD BLOGS */

async function fetchBlogs() {
    searchStatus.textContent = "Loading stories...";
    resultsGrid.innerHTML = "";

    try {
        const response = await fetch(`${API_BASE}/blogs`);

        if (!response.ok) {
            throw new Error("Unable to load stories.");
        }

        const data = await response.json();
        allBlogs = (data.blogs || []).map(normalizeBlog);

        currentResults = [...allBlogs];
        applyTopicFilter();
    } catch (error) {
        searchStatus.textContent =
            "Could not connect to SmartBlog. Please check that the Flask backend is running.";

        resultCount.textContent = "Stories unavailable";
        emptyState.hidden = true;
    }
}

/* SEARCH */

async function searchBlogs() {
    const query = searchInput.value.trim();
    const requestId = ++searchRequestId;

    if (!query) {
        currentResults = [...allBlogs];
        resultsHeading.textContent = "Explore all stories";
        applyTopicFilter();
        return;
    }

    searchStatus.textContent = "Finding relevant stories using NLP semantic search...";
    resultsGrid.innerHTML = "";
    emptyState.hidden = true;
    resultsHeading.textContent = `Results for "${query}"`;

    const activeFields = getActiveSearchFields();
    let queryUrl = `${API_BASE}/search?q=${encodeURIComponent(query)}`;
    if (activeFields.length && activeFields.length < 3) {
        queryUrl += `&fields=${encodeURIComponent(activeFields.join(","))}`;
    }

    try {
        const response = await fetch(queryUrl);

        if (!response.ok) {
            throw new Error("Search request failed.");
        }

        const data = await response.json();

        if (requestId !== searchRequestId) return;

        const results = data.results || [];

        currentResults = results.map(item => {
            const blog = item.blog || item;
            return normalizeBlog(blog);
        });

        applyTopicFilter();
    } catch (error) {
        if (requestId !== searchRequestId) return;

        searchStatus.textContent =
            "Search could not be completed. Please try again.";
        resultCount.textContent = "Search unavailable";
    }
}

/* TOPIC FILTER */

function applyTopicFilter() {
    let filtered = [...currentResults];

    if (selectedTopic !== "All") {
        filtered = filtered.filter(blog =>
            blog.topic.toLowerCase().includes(selectedTopic.toLowerCase())
        );
    }

    renderResults(filtered);
}

/* CREATE STORY CARD */

function createStoryCard(blog) {
    const article = document.createElement("article");
    article.className = "story-card";

    const imageContainer = document.createElement("div");
    imageContainer.className = "story-image";

    if (blog.image) {
        const image = document.createElement("img");
        image.src = blog.image;
        image.alt = blog.title;
        image.loading = "lazy";

        image.onerror = () => {
            imageContainer.style.background = "#eee9dc";
            image.remove();
        };

        imageContainer.appendChild(image);
    }

    const content = document.createElement("div");
    content.className = "story-content";

    const category = document.createElement("span");
    category.className = "story-category";
    category.textContent = blog.topic;

    const title = document.createElement("h3");
    title.textContent = blog.title;

    const description = document.createElement("p");
    description.textContent = (blog.description || blog.content || "").slice(0, 180);

    const meta = document.createElement("div");
    meta.className = "story-meta";

    const author = document.createElement("span");
    author.className = "story-author";
    author.textContent = `By ${blog.author}`;
    meta.appendChild(author);

    if (blog.relevanceScore !== null && blog.relevanceScore !== undefined && searchInput.value.trim()) {
        const scoreBadge = document.createElement("span");
        scoreBadge.className = "story-match";
        const pct = Math.min(100, Math.round(blog.relevanceScore * 100));
        scoreBadge.textContent = `✦ ${pct}% match`;
        scoreBadge.title = `Semantic similarity score: ${blog.relevanceScore}`;
        meta.appendChild(scoreBadge);
    }

    const readLink = document.createElement("a");
    readLink.href = blog.link;
    readLink.textContent = "Read story →";
    meta.appendChild(readLink);

    content.append(category, title, description, meta);
    article.append(imageContainer, content);

    return article;
}

/* RENDER RESULTS */

function renderResults(blogs) {
    resultsGrid.innerHTML = "";
    searchStatus.textContent = "";

    resultCount.textContent =
        `${blogs.length} ${blogs.length === 1 ? "story" : "stories"} found`;

    if (!blogs.length) {
        emptyState.hidden = false;
        return;
    }

    emptyState.hidden = true;

    const fragment = document.createDocumentFragment();

    blogs.forEach(blog => {
        fragment.appendChild(createStoryCard(blog));
    });

    resultsGrid.appendChild(fragment);
}

/* CLEAR SEARCH */

function clearSearch() {
    searchInput.value = "";
    selectedTopic = "All";

    filters.forEach(filter => {
        filter.classList.toggle(
            "active",
            filter.dataset.topic === "All"
        );
    });

    searchTitles.checked = true;
    searchDescriptions.checked = true;
    searchTopics.checked = true;

    currentResults = [...allBlogs];
    resultsHeading.textContent = "Explore all stories";

    applyTopicFilter();
}

/* EVENTS */

searchButton.addEventListener("click", searchBlogs);

searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        searchBlogs();
    }
});

filters.forEach(filter => {
    filter.addEventListener("click", () => {
        filters.forEach(item => item.classList.remove("active"));

        filter.classList.add("active");
        selectedTopic = filter.dataset.topic;

        applyTopicFilter();
    });
});

[searchTitles, searchDescriptions, searchTopics].forEach(input => {
    input.addEventListener("change", () => {
        if (searchInput.value.trim()) {
            searchBlogs();
        } else {
            applyTopicFilter();
        }
    });
});

resetSearch.addEventListener("click", clearSearch);

/* INITIALIZE */

setCurrentDate();
loadUserProfile();
fetchBlogs();
