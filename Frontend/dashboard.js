

const API_BASE = "http://127.0.0.1:5000";

const searchInput = document.getElementById("searchInput");
const sidebarContainer = document.querySelector(".sidebar-topics");
const stories = document.querySelectorAll(".story-card");
const emptyState = document.getElementById("emptyState");

let activeTopic = "All";
let userInterests = [];

function filterStories() {
  const query = searchInput.value.toLowerCase().trim();
  let visible = 0;

  stories.forEach(story => {
    const topic = story.dataset.topic || "";

    const content = (
      story.innerText + " " + (story.dataset.search || "")
    ).toLowerCase();

    const matchesTopic =
      activeTopic === "All" ||
      topic.toLowerCase() === activeTopic.toLowerCase();

    const matchesQuery = content.includes(query);
    const show = matchesTopic && matchesQuery;

    story.hidden = !show;

    if (show) visible++;
  });

  emptyState.hidden = visible > 0;
}

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
    Learning: "blue-dot"
  };

  dot.className = dotClasses[topic] || "lime-dot";

  const label = topic === "All" ? "For you" : topic;

  button.appendChild(dot);
  button.appendChild(document.createTextNode(label));

  button.addEventListener("click", () => chooseTopic(topic));

  return button;
}

function renderInterests(interests) {
  sidebarContainer.innerHTML = "";

  // Always show For you first.
  sidebarContainer.appendChild(createTopicButton("All"));

  // Add the user's saved interests.
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
searchInput.addEventListener("input", filterStories);

document.getElementById("searchBtn").addEventListener("click", filterStories);

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    filterStories();
  }
});

// VISUAL SAVE TOGGLE FOR SAMPLE CARDS
document.querySelectorAll(".save-button").forEach(button => {
  button.addEventListener("click", () => {
    const saved = button.classList.toggle("saved");

    button.textContent = saved ? "♥ Saved" : "♡ Save";
  });
});

// HYDRATE USER SESSION
try {
  const storedUser = JSON.parse(localStorage.getItem("user"));

  if (storedUser) {
    if (storedUser.name) {
      const initial = storedUser.name.trim().charAt(0).toUpperCase();

      document.querySelectorAll(".small-avatar").forEach(el => {
        el.textContent = initial;
      });

      const welcomeHeading = document.querySelector(
        ".dashboard-welcome h1"
      );

      if (welcomeHeading) {
        welcomeHeading.innerHTML =
          `Welcome back,<br><em>${storedUser.name}.</em>`;
      }
    }
  }
} catch (error) {
  console.error("Could not load user details:", error);
}

// LOAD SAVED INTERESTS FROM MYSQL
loadInterests();
