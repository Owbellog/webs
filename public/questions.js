const questionsBoard = document.getElementById("questionsBoard");
const questionsWelcomeCard = document.getElementById("questionsWelcomeCard");
const questionsCampaignBadge = document.getElementById("questionsCampaignBadge");
const questionsBrandTitle = document.getElementById("questionsBrandTitle");
const questionsBrandbar = document.getElementById("questionsBrandbar");

const apiBaseUrl = new URL(".", window.location.href);
const pageParams = new URLSearchParams(window.location.search);
const isEmbedded = window.self !== window.top || pageParams.get("embed") === "1";

const state = {
  refreshTimer: null,
  refreshIntervalSeconds: 30,
  language: "en"
};

if (isEmbedded) {
  document.documentElement.classList.add("embedded");
  document.body.classList.add("embedded");
}

if (window.location.protocol === "file:") {
  renderError(translate("open_through_server"));
} else {
  hydrateQuestions();
}

window.addEventListener("load", notifyParentHeight);
window.addEventListener("resize", notifyParentHeight);
window.addEventListener("beforeunload", stopRefreshLoop);

async function hydrateQuestions() {
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
    renderCampaignBadge(configData.campaign, workitemId);
    await refreshQuestions();

    const overrideSeconds = Number(pageParams.get("refresh_seconds") || pageParams.get("refreshSeconds") || 0);
    const configuredSeconds = Number(configData.campaign?.ui?.questions?.refreshIntervalSeconds || 30);
    state.refreshIntervalSeconds = normalizeRefreshInterval(overrideSeconds || configuredSeconds);
    startRefreshLoop();
  } catch (error) {
    renderError(translate("could_not_reach_server"));
  }
}

async function refreshQuestions() {
  try {
    const response = await fetch(buildApiUrl(`api/questions-check?${pageParams.toString()}`), { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      renderError(data.error || translate("checklist_request_failed"));
      return;
    }

    renderQuestions(data);
  } catch (error) {
    renderError(translate("could_not_refresh_checklist"));
  }
}

function renderQuestions(data) {
  hideWelcome();
  questionsBoard.innerHTML = "";
  const campaignUi = resolvePageUi(data.campaign, "questions");

  const card = document.createElement("article");
  card.className = "questions-card";

  for (const item of data.questions || []) {
    const row = document.createElement("div");
    row.className = `question-row ${item.fulfilled ? "green" : "red"}`;
    row.innerHTML = `
      <div class="question-status"></div>
      <div class="question-copy">
        <strong>${escapeHtml(item.question)}</strong>
        ${campaignUi.showEvidence !== false ? `<span>${escapeHtml(item.evidence || (item.fulfilled ? translate("confirmed_in_transcript") : translate("not_confirmed_in_transcript")))}</span>` : ""}
      </div>
    `;
    card.appendChild(row);
  }

  const meta = document.createElement("div");
  meta.className = "questions-meta";
  meta.textContent = `${translate("auto_refresh")}: ${state.refreshIntervalSeconds}s | ${translate("updated")}: ${new Date(data.updatedAt || Date.now()).toLocaleTimeString()}`;
  card.appendChild(meta);

  questionsBoard.appendChild(card);
  notifyParentHeight();
}

function applyUiConfig(campaign) {
  const ui = resolvePageUi(campaign, "questions");

  if (questionsBrandTitle) {
    questionsBrandTitle.textContent = ui.titleText || translate("checklist");
    questionsBrandTitle.hidden = ui.showTitle === false;
  }

  if (document.querySelector(".questions-shell")) {
    document.querySelector(".questions-shell").classList.toggle("page-header-hidden", ui.showPageHeader === false);
  }

  document.documentElement.style.setProperty("--campaign-font-family", ui.fontFamily || "Manrope, sans-serif");
  document.documentElement.style.setProperty("--campaign-base-font-size", ui.baseFontSize || "16px");
  document.documentElement.style.setProperty("--campaign-title-size", ui.titleSize || "2rem");
  document.documentElement.style.setProperty("--campaign-meta-size", ui.metaSize || "0.82rem");
  document.documentElement.style.setProperty("--campaign-questions-card-shadow", ui.showCardShadow === false ? "none" : "0 30px 80px rgba(28, 40, 83, 0.14)");
  document.documentElement.style.setProperty("--campaign-questions-question-size", ui.questionSize || "1rem");
  document.documentElement.style.setProperty("--campaign-questions-evidence-size", ui.evidenceSize || "1rem");
  document.documentElement.style.setProperty("--campaign-questions-meta-font-size", ui.metaFontSize || "0.82rem");
  document.documentElement.style.setProperty("--campaign-embed-min-height", ui.embedMinHeight || "220px");
  document.documentElement.style.setProperty("--campaign-embed-max-height", ui.embedMaxHeight || "560px");

  refreshHeaderVisibility();
}

function renderCampaignBadge(campaign, workitemId) {
  if (!questionsCampaignBadge) {
    return;
  }

  const pageUi = resolvePageUi(campaign, "questions");
  if (pageUi.showMeta === false) {
    questionsCampaignBadge.hidden = true;
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

  questionsCampaignBadge.textContent = parts.join(" | ");
  questionsCampaignBadge.hidden = false;
  refreshHeaderVisibility();
}

function refreshHeaderVisibility() {
  if (!questionsBrandbar) {
    return;
  }

  const titleHidden = questionsBrandTitle ? questionsBrandTitle.hidden : false;
  const metaHidden = questionsCampaignBadge ? questionsCampaignBadge.hidden : true;
  questionsBrandbar.hidden = titleHidden && metaHidden;
}

function hideWelcome() {
  if (questionsWelcomeCard) {
    questionsWelcomeCard.remove();
  }
}

function renderError(message) {
  hideWelcome();
  questionsBoard.innerHTML = "";
  const errorCard = document.createElement("article");
  errorCard.className = "empty-state";
  errorCard.textContent = message;
  questionsBoard.appendChild(errorCard);
  notifyParentHeight();
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
  state.refreshTimer = window.setInterval(refreshQuestions, state.refreshIntervalSeconds * 1000);
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
