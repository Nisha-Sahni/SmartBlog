/**
 * SmartBlog — Dynamic Explore Stories Page
 * Loads published stories directly from MySQL via Flask API.
 */

const API_BASE = "http://127.0.0.1:5000";
const SAVED_KEY = "smartblog_saved_blogs_v1";

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const storyGrid = document.getElementById("storyGrid");
const emptyState = document.getElementById("emptyState");
const storyCount = document.getElementById("storyCount");
const sidebarContainer = document.querySelector(".sidebar-topics");
const filtersContainer = document.querySelector(".filters");

let allBlogs = [];
let selectedTopic = "All";
let userInterests = [];

const topicCategoryClasses = {
  Technology: "lime",
  Creativity: "lavender",
  Lifestyle: "pink",
  Learning: "blue",
  "Personal Stories": "peach",
  Science: "blue",
  Business: "lime",
  "Health & Fitness": "pink"
};

const topicFallbackImages = {
  Technology: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=85",
  Creativity: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=85",
  Lifestyle: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=85",
  Learning: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=85",
  "Personal Stories": "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=85",
  Default: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=800&q=85"
};

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSavedBlogs() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function toggleSavedBlog(blog) {
  let savedBlogs = getSavedBlogs();
  const blogIdStr = String(blog.blog_id);

  const alreadySaved = savedBlogs.some(
    saved => String(saved.blog_id || saved.id || saved.title) === blogIdStr
  );

  if (alreadySaved) {
    savedBlogs = savedBlogs.filter(
      saved => String(saved.blog_id || saved.id || saved.title) !== blogIdStr
    );
  } else {
    savedBlogs.push({
      id: blog.blog_id,
      blog_id: blog.blog_id,
      title: blog.title,
      description: blog.subtitle || blog.excerpt || "",
      topic: blog.topic || "General",
      image: blog.cover_url || topicFallbackImages[blog.topic] || topicFallbackImages.Default,
      author: blog.author_name || "SmartBlog writer",
      link: `blog.html?id=${blog.blog_id}`
    });
  }

  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedBlogs));
    renderStories();
  } catch (error) {
    alert("Could not update saved stories.");
  }
}

function calculateReadTime(text) {
  if (!text) return 3;
  const wordCount = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 180));
}

function formatDate(dateStr) {
  if (!dateStr) return "Recently";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "Recently";
  }
}

