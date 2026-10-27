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
        ]
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
        ]
    },
    {
        id: 3,
        title: "What projects should college students build for their resume?",
        details: "I am looking for practical project ideas that demonstrate real skills.",
        topic: "Career",
        author: "Ishaan",
        answers: []
    },
    {
        id: 4,
        title: "How do I manage college work and coding practice?",
        details: "I want to stay consistent with learning without falling behind in classes.",
        topic: "College",
        author: "Ananya",
        answers: []
    }
];

const STORAGE_KEY = "smartblog_questions_v1";

const questionsList = document.getElementById("questionsList");
const questionCount = document.getElementById("questionCount");
const emptyMessage = document.getElementById("emptyMessage");
const searchInput = document.getElementById("searchInput");
const topicFilter = document.getElementById("topicFilter");
const questionFormSection = document.getElementById("questionFormSection");
const questionForm = document.getElementById("questionForm");

let questions = loadQuestions();

function loadQuestions() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved !== null) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (error) {
        console.error("Could not load saved questions:", error);
    }

    return demoQuestions.map(question => ({
        ...question,
        answers: [...question.answers]
    }));
}

function saveQuestions() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
    } catch (error) {
        alert("Could not save your changes in this browser.");
    }
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
}

function renderQuestions() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedTopic = topicFilter.value;

    const filteredQuestions = questions.filter(question => {
        const matchesSearch =
            question.title.toLowerCase().includes(searchTerm) ||
            question.details.toLowerCase().includes(searchTerm) ||
            question.topic.toLowerCase().includes(searchTerm);

        const matchesTopic =
            selectedTopic === "All" || question.topic === selectedTopic;

        return matchesSearch && matchesTopic;
    });

    questionsList.replaceChildren();

    questionCount.textContent =
        `${filteredQuestions.length} question${filteredQuestions.length === 1 ? "" : "s"}`;

    emptyMessage.classList.toggle("hidden", filteredQuestions.length !== 0);

    filteredQuestions.forEach(question => {
        const card = makeElement("article", "question-card");
        const title = makeElement("h3", "", question.title);
        const details = makeElement("p", "details", question.details);

        const meta = makeElement("div", "question-meta");
        meta.append(
            makeElement("span", "topic-tag", question.topic),
            makeElement("span", "", `Asked by ${question.author}`),
            makeElement(
                "span",
                "",
                `${question.answers.length} answer${question.answers.length === 1 ? "" : "s"}`
            )
        );

        const toggleButton = makeElement(
            "button",
            "answer-toggle",
            question.answers.length ? "View answers / Reply" : "Be the first to answer"
        );
        toggleButton.type = "button";

        const answersArea = makeElement("div", "answers-area hidden");

        toggleButton.addEventListener("click", () => {
            answersArea.classList.toggle("hidden");
        });

        question.answers.forEach(answer => {
            const answerItem = makeElement("div", "answer-item");
            answerItem.append(
                makeElement("strong", "", `${answer.author}:`),
                document.createTextNode(` ${answer.text}`)
            );
            answersArea.appendChild(answerItem);
        });

        const answerForm = makeElement("form", "answer-form");
        const answerInput = makeElement("textarea");
        answerInput.rows = 2;
        answerInput.placeholder = "Write an answer...";
        answerInput.setAttribute("aria-label", "Write an answer");
        answerInput.required = true;

        const answerButton = makeElement("button", "primary-btn", "Submit");
        answerButton.type = "submit";

        answerForm.append(answerInput, answerButton);

        answerForm.addEventListener("submit", event => {
            event.preventDefault();

            const text = answerInput.value.trim();
            if (!text) return;

            question.answers.push({
                author: "You",
                text
            });

            saveQuestions();
            renderQuestions();
        });

        answersArea.appendChild(answerForm);
        card.append(title, details, meta, toggleButton, answersArea);
        questionsList.appendChild(card);
    });
}

document.getElementById("askQuestionBtn").addEventListener("click", () => {
    questionFormSection.classList.toggle("hidden");

    if (!questionFormSection.classList.contains("hidden")) {
        document.getElementById("questionTitle").focus();
    }
});

document.getElementById("cancelQuestionBtn").addEventListener("click", () => {
    questionForm.reset();
    questionFormSection.classList.add("hidden");
});

questionForm.addEventListener("submit", event => {
    event.preventDefault();

    const title = document.getElementById("questionTitle").value.trim();
    const details = document.getElementById("questionDetails").value.trim();
    const topic = document.getElementById("questionTopic").value;

    if (!title) return;

    questions.unshift({
        id: Date.now(),
        title,
        details,
        topic,
        author: "You",
        answers: []
    });

    saveQuestions();
    questionForm.reset();
    questionFormSection.classList.add("hidden");

    searchInput.value = "";
    topicFilter.value = "All";

    renderQuestions();
});

searchInput.addEventListener("input", renderQuestions);
topicFilter.addEventListener("change", renderQuestions);

renderQuestions();

// Hydrate user session from localStorage if present
try {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser && storedUser.name) {
        const initial = storedUser.name.trim().charAt(0).toUpperCase();
        document.querySelectorAll(".profile-avatar").forEach(el => {
            el.textContent = initial;
        });
        const nameEl = document.querySelector(".profile strong");
        if (nameEl) {
            nameEl.textContent = storedUser.name;
        }
    }
} catch (e) {
    // Graceful fallback
}