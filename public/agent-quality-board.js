const qualityBoard = document.getElementById("qualityBoard");

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
  hydrateQualityBoard();
}

window.addEventListener("load", notifyParentHeight);
window.addEventListener("resize", notifyParentHeight);
window.addEventListener("beforeunload", stopRefreshLoop);

async function hydrateQualityBoard() {
  qualityBoard.innerHTML = `
    <article class="quality-card quality-empty">
      <div class="sentiment-bar-spinner" aria-label="Loading" role="status"></div>
    </article>
  `;

  try {
    const configResponse = await fetch(buildApiUrl(`api/config?${pageParams.toString()}`));
    const configData = await configResponse.json();

    if (!configResponse.ok || !configData.configured) {
      renderError(configData.error || translate("campaign_misconfigured"));
      return;
    }

    state.language = getLanguage(configData.campaign);
    await refreshQualityBoard();

    const overrideSeconds = Number(pageParams.get("refresh_seconds") || pageParams.get("refreshSeconds") || 0);
    const configuredSeconds = Number(configData.campaign?.ui?.questions?.refreshIntervalSeconds || 30);
    state.refreshIntervalSeconds = normalizeRefreshInterval(overrideSeconds || configuredSeconds);
    startRefreshLoop();
  } catch (error) {
    renderError(translate("could_not_reach_server"));
  }
}

async function refreshQualityBoard() {
  try {
    const response = await fetch(buildApiUrl(`api/agent-quality-board?${pageParams.toString()}`), { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      renderError(data.error || translate("workitem_request_failed"));
      return;
    }

    renderBoard(data);
  } catch (error) {
    renderError(translate("could_not_reach_server"));
  }
}

function renderBoard(data) {
  const overview = data?.overview || {};
  const agents = Array.isArray(data?.agents) ? data.agents : [];

  const sortedAgents = sortByRisk(agents);

  qualityBoard.innerHTML = `
    <div class="quality-dashboard-card">
      <header class="quality-header">
        <div class="quality-title-block">
          <h1>${escapeHtml(translate("quality_management"))}</h1>
          <p>${escapeHtml(translate("quality_management_intro"))}</p>
        </div>
        <div class="quality-toolbar">
          <span class="quality-toolbar-chip">${escapeHtml(translate("updated"))}: ${new Date(data.updatedAt || Date.now()).toLocaleTimeString()}</span>
          <span class="quality-toolbar-chip">${escapeHtml(translate("auto_refresh"))}: ${state.refreshIntervalSeconds}s</span>
        </div>
      </header>

      <section class="quality-overview">
        ${buildStatCard("sentiment", translate("average_sentiment"), formatScore(overview.averageSentiment || 0), overview.averageSentiment >= 0 ? translate("above_target") : translate("below_target"))}
        ${buildStatCard("compliance", translate("compliance"), `${Number(overview.averageCompliance || 0)}%`, overview.averageCompliance >= 80 ? translate("above_target") : translate("below_target"))}
        ${buildStatCard("alerts", translate("active_alerts"), String(overview.activeAlerts || 0), translate("latest_alert"))}
        ${buildStatCard("risk", translate("agents_at_risk"), String(overview.agentsAtRisk || 0), translate("view_metrics"))}
      </section>

      ${sortedAgents.length ? `<section class="quality-agent-grid">${sortedAgents.map((agent) => buildAgentCard(agent)).join("")}</section>` : ""}
    </div>
  `;

  qualityBoard.querySelectorAll(".quality-expand-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".quality-agent-card");
      const detail = card.querySelector(".quality-checklist-detail");
      const expanded = btn.getAttribute("data-expanded") === "true";
      btn.setAttribute("data-expanded", expanded ? "false" : "true");
      if (expanded) {
        detail.hidden = true;
      } else {
        detail.hidden = false;
      }
      notifyParentHeight();
    });
  });

  notifyParentHeight();
}

function sortByRisk(agents) {
  const order = { red: 0, yellow: 1, green: 2 };
  return [...agents].sort((a, b) => {
    const ca = order[a?.sentiment?.color] ?? 1;
    const cb = order[b?.sentiment?.color] ?? 1;
    return ca - cb;
  });
}

