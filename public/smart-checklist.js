const smartChecklistBoard = document.getElementById("smartChecklistBoard");

const apiBaseUrl = new URL(".", window.location.href);
const pageParams = new URLSearchParams(window.location.search);
const isEmbedded = window.self !== window.top || pageParams.get("embed") === "1";

const state = {
  refreshTimer: null,
  refreshIntervalSeconds: 30,
  language: "en",
  copiedPrompt: "",
  expandedSections: {
    required: true,
    pending: false,
    completed: false
  }
};

if (isEmbedded) {
  document.documentElement.classList.add("embedded");
  document.body.classList.add("embedded");
}

if (window.location.protocol === "file:") {
  renderError(translate("open_through_server"));
} else {
  hydrateSmartChecklist();
}

window.addEventListener("load", notifyParentHeight);
window.addEventListener("resize", notifyParentHeight);
window.addEventListener("beforeunload", stopRefreshLoop);

function renderLoading() {
  smartChecklistBoard.innerHTML = `
    <article class="smart-checklist-card smart-checklist-empty">
      <div class="sentiment-bar-spinner" aria-label="Loading" role="status"></div>
    </article>
  `;
}

async function hydrateSmartChecklist() {
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
    applyUiConfig(configData.campaign);
    await refreshSmartChecklist();

    const overrideSeconds = Number(pageParams.get("refresh_seconds") || pageParams.get("refreshSeconds") || 0);
    const configuredSeconds = Number(configData.campaign?.ui?.questions?.refreshIntervalSeconds || 30);
    state.refreshIntervalSeconds = normalizeRefreshInterval(overrideSeconds || configuredSeconds);
    startRefreshLoop();
  } catch (error) {
    renderError(translate("could_not_reach_server"));
  }
}

