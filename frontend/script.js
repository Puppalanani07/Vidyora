const API_BASE = "https://vidyora-ochre.vercel.app";

const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const levelSelect = document.querySelector("#learning-level");
const messages = document.querySelector("#messages");
const sendButton = document.querySelector("#send-button");
const workspace = document.querySelector("#workspace");
const historyContent = document.querySelector("#history-content");
const sidebarHistory = document.querySelector("#sidebar-history");
let currentConversationId = null;

const pageTitles = {
  home: "Home",
  "create-images": "Create Images",
  "create-videos": "Create Videos",
  history: "Chat history",
};

function showPage(page) {
  const selectedPage = Object.prototype.hasOwnProperty.call(pageTitles, page) ? page : "home";
  document.querySelectorAll("[data-view]").forEach((view) => {
    view.hidden = view.dataset.view !== selectedPage;
  });
  document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
    if (link.dataset.page === selectedPage) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
  document.title = `${pageTitles[selectedPage]} — Vidyora`;
  workspace.classList.remove("mobile-nav-open");
  document.querySelector("#mobile-menu").setAttribute("aria-expanded", "false");
  document.querySelector("#mobile-menu").setAttribute("aria-label", "Open navigation");
  if (selectedPage === "history") loadHistory();
}

function navigateTo(page) {
  const hash = `#${page}`;
  if (window.location.hash === hash) {
    showPage(page);
  } else {
    window.location.hash = page;
  }
}

function createHistoryButton(conversation, compact = false) {
  const button = document.createElement("button");
  button.className = compact ? "sidebar-history-item" : "history-card";
  button.type = "button";
  button.textContent = conversation.title || "Untitled conversation";
  button.setAttribute("aria-label", `Open conversation: ${button.textContent}`);
  if (!compact) {
    const details = document.createElement("span");
    details.className = "history-card-meta";
    details.textContent = `${conversation.message_count} messages · ${conversation.learning_level}`;
    button.append(details);
  }
  button.addEventListener("click", () => openConversation(conversation.id));
  return button;
}

async function loadHistory() {
  historyContent.replaceChildren();
  sidebarHistory.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "history-note";
  loading.textContent = "Loading saved conversations…";
  historyContent.append(loading);
  sidebarHistory.append(loading.cloneNode(true));

  try {
    const response = await fetch(`${API_BASE}/api/conversations`);
    const data = await readApiResponse(response, "Could not load saved conversations");

    if (!Array.isArray(data?.conversations)) {
      throw new Error("The history API returned an invalid conversation list.");
    }
    const conversations = data.conversations;
    historyContent.replaceChildren();
    sidebarHistory.replaceChildren();
    if (conversations.length === 0) {
      const empty = document.createElement("p");
      empty.className = "history-note";
      empty.textContent = "No saved conversations yet. Start a chat and it will appear here.";
      historyContent.append(empty);
      sidebarHistory.append(empty.cloneNode(true));
      return;
    }

    conversations.forEach((conversation) => {
      historyContent.append(createHistoryButton(conversation));
      sidebarHistory.append(createHistoryButton(conversation, true));
    });
  } catch (error) {
    console.error("Loading conversation history failed:", error);
    const message = document.createElement("p");
    message.className = "history-note history-error";
    message.textContent = getErrorMessage(error);
    historyContent.replaceChildren(message);
    sidebarHistory.replaceChildren(message.cloneNode(true));
  }
}

async function openConversation(conversationId) {
  historyContent.setAttribute("aria-busy", "true");
  try {
    const response = await fetch(
      `${API_BASE}/api/conversations/${encodeURIComponent(conversationId)}`,
    );
    const data = await readApiResponse(response, "Could not open conversation");
    if (typeof data?.id !== "string" || !Array.isArray(data.messages)) {
      throw new Error("The history API returned an invalid conversation.");
    }

    currentConversationId = data.id;
    messages.replaceChildren();
    (Array.isArray(data.messages) ? data.messages : []).forEach((message) => {
      addMessage(message.role === "user" ? "user" : "assistant", message.content);
    });
    navigateTo("home");
    input.focus();
  } catch (error) {
    console.error("Opening conversation failed:", error);
    const message = document.createElement("p");
    message.className = "history-note history-error";
    message.textContent = getErrorMessage(error);
    historyContent.replaceChildren(message);
  } finally {
    historyContent.removeAttribute("aria-busy");
  }
}