function renderStories() {
  if (!storyGrid) return;

  const query = (searchInput?.value || "").trim().toLowerCase();
  const savedBlogs = getSavedBlogs();

  // If semantic search produced results, use them as source; otherwise use allBlogs
  const sourceBlogs = searchResults !== null ? searchResults : allBlogs;

  const filtered = sourceBlogs.filter(blog => {
    const topic = (blog.topic || "").toLowerCase();
    const topicMatches =
      selectedTopic === "All" ||
      topic === selectedTopic.toLowerCase();

    if (searchResults !== null) {
      // Backend NLP semantic model already matched and ranked results
      return topicMatches;
    }

    const titleText = (blog.title || "").toLowerCase();
    const subtitleText = (blog.subtitle || "").toLowerCase();
    const contentText = (blog.content || "").toLowerCase();
    const authorText = (blog.author_name || "").toLowerCase();

    const searchMatches =
      !query ||
      titleText.includes(query) ||
      subtitleText.includes(query) ||
      contentText.includes(query) ||
      topic.includes(query) ||
      authorText.includes(query);

    return topicMatches && searchMatches;
  });

  if (storyCount) {
    storyCount.textContent = `${filtered.length} ${filtered.length === 1 ? "story" : "stories"}`;
  }

  if (emptyState) {
    emptyState.hidden = filtered.length > 0;
  }

  storyGrid.innerHTML = "";

  if (filtered.length === 0) {
    return;
  }

  filtered.forEach(blog => {
    const card = document.createElement("article");
    card.className = "story-card";
    card.dataset.id = blog.blog_id;
    card.dataset.topic = blog.topic || "General";

    const coverUrl =
      blog.cover_url && blog.cover_url.trim().length > 5
        ? blog.cover_url
        : (topicFallbackImages[blog.topic] || topicFallbackImages.Default);

    const catClass = topicCategoryClasses[blog.topic] || "lime";
    const readTime = calculateReadTime(blog.content);
    const dateFormatted = formatDate(blog.created_at);
    const excerpt = blog.subtitle || (blog.content ? blog.content.substring(0, 110) + "..." : "Read this story on SmartBlog.");

    const isSaved = savedBlogs.some(
      s => String(s.blog_id || s.id || s.title) === String(blog.blog_id)
    );

    const authorId = blog.author_id || blog.user_id;

    card.innerHTML = `
      <a href="blog.html?id=${blog.blog_id}" class="story-image" aria-label="${escapeHTML(blog.title)}">
        <img src="${escapeHTML(coverUrl)}" alt="${escapeHTML(blog.title)}" loading="lazy">
        <span class="category ${catClass}">${escapeHTML((blog.topic || "Story").toUpperCase())}</span>
      </a>
      <div class="story-content">
        <span class="meta">${readTime} MIN READ · ${escapeHTML(dateFormatted.toUpperCase())}</span>
        <h3><a href="blog.html?id=${blog.blog_id}" class="card-title-link" style="text-decoration:none; color:inherit;">${escapeHTML(blog.title)}</a></h3>
        <p>${escapeHTML(excerpt)}</p>
        <div class="story-footer">
          ${authorId ? `<a href="profile.html?user_id=${authorId}" class="author-link" style="color:inherit; text-decoration:none; font-weight:600;" title="View author profile">By ${escapeHTML(blog.author_name || "SmartBlog writer")}</a>` : `<span>By ${escapeHTML(blog.author_name || "SmartBlog writer")}</span>`}
          <div style="display:flex; align-items:center; gap:8px;">
            <a href="blog.html?id=${blog.blog_id}" class="read-more-link" style="font-size:12px; font-weight:600; color:inherit; text-decoration:none;">Read ↗</a>
            <button type="button" class="save-button ${isSaved ? "saved" : ""}" aria-pressed="${isSaved}">
              ${isSaved ? "♥ Saved" : "♡ Save"}
            </button>
          </div>
        </div>
      </div>
    `;

    // Make entire card stably clickable to open the story
    card.style.cursor = "pointer";
    card.addEventListener("click", e => {
      // Do not navigate if user clicked save button or author link
      if (e.target.closest(".save-button") || e.target.closest("button") || e.target.closest(".author-link")) {
        return;
      }
      window.location.href = `blog.html?id=${blog.blog_id}`;
    });

    const saveBtn = card.querySelector(".save-button");
    if (saveBtn) {
      saveBtn.addEventListener("click", e => {
        e.stopPropagation();
        toggleSavedBlog(blog);
      });
    }

    const authorLink = card.querySelector(".author-link");
    if (authorLink) {
      authorLink.addEventListener("click", e => {
        e.stopPropagation();
      });
    }

    storyGrid.appendChild(card);
  });
}

function chooseTopic(topic) {
  selectedTopic = topic;

  document.querySelectorAll(".filter").forEach(filter => {
    filter.classList.toggle("active", filter.dataset.topic === topic);
  });

  document.querySelectorAll(".sidebar-topics button").forEach(button => {
    button.classList.toggle("topic-active", button.dataset.topic === topic);
  });

  renderStories();
}

function updateTopicFilters() {
  // Collect all unique topics from blogs
  const topicsSet = new Set(["Technology", "Lifestyle", "Creativity", "Learning"]);
  allBlogs.forEach(b => {
    if (b.topic && b.topic.trim()) topicsSet.add(b.topic.trim());
  });

  if (filtersContainer) {
    filtersContainer.innerHTML = "";
    const allBtn = document.createElement("button");
    allBtn.className = `filter ${selectedTopic === "All" ? "active" : ""}`;
    allBtn.dataset.topic = "All";
    allBtn.textContent = "All stories";
    allBtn.addEventListener("click", () => chooseTopic("All"));
    filtersContainer.appendChild(allBtn);

    topicsSet.forEach(topic => {
      const btn = document.createElement("button");
      btn.className = `filter ${selectedTopic === topic ? "active" : ""}`;
      btn.dataset.topic = topic;
      btn.textContent = topic;
      btn.addEventListener("click", () => chooseTopic(topic));
      filtersContainer.appendChild(btn);
    });
  }
}

