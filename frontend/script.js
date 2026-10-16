const API_ROOT = "http://127.0.0.1:5000/api";
const API_URL = `${API_ROOT}/chat`;

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
    const response = await fetch(`${API_ROOT}/conversations`);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof data?.error === "string" ? ` ${data.error}` : "";
      throw new Error(`Could not load saved conversations (HTTP ${response.status}).${detail}`);
    }

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
    const message = document.createElement("p");
    message.className = "history-note history-error";
    message.textContent = error instanceof TypeError
      ? "Could not reach the history API. Check that Flask and MongoDB are running."
      : error.message;
    historyContent.replaceChildren(message);
    sidebarHistory.replaceChildren(message.cloneNode(true));
  }
}

async function openConversation(conversationId) {
  historyContent.setAttribute("aria-busy", "true");
  try {
    const response = await fetch(
      `${API_ROOT}/conversations/${encodeURIComponent(conversationId)}`,
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof data?.error === "string" ? ` ${data.error}` : "";
      throw new Error(`Could not open conversation (HTTP ${response.status}).${detail}`);
    }
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
    const message = document.createElement("p");
    message.className = "history-note history-error";
    message.textContent = error instanceof TypeError
      ? "Could not reach the history API. Check that Flask is running."
      : error.message;
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
  label.textContent = "Vidyora";

  const dots = document.createElement("span");
  dots.className = "loading-dots";
  dots.setAttribute("aria-label", "Thinking");
  dots.innerHTML = "<span></span><span></span><span></span>";

  bubble.append(label, dots);
  article.append(avatar, bubble);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
}

async function sendMessage(message) {
  const payload = {
    message,
    learning_level: levelSelect.value,
  };
  if (currentConversationId) {
    payload.conversation_id = currentConversationId;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof data?.error === "string" ? ` ${data.error}` : "";
      throw new Error(`Request failed (HTTP ${response.status}).${detail}`);
    }

    if (typeof data?.reply !== "string" || !data.reply.trim()) {
      throw new Error("The server returned an empty or invalid reply.");
    }

    if (typeof data.conversation_id === "string") {
      currentConversationId = data.conversation_id;
      loadHistory();
    }
    addMessage("assistant", data.reply);
  } catch (error) {
    const messageText = error instanceof TypeError
      ? "Could not reach the Vidyora API. Check that Flask is running at 127.0.0.1:5000."
      : error.message;
    addMessage("assistant", messageText, { isError: true });
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
