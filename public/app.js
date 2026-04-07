const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const sendButton = document.getElementById("sendButton");
const welcomeCard = document.getElementById("welcomeCard");
const template = document.getElementById("messageTemplate");
const campaignBadge = document.getElementById("campaignBadge");
const brandTitle = document.getElementById("brandTitle");
const brandBar = document.getElementById("brandbar");

const state = {
  requestConfig: null,
  ui: null,
  language: "en"
};

const apiBaseUrl = new URL(".", window.location.href);
const pageParams = new URLSearchParams(window.location.search);
const isEmbedded = window.self !== window.top || new URLSearchParams(window.location.search).get("embed") === "1";

if (isEmbedded) {
  document.documentElement.classList.add("embedded");
  document.body.classList.add("embedded");
}

if (window.location.protocol === "file:") {
  hideWelcome();
  appendMessage(
    "assistant",
    "NextIQ",
    escapeHtml(translate("open_chat_through_server"))
  );
  setComposerEnabled(false);
} else {
  hydrateFromLocation();
}

window.addEventListener("load", notifyParentHeight);
window.addEventListener("resize", notifyParentHeight);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = input.value.trim();
  if (!message) {
    return;
  }

  if (!state.requestConfig) {
    appendMessage("assistant", "NextIQ", escapeHtml(translate("campaign_misconfigured")));
    return;
  }

  hideWelcome();
  appendMessage("user", "You", escapeHtml(message));

  input.value = "";
  setLoading(true);
  const statusNode = appendStatus(translate("searching_kb"));

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
      appendMessage("assistant", "NextIQ", escapeHtml(data.error || translate("service_returned_error")));
      notifyParentHeight();
      return;
    }

    appendAnswer(data);
  } catch (error) {
    statusNode.remove();
    appendMessage(
      "assistant",
      "NextIQ",
      escapeHtml(translate("could_not_complete_request"))
    );
  } finally {
    setLoading(false);
    input.focus();
    notifyParentHeight();
  }
});

async function hydrateFromLocation() {
  try {
    const response = await fetch(buildApiUrl(`api/config?${pageParams.toString()}`));
    const data = await response.json();

    if (!response.ok || !data.configured) {
      hideWelcome();
      appendMessage(
        "assistant",
        "NextIQ",
        escapeHtml(data.error || translate("campaign_misconfigured"))
      );
      setComposerEnabled(false);
      notifyParentHeight();
      return;
    }

    state.requestConfig = data.request;
    state.ui = resolvePageUi(data.campaign, "chat");
    state.language = getLanguage(data.campaign);
    applyUiConfig(data.campaign);
    renderCampaignBadge(data.campaign, data.request.kbIds);

    const initialMessage = pageParams.get("message");
    if (initialMessage) {
      input.value = initialMessage;
    }
    notifyParentHeight();
  } catch (error) {
    hideWelcome();
    appendMessage(
      "assistant",
      "NextIQ",
      escapeHtml(translate("could_not_reach_local_server"))
    );
    setComposerEnabled(false);
    notifyParentHeight();
  }
}

function renderCampaignBadge(campaign, kbIds) {
  if (!campaignBadge) {
    return;
  }

  if (state.ui && !state.ui.showMeta) {
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
  if (kbIds.length) {
    parts.push(`KB: ${kbIds.join(", ")}`);
  }

  campaignBadge.textContent = parts.join(" | ");
  campaignBadge.hidden = false;
  refreshHeaderVisibility();
}

function applyUiConfig(campaign) {
  const ui = {
    ...resolvePageUi(campaign, "chat"),
    ...readUiOverrides(pageParams)
  };

  if (brandTitle) {
    brandTitle.textContent = ui.titleText || campaign.name || translate("nextiq");
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

function appendAnswer(data) {
  const answer = data?.faq_response?.text || translate("no_answer_returned");
  const bubble = createMessage("assistant", "NextIQ");
  bubble.innerHTML = renderRichText(answer);

  const articles = data?.faq_response?.articles || [];
  if (articles.length) {
    const sources = document.createElement("div");
    sources.className = "sources";

    for (const article of articles) {
      const link = document.createElement("a");
      link.className = "source-card";
      link.href = article.resource_url || article.url || "#";
      link.target = "_blank";
      link.rel = "noreferrer";
      link.innerHTML = `
        <strong>${escapeHtml(article.title || "Related document")}</strong>
        <span>${escapeHtml(article.description || article.file_type || "Source")}</span>
      `;
      sources.appendChild(link);
    }

    bubble.appendChild(sources);
  }

  scrollToBottom();
  notifyParentHeight();
}

function appendMessage(role, label, text) {
  const bubble = createMessage(role, label);
  bubble.innerHTML = `<p>${text}</p>`;
  scrollToBottom();
  notifyParentHeight();
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

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
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

function getLanguage(campaign) {
  return window.NextI18n?.getLanguage ? window.NextI18n.getLanguage(campaign, pageParams) : "en";
}

function translate(key) {
  return window.NextI18n?.t ? window.NextI18n.t(state.language, key) : key;
}
