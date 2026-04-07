const authSectionNode = document.getElementById("agentChatAuth");
const workspaceNode = document.getElementById("agentChatWorkspace");
const loginForm = document.getElementById("agentChatLoginForm");
const loginUsernameNode = document.getElementById("agentChatUsername");
const loginPasswordNode = document.getElementById("agentChatPassword");
const loginStatusNode = document.getElementById("agentChatLoginStatus");
const loginButton = document.getElementById("agentChatLoginButton");
const logoutButton = document.getElementById("agentChatLogout");
const authKickerNode = document.getElementById("agentChatAuthKicker");
const authTitleNode = document.getElementById("agentChatAuthTitle");
const authCopyNode = document.getElementById("agentChatAuthCopy");
const usernameLabelNode = document.getElementById("agentChatUsernameLabel");
const passwordLabelNode = document.getElementById("agentChatPasswordLabel");
const listNode = document.getElementById("agentChatList");
const titleNode = document.getElementById("agentChatTitle");
const subtitleNode = document.getElementById("agentChatSubtitle");
const kickerNode = document.getElementById("agentChatKicker");
const listTitleNode = document.getElementById("agentChatListTitle");
const listMetaNode = document.getElementById("agentChatListMeta");
const summaryNode = document.getElementById("agentChatSummary");
const messagesNode = document.getElementById("agentChatMessages");
const form = document.getElementById("agentChatForm");
const input = document.getElementById("agentChatInput");
const sendButton = document.getElementById("agentChatSend");
const statusNode = document.getElementById("agentChatStatus");
const refreshButton = document.getElementById("agentChatRefresh");
const acdToggleButton = document.getElementById("agentChatAcdToggle");

const apiBaseUrl = new URL(".", window.location.href);
const pageParams = new URLSearchParams(window.location.search);

const state = {
  language: "en",
  campaign: null,
  workitems: [],
  selectedWorkitemId: "",
  refreshTimer: null,
  refreshSeconds: 15,
  authToken: "",
  agentUserId: "",
  messagesByWorkitem: {},
  activeWorkitemRequestId: 0,
  acdEnabled: false
};

if (window.location.protocol === "file:") {
  renderPageError(translate("open_through_server"));
  setComposerEnabled(false);
  setLoginEnabled(false);
} else {
  hydrateAgentChat();
}

window.addEventListener("beforeunload", stopRefreshLoop);

refreshButton.addEventListener("click", async () => {
  await refreshWorkitems(true);
  await refreshActiveWorkitem();
});

acdToggleButton.addEventListener("click", async () => {
  await toggleAcdStatus();
});

logoutButton.addEventListener("click", async () => {
  await handleLogout();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleLogin();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = input.value.trim();
  if (!text || !state.selectedWorkitemId || !state.authToken) {
    return;
  }

  const workitemId = state.selectedWorkitemId;
  const optimisticMessage = createLocalAgentMessage(text);
  appendLocalMessage(workitemId, optimisticMessage);
  renderConversation(getMessagesForWorkitem(workitemId));
  updateWorkitemPreview(workitemId);

  setComposerEnabled(false);
  setStatus(translate("agent_chat_sending"));

  try {
    const response = await fetch(buildApiUrl("api/agent-chat/messages"), {
      method: "POST",
      headers: buildAgentChatHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        campaignId: getSelectedCampaignId(),
        domain: getSelectedDomain(),
        workitemId,
        textMsg: text
      })
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 400 && /sign in again|missing user token/i.test(String(data.error || ""))) {
        handleExpiredSession(data.error);
        return;
      }

      removeLocalMessage(workitemId, optimisticMessage.localId);
      renderConversation(getMessagesForWorkitem(workitemId));
      updateWorkitemPreview(workitemId);
      setStatus(data.error || translate("could_not_complete_request"), true);
      setComposerEnabled(true);
      return;
    }

    input.value = "";
    setStatus(translate("agent_chat_sent"));
    markLocalMessageDelivered(workitemId, optimisticMessage.localId);
    renderConversation(getMessagesForWorkitem(workitemId));
    updateWorkitemPreview(workitemId);
    await refreshActiveWorkitem();
    await refreshWorkitems(true);
  } catch (error) {
    removeLocalMessage(workitemId, optimisticMessage.localId);
    renderConversation(getMessagesForWorkitem(workitemId));
    updateWorkitemPreview(workitemId);
    setStatus(translate("could_not_complete_request"), true);
  } finally {
    setComposerEnabled(true);
    input.focus();
  }
});