async function refreshSmartChecklist() {
  try {
    const response = await fetch(buildApiUrl(`api/questions-check?${pageParams.toString()}`), { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      renderError(data.error || translate("checklist_request_failed"));
      return;
    }

    renderWidget(data);
  } catch (error) {
    renderError(translate("could_not_refresh_checklist"));
  }
}

function renderWidget(data) {
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const summary = buildChecklistModel(questions);

  smartChecklistBoard.innerHTML = "";

  const card = document.createElement("article");
  card.className = "smart-checklist-card";
  card.innerHTML = `
    <header class="smart-checklist-header">
      <div class="smart-checklist-header-copy">
        <h2>${escapeHtml(translate("smart_checklist"))}</h2>
        <p>${escapeHtml(translate("checklist_progress"))}: ${summary.completedCount} / ${summary.totalCount} ${escapeHtml(translate("completed_count"))}</p>
      </div>
      <div class="smart-checklist-progress-track">
        <div class="smart-checklist-progress-bar" style="width:${summary.progress}%"></div>
      </div>
    </header>

    <section class="smart-checklist-section required ${state.expandedSections.required ? "expanded" : "collapsed"}" data-section="required">
      <button class="smart-checklist-section-toggle required" type="button" data-toggle-section="required" aria-expanded="${state.expandedSections.required ? "true" : "false"}">
        <span class="smart-checklist-section-label required">
          ${buildSectionIcon("required")}
          <span>${escapeHtml(translate("required_now"))}</span>
        </span>
        ${buildChevronIcon()}
      </button>
      <div class="smart-checklist-section-body">
        <div class="smart-checklist-primary-row">
          <div class="smart-checklist-item-copy">
            ${buildStatusDot("required")}
            <strong>${escapeHtml(summary.requiredItem.question)}</strong>
          </div>
          <button class="smart-checklist-insert-button" type="button">
            ${buildInsertIcon()}
            <span>${escapeHtml(state.copiedPrompt === summary.requiredItem.prompt ? translate("copied") : translate("insert_phrase"))}</span>
          </button>
        </div>
        <div class="smart-checklist-suggested">
          ${buildSectionIcon("suggestion")}
          <p><strong>${escapeHtml(translate("suggested"))}:</strong> ${escapeHtml(summary.requiredItem.prompt)}</p>
        </div>
      </div>
    </section>

    <section class="smart-checklist-section pending ${state.expandedSections.pending ? "expanded" : "collapsed"}" data-section="pending">
      <button class="smart-checklist-section-toggle pending" type="button" data-toggle-section="pending" aria-expanded="${state.expandedSections.pending ? "true" : "false"}">
        <span class="smart-checklist-section-label pending">
          ${buildSectionIcon("pending")}
          <span>${escapeHtml(translate("pending"))}${summary.realPendingCount ? ` (${summary.realPendingCount})` : ""}</span>
        </span>
        ${buildChevronIcon()}
      </button>
      <div class="smart-checklist-section-body">
        <div class="smart-checklist-list">
          ${summary.pendingItems.map((item) => `
            <div class="smart-checklist-row">
              ${buildStatusDot("pending")}
              <span>${escapeHtml(item.question)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </section>

    <section class="smart-checklist-section completed ${state.expandedSections.completed ? "expanded" : "collapsed"}" data-section="completed">
      <button class="smart-checklist-section-toggle completed" type="button" data-toggle-section="completed" aria-expanded="${state.expandedSections.completed ? "true" : "false"}">
        <span class="smart-checklist-section-label completed">
          ${buildSectionIcon("completed")}
          <span>${escapeHtml(translate("completed"))} (${summary.completedCount} / ${summary.totalCount})</span>
        </span>
        ${buildChevronIcon()}
      </button>
      <div class="smart-checklist-section-body">
        <div class="smart-checklist-list">
          ${summary.completedItems.map((item) => `
            <div class="smart-checklist-row">
              ${buildStatusDot("completed")}
              <span>${escapeHtml(item.question)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </section>

    <div class="smart-checklist-meta">${escapeHtml(translate("auto_refresh"))}: ${state.refreshIntervalSeconds}s | ${escapeHtml(translate("updated"))}: ${new Date(data.updatedAt || Date.now()).toLocaleTimeString()}</div>
  `;

  const button = card.querySelector(".smart-checklist-insert-button");
  const buttonLabel = button.querySelector("span");
  button.addEventListener("click", async () => {
    const copied = await copyText(summary.requiredItem.prompt);
    if (!copied) {
      return;
    }

    buttonLabel.textContent = translate("copied");
    window.setTimeout(() => {
      buttonLabel.textContent = translate("insert_phrase");
    }, 1200);
  });

  card.querySelectorAll("[data-toggle-section]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const key = toggle.getAttribute("data-toggle-section");
      if (!key || !Object.prototype.hasOwnProperty.call(state.expandedSections, key)) {
        return;
      }
      state.expandedSections[key] = !state.expandedSections[key];
      renderWidget(data);
    });
  });

  smartChecklistBoard.appendChild(card);
  notifyParentHeight();
}

function buildChecklistModel(items) {
  const completedItems = items.filter((item) => item.fulfilled);
  const missingItems = items.filter((item) => !item.fulfilled);
  const requiredItem = missingItems[0] || {
    question: translate("all_items_completed"),
    prompt: translate("all_items_completed_prompt")
  };
  const pendingItems = missingItems.slice(1);

  return {
    totalCount: items.length || 1,
    completedCount: completedItems.length,
    realPendingCount: pendingItems.length,
    progress: Math.round((completedItems.length / Math.max(items.length, 1)) * 100),
    requiredItem: {
      ...requiredItem,
      prompt: buildSuggestedPrompt(requiredItem.question || "")
    },
    pendingItems: pendingItems.length ? pendingItems : [{ question: translate("nothing_pending") }],
    completedItems: completedItems.length ? completedItems : [{ question: translate("no_completed_items") }]
  };
}

function buildSuggestedPrompt(question) {
  const normalized = String(question || "").toLowerCase();
  if (normalized.includes("issue") || normalized.includes("problema")) {
    return translate("prompt_issue");
  }
  if (normalized.includes("legal") || normalized.includes("disclaimer") || normalized.includes("texto legal")) {
    return translate("prompt_legal");
  }
  if (normalized.includes("name") || normalized.includes("nombre")) {
    return translate("prompt_name");
  }
  if (normalized.includes("phone") || normalized.includes("tel")) {
    return translate("prompt_phone");
  }

  return translate("prompt_generic");
}

function buildSectionIcon(type) {
  if (type === "required") {
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2 18 18H2L10 2Z"></path><path d="M10 6v5"></path><circle cx="10" cy="14.5" r="1"></circle></svg>`;
  }
  if (type === "pending") {
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8"></circle><path d="M10 6v4l2.5 2.5"></path></svg>`;
  }
  if (type === "suggestion") {
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3a5 5 0 0 0-3.5 8.5l.6.6c.4.4.6.9.7 1.5h4.4c.1-.6.3-1.1.7-1.5l.6-.6A5 5 0 0 0 10 3Z"></path><path d="M8.5 15.5h3"></path></svg>`;
  }

  return `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8"></circle><path d="m6.5 10 2.2 2.2 4.8-5"></path></svg>`;
}

function buildStatusDot(type) {
  const icon = type === "completed"
    ? `<path d="m6.5 10 2.2 2.2 4.8-5"></path>`
    : type === "pending"
      ? `<path d="M6 10h4"></path><path d="m10 7 3 3-3 3"></path>`
      : `<path d="m6.5 6.5 7 7"></path><path d="m13.5 6.5-7 7"></path>`;

  return `<span class="smart-checklist-dot ${type}"><svg viewBox="0 0 20 20" aria-hidden="true">${icon}</svg></span>`;
}

function buildInsertIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="2" width="9" height="12" rx="2"></rect><path d="M4 6v10a2 2 0 0 0 2 2h7"></path></svg>`;
}

function buildChevronIcon() {
  return `<span class="smart-checklist-chevron" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m6 8 4 4 4-4"></path></svg></span>`;
}

function applyUiConfig(campaign) {
  const ui = resolvePageUi(campaign, "questions");
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
  state.refreshTimer = window.setInterval(refreshSmartChecklist, state.refreshIntervalSeconds * 1000);
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
  smartChecklistBoard.innerHTML = `<article class="smart-checklist-card smart-checklist-empty"><p>${escapeHtml(message)}</p></article>`;
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
  if (!isEmbedded) {
    return;
  }

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
