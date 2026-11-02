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

        // 0. Toggle home page navigation if authenticated
        const guestNav = document.getElementById("guestNavActions");
        const homeMenu = document.getElementById("homeProfileMenu");
        if (guestNav && homeMenu) {
            guestNav.hidden = true;
            homeMenu.hidden = false;
        }

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
     * Appearance & Theme Controller (Light / Dark theme & Accent Colors)
     */
    const THEME_MODE_KEY = "smartblog_theme_mode";
    const THEME_ACCENT_KEY = "smartblog_theme_accent";

    function getThemeMode() {
        try {
            return localStorage.getItem(THEME_MODE_KEY) || localStorage.getItem(THEME_KEY) || "light";
        } catch {
            return "light";
        }
    }

    function getThemeAccent() {
        try {
            return localStorage.getItem(THEME_ACCENT_KEY) || "lime";
        } catch {
            return "lime";
        }
    }

    function applyTheme(mode = null, accent = null, saveToServer = false) {
        const selectedMode = (mode || getThemeMode()) === "dark" ? "dark" : "light";
        const selectedAccent = accent || getThemeAccent() || "lime";

        try {
            localStorage.setItem(THEME_MODE_KEY, selectedMode);
            localStorage.setItem(THEME_KEY, selectedMode);
            localStorage.setItem(THEME_ACCENT_KEY, selectedAccent);
        } catch {}

        document.documentElement.setAttribute("data-theme", selectedMode);
        document.documentElement.setAttribute("data-accent", selectedAccent);
        if (document.body) {
            document.body.classList.toggle("dark-theme", selectedMode === "dark");
        }

        if (saveToServer && getToken()) {
            fetch(`${API_BASE}/me/preferences`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    theme_mode: selectedMode,
                    theme_accent: selectedAccent
                })
            }).catch(err => console.warn("Could not save preferences to server:", err));
        }

        window.dispatchEvent(new CustomEvent("smartblog:themechange", {
            detail: { mode: selectedMode, accent: selectedAccent, theme: selectedMode }
        }));
    }

    function getTheme() {
        return getThemeMode();
    }

    function setTheme(theme, saveToServer = false) {
        applyTheme(theme, getThemeAccent(), saveToServer);
    }

    function setAccent(accent, saveToServer = false) {
        applyTheme(getThemeMode(), accent, saveToServer);
    }

    function initTheme() {
        applyTheme();
    }

    async function syncThemeFromServer() {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE}/me/preferences`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.success && data.preferences) {
                applyTheme(data.preferences.theme_mode, data.preferences.theme_accent, false);
            }
        } catch (e) {
            console.warn("Theme sync failed:", e);
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
            if (button.dataset.dropdownBound === "true") return;
            button.dataset.dropdownBound = "true";

            button.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                const willOpen = dropdown.hidden === true;

                // Close any other open dropdowns first
                document.querySelectorAll(".profile-dropdown").forEach(d => {
                    d.hidden = true;
                });
                document.querySelectorAll(".profile-button").forEach(b => {
                    b.setAttribute("aria-expanded", "false");
                });

                if (willOpen) {
                    dropdown.hidden = false;
                    button.setAttribute("aria-expanded", "true");
                }
            });
        });

        // Bind document-level outside-click & Escape handlers only once
        if (!document.body.dataset.dropdownDocBound) {
            document.body.dataset.dropdownDocBound = "true";

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
            syncThemeFromServer().catch(() => {});
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
        getThemeMode,
        getThemeAccent,
        setTheme,
        setAccent,
        applyTheme,
        syncThemeFromServer,
        initTheme,
        logout,
        setupProfileDropdowns,
        bindLogoutButtons
    };
})();

window.SmartBlogAuth = SmartBlogAuth;
