const inspector = document.getElementById("inspector");
const welcomeCard = document.getElementById("welcomeCard");
const campaignBadge = document.getElementById("campaignBadge");
const brandTitle = document.getElementById("brandTitle");
const brandBar = document.getElementById("brandbar");
const transcriptTemplate = document.getElementById("transcriptTemplate");

const apiBaseUrl = new URL(".", window.location.href);
const pageParams = new URLSearchParams(window.location.search);
const isEmbedded = window.self !== window.top || pageParams.get("embed") === "1";
const state = { language: "en" };

if (isEmbedded) {
  document.documentElement.classList.add("embedded");
  document.body.classList.add("embedded");
}

if (window.location.protocol === "file:") {
  renderError(translate("open_through_server"));
} else {
  hydrateWorkitem();
}

window.addEventListener("load", notifyParentHeight);
window.addEventListener("resize", notifyParentHeight);

async function hydrateWorkitem() {
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

    const response = await fetch(buildApiUrl(`api/workitem?${pageParams.toString()}`));
    const data = await response.json();

    if (!response.ok) {
      renderError(data.error || translate("workitem_request_failed"));
      return;
    }

    renderWorkitem(data);
  } catch (error) {
    renderError(translate("could_not_reach_server"));
  }
}

function renderWorkitem(data) {
  hideWelcome();
  inspector.innerHTML = "";

  const summary = data.summary || {};
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const overallSentiment = summarizeSentiment(messages);

  inspector.appendChild(createSummaryCard(summary, overallSentiment, messages.length));

  if (!messages.length) {
    const empty = document.createElement("article");
    empty.className = "empty-state";
    empty.textContent = translate("no_client_messages_found");
    inspector.appendChild(empty);
    notifyParentHeight();
    return;
  }

  const transcriptList = document.createElement("section");
  transcriptList.className = "transcript-list";

  for (const message of messages) {
    transcriptList.appendChild(createTranscriptCard(message));
  }

  inspector.appendChild(transcriptList);
  notifyParentHeight();
}

function createSummaryCard(summary, overallSentiment, messageCount) {
  const card = document.createElement("article");
  card.className = "summary-card";

  const title = document.createElement("div");
  title.className = "summary-title";
  title.textContent = summary.contactName || summary.phone || summary.workitemId || translate("workitem");
  card.appendChild(title);

  const metaGrid = document.createElement("div");
  metaGrid.className = "detail-grid";

  const details = [
    [translate("workitem"), summary.workitemId || "-"],
    [translate("phone"), summary.phone || "-"],
    [translate("agent"), summary.agentUsername || "-"],
    [translate("state"), summary.state || "-"],
    [translate("channel"), summary.channelType || "-"],
    [translate("type"), summary.callType || "-"],
    [translate("messages"), String(messageCount)],
    [translate("overall_sentiment"), overallSentiment.label]
  ];

  for (const [label, value] of details) {
    const row = document.createElement("div");
    row.className = "detail-row";
    row.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
    metaGrid.appendChild(row);
  }

  card.appendChild(metaGrid);

  const sentiment = document.createElement("div");
  sentiment.className = `sentiment-banner ${overallSentiment.color}`;
  sentiment.textContent = `${translate("overall_sentiment")}: ${overallSentiment.label}`;
  card.appendChild(sentiment);

  return card;
}

function createTranscriptCard(message) {
  const fragment = transcriptTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".transcript-card");
  const author = fragment.querySelector(".transcript-author");
  const time = fragment.querySelector(".transcript-time");
  const pill = fragment.querySelector(".sentiment-pill");
  const text = fragment.querySelector(".transcript-text");

  card.classList.add(`sentiment-${message.sentiment.color}`);
  author.textContent = message.fromId || "Client";
  time.textContent = formatTimestamp(message.timestamp);
  pill.textContent = message.sentiment.label;
  pill.classList.add(message.sentiment.color);
  text.textContent = message.text;

  return fragment;
}

function summarizeSentiment(messages) {
  if (!messages.length) {
    return { color: "yellow", label: translate("neutral") };
  }

  const total = messages.reduce((sum, item) => sum + Number(item.sentiment?.score || 0), 0);
  if (total <= -1) {
    return { color: "red", label: translate("negative") };
  }
  if (total >= 1) {
    return { color: "green", label: translate("positive") };
  }
  return { color: "yellow", label: translate("neutral") };
}

function renderCampaignBadge(campaign, workitemId) {
  if (!campaignBadge) {
    return;
  }

  const pageUi = resolvePageUi(campaign, "workitem");
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
    ...resolvePageUi(campaign, "workitem"),
    ...readUiOverrides(pageParams)
  };

  if (brandTitle) {
    brandTitle.textContent = ui.titleText || campaign.name || translate("workitem_title");
    brandTitle.hidden = ui.showTitle === false;
  }

  document.documentElement.style.setProperty("--campaign-font-family", ui.fontFamily || "Manrope, sans-serif");
  document.documentElement.style.setProperty("--campaign-base-font-size", ui.baseFontSize || "16px");
  document.documentElement.style.setProperty("--campaign-title-size", ui.titleSize || "2rem");
  document.documentElement.style.setProperty("--campaign-meta-size", ui.metaSize || "0.82rem");
  document.documentElement.style.setProperty("--campaign-embed-min-height", ui.embedMinHeight || "180px");
  document.documentElement.style.setProperty("--campaign-embed-max-height", ui.embedMaxHeight || "520px");

  refreshHeaderVisibility();
}

function readUiOverrides(searchParams) {
  return {
    embedMinHeight: searchParams.get("embed_min_height") || searchParams.get("embedMinHeight") || "",
    embedMaxHeight: searchParams.get("embed_max_height") || searchParams.get("embedMaxHeight") || ""
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
  inspector.innerHTML = "";
  const errorCard = document.createElement("article");
  errorCard.className = "empty-state";
  errorCard.textContent = message;
  inspector.appendChild(errorCard);
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

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "";
  }

  try {
    return new Date(timestamp).toLocaleString();
  } catch (error) {
    return "";
  }
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