async function hydrateAgentChat() {
  state.language = getLanguage();
  applyPageCopy();
  restoreSession();

  if (!state.authToken) {
    showAuthView();
    renderLoggedOutState();
    return;
  }

  showWorkspaceView();
  await loadWorkspace();
}

async function handleLogin() {
  const username = loginUsernameNode.value.trim();
  const password = loginPasswordNode.value;
  if (!username || !password) {
    setLoginStatus(translate("agent_chat_login_missing"), true);
    return;
  }

  setLoginEnabled(false);
  setLoginStatus(translate("agent_chat_login_loading"));

  try {
    const response = await fetch(buildApiUrl("api/agent-chat/auth/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        campaignId: getSelectedCampaignId(),
        domain: getSelectedDomain(),
        username,
        password
      })
    });

    const data = await response.json();
    if (!response.ok) {
      setLoginStatus(data.details || data.error || translate("agent_chat_login_failed"), true);
      setLoginEnabled(true);
      loginPasswordNode.focus();
      return;
    }

    state.authToken = String(data.token || "").trim();
    state.agentUserId = String(data.agentUserId || "").trim();
    state.campaign = data.campaign || state.campaign;
    state.language = getLanguage(state.campaign);
    persistSession();
    applyPageCopy();
    showWorkspaceView();
    setLoginStatus("");
    loginForm.reset();
    await loadWorkspace();
  } catch (error) {
    setLoginStatus(translate("could_not_reach_server"), true);
  } finally {
    setLoginEnabled(true);
  }
}

async function handleLogout() {
  if (!state.authToken) {
    showAuthView();
    return;
  }

  logoutButton.disabled = true;
  setStatus("");
  setLoginStatus("");

  try {
    await fetch(buildApiUrl("api/agent-chat/auth/logout"), {
      method: "POST",
      headers: buildAgentChatHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        campaignId: getSelectedCampaignId(),
        domain: getSelectedDomain()
      })
    });
  } catch (error) {
    // Logout should still clear local session even if upstream is unavailable.
  } finally {
    stopRefreshLoop();
    clearSession();
    showAuthView();
    renderLoggedOutState();
    setLoginStatus(translate("agent_chat_logged_out"));
    logoutButton.disabled = false;
    loginUsernameNode.focus();
  }
}

async function loadWorkspace() {
  try {
    setStatus("");
    await refreshWorkitems(false);
    if (!state.authToken) {
      return;
    }

    if (state.selectedWorkitemId) {
      await refreshActiveWorkitem();
    } else {
      renderEmptyConversation();
    }

    if (state.authToken) {
      startRefreshLoop();
    }
  } catch (error) {
    renderPageError(translate("could_not_reach_server"));
  }
}

async function toggleAcdStatus() {
  if (!state.authToken) {
    handleExpiredSession(translate("agent_chat_session_required"));
    return;
  }

  const nextValue = !state.acdEnabled;
  acdToggleButton.disabled = true;
  setStatus(translate("agent_chat_acd_updating"));

  try {
    const response = await fetch(buildApiUrl("api/agent-chat/acd-status"), {
      method: "POST",
      headers: buildAgentChatHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        campaignId: getSelectedCampaignId(),
        domain: getSelectedDomain(),
        enabled: nextValue
      })
    });

    const data = await response.json();
    if (!response.ok) {
      setStatus(data.details || data.error || translate("could_not_complete_request"), true);
      return;
    }

    state.acdEnabled = nextValue;
    persistSession();
    updateAcdToggle();
    setStatus(nextValue ? translate("agent_chat_acd_true") : translate("agent_chat_acd_false"));
  } catch (error) {
    setStatus(translate("could_not_complete_request"), true);
  } finally {
    acdToggleButton.disabled = false;
  }
}

async function refreshWorkitems(preserveSelection) {
  if (!state.authToken) {
    handleExpiredSession(translate("agent_chat_session_required"));
    return;
  }

  const response = await fetch(buildApiUrl(`api/agent-chat/workitems?${pageParams.toString()}`), {
    cache: "no-store",
    headers: buildAgentChatHeaders()
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 400 && /sign in again|missing user token/i.test(String(data.error || ""))) {
      handleExpiredSession(data.error);
      return;
    }

    setStatus(data.error || translate("workitem_request_failed"), true);
    return;
  }

  state.campaign = data.campaign || state.campaign;
  state.language = getLanguage(state.campaign);
  applyPageCopy();
  state.workitems = Array.isArray(data.workitems) ? data.workitems : [];

  const requested = pageParams.get("workitemid") || pageParams.get("workitemId") || "";
  const preferredSelection = preserveSelection ? state.selectedWorkitemId : requested;
  if (
    !preserveSelection
    || !state.selectedWorkitemId
    || !state.workitems.some((item) => item.workitemId === state.selectedWorkitemId)
  ) {
    state.selectedWorkitemId = pickInitialWorkitem(preferredSelection);
  }

  renderWorkitems();
}

