const sentimentBoard = document.getElementById("sentimentBoard");
const welcomeCard = document.getElementById("welcomeCard");
const campaignBadge = document.getElementById("campaignBadge");
const brandTitle = document.getElementById("brandTitle");
const brandBar = document.getElementById("brandbar");
const sentimentShell = document.querySelector(".sentiment-shell");

const apiBaseUrl = new URL(".", window.location.href);
const pageParams = new URLSearchParams(window.location.search);
const isEmbedded = window.self !== window.top || pageParams.get("embed") === "1";

const state = {
  refreshTimer: null,
  refreshIntervalSeconds: 30,
  config: null,
  ui: null,
  language: "en"
};

if (isEmbedded) {
  document.documentElement.classList.add("embedded");
  document.body.classList.add("embedded");
}

if (window.location.protocol === "file:") {
  renderError(translate("open_through_server"));
} else {
  hydrateSentiment();
}

window.addEventListener("load", notifyParentHeight);
window.addEventListener("resize", notifyParentHeight);
window.addEventListener("resize", updateViewportMode);
window.addEventListener("beforeunload", stopRefreshLoop);

async function hydrateSentiment() {
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

    state.config = configData.campaign;
    state.language = getLanguage(configData.campaign);
    applyUiConfig(configData.campaign);
    renderCampaignBadge(configData.campaign, workitemId);
    await refreshSentiment();

    const overrideSeconds = Number(pageParams.get("refresh_seconds") || pageParams.get("refreshSeconds") || 0);
    const configuredSeconds = Number(configData.campaign?.ui?.sentiment?.refreshIntervalSeconds || 30);
    state.refreshIntervalSeconds = normalizeRefreshInterval(overrideSeconds || configuredSeconds);
    startRefreshLoop();
  } catch (error) {
    renderError(translate("could_not_reach_server"));
  }
}

