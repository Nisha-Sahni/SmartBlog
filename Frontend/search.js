

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

let selectedTopic = "All";
let databaseBlogs = [];
let isLoading = false;
let loadError = "";
let searchRequestId = 0;

/* -------------------------------
   STORAGE HELPERS
-------------------------------- */

function readStorage(key, fallback = []) {
  try {
    const data = localStorage.getItem(key);
    if (data === null) return fallback;

    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.error(`Could not read ${key}:`, error);
    return fallback;
  }
}

function normalizeBlog(blog) {
  return {
    ...blog,
    id: String(blog.blog_id ?? blog.id ?? blog.blogId ?? ""),
    title: String(blog.title || "Untitled blog"),
    description: String(
      blog.excerpt || blog.description || blog.content || ""
    ),
    content: String(blog.content || ""),
    topic: String(blog.topic || blog.category || "General"),
    image: String(
      blog.image || blog.image_url || blog.imageUrl ||
      blog.coverImage || blog.thumbnail || ""
    ),
    imageAlt: String(blog.imageAlt || blog.title || "Blog image"),
    author: String(
      blog.author_name || blog.authorName || blog.author ||
      "SmartBlog writer"
    ),
    link: blog.blog_id
      ? `blog.html?id=${encodeURIComponent(blog.blog_id)}`
      : String(blog.link || blog.url || blog.href || ""),
    createdAt: blog.created_at || null,
    source: "database"
  };
}

/* -------------------------------
   SAVED STORIES
-------------------------------- */

function getSavedBlogs() {
  return readStorage(SAVED_KEY);
}

function isSaved(blog) {
  return getSavedBlogs().some(item =>
    String(item.id ?? item.blog_id ?? item.blogId ?? item.title) ===
    String(blog.id || blog.title)
  );
}

function toggleSaved(blog) {
  let saved = getSavedBlogs();

  const exists = saved.some(item =>
    String(item.id ?? item.blog_id ?? item.blogId ?? item.title) ===
    String(blog.id || blog.title)
  );

  if (exists) {
    saved = saved.filter(item =>
      String(item.id ?? item.blog_id ?? item.blogId ?? item.title) !==
      String(blog.id || blog.title)
    );
  } else {
    saved.push({
      id: blog.id,
      title: blog.title,
      description: blog.description,
      content: blog.content,
      topic: blog.topic,
      image: blog.image,
      imageAlt: blog.imageAlt,
      author: blog.author,
      link: blog.link
    });
  }

  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    renderResults();
  } catch (error) {
    console.error("Could not save story:", error);
    alert("Unable to update your reading list. Check browser storage.");
  }
}

/* -------------------------------
   BACKEND CONNECTION
-------------------------------- */

async function fetchBlogs() {
  isLoading = true;
  loadError = "";
  renderResults();

  try {
    const response = await fetch(`${API_BASE}/blogs`);

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.blogs)) {
      throw new Error("Unexpected response from the blogs endpoint.");
    }

    databaseBlogs = data.blogs.map(normalizeBlog);
  } catch (error) {
    console.error("Could not load blogs:", error);
    loadError =
      "Couldn't connect to SmartBlog. Check that the Flask backend is running.";
    databaseBlogs = [];
  } finally {
    isLoading = false;
    renderResults();
  }
}

/* -------------------------------
   SEARCH
-------------------------------- */

