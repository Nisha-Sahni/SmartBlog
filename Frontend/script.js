// =========================================================
// SMARTBLOG — GLOBAL JAVASCRIPT
// =========================================================

document.addEventListener("DOMContentLoaded", function () {

    // -----------------------------------------------------
    // QUESTION TOPIC BUTTONS
    // -----------------------------------------------------

    const topicButtons = document.querySelectorAll(".question-topic");

    topicButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            topicButtons.forEach(function (btn) {
                btn.classList.remove("active");
            });

            button.classList.add("active");

        });

    });


    // -----------------------------------------------------
    // ASK QUESTION FORM
    // -----------------------------------------------------

    const questionForm = document.querySelector(".question-form");

    if (questionForm) {

        questionForm.addEventListener("submit", function (event) {

            event.preventDefault();

            const title = document.querySelector("#question-title");
            const description = document.querySelector("#question-description");
            const topic = document.querySelector("#question-topic");

            if (!title || !description || !topic) {
                return;
            }

            if (
                title.value.trim() === "" ||
                description.value.trim() === "" ||
                topic.value === ""
            ) {
                alert("Please fill in all required fields.");
                return;
            }

            alert("Question submitted successfully!");

            questionForm.reset();

        });

    }


    // -----------------------------------------------------
    // CREATE BLOG FORM
    // -----------------------------------------------------

    const blogForm = document.querySelector(".blog-form");

    if (blogForm) {

        blogForm.addEventListener("submit", function (event) {

            event.preventDefault();

            const title = document.querySelector("#blog-title");
            const category = document.querySelector("#blog-category");
            const content = document.querySelector("#blog-content");

            if (!title || !category || !content) {
                return;
            }

            if (
                title.value.trim() === "" ||
                category.value === "" ||
                content.value.trim() === ""
            ) {
                alert("Please complete the required fields.");
                return;
            }

            alert("Blog published successfully!");

            blogForm.reset();

        });

    }


    // -----------------------------------------------------
    // SAVE DRAFT
    // -----------------------------------------------------

    const saveDraftButton = document.querySelector(".save-draft-btn");

    if (saveDraftButton) {

        saveDraftButton.addEventListener("click", function () {

            const title = document.querySelector("#blog-title");

            if (!title || title.value.trim() === "") {
                alert("Please enter a blog title before saving.");
                return;
            }

            alert("Draft saved successfully!");

        });

    }


    // -----------------------------------------------------
    // EDIT PROFILE BUTTON
    // -----------------------------------------------------

    const editProfileButton =
        document.querySelector(".edit-profile-btn");

    if (editProfileButton) {

        editProfileButton.addEventListener("click", function () {

            alert("Profile editing will be available soon.");

        });

    }


    // -----------------------------------------------------
    // SETTINGS TOGGLES
    // -----------------------------------------------------

    const toggles = document.querySelectorAll(".toggle input");

    toggles.forEach(function (toggle) {

        toggle.addEventListener("change", function () {

            if (toggle.checked) {
                console.log("Setting enabled");
            } else {
                console.log("Setting disabled");
            }

        });

    });


});


    