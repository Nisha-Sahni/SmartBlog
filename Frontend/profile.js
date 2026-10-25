
const PROFILE_KEY = "smartblog_profile_v1";
const PROFILE_PIC_KEY = "smartblog_profile_pic_v1";
const BLOGS_KEY = "smartblog_blogs_v1";
const SAVED_KEY = "smartblog_saved_blogs_v1";
const HISTORY_KEY = "smartblog_reading_history_v1";

const defaultProfile = {
  name: "Nisha",
  username: "nisha",
  bio: "Student, curious learner, and aspiring developer. I love exploring ideas and sharing what I learn.",
  interests: ["Technology", "Programming", "Writing"]
};

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.error(`Could not read ${key}:`, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeBlogs(items) {
  if (!Array.isArray(items)) return [];

  return items.map((blog, index) => {
    if (typeof blog === "string") {
      return {
        id: blog,
        title: blog,
        description: "",
        topic: "General",
        image: "",
        link: ""
      };
    }

    const title = blog.title || blog.name || "Untitled blog";

    return {
      ...blog,
      id: String(blog.id ?? blog.blogId ?? title ?? index),
      title,
      description: blog.description || blog.excerpt || "",
      topic: blog.topic || blog.category || "General",
      image: blog.image || blog.imageUrl || blog.coverImage || blog.thumbnail || "",
      link: blog.link || blog.url || blog.href || blog.blogUrl || ""
    };
  });
}

let profile = readStorage(PROFILE_KEY, { ...defaultProfile });
let blogs = normalizeBlogs(readStorage(BLOGS_KEY, []));
let savedBlogs = normalizeBlogs(readStorage(SAVED_KEY, []));
let history = normalizeBlogs(readStorage(HISTORY_KEY, []));

const profileForm = document.getElementById("profileForm");
const profilePicInput = document.getElementById("profilePicInput");
const profilePicPreview = document.getElementById("profilePicPreview");
const profileAvatar = document.getElementById("profileAvatar");

function displayProfile() {
  const name = profile.name || defaultProfile.name;

  document.getElementById("displayName").textContent = name;
  document.getElementById("displayUsername").textContent =
    "@" + (profile.username || defaultProfile.username);
  document.getElementById("displayBio").textContent =
    profile.bio || "";

  if (profileAvatar) {
    profileAvatar.textContent = name.trim().charAt(0).toUpperCase() || "?";
  }

  const interestsContainer = document.getElementById("displayInterests");

  if (interestsContainer) {
    interestsContainer.replaceChildren();

    (Array.isArray(profile.interests) ? profile.interests : []).forEach(interest => {
      const tag = document.createElement("span");
      tag.textContent = interest;
      interestsContainer.appendChild(tag);
    });
  }
}

function displayProfilePicture() {
  const picture = readStorage(PROFILE_PIC_KEY, "");

  if (picture && profilePicPreview) {
    profilePicPreview.src = picture;
    profilePicPreview.hidden = false;
  }

  if (picture && profileAvatar) {
    profileAvatar.style.backgroundImage = `url("${picture}")`;
    profileAvatar.style.backgroundSize = "cover";
    profileAvatar.style.backgroundPosition = "center";
    profileAvatar.textContent = "";
  }
}

function openEditor() {
  const section = document.getElementById("editProfileSection");
  if (!section) return;

  section.hidden = false;

  document.getElementById("nameInput").value = profile.name || "";
  document.getElementById("usernameInput").value = profile.username || "";
  document.getElementById("bioInput").value = profile.bio || "";

  const interestsInput = document.getElementById("interestsInput");
  if (interestsInput) {
    interestsInput.value = Array.isArray(profile.interests)
      ? profile.interests.join(", ")
      : "";
  }

  section.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeEditor() {
  const section = document.getElementById("editProfileSection");
  if (section) section.hidden = true;
}

document.getElementById("editProfileBtn")?.addEventListener("click", openEditor);
document.getElementById("cancelEditBtn")?.addEventListener("click", closeEditor);

if (profileForm) {
  profileForm.addEventListener("submit", event => {
    event.preventDefault();

    profile = {
      name: document.getElementById("nameInput").value.trim() || "User",
      username: document.getElementById("usernameInput").value.trim() || "user",
      bio: document.getElementById("bioInput").value.trim(),
      interests: (
        document.getElementById("interestsInput")?.value || ""
      )
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
    };

    writeStorage(PROFILE_KEY, profile);
    displayProfile();
    closeEditor();
  });
}

if (profilePicInput) {
  profilePicInput.addEventListener("change", event => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Please choose an image smaller than 5 MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = loadEvent => {
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 400;
        const scale = Math.min(
          1,
          maxSize / Math.max(image.width, image.height)
        );

        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const resizedImage = canvas.toDataURL("image/jpeg", 0.8);

        try {
          localStorage.setItem(PROFILE_PIC_KEY, JSON.stringify(resizedImage));
          displayProfilePicture();
        } catch (error) {
          alert("Unable to save this picture. Try a smaller image.");
        }
      };

      image.onerror = () => alert("Could not load that image.");
      image.src = loadEvent.target.result;
    };

    reader.readAsDataURL(file);
  });
}