function buildStatCard(type, label, value, note) {
  return `
    <article class="quality-stat-card ${escapeHtml(type)}">
      <div class="quality-stat-icon ${escapeHtml(type)}">${buildStatIcon(type)}</div>
      <div class="quality-stat-copy">
        <div class="quality-stat-label">${escapeHtml(label)}</div>
        <strong>${escapeHtml(value)}</strong>
        <span>${escapeHtml(note || "")}</span>
      </div>
    </article>
  `;
}

function buildAgentCard(agent) {
  const summary = agent?.summary || {};
  const sentiment = agent?.sentiment || {};
  const compliance = agent?.compliance || {};
  const checklist = Array.isArray(agent?.checklist) ? agent.checklist : [];
  const color = sentiment.color || "yellow";
  const complianceValue = Math.max(0, Math.min(100, Number(compliance.score || 0)));
  const sentimentLabel = localizeSentiment(sentiment.label || "Neutral");

  return `
    <article class="quality-agent-card ${escapeHtml(color)}">
      <div class="quality-agent-head">
        <div class="quality-agent-identity">
          <div class="quality-agent-avatar">${escapeHtml(getAgentInitials(summary.agentUsername || summary.contactName || "A"))}</div>
          <div class="quality-agent-name">
            <strong>${escapeHtml(summary.agentUsername || "Agent")}</strong>
            <span>${escapeHtml(translate("call_sentiment"))}</span>
          </div>
        </div>
      </div>

      <div class="quality-agent-metrics-row">
        <div class="quality-agent-score-block">
          <span class="quality-agent-score">${escapeHtml(sentimentLabel)}</span>
          <div class="quality-spark-inline">
            ${buildSparkline(sentiment.trend || [0])}
          </div>
        </div>
        ${buildComplianceRing(complianceValue)}
      </div>

      <button class="quality-expand-toggle" type="button" data-expanded="false">
        ${buildChevronDownIcon()}
        <span>${escapeHtml(translate("checklist"))}</span>
      </button>

      <div class="quality-checklist-detail" hidden>
        ${buildChecklistDetail(checklist)}
      </div>

      <footer class="quality-agent-footer">
        <span class="quality-agent-footer-meta">${escapeHtml(translate("messages"))}: ${escapeHtml(String(agent.messageCount || 0))}</span>
        <span class="quality-agent-footer-time">${new Date(agent.updatedAt || Date.now()).toLocaleTimeString()}</span>
      </footer>
    </article>
  `;
}

function buildComplianceSummary(value) {
  let tone = "ok";
  if (value < 60) tone = "danger";
  else if (value < 80) tone = "warn";
  return `
    <div class="quality-compliance-summary ${escapeHtml(tone)}">
      <span class="quality-compliance-summary-label">${escapeHtml(translate("compliance"))}</span>
      <span class="quality-compliance-summary-pct">${escapeHtml(String(value))}%</span>
    </div>
  `;
}

function buildAlertOnlyRows(alerts) {
  if (!alerts.length) {
    return `
      <div class="quality-alert-row neutral">
        <span class="quality-alert-row-label">${escapeHtml(translate("above_target"))}</span>
      </div>
    `;
  }

  return alerts.slice(0, 3).map((alert) => {
    const tone = alert.severity === "high" ? "danger" : "warn";
    return `
      <div class="quality-alert-row ${escapeHtml(tone)}">
        <span class="quality-alert-row-label">${buildAlertIcon(tone)}${escapeHtml(alert.label || "")}</span>
        <span class="quality-alert-row-pct">${escapeHtml(alert.detail || "")}</span>
      </div>
    `;
  }).join("");
}

function buildChecklistDetail(checklist) {
  if (!checklist.length) {
    return `<div class="quality-alert-row neutral"><span class="quality-alert-row-label">${escapeHtml(translate("nothing_pending"))}</span></div>`;
  }

  return checklist.map((item) => {
    const tone = item.fulfilled ? "ok" : "warn";
    return `
      <div class="quality-alert-row ${escapeHtml(tone)}">
        <span class="quality-alert-row-label">${buildCheckIcon(item.fulfilled)}${escapeHtml(item.question || "")}</span>
        <span class="quality-alert-row-pct">${item.fulfilled ? "100%" : "0%"}</span>
      </div>
    `;
  }).join("");
}

function getTrendLabel(direction) {
  if (direction === "up") return translate("improving");
  if (direction === "down") return translate("worsening");
  return translate("stable");
}

