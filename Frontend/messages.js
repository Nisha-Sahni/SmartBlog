/**
 * SmartBlog — Direct Messaging System
 * Real-time conversation management and chat messaging.
 */

document.addEventListener("DOMContentLoaded", async () => {
    if (window.SmartBlogAuth && !window.SmartBlogAuth.requireAuth("login.html")) {
        return;
    }

    const API_BASE = "http://127.0.0.1:5000";
    const token = window.SmartBlogAuth ? window.SmartBlogAuth.getToken() : localStorage.getItem("token");

    function getCurrentUserId() {
        const u = window.SmartBlogAuth ? window.SmartBlogAuth.getCurrentUser() : JSON.parse(localStorage.getItem("user") || "{}");
        return Number(u?.user_id || u?.id || 0);
    }

    // Elements
    const conversationsList = document.getElementById("conversationsList");
    const conversationsEmpty = document.getElementById("conversationsEmpty");
    const conversationSearchInput = document.getElementById("conversationSearchInput");
    const unreadTotalBadge = document.getElementById("unreadTotalBadge");

    const newConversationBtn = document.getElementById("newConversationBtn");
    const newConversationModal = document.getElementById("newConversationModal");
    const closeNewConvBtn = document.getElementById("closeNewConvBtn");
    const userSearchInput = document.getElementById("userSearchInput");
    const userSearchResults = document.getElementById("userSearchResults");

    const chatWelcomeState = document.getElementById("chatWelcomeState");
    const activeChatContainer = document.getElementById("activeChatContainer");
    const chatParticipantAvatar = document.getElementById("chatParticipantAvatar");
    const chatParticipantName = document.getElementById("chatParticipantName");
    const chatParticipantProfileLink = document.getElementById("chatParticipantProfileLink");
    const messagesThread = document.getElementById("messagesThread");
    const chatComposer = document.getElementById("chatComposer");
    const messageTextInput = document.getElementById("messageTextInput");
    const sendMessageBtn = document.getElementById("sendMessageBtn");
    const backToConversationsBtn = document.getElementById("backToConversationsBtn");
    const conversationsSidebar = document.getElementById("conversationsSidebar");

    let allConversations = [];
    let activeConversationId = null;
    let activeOtherUser = null;
    let pollingInterval = null;
    let searchDebounceTimeout = null;

    function escapeHTML(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatTime(isoStr) {
        if (!isoStr) return "";
        try {
            const date = new Date(isoStr);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return "Just now";
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays === 1) return "Yesterday";
            if (diffDays < 7) return `${diffDays}d ago`;

            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        } catch {
            return "";
        }
    }

    // ==========================================
    // 1. LOAD CONVERSATIONS LIST
    // ==========================================
    async function fetchConversations() {
        try {
            const res = await fetch(`${API_BASE}/conversations`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error("Failed to load conversations");
            }

            const data = await res.json();
            allConversations = Array.isArray(data.conversations) ? data.conversations : [];
            renderConversationsList();
        } catch (err) {
            console.error("Error loading conversations:", err);
            if (conversationsList) {
                conversationsList.innerHTML = `
                    <div class="conversations-empty">
                        <p>Could not connect to messaging service.</p>
                    </div>
                `;
            }
        }
    }

    function renderConversationsList() {
        if (!conversationsList) return;

        const myId = getCurrentUserId();
        const query = (conversationSearchInput?.value || "").trim().toLowerCase();
        const filtered = allConversations.filter(c => {
            const name = (c.other_user?.name || "").toLowerCase();
            const lastMsg = (c.latest_message?.content || "").toLowerCase();
            return !query || name.includes(query) || lastMsg.includes(query);
        });

        let totalUnread = 0;
        allConversations.forEach(c => {
            totalUnread += (c.unread_count || 0);
        });

        if (unreadTotalBadge) {
            if (totalUnread > 0) {
                unreadTotalBadge.hidden = false;
                unreadTotalBadge.textContent = `${totalUnread} unread`;
            } else {
                unreadTotalBadge.hidden = true;
            }
        }

        if (conversationsEmpty) {
            conversationsEmpty.hidden = allConversations.length > 0;
        }

        conversationsList.innerHTML = "";

        if (filtered.length === 0) {
            if (allConversations.length > 0) {
                conversationsList.innerHTML = `
                    <div class="conversations-empty">
                        <p>No conversations matching "${escapeHTML(query)}"</p>
                    </div>
                `;
            }
            return;
        }

        filtered.forEach(c => {
            const item = document.createElement("div");
            item.className = `conversation-item ${c.conversation_id === activeConversationId ? "active" : ""}`;
            item.dataset.id = c.conversation_id;

            const name = c.other_user?.name || "Writer";
            const initial = name.charAt(0).toUpperCase();
            const timeStr = formatTime(c.latest_message?.created_at || c.updated_at);
            const snippet = c.latest_message?.content || "No messages yet";
            const isMine = Number(c.latest_message?.sender_id) === myId;
            const hasUnread = (c.unread_count || 0) > 0;

            item.innerHTML = `
                <div class="conversation-avatar">${escapeHTML(initial)}</div>
                <div class="conversation-meta">
                    <div class="conversation-top">
                        <span class="conversation-name">${escapeHTML(name)}</span>
                        <span class="conversation-time">${escapeHTML(timeStr)}</span>
                    </div>
                    <div class="conversation-bottom">
                        <span class="conversation-snippet ${hasUnread ? 'unread' : ''}">
                            ${isMine ? 'You: ' : ''}${escapeHTML(snippet)}
                        </span>
                        ${hasUnread ? '<span class="conversation-unread-dot"></span>' : ''}
                    </div>
                </div>
            `;

            item.addEventListener("click", () => {
                openConversation(c.conversation_id, c.other_user);
            });

            conversationsList.appendChild(item);
        });
    }

    if (conversationSearchInput) {
        conversationSearchInput.addEventListener("input", renderConversationsList);
    }

    // ==========================================
    // 2. OPEN CONVERSATION & LOAD MESSAGES
    // ==========================================
    async function openConversation(conversationId, otherUser = null) {
        activeConversationId = conversationId;
        activeOtherUser = otherUser;

        // On mobile, hide list panel when conversation is active
        if (conversationsSidebar && window.innerWidth <= 768) {
            conversationsSidebar.classList.add("hidden-mobile");
        }

        // Highlight active item in list
        document.querySelectorAll(".conversation-item").forEach(el => {
            el.classList.toggle("active", Number(el.dataset.id) === conversationId);
        });

        // Show active chat area
        if (chatWelcomeState) chatWelcomeState.hidden = true;
        if (activeChatContainer) activeChatContainer.hidden = false;

        // Set participant details in header
        if (otherUser) {
            updateChatHeader(otherUser);
        }

        // Load messages
        await loadMessages(conversationId);

        // Start real-time polling for incoming messages
        startPolling();
    }

    function updateChatHeader(otherUser) {
        const name = otherUser.name || "Writer";
        if (chatParticipantName) chatParticipantName.textContent = name;
        if (chatParticipantAvatar) chatParticipantAvatar.textContent = name.charAt(0).toUpperCase();
        if (chatParticipantProfileLink) {
            chatParticipantProfileLink.href = `profile.html?user_id=${otherUser.user_id}`;
            chatParticipantProfileLink.title = `View ${name}'s profile`;
        }
    }

    async function loadMessages(conversationId, isBackgroundPoll = false) {
        if (!conversationId) return;

        try {
            const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) {
                if (res.status === 403) {
                    alert("You are not authorized to view this conversation.");
                    closeActiveChat();
                }
                return;
            }

            const data = await res.json();
            if (data.success) {
                if (!activeOtherUser && data.other_user) {
                    activeOtherUser = data.other_user;
                    updateChatHeader(data.other_user);
                }

                renderMessagesThread(data.messages || [], isBackgroundPoll);

                // Update unread count in conversations array
                const conv = allConversations.find(c => c.conversation_id === conversationId);
                if (conv) {
                    conv.unread_count = 0;
                    renderConversationsList();
                }
            }
        } catch (err) {
            console.error("Error loading messages:", err);
        }
    }

    function renderMessagesThread(messages, isBackgroundPoll = false) {
        if (!messagesThread) return;

        const myId = getCurrentUserId();
        const isAtBottom = messagesThread.scrollHeight - messagesThread.scrollTop <= messagesThread.clientHeight + 80;

        // If background polling and count hasn't changed, skip re-render to avoid cursor jump
        if (isBackgroundPoll && messagesThread.dataset.messageCount === String(messages.length)) {
            return;
        }

        messagesThread.dataset.messageCount = String(messages.length);
        messagesThread.innerHTML = "";

        if (messages.length === 0) {
            messagesThread.innerHTML = `
                <div class="messages-loading">
                    <p>No messages yet. Say hello and start the conversation!</p>
                </div>
            `;
            return;
        }

        messages.forEach(msg => {
            const isSent = Number(msg.sender_id) === myId;
            const row = document.createElement("div");
            row.className = `message-bubble-row ${isSent ? 'sent' : 'received'}`;

            const timeStr = formatTime(msg.created_at);

            row.innerHTML = `
                <div class="message-bubble">${escapeHTML(msg.content)}</div>
                <div class="message-meta">${escapeHTML(timeStr)}</div>
            `;

            messagesThread.appendChild(row);
        });

        if (isAtBottom || !isBackgroundPoll) {
            scrollToBottom();
        }
    }

    function scrollToBottom() {
        if (messagesThread) {
            messagesThread.scrollTop = messagesThread.scrollHeight;
        }
    }

    function startPolling() {
        stopPolling();
        pollingInterval = setInterval(() => {
            if (activeConversationId) {
                loadMessages(activeConversationId, true);
            }
        }, 3000);
    }

    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    function closeActiveChat() {
        stopPolling();
        activeConversationId = null;
        activeOtherUser = null;
        if (chatWelcomeState) chatWelcomeState.hidden = false;
        if (activeChatContainer) activeChatContainer.hidden = true;
        if (conversationsSidebar) conversationsSidebar.classList.remove("hidden-mobile");
        document.querySelectorAll(".conversation-item").forEach(el => el.classList.remove("active"));
    }

    if (backToConversationsBtn) {
        backToConversationsBtn.addEventListener("click", () => {
            if (conversationsSidebar) conversationsSidebar.classList.remove("hidden-mobile");
        });
    }

    // ==========================================
    // 3. SEND MESSAGE
    // ==========================================
    if (chatComposer) {
        chatComposer.addEventListener("submit", async event => {
            event.preventDefault();
            if (!activeConversationId) return;

            const content = (messageTextInput?.value || "").trim();
            if (!content) return;

            if (sendMessageBtn) sendMessageBtn.disabled = true;

            try {
                const res = await fetch(`${API_BASE}/conversations/${activeConversationId}/messages`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ content })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || "Failed to send message.");
                }

                if (messageTextInput) {
                    messageTextInput.value = "";
                    messageTextInput.style.height = "auto";
                }

                // Immediately fetch messages and update view
                await loadMessages(activeConversationId);
                scrollToBottom();

                // Refresh conversation list to show updated snippet and sorting
                await fetchConversations();
            } catch (err) {
                alert(err.message || "Could not send message.");
            } finally {
                if (sendMessageBtn) sendMessageBtn.disabled = false;
                if (messageTextInput) messageTextInput.focus();
            }
        });
    }

    // Auto-grow textarea
    if (messageTextInput) {
        messageTextInput.addEventListener("input", function() {
            this.style.height = "auto";
            this.style.height = Math.min(this.scrollHeight, 140) + "px";
        });

        // Submit on Enter (without Shift)
        messageTextInput.addEventListener("keydown", function(e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                chatComposer.requestSubmit();
            }
        });
    }

    // ==========================================
    // 4. NEW CONVERSATION USER SEARCH MODAL
    // ==========================================
    async function searchWriters(query = "") {
        if (!userSearchResults) return;
        userSearchResults.innerHTML = `<p class="user-search-loading">Searching writers...</p>`;

        try {
            const url = query ? `${API_BASE}/users/search?q=${encodeURIComponent(query)}` : `${API_BASE}/users/search`;
            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Could not search users.");
            }

            const users = data.users || [];
            userSearchResults.innerHTML = "";

            if (users.length === 0) {
                userSearchResults.innerHTML = `<p class="user-search-loading">No writers found.</p>`;
                return;
            }

            users.forEach(u => {
                const item = document.createElement("div");
                item.className = "user-search-item";
                const initial = (u.name || "U").charAt(0).toUpperCase();

                item.innerHTML = `
                    <div class="user-search-avatar">${escapeHTML(initial)}</div>
                    <div class="user-search-info">
                        <span class="user-search-name">${escapeHTML(u.name)}</span>
                        <span class="user-search-email">${escapeHTML(u.email)} · ${u.reputation_points || 0} pts</span>
                    </div>
                `;

                item.addEventListener("click", async () => {
                    await startConversationWithUser(u.user_id, u);
                    if (newConversationModal) newConversationModal.hidden = true;
                });

                userSearchResults.appendChild(item);
            });
        } catch (e) {
            console.error("User search failed:", e);
            userSearchResults.innerHTML = `<p class="user-search-loading">Could not load writers.</p>`;
        }
    }

    async function startConversationWithUser(recipientId, recipientData = null) {
        try {
            const res = await fetch(`${API_BASE}/conversations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ recipient_id: recipientId })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                await fetchConversations();
                openConversation(data.conversation_id, data.other_user || recipientData);
                if (messageTextInput) messageTextInput.focus();
            } else {
                alert(data.message || "Could not start conversation.");
            }
        } catch (err) {
            console.error("Could not start conversation:", err);
            alert("Could not start conversation.");
        }
    }

    if (newConversationBtn) {
        newConversationBtn.addEventListener("click", () => {
            if (!newConversationModal) return;
            const willOpen = newConversationModal.hidden;
            newConversationModal.hidden = !willOpen;
            if (willOpen) {
                if (userSearchInput) {
                    userSearchInput.value = "";
                    userSearchInput.focus();
                }
                searchWriters("");
            }
        });
    }

    if (closeNewConvBtn) {
        closeNewConvBtn.addEventListener("click", () => {
            if (newConversationModal) newConversationModal.hidden = true;
        });
    }

    if (userSearchInput) {
        userSearchInput.addEventListener("input", () => {
            clearTimeout(searchDebounceTimeout);
            searchDebounceTimeout = setTimeout(() => {
                searchWriters(userSearchInput.value.trim());
            }, 250);
        });
    }

    // ==========================================
    // 5. URL PARAMETER HANDLING (?user_id=X or ?conversation_id=Y)
    // ==========================================
    async function handleUrlParameters() {
        const myId = getCurrentUserId();
        const params = new URLSearchParams(window.location.search);
        const targetUserId = params.get("user_id");
        const targetConvId = params.get("conversation_id");

        if (targetUserId) {
            const uid = parseInt(targetUserId, 10);
            if (uid && uid !== myId) {
                try {
                    await startConversationWithUser(uid);
                    return;
                } catch (e) {
                    console.error("Could not initialize conversation with user:", e);
                }
            }
        }

        if (targetConvId) {
            const cid = parseInt(targetConvId, 10);
            if (cid) {
                await fetchConversations();
                const matched = allConversations.find(c => c.conversation_id === cid);
                openConversation(cid, matched?.other_user || null);
                return;
            }
        }

        // Default: load all conversations
        await fetchConversations();
    }

    await handleUrlParameters();
});
