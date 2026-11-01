
const STORAGE_KEY = "smartblog_questions_v1";
const API_BASE = "http://127.0.0.1:5000";

const demoQuestions = [
  {
    id: 1,
    title: "How should a beginner start learning web development?",
    details: "I know a little HTML but I am confused about what to learn next.",
    topic: "Programming",
    author: "Aarav",
    answers: [
      {
        author: "Riya",
        text: "Learn HTML first, then CSS, JavaScript, and finally a framework like React. Build small projects as you learn."
      }
    ],
    createdAt: "2026-10-20"
  },
  {
    id: 2,
    title: "How can I improve my technical writing?",
    details: "I want to explain technical concepts clearly in my blog posts.",
    topic: "Writing",
    author: "Meera",
    answers: [
      {
        author: "Kabir",
        text: "Start with the problem, explain the idea in simple language, and use examples. Edit your draft to remove unnecessary words."
      }
    ],
    createdAt: "2026-10-21"
  },
  {
    id: 3,
    title: "What projects should college students build for their resume?",
    details: "I am looking for practical project ideas that demonstrate real skills.",
    topic: "Career",
    author: "Ishaan",
    answers: [],
    createdAt: "2026-10-22"
  },
  {
    id: 4,
    title: "How do I manage college work and coding practice?",
    details: "I want to stay consistent with learning without falling behind in classes.",
    topic: "College",
    author: "Ananya",
    answers: [],
    createdAt: "2026-10-23"
  }
];

// =====================================
// ELEMENTS
// =====================================

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const topicFilter = document.getElementById("topicFilter");

const questionsList = document.getElementById("questionsList");
const questionCount = document.getElementById("questionCount");
const emptyMessage = document.getElementById("emptyMessage");

const askQuestionBtn = document.getElementById("askQuestionBtn");

// FIXED: Matches the ID in questions.html
const askQuestionPanel = document.getElementById("questionFormSection");

const questionForm = document.getElementById("questionForm");
const cancelQuestionBtn = document.getElementById("cancelQuestionBtn");

const sidebarTopics = document.getElementById("sidebarTopics");

let questions = loadQuestions();
let activeTopic = "All";

// =====================================
// LOAD AND SAVE QUESTIONS
// =====================================

function loadQuestions() {
  try {
    const storedQuestions = localStorage.getItem(STORAGE_KEY);

    if (storedQuestions) {
      const parsedQuestions = JSON.parse(storedQuestions);

      if (Array.isArray(parsedQuestions)) {
        return parsedQuestions;
      }
    }
  } catch (error) {
    console.error("Could not load questions:", error);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoQuestions));

  return [...demoQuestions];
}

function saveQuestions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
}

// =====================================
// CURRENT USER
// =====================================

function getCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    return user?.name?.trim() || "You";
  } catch (error) {
    console.error("Could not read user:", error);
    return "You";
  }
}

function updateProfile() {
  const user = getCurrentUser();
  const initial = user.charAt(0).toUpperCase();

  document.querySelectorAll(".small-avatar").forEach(avatar => {
    avatar.textContent = initial;
  });
}

// =====================================
// FORMAT DATE
// =====================================

function formatDate(dateValue) {
  if (!dateValue) return "Recently";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "Recently";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

// =====================================
// ESCAPE HTML
// =====================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

// =====================================
// RENDER QUESTIONS
// =====================================

function renderQuestions() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedTopic = topicFilter.value;

  const filteredQuestions = questions.filter(question => {
    const searchableContent = [
      question.title,
      question.details,
      question.topic,
      question.author
    ].join(" ").toLowerCase();

    const matchesSearch = searchableContent.includes(query);

    const matchesTopic =
      selectedTopic === "All" ||
      question.topic.toLowerCase() === selectedTopic.toLowerCase();

    const matchesSidebar =
      activeTopic === "All" ||
      question.topic.toLowerCase() === activeTopic.toLowerCase();

    return matchesSearch && matchesTopic && matchesSidebar;
  });

  questionCount.textContent =
    `${filteredQuestions.length} ${filteredQuestions.length === 1 ? "question" : "questions"}`;

  questionsList.innerHTML = "";

  filteredQuestions.forEach(question => {
    questionsList.appendChild(createQuestionCard(question));
  });

  emptyMessage.hidden = filteredQuestions.length !== 0;
}

// =====================================
// CREATE QUESTION CARD
// =====================================