async function refreshActiveWorkitem() {
  if (!state.selectedWorkitemId) {
    setComposerEnabled(false);
    renderEmptyConversation();
    return;
  }

  if (!state.authToken) {
    handleExpiredSession(translate("agent_chat_session_required"));
    return;
  }

  const requestedWorkitemId = state.selectedWorkitemId;
  const requestId = ++state.activeWorkitemRequestId;
  const params = new URLSearchParams(pageParams);
  params.set("workitemid", requestedWorkitemId);

  const response = await fetch(buildApiUrl(`api/agent-chat/workitem?${params.toString()}`), {
    cache: "no-store",
    headers: buildAgentChatHeaders()
  });
  const data = await response.json();

  if (requestId !== state.activeWorkitemRequestId || requestedWorkitemId !== state.selectedWorkitemId) {
    return;
  }

  if (!response.ok) {
    if (response.status === 400 && /sign in again|missing user token/i.test(String(data.error || ""))) {
      handleExpiredSession(data.error);
      return;
    }

    setStatus(data.error || translate("workitem_request_failed"), true);
    renderEmptyConversation(data.error || translate("workitem_request_failed"));
    return;
  }

  renderSummary(data.summary || {});
  const mergedMessages = mergeMessagesForWorkitem(requestedWorkitemId, Array.isArray(data.messages) ? data.messages : []);
  renderConversation(mergedMessages);
  updateWorkitemPreview(requestedWorkitemId);
  setComposerEnabled(Boolean(state.authToken && requestedWorkitemId));
}

function pickInitialWorkitem(preferred) {
  if (preferred && state.workitems.some((item) => item.workitemId === preferred)) {
    return preferred;
  }

  return state.workitems[0]?.workitemId || "";
}

function renderWorkitems() {
  listNode.innerHTML = "";
  listTitleNode.textContent = translate("agent_chat_open_chats");
  listMetaNode.textContent = `${state.workitems.length}`;
  setComposerEnabled(Boolean(state.authToken && state.selectedWorkitemId));

  if (!state.workitems.length) {
    listNode.innerHTML = `<article class="empty-state">${escapeHtml(translate("agent_chat_no_workitems"))}</article>`;
    return;
  }

  for (const item of state.workitems) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `agent-chat-list-item${item.workitemId === state.selectedWorkitemId ? " active" : ""}`;

    const name = item.contactName || item.phone || item.workitemId || "-";
    const lastText = item.lastMessage?.text || translate("agent_chat_no_messages");
    const roleLabel = item.lastMessage?.role === "agent" ? translate("agent") : translate("client");
    const time = formatTimestamp(item.lastMessage?.timestamp || item.latestTimestamp);

    button.innerHTML = `
      <div class="agent-chat-list-top">
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(time)}</span>
      </div>
      <div class="agent-chat-list-meta">${escapeHtml(item.agentUsername || item.channelType || item.state || "")}</div>
      <div class="agent-chat-list-preview">${escapeHtml(roleLabel)}: ${escapeHtml(lastText)}</div>
    `;

    button.addEventListener("click", async () => {
      state.selectedWorkitemId = item.workitemId;
      renderWorkitems();
      await refreshActiveWorkitem();
    });

    listNode.appendChild(button);
  }
}

function renderSummary(summary) {
  const title = summary.contactName || summary.phone || summary.workitemId || translate("workitem");

  summaryNode.innerHTML = `
    <article class="agent-chat-summary-card">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml([summary.phone, summary.agentUsername, summary.state].filter(Boolean).join(" | "))}</span>
    </article>
  `;
}

function renderConversation(messages) {
  messagesNode.innerHTML = "";

  if (!messages.length) {
    messagesNode.innerHTML = `<article class="empty-state">${escapeHtml(translate("agent_chat_no_messages"))}</article>`;
    return;
  }

  for (const item of messages) {
    const row = document.createElement("article");
    row.className = `agent-chat-message ${item.role === "agent" ? "agent" : "client"}`;
    row.innerHTML = `
      <div class="agent-chat-message-meta">
        <span>${escapeHtml(item.role === "agent" ? translate("agent") : translate("client"))}</span>
        <span>${escapeHtml(formatTimestamp(item.timestamp))}</span>
      </div>
      <div class="agent-chat-message-bubble">${escapeHtml(item.text)}</div>
    `;
    messagesNode.appendChild(row);
  }

  messagesNode.scrollTop = messagesNode.scrollHeight;
}

