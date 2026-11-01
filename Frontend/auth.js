/**
 * SmartBlog Unified Authentication, Global User Identity Synchronization & Auth Engine
 * Shared across all pages of SmartBlog.
 */

const SmartBlogAuth = (() => {
    const API_BASE = "http://127.0.0.1:5000";
    const TOKEN_KEY = "token";
    const USER_KEY = "user";
    const THEME_KEY = "smartblog_theme";

    let inFlightFetch = null;

    function getToken() {
        try {
            return localStorage.getItem(TOKEN_KEY);
        } catch {
            return null;
        }
    }

    function getCurrentUser() {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error("Failed to parse user data:", e);
            return null;
        }
    }

    function setCurrentUser(user) {
        try {
            if (!user) {
                localStorage.removeItem(USER_KEY);
            } else {
                localStorage.setItem(USER_KEY, JSON.stringify(user));
            }
            hydrateUI(user);
        } catch (e) {
            console.error("Failed to save user data:", e);
        }
    }

    function isAuthenticated() {
        const token = getToken();
        const user = getCurrentUser();
        return Boolean(token && user && (user.user_id || user.id));
    }

    function requireAuth(redirectUrl = "login.html") {
        if (!isAuthenticated()) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            window.location.replace(redirectUrl);
            return false;
        }

        // Prevent browser back-button caching from showing protected content after logout
        window.addEventListener("pageshow", event => {
            if (event.persisted || !isAuthenticated()) {
                if (!isAuthenticated()) {
                    window.location.replace(redirectUrl);
                }
            }
        });

        return true;
    }

    /**
     * Fetch the authenticated user's current profile directly from the backend MySQL database.
     * Prevents duplicate simultaneous requests and automatically handles token expiration.
     */
    async function fetchCurrentUser(forceRefresh = false) {
        const token = getToken();
        if (!token) return null;

        if (inFlightFetch && !forceRefresh) {
            return inFlightFetch;
        }

        inFlightFetch = (async () => {
            try {
                const response = await fetch(`${API_BASE}/me`, {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });

                if (response.status === 401) {
                    console.warn("Session expired or invalid token. Redirecting to login.");
                    logout(false);
                    return null;
                }

                if (!response.ok) {
                    throw new Error(`Failed to fetch user profile: ${response.status}`);
                }

                const data = await response.json();
                if (data.success && data.user) {
                    const freshUser = {
                        user_id: data.user.user_id,
                        name: data.user.name,
                        email: data.user.email,
                        reputation_points: data.user.reputation_points,
                        interests: data.user.interests || []
                    };
                    localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
                    hydrateUI(freshUser);
                    return freshUser;
                }
                return getCurrentUser();
            } catch (err) {
                console.error("Could not synchronize user identity from server:", err);
                return getCurrentUser();
            } finally {
                inFlightFetch = null;
            }
        })();

        return inFlightFetch;
    }

    /**
     * Synchronize and dynamically render the authenticated user's identity across the DOM.
     */
    function hydrateUI(userData = null) {
        const user = userData || getCurrentUser();
        if (!user) return;

        const name = (user.name || "User").trim();
        const firstName = name.split(/\s+/)[0] || name;
        const initial = firstName.charAt(0).toUpperCase() || "U";
        const email = user.email || "";
        const username = name.toLowerCase().replace(/[^a-z0-9_]/g, "") || "user";

        // 1. Update Avatar initial elements across all headers, menus, sidebars, and cards
        document.querySelectorAll(".small-avatar, .avatar, .profile-avatar, #userAvatar, #sidebarAvatar").forEach(el => {
            // If element contains an img, don't overwrite with initial
            if (!el.querySelector("img")) {
                el.textContent = initial;
            }
        });

        // Specific element id for profile page avatar
        const profileAvatarEl = document.getElementById("profileAvatar");
        if (profileAvatarEl && !profileAvatarEl.querySelector("img")) {
            profileAvatarEl.textContent = initial;
        }

        // 2. Update Full Name labels
        document.querySelectorAll("#userName, #sidebarName, #displayName, .user-full-name, .user-name, .profile-user-name").forEach(el => {
            el.textContent = name;
        });

        // 3. Update Username labels
        document.querySelectorAll("#displayUsername, .user-handle").forEach(el => {
            el.textContent = `@${username}`;
        });

        // 4. Update Email labels
        document.querySelectorAll("#userEmail, #displayEmail, .user-email, #settingsEmailDisplay").forEach(el => {
            el.textContent = email;
        });

        // 5. Update Dashboard / Welcome Greetings: "Welcome back, {First Name}."
        const welcomeHeading = document.querySelector(".dashboard-welcome h1, .welcome-user-heading");
        if (welcomeHeading) {
            welcomeHeading.replaceChildren(
                document.createTextNode("Welcome back,"),
                document.createElement("br"),
                (() => {
                    const nameElement = document.createElement("em");
                    nameElement.textContent = firstName + ".";
                    return nameElement;
                })()
            );
        }

        // 6. Pre-fill profile/settings edit form fields if empty or present
        const nameInput = document.getElementById("nameInput");
        if (nameInput && (!nameInput.value || nameInput.dataset.hydrated !== "true")) {
            nameInput.value = name;
            nameInput.dataset.hydrated = "true";
        }

        const usernameInput = document.getElementById("usernameInput");
        if (usernameInput && (!usernameInput.value || usernameInput.dataset.hydrated !== "true")) {
            usernameInput.value = username;
            usernameInput.dataset.hydrated = "true";
        }

        const emailInput = document.getElementById("emailInput");
        if (emailInput && (!emailInput.value || emailInput.dataset.hydrated !== "true")) {
            emailInput.value = email;
            emailInput.dataset.hydrated = "true";
        }

        // 7. Check for custom profile picture in localStorage for this user
        const userKey = String(user.user_id || user.id);
        const profilePicKey = `smartblog_profile_pic_${userKey}`;
        let savedPic = null;
        try {
            savedPic = localStorage.getItem(profilePicKey);
        } catch {}

        if (savedPic) {
            const preview = document.getElementById("profilePicPreview");
            if (preview) {
                preview.src = savedPic;
                preview.classList.remove("hidden");
                if (profileAvatarEl) profileAvatarEl.classList.add("hidden");
            }
        }
    }

    /**
     * Appearance & Theme Controller (Light / Dark theme)
     */
    function getTheme() {
        try {
            return localStorage.getItem(THEME_KEY) || "light";
        } catch {
            return "light";
        }
    }

    function setTheme(theme) {
        const selected = theme === "dark" ? "dark" : "light";
        try {
            localStorage.setItem(THEME_KEY, selected);
        } catch {}

        document.documentElement.setAttribute("data-theme", selected);
        if (selected === "dark") {
            document.body.classList.add("dark-theme");
        } else {
            document.body.classList.remove("dark-theme");
        }

        // Dispatch a custom event so settings or other components can update toggles
        window.dispatchEvent(new CustomEvent("smartblog:themechange", { detail: { theme: selected } }));
    }

    function initTheme() {
        const theme = getTheme();
        document.documentElement.setAttribute("data-theme", theme);
        if (document.body) {
            if (theme === "dark") {
                document.body.classList.add("dark-theme");
            } else {
                document.body.classList.remove("dark-theme");
            }
        }
    }

    async function logout(confirmFirst = true) {
        if (confirmFirst) {
            const confirmed = window.confirm("Are you sure you want to log out of SmartBlog?");
            if (!confirmed) {
                return false;
            }
        }

        const token = getToken();

        if (token) {
            try {
                await fetch(`${API_BASE}/logout`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                });
            } catch (err) {
                console.warn("Server logout notification skipped:", err);
            }
        }

        // Clear client authentication state
        try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            sessionStorage.clear();
        } catch (e) {
            console.error("Storage clear error:", e);
        }

        window.location.replace("login.html");
        return true;
    }

    function setupProfileDropdowns() {
        const profileMenus = document.querySelectorAll(".profile-menu");

        profileMenus.forEach(menu => {
            const button = menu.querySelector(".profile-button");
            const dropdown = menu.querySelector(".profile-dropdown");
            if (!button || !dropdown) return;

            button.addEventListener("click", event => {
                event.stopPropagation();
                const isHidden = dropdown.hidden;
                dropdown.hidden = !isHidden;
                button.setAttribute("aria-expanded", String(isHidden));
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", event => {
            if (!event.target.closest(".profile-menu")) {
                document.querySelectorAll(".profile-dropdown").forEach(dropdown => {
                    dropdown.hidden = true;
                });
                document.querySelectorAll(".profile-button").forEach(btn => {
                    btn.setAttribute("aria-expanded", "false");
                });
            }
        });

        // Close dropdown with Escape key
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                document.querySelectorAll(".profile-dropdown").forEach(dropdown => {
                    dropdown.hidden = true;
                });
                document.querySelectorAll(".profile-button").forEach(btn => {
                    btn.setAttribute("aria-expanded", "false");
                });
            }
        });
    }

    function bindLogoutButtons() {
        const triggers = document.querySelectorAll(
            ".logout-btn, #logoutButton, .logout-settings-btn, [data-action='logout'], .sidebar-logout-btn"
        );

        triggers.forEach(trigger => {
            if (trigger.dataset.logoutBound === "true") return;
            trigger.dataset.logoutBound = "true";

            trigger.addEventListener("click", event => {
                event.preventDefault();
                logout(true);
            });
        });
    }

    function initialize() {
        initTheme();
        hydrateUI();
        setupProfileDropdowns();
        bindLogoutButtons();

        // Perform background synchronization with MySQL database if token is present
        if (getToken()) {
            fetchCurrentUser().catch(() => {});
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }

    return {
        API_BASE,
        getToken,
        getCurrentUser,
        setCurrentUser,
        isAuthenticated,
        requireAuth,
        fetchCurrentUser,
        hydrateUI,
        getTheme,
        setTheme,
        initTheme,
        logout,
        setupProfileDropdowns,
        bindLogoutButtons
    };
})();

window.SmartBlogAuth = SmartBlogAuth;
