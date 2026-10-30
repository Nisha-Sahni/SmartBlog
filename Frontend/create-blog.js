/* 2A. ADDITIONAL BUILT-IN TEMPLATES */

const additionalTemplates = [
    ["pinterest-journal", "Pinterest Journal", "Pinterest"],
    ["travel-diary", "Travel Diary", "Travel"],
    ["soft-life", "Soft Life", "Soft"],
    ["creative-notes", "Creative Notes", "Creative"],
    ["modern-blog", "Modern Blog", "Editorial"],
    ["fashion-edit", "Fashion Edit", "Editorial"],
    ["food-stories", "Food Stories", "Creative"],
    ["wellness", "Wellness Journal", "Soft"],
    ["study-notes", "Study Notes", "Professional"],
    ["tech-insights", "Tech Insights", "Professional"],
    ["book-club", "Book Club", "Editorial"],
    ["art-journal", "Art Journal", "Creative"],
    ["summer-diary", "Summer Diary", "Pinterest"],
    ["daily-thoughts", "Daily Thoughts", "Soft"],
    ["film-journal", "Film Journal", "Editorial"],
    ["music-notes", "Music Notes", "Creative"],
    ["recipe-book", "Recipe Book", "Creative"],
    ["minimal-blog", "Minimal Blog", "Editorial"],
    ["nature-notes", "Nature Notes", "Travel"],
    ["city-guide", "City Guide", "Travel"],
    ["dream-journal", "Dream Journal", "Soft"],
    ["photography", "Photography Portfolio", "Creative"],
    ["personal-brand", "Personal Brand", "Professional"],
    ["startup-stories", "Startup Stories", "Professional"],
    ["academic", "Academic Journal", "Professional"],
    ["diary-pastel", "Pastel Diary", "Soft"],
    ["weekend-notes", "Weekend Notes", "Pinterest"],
    ["interior-design", "Interior Design", "Editorial"],
    ["beauty-blog", "Beauty Blog", "Soft"],
    ["wedding-journal", "Wedding Journal", "Pinterest"],
    ["adventure-log", "Adventure Log", "Travel"],
    ["coffee-journal", "Coffee Journal", "Pinterest"],
    ["mindful-living", "Mindful Living", "Soft"],
    ["business-insights", "Business Insights", "Professional"],
    ["science-journal", "Science Journal", "Professional"],
    ["history-notes", "History Notes", "Editorial"],
    ["gaming-blog", "Gaming Blog", "Creative"],
    ["movie-reviews", "Movie Reviews", "Editorial"],
    ["fashion-diary", "Fashion Diary", "Pinterest"],
    ["architecture", "Architecture Journal", "Editorial"]
];

const extraArtClasses = [
    "art-scrapbook", "art-coquette", "art-cottage",
    "art-minimal", "art-studio", "art-travel",
    "art-knowledge", "art-vintage"
];

additionalTemplates.forEach(([id, name, category], index) => {
    templateData[id] = {
        name,
        category,
        label: name.toUpperCase(),
        title: name,
        subtitle: `Welcome to my ${name.toLowerCase()}.`,
        cover: templateData[extraArtClasses[index % extraArtClasses.length]
            .replace("art-", "")]?.cover || templateData.scrapbook.cover,
        artClass: extraArtClasses[index % extraArtClasses.length]
    };
});

/* Add cards without changing the original 12 cards. */

additionalTemplates.forEach(([id, name, category], index) => {
    const artClass = extraArtClasses[index % extraArtClasses.length];

    const card = document.createElement("button");
    card.type = "button";
    card.className = "template-card";
    card.dataset.template = id;
    card.dataset.category = category;

    card.innerHTML = `
        <span class="template-art ${artClass}">
            <span class="art-label">${name.toUpperCase()}</span>
            <span class="art-title">${name}</span>
            <span class="art-foot">A SMARTBLOG TEMPLATE</span>
        </span>
        <span class="template-name">${name}</span>
        <span class="template-description">${category} · Blog design</span>
        <span class="favorite" aria-label="Toggle favorite">♡</span>
    `;

    templateGrid.appendChild(card);
});