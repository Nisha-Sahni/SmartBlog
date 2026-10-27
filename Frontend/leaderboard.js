
const API_BASE_URL = "http://127.0.0.1:5000";

const leaderboardBody = document.getElementById("leaderboardBody");
const loadingMessage = document.getElementById("loadingMessage");
const errorMessage = document.getElementById("errorMessage");
const emptyMessage = document.getElementById("emptyMessage");
const tableWrapper = document.getElementById("tableWrapper");
const authorCount = document.getElementById("authorCount");
const topAuthor = document.getElementById("topAuthor");
const topPoints = document.getElementById("topPoints");
const updatedNote = document.getElementById("updatedNote");

function showState(state) {
    loadingMessage.hidden = state !== "loading";
    errorMessage.hidden = state !== "error";
    emptyMessage.hidden = state !== "empty";
    tableWrapper.hidden = state !== "loaded";
}

function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
}

function renderLeaderboard(authors) {
    leaderboardBody.replaceChildren();

    authors.forEach((author) => {
        const row = document.createElement("tr");

        const rankCell = createCell("");
        const rankBadge = document.createElement("span");
        rankBadge.className = "rank-number";

        if (Number(author.rank) <= 3) {
            rankBadge.classList.add("top-rank");
        }

        rankBadge.textContent = `#${author.rank}`;
        rankCell.appendChild(rankBadge);
        row.appendChild(rankCell);

        const authorCell = createCell("");
        const authorInfo = document.createElement("div");
        authorInfo.className = "author-cell";

        const avatar = document.createElement("span");
        avatar.className = "author-avatar";

        const authorName = String(author.name || "SmartBlog author").trim();
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

        const levelCell = createCell("");
        const levelBadge = document.createElement("span");
        levelBadge.className = "level-pill";
        levelBadge.textContent = author.level || "Beginner";
        levelCell.appendChild(levelBadge);
        row.appendChild(levelCell);

        const points = Number(author.reputation_points);
        const pointsCell = createCell(
            `${Number.isFinite(points) ? points : 0} pts`
        );

        pointsCell.className = "points";
        row.appendChild(pointsCell);

        leaderboardBody.appendChild(row);
    });

    authorCount.textContent = authors.length;
    topAuthor.textContent = authors[0].name || "SmartBlog author";
    topPoints.textContent = (
        Number(authors[0].reputation_points) || 0
    ).toLocaleString();

    updatedNote.textContent = `Last updated: ${new Date().toLocaleString()}`;
}

async function loadLeaderboard() {
    showState("loading");
    updatedNote.textContent = "";

    try {
        const response = await fetch(`${API_BASE_URL}/leaderboard`);
        const data = await response.json();

        if (
            !response.ok ||
            data.success !== true ||
            !Array.isArray(data.leaderboard)
        ) {
            throw new Error(data.message || "Could not load leaderboard.");
        }

        const authors = data.leaderboard;

        if (authors.length === 0) {
            authorCount.textContent = "0";
            topAuthor.textContent = "—";
            topPoints.textContent = "—";
            showState("empty");
            return;
        }

        renderLeaderboard(authors);
        showState("loaded");
    } catch (error) {
        console.error("Leaderboard loading failed:", error);
        showState("error");
    }
}

const menuToggle = document.getElementById("menuToggle");
const sidebar = document.querySelector(".sidebar");

if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });
}

const refreshButton = document.getElementById("refreshButton");
const retryButton = document.getElementById("retryButton");

if (refreshButton) {
    refreshButton.addEventListener("click", loadLeaderboard);
}

if (retryButton) {
    retryButton.addEventListener("click", loadLeaderboard);
}

loadLeaderboard();