function renderEmptyConversation(message) {
  summaryNode.innerHTML = "";
  messagesNode.innerHTML = `<article class="empty-state">${escapeHtml(message || translate("agent_chat_select_chat"))}</article>`;
}

function renderLoggedOutState() {
  state.workitems = [];
  state.selectedWorkitemId = "";
  listNode.innerHTML = `<article class="empty-state">${escapeHtml(translate("agent_chat_session_required"))}</article>`;
  listMetaNode.textContent = "";
  renderEmptyConversation(translate("agent_chat_session_required"));
  setComposerEnabled(false);
}

function renderPageError(message) {
  titleNode.textContent = translate("agent_chat_title");
  subtitleNode.textContent = message;
  listNode.innerHTML = `<article class="empty-state">${escapeHtml(message)}</article>`;
  renderEmptyConversation(message);
  setComposerEnabled(false);
}

function applyPageCopy() {
  titleNode.textContent = state.campaign?.name || translate("agent_chat_title");
  subtitleNode.textContent = state.campaign?.domain || translate("agent_chat_subtitle");
  kickerNode.textContent = translate("agent_chat_title");
  refreshButton.textContent = translate("agent_chat_refresh");
  logoutButton.textContent = translate("agent_chat_logout");
  updateAcdToggle();
  sendButton.textContent = translate("agent_chat_send");
  input.placeholder = translate("agent_chat_input_placeholder");
  listTitleNode.textContent = translate("agent_chat_open_chats");
  authKickerNode.textContent = translate("agent_chat_login_kicker");
  authTitleNode.textContent = translate("agent_chat_login_title");
  authCopyNode.textContent = translate("agent_chat_login_copy");
  usernameLabelNode.textContent = translate("agent_chat_username");
  passwordLabelNode.textContent = translate("agent_chat_password");
  loginButton.textContent = translate("agent_chat_login_button");
}

function showAuthView() {
  authSectionNode.hidden = false;
  workspaceNode.hidden = true;
  logoutButton.hidden = true;
  acdToggleButton.hidden = true;
  authSectionNode.style.display = "grid";
  workspaceNode.style.display = "none";
  logoutButton.style.display = "none";
  acdToggleButton.style.display = "none";
  stopRefreshLoop();
  setComposerEnabled(false);
}

function showWorkspaceView() {
  authSectionNode.hidden = true;
  workspaceNode.hidden = false;
  logoutButton.hidden = false;
  acdToggleButton.hidden = false;
  authSectionNode.style.display = "none";
  workspaceNode.style.display = "grid";
  logoutButton.style.display = "";
  acdToggleButton.style.display = "";
  setComposerEnabled(Boolean(state.authToken && state.selectedWorkitemId));
}

function startRefreshLoop() {
  stopRefreshLoop();
  state.refreshTimer = window.setInterval(async () => {
    await refreshWorkitems(true);
    await refreshActiveWorkitem();
  }, state.refreshSeconds * 1000);
}

function stopRefreshLoop() {
  if (state.refreshTimer) {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }
}

function setComposerEnabled(enabled) {
  input.disabled = !enabled;
  sendButton.disabled = !enabled;
}

function setLoginEnabled(enabled) {
  loginUsernameNode.disabled = !enabled;
  loginPasswordNode.disabled = !enabled;
  loginButton.disabled = !enabled;
}

function setStatus(message, isError) {
  statusNode.textContent = message || "";
  statusNode.classList.toggle("error", Boolean(isError));
}

function setLoginStatus(message, isError) {
  loginStatusNode.textContent = message || "";
  loginStatusNode.classList.toggle("error", Boolean(isError));
}

function restoreSession() {
  try {
    const raw = window.sessionStorage.getItem(getSessionStorageKey());
    if (!raw) {
      return;
    }

    const payload = JSON.parse(raw);
    state.authToken = String(payload?.token || "").trim();
    state.agentUserId = String(payload?.agentUserId || "").trim();
    state.acdEnabled = Boolean(payload?.acdEnabled);
    if (payload?.campaign && typeof payload.campaign === "object") {
      state.campaign = payload.campaign;
    }
  } catch (error) {
    clearSession();
  }
}

function persistSession() {
  const payload = {
    token: state.authToken,
    agentUserId: state.agentUserId,
    acdEnabled: state.acdEnabled,
    campaign: state.campaign
  };

  window.sessionStorage.setItem(getSessionStorageKey(), JSON.stringify(payload));
}

