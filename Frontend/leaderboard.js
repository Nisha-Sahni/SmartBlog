
const API_BASE_URL = "http://127.0.0.1:5000";

// DOM Elements
const leaderboardBody = document.getElementById("leaderboardBody");
const loadingMessage = document.getElementById("loadingMessage");
const errorMessage = document.getElementById("errorMessage");
const emptyMessage = document.getElementById("emptyMessage");
const tableWrapper = document.getElementById("tableWrapper");

const authorCount = document.getElementById("authorCount");
const topAuthor = document.getElementById("topAuthor");
const topPoints = document.getElementById("topPoints");
const updatedNote = document.getElementById("updatedNote");

const refreshButton = document.getElementById("refreshButton");
const retryButton = document.getElementById("retryButton");


// Show Loading, Error, Empty or Loaded State
function showState(state) {
    loadingMessage.hidden = state !== "loading";
    errorMessage.hidden = state !== "error";
    emptyMessage.hidden = state !== "empty";
    tableWrapper.hidden = state !== "loaded";
}


// Create Table Cell
function createCell(className = "") {
    const cell = document.createElement("td");

    if (className) {
        cell.className = className;
    }

    return cell;
}


// Safely format author name
function getAuthorName(author) {
    const name = String(author.name || "").trim();
    return name || "SmartBlog author";
}


// Safely format reputation points
function getPoints(author) {
    const points = Number(author.reputation_points);
    return Number.isFinite(points) ? points : 0;
}


// Create Author Cell
function createAuthorCell(author) {
    const cell = createCell();

    const authorInfo = document.createElement("div");
    authorInfo.className = "author-cell";

    const authorName = getAuthorName(author);

    const avatar = document.createElement("span");
    avatar.className = "author-avatar";
    avatar.textContent = authorName.charAt(0).toUpperCase();

    const details = document.createElement("div");
    details.className = "author-details";

    const name = document.createElement("span");
    name.className = "author-name";
    name.textContent = authorName;

    const id = document.createElement("span");
    id.className = "author-id";

    id.textContent =
        author.user_id !== null && author.user_id !== undefined
            ? `Author ID: ${author.user_id}`
            : "SmartBlog author";

    details.append(name, id);
    authorInfo.append(avatar, details);
    cell.appendChild(authorInfo);

    return cell;
}


// Create Rank Cell
function createRankCell(author) {
    const cell = createCell();

    const rankBadge = document.createElement("span");
    rankBadge.className = "rank-number";

    const rank = Number(author.rank);

    if (Number.isFinite(rank) && rank <= 3 && rank >= 1) {
        rankBadge.classList.add("top-rank");
    }

    rankBadge.textContent =
        Number.isFinite(rank) ? `#${rank}` : "—";

    cell.appendChild(rankBadge);

    return cell;
}


// Create Level Cell
function createLevelCell(author) {
    const cell = createCell();

    const levelBadge = document.createElement("span");
    levelBadge.className = "level-pill";
    levelBadge.textContent = author.level || "Beginner";

    cell.appendChild(levelBadge);

    return cell;
}


// Create Reputation Points Cell
function createPointsCell(author) {
    const cell = createCell("points");

    cell.textContent = `${getPoints(author).toLocaleString()} pts`;

    return cell;
}


// Render Leaderboard
function renderLeaderboard(authors) {
    leaderboardBody.replaceChildren();

    authors.forEach((author) => {
        const row = document.createElement("tr");

        row.append(
            createRankCell(author),
            createAuthorCell(author),
            createLevelCell(author),
            createPointsCell(author)
        );

        leaderboardBody.appendChild(row);
    });


    // Update Statistics
    authorCount.textContent = authors.length;

    const firstAuthor = authors[0];

    topAuthor.textContent = getAuthorName(firstAuthor);

    topPoints.textContent = getPoints(firstAuthor).toLocaleString();

    updatedNote.textContent =
        `Last updated: ${new Date().toLocaleString()}`;
}


// Load Leaderboard from Flask Backend
async function loadLeaderboard() {
    showState("loading");
    updatedNote.textContent = "";

    try {
        const response = await fetch(
            `${API_BASE_URL}/leaderboard`
        );

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        // Validate API Response
        if (
            data.success !== true ||
            !Array.isArray(data.leaderboard)
        ) {
            throw new Error(
                data.message || "Invalid leaderboard response."
            );
        }

        const authors = data.leaderboard;

        // Handle Empty Leaderboard
        if (authors.length === 0) {
            authorCount.textContent = "0";
            topAuthor.textContent = "—";
            topPoints.textContent = "—";

            leaderboardBody.replaceChildren();

            updatedNote.textContent = "";

            showState("empty");
            return;
        }

        // Display Leaderboard
        renderLeaderboard(authors);
        showState("loaded");

    } catch (error) {
        console.error("Leaderboard loading failed:", error);
        showState("error");
    }
}


// Refresh Leaderboard
if (refreshButton) {
    refreshButton.addEventListener("click", loadLeaderboard);
}


// Retry After Error
if (retryButton) {
    retryButton.addEventListener("click", loadLeaderboard);
}


// Initial Load
loadLeaderboard();
