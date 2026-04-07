const sentimentBarBoard = document.getElementById("sentimentBarBoard");

const apiBaseUrl = new URL(".", window.location.href);
const pageParams = new URLSearchParams(window.location.search);
const isEmbedded = window.self !== window.top || pageParams.get("embed") === "1";

const WIDGET_MODES = ["full", "orb", "risk", "trend", "action"];

const state = {
  refreshTimer: null,
  refreshIntervalSeconds: 30,
  expanded: false,
  language: "en",
  widgetMode: "full"
};

if (isEmbedded) {
  document.documentElement.classList.add("embedded");
  document.body.classList.add("embedded");
}

if (window.location.protocol === "file:") {
  renderError(translate("open_through_server"));
} else {
  hydrateSentimentBar();
}

window.addEventListener("load", notifyParentHeight);
window.addEventListener("resize", notifyParentHeight);
window.addEventListener("beforeunload", stopRefreshLoop);

function renderLoading() {
  sentimentBarBoard.innerHTML = `
    <article class="sentiment-bar-card sentiment-bar-empty sentiment-bar-loading">
      <div class="sentiment-bar-spinner" aria-label="Loading" role="status"></div>
    </article>
  `;
}

async function hydrateSentimentBar() {
  const workitemId = pageParams.get("workitemid") || pageParams.get("workitemId") || "";
  if (!workitemId) {
    renderError(translate("missing_workitem"));
    return;
  }

  renderLoading();

  try {
    const configResponse = await fetch(buildApiUrl(`api/config?${pageParams.toString()}`));
    const configData = await configResponse.json();

    if (!configResponse.ok || !configData.configured) {
      renderError(configData.error || translate("campaign_misconfigured"));
      return;
    }

    state.language = getLanguage(configData.campaign);
    const widgetParam = pageParams.get("widget") || "full";
    state.widgetMode = WIDGET_MODES.includes(widgetParam) ? widgetParam : "full";
    document.body.classList.add(`widget-${state.widgetMode}`);
    applyUiConfig(configData.campaign);
    await refreshSentimentBar();

    const overrideSeconds = Number(pageParams.get("refresh_seconds") || pageParams.get("refreshSeconds") || 0);
    const configuredSeconds = Number(configData.campaign?.ui?.sentiment?.refreshIntervalSeconds || 30);
    state.refreshIntervalSeconds = normalizeRefreshInterval(overrideSeconds || configuredSeconds);
    startRefreshLoop();
  } catch (error) {
    renderError(translate("could_not_reach_server"));
  }
}

