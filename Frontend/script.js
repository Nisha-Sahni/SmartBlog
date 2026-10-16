
// MOBILE NAVIGATION
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("open");

        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.textContent = isOpen ? "✕" : "☰";
    });

    navLinks.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.textContent = "☰";
        });
    });
}


// CONTINUOUS STORY CAROUSEL
const storyTrack = document.getElementById("storyTrack");
const storySlider = document.getElementById("storySlider");
const storyPrev = document.getElementById("storyPrev");
const storyNext = document.getElementById("storyNext");

if (storyTrack && storySlider) {
    const originalCards = Array.from(storyTrack.children);

    // Duplicate the cards once to make a continuous loop.
    originalCards.forEach((card) => {
        const clone = card.cloneNode(true);

        clone.setAttribute("aria-hidden", "true");

        clone.querySelectorAll("a, button, input, select, textarea")
            .forEach((element) => {
                element.setAttribute("tabindex", "-1");
            });

        storyTrack.appendChild(clone);
    });

    // Measure the original group, including its gaps.
    function updateCarouselDistance() {
        const firstCard = originalCards[0];
        const lastCard = originalCards[originalCards.length - 1];

        if (!firstCard || !lastCard) return;

        const firstLeft = firstCard.getBoundingClientRect().left;
        const lastRight = lastCard.getBoundingClientRect().right;
        const originalWidth = lastRight - firstLeft;

        storyTrack.style.setProperty(
            "--carousel-distance",
            `-${originalWidth}px`
        );
    }

    updateCarouselDistance();
    window.addEventListener("resize", updateCarouselDistance);

    // Pause the automatic movement while interacting.
    storySlider.addEventListener("mouseenter", () => {
        storySlider.classList.add("is-paused");
    });

    storySlider.addEventListener("mouseleave", () => {
        storySlider.classList.remove("is-paused");
    });

    storySlider.addEventListener("focusin", () => {
        storySlider.classList.add("is-paused");
    });

    storySlider.addEventListener("focusout", (event) => {
        if (!storySlider.contains(event.relatedTarget)) {
            storySlider.classList.remove("is-paused");
        }
    });

    // Move cards manually with the arrow buttons.
    function moveStories(direction) {
        storySlider.classList.add("is-paused");

        const card = originalCards[0];
        if (!card) return;

        const cardWidth = card.getBoundingClientRect().width;
        const gap = parseFloat(getComputedStyle(storyTrack).gap) || 0;
        const distance = cardWidth + gap;

        const currentTransform = getComputedStyle(storyTrack).transform;
        const matrix = new DOMMatrixReadOnly(currentTransform);
        const currentX = matrix.m41;

        const originalGroupWidth =
            originalCards.reduce((total, item) => {
                return total + item.getBoundingClientRect().width;
            }, 0) + gap * (originalCards.length - 1);

        let nextX = currentX - direction * distance;

        // Keep the position within the duplicated carousel track.
        if (nextX <= -originalGroupWidth) {
            nextX += originalGroupWidth;
        }

        if (nextX > 0) {
            nextX -= originalGroupWidth;
        }

        storyTrack.style.animation = "none";
        storyTrack.style.transform = `translateX(${nextX}px)`;
    }

    if (storyPrev) {
        storyPrev.addEventListener("click", () => {
            moveStories(-1);
        });
    }

    if (storyNext) {
        storyNext.addEventListener("click", () => {
            moveStories(1);
        });
    }

    // Restore automatic movement when the user leaves the carousel.
    function resumeCarousel() {
        storyTrack.style.transform = "";
        storyTrack.style.animation = "";
        storySlider.classList.remove("is-paused");
    }

    storySlider.addEventListener("mouseleave", resumeCarousel);

    // Avoid movement for visitors who prefer reduced motion.
    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    );

    function applyMotionPreference() {
        if (reducedMotion.matches) {
            storyTrack.style.animation = "none";
            storyTrack.style.transform = "none";
        } else {
            storyTrack.style.animation = "";
            storyTrack.style.transform = "";
        }
    }

    applyMotionPreference();
    reducedMotion.addEventListener("change", applyMotionPreference);
}

