/**
 * SmartBlog Help & Support Page Logic
 */

document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = "http://127.0.0.1:5000";

    // 1. Verify Authentication
    if (window.SmartBlogAuth && !window.SmartBlogAuth.requireAuth("login.html")) {
        return;
    }

    const token = window.SmartBlogAuth ? window.SmartBlogAuth.getToken() : localStorage.getItem("token");

    // 2. Setup FAQ Accordion
    const faqItems = document.querySelectorAll(".faq-item");
    faqItems.forEach(item => {
        const questionBtn = item.querySelector(".faq-question");
        const answer = item.querySelector(".faq-answer");

        if (questionBtn && answer) {
            questionBtn.addEventListener("click", () => {
                const isExpanded = item.classList.contains("active");

                // Optional: collapse others if desired, or allow multiple open
                item.classList.toggle("active", !isExpanded);
                answer.hidden = isExpanded;
                questionBtn.setAttribute("aria-expanded", String(!isExpanded));
            });
        }
    });

    // 3. Support Form Submission
    const supportForm = document.getElementById("supportForm");
    const supportSubject = document.getElementById("supportSubject");
    const supportCategory = document.getElementById("supportCategory");
    const supportDescription = document.getElementById("supportDescription");
    const supportFeedback = document.getElementById("supportFeedback");
    const submitBtn = document.getElementById("submitSupportBtn");

    function showFeedback(message, type = "success") {
        if (!supportFeedback) return;
        supportFeedback.hidden = false;
        supportFeedback.className = `support-feedback ${type}`;
        supportFeedback.textContent = message;
        supportFeedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function clearFeedback() {
        if (!supportFeedback) return;
        supportFeedback.hidden = true;
        supportFeedback.className = "support-feedback";
        supportFeedback.textContent = "";
    }

    if (supportForm) {
        supportForm.addEventListener("submit", async event => {
            event.preventDefault();
            clearFeedback();

            const subject = supportSubject.value.trim();
            const category = supportCategory.value.trim();
            const description = supportDescription.value.trim();

            // Client Validation
            if (!subject) {
                showFeedback("Please enter a subject for your request.", "error");
                supportSubject.focus();
                return;
            }

            if (subject.length < 3 || subject.length > 200) {
                showFeedback("Subject must be between 3 and 200 characters.", "error");
                supportSubject.focus();
                return;
            }

            if (!category) {
                showFeedback("Please select an issue category.", "error");
                supportCategory.focus();
                return;
            }

            if (!description) {
                showFeedback("Please provide a description of the issue or inquiry.", "error");
                supportDescription.focus();
                return;
            }

            if (description.length < 10) {
                showFeedback("Please provide at least 10 characters describing your request.", "error");
                supportDescription.focus();
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting...";

            try {
                const response = await fetch(`${API_BASE}/support`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        subject,
                        category,
                        description
                    })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Failed to submit support request.");
                }

                // Success
                supportForm.reset();
                showFeedback(`Thank you! Your support request (#SR-${data.support_id}) has been submitted successfully. Our team will review it.`, "success");

                // Refresh tickets list
                loadUserTickets();

            } catch (err) {
                console.error("Support submission error:", err);
                showFeedback(err.message || "Could not submit your request. Please try again.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit Request ↗";
            }
        });
    }

    // 4. Load User's Submitted Support Requests
    const ticketsContainer = document.getElementById("ticketsContainer");
    const ticketsLoading = document.getElementById("ticketsLoading");
    const ticketsEmptyState = document.getElementById("ticketsEmptyState");
    const refreshTicketsBtn = document.getElementById("refreshTicketsBtn");

    function getStatusClass(status) {
        const s = (status || "").toLowerCase();
        if (s.includes("progress")) return "status-in-progress";
        if (s.includes("resolved") || s.includes("closed")) return "status-resolved";
        return "status-open";
    }

    function createTicketCard(ticket) {
        const card = document.createElement("div");
        card.className = "ticket-card";

        const formattedDate = ticket.created_at
            ? new Date(ticket.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            })
            : "Recently";

        const statusClass = getStatusClass(ticket.status);

        card.innerHTML = `
            <div>
                <div class="ticket-header">
                    <span class="ticket-id">#SR-${ticket.support_id}</span>
                    <span class="ticket-status ${statusClass}">${ticket.status || "Open"}</span>
                </div>
                <span class="ticket-category-tag">${ticket.category || "General"}</span>
                <h4>${ticket.subject || "Untitled Request"}</h4>
            </div>
            <p class="ticket-description">${ticket.description || ""}</p>
            <div class="ticket-footer">
                <span>Submitted on ${formattedDate}</span>
                <span>SmartBlog Support</span>
            </div>
        `;

        return card;
    }

    async function loadUserTickets() {
        if (!ticketsContainer) return;
        if (ticketsLoading) ticketsLoading.hidden = false;
        if (ticketsEmptyState) ticketsEmptyState.hidden = true;

        try {
            const response = await fetch(`${API_BASE}/support`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error("Could not load support requests.");
            }

            const data = await response.json();
            const requests = data.requests || [];

            ticketsContainer.innerHTML = "";

            if (!requests.length) {
                if (ticketsEmptyState) ticketsEmptyState.hidden = false;
                return;
            }

            if (ticketsEmptyState) ticketsEmptyState.hidden = true;

            const fragment = document.createDocumentFragment();
            requests.forEach(ticket => {
                fragment.appendChild(createTicketCard(ticket));
            });
            ticketsContainer.appendChild(fragment);

        } catch (err) {
            console.error("Error loading tickets:", err);
            if (ticketsEmptyState) ticketsEmptyState.hidden = false;
        } finally {
            if (ticketsLoading) ticketsLoading.hidden = true;
        }
    }

    if (refreshTicketsBtn) {
        refreshTicketsBtn.addEventListener("click", () => {
            loadUserTickets();
        });
    }

    // Initialize tickets load
    loadUserTickets();
});

