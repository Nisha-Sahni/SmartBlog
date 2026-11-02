
/**
 * SmartBlog Admin Panel Controller
 * Direct local demo access — no frontend login or token verification.
 *
 * IMPORTANT:
 * This only opens the dashboard UI directly.
 * Backend API access must separately be configured for localhost demo mode.
 * Never deploy an unauthenticated admin API publicly.
 */

document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = (window.location.origin && window.location.origin.startsWith("http"))
        ? `${window.location.origin}/api/admin`
        : "http://127.0.0.1:5000/api/admin";

    const ADMIN_TOKEN_KEY = "smartblog_admin_token";
    const ADMIN_USER_KEY = "smartblog_admin_user";

    // DOM Elements
    const authGate = document.getElementById("adminAuthGate");
    const loginForm = document.getElementById("adminLoginForm");
    const authError = document.getElementById("adminAuthError");
    const adminEmailInput = document.getElementById("adminEmail");
    const adminPasswordInput = document.getElementById("adminPassword");
    const logoutBtn = document.getElementById("adminLogoutBtn");
    const globalRefreshBtn = document.getElementById("globalRefreshBtn");
    const toastEl = document.getElementById("adminToast");

    const topbarTitle = document.getElementById("topbarTitle");
    const adminAvatarInitial = document.getElementById("adminAvatarInitial");
    const adminUserName = document.getElementById("adminUserName");
    const adminUserEmail = document.getElementById("adminUserEmail");
    const sidebarTicketCount = document.getElementById("sidebarTicketCount");

    // Views
    const navItems = document.querySelectorAll(".nav-item");
    const tabContents = document.querySelectorAll(".admin-tab-content");

    // Modals
    const editBlogModal = document.getElementById("editBlogModal");
    const closeEditBlogModal = document.getElementById("closeEditBlogModal");
    const cancelEditBlogBtn = document.getElementById("cancelEditBlogBtn");
    const editBlogForm = document.getElementById("editBlogForm");

    const adminTicketModal = document.getElementById("adminTicketModal");
    const closeTicketModal = document.getElementById("closeTicketModal");
    const closeTicketBtn = document.getElementById("closeTicketBtn");
    const saveTicketStatusBtn = document.getElementById("saveTicketStatusBtn");

    let currentAdmin = null;
    let activeTab = "dashboard";
    let currentViewingTicketId = null;

    // =========================================================
    // HELPERS
    // =========================================================

    function getAdminToken() {
        return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
    }

    function setAdminToken(token) {
        if (token) {
            localStorage.setItem(ADMIN_TOKEN_KEY, token);
        }
    }

    function clearAdminToken() {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem(ADMIN_USER_KEY);
    }

    function showToast(message, type = "success") {
        if (!toastEl) return;

        toastEl.textContent = message;
        toastEl.className = `admin-toast ${type}`;
        toastEl.hidden = false;

        setTimeout(() => {
            toastEl.hidden = true;
        }, 3000);
    }

    function escapeHTML(str) {
        if (!str) return "";

        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(dateStr) {
        if (!dateStr) return "Recently";

        try {
            const d = new Date(dateStr);

            if (Number.isNaN(d.getTime())) return "Recently";

            return d.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            });
        } catch {
            return "Recently";
        }
    }

    async function apiRequest(endpoint, method = "GET", body = null) {
        const token = getAdminToken();

        const headers = {
            "Content-Type": "application/json"
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const config = {
            method,
            headers
        };

        if (body !== null) {
            config.body = JSON.stringify(body);
        }

        let response;

        try {
            response = await fetch(`${API_BASE}${endpoint}`, config);
        } catch (fetchErr) {
            console.error("Admin API connection error:", fetchErr);

            return {
                ok: false,
                status: 0,
                data: {
                    success: false,
                    message: "Network error connecting to backend API."
                }
            };
        }

        const data = await response.json().catch(() => ({
            success: false,
            message: "Invalid JSON response"
        }));

        // Do not redirect to login when an API request is unauthorized.
        // Backend demo-mode configuration is responsible for API access.
        if (response.status === 401 || response.status === 403) {
            console.error("Admin API authorization error:", data.message);
        }

        if (response.status === 404) {
            console.error("Admin API route not found:", endpoint);
        }

        return {
            ok: response.ok,
            status: response.status,
            data
        };
    }

    // =========================================================
    // AUTHENTICATION UI — DISABLED FOR LOCAL DEMO
    // =========================================================

    function showAuthGate(errorMsg = "") {
        // Login gate is intentionally disabled for the local demo.
        if (authGate) {
            authGate.hidden = true;
            authGate.style.display = "none";
        }

        if (authError) {
            authError.textContent = errorMsg;
            authError.hidden = true;
        }
    }

    function hideAuthGate() {
        if (authGate) {
            authGate.hidden = true;
            authGate.style.display = "none";
        }

        if (authError) {
            authError.hidden = true;
            authError.style.display = "none";
            authError.textContent = "";
        }
    }

    function populateAdminProfile(user) {
        if (!user) return;

        const initial = (user.name || "A").charAt(0).toUpperCase();

        if (adminAvatarInitial) {
            adminAvatarInitial.textContent = initial;
        }

        if (adminUserName) {
            adminUserName.textContent = user.name || "Administrator";
        }

        if (adminUserEmail) {
            adminUserEmail.textContent = user.email || "";
        }
    }

    // =========================================================
    // DIRECT DASHBOARD ACCESS — NO LOGIN OR VERIFY REQUEST
    // =========================================================

    function openAdminDashboardDirectly() {
        hideAuthGate();

        currentAdmin = {
            user_id: 0,
            name: "SmartBlog Admin",
            email: "admin@smartblog.local",
            is_admin: true
        };

        localStorage.setItem(
            ADMIN_USER_KEY,
            JSON.stringify(currentAdmin)
        );

        populateAdminProfile(currentAdmin);

        // Hide logout because this demo does not use login sessions.
        if (logoutBtn) {
            logoutBtn.style.display = "none";
        }

        // Open the dashboard tab.
        switchTab("dashboard");
    }

    // =========================================================
    // NAVIGATION & TAB SWITCHING
    // =========================================================

    const tabTitles = {
        dashboard: "System Dashboard",
        blogs: "Blog & Story Management",
        users: "User Accounts & Permissions",
        moderation: "Community Moderation",
        support: "Support Tickets & Inquiries"
    };

    function switchTab(tabId) {
        activeTab = tabId;

        navItems.forEach(item => {
            item.classList.toggle("active", item.dataset.tab === tabId);
        });

        tabContents.forEach(content => {
            content.classList.toggle(
                "active",
                content.id === `tab-${tabId}`
            );
        });

        if (topbarTitle) {
            topbarTitle.textContent =
                tabTitles[tabId] || "Administration";
        }

        loadActiveTabData();
    }

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            switchTab(item.dataset.tab);
        });
    });

    document.querySelectorAll(".quick-action-card").forEach(card => {
        card.addEventListener("click", () => {
            const dest = card.dataset.goto;
            if (dest) switchTab(dest);
        });
    });

    // Moderation Subtabs
    const subnavBtns = document.querySelectorAll(".subnav-btn");
    const subtabPanels = document.querySelectorAll(".subtab-panel");

    subnavBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.subtab;

            subnavBtns.forEach(b => {
                b.classList.toggle("active", b === btn);
            });

            subtabPanels.forEach(panel => {
                panel.classList.toggle(
                    "active",
                    panel.id === `subtab-${target}`
                );
            });

            if (target === "comments") loadModerationComments();
            if (target === "questions") loadModerationQuestions();
        });
    });

    if (globalRefreshBtn) {
        globalRefreshBtn.addEventListener("click", () => {
            showToast("Refreshing data...");
            loadActiveTabData();
        });
    }

    function loadActiveTabData() {
        if (activeTab === "dashboard") loadDashboardStats();
        else if (activeTab === "blogs") loadBlogsTable();
        else if (activeTab === "users") loadUsersTable();
        else if (activeTab === "moderation") {
            loadModerationComments();
            loadModerationQuestions();
        }
        else if (activeTab === "support") loadSupportTable();
    }

    // =========================================================
    // 1. DASHBOARD OVERVIEW DATA
    // =========================================================

    async function loadDashboardStats() {
        const res = await apiRequest("/stats");

        if (!res.ok || !res.data.success) {
            console.error("Could not load dashboard statistics:", res.data.message);
            return;
        }

        const { stats, recent_activity } = res.data;

        document.getElementById("statUsers").textContent =
            stats.total_users ?? 0;

        document.getElementById("statBlogs").textContent =
            stats.total_blogs ?? 0;

        document.getElementById("statDrafts").textContent =
            stats.total_drafts ?? 0;

        document.getElementById("statComments").textContent =
            stats.total_comments ?? 0;

        document.getElementById("statSupport").textContent =
            stats.total_support_requests ?? 0;

        const openBadge = document.getElementById("openSupportBadge");

        if (openBadge) {
            openBadge.textContent =
                `${stats.open_support_requests ?? 0} Open`;

            if (stats.open_support_requests > 0) {
                openBadge.style.background = "#ffe3d1";
                openBadge.style.color = "#c0392b";
            }
        }

        if (sidebarTicketCount) {
            if (stats.open_support_requests > 0) {
                sidebarTicketCount.textContent =
                    stats.open_support_requests;

                sidebarTicketCount.hidden = false;
            } else {
                sidebarTicketCount.hidden = true;
            }
        }

        const activityList =
            document.getElementById("dashboardActivityList");

        if (!activityList) return;

        if (!recent_activity || !recent_activity.length) {
            activityList.innerHTML =
                '<div class="loading-state">No platform activity recorded yet.</div>';
            return;
        }

        activityList.innerHTML = recent_activity.map(item => {
            const timeAgo = formatDate(item.created_at);

            let badgeClass = "blog";
            let typeLabel = "STORY";

            if (item.type === "comment") {
                badgeClass = "comment";
                typeLabel = "COMMENT";
            } else if (item.type === "ticket") {
                badgeClass = "ticket";
                typeLabel = "TICKET";
            }

            return `
                <div class="activity-item">
                    <span class="activity-badge ${badgeClass}">${typeLabel}</span>
                    <div class="activity-details">
                        <strong>${escapeHTML(item.title || "Untitled")}</strong>
                        <span>By ${escapeHTML(item.author || "Member")}</span>
                    </div>
                    <span class="activity-time">${timeAgo}</span>
                </div>
            `;
        }).join("");
    }

    // =========================================================
    // 2. BLOG MANAGEMENT
    // =========================================================

    const blogSearchInput =
        document.getElementById("blogSearchInput");

    const blogTopicFilter =
        document.getElementById("blogTopicFilter");

    let blogSearchTimer = null;

    if (blogSearchInput) {
        blogSearchInput.addEventListener("input", () => {
            clearTimeout(blogSearchTimer);
            blogSearchTimer = setTimeout(loadBlogsTable, 300);
        });
    }

    if (blogTopicFilter) {
        blogTopicFilter.addEventListener("change", loadBlogsTable);
    }

    async function loadBlogsTable() {
        const tbody = document.getElementById("blogsTableBody");
        if (!tbody) return;

        const q = (blogSearchInput?.value || "").trim();
        const topic = blogTopicFilter?.value || "All";

        const url =
            `/blogs?q=${encodeURIComponent(q)}&topic=${encodeURIComponent(topic)}`;

        const res = await apiRequest(url);

        if (!res.ok || !res.data.success) {
            tbody.innerHTML =
                '<tr><td colspan="7" class="loading-state">Could not load blogs.</td></tr>';
            return;
        }

        const blogs = res.data.blogs || [];

        if (!blogs.length) {
            tbody.innerHTML =
                '<tr><td colspan="7" class="loading-state">No stories match your filter.</td></tr>';
            return;
        }

        tbody.innerHTML = blogs.map(blog => {
            const cover = blog.cover_url ||
                "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=150&q=80";

            return `
                <tr data-blog-id="${blog.blog_id}">
                    <td>
                        <img src="${escapeHTML(cover)}" alt="Thumbnail"
                            class="table-thumbnail"
                            onerror="this.src='https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=150&q=80'">
                    </td>
                    <td>
                        <strong style="display:block; font-size:14px; color:var(--ink);">
                            ${escapeHTML(blog.title)}
                        </strong>
                        <span class="badge topic-tag">
                            ${escapeHTML(blog.topic || "Story")}
                        </span>
                        ${blog.subtitle ? `
                            <span style="font-size:11px; color:var(--muted); margin-left:6px;">
                                ${escapeHTML(blog.subtitle.slice(0, 45))}...
                            </span>
                        ` : ""}
                    </td>
                    <td>
                        <strong>${escapeHTML(blog.author_name || "Writer")}</strong>
                        <div style="font-size:11px; color:var(--muted);">
                            ${escapeHTML(blog.author_email || "")}
                        </div>
                    </td>
                    <td>
                        <span class="badge template-tag">
                            ${escapeHTML(blog.template_id || "scrapbook")}
                        </span>
                    </td>
                    <td><span>💬 ${blog.comments_count || 0}</span></td>
                    <td>${formatDate(blog.created_at)}</td>
                    <td>
                        <div class="table-action-group">
                            <a href="blog.html?id=${blog.blog_id}" target="_blank"
                                class="table-btn" title="View live story">View ↗</a>
                            <button type="button" class="table-btn primary edit-story-btn"
                                data-id="${blog.blog_id}">Edit</button>
                            <button type="button" class="table-btn danger delete-story-btn"
                                data-id="${blog.blog_id}">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        tbody.querySelectorAll(".edit-story-btn").forEach(btn => {
            btn.addEventListener("click", () =>
                openEditBlogModal(btn.dataset.id)
            );
        });

        tbody.querySelectorAll(".delete-story-btn").forEach(btn => {
            btn.addEventListener("click", () =>
                deleteBlog(btn.dataset.id)
            );
        });
    }

    async function openEditBlogModal(blogId) {
        const res = await apiRequest(`/blogs/${blogId}`);

        if (!res.ok || !res.data.success) {
            showToast("Failed to fetch story details.", "error");
            return;
        }

        const b = res.data.blog;

        document.getElementById("editBlogId").value = b.blog_id;
        document.getElementById("editBlogTitle").value = b.title || "";
        document.getElementById("editBlogTopic").value =
            b.topic || "Personal Stories";
        document.getElementById("editBlogSubtitle").value =
            b.subtitle || "";
        document.getElementById("editBlogTemplate").value =
            b.template_id || "scrapbook";
        document.getElementById("editBlogCover").value =
            b.cover_url || "";
        document.getElementById("editBlogContent").value =
            b.content || "";

        if (editBlogModal) editBlogModal.hidden = false;
    }

    if (closeEditBlogModal) {
        closeEditBlogModal.addEventListener("click", () => {
            editBlogModal.hidden = true;
        });
    }

    if (cancelEditBlogBtn) {
        cancelEditBlogBtn.addEventListener("click", () => {
            editBlogModal.hidden = true;
        });
    }

    if (editBlogForm) {
        editBlogForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const id = document.getElementById("editBlogId").value;

            const payload = {
                title: document.getElementById("editBlogTitle").value.trim(),
                topic: document.getElementById("editBlogTopic").value,
                subtitle: document.getElementById("editBlogSubtitle").value.trim(),
                template_id:
                    document.getElementById("editBlogTemplate").value.trim() ||
                    "scrapbook",
                cover_url:
                    document.getElementById("editBlogCover").value.trim(),
                content:
                    document.getElementById("editBlogContent").value.trim()
            };

            const res = await apiRequest(`/blogs/${id}`, "PUT", payload);

            if (res.ok && res.data.success) {
                showToast("Story updated successfully.");

                if (editBlogModal) {
                    editBlogModal.hidden = true;
                }

                loadBlogsTable();
            } else {
                showToast(
                    res.data.message || "Failed to update story.",
                    "error"
                );
            }
        });
    }

    async function deleteBlog(blogId) {
        if (!confirm(
            "Are you sure you want to delete this story? This will permanently remove its comments and questions."
        )) return;

        const res = await apiRequest(`/blogs/${blogId}`, "DELETE");

        if (res.ok && res.data.success) {
            showToast("Story deleted permanently.");
            loadBlogsTable();
            loadDashboardStats();
        } else {
            showToast(
                res.data.message || "Failed to delete story.",
                "error"
            );
        }
    }

    // =========================================================
    // 3. USER MANAGEMENT
    // =========================================================

    const userSearchInput =
        document.getElementById("userSearchInput");

    const userStatusFilter =
        document.getElementById("userStatusFilter");

    let userSearchTimer = null;

    if (userSearchInput) {
        userSearchInput.addEventListener("input", () => {
            clearTimeout(userSearchTimer);
            userSearchTimer = setTimeout(loadUsersTable, 300);
        });
    }

    if (userStatusFilter) {
        userStatusFilter.addEventListener("change", loadUsersTable);
    }

    async function loadUsersTable() {
        const tbody = document.getElementById("usersTableBody");
        if (!tbody) return;

        const q = (userSearchInput?.value || "").trim();
        const status = userStatusFilter?.value || "All";

        const url =
            `/users?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`;

        const res = await apiRequest(url);

        if (!res.ok || !res.data.success) {
            tbody.innerHTML =
                '<tr><td colspan="8" class="loading-state">Could not load users.</td></tr>';
            return;
        }

        const users = res.data.users || [];

        if (!users.length) {
            tbody.innerHTML =
                '<tr><td colspan="8" class="loading-state">No users found.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => {
            const initial = (u.name || "U").charAt(0).toUpperCase();

            const statusClass = u.status === "active"
                ? "status-active"
                : (u.status === "suspended"
                    ? "status-suspended"
                    : "status-banned");

            const isSelf =
                currentAdmin && u.user_id === currentAdmin.user_id;

            return `
                <tr data-user-id="${u.user_id}">
                    <td>
                        <div class="admin-avatar"
                            style="width:32px; height:32px; font-size:12px;">
                            ${escapeHTML(initial)}
                        </div>
                    </td>
                    <td>
                        <strong style="font-size:13px; color:var(--ink);">
                            ${escapeHTML(u.name)}
                        </strong>
                        <div style="font-size:11px; color:var(--muted);">
                            ${escapeHTML(u.email)}
                        </div>
                    </td>
                    <td>
                        <span class="badge ${u.is_admin ? "role-admin" : "role-user"}">
                            ${u.is_admin ? "Admin" : "User"}
                        </span>
                    </td>
                    <td><strong>${u.reputation_points || 0} pts</strong></td>
                    <td>${u.blogs_count || 0} stories</td>
                    <td>
                        <span class="badge ${statusClass}">
                            ${escapeHTML(u.status || "active")}
                        </span>
                    </td>
                    <td>${formatDate(u.created_at)}</td>
                    <td>
                        <div class="table-action-group">
                            ${!isSelf ? `
                                <button type="button" class="table-btn toggle-role-btn"
                                    data-id="${u.user_id}"
                                    data-admin="${u.is_admin ? "1" : "0"}">
                                    ${u.is_admin ? "Demote" : "Promote"}
                                </button>
                                <select class="status-change-select"
                                    data-id="${u.user_id}"
                                    style="padding:4px 6px; font-size:11px; border-radius:4px; border:1px solid var(--line-strong);">
                                    <option value="active"
                                        ${u.status === "active" ? "selected" : ""}>Active</option>
                                    <option value="suspended"
                                        ${u.status === "suspended" ? "selected" : ""}>Suspend</option>
                                    <option value="banned"
                                        ${u.status === "banned" ? "selected" : ""}>Ban</option>
                                </select>
                                <button type="button" class="table-btn danger delete-user-btn"
                                    data-id="${u.user_id}">Delete</button>
                            ` : `
                                <span style="font-size:11px; color:var(--muted); font-style:italic;">
                                    (Your account)
                                </span>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        tbody.querySelectorAll(".toggle-role-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                const currentIsAdmin = btn.dataset.admin === "1";
                toggleUserRole(id, !currentIsAdmin);
            });
        });

        tbody.querySelectorAll(".status-change-select").forEach(sel => {
            sel.addEventListener("change", () => {
                changeUserStatus(sel.dataset.id, sel.value);
            });
        });

        tbody.querySelectorAll(".delete-user-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                deleteUser(btn.dataset.id);
            });
        });
    }

    async function toggleUserRole(userId, newIsAdmin) {
        const res = await apiRequest(
            `/users/${userId}/role`,
            "PUT",
            { is_admin: newIsAdmin }
        );

        if (res.ok && res.data.success) {
            showToast(res.data.message);
            loadUsersTable();
        } else {
            showToast(
                res.data.message || "Could not update user role.",
                "error"
            );
        }
    }

    async function changeUserStatus(userId, status) {
        const res = await apiRequest(
            `/users/${userId}/status`,
            "PUT",
            { status }
        );

        if (res.ok && res.data.success) {
            showToast(res.data.message);
            loadUsersTable();
        } else {
            showToast(
                res.data.message || "Could not update user status.",
                "error"
            );
        }
    }

    async function deleteUser(userId) {
        if (!confirm(
            "Are you sure you want to delete this user? All their stories, drafts, and comments will be permanently erased."
        )) return;

        const res = await apiRequest(`/users/${userId}`, "DELETE");

        if (res.ok && res.data.success) {
            showToast("User deleted successfully.");
            loadUsersTable();
            loadDashboardStats();
        } else {
            showToast(
                res.data.message || "Could not delete user.",
                "error"
            );
        }
    }

    // =========================================================
    // 4. COMMUNITY MODERATION
    // =========================================================

    async function loadModerationComments() {
        const tbody = document.getElementById("commentsTableBody");
        if (!tbody) return;

        const res = await apiRequest("/comments");

        if (!res.ok || !res.data.success) {
            tbody.innerHTML =
                '<tr><td colspan="5" class="loading-state">Could not load comments.</td></tr>';
            return;
        }

        const comments = res.data.comments || [];

        if (!comments.length) {
            tbody.innerHTML =
                '<tr><td colspan="5" class="loading-state">No comments to moderate.</td></tr>';
            return;
        }

        tbody.innerHTML = comments.map(c => `
            <tr>
                <td style="max-width: 320px;">
                    <div style="font-size:13px; line-height:1.4;">
                        ${escapeHTML(c.comment)}
                    </div>
                </td>
                <td><strong>${escapeHTML(c.blog_title || "Deleted Story")}</strong></td>
                <td>
                    <strong>${escapeHTML(c.user_name || "Anonymous")}</strong>
                    <div style="font-size:11px; color:var(--muted);">
                        ${escapeHTML(c.user_email || "")}
                    </div>
                </td>
                <td>${formatDate(c.created_at)}</td>
                <td style="text-align: right;">
                    <button type="button" class="table-btn danger delete-comment-btn"
                        data-id="${c.comment_id}">Delete Comment</button>
                </td>
            </tr>
        `).join("");

        tbody.querySelectorAll(".delete-comment-btn").forEach(btn => {
            btn.addEventListener("click", () =>
                deleteComment(btn.dataset.id)
            );
        });
    }

    async function deleteComment(commentId) {
        if (!confirm("Are you sure you want to remove this comment?")) return;

        const res = await apiRequest(`/comments/${commentId}`, "DELETE");

        if (res.ok && res.data.success) {
            showToast("Comment removed.");
            loadModerationComments();
            loadDashboardStats();
        } else {
            showToast(
                res.data.message || "Could not remove comment.",
                "error"
            );
        }
    }

    async function loadModerationQuestions() {
        const tbody = document.getElementById("questionsTableBody");
        if (!tbody) return;

        const res = await apiRequest("/questions");

        if (!res.ok || !res.data.success) {
            tbody.innerHTML =
                '<tr><td colspan="5" class="loading-state">Could not load questions.</td></tr>';
            return;
        }

        const questions = res.data.questions || [];

        if (!questions.length) {
            tbody.innerHTML =
                '<tr><td colspan="5" class="loading-state">No questions recorded.</td></tr>';
            return;
        }

        tbody.innerHTML = questions.map(q => `
            <tr>
                <td style="max-width: 340px;">
                    <strong>${escapeHTML(q.question)}</strong>
                </td>
                <td>${escapeHTML(q.blog_title || "Community Q&A")}</td>
                <td>${escapeHTML(q.user_name || "Community Member")}</td>
                <td>${formatDate(q.created_at)}</td>
                <td style="text-align: right;">
                    <button type="button" class="table-btn danger delete-question-btn"
                        data-id="${q.question_id}">Delete</button>
                </td>
            </tr>
        `).join("");

        tbody.querySelectorAll(".delete-question-btn").forEach(btn => {
            btn.addEventListener("click", () =>
                deleteQuestion(btn.dataset.id)
            );
        });
    }

    async function deleteQuestion(questionId) {
        if (!confirm("Are you sure you want to delete this question?")) return;

        const res = await apiRequest(`/questions/${questionId}`, "DELETE");

        if (res.ok && res.data.success) {
            showToast("Question removed.");
            loadModerationQuestions();
            loadDashboardStats();
        } else {
            showToast(
                res.data.message || "Could not remove question.",
                "error"
            );
        }
    }

    // =========================================================
    // 5. SUPPORT REQUEST MANAGEMENT
    // =========================================================

    const supportStatusFilter =
        document.getElementById("supportStatusFilter");

    if (supportStatusFilter) {
        supportStatusFilter.addEventListener(
            "change",
            loadSupportTable
        );
    }

    async function loadSupportTable() {
        const tbody = document.getElementById("supportTableBody");
        if (!tbody) return;

        const status = supportStatusFilter?.value || "All";

        const url =
            `/support?status=${encodeURIComponent(status)}`;

        const res = await apiRequest(url);

        if (!res.ok || !res.data.success) {
            tbody.innerHTML =
                '<tr><td colspan="7" class="loading-state">Could not load support tickets.</td></tr>';
            return;
        }

        const tickets = res.data.requests || [];

        if (!tickets.length) {
            tbody.innerHTML =
                '<tr><td colspan="7" class="loading-state">No tickets in this status.</td></tr>';
            return;
        }

        tbody.innerHTML = tickets.map(t => {
            const sLower = (t.status || "")
                .toLowerCase()
                .replace(/\s+/g, "-");

            const statusClass = `status-${sLower}`;

            return `
                <tr>
                    <td><strong>#SR-${t.support_id}</strong></td>
                    <td>
                        <strong style="color:var(--ink);">
                            ${escapeHTML(t.subject)}
                        </strong>
                    </td>
                    <td>
                        <span class="badge" style="background:#eee; color:#444;">
                            ${escapeHTML(t.category || "General")}
                        </span>
                    </td>
                    <td>
                        <strong>${escapeHTML(t.user_name || "User")}</strong>
                        <div style="font-size:11px; color:var(--muted);">
                            ${escapeHTML(t.user_email || "")}
                        </div>
                    </td>
                    <td>
                        <span class="badge ${statusClass}">
                            ${escapeHTML(t.status || "Open")}
                        </span>
                    </td>
                    <td>${formatDate(t.created_at)}</td>
                    <td style="text-align: right;">
                        <button type="button" class="table-btn primary view-ticket-btn"
                            data-id="${t.support_id}">Open Ticket ↗</button>
                    </td>
                </tr>
            `;
        }).join("");

        tbody.querySelectorAll(".view-ticket-btn").forEach(btn => {
            btn.addEventListener("click", () =>
                openAdminTicketModal(btn.dataset.id)
            );
        });
    }

    async function openAdminTicketModal(ticketId) {
        currentViewingTicketId = ticketId;

        const res = await apiRequest(`/support/${ticketId}`);

        if (!res.ok || !res.data.success) {
            showToast("Failed to fetch ticket details.", "error");
            return;
        }

        const t = res.data.request;

        document.getElementById("ticketModalRef").textContent =
            `#SR-${t.support_id}`;

        document.getElementById("ticketModalSubject").textContent =
            t.subject || "Untitled Ticket";

        document.getElementById("ticketModalUser").textContent =
            `${t.user_name || "Member"} (${t.user_email || "no email"})`;

        document.getElementById("ticketModalCategory").textContent =
            t.category || "General";

        document.getElementById("ticketModalDate").textContent =
            formatDate(t.created_at);

        document.getElementById("ticketModalDesc").textContent =
            t.description || "No description provided.";

        document.getElementById("ticketStatusSelect").value =
            t.status || "Open";

        if (adminTicketModal) {
            adminTicketModal.hidden = false;
        }
    }

    if (closeTicketModal) {
        closeTicketModal.addEventListener("click", () => {
            adminTicketModal.hidden = true;
        });
    }

    if (closeTicketBtn) {
        closeTicketBtn.addEventListener("click", () => {
            adminTicketModal.hidden = true;
        });
    }

    if (saveTicketStatusBtn) {
        saveTicketStatusBtn.addEventListener("click", async () => {
            if (!currentViewingTicketId) return;

            const newStatus =
                document.getElementById("ticketStatusSelect").value;

            const res = await apiRequest(
                `/support/${currentViewingTicketId}/status`,
                "PUT",
                { status: newStatus }
            );

            if (res.ok && res.data.success) {
                showToast(`Ticket status updated to ${newStatus}.`);

                if (adminTicketModal) {
                    adminTicketModal.hidden = true;
                }

                loadSupportTable();
                loadDashboardStats();
            } else {
                showToast(
                    res.data.message || "Failed to update ticket status.",
                    "error"
                );
            }
        });
    }

    // =========================================================
    // INITIALIZATION
    // =========================================================

    // Open the dashboard directly. No /verify request is made.
    openAdminDashboardDirectly();
});

