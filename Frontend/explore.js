
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const filters = document.querySelectorAll(".filter");
const cards = document.querySelectorAll(".story-card");
const emptyState = document.getElementById("emptyState");
const storyCount = document.getElementById("storyCount");

let selectedTopic = "All";

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

document.querySelectorAll(".save-button").forEach(button => {
  button.addEventListener("click", () => {
    const saved = button.classList.toggle("saved");
    button.textContent = saved ? "♥ Saved" : "♡ Save";
  });
});