async function fetchBlogs() {
  if (storyGrid) {
    storyGrid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--muted, #77766f);">
        <p>Loading stories from SmartBlog community...</p>
      </div>
    `;
  }

  try {
    const response = await fetch(`${API_BASE}/blogs`);
    if (!response.ok) {
      throw new Error(`Failed to load stories: ${response.status}`);
    }

    const data = await response.json();
    allBlogs = Array.isArray(data.blogs) ? data.blogs : [];

    updateTopicFilters();
    renderStories();
  } catch (error) {
    console.error("Error fetching explore blogs:", error);
    if (storyGrid) {
      storyGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--muted, #77766f);">
          <p>Could not connect to server to load stories. Please try refreshing.</p>
        </div>
      `;
    }
  }
}

function createTopicButton(topic) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.topic = topic;

  const dotClasses = {
    All: "lime-dot",
    Technology: "lavender-dot",
    Lifestyle: "pink-dot",
    Creativity: "orange-dot",
    Learning: "blue-dot",
    "Personal Stories": "orange-dot"
  };

  const dot = document.createElement("i");
  dot.className = dotClasses[topic] || "lime-dot";
  const label = topic === "All" ? "For you" : topic;

  button.appendChild(dot);
  button.appendChild(document.createTextNode(` ${label}`));
  button.addEventListener("click", () => chooseTopic(topic));
  return button;
}

function renderSidebarInterests(interests) {
  if (!sidebarContainer) return;
  sidebarContainer.innerHTML = "";
  sidebarContainer.appendChild(createTopicButton("All"));

  interests.forEach(topic => {
    sidebarContainer.appendChild(createTopicButton(topic));
  });
}

async function loadInterests() {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = storedUser?.user_id ?? storedUser?.id;

    if (!userId) {
      return;
    }

    const response = await fetch(`${API_BASE}/interests/${encodeURIComponent(userId)}`);
    if (!response.ok) return;

    const data = await response.json();
    if (data.success && Array.isArray(data.interests)) {
      userInterests = data.interests;
      renderSidebarInterests(userInterests);
    }
  } catch (error) {
    console.warn("Could not load user interests:", error);
  }
}

// SEMANTIC NLP SEARCH INTEGRATION
let searchDebounceTimer = null;
let searchResults = null;

async function performSemanticSearch() {
  const query = (searchInput?.value || "").trim();

  if (!query) {
    searchResults = null;
    renderStories();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      searchResults = Array.isArray(data.results) ? data.results : [];
    } else {
      searchResults = null;
    }
  } catch (err) {
    console.warn("Semantic search endpoint error, falling back to local search:", err);
    searchResults = null;
  }

  renderStories();
}

function handleSearchInput() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(performSemanticSearch, 300);
}

if (searchInput) {
  searchInput.addEventListener("input", handleSearchInput);
  searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      clearTimeout(searchDebounceTimer);
      performSemanticSearch();
    }
  });
}

if (searchButton) {
  searchButton.addEventListener("click", () => {
    clearTimeout(searchDebounceTimer);
    performSemanticSearch();
  });
}

// Ensure static sidebar topic filters have immediate click handlers
function initStaticSidebarFilters() {
  document.querySelectorAll(".sidebar-topics button").forEach(btn => {
    btn.addEventListener("click", () => {
      const topic = btn.dataset.topic || btn.textContent.trim().replace(/^[^a-zA-Z0-9]+/, '');
      chooseTopic(topic);
    });
  });
}

// Initialization on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  initStaticSidebarFilters();
  fetchBlogs();
  loadInterests();
});
