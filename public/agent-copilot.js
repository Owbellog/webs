const guidanceBoard = document.getElementById("copilotGuidance");
const messages = document.getElementById("copilotMessages");
const welcomeCard = document.getElementById("copilotWelcomeCard");
const form = document.getElementById("copilotForm");
const input = document.getElementById("copilotInput");
const sendButton = document.getElementById("copilotSendButton");
const template = document.getElementById("copilotMessageTemplate");
const copilotTitle = document.getElementById("copilotTitle");
const copilotSubtitle = document.getElementById("copilotSubtitle");

const apiBaseUrl = new URL(".", window.location.href);
const pageParams = new URLSearchParams(window.location.search);
const isEmbedded = window.self !== window.top || pageParams.get("embed") === "1";

const state = {
  language: "en",
  requestConfig: null,
  campaign: null,
  workitemId: "",
  refreshTimer: null,
  refreshIntervalSeconds: 30,
  detailsOpen: false,
  copied: false,
  lastTranscriptSignature: "",
  stableSnapshot: null
};

if (isEmbedded) {
  document.documentElement.classList.add("embedded");
  document.body.classList.add("embedded");
}

if (window.location.protocol === "file:") {
  renderGuidanceError(translate("open_through_server"));
  appendSystemMessage(translate("open_chat_through_server"));
  setComposerEnabled(false);
} else {
  hydrateCopilot();
}

window.addEventListener("load", notifyParentHeight);
window.addEventListener("resize", notifyParentHeight);
window.addEventListener("beforeunload", stopRefreshLoop);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = input.value.trim();
  if (!message) {
    return;
  }

  if (!state.requestConfig) {
    appendSystemMessage(translate("campaign_misconfigured"));
    return;
  }

  hideWelcome();
  appendMessage("user", translate("copilot_query_label"), escapeHtml(message));
  input.value = "";
  setLoading(true);
  const statusNode = appendStatus(translate("copilot_thinking"));

  try {
    const response = await fetch(buildApiUrl("api/prediction"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        campaignId: state.requestConfig.campaignId,
        domain: state.requestConfig.domain,
        kb_ids: state.requestConfig.kbIds
      })
    });

    const data = await response.json();
    statusNode.remove();

    if (!response.ok) {
      appendSystemMessage(data.error || translate("service_returned_error"));
      notifyParentHeight();
      return;
    }

    appendAnswer(data);
  } catch (error) {
    statusNode.remove();
    appendSystemMessage(translate("could_not_complete_request"));
  } finally {
    setLoading(false);
    input.focus();
    notifyParentHeight();
  }
});

async function hydrateCopilot() {
  state.workitemId = pageParams.get("workitemid") || pageParams.get("workitemId") || "";

  try {
    const configResponse = await fetch(buildApiUrl(`api/config?${pageParams.toString()}`));
    const configData = await configResponse.json();

    if (!configResponse.ok || !configData.configured) {
      renderGuidanceError(configData.error || translate("campaign_misconfigured"));
      appendSystemMessage(configData.error || translate("campaign_misconfigured"));
      setComposerEnabled(false);
      return;
    }

    state.requestConfig = configData.request;
    state.campaign = configData.campaign;
    state.language = getLanguage(configData.campaign);
    applyUiConfig(configData.campaign);
    const initialMessage = pageParams.get("message");
    if (initialMessage) {
      input.value = initialMessage;
    }

    if (state.workitemId) {
      await refreshGuidance();

      const overrideSeconds = Number(pageParams.get("refresh_seconds") || pageParams.get("refreshSeconds") || 0);
      const configuredSeconds = Number(configData.campaign?.ui?.nextStep?.refreshIntervalSeconds || 30);
      state.refreshIntervalSeconds = normalizeRefreshInterval(overrideSeconds || configuredSeconds);
      startRefreshLoop();
    } else {
      renderGuidancePlaceholder();
    }

    notifyParentHeight();
  } catch (error) {
    renderGuidanceError(translate("could_not_reach_server"));
    appendSystemMessage(translate("could_not_reach_server"));
    setComposerEnabled(false);
  }
}