function clearSession() {
  state.authToken = "";
  state.agentUserId = "";
  state.campaign = null;
  state.messagesByWorkitem = {};
  state.acdEnabled = false;
  window.sessionStorage.removeItem(getSessionStorageKey());
}

function handleExpiredSession(message) {
  clearSession();
  showAuthView();
  renderLoggedOutState();
  setLoginStatus(message || translate("agent_chat_session_required"), true);
}

function getSelectedCampaignId() {
  return pageParams.get("campaign") || state.campaign?.id || "";
}

function getSelectedDomain() {
  return pageParams.get("domain") || state.campaign?.domain || "";
}

function getSessionStorageKey() {
  return [
    "nextiq",
    "agent-chat",
    getSelectedCampaignId() || "-",
    getSelectedDomain() || "-"
  ].join(":");
}

function buildAgentChatHeaders(extraHeaders) {
  const headers = {
    ...(extraHeaders || {})
  };

  if (state.authToken) {
    headers["x-agent-chat-token"] = state.authToken;
  }

  if (state.agentUserId) {
    headers["x-agent-user-id"] = state.agentUserId;
  }

  return headers;
}

function updateAcdToggle() {
  if (!acdToggleButton) {
    return;
  }

  const label = state.acdEnabled ? translate("agent_chat_acd_true") : translate("agent_chat_acd_false");
  acdToggleButton.textContent = `${translate("agent_chat_acd_label")}: ${label}`;
  acdToggleButton.classList.toggle("agent-chat-acd-on", state.acdEnabled);
}

function createLocalAgentMessage(text) {
  return {
    id: "",
    localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    text,
    fromId: state.agentUserId,
    timestamp: Date.now(),
    role: "agent",
    type: "USER",
    pending: true
  };
}

function appendLocalMessage(workitemId, message) {
  const current = getMessagesForWorkitem(workitemId);
  state.messagesByWorkitem[workitemId] = mergeMessageLists(current, [message]);
}

function removeLocalMessage(workitemId, localId) {
  const current = getMessagesForWorkitem(workitemId);
  state.messagesByWorkitem[workitemId] = current.filter((item) => item.localId !== localId);
}

function markLocalMessageDelivered(workitemId, localId) {
  const current = getMessagesForWorkitem(workitemId);
  state.messagesByWorkitem[workitemId] = current.map((item) => {
    if (item.localId !== localId) {
      return item;
    }

    return {
      ...item,
      pending: false
    };
  });
}

function mergeMessagesForWorkitem(workitemId, serverMessages) {
  const merged = mergeMessageLists(serverMessages, getMessagesForWorkitem(workitemId));
  state.messagesByWorkitem[workitemId] = merged;
  return merged;
}

function getMessagesForWorkitem(workitemId) {
  return Array.isArray(state.messagesByWorkitem[workitemId])
    ? state.messagesByWorkitem[workitemId]
    : [];
}

function mergeMessageLists(primaryMessages, secondaryMessages) {
  const deduped = [];
  const seen = new Set();

  for (const item of [...(Array.isArray(primaryMessages) ? primaryMessages : []), ...(Array.isArray(secondaryMessages) ? secondaryMessages : [])]) {
    if (!item || !item.text) {
      continue;
    }

    const key = item.id
      ? `id:${item.id}`
      : `${item.role || ""}|${item.fromId || ""}|${item.text}|${Math.round(Number(item.timestamp || 0) / 1000)}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push({
      ...item,
      pending: Boolean(item.pending)
    });
  }

  return deduped.sort((left, right) => Number(left.timestamp || 0) - Number(right.timestamp || 0));
}

function updateWorkitemPreview(workitemId) {
  if (!workitemId) {
    return;
  }

  const messages = getMessagesForWorkitem(workitemId);
  const lastMessage = messages[messages.length - 1] || null;
  state.workitems = state.workitems.map((item) => {
    if (item.workitemId !== workitemId || !lastMessage) {
      return item;
    }

    return {
      ...item,
      latestTimestamp: lastMessage.timestamp || item.latestTimestamp,
      lastMessage: {
        text: lastMessage.text,
        role: lastMessage.role,
        timestamp: lastMessage.timestamp
      }
    };
  });
  renderWorkitems();
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "";
  }

  try {
    return new Date(Number(timestamp)).toLocaleString();
  } catch (error) {
    return "";
  }
}

function buildApiUrl(pathname) {
  return new URL(pathname, apiBaseUrl).toString();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getLanguage(campaign) {
  return window.NextI18n?.getLanguage ? window.NextI18n.getLanguage(campaign, pageParams) : "en";
}

function translate(key) {
  return window.NextI18n?.t ? window.NextI18n.t(state.language, key) : key;
}