function buildComplianceRing(value) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fill = circ - (value / 100) * circ;
  let tone = "ok";
  if (value < 60) tone = "danger";
  else if (value < 80) tone = "warn";
  return `
    <div class="quality-compliance-ring ${escapeHtml(tone)}">
      <svg viewBox="0 0 48 48">
        <circle class="ring-track" cx="24" cy="24" r="${r}"></circle>
        <circle class="ring-fill" cx="24" cy="24" r="${r}"
          stroke-dasharray="${circ.toFixed(1)}"
          stroke-dashoffset="${fill.toFixed(1)}">
        </circle>
      </svg>
      <div class="quality-compliance-label">${escapeHtml(String(value))}%</div>
    </div>
  `;
}

function getTrendDirection(trend) {
  if (!Array.isArray(trend) || trend.length < 2) return "flat";
  const recent = trend.slice(-3);
  const delta = recent[recent.length - 1] - recent[0];
  if (delta <= -0.1) return "down";
  if (delta >= 0.1) return "up";
  return "flat";
}

function buildTrendIcon(direction) {
  if (direction === "up") {
    return `<svg viewBox="0 0 12 12"><path d="M2 9 6 3l4 6"></path></svg>`;
  }
  if (direction === "down") {
    return `<svg viewBox="0 0 12 12"><path d="M2 3l4 6 4-6"></path></svg>`;
  }
  return `<svg viewBox="0 0 12 12"><path d="M2 6h8"></path></svg>`;
}

function buildAlertIcon(tone) {
  if (tone === "danger") {
    return `<svg viewBox="0 0 12 12"><path d="M6 1 11 11H1L6 1Z"></path><path d="M6 4v3"></path><circle cx="6" cy="9" r="0.8" fill="currentColor"></circle></svg>`;
  }
  return `<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5"></circle><path d="M6 3v3"></path><circle cx="6" cy="9" r="0.8" fill="currentColor"></circle></svg>`;
}

function buildCheckIcon(fulfilled) {
  if (fulfilled) {
    return `<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5"></circle><path d="m3.5 6 1.8 1.8 3.2-3.6"></path></svg>`;
  }
  return `<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5"></circle><path d="M6 3v3"></path><circle cx="6" cy="9" r="0.8" fill="currentColor"></circle></svg>`;
}

function buildChevronDownIcon() {
  return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"></path></svg>`;
}

function buildStatIcon(type) {
  if (type === "sentiment") {
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17c-4-3-7-5.5-7-9a5 5 0 0 1 7-4.6A5 5 0 0 1 17 8c0 3.5-3 6-7 9Z"></path></svg>`;
  }
  if (type === "compliance") {
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5 8 15l8-9"></path></svg>`;
  }
  if (type === "alerts") {
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3 18 17H2L10 3Z"></path><path d="M10 8v4"></path><circle cx="10" cy="14.5" r="1"></circle></svg>`;
  }
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8"></circle><path d="M10 6v4"></path><circle cx="10" cy="14" r="1"></circle></svg>`;
}

function buildSparkline(points) {
  const raw = Array.isArray(points) && points.length ? points : [0];
  const values = raw.length < 2 ? [raw[0], raw[0]] : raw;
  const width = 72;
  const height = 28;
  const step = width / (values.length - 1);
  const coords = values.map((value, index) => {
    const normalized = Math.max(-1, Math.min(1, Number(value || 0)));
    const x = index * step;
    const y = height - ((normalized + 1) / 2) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${coords}" /></svg>`;
}

function localizeSentiment(label) {
  const normalized = String(label || "").trim().toLowerCase();
  if (normalized === "positive") return translate("positive");
  if (normalized === "negative") return translate("negative");
  return translate("neutral");
}

function getAgentInitials(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item.charAt(0).toUpperCase())
    .join("") || "A";
}

function formatScore(value) {
  const score = Number(value || 0);
  return `${score >= 0 ? "+" : ""}${score.toFixed(2)}`;
}

function startRefreshLoop() {
  stopRefreshLoop();
  state.refreshTimer = window.setInterval(refreshQualityBoard, state.refreshIntervalSeconds * 1000);
}

function stopRefreshLoop() {
  if (state.refreshTimer) {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }
}

function normalizeRefreshInterval(value) {
  const parsed = Number(value || 30);
  if (!Number.isFinite(parsed) || parsed < 5) return 30;
  return Math.min(parsed, 3600);
}

function renderError(message) {
  qualityBoard.innerHTML = `<article class="quality-card quality-empty"><p>${escapeHtml(message)}</p></article>`;
  notifyParentHeight();
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