function createQuestionCard(question) {
  const card = document.createElement("article");
  card.className = "question-card";

  const answers = Array.isArray(question.answers)
    ? question.answers
    : [];

  card.innerHTML = `
    <div class="question-card-top">
      <span class="question-topic">${escapeHTML(question.topic)}</span>
      <span class="question-date">${formatDate(question.createdAt)}</span>
    </div>

    <h3>${escapeHTML(question.title)}</h3>

    <p class="question-details">${escapeHTML(question.details)}</p>

    <div class="question-meta">
      <span>Asked by <strong>${escapeHTML(question.author)}</strong></span>
      <span class="meta-spacer"></span>
      <span>${answers.length} ${answers.length === 1 ? "answer" : "answers"}</span>

      <button type="button" class="answer-toggle">
        View answers ↓
      </button>
    </div>

    <div class="answers-panel" hidden>
      <h4 class="answers-heading">Community answers</h4>

      <div class="answers-list"></div>

      <form class="answer-form">
        <textarea
          name="answer"
          placeholder="Share your answer..."
          maxlength="1500"
          required
          aria-label="Write your answer"
        ></textarea>

        <button type="submit">Post answer ↗</button>
      </form>
    </div>
  `;

  const answersPanel = card.querySelector(".answers-panel");
  const answersList = card.querySelector(".answers-list");
  const answerToggle = card.querySelector(".answer-toggle");
  const answerForm = card.querySelector(".answer-form");

  renderAnswers(answersList, answers);

  // Show or hide answers
  answerToggle.addEventListener("click", () => {
    const isHidden = answersPanel.hidden;

    answersPanel.hidden = !isHidden;

    answerToggle.textContent = isHidden
      ? "Hide answers ↑"
      : "View answers ↓";
  });

  // Post answer
  answerForm.addEventListener("submit", event => {
    event.preventDefault();

    const textarea = answerForm.querySelector("textarea");
    const answerText = textarea.value.trim();

    if (!answerText) return;

    const questionToUpdate = questions.find(
      item => String(item.id) === String(question.id)
    );

    if (!questionToUpdate) return;

    if (!Array.isArray(questionToUpdate.answers)) {
      questionToUpdate.answers = [];
    }

    questionToUpdate.answers.push({
      author: getCurrentUser(),
      text: answerText
    });

    saveQuestions();
    renderQuestions();
  });

  return card;
}

// =====================================
// RENDER ANSWERS
// =====================================

function renderAnswers(container, answers) {
  container.innerHTML = "";

  if (!answers.length) {
    const message = document.createElement("p");

    message.className = "no-answers";
    message.textContent =
      "No answers yet. Be the first to share your thoughts!";

    container.appendChild(message);
    return;
  }

  answers.forEach(answer => {
    const answerItem = document.createElement("div");
    answerItem.className = "answer-item";

    const author = document.createElement("span");
    author.className = "answer-author";
    author.textContent = answer.author || "Community member";

    const text = document.createElement("p");
    text.textContent = answer.text || "";

    answerItem.appendChild(author);
    answerItem.appendChild(text);

    container.appendChild(answerItem);
  });
}

// =====================================
// ASK QUESTION PANEL
// =====================================

askQuestionBtn.addEventListener("click", () => {
  askQuestionPanel.hidden = false;

  askQuestionPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  document.getElementById("questionTitle").focus();
});

cancelQuestionBtn.addEventListener("click", () => {
  questionForm.reset();
  askQuestionPanel.hidden = true;
});

// =====================================
// SUBMIT QUESTION
// =====================================

questionForm.addEventListener("submit", event => {
  event.preventDefault();

  const title = document.getElementById("questionTitle").value.trim();
  const details = document.getElementById("questionDetails").value.trim();
  const topic = document.getElementById("questionTopic").value;

  if (!title || !details || !topic) {
    return;
  }

  const newQuestion = {
    id: Date.now(),
    title,
    details,
    topic,
    author: getCurrentUser(),
    answers: [],
    createdAt: new Date().toISOString()
  };

  questions.unshift(newQuestion);

  saveQuestions();

  questionForm.reset();
  askQuestionPanel.hidden = true;

  // Reset filters to make the new question visible
  searchInput.value = "";
  topicFilter.value = "All";
  activeTopic = "All";

  sidebarTopics.querySelectorAll("button").forEach(button => {
    button.classList.toggle(
      "topic-active",
      button.dataset.topic === "All"
    );
  });

  renderQuestions();

  questionsList.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

// =====================================
// SEARCH
// =====================================

searchInput.addEventListener("input", renderQuestions);
searchBtn.addEventListener("click", renderQuestions);

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    renderQuestions();
  }
});

// =====================================
// TOPIC FILTER
// =====================================

topicFilter.addEventListener("change", renderQuestions);

function chooseTopic(topic) {
  activeTopic = topic;

  sidebarTopics.querySelectorAll("button").forEach(button => {
    button.classList.toggle(
      "topic-active",
      button.dataset.topic === topic
    );
  });

  const matchingOption = [...topicFilter.options].find(
    option => option.value.toLowerCase() === topic.toLowerCase()
  );

  topicFilter.value = matchingOption ? matchingOption.value : "All";

  renderQuestions();
}

// =====================================
// SIDEBAR INTERESTS
// =====================================

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
  sidebarTopics.innerHTML = "";

  const uniqueInterests = [
    ...new Set(
      interests.filter(
        topic => typeof topic === "string" && topic.trim()
      )
    )
  ];

  sidebarTopics.appendChild(createTopicButton("All"));

  uniqueInterests.forEach(topic => {
    sidebarTopics.appendChild(createTopicButton(topic));
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

    if (Array.isArray(data.interests)) {
      renderInterests(data.interests);
    }

  } catch (error) {
    console.error("Error loading interests:", error);
  }
}

// =====================================
// INITIALIZE
// =====================================

updateProfile();
renderQuestions();
loadInterests();