async function refreshSentimentBar() {
  try {
    const response = await fetch(buildApiUrl(`api/workitem?${pageParams.toString()}`), { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      renderError(data.error || translate("sentiment_request_failed"));
      return;
    }

    renderWidget(data);
  } catch (error) {
    renderError(translate("could_not_refresh_sentiment"));
  }
}

function renderWidget(data) {
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const summary = buildSentimentSummary(messages);
  sentimentBarBoard.innerHTML = "";

  if (state.widgetMode === "orb") { renderWidgetOrb(summary); return; }
  if (state.widgetMode === "risk") { renderWidgetRisk(summary); return; }
  if (state.widgetMode === "trend") { renderWidgetTrend(summary, messages.length); return; }
  if (state.widgetMode === "action") { renderWidgetAction(summary); return; }

  renderBar(data);
}

function renderWidgetOrb(summary) {
  const card = document.createElement("article");
  card.className = `widget-orb-card ${summary.color}`;
  card.innerHTML = `
    <div class="widget-orb-circle ${summary.color}">
      ${buildHeartIcon(summary.color)}
    </div>
    <div class="widget-orb-label ${summary.color}">${escapeHtml(summary.label)}</div>
    <div class="widget-orb-score">${escapeHtml(formatScore(summary.score))}</div>
  `;
  sentimentBarBoard.appendChild(card);
  notifyParentHeight();
}

function renderWidgetRisk(summary) {
  const card = document.createElement("article");
  card.className = `widget-risk-card ${summary.riskTone}`;
  card.innerHTML = `
    <span class="widget-risk-dot"></span>
    <span class="widget-risk-label">${escapeHtml(summary.riskLabel)}</span>
  `;
  sentimentBarBoard.appendChild(card);
  notifyParentHeight();
}

function renderWidgetTrend(summary, messageCount) {
  const card = document.createElement("article");
  card.className = `widget-trend-card ${summary.color}`;
  card.innerHTML = `
    <div class="widget-trend-header">
      <span class="widget-trend-label">${translate("trend")}</span>
      <strong class="widget-trend-value ${summary.color}">${escapeHtml(summary.trendLabel)}</strong>
    </div>
    <div class="widget-trend-sparkline">
      <svg viewBox="0 0 220 66" preserveAspectRatio="none" aria-hidden="true">
        <path class="spark-grid" d="M0 12 H220 M0 33 H220 M0 54 H220 M55 0 V66 M110 0 V66 M165 0 V66"></path>
        <path class="spark-area ${summary.color}" d="${buildAreaPath(summary.points)}"></path>
        <path class="spark-line ${summary.color}" d="${buildLinePath(summary.points)}"></path>
        <path class="spark-arrow ${summary.color}" d="${buildArrowPath(summary.points)}"></path>
        ${buildPointDots(summary.points, summary.color)}
      </svg>
    </div>
    <div class="widget-trend-meta">${translate("messages")}: ${messageCount} · ${new Date().toLocaleTimeString()}</div>
  `;
  sentimentBarBoard.appendChild(card);
  notifyParentHeight();
}

function renderWidgetAction(summary) {
  const card = document.createElement("article");
  card.className = `widget-action-card ${summary.color}`;
  card.innerHTML = `
    <div class="widget-action-title">
      ${buildIdeaIcon()}
      <span>${translate("suggested_action")}</span>
    </div>
    <p class="widget-action-text">${escapeHtml(summary.actionText)}</p>
    <button class="sentiment-bar-action-button widget-action-button" type="button">
      ${buildArrowIcon()}
      <span>${summary.buttonLabel}</span>
    </button>
  `;
  const btn = card.querySelector(".widget-action-button");
  const btnLabel = btn.querySelector("span");
  btn.addEventListener("click", async () => {
    const didCopy = await copyAction(summary.actionText);
    if (didCopy) {
      btnLabel.textContent = translate("copied");
      window.setTimeout(() => { btnLabel.textContent = summary.buttonLabel; }, 1400);
    }
  });
  sentimentBarBoard.appendChild(card);
  notifyParentHeight();
}

function renderBar(data) {
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const summary = buildSentimentSummary(messages);

  sentimentBarBoard.innerHTML = "";

  const card = document.createElement("article");
  card.className = `sentiment-bar-card ${summary.color}${state.expanded ? " expanded" : ""}`;
  card.title = summary.why;
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-expanded", state.expanded ? "true" : "false");
  card.addEventListener("click", () => {
    state.expanded = !state.expanded;
    renderBar(data);
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      state.expanded = !state.expanded;
      renderBar(data);
    }
  });

  card.innerHTML = `
    <div class="sentiment-bar-main">
      <section class="sentiment-bar-zone sentiment-bar-status">
        <div class="sentiment-bar-icon-wrap">
          <div class="sentiment-bar-orb ${summary.color}">
            ${buildHeartIcon(summary.color)}
          </div>
        </div>
        <div class="sentiment-bar-status-copy">
          <div class="sentiment-bar-headline">${escapeHtml(summary.label)} <span>${escapeHtml(formatScore(summary.score))}</span></div>
          <div class="sentiment-bar-subline">
            ${buildAlertIcon()}
            <span>${escapeHtml(summary.trendText)}</span>
          </div>
          <div class="sentiment-bar-risk ${summary.riskTone}">
            <span class="sentiment-bar-risk-dot"></span>
            <span>${escapeHtml(summary.riskLabel)}</span>
          </div>
        </div>
      </section>

      <section class="sentiment-bar-zone sentiment-bar-trend">
        <div class="sentiment-bar-trend-copy">
          <span class="sentiment-bar-trend-label">${translate("trend")}</span>
          <strong>${escapeHtml(summary.trendLabel)}</strong>
        </div>
        <div class="sentiment-bar-sparkline">
          <svg viewBox="0 0 220 66" preserveAspectRatio="none" aria-hidden="true">
            <path class="spark-grid" d="M0 12 H220 M0 33 H220 M0 54 H220 M55 0 V66 M110 0 V66 M165 0 V66"></path>
            <path class="spark-area ${summary.color}" d="${buildAreaPath(summary.points)}"></path>
            <path class="spark-line ${summary.color}" d="${buildLinePath(summary.points)}"></path>
            <path class="spark-arrow ${summary.color}" d="${buildArrowPath(summary.points)}"></path>
            ${buildPointDots(summary.points, summary.color)}
          </svg>
        </div>
      </section>
    </div>

    <div class="sentiment-bar-action-row">
      <div class="sentiment-bar-action-copy">
        <div class="sentiment-bar-action-title">
          ${buildIdeaIcon()}
          <span>${translate("suggested_action")}</span>
        </div>
        <p>${escapeHtml(summary.actionText)}</p>
      </div>
      <button class="sentiment-bar-action-button" type="button">
        ${buildArrowIcon()}
        <span>${summary.buttonLabel}</span>
      </button>
    </div>

    <div class="sentiment-bar-footer">
      <div class="sentiment-bar-why"><strong>${translate("why")}:</strong> ${escapeHtml(summary.why)}</div>
      <div class="sentiment-bar-meta">${translate("auto_refresh")}: ${state.refreshIntervalSeconds}s | ${translate("messages")}: ${messages.length} | ${translate("updated")}: ${new Date().toLocaleTimeString()}</div>
    </div>
  `;

  const actionButton = card.querySelector(".sentiment-bar-action-button");
  const actionButtonLabel = actionButton.querySelector("span");
  actionButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    const didCopy = await copyAction(summary.actionText);
    if (didCopy) {
      actionButtonLabel.textContent = translate("copied");
      window.setTimeout(() => {
        actionButtonLabel.textContent = summary.buttonLabel;
      }, 1400);
    }
  });

  sentimentBarBoard.appendChild(card);
  notifyParentHeight();
}