function startNewChat() {
  currentConversationId = null;
  messages.replaceChildren();
  addMessage("assistant", "Hi! What would you like to learn today?");
  navigateTo("home");
  input.value = "";
  input.focus();
}

function addMessage(role, text, { isError = false } = {}) {
  const article = document.createElement("article");
  article.className = `message ${role}-message${isError ? " error-message" : ""}`;

  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "assistant" ? "V" : "Y";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = isError ? "Unable to send" : role === "assistant" ? "Vidyora" : "You";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  bubble.append(label, paragraph);
  article.append(avatar, bubble);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
}

function addLoadingMessage() {
  const article = document.createElement("article");
  article.className = "message assistant-message";
  article.setAttribute("aria-label", "Vidyora is thinking");

  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = "V";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = "Typing...";

  const dots = document.createElement("span");
  dots.className = "loading-dots";
  dots.setAttribute("aria-label", "Typing");
  dots.innerHTML = "<span></span><span></span><span></span>";

  bubble.append(label, dots);
  article.append(avatar, bubble);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);

  try {
    return await fetch(`${API_BASE}${url}`, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readApiResponse(response, action) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.error === "string" ? `: ${data.error}` : "";
    throw new Error(`${action} (HTTP ${response.status})${detail}`);
  }
  return data;
}

function getErrorMessage(error) {
  if (error instanceof TypeError) {
    return `Network/CORS error: ${error.message}`;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return "Request timed out. Please try again.";
  }
  return error instanceof Error ? error.message : String(error);
}

async function sendMessage(message) {
  const payload = {
    message,
    level: levelSelect.value,
  };

  try {
    const response = await fetchWithTimeout("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await readApiResponse(response, "Chat request failed");

    if (typeof data?.reply !== "string" || !data.reply.trim()) {
      throw new Error("The server returned an empty or invalid reply.");
    }

    addMessage("assistant", data.reply);
  } catch (err) {
    console.error("Chat request failed:", err);
    addMessage("assistant", getErrorMessage(err), { isError: true });
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || sendButton.disabled) return;

  addMessage("user", message);
  input.value = "";
  sendButton.disabled = true;
  input.disabled = true;
  const loadingMessage = addLoadingMessage();

  try {
    await sendMessage(message);
  } finally {
    loadingMessage.remove();
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    navigateTo(link.dataset.page);
  });
});

document.querySelector("#new-chat").addEventListener("click", startNewChat);
document.querySelector("#refresh-history").addEventListener("click", loadHistory);

document.querySelector("#sidebar-toggle").addEventListener("click", (event) => {
  const collapsed = workspace.classList.toggle("sidebar-collapsed");
  event.currentTarget.setAttribute("aria-expanded", String(!collapsed));
  event.currentTarget.setAttribute(
    "aria-label",
    collapsed ? "Expand sidebar" : "Collapse sidebar",
  );
});

document.querySelector("#mobile-menu").addEventListener("click", (event) => {
  const isOpen = workspace.classList.toggle("mobile-nav-open");
  event.currentTarget.setAttribute("aria-expanded", String(isOpen));
  event.currentTarget.setAttribute(
    "aria-label",
    isOpen ? "Close navigation" : "Open navigation",
  );
  if (isOpen) {
    document.querySelector("#new-chat").focus();
  }
});

function closeMobileNavigation(restoreFocus = false) {
  workspace.classList.remove("mobile-nav-open");
  document.querySelector("#mobile-menu").setAttribute("aria-expanded", "false");
  document.querySelector("#mobile-menu").setAttribute("aria-label", "Open navigation");
  if (restoreFocus) document.querySelector("#mobile-menu").focus();
}

document.querySelector("#drawer-backdrop").addEventListener("click", () => {
  closeMobileNavigation(true);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && workspace.classList.contains("mobile-nav-open")) {
    closeMobileNavigation(true);
  }
});

window.addEventListener("hashchange", () => {
  const initialPage = window.location.hash.slice(1) || "home";
  showPage(initialPage);
  if (initialPage !== "history") loadHistory();
});

showPage(window.location.hash.slice(1) || "home");
