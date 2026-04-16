/* summaryagentic.js — Customer Summary widget
 * URL params: ?campaign=ID&phone=+15551234567
 *             ?campaign=ID&customer_id=C-001
 */

const pageParams = new URLSearchParams(window.location.search);
const isEmbedded = window.self !== window.top || pageParams.get("embed") === "1";

const campaignId = pageParams.get("campaign") || "";
const phone = pageParams.get("phone") || "";
const customerId = pageParams.get("customer_id") || pageParams.get("customerId") || "";

const appBase = new URL(".", window.location.href);

const saContent = document.getElementById("saContent");
const saPhoneLabel = document.getElementById("saPhoneLabel");
const saRefreshBtn = document.getElementById("saRefreshBtn");

if (isEmbedded) {
  document.documentElement.classList.add("embedded");
}

// ── API helper ──────────────────────────────────────────────────────────────
function buildApiUrl(path) {
  return new URL(path.startsWith("/") ? path.slice(1) : path, appBase).toString();
}

async function apiFetch(path, options = {}) {
  const res = await fetch(buildApiUrl(path), {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Height notification ─────────────────────────────────────────────────────
function notifyHeight() {
  if (!isEmbedded) return;
  const h = document.body.scrollHeight;
  window.parent.postMessage({ type: "nextiq:resize", height: h }, "*");
}

// ── Render helpers ──────────────────────────────────────────────────────────
function renderLoading(steps = []) {
  const stepsHtml = steps.map((s) =>
    `<div class="sa-step sa-step--${s.state || "pending"}">${iconFor(s.state)} ${escHtml(s.label)}</div>`
  ).join("");

  saContent.innerHTML = `
    <div class="sa-loading">
      <div class="sa-spinner"></div>
      ${stepsHtml ? `<div class="sa-step-list">${stepsHtml}</div>` : "<span>Generating summary…</span>"}
    </div>
  `;
  notifyHeight();
}

function iconFor(state) {
  if (state === "done") return "✓";
  if (state === "active") return "◉";
  if (state === "error") return "✗";
  return "○";
}

function renderError(message) {
  saContent.innerHTML = `
    <div class="sa-error">
      <strong>Could not generate summary</strong>
      ${escHtml(message)}
    </div>
  `;
  notifyHeight();
}

function renderSummary(data) {
  const summaryHtml = formatSummaryText(data.summary || "");
  const sources = data.sources || [];
  const sourcesHtml = sources.length ? `
    <div class="sa-sources">
      ${sources.map((s) => `
        <span class="sa-source-badge sa-source-badge--${s.ok ? "ok" : "error"}"
              title="${s.ok ? "OK" : escHtml(s.error || "error")}">
          ${s.ok ? "✓" : "✗"} ${escHtml(s.name)}
        </span>
      `).join("")}
    </div>
  ` : "";

  const ts = data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "";
  const cached = data.fromCache ? " · cached" : "";

  saContent.innerHTML = `
    <div class="sa-card">
      <div class="sa-card-body" id="saSummaryBody"></div>
      ${sourcesHtml}
    </div>
    ${ts ? `<div class="sa-meta">Generated ${ts}${cached}</div>` : ""}
  `;

  // Inject rendered HTML safely
  document.getElementById("saSummaryBody").innerHTML = summaryHtml;

  saRefreshBtn.hidden = false;
  notifyHeight();
}

// Simple markdown-like formatter (headings, bold, lists)
function formatSummaryText(text) {
  return text
    // Escape HTML first
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Bullet lists
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Line breaks → paragraphs
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => block.startsWith("<h") || block.startsWith("<ul") || block.startsWith("<ol") ? block : `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Main load ───────────────────────────────────────────────────────────────
async function loadSummary() {
  const identifier = phone || customerId;

  if (!campaignId) {
    renderError("Missing ?campaign= parameter.");
    return;
  }

  if (!identifier) {
    renderError("Missing identifier. Provide ?phone= or ?customer_id=.");
    return;
  }

  // Show label in header
  saPhoneLabel.textContent = phone || customerId;
  saRefreshBtn.hidden = true;

  renderLoading([
    { label: "Querying data sources", state: "active" },
    { label: "Generating AI summary", state: "pending" }
  ]);

  const params = new URLSearchParams({ campaign: campaignId });
  if (phone) params.set("phone", phone);
  if (customerId) params.set("customer_id", customerId);

  try {
    const data = await apiFetch(`/api/summaryagentic/summary?${params}`);
    renderSummary(data);
  } catch (err) {
    renderError(err.message);
  }
}

// ── Init ────────────────────────────────────────────────────────────────────
saRefreshBtn.addEventListener("click", loadSummary);

loadSummary();