function createBlogCard(blog, type) {
  const card = document.createElement("article");
  card.className = "story-card profile-story-card";

  if (blog.image) {
    const image = document.createElement("img");
    image.className = "story-image";
    image.src = blog.image;
    image.alt = blog.title || "Blog cover";
    image.loading = "lazy";

    image.addEventListener("error", () => {
      image.hidden = true;
    });

    card.appendChild(image);
  }

  const content = document.createElement("div");
  content.className = "story-content";

  const topic = document.createElement("span");
  topic.className = "story-topic";
  topic.textContent = blog.topic || "General";
  content.appendChild(topic);

  const title = document.createElement("h3");
  title.textContent = blog.title || "Untitled blog";
  content.appendChild(title);

  if (blog.description) {
    const description = document.createElement("p");
    description.textContent = blog.description;
    content.appendChild(description);
  }

  const destination = document.createElement("a");
  destination.className = "story-link";

  if (blog.link) {
    destination.href = blog.link;
    destination.textContent = "Read blog →";
  } else {
    destination.href = "#";
    destination.textContent = "Blog preview unavailable";
    destination.setAttribute("aria-disabled", "true");
    destination.addEventListener("click", event => event.preventDefault());
  }

  content.appendChild(destination);

  if (type === "saved") {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-saved-button";
    removeButton.textContent = "♥ Remove saved";

    removeButton.addEventListener("click", () => {
      savedBlogs = savedBlogs.filter(
        saved => String(saved.id) !== String(blog.id)
      );

      writeStorage(SAVED_KEY, savedBlogs);
      renderAllBlogSections();
    });

    content.appendChild(removeButton);
  }

  card.appendChild(content);
  return card;
}

function renderBlogCards(containerId, emptyId, items, type) {
  const container = document.getElementById(containerId);
  const emptyMessage = document.getElementById(emptyId);

  if (!container) return;

  container.replaceChildren();

  if (!items.length) {
    if (emptyMessage) emptyMessage.hidden = false;
    return;
  }

  if (emptyMessage) emptyMessage.hidden = true;

  items.forEach(blog => {
    container.appendChild(createBlogCard(blog, type));
  });
}

function renderAllBlogSections() {
  renderBlogCards(
    "blogsGrid",
    "blogsEmpty",
    blogs,
    "published"
  );

  renderBlogCards(
    "savedGrid",
    "savedEmpty",
    savedBlogs,
    "saved"
  );

  renderStats();
}

function renderStats() {
  const publishedCount = document.getElementById("publishedCount");
  const savedCount = document.getElementById("savedCount");
  const historyCount = document.getElementById("historyCount");

  if (publishedCount) publishedCount.textContent = blogs.length;
  if (savedCount) savedCount.textContent = savedBlogs.length;
  if (historyCount) historyCount.textContent = history.length;
}

function initializeProfile() {
  if (!profile || typeof profile !== "object") {
    profile = { ...defaultProfile };
  }

  profile = {
    ...defaultProfile,
    ...profile,
    interests: Array.isArray(profile.interests)
      ? profile.interests
      : defaultProfile.interests
  };

  displayProfile();
  displayProfilePicture();
  renderAllBlogSections();
}

initializeProfile();
