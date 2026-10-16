
/* ==========================================
   SMARTBLOG — TEMPLATE STUDIO
   Corrected to match create-blog.html
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    /* 1. SELECT HTML ELEMENTS */

    const templateGrid = document.getElementById("template-grid");
    const filterContainer = document.getElementById("template-filters");
    const searchInput = document.getElementById("template-search");
    const resultCount = document.getElementById("result-count");
    const emptyState = document.getElementById("empty-state");

    const blogForm = document.getElementById("blog-form");
    const titleInput = document.getElementById("blog-title");
    const subtitleInput = document.getElementById("blog-subtitle");
    const topicInput = document.getElementById("blog-topic");
    const coverInput = document.getElementById("cover-url");
    const contentInput = document.getElementById("blog-content");

    const previewTemplateName =
        document.getElementById("preview-template-name");
    const liveArticle = document.getElementById("live-article");
    const liveCover = document.getElementById("live-cover");
    const liveCoverLabel = document.getElementById("live-cover-label");
    const liveTopic = document.getElementById("live-topic");
    const liveTitle = document.getElementById("live-title");
    const liveSubtitle = document.getElementById("live-subtitle");
    const liveContent = document.getElementById("live-content");

    const wordCount = document.getElementById("word-count");
    const statusMessage = document.getElementById("status-message");

    const saveDraftButton = document.getElementById("save-draft");
    const previewButton = document.getElementById("preview-button");
    const previewPanel = document.getElementById("preview-panel");

    if (!templateGrid || !filterContainer) {
        console.error(
            "SmartBlog: template-grid or template-filters was not found."
        );
        return;
    }


    /* 2. TEMPLATE INFORMATION */

    const templateData = {
        scrapbook: {
            name: "Scrapbook Diary",
            category: "Pinterest",
            label: "LITTLE MEMORIES ✿",
            title: "bits of my world ✿",
            subtitle: "A collection of little moments.",
            cover: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1000&q=85"
        },

        polaroid: {
            name: "Polaroid Memories",
            category: "Pinterest",
            label: "PHOTO DIARY",
            title: "moments to keep.",
            subtitle: "Every picture tells a story.",
            cover: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1000&q=85"
        },

        vintage: {
            name: "Vintage Paper",
            category: "Pinterest",
            label: "ARCHIVE NO. 01",
            title: "dear diary...",
            subtitle: "Notes from another time.",
            cover: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1000&q=85"
        },

        coquette: {
            name: "Coquette",
            category: "Soft",
            label: "A LOVE LETTER TO LIFE",
            title: "with love, always ♡",
            subtitle: "Romanticising the little things.",
            cover: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1000&q=85"
        },

        cottage: {
            name: "Cottagecore",
            category: "Soft",
            label: "SLOW DAYS CLUB",
            title: "a softer kind of life.",
            subtitle: "Finding beauty in a slower life.",
            cover: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=85"
        },

        floral: {
            name: "Floral Journal",
            category: "Soft",
            label: "THE LITTLE THINGS",
            title: "bloom in your own time.",
            subtitle: "A little space to grow.",
            cover: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1000&q=85"
        },

        minimal: {
            name: "Minimal Editorial",
            category: "Editorial",
            label: "THE EDIT",
            title: "Less, but better.",
            subtitle: "Ideas worth sharing, without the noise.",
            cover: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85"
        },

        luxury: {
            name: "Luxury Magazine",
            category: "Editorial",
            label: "MAISON · EST. 2026",
            title: "The art of living.",
            subtitle: "Thoughtful perspectives on everyday life.",
            cover: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=85"
        },

        travel: {
            name: "Travel Journal",
            category: "Travel",
            label: "POSTCARDS FROM",
            title: "somewhere out there.",
            subtitle: "Places, people and stories from the road.",
            cover: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1000&q=85"
        },

        studio: {
            name: "Creative Studio",
            category: "Creative",
            label: "IN THE MAKING",
            title: "Ideas into something new.",
            subtitle: "Experiments, inspiration and discoveries.",
            cover: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1000&q=85"
        },

        developer: {
            name: "Developer Notes",
            category: "Professional",
            label: "BUILD / LEARN / SHARE",
            title: "Hello, world.",
            subtitle: "Lessons from building and learning.",
            cover: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=85"
        },

        knowledge: {
            name: "Knowledge Library",
            category: "Professional",
            label: "THE KNOWLEDGE DESK",
            title: "Ideas worth understanding.",
            subtitle: "Useful knowledge, clearly explained.",
            cover: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1000&q=85"
        }
    };


    /* 3. STATE */

    let selectedTemplate =
        templateGrid.querySelector(".template-card.selected")
            ?.dataset.template || "scrapbook";

    let activeCategory = "all";
    let searchTerm = "";

    let favorites = new Set();

    try {
        const savedFavorites = JSON.parse(
            localStorage.getItem("smartblog-template-favorites") || "[]"
        );

        if (Array.isArray(savedFavorites)) {
            favorites = new Set(savedFavorites);
        }
    } catch (error) {
        console.warn("Could not load template favorites.", error);
    }


    /* 4. HELPER FUNCTIONS */

    function getTemplate(id) {
        return templateData[id] || templateData.scrapbook;
    }

    function showStatus(message) {
        if (statusMessage) {
            statusMessage.textContent = message;
        }
    }

    function getValue(element) {
        return element ? element.value.trim() : "";
    }

    function safeStorageSet(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.error("SmartBlog storage error:", error);
            showStatus(
                "Could not save. Please check your browser storage settings."
            );
            return false;
        }
    }


    /* 5. FILTER TEMPLATES
       HTML uses data-filter, not data-category.
    */

    function filterTemplates() {
        const cards = templateGrid.querySelectorAll(".template-card");
        let visibleCount = 0;

        cards.forEach(card => {
            const id = card.dataset.template;
            const category = card.dataset.category ||
                getTemplate(id).category;

            const searchableText = [
                card.innerText,
                id,
                category
            ].join(" ").toLowerCase();

            const matchesCategory =
                activeCategory === "all" ||
                (
                    activeCategory === "Favorites"
                        ? favorites.has(id)
                        : category === activeCategory
                );

            const matchesSearch =
                searchableText.includes(searchTerm);

            const visible = matchesCategory && matchesSearch;

            card.hidden = !visible;

            if (visible) {
                visibleCount++;
            }

            card.classList.toggle(
                "selected",
                id === selectedTemplate
            );

            const favoriteButton = card.querySelector(".favorite");

            if (favoriteButton) {
                const isFavorite = favorites.has(id);

                favoriteButton.textContent =
                    isFavorite ? "♥" : "♡";

                favoriteButton.classList.toggle(
                    "active",
                    isFavorite
                );

                favoriteButton.setAttribute(
                    "aria-pressed",
                    String(isFavorite)
                );

                favoriteButton.setAttribute(
                    "role",
                    "button"
                );

                favoriteButton.setAttribute(
                    "tabindex",
                    "0"
                );
            }
        });

        if (resultCount) {
            resultCount.textContent =
                `${visibleCount} template${visibleCount === 1 ? "" : "s"}`;
        }

        if (emptyState) {
            emptyState.hidden = visibleCount > 0;
        }
    }


    /* 6. CATEGORY BUTTON CLICKS */

    filterContainer.addEventListener("click", event => {
        const button = event.target.closest(".filter");

        if (!button || !filterContainer.contains(button)) {
            return;
        }

        // IMPORTANT: read data-filter from your actual HTML.
        activeCategory = button.dataset.filter || "all";

        filterContainer.querySelectorAll(".filter").forEach(filter => {
            filter.classList.toggle("active", filter === button);
        });

        filterTemplates();
    });


    /* 7. SEARCH */

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            searchTerm = searchInput.value.trim().toLowerCase();
            filterTemplates();
        });
    }


    /* 8. FAVORITES */

    function toggleFavorite(id) {
        if (favorites.has(id)) {
            favorites.delete(id);
        } else {
            favorites.add(id);
        }

        if (!safeStorageSet(
            "smartblog-template-favorites",
            JSON.stringify([...favorites])
        )) {
            return;
        }

        filterTemplates();
        showStatus(
            favorites.has(id)
                ? "Added to favorites."
                : "Removed from favorites."
        );
    }


    /* 9. SELECT A TEMPLATE */

    function selectTemplate(id) {
        if (!templateData[id]) return;

        selectedTemplate = id;

        const template = getTemplate(id);

        // Apply the selected template's sample title and introduction.
        if (titleInput) {
            titleInput.value = template.title;
        }

        if (subtitleInput) {
            subtitleInput.value = template.subtitle;
        }

        // Match the template to a relevant existing topic option.
        if (topicInput) {
            const topicMap = {
                scrapbook: "Personal Stories",
                polaroid: "Personal Stories",
                vintage: "Personal Stories",
                coquette: "Lifestyle",
                cottage: "Lifestyle",
                floral: "Creativity",
                minimal: "Other",
                luxury: "Fashion",
                travel: "Travel",
                studio: "Creativity",
                developer: "Technology",
                knowledge: "Education"
            };

            topicInput.value = topicMap[id] || "Other";
        }

        // Clear any custom cover so the selected template's cover appears.
        if (coverInput) {
            coverInput.value = "";
        }

        filterTemplates();
        updatePreview();

        showStatus(`${template.name} selected.`);
    }


    /* 10. TEMPLATE CARD CLICKS */

    templateGrid.addEventListener("click", event => {
        const favoriteElement = event.target.closest(".favorite");

        if (favoriteElement) {
            event.preventDefault();
            event.stopPropagation();

            const card = favoriteElement.closest(".template-card");

            if (card) {
                toggleFavorite(card.dataset.template);
            }

            return;
        }

        const card = event.target.closest(".template-card");

        if (card && templateGrid.contains(card)) {
            selectTemplate(card.dataset.template);
        }
    });

    templateGrid.addEventListener("keydown", event => {
        const favoriteElement = event.target.closest(".favorite");

        if (
            favoriteElement &&
            (event.key === "Enter" || event.key === " ")
        ) {
            event.preventDefault();
            event.stopPropagation();

            const card = favoriteElement.closest(".template-card");

            if (card) {
                toggleFavorite(card.dataset.template);
            }
        }
    });


    /* 11. LIVE PREVIEW */

    function updatePreview() {
        const template = getTemplate(selectedTemplate);

        if (liveArticle) {
            liveArticle.className =
                `live-article ${selectedTemplate}`;
        }

        if (previewTemplateName) {
            previewTemplateName.textContent = template.name;
        }

        if (liveCoverLabel) {
            liveCoverLabel.textContent = template.label;
        }

        if (liveTitle) {
            liveTitle.textContent =
                getValue(titleInput) || "Your story starts here.";
        }

        if (liveSubtitle) {
            liveSubtitle.textContent =
                getValue(subtitleInput) ||
                "A little introduction to your next great idea.";
        }

        if (liveTopic) {
            liveTopic.textContent =
                (getValue(topicInput) || "Personal Stories").toUpperCase();
        }

        if (liveContent) {
            liveContent.textContent =
                getValue(contentInput) ||
                "Your writing will appear here as you type.";
        }

        if (liveCover) {
            const customCover = getValue(coverInput);
            const coverURL = customCover || template.cover;

            // Only accept HTTP(S) URLs for custom covers.
            let validURL = template.cover;

            try {
                const parsedURL = new URL(coverURL);

                if (
                    parsedURL.protocol === "https:" ||
                    parsedURL.protocol === "http:"
                ) {
                    validURL = parsedURL.href;
                }
            } catch (error) {
                // Keep the template's default cover.
            }

            liveCover.style.backgroundImage =
                `url("${validURL.replace(/["\\\n\r]/g, "")}")`;
        }

        updateWordCount();
    }


    /* 12. WORD COUNT */

    function updateWordCount() {
        if (!wordCount || !contentInput) return;

        const text = contentInput.value.trim();
        const count = text ? text.split(/\s+/).length : 0;

        wordCount.textContent =
            `${count} word${count === 1 ? "" : "s"}`;
    }


    /* 13. FORM INPUT EVENTS */

    [
        titleInput,
        subtitleInput,
        topicInput,
        coverInput,
        contentInput
    ].forEach(element => {
        if (element) {
            element.addEventListener("input", updatePreview);
            element.addEventListener("change", updatePreview);
        }
    });


    /* 14. DRAFT DATA */

    function getDraftData() {
        return {
            template: selectedTemplate,
            title: getValue(titleInput),
            subtitle: getValue(subtitleInput),
            topic: getValue(topicInput),
            cover: getValue(coverInput),
            content: contentInput ? contentInput.value : "",
            updatedAt: new Date().toISOString()
        };
    }


    /* 15. SAVE DRAFT */

    function saveDraft() {
        const saved = safeStorageSet(
            "smartblog-create-blog-draft",
            JSON.stringify(getDraftData())
        );

        if (saved) {
            showStatus("Draft saved in this browser.");
        }

        return saved;
    }

    if (saveDraftButton) {
        saveDraftButton.addEventListener("click", saveDraft);
    }


    /* 16. RESTORE SAVED DRAFT */

    function restoreDraft() {
        try {
            const saved = localStorage.getItem(
                "smartblog-create-blog-draft"
            );

            if (!saved) return;

            const draft = JSON.parse(saved);

            if (
                draft.template &&
                templateData[draft.template]
            ) {
                selectedTemplate = draft.template;
            }

            if (titleInput && draft.title !== undefined) {
                titleInput.value = draft.title;
            }

            if (subtitleInput && draft.subtitle !== undefined) {
                subtitleInput.value = draft.subtitle;
            }

            if (topicInput && draft.topic !== undefined) {
                topicInput.value = draft.topic;
            }

            if (coverInput && draft.cover !== undefined) {
                coverInput.value = draft.cover;
            }

            if (contentInput && draft.content !== undefined) {
                contentInput.value = draft.content;
            }

        } catch (error) {
            console.error("Could not restore the saved draft:", error);
        }
    }


    /* 17. SAVE & CONTINUE */

    if (blogForm) {
        blogForm.addEventListener("submit", event => {
            event.preventDefault();

            if (!blogForm.reportValidity()) {
                return;
            }

            if (saveDraft()) {
                showStatus(
                    "Your draft is saved! Publishing to the database " +
                    "is not connected yet."
                );
            }
        });
    }


    /* 18. VIEW PREVIEW BUTTON */

    if (previewButton) {
        previewButton.addEventListener("click", () => {
            updatePreview();

            if (previewPanel) {
                previewPanel.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        });
    }


    /* 19. START THE STUDIO */

    restoreDraft();

    // Ensure the selected template has a selected card.
    if (!templateGrid.querySelector(
        `.template-card[data-template="${selectedTemplate}"]`
    )) {
        selectedTemplate = "scrapbook";
    }

    filterTemplates();
    updatePreview();

    console.log("SmartBlog Template Studio loaded successfully.");

});