async function refreshSentiment() {
  try {
    const response = await fetch(buildApiUrl(`api/workitem?${pageParams.toString()}`), { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      renderError(data.error || translate("sentiment_request_failed"));
      return;
    }

    renderSentimentBoard(data);
  } catch (error) {
    renderError(translate("could_not_refresh_sentiment"));
  }
}

function startRefreshLoop() {
  stopRefreshLoop();
  state.refreshTimer = window.setInterval(refreshSentiment, state.refreshIntervalSeconds * 1000);
}

function stopRefreshLoop() {
  if (state.refreshTimer) {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }
}

function renderSentimentBoard(data) {
  hideWelcome();
  sentimentBoard.innerHTML = "";

  const messages = Array.isArray(data.messages) ? data.messages : [];
  const summary = buildSentimentSummary(messages);
  const card = document.createElement("article");
  card.className = `sentiment-card ${summary.color}`;

  const primary = document.createElement("div");
  primary.className = "sentiment-primary";

  const title = document.createElement("h1");
  title.className = "sentiment-card-title";
  title.textContent = translate("sentiment");
  primary.appendChild(title);

  const orb = document.createElement("div");
  orb.className = `sentiment-orb ${summary.color}`;
  orb.innerHTML = `
    <div class="sentiment-heart" aria-hidden="true"></div>
    <div class="sentiment-orb-glow"></div>
  `;
  primary.appendChild(orb);

  const label = document.createElement("div");
  label.className = `sentiment-label ${summary.color}`;
  label.textContent = summary.label;
  primary.appendChild(label);

  const score = document.createElement("div");
  score.className = "sentiment-score";
  score.textContent = formatScore(summary.score);
  primary.appendChild(score);

  card.appendChild(primary);

  const secondary = document.createElement("div");
  secondary.className = "sentiment-secondary";

  const divider = document.createElement("div");
  divider.className = "sentiment-divider";
  secondary.appendChild(divider);

  const footer = document.createElement("div");
  footer.className = "sentiment-footer";

  const insight = document.createElement("div");
  insight.className = "sentiment-insight";
  insight.innerHTML = `
    <div class="sentiment-search-icon"></div>
    <div>
      <strong>${summary.insightTitle}</strong>
      <span>${summary.insightText}</span>
    </div>
  `;
  footer.appendChild(insight);

  const chart = document.createElement("div");
  chart.className = "sentiment-mini-chart";
  chart.innerHTML = `
    <svg viewBox="0 0 220 84" preserveAspectRatio="none" aria-hidden="true">
      <path class="sentiment-mini-area ${summary.color}" d="${buildAreaPath(summary.points)}"></path>
      <path class="sentiment-mini-line ${summary.color}" d="${buildLinePath(summary.points)}"></path>
      <path class="sentiment-mini-arrow ${summary.color}" d="${buildArrowPath(summary.points)}"></path>
    </svg>
  `;
  footer.appendChild(chart);

  secondary.appendChild(footer);

  const meta = document.createElement("div");
  meta.className = "sentiment-meta";
  meta.textContent = `${translate("auto_refresh")}: ${state.refreshIntervalSeconds}s | ${translate("messages")}: ${messages.length} | ${translate("updated")}: ${new Date().toLocaleTimeString()}`;
  secondary.appendChild(meta);

  card.appendChild(secondary);

  sentimentBoard.appendChild(card);
  notifyParentHeight();
}

function buildSentimentSummary(messages) {
  const normalizedScores = messages.map((item) => normalizeMessageScore(item.sentiment?.score || 0));
  const score = computeOverallSentimentScore(normalizedScores);

  let color = "yellow";
  let label = translate("neutral");
  let insightTitle = translate("steady_tone");
  let insightText = translate("balanced_interaction");

  if (score <= -0.2) {
    color = "red";
    label = translate("negative");
    insightTitle = translate("customer_frustration");
    insightText = translate("escalation_cues");
  } else if (score >= 0.2) {
    color = "green";
    label = translate("positive");
    insightTitle = translate("calm_tone");
    insightText = translate("positive_interaction");
  }

  return {
    color,
    label,
    score,
    insightTitle,
    insightText,
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

  // Prevent a few neutral messages from washing out explicit frustration or cancellation cues.
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
  return `${line} L ${last.x} 78 L ${first.x} 78 Z`;
}

function buildArrowPath(points) {
  const coords = buildChartCoords(points);
  const last = coords[coords.length - 1] || { x: 200, y: 24 };
  return `M ${last.x - 10} ${last.y - 2} L ${last.x} ${last.y - 12} L ${last.x - 2} ${last.y - 12} M ${last.x} ${last.y - 12} L ${last.x - 8} ${last.y - 12}`;
}

function buildChartCoords(points) {
  const list = points.length ? points : [0];
  const step = list.length > 1 ? 180 / (list.length - 1) : 0;

  return list.map((value, index) => {
    const normalized = (value + 1) / 2;
    return {
      x: 20 + step * index,
      y: 68 - normalized * 44
    };
  });
}

function renderCampaignBadge(campaign, workitemId) {
  if (!campaignBadge) {
    return;
  }

  const pageUi = resolvePageUi(campaign, "sentiment");
  if (pageUi.showMeta === false) {
    campaignBadge.hidden = true;
    refreshHeaderVisibility();
    return;
  }

  const parts = [];
  if (campaign.name) {
    parts.push(campaign.name);
  }
  if (campaign.domain) {
    parts.push(campaign.domain);
  }
  parts.push(`${translate("workitem")}: ${workitemId}`);

  campaignBadge.textContent = parts.join(" | ");
  campaignBadge.hidden = false;
  refreshHeaderVisibility();
}

function applyUiConfig(campaign) {
  const ui = {
    ...resolvePageUi(campaign, "sentiment"),
    ...readUiOverrides(pageParams)
  };

  state.ui = ui;

  if (sentimentShell) {
    sentimentShell.classList.toggle("page-header-hidden", ui.showPageHeader === false);
  }

  if (brandTitle) {
    brandTitle.textContent = ui.titleText || translate("sentiment");
    brandTitle.hidden = ui.showTitle === false;
  }

  document.documentElement.style.setProperty("--campaign-font-family", ui.fontFamily || "Manrope, sans-serif");
  document.documentElement.style.setProperty("--campaign-base-font-size", ui.baseFontSize || "16px");
  document.documentElement.style.setProperty("--campaign-title-size", ui.titleSize || "2rem");
  document.documentElement.style.setProperty("--campaign-meta-size", ui.metaSize || "0.82rem");
  document.documentElement.style.setProperty("--campaign-embed-min-height", ui.embedMinHeight || "180px");
  document.documentElement.style.setProperty("--campaign-embed-max-height", ui.embedMaxHeight || "520px");
  document.documentElement.style.setProperty("--campaign-sentiment-card-max-width", ui.sentimentCardMaxWidth || "560px");
  document.documentElement.style.setProperty("--campaign-sentiment-card-min-height", ui.sentimentCardMinHeight || "0px");
  document.documentElement.style.setProperty("--campaign-sentiment-card-max-height", ui.sentimentCardMaxHeight || "none");
  document.documentElement.style.setProperty("--campaign-sentiment-card-padding", ui.sentimentCardPadding || "34px 40px 28px");
  document.documentElement.style.setProperty("--campaign-sentiment-card-radius", ui.sentimentCardRadius || "38px");
  document.documentElement.style.setProperty("--campaign-sentiment-orb-size", ui.sentimentOrbSize || "180px");
  document.documentElement.style.setProperty("--campaign-sentiment-dual-panel-glow-size", ui.sentimentDualPanelGlowSize || "180px");
  document.documentElement.style.setProperty("--campaign-sentiment-dual-panel-section-gap", ui.sentimentDualPanelSectionGap || "0px");
  document.documentElement.style.setProperty("--campaign-sentiment-dual-panel-text-orb-gap", ui.sentimentDualPanelTextOrbGap || "18px");
  document.documentElement.style.setProperty("--campaign-sentiment-dual-panel-text-gap", ui.sentimentDualPanelTextGap || "6px");
  document.documentElement.style.setProperty("--campaign-sentiment-dual-panel-heart-size", ui.sentimentDualPanelHeartSize || "68px");
  document.documentElement.style.setProperty("--campaign-sentiment-card-title-font-size", ui.sentimentCardTitleFontSize || "3.6rem");
  document.documentElement.style.setProperty("--campaign-sentiment-label-font-size", ui.sentimentLabelFontSize || "3rem");
  document.documentElement.style.setProperty("--campaign-sentiment-score-font-size", ui.sentimentScoreFontSize || "4rem");
  document.documentElement.style.setProperty("--campaign-sentiment-insight-title-size", ui.sentimentInsightTitleSize || "1rem");
  document.documentElement.style.setProperty("--campaign-sentiment-insight-text-size", ui.sentimentInsightTextSize || "0.98rem");
  document.documentElement.style.setProperty("--campaign-sentiment-meta-font-size", ui.sentimentMetaFontSize || "0.82rem");
  document.documentElement.style.setProperty("--campaign-sentiment-dual-panel-chart-height", ui.sentimentDualPanelChartHeight || "92px");
  document.documentElement.style.setProperty("--campaign-sentiment-dual-panel-chart-top-gap", ui.sentimentDualPanelChartTopGap || "18px");
  document.documentElement.style.setProperty("--campaign-sentiment-compact-card-padding", ui.sentimentCompactCardPadding || "16px 14px 12px");
  document.documentElement.style.setProperty("--campaign-sentiment-compact-orb-size", ui.sentimentCompactOrbSize || "126px");
  document.documentElement.style.setProperty("--campaign-sentiment-compact-title-font-size", ui.sentimentCompactTitleFontSize || "2.4rem");
  document.documentElement.style.setProperty("--campaign-sentiment-compact-label-font-size", ui.sentimentCompactLabelFontSize || "2rem");
  document.documentElement.style.setProperty("--campaign-sentiment-compact-score-font-size", ui.sentimentCompactScoreFontSize || "2.8rem");
  document.documentElement.style.setProperty("--campaign-sentiment-compact-insight-title-size", ui.sentimentCompactInsightTitleSize || "0.92rem");
  document.documentElement.style.setProperty("--campaign-sentiment-compact-insight-text-size", ui.sentimentCompactInsightTextSize || "0.88rem");
  document.documentElement.style.setProperty("--campaign-sentiment-compact-meta-font-size", ui.sentimentCompactMetaFontSize || "0.72rem");

  if (sentimentShell) {
    sentimentShell.classList.remove("layout-centered", "layout-compact", "layout-wide", "style-stacked", "style-split", "style-split-footer-top", "style-dual-panels");
    sentimentShell.classList.add(`layout-${ui.sentimentLayout || "centered"}`);
    sentimentShell.classList.add(`style-${ui.sentimentStylePreset || "stacked"}`);
  }

  updateViewportMode();
  refreshHeaderVisibility();
}

function readUiOverrides(searchParams) {
  return {
    embedMinHeight: searchParams.get("embed_min_height") || searchParams.get("embedMinHeight") || "",
    embedMaxHeight: searchParams.get("embed_max_height") || searchParams.get("embedMaxHeight") || "",
    sentimentLayout: searchParams.get("sentiment_layout") || searchParams.get("sentimentLayout") || "",
    sentimentStylePreset: searchParams.get("sentiment_style") || searchParams.get("sentimentStyle") || searchParams.get("sentiment_style_preset") || searchParams.get("sentimentStylePreset") || "",
    sentimentCardMaxWidth: searchParams.get("sentiment_card_width") || searchParams.get("sentimentCardWidth") || "",
    sentimentCardPadding: searchParams.get("sentiment_card_padding") || searchParams.get("sentimentCardPadding") || "",
    sentimentCardRadius: searchParams.get("sentiment_card_radius") || searchParams.get("sentimentCardRadius") || "",
    sentimentOrbSize: searchParams.get("sentiment_orb_size") || searchParams.get("sentimentOrbSize") || "",
    showPageHeader: parseBooleanParam(searchParams.get("show_page_header") || searchParams.get("showPageHeader"))
  };
}

function resolvePageUi(campaign, pageKey) {
  const ui = campaign?.ui || {};
  return {
    ...(ui.shared || {}),
    ...(ui[pageKey] || {})
  };
}

function refreshHeaderVisibility() {
  if (!brandBar) {
    return;
  }

  const titleHidden = brandTitle ? brandTitle.hidden : false;
  const metaHidden = campaignBadge ? campaignBadge.hidden : true;
  brandBar.hidden = titleHidden && metaHidden;
}

function renderError(message) {
  hideWelcome();
  sentimentBoard.innerHTML = "";
  const errorCard = document.createElement("article");
  errorCard.className = "empty-state";
  errorCard.textContent = message;
  sentimentBoard.appendChild(errorCard);
  notifyParentHeight();
}

function hideWelcome() {
  if (welcomeCard) {
    welcomeCard.remove();
  }
}

function buildApiUrl(pathname) {
  return new URL(pathname, apiBaseUrl).toString();
}

function formatScore(score) {
  const prefix = score >= 0 ? "+" : "";
  return `${prefix}${score.toFixed(2)}`;
}

function normalizeRefreshInterval(value) {
  const parsed = Number(value || 30);
  if (!Number.isFinite(parsed)) {
    return 30;
  }

  return Math.max(5, Math.min(3600, Math.round(parsed)));
}

function notifyParentHeight() {
  if (!isEmbedded) {
    return;
  }

  const height = Math.ceil(document.documentElement.scrollHeight);
  window.parent.postMessage(
    {
      type: "nextiq:resize",
      height
    },
    "*"
  );
}

function updateViewportMode() {
  if (!sentimentShell) {
    return;
  }

  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  const height = window.innerHeight || document.documentElement.clientHeight || 0;
  const isShort = height <= 760 && width >= 760;
  const isVeryShort = height <= 620 && width >= 760;
  const compactBreakpoint = parseCompactBreakpoint(state.ui?.sentimentCompactBreakpoint || "560px");
  const isNarrow = width <= compactBreakpoint;

  sentimentShell.classList.toggle("viewport-short", isShort);
  sentimentShell.classList.toggle("viewport-very-short", isVeryShort);
  sentimentShell.classList.toggle("viewport-narrow", isNarrow);
}

function parseBooleanParam(value) {
  if (value == null || value === "") {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }

  return undefined;
}

function parseCompactBreakpoint(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)px$/i);

  if (!match) {
    return 560;
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) {
    return 560;
  }

  return Math.max(280, Math.min(1440, parsed));
}

function getLanguage(campaign) {
  return window.NextI18n?.getLanguage ? window.NextI18n.getLanguage(campaign, pageParams) : "en";
}

function translate(key) {
  return window.NextI18n?.t ? window.NextI18n.t(state.language, key) : key;
}
