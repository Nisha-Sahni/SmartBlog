
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
function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
}


// Render Leaderboard
function renderLeaderboard(authors) {
    leaderboardBody.replaceChildren();

    authors.forEach((author) => {
        const row = document.createElement("tr");

        // Rank
        const rankCell = createCell("");

        const rankBadge = document.createElement("span");
        rankBadge.className = "rank-number";

        if (Number(author.rank) <= 3) {
            rankBadge.classList.add("top-rank");
        }

        rankBadge.textContent = `#${author.rank}`;

        rankCell.appendChild(rankBadge);
        row.appendChild(rankCell);


        // Author Information
        const authorCell = createCell("");

        const authorInfo = document.createElement("div");
        authorInfo.className = "author-cell";

        const authorName = String(
            author.name || "SmartBlog author"
        ).trim();

        const avatar = document.createElement("span");
        avatar.className = "author-avatar";
        avatar.textContent = authorName.charAt(0).toUpperCase() || "A";

        const details = document.createElement("div");

        const name = document.createElement("span");
        name.className = "author-name";
        name.textContent = authorName;

        const id = document.createElement("span");
        id.className = "author-id";
        id.textContent = `Author ID: ${author.user_id}`;

        details.append(name, id);
        authorInfo.append(avatar, details);
        authorCell.appendChild(authorInfo);

        row.appendChild(authorCell);


        // Author Level
        const levelCell = createCell("");

        const levelBadge = document.createElement("span");
        levelBadge.className = "level-pill";
        levelBadge.textContent = author.level || "Beginner";

        levelCell.appendChild(levelBadge);
        row.appendChild(levelCell);


        // Reputation Points
        const points = Number(author.reputation_points);

        const pointsCell = createCell(
            `${Number.isFinite(points) ? points : 0} pts`
        );

        pointsCell.className = "points";
        row.appendChild(pointsCell);


        // Add Row to Table
        leaderboardBody.appendChild(row);
    });


    // Update Statistics
    authorCount.textContent = authors.length;

    topAuthor.textContent =
        authors[0].name || "SmartBlog author";

    const highestPoints = Number(authors[0].reputation_points);

    topPoints.textContent = (
        Number.isFinite(highestPoints) ? highestPoints : 0
    ).toLocaleString();

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

        // Check HTTP Response
        if (!response.ok) {
            throw new Error(
                `Server error: ${response.status}`
            );
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
    refreshButton.addEventListener(
        "click",
        loadLeaderboard
    );
}


// Retry After Error
if (retryButton) {
    retryButton.addEventListener(
        "click",
        loadLeaderboard
    );
}


// Initial Load
loadLeaderboard();

