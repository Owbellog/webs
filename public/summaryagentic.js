/* summaryagentic.js — Customer Summary widget
 * URL: ?campaign=ID&phone=+15551234567
 *      ?campaign=ID&customer_id=C-001
 *      ?demo=1   (no campaign/key needed — shows demo data)
 */

const pageParams  = new URLSearchParams(window.location.search);
const isEmbedded  = window.self !== window.top || pageParams.get("embed") === "1";
const isDemo      = pageParams.get("demo") === "1";
const campaignId  = pageParams.get("campaign") || "";
const phone       = pageParams.get("phone") || "";
const customerId  = pageParams.get("customer_id") || pageParams.get("customerId") || "";
const appBase     = new URL(".", window.location.href);

const saBody       = document.getElementById("saBody");
const saPhoneLabel = document.getElementById("saPhoneLabel");
const saSourcesRow = document.getElementById("saSourcesRow");
const saRefreshBtn = document.getElementById("saRefreshBtn");

if (isEmbedded) document.documentElement.classList.add("embedded");

// ── API ─────────────────────────────────────────────────────────────────────
function buildApiUrl(path) {
  return new URL(path.startsWith("/") ? path.slice(1) : path, appBase).toString();
}
async function apiFetch(path, opts = {}) {
  const res = await fetch(buildApiUrl(path), {
    ...opts, credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function notifyHeight() {
  if (!isEmbedded) return;
  window.parent.postMessage({ type: "nextiq:resize", height: document.body.scrollHeight }, "*");
}

// ── Escape ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Pill ────────────────────────────────────────────────────────────────────
function pill(text, color = "blue") {
  return `<span class="sa-pill sa-pill--${esc(color)}">${esc(text)}</span>`;
}

function statusColor(status) {
  const s = String(status || "").toLowerCase();
  if (["resolved","closed","active","paid"].some((k) => s.includes(k))) return "green";
  if (["escalated","overdue","failed","missed"].some((k) => s.includes(k))) return "red";
  if (["pending","open","waiting","in progress"].some((k) => s.includes(k))) return "yellow";
  return "blue";
}

// ── Source dots ─────────────────────────────────────────────────────────────
function renderSourceDots(sources) {
  saSourcesRow.innerHTML = (sources || []).map((s) =>
    `<span class="sa-src-dot sa-src-dot--${s.ok ? "ok" : "error"}" title="${esc(s.name)}${s.ok ? "" : ": " + esc(s.error)}"></span>`
  ).join("");
}

// ── Section renderers ────────────────────────────────────────────────────────
function renderSection(section) {
  const body = renderSectionBody(section);
  if (!body) return "";
  return `
    <div class="sa-card">
      <div class="sa-card-head">
        <span class="sa-card-head-icon">${esc(section.icon || "📄")}</span>
        <h3>${esc(section.title || "")}</h3>
      </div>
      <div class="sa-card-body">${body}</div>
    </div>`;
}

function renderSectionBody(section) {
  const items = section.items || [];
  if (!items.length) return "";

  switch (section.type) {

    case "kv":
      return `<div class="sa-kv-list">${items.map((item) => `
        <div class="sa-kv">
          <span class="sa-kv-label">${esc(item.label)}</span>
          <span class="sa-kv-value">${
            item.highlight
              ? pill(item.value, item.highlight)
              : esc(item.value)
          }</span>
        </div>`).join("")}</div>`;

    case "calllog":
      return `<div class="sa-call-list">${items.map((item) => `
        <div class="sa-call-item">
          <div class="sa-call-dot"></div>
          <div class="sa-call-info">
            <div class="sa-call-reason">${esc(item.reason)}</div>
            <div class="sa-call-meta">
              ${item.date ? esc(item.date) : ""}
              ${item.agent ? " · " + esc(item.agent) : ""}
              ${item.duration ? " · " + esc(item.duration) : ""}
              ${item.status ? " · " + pill(item.status, statusColor(item.status)) : ""}
            </div>
          </div>
        </div>`).join("")}</div>`;

    case "caselist":
      return `<div class="sa-case-list">${items.map((item) => `
        <div class="sa-case-item">
          <div class="sa-case-head">
            <span class="sa-case-id">${esc(item.id)}</span>
            ${item.status ? pill(item.status, statusColor(item.status)) : ""}
          </div>
          <div class="sa-case-desc">${esc(item.description)}</div>
        </div>`).join("")}</div>`;

    case "flags":
      return `<div class="sa-flag-list">${items.map((item) => {
        const icon = item.type === "escalation" ? "⚠️"
                   : item.type === "vip"        ? "⭐"
                   : item.type === "warning"    ? "🔴"
                   : "ℹ️";
        return `<div class="sa-flag-item">
          <span class="sa-flag-icon">${icon}</span>
          <span>${esc(item.message)}</span>
        </div>`;
      }).join("")}</div>`;

    case "recommendation":
      return `<div class="sa-recommendation">${esc(items[0]?.content || "")}</div>`;

    case "text":
    default:
      return `<div class="sa-text-section">${items.map((item) => `<p>${esc(item.content || "")}</p>`).join("")}</div>`;
  }
}

// ── Markdown fallback (when AI returns plain text) ───────────────────────────
function renderMarkdown(text, meta) {
  const html = text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/^### (.+)$/gm,"<h3>$1</h3>")
    .replace(/^## (.+)$/gm,"<h2>$1</h2>")
    .replace(/^# (.+)$/gm,"<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/^[-*] (.+)$/gm,"<li>$1</li>")
    .split(/\n{2,}/)
    .map((b) => b.trim()).filter(Boolean)
    .map((b) => b.startsWith("<h") || b.startsWith("<li") ? (b.startsWith("<li") ? `<ul>${b}</ul>` : b) : `<p>${b.replace(/\n/g,"<br>")}</p>`)
    .join("\n");

  const ts = meta.generatedAt
    ? `<div class="sa-timestamp">Generated ${new Date(meta.generatedAt).toLocaleTimeString()}${meta.fromCache ? " · cached" : ""}</div>`
    : "";

  saBody.innerHTML = `
    <div class="sa-left"></div>
    <div class="sa-right">
      <div class="sa-card">
        <div class="sa-card-body sa-markdown" id="saSummaryBody"></div>
      </div>
      ${ts}
    </div>`;
  document.getElementById("saSummaryBody").innerHTML = html;
  notifyHeight();
}

// ── Main render from API response ────────────────────────────────────────────
function renderSummary(data) {
  renderSourceDots(data.sources || []);

  const sections = data.sections;

  if (Array.isArray(sections) && sections.length > 0) {
    const leftSections  = sections.filter((s) => s.placement === "left");
    const rightSections = sections.filter((s) => s.placement !== "left");

    const ts = data.generatedAt
      ? `<div class="sa-timestamp">Generated ${new Date(data.generatedAt).toLocaleTimeString()}${data.fromCache ? " · cached" : ""}</div>`
      : "";

    saBody.innerHTML = `
      <div class="sa-left">${leftSections.map(renderSection).join("")}</div>
      <div class="sa-right">${rightSections.map(renderSection).join("")}${ts}</div>
    `;
  } else {
    // Fallback to markdown for plain text responses
    renderMarkdown(data.summary || "(No summary generated.)", data);
  }

  saRefreshBtn.hidden = false;
  notifyHeight();
}

// ── Loading / Error ──────────────────────────────────────────────────────────
function renderLoading() {
  saBody.innerHTML = `
    <div class="sa-loading">
      <div class="sa-spinner"></div>
      <div class="sa-step-list">
        <div class="sa-step sa-step--active">◉ Querying data sources…</div>
        <div class="sa-step">○ Generating AI summary</div>
      </div>
    </div>`;
}

function renderError(msg) {
  saBody.innerHTML = `<div class="sa-error"><strong>Could not generate summary</strong>${esc(msg)}</div>`;
  notifyHeight();
}

// ── Demo data ────────────────────────────────────────────────────────────────
const DEMO_SECTIONS = [
  {
    id: "profile", title: "Customer Profile", icon: "👤",
    placement: "left", type: "kv",
    items: [
      { label: "Name",       value: "John Smith" },
      { label: "Phone",      value: "+1 (555) 123-4567" },
      { label: "Account",    value: "ACC-00291847" },
      { label: "Plan",       value: "Business Pro" },
      { label: "Segment",    value: "SMB" },
      { label: "Customer since", value: "March 2021" }
    ]
  },
  {
    id: "account", title: "Account Status", icon: "💳",
    placement: "left", type: "kv",
    items: [
      { label: "Status",       value: "Active",       highlight: "green" },
      { label: "Balance",      value: "$0.00" },
      { label: "Next invoice", value: "$149.00 — May 1, 2026" },
      { label: "Contract",     value: "Month-to-month" }
    ]
  },
  {
    id: "flags", title: "Flags", icon: "🚩",
    placement: "left", type: "flags",
    items: [
      { type: "escalation", message: "Escalation risk — 2 escalations in 60 days" },
      { type: "info",       message: "Expressed frustration in Apr 2 call" },
      { type: "vip",        message: "Long-term customer — 5 years continuous" }
    ]
  },
  {
    id: "recent_calls", title: "Recent Calls", icon: "📞",
    placement: "right", type: "calllog",
    items: [
      { date: "Apr 14, 2026", reason: "Billing inquiry",             agent: "Maria L.",  duration: "4m 32s", status: "resolved" },
      { date: "Apr 02, 2026", reason: "Service outage report",       agent: "Carlos R.", duration: "8m 14s", status: "escalated" },
      { date: "Mar 18, 2026", reason: "Password reset assistance",   agent: "Ana P.",    duration: "2m 10s", status: "resolved" },
      { date: "Feb 27, 2026", reason: "Plan upgrade inquiry",        agent: "Tom W.",    duration: "5m 02s", status: "resolved" }
    ]
  },
  {
    id: "open_cases", title: "Open Cases", icon: "📋",
    placement: "right", type: "caselist",
    items: [
      { id: "CASE-88421", status: "Open",      description: "Intermittent connectivity issues. Awaiting Tier 2 follow-up." },
      { id: "CASE-88109", status: "Escalated", description: "Billing discrepancy — overcharged March invoice. Pending finance review." }
    ]
  },
  {
    id: "recommendation", title: "Recommended Approach", icon: "💡",
    placement: "right", type: "recommendation",
    items: [
      { content: "Greet John by name and proactively acknowledge CASE-88421 before he asks. Offer a status update on the connectivity issue. If billing comes up, confirm the next invoice date and note the March discrepancy is under review. Be patient and empathetic — customer has shown frustration recently. Avoid transfer if possible." }
    ]
  }
];

function loadDemo() {
  saPhoneLabel.textContent = "+15551234567";
  renderSourceDots([
    { id: "crm",     name: "CRM History",  ok: true  },
    { id: "billing", name: "Billing API",  ok: true  },
    { id: "cases",   name: "Case Manager", ok: true  },
    { id: "aux",     name: "Aux System",   ok: false, error: "Timeout" }
  ]);
  renderSummary({ sections: DEMO_SECTIONS, generatedAt: Date.now(), fromCache: false });
  saRefreshBtn.hidden = false;
}

// ── Load real data ────────────────────────────────────────────────────────────
async function loadSummary() {
  const identifier = phone || customerId;
  if (!campaignId) { renderError("Missing ?campaign= parameter."); return; }
  if (!identifier) { renderError("Missing ?phone= or ?customer_id=."); return; }

  saPhoneLabel.textContent = phone || customerId;
  saRefreshBtn.hidden = true;
  renderLoading();

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

// ── Init ──────────────────────────────────────────────────────────────────────
saRefreshBtn.addEventListener("click", isDemo ? loadDemo : loadSummary);
isDemo ? loadDemo() : loadSummary();
