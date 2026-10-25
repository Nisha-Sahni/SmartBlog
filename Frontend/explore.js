
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const filters = document.querySelectorAll(".filter");
const cards = document.querySelectorAll(".story-card");
const emptyState = document.getElementById("emptyState");
const storyCount = document.getElementById("storyCount");

const SAVED_KEY = "smartblog_saved_blogs_v1";

let selectedTopic = "All";

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
    const topic = card.dataset.topic;
    const text = (
      card.innerText + " " + (card.dataset.search || "")
    ).toLowerCase();

    const topicMatches =
      selectedTopic === "All" || topic === selectedTopic;

    const searchMatches = text.includes(query);
    const visible = topicMatches && searchMatches;

    card.hidden = !visible;

    if (visible) visibleCount++;
  });

  emptyState.hidden = visibleCount !== 0;

  storyCount.textContent =
    `${visibleCount} ${visibleCount === 1 ? "story" : "stories"}`;
}

filters.forEach(filter => {
  filter.addEventListener("click", () => {
    selectedTopic = filter.dataset.topic;

    filters.forEach(item => {
      item.classList.toggle("active", item === filter);
    });

    updateStories();
  });
});

searchInput.addEventListener("input", updateStories);
searchButton.addEventListener("click", updateStories);

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") updateStories();
});

cards.forEach((card, index) => {
  const button = card.querySelector(".save-button");

  if (button) {
    button.addEventListener("click", () => {
      toggleSavedBlog(card, index);
    });
  }
});

updateStories();
updateSaveButtons();



