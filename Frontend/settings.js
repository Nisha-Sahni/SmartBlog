/**
 * SmartBlog Settings Page Logic
 * Handles Account updates, Password change, Reading preferences,
 * Appearance/Theme customization, and Account deletion.
 */

document.addEventListener("DOMContentLoaded", async () => {
    // Ensure user is authenticated
    if (window.SmartBlogAuth && !window.SmartBlogAuth.requireAuth("login.html")) {
        return;
    }

    const API_BASE = "http://127.0.0.1:5000";
    const token = window.SmartBlogAuth ? window.SmartBlogAuth.getToken() : localStorage.getItem("token");

    // Elements - Feedback
    const feedbackBox = document.getElementById("settingsFeedback");

    function showFeedback(message, type = "success") {
        if (!feedbackBox) return;
        feedbackBox.hidden = false;
        feedbackBox.className = `settings-feedback ${type}`;
        feedbackBox.textContent = message;
        feedbackBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function clearFeedback() {
        if (!feedbackBox) return;
        feedbackBox.hidden = true;
        feedbackBox.className = "settings-feedback";
        feedbackBox.textContent = "";
    }

    // ==========================================
    // 1. ACCOUNT INFORMATION
    // ==========================================
    const accountForm = document.getElementById("accountForm");
    const nameInput = document.getElementById("settingsNameInput");
    const emailInput = document.getElementById("settingsEmailInput");
    const usernameInput = document.getElementById("settingsUsernameInput");
    const cancelAccountBtn = document.getElementById("cancelAccountBtn");

    let currentUserData = null;

    async function loadAccountData() {
        try {
            currentUserData = await window.SmartBlogAuth.fetchCurrentUser(true);
            if (!currentUserData) {
                currentUserData = window.SmartBlogAuth.getCurrentUser();
            }

            if (currentUserData) {
                if (nameInput) nameInput.value = currentUserData.name || "";
                if (emailInput) emailInput.value = currentUserData.email || "";
                if (usernameInput) {
                    const uname = (currentUserData.name || "user").toLowerCase().replace(/[^a-z0-9_]/g, "");
                    usernameInput.value = `@${uname}`;
                }
                renderInterests(currentUserData.interests || []);
            }
        } catch (err) {
            console.error("Failed to load account settings data:", err);
        }
    }

    if (accountForm) {
        accountForm.addEventListener("submit", async event => {
            event.preventDefault();
            clearFeedback();

            const newName = nameInput.value.trim();
            const newEmail = emailInput.value.trim().toLowerCase();

            if (!newName || newName.length < 2) {
                showFeedback("Name must be at least 2 characters long.", "error");
                nameInput.focus();
                return;
            }

            if (!newEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
                showFeedback("Please enter a valid email address.", "error");
                emailInput.focus();
                return;
            }

            const submitBtn = document.getElementById("saveAccountBtn");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Saving...";
            }

            try {
                const response = await fetch(`${API_BASE}/me`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: newName,
                        email: newEmail
                    })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Failed to update account information.");
                }

                // Update local storage and synchronized UI
                currentUserData = data.user;
                window.SmartBlogAuth.setCurrentUser(data.user);
                showFeedback("Your account information has been updated successfully!", "success");

                if (usernameInput) {
                    const uname = (data.user.name || "user").toLowerCase().replace(/[^a-z0-9_]/g, "");
                    usernameInput.value = `@${uname}`;
                }
            } catch (err) {
                showFeedback(err.message, "error");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Save Changes";
                }
            }
        });
    }

    if (cancelAccountBtn) {
        cancelAccountBtn.addEventListener("click", () => {
            clearFeedback();
            if (currentUserData) {
                if (nameInput) nameInput.value = currentUserData.name || "";
                if (emailInput) emailInput.value = currentUserData.email || "";
            }
        });
    }

    // ==========================================
    // 2. PASSWORD & SECURITY
    // ==========================================
    const passwordForm = document.getElementById("passwordForm");
    const currentPasswordInput = document.getElementById("currentPasswordInput");
    const newPasswordInput = document.getElementById("newPasswordInput");
    const confirmPasswordInput = document.getElementById("confirmPasswordInput");

    if (passwordForm) {
        passwordForm.addEventListener("submit", async event => {
            event.preventDefault();
            clearFeedback();

            const curPass = currentPasswordInput.value;
            const newPass = newPasswordInput.value;
            const confPass = confirmPasswordInput.value;

            if (!curPass) {
                showFeedback("Current password is required.", "error");
                currentPasswordInput.focus();
                return;
            }

            if (!newPass || newPass.length < 8) {
                showFeedback("New password must be at least 8 characters long.", "error");
                newPasswordInput.focus();
                return;
            }

            if (newPass !== confPass) {
                showFeedback("New password and confirmation do not match.", "error");
                confirmPasswordInput.focus();
                return;
            }

            const changeBtn = document.getElementById("changePasswordBtn");
            if (changeBtn) {
                changeBtn.disabled = true;
                changeBtn.textContent = "Updating...";
            }

            try {
                const response = await fetch(`${API_BASE}/me/change-password`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        current_password: curPass,
                        new_password: newPass,
                        confirm_password: confPass
                    })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Failed to change password.");
                }

                passwordForm.reset();
                showFeedback("Your password has been changed successfully!", "success");
            } catch (err) {
                showFeedback(err.message, "error");
            } finally {
                if (changeBtn) {
                    changeBtn.disabled = false;
                    changeBtn.textContent = "Update Password";
                }
            }
        });
    }

    // ==========================================
    // 3. READING PREFERENCES
    // ==========================================
    const interestsTagList = document.getElementById("interestsTagList");
    const newInterestInput = document.getElementById("newInterestInput");
    const addInterestBtn = document.getElementById("addInterestBtn");
    const popularInterestsList = document.getElementById("popularInterestsList");
    const saveInterestsBtn = document.getElementById("saveInterestsBtn");

    let currentInterests = new Set();

    const popularTopics = [
        "Technology", "Programming", "Artificial Intelligence", "Data Science",
        "Lifestyle", "Creativity", "Science", "Business", "Health & Fitness",
        "Personal Stories", "Design", "Cybersecurity", "Books & Literature"
    ];

    function renderInterests(list) {
        if (Array.isArray(list)) {
            currentInterests = new Set(list);
        }

        if (!interestsTagList) return;
        interestsTagList.innerHTML = "";

        if (currentInterests.size === 0) {
            interestsTagList.innerHTML = `<span style="color: var(--muted, #77766f); font-size: 13px;">No active topics selected yet. Add topics below.</span>`;
            return;
        }

        currentInterests.forEach(topic => {
            const tag = document.createElement("span");
            tag.className = "interest-tag";
            tag.innerHTML = `
                ${escapeHTML(topic)}
                <button type="button" aria-label="Remove ${escapeHTML(topic)}">✕</button>
            `;

            tag.querySelector("button").addEventListener("click", () => {
                currentInterests.delete(topic);
                renderInterests();
            });

            interestsTagList.appendChild(tag);
        });
    }

    function renderPopularTopics() {
        if (!popularInterestsList) return;
        popularInterestsList.innerHTML = "";

        popularTopics.forEach(topic => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "popular-chip";
            chip.textContent = `+ ${topic}`;
            chip.addEventListener("click", () => {
                currentInterests.add(topic);
                renderInterests();
            });
            popularInterestsList.appendChild(chip);
        });
    }

    if (addInterestBtn && newInterestInput) {
        addInterestBtn.addEventListener("click", () => {
            const val = newInterestInput.value.trim();
            if (val) {
                currentInterests.add(val);
                newInterestInput.value = "";
                renderInterests();
            }
        });

        newInterestInput.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                addInterestBtn.click();
            }
        });
    }

    if (saveInterestsBtn) {
        saveInterestsBtn.addEventListener("click", async () => {
            clearFeedback();
            saveInterestsBtn.disabled = true;
            saveInterestsBtn.textContent = "Saving...";

            try {
                const response = await fetch(`${API_BASE}/me/interests`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        interests: Array.from(currentInterests)
                    })
                });

                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Failed to save preferences.");
                }

                showFeedback("Your reading preferences have been saved and will personalize your feeds!", "success");
            } catch (err) {
                showFeedback(err.message, "error");
            } finally {
                saveInterestsBtn.disabled = false;
                saveInterestsBtn.textContent = "Save Preferences";
            }
        });
    }

    // ==========================================
    // 4. APPEARANCE & THEME
    // ==========================================
    const themeLightRadio = document.getElementById("themeLightRadio");
    const themeDarkRadio = document.getElementById("themeDarkRadio");
    const themeCardLight = document.getElementById("themeCardLight");
    const themeCardDark = document.getElementById("themeCardDark");
    const saveAppearanceBtn = document.getElementById("saveAppearanceBtn");

    const accentButtons = document.querySelectorAll(".accent-swatch-btn");

    function syncThemeUI() {
        const mode = window.SmartBlogAuth.getThemeMode();
        const accent = window.SmartBlogAuth.getThemeAccent();

        if (mode === "dark") {
            if (themeDarkRadio) themeDarkRadio.checked = true;
            themeCardDark?.classList.add("selected");
            themeCardLight?.classList.remove("selected");
        } else {
            if (themeLightRadio) themeLightRadio.checked = true;
            themeCardLight?.classList.add("selected");
            themeCardDark?.classList.remove("selected");
        }

        accentButtons.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.accent === accent);
        });
    }

    if (themeLightRadio && themeDarkRadio) {
        themeLightRadio.addEventListener("change", () => {
            window.SmartBlogAuth.applyTheme("light", window.SmartBlogAuth.getThemeAccent(), true);
            syncThemeUI();
            showFeedback("Theme mode changed to Light.", "info");
        });

        themeDarkRadio.addEventListener("change", () => {
            window.SmartBlogAuth.applyTheme("dark", window.SmartBlogAuth.getThemeAccent(), true);
            syncThemeUI();
            showFeedback("Theme mode changed to Dark.", "info");
        });
    }

    accentButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const chosenAccent = btn.dataset.accent;
            window.SmartBlogAuth.applyTheme(window.SmartBlogAuth.getThemeMode(), chosenAccent, true);
            syncThemeUI();
            showFeedback(`Accent color changed to ${btn.dataset.name || chosenAccent}.`, "info");
        });
    });

    if (saveAppearanceBtn) {
        saveAppearanceBtn.addEventListener("click", () => {
            const mode = window.SmartBlogAuth.getThemeMode();
            const accent = window.SmartBlogAuth.getThemeAccent();
            window.SmartBlogAuth.applyTheme(mode, accent, true);
            showFeedback("Appearance preferences saved permanently to your account!", "success");
        });
    }

    // ==========================================
    // 5. PRIVACY & ACCOUNT MANAGEMENT (DANGER ZONE)
    // ==========================================
    const startDeleteBtn = document.getElementById("startDeleteAccountBtn");
    const deletePanel = document.getElementById("deleteAccountPanel");
    const cancelDeleteBtn = document.getElementById("cancelDeleteAccountBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteAccountBtn");
    const deletePasswordInput = document.getElementById("deleteConfirmPassword");

    if (startDeleteBtn && deletePanel) {
        startDeleteBtn.addEventListener("click", () => {
            deletePanel.hidden = false;
            if (deletePasswordInput) deletePasswordInput.focus();
        });
    }

    if (cancelDeleteBtn && deletePanel) {
        cancelDeleteBtn.addEventListener("click", () => {
            deletePanel.hidden = true;
            if (deletePasswordInput) deletePasswordInput.value = "";
        });
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", async () => {
            const pass = deletePasswordInput?.value;
            if (!pass) {
                showFeedback("Please enter your password to confirm account deletion.", "error");
                deletePasswordInput?.focus();
                return;
            }

            const confirmed = window.confirm(
                "Are you absolutely certain you want to permanently delete your SmartBlog account? This cannot be undone."
            );
            if (!confirmed) return;

            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.textContent = "Deleting Account...";

            try {
                const response = await fetch(`${API_BASE}/me/account`, {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ password: pass })
                });

                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Failed to delete account.");
                }

                alert("Your account has been deleted. We are sorry to see you go.");
                window.SmartBlogAuth.logout(false);
            } catch (err) {
                showFeedback(err.message, "error");
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.textContent = "Permanently Delete Account";
            }
        });
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

    // Initialize Page
    await loadAccountData();
    renderPopularTopics();
    syncThemeUI();
});

