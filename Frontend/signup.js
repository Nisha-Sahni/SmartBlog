
document.addEventListener("DOMContentLoaded", () => {

    const signupForm = document.getElementById("signupForm");

    if (!signupForm) {
        console.error("Signup form not found.");
        return;
    }

    signupForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("signupEmail").value.trim().toLowerCase();
        const password = document.getElementById("signupPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        const submitButton = signupForm.querySelector('button[type="submit"]');

        if (!name || !email || !password || !confirmPassword) {
            alert("Please fill in all fields.");
            return;
        }

        if (password.length < 8) {
            alert("Password must contain at least 8 characters.");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        submitButton.disabled = true;

        try {

            const response = await fetch("http://127.0.0.1:5000/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    password
                })
            });

            const result = await response.json();

            if (!response.ok) {
                alert(result.message || "Signup failed.");
                return;
            }

            // Confirm that the backend returned login credentials.
            if (!result.token || !result.user_id) {
                alert("Account created, but automatic login failed. Please log in.");
                window.location.href = "login.html";
                return;
            }

            // Clear any previous session.
            localStorage.removeItem("token");
            localStorage.removeItem("user");

            // Save the newly created user's session.
            localStorage.setItem("token", result.token);

            localStorage.setItem("user", JSON.stringify({
                user_id: result.user_id,
                name: result.name,
                email: result.email
            }));

            // Open dashboard directly.
            window.location.href = "dashboard.html";

        } catch (error) {

            console.error("Signup error:", error);

            alert("Could not connect to SmartBlog server. Please try again.");

        } finally {

            submitButton.disabled = false;

        }

    });

});