async function refreshGuidance(force) {
  try {
    const requestParams = new URLSearchParams(pageParams);
    if (force) {
      requestParams.set("_ts", String(Date.now()));
    }

    const response = await fetch(buildApiUrl(`api/agent-next-step?${requestParams.toString()}`), { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      renderGuidanceError(data.error || translate("could_not_complete_request"));
      return;
    }

    renderGuidance(data, force);
  } catch (error) {
    renderGuidanceError(translate("could_not_complete_request"));
  }
}

function renderGuidance(data, force) {
  const snapshot = resolveStableSnapshot(data, force);
  const nextStep = snapshot.nextStep || {};
  const suggested = String(nextStep.suggestedPhrase || "").trim();

  guidanceBoard.innerHTML = "";

  const card = document.createElement("article");
  card.className = `copilot-guidance-card${force ? " refreshed" : ""}`;
  card.innerHTML = `
    <div class="copilot-guidance-kicker">${escapeHtml(translate("next_step"))}</div>

    <div class="copilot-guidance-top">
      <div class="copilot-guidance-status">
        <span class="copilot-guidance-live"><span class="copilot-guidance-live-dot"></span>${escapeHtml(translate("live_short"))}</span>
        <span class="copilot-guidance-stage">${escapeHtml(getStageLabel(nextStep.stage))}</span>
      </div>
      <div class="copilot-guidance-confidence">${escapeHtml(String(Math.round(Number(nextStep.confidence || 0))))}%</div>
    </div>

    <div class="copilot-guidance-line">${escapeHtml(nextStep.actionTitle || translate("guide_response"))}</div>

    <div class="copilot-guidance-details">
      <div class="copilot-guidance-section-label">${escapeHtml(translate("suggested_response"))}</div>
      <blockquote>${escapeHtml(suggested || translate("guide_response"))}</blockquote>
    </div>
  `;

  guidanceBoard.appendChild(card);
  notifyParentHeight();
}

function renderGuidanceError(message) {
  guidanceBoard.innerHTML = `
    <article class="copilot-guidance-card copilot-empty">
      <p>${escapeHtml(message)}</p>
    </article>
  `;
  notifyParentHeight();
}

function renderGuidancePlaceholder() {
  guidanceBoard.innerHTML = `
    <article class="copilot-guidance-card copilot-empty">
      <p>${escapeHtml(translate("missing_workitem"))}</p>
    </article>
  `;
  notifyParentHeight();
}

function resolveStableSnapshot(data, force) {
  const incomingSignature = String(data?.transcriptSignature || "").trim();
  if (!force && incomingSignature && state.lastTranscriptSignature === incomingSignature && state.stableSnapshot) {
    return state.stableSnapshot;
  }

  const snapshot = {
    nextStep: data?.nextStep || {},
    article: data?.article || null,
    updatedAt: data?.updatedAt || Date.now(),
    transcriptSignature: incomingSignature
  };

  state.lastTranscriptSignature = incomingSignature;
  state.stableSnapshot = snapshot;
  return snapshot;
}

function appendAnswer(data) {
  const answer = data?.faq_response?.text || translate("no_answer_returned");
  const bubble = createMessage("assistant", translate("copilot_label"));
  bubble.innerHTML = renderRichText(answer);

  const footer = document.createElement("div");
  footer.className = "copilot-answer-actions";
  footer.innerHTML = `
    <button class="copilot-answer-button" type="button" data-action="use">${escapeHtml(translate("use_reply"))}</button>
    <button class="copilot-answer-button" type="button" data-action="copy">${escapeHtml(translate("copy"))}</button>
  `;

  footer.querySelector('[data-action="use"]').addEventListener("click", () => {
    input.value = answer;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });

  footer.querySelector('[data-action="copy"]').addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    try {
      await navigator.clipboard.writeText(answer);
      button.textContent = translate("copied");
      window.setTimeout(() => {
        button.textContent = translate("copy");
      }, 1200);
    } catch (error) {
      button.textContent = translate("copy");
    }
  });

  bubble.appendChild(footer);

  scrollToBottom();
  notifyParentHeight();
}

function appendMessage(role, label, text) {
  const bubble = createMessage(role, label);
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  bubble.appendChild(paragraph);
  scrollToBottom();
  notifyParentHeight();
}

function appendSystemMessage(text) {
  appendMessage("assistant", translate("copilot_label"), escapeHtml(text));
}

function createMessage(role, label) {
  const fragment = template.content.cloneNode(true);
  const article = fragment.querySelector(".message");
  const meta = fragment.querySelector(".message-meta");

  article.classList.add(role);
  meta.textContent = label;
  messages.appendChild(fragment);

  return messages.lastElementChild.querySelector(".message-bubble");
}

function appendStatus(text) {
  const status = document.createElement("div");
  status.className = "status";
  status.textContent = text;
  messages.appendChild(status);
  scrollToBottom();
  return status;
}

function hideWelcome() {
  if (welcomeCard) {
    welcomeCard.remove();
  }
}

function setLoading(isLoading) {
  setComposerEnabled(!isLoading);
}

function setComposerEnabled(isEnabled) {
  sendButton.disabled = !isEnabled;
  input.disabled = !isEnabled;
}

function applyUiConfig(campaign) {
  const ui = {
    ...(campaign?.ui?.shared || {}),
    ...(campaign?.ui?.nextStep || {})
  };

  document.documentElement.style.setProperty("--campaign-font-family", ui.fontFamily || "Manrope, sans-serif");
  document.documentElement.style.setProperty("--campaign-base-font-size", ui.baseFontSize || "16px");
  copilotTitle.textContent = ui.titleText || translate("agent_copilot_title");
  copilotSubtitle.textContent = state.workitemId
    ? `${campaign?.name || translate("copilot_label")} | ${translate("workitem")}: ${state.workitemId}`
    : translate("agent_copilot_subtitle");
}

function startRefreshLoop() {
  stopRefreshLoop();
  state.refreshTimer = window.setInterval(() => refreshGuidance(false), state.refreshIntervalSeconds * 1000);
}

function stopRefreshLoop() {
  if (state.refreshTimer) {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }
}

function normalizeRefreshInterval(value) {
  const parsed = Number(value || 30);
  if (!Number.isFinite(parsed) || parsed < 5) {
    return 30;
  }

  return Math.min(parsed, 3600);
}

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

function notifyParentHeight() {
  if (!isEmbedded) {
    return;
  }

  const height = Math.ceil(document.documentElement.scrollHeight);
  window.parent.postMessage({ type: "nextiq:resize", height }, "*");
}

function buildApiUrl(pathname) {
  return new URL(pathname, apiBaseUrl).toString();
}

function renderRichText(text) {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
  );

  return linked
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getStageLabel(stage) {
  return translate(`stage_${normalizeStage(stage)}`);
}

function normalizeStage(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["empathy", "clarify", "verify", "legal", "troubleshoot", "escalate", "close"].includes(normalized)
    ? normalized
    : "clarify";
}

function getLanguage(campaign) {
  return window.NextI18n?.getLanguage ? window.NextI18n.getLanguage(campaign, pageParams) : "en";
}

function translate(key) {
  return window.NextI18n?.t ? window.NextI18n.t(state.language, key) : key;
}