function buildSentimentSummary(messages) {
  const normalizedScores = messages.map((item) => normalizeMessageScore(item.sentiment?.score || 0));
  const score = computeOverallSentimentScore(normalizedScores);
  const trend = computeTrend(normalizedScores);
  const why = buildWhyText(messages, score, trend);

  let color = "yellow";
  let label = translate("neutral");
  let riskLabel = translate("medium_risk");
  let riskTone = "medium";
  let actionText = translate("action_neutral");
  let buttonLabel = translate("guide_response");

  if (score <= -0.2) {
    color = "red";
    label = translate("negative");
    riskLabel = score <= -0.55 || trend.direction === "down" ? translate("high_risk") : translate("elevated_risk");
    riskTone = riskLabel === translate("high_risk") ? "high" : "medium";
    actionText = trend.direction === "down"
      ? translate("action_negative_down")
      : translate("action_negative");
    buttonLabel = translate("suggest_empathy");
  } else if (score >= 0.2) {
    color = "green";
    label = translate("positive");
    riskLabel = translate("low_risk");
    riskTone = "low";
    actionText = translate("action_positive");
    buttonLabel = translate("suggest_recap");
  }

  return {
    color,
    label,
    score,
    riskLabel,
    riskTone,
    actionText,
    buttonLabel,
    trendLabel: trend.label,
    trendText: trend.description,
    why,
    points: normalizedScores.length ? normalizedScores.slice(-8) : [0]
  };
}

function computeOverallSentimentScore(scores) {
  if (!scores.length) {
    return 0;
  }

  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const minimum = Math.min(...scores);
  const maximum = Math.max(...scores);
  const negativeCount = scores.filter((value) => value <= -0.35).length;
  const positiveCount = scores.filter((value) => value >= 0.35).length;
  const negativeShare = negativeCount / scores.length;
  const positiveShare = positiveCount / scores.length;

  if (minimum <= -0.85 && average <= -0.05) {
    return Math.min(-1, average * 0.45 + minimum * 0.75);
  }

  if (negativeShare >= 0.25 && average < 0) {
    return Math.min(-1, average * 0.65 + minimum * 0.45);
  }

  if (positiveShare >= 0.25 && average > 0) {
    return Math.max(0, average * 0.65 + maximum * 0.45);
  }

  return average;
}

function computeTrend(scores) {
  if (scores.length < 2) {
    return {
      direction: "flat",
      label: translate("stable"),
      description: translate("tone_stable")
    };
  }

  const recent = scores.slice(-4);
  const previous = scores.slice(-8, -4);
  const recentAverage = averageList(recent);
  const previousAverage = previous.length ? averageList(previous) : scores[0];
  const delta = recentAverage - previousAverage;

  if (delta <= -0.12) {
    return {
      direction: "down",
      label: translate("worsening"),
      description: translate("frustration_increasing")
    };
  }

  if (delta >= 0.12) {
    return {
      direction: "up",
      label: translate("improving"),
      description: translate("tone_improving")
    };
  }

  return {
    direction: "flat",
    label: translate("stable"),
    description: translate("tone_stable")
  };
}

