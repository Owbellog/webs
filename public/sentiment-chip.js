const sentimentChipBoard = document.getElementById("sentimentChipBoard");

const apiBaseUrl = new URL(".", window.location.href);
const pageParams = new URLSearchParams(window.location.search);
const isEmbedded = window.self !== window.top || pageParams.get("embed") === "1";

const state = {
  refreshTimer: null,
  refreshIntervalSeconds: 30,
  resizeObserver: null,
  language: "en"
};

if (isEmbedded) {
  document.documentElement.classList.add("embedded");
  document.body.classList.add("embedded");
}

if (window.location.protocol === "file:") {
  renderError(translate("open_through_server"));
} else {
  hydrateSentimentChip();
}

window.addEventListener("load", notifyParentHeight);
window.addEventListener("resize", syncChipScale);
window.addEventListener("beforeunload", stopRefreshLoop);

async function hydrateSentimentChip() {
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
    applyUiConfig(configData.campaign);
    await refreshSentimentChip();

    const overrideSeconds = Number(pageParams.get("refresh_seconds") || pageParams.get("refreshSeconds") || 0);
    const configuredSeconds = Number(configData.campaign?.ui?.sentiment?.refreshIntervalSeconds || 30);
    state.refreshIntervalSeconds = normalizeRefreshInterval(overrideSeconds || configuredSeconds);
    startRefreshLoop();
  } catch (error) {
    renderError(translate("could_not_reach_server"));
  }
}

async function refreshSentimentChip() {
  try {
    const response = await fetch(buildApiUrl(`api/workitem?${pageParams.toString()}`), { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      renderError(data.error || translate("sentiment_request_failed"));
      return;
    }

    renderChip(data);
  } catch (error) {
    renderError(translate("could_not_refresh_sentiment"));
  }
}

function renderChip(data) {
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const summary = buildSentimentSummary(messages);

  sentimentChipBoard.innerHTML = "";

  const card = document.createElement("article");
  card.className = `sentiment-chip-card ${summary.color}`;
  card.innerHTML = `
    <div class="sentiment-chip-orb ${summary.color}">
      <div class="sentiment-orb-glow"></div>
      <div class="sentiment-heart" aria-hidden="true"></div>
    </div>
    <div class="sentiment-chip-copy">
      <div class="sentiment-chip-label ${summary.color}">${summary.label}</div>
      <div class="sentiment-chip-score">${formatScore(summary.score)}</div>
    </div>
  `;

  sentimentChipBoard.appendChild(card);
  startResizeObserver();
  syncChipScale();
  notifyParentHeight();
}

function buildSentimentSummary(messages) {
  const normalizedScores = messages.map((item) => normalizeMessageScore(item.sentiment?.score || 0));
  const score = normalizedScores.length
    ? normalizedScores.reduce((sum, value) => sum + value, 0) / normalizedScores.length
    : 0;

  let color = "yellow";
  let label = translate("neutral");

  if (score <= -0.2) {
    color = "red";
    label = translate("negative");
  } else if (score >= 0.2) {
    color = "green";
    label = translate("positive");
  }

  return {
    color,
    label,
    score
  };
}

function normalizeMessageScore(score) {
  const parsed = Number(score || 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(-1, Math.min(1, parsed));
}

function renderError(message) {
  stopRefreshLoop();
  stopResizeObserver();
  sentimentChipBoard.innerHTML = `
    <article class="sentiment-chip-card sentiment-chip-empty">
      <p>${escapeHtml(message)}</p>
    </article>
  `;
  notifyParentHeight();
}

function applyUiConfig(campaign) {
  const ui = resolvePageUi(campaign, "sentiment");
  document.documentElement.style.setProperty("--campaign-font-family", ui.fontFamily || "Manrope, sans-serif");
  document.documentElement.style.setProperty("--campaign-base-font-size", ui.baseFontSize || "16px");
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
  state.refreshTimer = window.setInterval(refreshSentimentChip, state.refreshIntervalSeconds * 1000);
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

function startResizeObserver() {
  stopResizeObserver();
  if (!window.ResizeObserver || !sentimentChipBoard) {
    return;
  }

  state.resizeObserver = new ResizeObserver(() => {
    syncChipScale();
    notifyParentHeight();
  });

  state.resizeObserver.observe(sentimentChipBoard);
}

function stopResizeObserver() {
  if (state.resizeObserver) {
    state.resizeObserver.disconnect();
    state.resizeObserver = null;
  }
}

function syncChipScale() {
  const card = sentimentChipBoard.querySelector(".sentiment-chip-card");
  if (!card) {
    return;
  }

  const boardWidth = sentimentChipBoard.clientWidth || 250;
  const boardHeight = sentimentChipBoard.clientHeight || 250;
  const basis = Math.max(120, Math.min(boardWidth, boardHeight, 250));

  card.style.setProperty("--sentiment-chip-basis", `${basis}px`);
}

function formatScore(score) {
  const rounded = Math.round(score * 100) / 100;
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(2)}`;
}

function notifyParentHeight() {
  if (!isEmbedded) {
    return;
  }

  const height = Math.ceil(document.documentElement.scrollHeight);
  window.parent.postMessage({ type: "nextiq:resize", height }, "*");
}

function buildApiUrl(pathname) {
  const normalized = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return new URL(normalized, apiBaseUrl).toString();
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
