
document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = "http://127.0.0.1:5000";

    const adminLoginForm = document.getElementById("adminLoginForm");
    const adminEmailInput = document.getElementById("adminEmail");
    const adminPasswordInput = document.getElementById("adminPassword");
    const adminSubmitBtn = document.getElementById("adminSubmitBtn");
    const adminAlertBox = document.getElementById("adminAlertBox");

    const toggleSetupBtn = document.getElementById("toggleSetupBtn");
    const setupPanel = document.getElementById("setupFirstAdminPanel");
    const setupForm = document.getElementById("setupFirstAdminForm");
    const setupSubmitBtn = document.getElementById("setupSubmitBtn");

    function showAlert(message, type = "error") {
        if (!adminAlertBox) return;

        adminAlertBox.textContent = message;
        adminAlertBox.className = `admin-alert ${type}`;
        adminAlertBox.style.display = "block";
    }

    function hideAlert() {
        if (!adminAlertBox) return;

        adminAlertBox.textContent = "";
        adminAlertBox.className = "admin-alert";
        adminAlertBox.style.display = "none";
    }

    async function getResponseData(response) {
        try {
            return await response.json();
        } catch {
            throw new Error("The server returned an invalid response.");
        }
    }

    // Toggle first-admin setup panel
    if (toggleSetupBtn && setupPanel) {
        toggleSetupBtn.addEventListener("click", () => {
            setupPanel.classList.toggle("open");
        });
    }

    // Admin login
    if (adminLoginForm) {
        adminLoginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideAlert();

            const email = adminEmailInput.value.trim();
            const password = adminPasswordInput.value;

            if (!email || !password) {
                showAlert("Please enter both email and password.");
                return;
            }

            adminSubmitBtn.disabled = true;
            adminSubmitBtn.innerHTML = "Authenticating...";

            try {
                const response = await fetch(
                    `${API_BASE}/api/admin/login`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ email, password })
                    }
                );

                const data = await getResponseData(response);

                if (!response.ok || !data.success) {
                    showAlert(
                        data.message || "Invalid admin email or password."
                    );
                    return;
                }

                if (!data.token) {
                    showAlert("No authentication token received from server.");
                    return;
                }

                // Store admin authentication details
                localStorage.setItem("smartblog_admin_token", data.token);
                localStorage.setItem("smartblog_admin_user",
                    JSON.stringify(data.user || {})
                );

                showAlert(
                    "Login successful! Redirecting...",
                    "success"
                );

                // Redirect to Flask admin dashboard route
                window.location.href = `${API_BASE}/admin`;

            } catch (error) {
                console.error("Admin login error:", error);

                showAlert(
                    "Could not connect to the backend. Check that Flask is running."
                );
            } finally {
                adminSubmitBtn.disabled = false;
                adminSubmitBtn.innerHTML =
                    'Sign In to Console <span>→</span>';
            }
        });
    }

    // First administrator setup
    if (setupForm) {
        setupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideAlert();

            const name = document.getElementById("setupName").value.trim();
            const email = document.getElementById("setupEmail").value.trim();
            const password = document.getElementById("setupPassword").value;

            if (!name || !email || !password) {
                showAlert("All setup fields are required.");
                return;
            }

            if (password.length < 8) {
                showAlert("Password must contain at least 8 characters.");
                return;
            }

            setupSubmitBtn.disabled = true;
            setupSubmitBtn.textContent = "Initializing...";

            try {
                const response = await fetch(
                    `${API_BASE}/api/admin/setup-first-admin`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            name,
                            email,
                            password
                        })
                    }
                );

                const data = await getResponseData(response);

                if (!response.ok || !data.success) {
                    showAlert(
                        data.message || "Failed to initialize administrator."
                    );
                    return;
                }

                showAlert(
                    "Administrator created successfully! You can now log in.",
                    "success"
                );

                adminEmailInput.value = email;
                adminPasswordInput.value = "";
                adminPasswordInput.focus();

                if (setupPanel) {
                    setupPanel.classList.remove("open");
                }

                setupForm.reset();

            } catch (error) {
                console.error("Admin setup error:", error);

                showAlert(
                    "Could not connect to the backend. Check that Flask is running."
                );
            } finally {
                setupSubmitBtn.disabled = false;
                setupSubmitBtn.textContent =
                    "Initialize Administrator Account";
            }
        });
    }
});

