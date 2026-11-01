
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");

    if (!loginForm) return;

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const submitButton = loginForm.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;

        try {
            const response = await fetch(
                "http://127.0.0.1:5000/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ email, password })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Login failed.");
                return;
            }

            if (!data.token || !data.user_id) {
                alert("Login response is incomplete. Please try again.");
                return;
            }

            // Store authentication token separately.
            localStorage.setItem("token", data.token);

            // Preserve the existing user storage structure.
            localStorage.setItem(
                "user",
                JSON.stringify({
                    user_id: data.user_id,
                    name: data.name,
                    email: data.email
                })
            );

            alert(data.message || "Login successful!");

            window.location.href = "dashboard.html";

        } catch (error) {
            console.error("Login error:", error);
            alert("Could not connect to SmartBlog server.");
        } finally {
            submitButton.disabled = false;
        }
    });
});
