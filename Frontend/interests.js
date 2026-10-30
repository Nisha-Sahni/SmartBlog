
const API_BASE = "http://127.0.0.1:5000";

const topics = [
    { name: "Technology", icon: "💻" },
    { name: "Programming", icon: "👨‍💻" },
    { name: "Artificial Intelligence", icon: "🤖" },
    { name: "Data Science", icon: "📊" },
    { name: "Science", icon: "🔬" },
    { name: "Education", icon: "📚" },
    { name: "Business", icon: "💼" },
    { name: "Personal Development", icon: "🌱" },
    { name: "Health & Fitness", icon: "🏃" },
    { name: "Travel", icon: "✈️" },
    { name: "Books & Literature", icon: "📖" },
    { name: "Lifestyle", icon: "✨" },
    { name: "Design", icon: "🎨" },
    { name: "Cybersecurity", icon: "🔐" },
    { name: "Environment", icon: "🌍" },
    { name: "Finance", icon: "💰" }
];

const selectedTopics = new Set();
const customTopics = new Set();

const topicsGrid = document.getElementById("topicsGrid");
const selectionCount = document.getElementById("selectionCount");
const selectAllBtn = document.getElementById("selectAllBtn");
const customTopicForm = document.getElementById("customTopicForm");
const customTopicInput = document.getElementById("customTopicInput");
const customTopicsContainer = document.getElementById("customTopics");
const saveButton = document.getElementById("saveInterestsBtn");
const clearButton = document.getElementById("clearBtn");
const statusMessage = document.getElementById("statusMessage");

// Get the logged-in user saved by the login system.
function getCurrentUser() {
    try {
        const savedUser = localStorage.getItem("user");

        if (!savedUser) {
            return null;
        }

        return JSON.parse(savedUser);
    } catch (error) {
        console.error("Could not read logged-in user:", error);
        return null;
    }
}

function getUserId() {
    const user = getCurrentUser();

    if (!user) {
        return null;
    }

    return user.user_id ?? user.id ?? null;
}

function showStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = type;
}

// Render the predefined topics.
function renderTopics() {
    topicsGrid.replaceChildren();

    topics.forEach(topic => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "topic-card";

        const isSelected = selectedTopics.has(topic.name);

        card.classList.toggle("selected", isSelected);
        card.setAttribute("aria-pressed", String(isSelected));

        const icon = document.createElement("span");
        icon.className = "topic-icon";
        icon.textContent = topic.icon;

        const name = document.createElement("span");
        name.className = "topic-name";
        name.textContent = topic.name;

        card.append(icon, name);

        if (isSelected) {
            const check = document.createElement("span");
            check.className = "topic-check";
            check.textContent = "✓";
            card.appendChild(check);
        }

        card.addEventListener("click", () => {
            if (selectedTopics.has(topic.name)) {
                selectedTopics.delete(topic.name);
            } else {
                selectedTopics.add(topic.name);
            }

            updatePage();
        });

        topicsGrid.appendChild(card);
    });
}

// Render custom topics with remove buttons.
function renderCustomTopics() {
    customTopicsContainer.replaceChildren();

    customTopics.forEach(topic => {
        const chip = document.createElement("span");
        chip.className = "custom-topic-chip";

        const name = document.createElement("span");
        name.textContent = topic;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-topic";
        removeButton.textContent = "×";
        removeButton.setAttribute("aria-label", `Remove ${topic}`);

        removeButton.addEventListener("click", () => {
            customTopics.delete(topic);
            selectedTopics.delete(topic);
            updatePage();
        });

        chip.append(name, removeButton);
        customTopicsContainer.appendChild(chip);
    });
}

function updatePage() {
    renderTopics();
    renderCustomTopics();

    const count = selectedTopics.size;

    selectionCount.textContent =
        `${count} topic${count === 1 ? "" : "s"} selected`;

    const allSelected = topics.every(topic =>
        selectedTopics.has(topic.name)
    );

    selectAllBtn.textContent = allSelected
        ? "Deselect all"
        : "Select all";
}

// Select or deselect all predefined topics.
selectAllBtn.addEventListener("click", () => {
    const allSelected = topics.every(topic =>
        selectedTopics.has(topic.name)
    );

    if (allSelected) {
        topics.forEach(topic => selectedTopics.delete(topic.name));
    } else {
        topics.forEach(topic => selectedTopics.add(topic.name));
    }

    updatePage();
});

// Add a custom topic.
customTopicForm.addEventListener("submit", event => {
    event.preventDefault();

    const topic = customTopicInput.value.trim();

    if (!topic) {
        showStatus("Please enter a topic.", "error");
        return;
    }

    if (topic.length > 100) {
        showStatus("Topics must be 100 characters or fewer.", "error");
        return;
    }

    const existingTopic = [
        ...topics.map(item => item.name),
        ...customTopics
    ].find(name => name.toLowerCase() === topic.toLowerCase());

    if (existingTopic) {
        showStatus("This topic already exists.", "error");
        return;
    }

    customTopics.add(topic);
    selectedTopics.add(topic);

    customTopicInput.value = "";
    updatePage();
    showStatus(`"${topic}" added to your interests.`, "success");
});

// Clear all selected topics and custom topic chips.
clearButton.addEventListener("click", () => {
    selectedTopics.clear();
    customTopics.clear();

    updatePage();
    showStatus("Selection cleared. Save to update your preferences.", "success");
});

// Load the user's interests from Flask/MySQL.
async function loadInterests() {
    const userId = getUserId();

    if (!userId) {
        showStatus(
            "Please log in first to manage your interests.",
            "error"
        );
        saveButton.disabled = true;
        return;
    }

    try {
        showStatus("Loading your saved interests...");

        const response = await fetch(
            `${API_BASE}/interests/${encodeURIComponent(userId)}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load interests.");
        }

        selectedTopics.clear();
        customTopics.clear();

        const predefinedNames = new Set(
            topics.map(topic => topic.name.toLowerCase())
        );

        (data.interests || []).forEach(interest => {
            selectedTopics.add(interest);

            if (!predefinedNames.has(interest.toLowerCase())) {
                customTopics.add(interest);
            }
        });

        updatePage();

        showStatus(
            selectedTopics.size
                ? "Your saved interests have been loaded."
                : "Choose the topics you'd like to read about."
        );
    } catch (error) {
        console.error("Error loading interests:", error);

        showStatus(
            "Could not load interests. Check that Flask is running and try refreshing.",
            "error"
        );
    }
}

// Save selected interests to Flask/MySQL.
saveButton.addEventListener("click", async () => {
    const userId = getUserId();

    if (!userId) {
        showStatus("Please log in first.", "error");
        return;
    }

    const interests = [...selectedTopics];

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        const response = await fetch(
            `${API_BASE}/interests/${encodeURIComponent(userId)}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ interests })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not save interests.");
        }

        showStatus(
            `Successfully saved ${data.interests.length} interest(s)!`,
            "success"
        );
    } catch (error) {
        console.error("Error saving interests:", error);

        showStatus(
            "Could not save interests. Check that Flask is running and try again.",
            "error"
        );
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save my interests";
    }
});

// Initial page setup.
updatePage();
loadInterests();

