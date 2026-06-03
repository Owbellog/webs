const agentStepBoard = document.getElementById("agentStepBoard");

const apiBaseUrl = new URL(".", window.location.href);
const pageParams = new URLSearchParams(window.location.search);
const isEmbedded = window.self !== window.top || pageParams.get("embed") === "1";

const state = {
  refreshTimer: null,
  refreshIntervalSeconds: 30,
  language: "en",
  ui: null,
  copied: false,
  regenerating: false,
  lastTranscriptSignature: null,
  stableSnapshot: null
};

function getParentTargetOrigin() {
  const configured = pageParams.get("parent_origin") || pageParams.get("parentOrigin") || "";
  const candidates = [configured, document.referrer].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const origin = new URL(candidate, window.location.href).origin;
      if (origin && origin !== "null") return origin;
    } catch {
      // Ignore invalid origins.
    }
  }
  return "";
}

if (isEmbedded) {
  document.documentElement.classList.add("embedded");
  document.body.classList.add("embedded");
}

if (window.location.protocol === "file:") {
  renderError(translate("open_through_server"));
} else {
  hydrateAgentStep();
}

window.addEventListener("load", notifyParentHeight);
window.addEventListener("resize", notifyParentHeight);
window.addEventListener("beforeunload", stopRefreshLoop);

async function hydrateAgentStep() {
  const workitemId = pageParams.get("workitemid") || pageParams.get("workitemId") || "";
  if (!workitemId) {
    renderError(translate("missing_workitem"));
    return;
  }

  try {
    const configResponse = await fetch(buildApiUrl(`api/config?${pageParams.toString()}`));
    const configData = await configResponse.json();

    if (!configResponse.ok || !configData.configured) {
      renderError(configData.error || translate("campaign_misconfigured"));
      return;
    }

    state.language = getLanguage(configData.campaign);
    state.ui = resolvePageUi(configData.campaign, "nextStep");
    applyUiConfig(configData.campaign);
    await refreshAgentStep();

    const overrideSeconds = Number(pageParams.get("refresh_seconds") || pageParams.get("refreshSeconds") || 0);
    const configuredSeconds = Number(configData.campaign?.ui?.nextStep?.refreshIntervalSeconds || 30);
    state.refreshIntervalSeconds = normalizeRefreshInterval(overrideSeconds || configuredSeconds);
    startRefreshLoop();
  } catch (error) {
    renderError(translate("could_not_reach_server"));
  }
}

