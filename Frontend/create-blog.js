
/* ==========================================
   SMARTBLOG — CREATE A STORY
   60 templates + live editor + MySQL publishing
========================================== */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector) => document.querySelector(selector);

  // ELEMENTS
  const templateGrid = $("#template-grid");
  const templateSearch = $("#template-search");
  const filterContainer = $("#template-filters");
  const resultCount = $("#result-count");
  const emptyState = $("#empty-state");

  const blogForm = $("#blog-form");
  const titleInput = $("#blog-title");
  const subtitleInput = $("#blog-subtitle");
  const topicInput = $("#blog-topic");
  const coverInput = $("#cover-url");
  const contentInput = $("#blog-content");
  const wordCount = $("#word-count");

  const previewName = $("#preview-template-name");
  const liveArticle = $("#live-article");
  const liveCover = $("#live-cover");
  const liveCoverLabel = $("#live-cover-label");
  const liveTopic = $("#live-topic");
  const liveTitle = $("#live-title");
  const liveSubtitle = $("#live-subtitle");
  const liveContent = $("#live-content");

  const previewButton = $("#preview-button");
  const saveDraftButton = $("#save-draft");
  const statusMessage = $("#status-message");

  if (!templateGrid || !blogForm) {
    console.error("Create Blog: required HTML elements were not found.");
    return;
  }

  // STORAGE KEYS
  const FAVORITES_KEY = "smartblog_template_favorites";
  const DRAFT_KEY = "smartblog_draft";
  const SELECTED_KEY = "smartblog_selected_template_v1";
  const CUSTOM_KEY = "smartblog_custom_templates_v1";

  const API_BASE_URL = "http://127.0.0.1:5000";
  const INITIAL_TEMPLATE_COUNT = 12;

  let activeFilter = "all";
  let showAllTemplates = false;
  let selectedTemplateId = "scrapbook";

  let favorites = readStorage(FAVORITES_KEY, []);
  if (!Array.isArray(favorites)) favorites = [];

  const templateData = {};

  // HELPERS
  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn(`Could not read ${key}:`, error);
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Could not save ${key}:`, error);
      showStatus("Could not save. Check your browser storage.");
      return false;
    }
  }

  function showStatus(message) {
    if (statusMessage) {
      statusMessage.textContent = message;
    }
  }

  function getImageUrl(id) {
    return id
      ? `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=85`
      : "";
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // REGISTER THE 12 HTML TEMPLATES
  const originalCards = [
    ...templateGrid.querySelectorAll(".template-card")
  ];

  originalCards.forEach((card) => {
    const id = card.dataset.template;
    const art = card.querySelector(".template-art");
    const name = card.querySelector(".template-name");
    const description = card.querySelector(".template-description");
    const label = card.querySelector(".art-label");
    const title = card.querySelector(".art-title");
    const foot = card.querySelector(".art-foot");

    if (!id) return;

    const artClass = [...(art?.classList || [])].find((className) =>
      className.startsWith("art-")
    );

    templateData[id] = {
      id,
      name: name?.textContent.trim() || id,
      category: card.dataset.category || "Editorial",
      description: description?.textContent.trim() || "",
      label: label?.textContent.trim() || "A SMARTBLOG STORY",
      title: title?.innerHTML || "Your story",
      foot: foot?.textContent.trim() || "MADE WITH SMARTBLOG",
      artClass: artClass || "art-minimal",
      type: "css",
      cover: ""
    };
  });

  // ADDITIONAL 48 TEMPLATES
  const galleryTemplates = [
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
    ["architecture", "Architecture Journal", "Editorial"],

    ["photo-travel", "Travel Photography", "Travel", "photo"],
    ["photo-food", "Food Photography", "Creative", "photo"],
    ["photo-fashion", "Fashion Photography", "Editorial", "photo"],
    ["photo-nature", "Nature Photography", "Travel", "photo"],

    ["hybrid-editorial", "Editorial Stories", "Editorial", "hybrid"],
    ["hybrid-lifestyle", "Lifestyle Stories", "Soft", "hybrid"],
    ["hybrid-creative", "Creative Portfolio", "Creative", "hybrid"],
    ["hybrid-travel", "Travel Features", "Travel", "hybrid"]
  ];

  const galleryArtClasses = [
    "art-scrapbook",
    "art-coquette",
    "art-cottage",
    "art-minimal",
    "art-studio",
    "art-travel",
    "art-knowledge",
    "art-vintage"
  ];

  const imageIds = {
    "photo-travel": "photo-1500530855697-b586d89ba3ee",
    "photo-food": "photo-1517248135467-4c7edcad34c4",
    "photo-fashion": "photo-1515886657613-9f3515b0c78f",
    "photo-nature": "photo-1470252649378-9c29740c9fa8",
    "hybrid-editorial": "photo-1490481651871-ab68de25d43d",
    "hybrid-lifestyle": "photo-1490750967868-88aa4486c946",
    "hybrid-creative": "photo-1494438639946-1ebd1d20bf85",
    "hybrid-travel": "photo-1518837695005-2083093ee35b"
  };

  function createGalleryCard(item, index) {
    const [id, name, category, type = "css"] = item;
    const artClass = galleryArtClasses[index % galleryArtClasses.length];

    const data = {
      id,
      name,
      category,
      description: `${category} · ${name}`,
      label: name.toUpperCase(),
      title: escapeHTML(name),
      foot: "A SMARTBLOG TEMPLATE",
      artClass,
      type,
      cover: getImageUrl(imageIds[id])
    };

    templateData[id] = data;

    const card = document.createElement("button");
    card.type = "button";
    card.className = "template-card";
    card.dataset.template = id;
    card.dataset.category = category;
    card.dataset.extraTemplate = "true";

    const art = document.createElement("span");
    art.className = `template-art ${artClass}`;

    if (data.cover) {
      art.style.backgroundImage =
        `linear-gradient(#00000020,#00000045),url("${data.cover}")`;
      art.style.backgroundSize = "cover";
      art.style.backgroundPosition = "center";
      art.style.color = "#fff";
    }

    art.innerHTML = `
      <span class="art-label">${escapeHTML(data.label)}</span>
      <span class="art-title">${data.title}</span>
      <span class="art-foot">${escapeHTML(data.foot)}</span>
    `;

    const templateName = document.createElement("span");
    templateName.className = "template-name";
    templateName.textContent = name;

    const description = document.createElement("span");
    description.className = "template-description";
    description.textContent = data.description;

    const favorite = document.createElement("span");
    favorite.className = "favorite";
    favorite.setAttribute("aria-label", "Toggle favorite");
    favorite.setAttribute("aria-hidden", "true");
    favorite.textContent = "♡";

    card.append(art, templateName, description, favorite);
    return card;
  }

  galleryTemplates.forEach((item, index) => {
    templateGrid.appendChild(createGalleryCard(item, index));
  });

  // OPTIONAL CUSTOM TEMPLATES
  const customTemplates = readStorage(CUSTOM_KEY, []);

  if (Array.isArray(customTemplates)) {
    customTemplates.forEach((item) => {
      if (!item || !item.id || !item.name || templateData[item.id]) return;

      const data = {
        id: item.id,
        name: item.name,
        category: item.category || "Creative",
        description: item.description || "Custom template",
        label: item.label || item.name.toUpperCase(),
        title: escapeHTML(item.title || item.name),
        foot: item.foot || "MADE WITH SMARTBLOG",
        artClass: item.artClass || "art-minimal",
        type: "custom",
        cover: item.cover || ""
      };

      templateData[data.id] = data;

      const card = document.createElement("button");
      card.type = "button";
      card.className = "template-card";
      card.dataset.template = data.id;
      card.dataset.category = data.category;

      card.innerHTML = `
        <span class="template-art ${data.artClass}">
          <span class="art-label">${escapeHTML(data.label)}</span>
          <span class="art-title">${data.title}</span>
          <span class="art-foot">${escapeHTML(data.foot)}</span>
        </span>
        <span class="template-name">${escapeHTML(data.name)}</span>
        <span class="template-description">${escapeHTML(data.description)}</span>
        <span class="favorite" aria-label="Toggle favorite" aria-hidden="true">♡</span>
      `;

      templateGrid.appendChild(card);
    });
  }

  // SHOW MORE BUTTON
  let showMoreButton = $("#show-more-templates");

  if (!showMoreButton) {
    showMoreButton = document.createElement("button");
    showMoreButton.id = "show-more-templates";
    showMoreButton.type = "button";
    showMoreButton.className = "show-more-templates";
    showMoreButton.setAttribute("aria-expanded", "false");
    showMoreButton.textContent = "Show all templates ↓";

    const wrapper = document.createElement("div");
    wrapper.className = "template-more-wrap";
    wrapper.appendChild(showMoreButton);
    templateGrid.insertAdjacentElement("afterend", wrapper);
  }

  // FAVORITES
  function updateFavoriteAppearance() {
    templateGrid.querySelectorAll(".template-card").forEach((card) => {
      const favorite = card.querySelector(".favorite");
      if (!favorite) return;

      const isFavorite = favorites.includes(card.dataset.template);
      favorite.classList.toggle("active", isFavorite);
      favorite.textContent = isFavorite ? "♥" : "♡";
      favorite.setAttribute(
        "aria-label",
        isFavorite ? "Remove from favorites" : "Add to favorites"
      );
    });
  }

  function toggleFavorite(id) {
    if (favorites.includes(id)) {
      favorites = favorites.filter((item) => item !== id);
    } else {
      favorites.push(id);
    }

    writeStorage(FAVORITES_KEY, favorites);
    updateFavoriteAppearance();
    renderTemplates();
  }

  // TEMPLATE FILTERING AND SEARCH
  function renderTemplates() {
    const cards = [
      ...templateGrid.querySelectorAll(".template-card")
    ];

    const query = (templateSearch?.value || "").trim().toLowerCase();

    const matchingCards = cards.filter((card) => {
      const id = card.dataset.template;
      const data = templateData[id];

      if (!data) return false;

      const matchesSearch = [
        data.name,
        data.category,
        data.description,
        data.label,
        data.title
      ].join(" ").toLowerCase().includes(query);

      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "Favorites"
          ? favorites.includes(id)
          : data.category === activeFilter);

      return matchesSearch && matchesFilter;
    });

    const isFiltering = query.length > 0 || activeFilter !== "all";

    const visibleCards = (showAllTemplates || isFiltering)
      ? matchingCards
      : matchingCards.slice(0, INITIAL_TEMPLATE_COUNT);

    cards.forEach((card) => {
      card.hidden = !visibleCards.includes(card);
    });

    if (resultCount) {
      resultCount.textContent =
        `${matchingCards.length} template${matchingCards.length === 1 ? "" : "s"}`;
    }

    if (emptyState) {
      emptyState.hidden = matchingCards.length !== 0;
    }

    showMoreButton.hidden =
      isFiltering || matchingCards.length <= INITIAL_TEMPLATE_COUNT;

    if (showAllTemplates) {
      showMoreButton.textContent = "Show less ↑";
      showMoreButton.setAttribute("aria-expanded", "true");
    } else {
      showMoreButton.textContent =
        `Show all ${matchingCards.length} templates ↓`;
      showMoreButton.setAttribute("aria-expanded", "false");
    }
  }

  if (templateSearch) {
    templateSearch.addEventListener("input", renderTemplates);
  }

  if (filterContainer) {
    filterContainer.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;

      activeFilter = button.dataset.filter;

      filterContainer.querySelectorAll(".filter").forEach((filter) => {
        filter.classList.toggle("active", filter === button);
        filter.setAttribute(
          "aria-pressed",
          filter === button ? "true" : "false"
        );
      });

      renderTemplates();
    });
  }

  showMoreButton.addEventListener("click", () => {
    showAllTemplates = !showAllTemplates;
    renderTemplates();

    if (!showAllTemplates) {
      document.querySelector(".studio")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });

  // SELECT TEMPLATE
  function selectTemplate(id) {
    const data = templateData[id];
    if (!data) return;

    selectedTemplateId = id;
    writeStorage(SELECTED_KEY, id);

    templateGrid.querySelectorAll(".template-card").forEach((card) => {
      card.classList.toggle("selected", card.dataset.template === id);
    });

    if (previewName) previewName.textContent = data.name;

    if (liveArticle) {
      const themeClasses = [
        "scrapbook", "polaroid", "vintage", "coquette",
        "cottage", "floral", "minimal", "luxury",
        "travel", "studio", "developer", "knowledge",
        "photo-template", "hybrid-template"
      ];

      liveArticle.classList.remove(...themeClasses);

      const theme = data.type === "photo"
        ? "photo-template"
        : data.type === "hybrid"
          ? "hybrid-template"
          : data.artClass.replace("art-", "");

      liveArticle.classList.add(theme);
    }

    if (liveCoverLabel) {
      liveCoverLabel.textContent = data.label;
    }

    updatePreview();
    showStatus(`${data.name} selected.`);
  }

  // LIVE PREVIEW
  function updatePreview() {
    const data = templateData[selectedTemplateId] || templateData.scrapbook;

    const title = titleInput?.value.trim() || "Your story starts here.";
    const subtitle = subtitleInput?.value.trim() ||
      "A little introduction to your next great idea.";
    const topic = topicInput?.value || "Personal Stories";
    const content = contentInput?.value.trim() ||
      "Your writing will appear here as you type.";

    if (liveTitle) liveTitle.textContent = title;
    if (liveSubtitle) liveSubtitle.textContent = subtitle;
    if (liveTopic) liveTopic.textContent = topic.toUpperCase();
    if (liveContent) liveContent.textContent = content;

    if (liveCoverLabel) {
      liveCoverLabel.textContent =
        title === "Your story starts here."
          ? data.label
          : title.toUpperCase();
    }

    const customCover = coverInput?.value.trim();
    const cover = customCover || data.cover || "";

    if (liveCover) {
      liveCover.style.backgroundImage = cover
        ? `url("${cover.replace(/["\\]/g, "")}")`
        : "none";
    }

    updateWordCount();
  }

  function updateWordCount() {
    if (!wordCount || !contentInput) return;

    const text = contentInput.value.trim();
    const count = text ? text.split(/\s+/).length : 0;

    wordCount.textContent =
      `${count} word${count === 1 ? "" : "s"}`;
  }

  [
    titleInput,
    subtitleInput,
    topicInput,
    coverInput,
    contentInput
  ].forEach((input) => {
    input?.addEventListener("input", updatePreview);
    input?.addEventListener("change", updatePreview);
  });

  // TEMPLATE GRID INTERACTIONS
  templateGrid.addEventListener("click", (event) => {
    const favorite = event.target.closest(".favorite");

    if (favorite) {
      event.preventDefault();
      event.stopPropagation();

      const card = favorite.closest(".template-card");
      if (card) toggleFavorite(card.dataset.template);
      return;
    }

    const card = event.target.closest(".template-card");
    if (card) selectTemplate(card.dataset.template);
  });

  // DRAFT MANAGEMENT
  function getDraftData() {
    return {
      title: titleInput?.value || "",
      subtitle: subtitleInput?.value || "",
      topic: topicInput?.value || "Personal Stories",
      cover: coverInput?.value || "",
      content: contentInput?.value || "",
      template: selectedTemplateId,
      updatedAt: new Date().toISOString()
    };
  }

  let currentDraftId = null;
  const myDraftsBtn = $("#my-drafts-btn");
  const draftsModal = $("#draftsModal");
  const closeDraftsModal = $("#closeDraftsModal");
  const closeDraftsBtn = $("#closeDraftsBtn");
  const draftsListContainer = $("#draftsListContainer");
  const draftsEmptyState = $("#draftsEmptyState");
  const draftCountSpan = $("#draft-count");

  // COVER IMAGE REAL-TIME PREVIEW
  const coverPreviewWrapper = $("#cover-preview-wrapper");
  const coverUrlThumbnail = $("#cover-url-thumbnail");
  const coverUrlStatus = $("#cover-url-status");

  function handleCoverInputChange() {
    const url = (coverInput?.value || "").trim();
    if (!url) {
      if (coverPreviewWrapper) coverPreviewWrapper.style.display = "none";
      const tpl = templateData[selectedTemplateId];
      if (liveCover && tpl) {
        liveCover.src = getImageUrl(tpl.image);
      }
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      if (coverPreviewWrapper) {
        coverPreviewWrapper.style.display = "flex";
        if (coverUrlStatus) {
          coverUrlStatus.textContent = "⚠️ Please enter a full http:// or https:// URL";
          coverUrlStatus.style.color = "#c0392b";
        }
      }
      return;
    }

    const testImg = new Image();
    testImg.onload = () => {
      if (coverPreviewWrapper) coverPreviewWrapper.style.display = "flex";
      if (coverUrlThumbnail) coverUrlThumbnail.src = url;
      if (coverUrlStatus) {
        coverUrlStatus.textContent = "✓ Image loaded successfully";
        coverUrlStatus.style.color = "#2e5927";
      }
      if (liveCover) liveCover.src = url;
    };
    testImg.onerror = () => {
      if (coverPreviewWrapper) coverPreviewWrapper.style.display = "flex";
      if (coverUrlStatus) {
        coverUrlStatus.textContent = "⚠️ Could not load image (check URL)";
        coverUrlStatus.style.color = "#c0392b";
      }
    };
    testImg.src = url;
  }

  coverInput?.addEventListener("input", handleCoverInputChange);
  coverInput?.addEventListener("change", handleCoverInputChange);

  // DRAFTS BACKEND & LOCAL STORAGE MANAGEMENT
  async function refreshDraftCount() {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/drafts`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const count = (data.drafts || []).length;
        if (draftCountSpan) draftCountSpan.textContent = count;
      }
    } catch (_) {}
  }

  async function saveDraft(manual = true) {
    const token = localStorage.getItem("token");
    const draftData = {
      draft_id: currentDraftId,
      title: titleInput?.value.trim() || "",
      subtitle: subtitleInput?.value.trim() || "",
      topic: topicInput?.value || "Personal Stories",
      cover_url: coverInput?.value.trim() || "",
      content: contentInput?.value || "",
      template_id: selectedTemplateId
    };

    // Cache locally as secondary storage
    writeStorage(DRAFT_KEY, { ...draftData, updatedAt: new Date().toISOString() });

    if (!token) {
      if (manual) showStatus("Draft saved locally in this browser.");
      return;
    }

    try {
      if (manual) showStatus("Saving draft to SmartBlog cloud...");
      const res = await fetch(`${API_BASE_URL}/drafts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(draftData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        currentDraftId = data.draft_id;
        if (manual) {
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          showStatus(`✓ Draft saved to cloud at ${time}`);
        }
        refreshDraftCount();
      } else {
        if (manual) showStatus("Draft saved locally. (Server note: " + (data.message || "sync error") + ")");
      }
    } catch (err) {
      console.warn("Cloud draft save error:", err);
      if (manual) showStatus("Draft saved locally.");
    }
  }

  function loadDraft() {
    const draft = readStorage(DRAFT_KEY, null);

    if (!draft || typeof draft !== "object") return;

    if (titleInput) titleInput.value = draft.title || "";
    if (subtitleInput) subtitleInput.value = draft.subtitle || "";
    if (topicInput) {
      topicInput.value = draft.topic || "Personal Stories";
    }
    if (coverInput) {
      coverInput.value = draft.cover_url || draft.cover || "";
      handleCoverInputChange();
    }
    if (contentInput) contentInput.value = draft.content || "";

    if (draft.template_id || draft.template) {
      const tid = draft.template_id || draft.template;
      if (templateData[tid]) {
        selectedTemplateId = tid;
      }
    }
    refreshDraftCount();
  }

  async function openDraftsModal() {
    const token = localStorage.getItem("token");
    if (!token) {
      showStatus("Please log in to view saved drafts.");
      return;
    }
    if (draftsModal) draftsModal.hidden = false;
    if (draftsListContainer) {
      draftsListContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">Loading saved drafts...</div>';
    }

    try {
      const res = await fetch(`${API_BASE_URL}/drafts`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      const drafts = data.drafts || [];
      if (draftCountSpan) draftCountSpan.textContent = drafts.length;

      if (!drafts.length) {
        if (draftsListContainer) draftsListContainer.innerHTML = "";
        if (draftsEmptyState) draftsEmptyState.style.display = "block";
        return;
      }

      if (draftsEmptyState) draftsEmptyState.style.display = "none";
      if (draftsListContainer) {
        draftsListContainer.innerHTML = drafts.map(d => `
          <div class="draft-card-item" data-draft-id="${d.draft_id}">
            <div class="draft-info">
              <h4>${escapeHTML(d.title || "Untitled Draft")}</h4>
              <p>
                <strong>${escapeHTML(d.topic || "Story")}</strong> •
                Template: <em>${escapeHTML(d.template_id || "scrapbook")}</em> •
                ${d.updated_at ? new Date(d.updated_at).toLocaleDateString() : "Recent"}
              </p>
            </div>
            <div class="draft-actions">
              <button type="button" class="draft-action-btn primary load-draft-btn" data-id="${d.draft_id}">Load &amp; Edit</button>
              <button type="button" class="draft-action-btn danger delete-draft-btn" data-id="${d.draft_id}">Delete</button>
            </div>
          </div>
        `).join("");

        // Attach event handlers
        draftsListContainer.querySelectorAll(".load-draft-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            const id = parseInt(btn.dataset.id, 10);
            const found = drafts.find(d => d.draft_id === id);
            if (found) loadDraftItem(found);
          });
        });

        draftsListContainer.querySelectorAll(".delete-draft-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            const id = parseInt(btn.dataset.id, 10);
            if (confirm("Are you sure you want to delete this draft?")) {
              deleteDraftItem(id);
            }
          });
        });
      }
    } catch (err) {
      console.error("Could not load drafts:", err);
      if (draftsListContainer) {
        draftsListContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">Failed to load drafts from server.</div>';
      }
    }
  }

  function loadDraftItem(draft) {
    currentDraftId = draft.draft_id;
    if (titleInput) titleInput.value = draft.title || "";
    if (subtitleInput) subtitleInput.value = draft.subtitle || "";
    if (topicInput) topicInput.value = draft.topic || "Personal Stories";
    if (coverInput) {
      coverInput.value = draft.cover_url || "";
      handleCoverInputChange();
    }
    if (contentInput) contentInput.value = draft.content || "";

    if (draft.template_id && templateData[draft.template_id]) {
      selectTemplate(draft.template_id);
    }
    updatePreview();
    if (draftsModal) draftsModal.hidden = true;
    showStatus(`✓ Loaded draft "${draft.title || 'Untitled'}"`);
  }

  async function deleteDraftItem(draftId) {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/drafts/${draftId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        if (currentDraftId === draftId) currentDraftId = null;
        openDraftsModal();
        refreshDraftCount();
      }
    } catch (err) {
      alert("Could not delete draft.");
    }
  }

  saveDraftButton?.addEventListener("click", () => saveDraft(true));
  myDraftsBtn?.addEventListener("click", openDraftsModal);
  closeDraftsModal?.addEventListener("click", () => { if (draftsModal) draftsModal.hidden = true; });
  closeDraftsBtn?.addEventListener("click", () => { if (draftsModal) draftsModal.hidden = true; });
  refreshDraftCount();

  // PREVIEW BUTTON
  previewButton?.addEventListener("click", () => {
    updatePreview();

    $("#preview-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  // PUBLISH STORY TO FLASK + MYSQL
  blogForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!blogForm.reportValidity()) return;

    const token = localStorage.getItem("token");

    if (!token) {
      showStatus("Please log in again before publishing.");
      return;
    }

    const activeTpl = templateData[selectedTemplateId];
    const defaultCover = activeTpl ? getImageUrl(activeTpl.image) : "";

    const blogData = {
      draft_id: currentDraftId,
      title: titleInput?.value.trim() || "",
      subtitle: subtitleInput?.value.trim() || "",
      topic: topicInput?.value || "Personal Stories",
      cover_url: coverInput?.value.trim() || defaultCover,
      content: contentInput?.value.trim() || "",
      template_id: selectedTemplateId
    };

    if (!blogData.title || !blogData.content) {
      showStatus("Please enter a title and story content.");
      return;
    }

    const publishButton = blogForm.querySelector(
      'button[type="submit"]'
    );

    const originalText = publishButton?.textContent;

    try {
      if (publishButton) {
        publishButton.disabled = true;
        publishButton.textContent = "Publishing...";
      }

      showStatus("Publishing your story...");

      const response = await fetch(`${API_BASE_URL}/blogs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(blogData)
      });

      let result;

      try {
        result = await response.json();
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok || !result.success) {
        if (response.status === 401) {
          throw new Error("Your login session has expired. Please log in again.");
        }

        throw new Error(
          result.message || "Could not publish your story."
        );
      }

      // Remove the local draft only after successful publishing.
      localStorage.removeItem(DRAFT_KEY);

      showStatus(
        `Your story was published successfully! Blog ID: ${result.blog.blog_id}`
      );

      console.log("Published blog:", result.blog);

    } catch (error) {
      console.error("Publishing error:", error);

      showStatus(
        error.message || "Publishing failed. Please try again."
      );

    } finally {
      if (publishButton) {
        publishButton.disabled = false;
        publishButton.textContent = originalText;
      }
    }
  });

  // RESTORE PREVIOUS SELECTION
  const storedSelection = localStorage.getItem(SELECTED_KEY);

  if (storedSelection && templateData[storedSelection]) {
    selectedTemplateId = storedSelection;
  }

  // ==========================================
  // LIGHT AI WRITING ASSISTANT
  // ==========================================
  const aiAssistantCard = document.getElementById("aiAssistantCard");
  const aiImproveBtn = document.getElementById("aiImproveBtn");
  const aiContinueBtn = document.getElementById("aiContinueBtn");
  const aiSubtitleBtn = document.getElementById("aiSubtitleBtn");
  const aiIdeasBtn = document.getElementById("aiIdeasBtn");

  const aiSuggestionBox = document.getElementById("aiSuggestionBox");
  const aiSuggestionTitle = document.getElementById("aiSuggestionTitle");
  const aiSuggestionBody = document.getElementById("aiSuggestionBody");
  const aiSuggestionActions = document.getElementById("aiSuggestionActions");
  const aiCloseBtn = document.getElementById("aiCloseBtn");
  const aiCopyBtn = document.getElementById("aiCopyBtn");
  const aiInsertBtn = document.getElementById("aiInsertBtn");
  const aiApplyBtn = document.getElementById("aiApplyBtn");
  const aiStatusLabel = document.getElementById("aiStatusLabel");

  let currentAiAction = null;
  let currentAiResult = null;
  let currentSelectionRange = null;

  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getSelectedOrFullContent() {
    const start = contentInput.selectionStart;
    const end = contentInput.selectionEnd;
    const full = contentInput.value || "";
    if (start !== undefined && end !== undefined && start !== end) {
      currentSelectionRange = { start, end };
      return full.substring(start, end);
    }
    currentSelectionRange = null;
    return full;
  }

  async function callAiAssist(action) {
    const token = window.SmartBlogAuth ? window.SmartBlogAuth.getToken() : localStorage.getItem("token");
    if (!token) {
      showStatus("Please log in to use the AI Writing Assistant.");
      return;
    }

    const title = titleInput?.value || "";
    const content = contentInput?.value || "";
    const topic = topicInput?.value || "General";
    const selectedText = getSelectedOrFullContent();

    // Set loading state
    if (aiStatusLabel) aiStatusLabel.textContent = "Analyzing with AI...";
    [aiImproveBtn, aiContinueBtn, aiSubtitleBtn, aiIdeasBtn].forEach(b => { if (b) b.disabled = true; });

    try {
      const response = await fetch(`${API_BASE_URL}/ai/assist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          title,
          content,
          topic,
          text: selectedText
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "AI assistance failed.");
      }

      currentAiAction = action;
      currentAiResult = data;
      renderAiSuggestion(action, data);
      if (aiStatusLabel) aiStatusLabel.textContent = "Suggestion ready";

    } catch (err) {
      console.error("AI Assist error:", err);
      if (aiStatusLabel) aiStatusLabel.textContent = "AI request failed";
      showStatus(err.message || "AI assistance encountered an error.");
    } finally {
      [aiImproveBtn, aiContinueBtn, aiSubtitleBtn, aiIdeasBtn].forEach(b => { if (b) b.disabled = false; });
    }
  }

  function renderAiSuggestion(action, data) {
    if (!aiSuggestionBox || !aiSuggestionBody) return;

    aiSuggestionBox.hidden = false;
    aiSuggestionBody.innerHTML = "";

    if (action === "improve") {
      aiSuggestionTitle.textContent = "✨ Improved Writing";
      const improvementsHtml = (data.improvements || [])
        .map(imp => `<li style="margin-bottom: 2px;">• ${escapeHTML(imp)}</li>`)
        .join("");
      aiSuggestionBody.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 6px; color: var(--ink);">Polished version:</div>
        <div style="padding: 10px; background: #ffffff; border: 1px solid var(--line); border-radius: 6px; margin-bottom: 8px;">
          ${escapeHTML(data.improved_text)}
        </div>
        ${improvementsHtml ? `<div style="font-size: 11px; color: var(--muted);"><ul style="list-style:none; padding-left:0; margin:0;">${improvementsHtml}</ul></div>` : ""}
      `;
      aiApplyBtn.textContent = currentSelectionRange ? "✓ Replace selection" : "✓ Replace story text";
      aiApplyBtn.hidden = false;
      aiInsertBtn.hidden = false;

    } else if (action === "continue") {
      aiSuggestionTitle.textContent = "✍️ Contextual Continuation";
      aiSuggestionBody.innerHTML = `
        <div style="padding: 10px; background: #ffffff; border: 1px solid var(--line); border-radius: 6px; margin-bottom: 8px;">
          ${escapeHTML(data.continuation)}
        </div>
        <div style="font-size: 11px; color: var(--muted);">${escapeHTML(data.explanation || "")}</div>
      `;
      aiApplyBtn.textContent = "✓ Append to story";
      aiApplyBtn.hidden = false;
      aiInsertBtn.hidden = false;

    } else if (action === "subtitle") {
      aiSuggestionTitle.textContent = "🏷️ Suggested Subtitle";
      aiSuggestionBody.innerHTML = `
        <div style="padding: 10px; background: #ffffff; border: 1px solid var(--line); border-radius: 6px; margin-bottom: 8px; font-weight: 500;">
          ${escapeHTML(data.subtitle)}
        </div>
        <div style="font-size: 11px; color: var(--muted);">${escapeHTML(data.explanation || "")}</div>
      `;
      aiApplyBtn.textContent = "✓ Use as subtitle";
      aiApplyBtn.hidden = false;
      aiInsertBtn.hidden = true;

    } else if (action === "ideas") {
      aiSuggestionTitle.textContent = "💡 Suggested Topic Angles & Ideas";
      const ideasHtml = (data.ideas || []).map((idea, idx) => `
        <div class="ai-idea-item" style="margin-bottom: 10px; padding: 10px; background: #ffffff; border: 1px solid var(--line); border-radius: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span class="ai-idea-tag" style="font-size: 10px; padding: 2px 6px; background: var(--lime); font-weight: 700; border-radius: 3px;">${escapeHTML(idea.type)}</span>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="use-title-btn" data-idx="${idx}" style="font-size: 10px; padding: 2px 7px; border: 1px solid var(--line); border-radius: 4px; background: #fff; cursor: pointer;">Use as Title</button>
              <button type="button" class="use-angle-btn" data-idx="${idx}" style="font-size: 10px; padding: 2px 7px; border: 1px solid var(--line); border-radius: 4px; background: #fff; cursor: pointer;">Add to Story</button>
            </div>
          </div>
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 3px; color: var(--ink);">${escapeHTML(idea.title)}</div>
          <div style="font-size: 12px; color: var(--muted);">${escapeHTML(idea.description)}</div>
        </div>
      `).join("");
      aiSuggestionBody.innerHTML = ideasHtml;

      // Attach individual button handlers
      aiSuggestionBody.querySelectorAll(".use-title-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.idx, 10);
          const idea = (data.ideas || [])[idx];
          if (idea && titleInput) {
            titleInput.value = idea.title;
            updatePreview();
            saveDraft(false);
            btn.textContent = "✓ Title Set!";
            setTimeout(() => { btn.textContent = "Use as Title"; }, 1500);
          }
        });
      });

      aiSuggestionBody.querySelectorAll(".use-angle-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.idx, 10);
          const idea = (data.ideas || [])[idx];
          if (idea && contentInput) {
            const insertion = `\n\n### ${idea.title}\n${idea.description}\n`;
            contentInput.value = (contentInput.value || "").trim() + insertion;
            updatePreview();
            saveDraft(false);
            btn.textContent = "✓ Added!";
            setTimeout(() => { btn.textContent = "Add to Story"; }, 1500);
          }
        });
      });

      aiApplyBtn.textContent = "✓ Insert all ideas into editor";
      aiApplyBtn.hidden = false;
      aiInsertBtn.hidden = true;
    }
  }

  // AI Assistant Button Click Handlers
  if (aiImproveBtn) aiImproveBtn.addEventListener("click", () => callAiAssist("improve"));
  if (aiContinueBtn) aiContinueBtn.addEventListener("click", () => callAiAssist("continue"));
  if (aiSubtitleBtn) aiSubtitleBtn.addEventListener("click", () => callAiAssist("subtitle"));
  if (aiIdeasBtn) aiIdeasBtn.addEventListener("click", () => callAiAssist("ideas"));

  if (aiCloseBtn) {
    aiCloseBtn.addEventListener("click", () => {
      aiSuggestionBox.hidden = true;
      if (aiStatusLabel) aiStatusLabel.textContent = "Light AI writing tools";
    });
  }

  // Copy button
  if (aiCopyBtn) {
    aiCopyBtn.addEventListener("click", () => {
      let copyText = "";
      if (currentAiAction === "improve") copyText = currentAiResult.improved_text;
      else if (currentAiAction === "continue") copyText = currentAiResult.continuation;
      else if (currentAiAction === "subtitle") copyText = currentAiResult.subtitle;
      else if (currentAiAction === "ideas") {
        copyText = (currentAiResult.ideas || []).map(i => `${i.type}: ${i.title}\n${i.description}`).join("\n\n");
      }
      navigator.clipboard.writeText(copyText).then(() => {
        aiCopyBtn.textContent = "✓ Copied!";
        setTimeout(() => { aiCopyBtn.textContent = "📋 Copy"; }, 1800);
      });
    });
  }

  // Insert at cursor
  if (aiInsertBtn) {
    aiInsertBtn.addEventListener("click", () => {
      let insertText = "";
      if (currentAiAction === "improve") insertText = currentAiResult.improved_text;
      else if (currentAiAction === "continue") insertText = " " + currentAiResult.continuation;

      if (!insertText) return;
      const start = contentInput.selectionStart || contentInput.value.length;
      const end = contentInput.selectionEnd || contentInput.value.length;
      const val = contentInput.value;
      contentInput.value = val.substring(0, start) + insertText + val.substring(end);
      contentInput.selectionStart = contentInput.selectionEnd = start + insertText.length;
      contentInput.focus();
      updatePreview();
      saveDraft();
      aiSuggestionBox.hidden = true;
    });
  }

  // Apply button
  if (aiApplyBtn) {
    aiApplyBtn.addEventListener("click", () => {
      if (currentAiAction === "improve") {
        if (currentSelectionRange && currentSelectionRange.start !== currentSelectionRange.end) {
          const val = contentInput.value;
          contentInput.value = val.substring(0, currentSelectionRange.start) + currentAiResult.improved_text + val.substring(currentSelectionRange.end);
        } else {
          contentInput.value = currentAiResult.improved_text;
        }
      } else if (currentAiAction === "continue") {
        const val = contentInput.value.trim();
        contentInput.value = val ? val + " " + currentAiResult.continuation : currentAiResult.continuation;
      } else if (currentAiAction === "subtitle") {
        subtitleInput.value = currentAiResult.subtitle;
      } else if (currentAiAction === "ideas") {
        const ideasText = "\n\n### Exploration Angles\n" + (currentAiResult.ideas || []).map(i => `- **${i.type}:** ${i.title} — ${i.description}`).join("\n");
        contentInput.value = (contentInput.value || "").trim() + ideasText;
      }
      updatePreview();
      saveDraft();
      aiSuggestionBox.hidden = true;
      if (aiStatusLabel) aiStatusLabel.textContent = "Applied successfully";
    });
  }

  // INITIALIZE
  loadDraft();
  updateFavoriteAppearance();
  selectTemplate(selectedTemplateId);
  renderTemplates();
  updatePreview();
});


document.addEventListener("DOMContentLoaded", () => {
    const avatar = document.getElementById("userAvatar");

    if (!avatar) return;

    try {
        const user = window.SmartBlogAuth ? window.SmartBlogAuth.getCurrentUser() : JSON.parse(localStorage.getItem("user") || "{}");
        const fullName = user?.name || user?.username || "";
        const firstName = fullName.trim().split(/\s+/)[0];

        avatar.textContent = firstName
            ? firstName.charAt(0).toUpperCase()
            : "U";

    } catch (error) {
        console.error("Could not load user avatar:", error);
    }
});