function averageList(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildWhyText(messages, score, trend) {
  const negativeMessages = messages
    .filter((item) => normalizeMessageScore(item.sentiment?.score || 0) <= -0.35)
    .slice(-2)
    .map((item) => trimSnippet(item.text, 90));

  if (negativeMessages.length) {
    return `${trend.description}. ${translate("signals_detected_in")}: ${negativeMessages.join(" | ")}`;
  }

  if (score <= -0.2) {
    return translate("sentiment_negative_why");
  }

  if (score >= 0.2) {
    return translate("sentiment_positive_why");
  }

  return translate("sentiment_mixed");
}

function trimSnippet(text, maxLength) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}...`;
}

function normalizeMessageScore(score) {
  const parsed = Number(score || 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(-1, Math.min(1, parsed));
}

function buildLinePath(points) {
  const coords = buildChartCoords(points);
  return coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function buildAreaPath(points) {
  const coords = buildChartCoords(points);
  if (!coords.length) {
    return "";
  }

  const first = coords[0];
  const last = coords[coords.length - 1];
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  return `${line} L ${last.x} 60 L ${first.x} 60 Z`;
}

function buildArrowPath(points) {
  const coords = buildChartCoords(points);
  const last = coords[coords.length - 1] || { x: 204, y: 18 };
  return `M ${last.x - 18} ${last.y - 6} L ${last.x} ${last.y - 14} L ${last.x - 8} ${last.y - 14} M ${last.x} ${last.y - 14} L ${last.x - 10} ${last.y - 2}`;
}

function buildPointDots(points, color) {
  const coords = buildChartCoords(points);
  return coords
    .map((point) => `<circle class="spark-dot ${color}" cx="${point.x}" cy="${point.y}" r="3.8"></circle>`)
    .join("");
}

function buildChartCoords(points) {
  const list = points.length ? points : [0];
  const step = list.length > 1 ? 190 / (list.length - 1) : 0;

  return list.map((value, index) => {
    const normalized = (value + 1) / 2;
    return {
      x: 12 + step * index,
      y: 52 - normalized * 32
    };
  });
}

function renderError(message) {
  stopRefreshLoop();
  sentimentBarBoard.innerHTML = `
    <article class="sentiment-bar-card sentiment-bar-empty">
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
  state.refreshTimer = window.setInterval(refreshSentimentBar, state.refreshIntervalSeconds * 1000);
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

async function copyAction(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    return false;
  }
}

function formatScore(score) {
  return `${score >= 0 ? "+" : ""}${score.toFixed(2)}`;
}

function buildHeartIcon(color) {
  if (color === "red") {
    return `
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <defs>
          <linearGradient id="barHeartRed" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stop-color="#f29b90"></stop>
            <stop offset="100%" stop-color="#d75858"></stop>
          </linearGradient>
        </defs>
        <path fill="url(#barHeartRed)" d="M36 61c-8.1-6.9-13.9-12.4-17.4-16.4C13 38.3 10 33 10 26.9 10 16.5 18.1 9 27.7 9c5.5 0 10.9 2.4 14.3 6.2C45.4 11.4 50.8 9 56.3 9 65.9 9 74 16.5 74 26.9c0 6.1-3 11.4-8.6 17.7C61.9 48.6 56.1 54.1 48 61l-6 5.2Z" transform="translate(-6 -2) scale(0.92)"></path>
        <path fill="#fff3ee" d="M35 25 30 38l8 7-3 13 12-18-7-7 3-11Z" opacity="0.82"></path>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 72 72" aria-hidden="true">
      <defs>
        <linearGradient id="barHeartDefault" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="${color === "green" ? "#8be09b" : "#ffd778"}"></stop>
          <stop offset="100%" stop-color="${color === "green" ? "#2fae59" : "#e2a637"}"></stop>
        </linearGradient>
      </defs>
      <path fill="url(#barHeartDefault)" d="M36 61c-8.1-6.9-13.9-12.4-17.4-16.4C13 38.3 10 33 10 26.9 10 16.5 18.1 9 27.7 9c5.5 0 10.9 2.4 14.3 6.2C45.4 11.4 50.8 9 56.3 9 65.9 9 74 16.5 74 26.9c0 6.1-3 11.4-8.6 17.7C61.9 48.6 56.1 54.1 48 61l-6 5.2Z" transform="translate(-6 -2) scale(0.92)"></path>
      <circle cx="36" cy="34" r="8" fill="#fff9ea"></circle>
    </svg>
  `;
}

function buildAlertIcon() {
  return `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2 19 18H1L10 2Z"></path>
      <path d="M10 7v4"></path>
      <circle cx="10" cy="14" r="1"></circle>
    </svg>
  `;
}

function buildIdeaIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a7 7 0 0 0-4.9 12l.8.8c.6.6 1 1.3 1.1 2.1h6c.1-.8.5-1.5 1.1-2.1l.8-.8A7 7 0 0 0 12 3Z"></path>
      <path d="M9 21h6"></path>
      <path d="M10 18h4"></path>
    </svg>
  `;
}

function buildArrowIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h12"></path>
      <path d="m12 5 7 7-7 7"></path>
    </svg>
  `;
}

function notifyParentHeight() {
  if (!isEmbedded) {
    return;
  }

  requestAnimationFrame(() => {
    const height = Math.ceil(document.body.scrollHeight);
    window.parent.postMessage({ type: "nextiq:resize", height }, "*");
  });
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