async function refreshAgentStep(force) {
  try {
    if (force) {
      state.lastTranscriptSignature = null;
      state.stableSnapshot = null;
    }

    const requestParams = new URLSearchParams(pageParams);
    if (force) {
      requestParams.set("_ts", String(Date.now()));
    }

    const response = await fetch(buildApiUrl(`api/agent-next-step?${requestParams.toString()}`), { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      renderError(data.error || translate("could_not_complete_request"));
      return;
    }

    renderWidget(data);
  } catch (error) {
    renderError(translate("could_not_complete_request"));
  } finally {
    state.regenerating = false;
  }
}

function renderWidget(data) {
  const snapshot = resolveStableSnapshot(data);
  const nextStep = snapshot?.nextStep || {};
  const article = snapshot?.article || null;
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const maxChips = Number(state.ui?.quickActionsLimit || 4);
  const quickActions = Array.isArray(nextStep.quickActions) ? nextStep.quickActions.slice(0, maxChips) : [];
  const hasMessages = messages.length > 0;

  agentStepBoard.innerHTML = "";

  const card = document.createElement("article");
  card.className = "agent-step-card";
  card.innerHTML = `
    <header class="agent-step-header">
      <div>
        <h2>${escapeHtml(state.ui?.titleText || translate("nextiq_assistant"))}</h2>
        <div class="agent-step-live">
          <span>${escapeHtml(translate("live_suggestions"))}</span>
          <span class="agent-step-live-dot"></span>
        </div>
      </div>
      <div class="agent-step-badges">
        <span class="agent-step-badge stage">${escapeHtml(getStageLabel(nextStep.stage))}</span>
        <span class="agent-step-badge urgency ${escapeHtml(nextStep.urgency || "medium")}">${escapeHtml(getUrgencyLabel(nextStep.urgency))}</span>
        <span class="agent-step-badge confidence">${escapeHtml(translate("confidence"))}: ${escapeHtml(String(Math.round(Number(nextStep.confidence || 0))))}%</span>
      </div>
    </header>

    ${!hasMessages ? `
      <div class="agent-step-waiting">
        <span class="agent-step-waiting-dot"></span>
        <span>${escapeHtml(translate("waiting_for_interaction"))}</span>
      </div>
    ` : ""}

    <section class="agent-step-main${!hasMessages ? " agent-step-main--dimmed" : ""}">
      <div class="agent-step-primary">
        <div class="agent-step-kicker">${escapeHtml(translate("next_step"))}</div>
        <h3>${escapeHtml(nextStep.actionTitle || translate("guide_response"))}</h3>
        <p>${escapeHtml(nextStep.actionDetail || "")}</p>
      </div>

      <div class="agent-step-quote-card">
        <div class="agent-step-quote-label">${escapeHtml(translate("suggested_response"))}</div>
        <blockquote>${escapeHtml(nextStep.suggestedPhrase || "")}</blockquote>
      </div>
    </section>

    <div class="agent-step-actions">
      <button class="agent-step-button" type="button" data-action="copy">
        ${state.copied ? buildCheckIcon() : buildCopyIcon()}
        <span>${escapeHtml(state.copied ? translate("copied") : translate("copy"))}</span>
      </button>
      <button class="agent-step-button" type="button" data-action="insert">
        ${buildInsertIcon()}
        <span>${escapeHtml(translate("insert"))}</span>
      </button>
      <button class="agent-step-button${state.regenerating ? " agent-step-button--loading" : ""}" type="button" data-action="regenerate" ${state.regenerating ? "disabled" : ""}>
        ${state.regenerating ? buildSpinnerIcon() : buildRefreshIcon()}
        <span>${escapeHtml(translate("regenerate"))}</span>
      </button>
    </div>

    <section class="agent-step-context">
      <div class="agent-step-article">
        <div class="agent-step-context-label">${escapeHtml(translate("recommended_article"))}</div>
        ${article
          ? `
            <a class="agent-step-article-card" href="${escapeHtml(article.url || "#")}" target="_blank" rel="noreferrer">
              <span class="agent-step-article-icon">${buildBookIcon()}</span>
              <span class="agent-step-article-copy">
                <strong>${escapeHtml(article.title || "Related article")}</strong>
                <span>${escapeHtml(article.description || nextStep.reason || "")}</span>
              </span>
              <span class="agent-step-article-cta">${escapeHtml(translate("open"))}</span>
            </a>
          `
          : `<div class="agent-step-empty-article">${escapeHtml(translate("no_article_found"))}</div>`}
      </div>

      <div class="agent-step-context-side">
        <div class="agent-step-quick-actions">
          ${quickActions.map((item) => `<span class="agent-step-chip">${escapeHtml(item)}</span>`).join("")}
        </div>
        <div class="agent-step-reason">${escapeHtml(nextStep.reason || "")}</div>
      </div>
    </section>

    <div class="agent-step-meta">
      <span>${escapeHtml(translate("messages"))}: ${messages.length}</span>
      <span>${escapeHtml(translate("auto_refresh"))}: ${state.refreshIntervalSeconds}s</span>
      <span>${escapeHtml(translate("updated"))}: ${new Date(snapshot?.updatedAt || data.updatedAt || Date.now()).toLocaleTimeString()}</span>
    </div>
  `;

  card.querySelector('[data-action="copy"]').addEventListener("click", async () => {
    if (state.copied) return;
    const copied = await copyText(nextStep.suggestedPhrase || "");
    if (!copied) return;
    state.copied = true;
    updateCopyButton(card, true);
    window.setTimeout(() => {
      state.copied = false;
      updateCopyButton(card, false);
    }, 1400);
  });

  card.querySelector('[data-action="insert"]').addEventListener("click", () => {
    const phrase = nextStep.suggestedPhrase || "";
    if (!phrase) return;
    if (isEmbedded) {
      const targetOrigin = getParentTargetOrigin();
      if (targetOrigin) {
        window.parent.postMessage({ type: "nextiq:insert", text: phrase }, targetOrigin);
      }
    } else {
      copyText(phrase);
    }
  });

  card.querySelector('[data-action="regenerate"]').addEventListener("click", async () => {
    if (state.regenerating) return;
    state.regenerating = true;
    setRegenerateLoading(card, true);
    await refreshAgentStep(true);
  });

  agentStepBoard.appendChild(card);
  notifyParentHeight();
}

function updateCopyButton(card, copied) {
  const btn = card.querySelector('[data-action="copy"]');
  if (!btn) return;
  btn.querySelector("svg").outerHTML = copied ? buildCheckIcon() : buildCopyIcon();
  btn.querySelector("span").textContent = translate(copied ? "copied" : "copy");
  // Re-set the svg since outerHTML replacement doesn't work on SVG without re-querying
  btn.innerHTML = `${copied ? buildCheckIcon() : buildCopyIcon()}<span>${escapeHtml(translate(copied ? "copied" : "copy"))}</span>`;
}

function setRegenerateLoading(card, loading) {
  const btn = card.querySelector('[data-action="regenerate"]');
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle("agent-step-button--loading", loading);
  btn.innerHTML = `${loading ? buildSpinnerIcon() : buildRefreshIcon()}<span>${escapeHtml(translate("regenerate"))}</span>`;
}

function resolveStableSnapshot(data) {
  const incomingSignature = String(data?.transcriptSignature || "").trim();
  if (
    incomingSignature &&
    state.lastTranscriptSignature !== null &&
    state.lastTranscriptSignature === incomingSignature &&
    state.stableSnapshot
  ) {
    return {
      ...state.stableSnapshot,
      messages: data?.messages || state.stableSnapshot.messages || [],
      transcriptSignature: incomingSignature
    };
  }

  const snapshot = {
    nextStep: data?.nextStep || {},
    article: data?.article || null,
    updatedAt: data?.updatedAt || Date.now(),
    transcriptSignature: incomingSignature
  };

  state.lastTranscriptSignature = incomingSignature || null;
  state.stableSnapshot = snapshot;
  return snapshot;
}

function getStageLabel(stage) {
  return translate(`stage_${normalizeStage(stage)}`);
}

function getUrgencyLabel(urgency) {
  return translate(`urgency_${normalizeUrgency(urgency)}`);
}

function normalizeStage(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["empathy", "clarify", "verify", "legal", "troubleshoot", "escalate", "close"].includes(normalized)
    ? normalized
    : "clarify";
}

function normalizeUrgency(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["low", "medium", "high"].includes(normalized) ? normalized : "medium";
}

function buildCopyIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="5" width="9" height="11" rx="2"></rect><path d="M5 13H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1"></path></svg>`;
}

function buildCheckIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8"></circle><path d="m6.5 10 2.5 2.5 4.5-5"></path></svg>`;
}

function buildInsertIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v10"></path><path d="m6 9 4 4 4-4"></path><path d="M4 17h12"></path></svg>`;
}

function buildRefreshIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10a6 6 0 1 1-1.5-4"></path><path d="M16 4v4h-4"></path></svg>`;
}

function buildSpinnerIcon() {
  return `<svg class="agent-step-spinner" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="32" stroke-dashoffset="12" stroke-linecap="round"></circle></svg>`;
}

function buildBookIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 4.5A2.5 2.5 0 0 1 6 2h3.5v14H6a2.5 2.5 0 0 0-2.5 2V4.5Z"></path><path d="M16.5 4.5A2.5 2.5 0 0 0 14 2h-3.5v14H14a2.5 2.5 0 0 1 2.5 2V4.5Z"></path></svg>`;
}

function applyUiConfig(campaign) {
  const ui = resolvePageUi(campaign, "nextStep");
  document.documentElement.style.setProperty("--campaign-font-family", ui.fontFamily || "Manrope, sans-serif");
  document.documentElement.style.setProperty("--campaign-base-font-size", ui.baseFontSize || "16px");
  document.documentElement.style.setProperty("--campaign-next-step-title-size", ui.titleSize || "2rem");
  document.documentElement.style.setProperty("--campaign-next-step-card-shadow", ui.showCardShadow === false ? "none" : "0 22px 60px rgba(26, 40, 82, 0.12)");
  document.documentElement.style.setProperty("--campaign-next-step-inner-shadow", ui.showCardShadow === false ? "none" : "0 14px 30px rgba(30, 44, 89, 0.08)");
  document.documentElement.style.setProperty("--campaign-next-step-article-shadow", ui.showCardShadow === false ? "none" : "0 12px 24px rgba(30, 44, 89, 0.06)");
  document.documentElement.style.setProperty("--campaign-next-step-live-size", ui.liveSize || "1rem");
  document.documentElement.style.setProperty("--campaign-next-step-badge-size", ui.badgeSize || "0.82rem");
  document.documentElement.style.setProperty("--campaign-next-step-kicker-size", ui.kickerSize || "0.86rem");
  document.documentElement.style.setProperty("--campaign-next-step-action-title-size", ui.actionTitleSize || "1.6rem");
  document.documentElement.style.setProperty("--campaign-next-step-action-text-size", ui.actionTextSize || "1rem");
  document.documentElement.style.setProperty("--campaign-next-step-suggested-label-size", ui.suggestedLabelSize || "0.84rem");
  document.documentElement.style.setProperty("--campaign-next-step-suggested-text-size", ui.suggestedTextSize || "1.35rem");
  document.documentElement.style.setProperty("--campaign-next-step-button-text-size", ui.buttonTextSize || "1rem");
  document.documentElement.style.setProperty("--campaign-next-step-article-title-size", ui.articleTitleSize || "1rem");
  document.documentElement.style.setProperty("--campaign-next-step-article-text-size", ui.articleTextSize || "0.84rem");
  document.documentElement.style.setProperty("--campaign-next-step-chip-size", ui.chipSize || "0.84rem");
  document.documentElement.style.setProperty("--campaign-next-step-reason-size", ui.reasonSize || "0.92rem");
  document.documentElement.style.setProperty("--campaign-next-step-meta-font-size", ui.metaFontSize || "0.8rem");
}

function resolvePageUi(campaign, pageKey) {
  const ui = campaign?.ui || {};
  return {
    ...(ui.shared || {}),
    ...(ui[pageKey] || {})
  };
}

function startRefreshLoop() {
  stopRefreshLoop();
  state.refreshTimer = window.setInterval(refreshAgentStep, state.refreshIntervalSeconds * 1000);
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

function renderError(message) {
  agentStepBoard.innerHTML = `<article class="agent-step-card agent-step-empty"><p>${escapeHtml(message)}</p></article>`;
  notifyParentHeight();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    return false;
  }
}

function notifyParentHeight() {
  if (!isEmbedded) return;
  requestAnimationFrame(() => {
    const height = Math.ceil(document.body.scrollHeight);
    window.parent.postMessage({ type: "nextiq:resize", height }, "*");
  });
}

function buildApiUrl(pathname) {
  return new URL(pathname, apiBaseUrl).toString();
}

function escapeHtml(value) {
  return String(value)
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