async function searchBlogs(query) {
  const requestId = ++searchRequestId;
  loadError = "";

  if (!query.trim()) {
    renderResults();
    return;
  }

  isLoading = true;
  renderResults();

  try {
    const url = `${API_BASE}/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();

    // Ignore an older request if the user has already searched again.
    if (requestId !== searchRequestId) return;

    if (!Array.isArray(data.results)) {
      throw new Error("Unexpected response from the search endpoint.");
    }

    databaseBlogs = data.results.map(normalizeBlog);
  } catch (error) {
    if (requestId !== searchRequestId) return;

    console.error("Search failed:", error);
    loadError = "Search failed. Check your backend connection and try again.";
    databaseBlogs = [];
  } finally {
    if (requestId === searchRequestId) {
      isLoading = false;
      renderResults();
    }
  }
}

function runSearch() {
  const query = searchInput.value.trim();

  if (query) {
    searchBlogs(query);
  } else {
    searchRequestId++;
    fetchBlogs();
  }
}

/* -------------------------------
   SEARCH FIELD FILTERS
-------------------------------- */

function matchesSelectedFields(blog, query) {
  if (!query.trim()) return true;

  const fields = [];

  if (searchTitles.checked) {
    fields.push(blog.title);
  }

  if (searchDescriptions.checked) {
    fields.push(blog.description, blog.content);
  }

  if (searchTopics.checked) {
    fields.push(blog.topic);
  }

  if (fields.length === 0) return false;

  const text = fields.join(" ").toLowerCase();
  const terms = query.toLowerCase().trim().split(/\s+/);

  // Keep a result if at least one query term occurs in the selected fields.
  return terms.some(term => text.includes(term));
}

function getVisibleBlogs() {
  const query = searchInput.value.trim();

  return databaseBlogs.filter(blog => {
    const topicMatches =
      selectedTopic === "All" ||
      blog.topic.toLowerCase() === selectedTopic.toLowerCase();

    return topicMatches && matchesSelectedFields(blog, query);
  });
}

/* -------------------------------
   DOM HELPERS
-------------------------------- */

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

function createResultCard(blog) {
  const card = createElement("article", "result-card");

  if (blog.image) {
    const imageLink = createElement("a", "result-image-link");
    imageLink.href = blog.link || "#";
    imageLink.setAttribute("aria-label", `Open ${blog.title}`);

    const image = createElement("img", "result-image");
    image.src = blog.image;
    image.alt = blog.imageAlt;
    image.loading = "lazy";

    image.addEventListener("error", () => {
      imageLink.replaceChildren(
        createElement("div", "image-placeholder", "S.")
      );
    });

    imageLink.appendChild(image);
    card.appendChild(imageLink);
  } else {
    card.appendChild(createElement("div", "image-placeholder", "S."));
  }

  const content = createElement("div", "result-content");

  content.appendChild(createElement("span", "result-topic", blog.topic));

  const title = createElement("h3", "result-title");
  const titleLink = createElement("a", "", blog.title);
  titleLink.href = blog.link || "#";
  title.appendChild(titleLink);
  content.appendChild(title);

  if (blog.description) {
    content.appendChild(
      createElement("p", "result-description", blog.description)
    );
  }

  const footer = createElement("div", "result-footer");

  footer.appendChild(createElement("span", "result-author", blog.author));

  const saved = isSaved(blog);
  const saveButton = createElement(
    "button",
    `save-button${saved ? " saved" : ""}`,
    saved ? "♥ Saved" : "♡ Save"
  );

  saveButton.type = "button";
  saveButton.setAttribute("aria-pressed", String(saved));
  saveButton.addEventListener("click", () => toggleSaved(blog));

  footer.appendChild(saveButton);
  content.appendChild(footer);

  const readLink = createElement("a", "read-link", "Read story ↗");
  readLink.href = blog.link || "#";
  content.appendChild(readLink);

  card.appendChild(content);
  return card;
}

/* -------------------------------
   RENDER RESULTS
-------------------------------- */

function renderResults() {
  if (!resultsGrid || !resultCount || !resultsHeading || !emptyState) {
    return;
  }

  const query = searchInput.value.trim();
  const results = getVisibleBlogs();

  if (query) {
    resultsHeading.textContent = "Search results";
  } else {
    resultsHeading.textContent =
      selectedTopic === "All" ? "Explore all stories" : selectedTopic;
  }

  resultsGrid.replaceChildren();

  if (isLoading) {
    resultsHeading.textContent = query ? "Searching..." : "Loading stories...";
    resultCount.textContent = "Please wait";
    emptyState.hidden = true;
    resultsGrid.hidden = true;
    showStatus("");
    return;
  }

  if (loadError) {
    resultCount.textContent = "Unable to load stories";
    emptyState.hidden = false;
    resultsGrid.hidden = true;
    showStatus(loadError);
    return;
  }

  showStatus("");

  results.forEach(blog => {
    resultsGrid.appendChild(createResultCard(blog));
  });

  resultCount.textContent =
    `${results.length} ${results.length === 1 ? "story" : "stories"}`;

  emptyState.hidden = results.length !== 0;
  resultsGrid.hidden = results.length === 0;

  if (results.length === 0) {
    const message = emptyState.querySelector("p");

    if (message) {
      message.textContent = query
        ? "No matching blogs found. Try different keywords."
        : "No blogs are available yet. Check back soon.";
    }
  }
}

function showStatus(message) {
  let status = document.getElementById("searchStatus");

  if (!status) {
    status = createElement("p", "search-status");
    status.id = "searchStatus";
    status.setAttribute("role", "status");

    if (resultsGrid && resultsGrid.parentNode) {
      resultsGrid.parentNode.insertBefore(status, resultsGrid);
    }
  }

  status.textContent = message;
  status.hidden = !message;
}

/* -------------------------------
   RESET
-------------------------------- */

function clearSearch() {
  searchRequestId++;
  searchInput.value = "";
  selectedTopic = "All";

  filters.forEach(filter => {
    filter.classList.toggle("active", filter.dataset.topic === "All");
  });

  runSearch();
  searchInput.focus();
}

/* -------------------------------
   EVENT LISTENERS
-------------------------------- */

searchButton.addEventListener("click", runSearch);

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") runSearch();
});

searchInput.addEventListener("input", () => {
  // The backend search runs when the user presses Enter or clicks Search.
  // An empty input reloads all blogs.
  if (!searchInput.value.trim()) {
    searchRequestId++;
    fetchBlogs();
  }
});

[searchTitles, searchDescriptions, searchTopics].forEach(input => {
  input.addEventListener("change", renderResults);
});

filters.forEach(filter => {
  filter.addEventListener("click", () => {
    selectedTopic = filter.dataset.topic || "All";

    filters.forEach(item => {
      item.classList.toggle("active", item === filter);
    });

    renderResults();
  });
});

resetSearch.addEventListener("click", clearSearch);

window.addEventListener("storage", event => {
  if (event.key === SAVED_KEY) renderResults();
});

/* -------------------------------
   INITIAL LOAD
-------------------------------- */

fetchBlogs();
