
const API_BASE = "http://127.0.0.1:5000";

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const filters = document.querySelectorAll(".filter");
const cards = document.querySelectorAll(".story-card");
const emptyState = document.getElementById("emptyState");
const storyCount = document.getElementById("storyCount");
const sidebarContainer = document.querySelector(".sidebar-topics");

const SAVED_KEY = "smartblog_saved_blogs_v1";

let selectedTopic = "All";
let userInterests = [];

function getSavedBlogs() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function getBlogFromCard(card, index) {
  const imageElement = card.querySelector(".story-image img");
  const titleElement = card.querySelector("h3");
  const descriptionElement = card.querySelector(".story-content p");
  const categoryElement = card.querySelector(".category");
  const metaElement = card.querySelector(".meta");

  const title = titleElement?.textContent.trim() || "Untitled blog";

  return {
    id: card.dataset.id || `explore-story-${index}`,
    title,
    description: descriptionElement?.textContent.trim() || "",
    topic: card.dataset.topic || "General",
    image: imageElement?.getAttribute("src") || "",
    imageAlt: imageElement?.getAttribute("alt") || title,
    category: categoryElement?.textContent.trim() || "",
    meta: metaElement?.textContent.trim() || "",
    author: card.querySelector(".story-footer > span")?.textContent.trim() || "",
    link: card.dataset.link || ""
  };
}

function updateSaveButtons() {
  const savedBlogs = getSavedBlogs();

  cards.forEach((card, index) => {
    const button = card.querySelector(".save-button");
    if (!button) return;

    const blog = getBlogFromCard(card, index);

    const isSaved = savedBlogs.some(
      saved => String(saved.id ?? saved.title) === String(blog.id)
    );

    button.classList.toggle("saved", isSaved);
    button.textContent = isSaved ? "♥ Saved" : "♡ Save";
    button.setAttribute("aria-pressed", String(isSaved));
  });
}

function toggleSavedBlog(card, index) {
  const blog = getBlogFromCard(card, index);
  let savedBlogs = getSavedBlogs();

  const alreadySaved = savedBlogs.some(
    saved => String(saved.id ?? saved.title) === String(blog.id)
  );

  if (alreadySaved) {
    savedBlogs = savedBlogs.filter(
      saved => String(saved.id ?? saved.title) !== String(blog.id)
    );
  } else {
    savedBlogs.push(blog);
  }

  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedBlogs));
    updateSaveButtons();
  } catch (error) {
    alert("The blog could not be saved. Please check your browser storage.");
  }
}

function updateStories() {
  const query = searchInput.value.trim().toLowerCase();
  let visibleCount = 0;

  cards.forEach(card => {
    const topic = card.dataset.topic || "";

    const text = (
      card.innerText + " " + (card.dataset.search || "")
    ).toLowerCase();

    const topicMatches =
      selectedTopic === "All" ||
      topic.toLowerCase() === selectedTopic.toLowerCase();

    const searchMatches = text.includes(query);
    const visible = topicMatches && searchMatches;

    card.hidden = !visible;

    if (visible) visibleCount++;
  });

  emptyState.hidden = visibleCount !== 0;

  storyCount.textContent =
    `${visibleCount} ${visibleCount === 1 ? "story" : "stories"}`;
}

function chooseTopic(topic) {
  selectedTopic = topic;

  document.querySelectorAll(".filter").forEach(filter => {
    filter.classList.toggle(
      "active",
      filter.dataset.topic === topic
    );
  });

  document.querySelectorAll(".sidebar-topics button").forEach(button => {
    button.classList.toggle(
      "topic-active",
      button.dataset.topic === topic
    );
  });

  updateStories();
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
    Learning: "blue-dot"
  };

  const dot = document.createElement("i");
  dot.className = dotClasses[topic] || "lime-dot";

  const label = topic === "All" ? "For you" : topic;

  button.appendChild(dot);
  button.appendChild(document.createTextNode(label));

  button.addEventListener("click", () => chooseTopic(topic));

  return button;
}

function renderInterests(interests) {
  sidebarContainer.innerHTML = "";

  sidebarContainer.appendChild(createTopicButton("All"));

  interests.forEach(topic => {
    sidebarContainer.appendChild(createTopicButton(topic));
  });

  chooseTopic("All");
}

async function loadInterests() {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    const userId = storedUser?.user_id ?? storedUser?.id;

    if (!userId) {
      console.warn("User ID not found in localStorage.");
      return;
    }

    const response = await fetch(
      `${API_BASE}/interests/${encodeURIComponent(userId)}`
    );

    if (!response.ok) {
      throw new Error("Could not fetch interests.");
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Could not load interests.");
    }

    userInterests = Array.isArray(data.interests)
      ? data.interests
      : [];

    renderInterests(userInterests);

  } catch (error) {
    console.error("Error loading interests:", error);
  }
}

// SEARCH
searchInput.addEventListener("input", updateStories);
searchButton.addEventListener("click", updateStories);

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") updateStories();
});

// TOPIC FILTERS
filters.forEach(filter => {
  filter.addEventListener("click", () => {
    chooseTopic(filter.dataset.topic);
  });
});

// SAVE BLOGS
cards.forEach((card, index) => {
  const button = card.querySelector(".save-button");

  if (button) {
    button.addEventListener("click", () => {
      toggleSavedBlog(card, index);
    });
  }
});

// PROFILE DROPDOWN
const profileButton = document.getElementById("profileButton");
const profileDropdown = document.getElementById("profileDropdown");

profileButton.addEventListener("click", () => {
  const isOpen = !profileDropdown.hidden;
  profileDropdown.hidden = isOpen;
  profileButton.setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", event => {
  if (
    !event.target.closest(".profile-menu") &&
    !profileDropdown.hidden
  ) {
    profileDropdown.hidden = true;
    profileButton.setAttribute("aria-expanded", "false");
  }
});

// LOG OUT
const logoutBtn = document.getElementById("logoutButton");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (window.SmartBlogAuth) {
      window.SmartBlogAuth.logout(true);
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "login.html";
    }
  });
}

// USER PROFILE INITIAL
try {
  const storedUser = JSON.parse(localStorage.getItem("user"));

  if (storedUser?.name) {
    const initial = storedUser.name.trim().charAt(0).toUpperCase();

    document.querySelectorAll(".small-avatar").forEach(avatar => {
      avatar.textContent = initial;
    });
  }
} catch (error) {
  console.error("Could not load user details:", error);
}

// INITIALIZE
updateStories();
updateSaveButtons();
loadInterests();
