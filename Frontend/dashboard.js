
const searchInput = document.getElementById("searchInput");
const chips = document.querySelectorAll(".chip");
const sidebarTopics = document.querySelectorAll(".sidebar-topics button");
const stories = document.querySelectorAll(".story-card");
const emptyState = document.getElementById("emptyState");

let activeTopic = "All";

function filterStories() {
  const query = searchInput.value.toLowerCase().trim();
  let visible = 0;

  stories.forEach(story => {
    const topic = story.dataset.topic;
    const content = (
      story.innerText + " " + (story.dataset.search || "")
    ).toLowerCase();

    const matchesTopic =
      activeTopic === "All" || topic === activeTopic;

    const matchesQuery = content.includes(query);
    const show = matchesTopic && matchesQuery;

    story.hidden = !show;
    if (show) visible++;
  });

  emptyState.hidden = visible > 0;
}

function chooseTopic(topic) {
  activeTopic = topic;

  chips.forEach(chip => {
    chip.classList.toggle("selected", chip.dataset.topic === topic);
  });

  sidebarTopics.forEach(button => {
    button.classList.toggle("topic-active", button.dataset.topic === topic);
  });

  filterStories();
}

chips.forEach(chip => {
  chip.addEventListener("click", () => {
    chooseTopic(chip.dataset.topic);
  });
});

sidebarTopics.forEach(button => {
  button.addEventListener("click", () => {
    chooseTopic(button.dataset.topic);
  });
});

searchInput.addEventListener("input", filterStories);
document.getElementById("searchBtn").addEventListener("click", filterStories);

document.getElementById("clearFilters").addEventListener("click", () => {
  searchInput.value = "";
  chooseTopic("All");
});

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") filterStories();
});

// Visual save toggle for sample cards.
document.querySelectorAll(".save-button").forEach(button => {
  button.addEventListener("click", () => {
    const saved = button.classList.toggle("saved");
    button.textContent = saved ? "♥ Saved" : "♡ Save";
  });
});

