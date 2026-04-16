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

// ── Height notify ───────────────────────────────────────────────────────────
function notifyHeight() {
  if (!isEmbedded) return;
  window.parent.postMessage({ type: "nextiq:resize", height: document.body.scrollHeight }, "*");
}

// ── HTML escape ─────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Pill helper ─────────────────────────────────────────────────────────────
function pill(text, color = "blue") {
  return `<span class="sa-pill sa-pill--${color}">${esc(text)}</span>`;
}

// ── RENDER: loading ─────────────────────────────────────────────────────────
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

// ── RENDER: error ────────────────────────────────────────────────────────────
function renderError(msg) {
  saBody.innerHTML = `
    <div class="sa-error">
      <strong>Could not generate summary</strong>${esc(msg)}
    </div>`;
  notifyHeight();
}

// ── RENDER: sources dots in header ──────────────────────────────────────────
function renderSourceDots(sources) {
  if (!sources || !sources.length) { saSourcesRow.innerHTML = ""; return; }
  saSourcesRow.innerHTML = sources.map((s) =>
    `<span class="sa-src-dot sa-src-dot--${s.ok ? "ok" : "error"}" title="${esc(s.name)}${s.ok ? "" : ": " + esc(s.error)}"></span>`
  ).join("");
}

// ── RENDER: structured layout ───────────────────────────────────────────────
function renderStructured(parsed, meta) {
  const { profile, recentCalls, openCases, accountStatus, flags, recommendation } = parsed;

  // ── LEFT ──
  const leftHtml = `
    ${profile ? `
    <div class="sa-card">
      <div class="sa-card-head"><span class="sa-card-head-icon">👤</span><h3>Profile</h3></div>
      <div class="sa-card-body">
        <p class="sa-profile-name">${esc(profile.name || "—")}</p>
        <p class="sa-profile-phone">${esc(profile.phone || phone || customerId || "—")}</p>
        <div class="sa-kv-list">
          ${profile.accountNumber ? `<div class="sa-kv"><span class="sa-kv-label">Account</span><span class="sa-kv-value">${esc(profile.accountNumber)}</span></div>` : ""}
          ${profile.plan ? `<div class="sa-kv"><span class="sa-kv-label">Plan</span><span class="sa-kv-value">${esc(profile.plan)}</span></div>` : ""}
          ${profile.segment ? `<div class="sa-kv"><span class="sa-kv-label">Segment</span><span class="sa-kv-value">${esc(profile.segment)}</span></div>` : ""}
          ${profile.since ? `<div class="sa-kv"><span class="sa-kv-label">Since</span><span class="sa-kv-value">${esc(profile.since)}</span></div>` : ""}
        </div>
      </div>
    </div>` : ""}

    ${accountStatus ? `
    <div class="sa-card">
      <div class="sa-card-head"><span class="sa-card-head-icon">💳</span><h3>Account</h3></div>
      <div class="sa-card-body">
        <div class="sa-kv-list">
          ${accountStatus.status ? `<div class="sa-kv"><span class="sa-kv-label">Status</span><span class="sa-kv-value">${pill(accountStatus.status, accountStatus.status === "Active" ? "green" : "red")}</span></div>` : ""}
          ${accountStatus.balance !== undefined ? `<div class="sa-kv"><span class="sa-kv-label">Balance</span><span class="sa-kv-value">${esc(accountStatus.balance)}</span></div>` : ""}
          ${accountStatus.nextInvoice ? `<div class="sa-kv"><span class="sa-kv-label">Next invoice</span><span class="sa-kv-value">${esc(accountStatus.nextInvoice)}</span></div>` : ""}
          ${accountStatus.nextInvoiceDate ? `<div class="sa-kv"><span class="sa-kv-label">Due</span><span class="sa-kv-value">${esc(accountStatus.nextInvoiceDate)}</span></div>` : ""}
          ${accountStatus.contract ? `<div class="sa-kv"><span class="sa-kv-label">Contract</span><span class="sa-kv-value">${esc(accountStatus.contract)}</span></div>` : ""}
        </div>
      </div>
    </div>` : ""}

    ${flags && flags.length ? `
    <div class="sa-card">
      <div class="sa-card-head"><span class="sa-card-head-icon">🚩</span><h3>Flags</h3></div>
      <div class="sa-card-body">
        <div class="sa-flag-list">
          ${flags.map((f) => `
            <div class="sa-flag-item">
              <span class="sa-flag-icon">${f.type === "escalation" ? "⚠️" : f.type === "vip" ? "⭐" : "ℹ️"}</span>
              <span>${esc(f.message)}</span>
            </div>`).join("")}
        </div>
      </div>
    </div>` : ""}
  `;

  // ── RIGHT ──
  const callsHtml = recentCalls && recentCalls.length ? `
    <div class="sa-card">
      <div class="sa-card-head"><span class="sa-card-head-icon">📞</span><h3>Recent Calls</h3></div>
      <div class="sa-card-body">
        <div class="sa-call-list">
          ${recentCalls.map((c) => `
            <div class="sa-call-item">
              <div class="sa-call-dot"></div>
              <div class="sa-call-info">
                <div class="sa-call-reason">${esc(c.reason)}</div>
                <div class="sa-call-meta">${esc(c.date)}${c.agent ? " · " + esc(c.agent) : ""}${c.duration ? " · " + esc(c.duration) : ""} · ${pill(c.status || "resolved", c.status === "escalated" ? "yellow" : "green")}</div>
              </div>
            </div>`).join("")}
        </div>
      </div>
    </div>` : "";

  const casesHtml = openCases && openCases.length ? `
    <div class="sa-card">
      <div class="sa-card-head"><span class="sa-card-head-icon">📋</span><h3>Open Cases</h3></div>
      <div class="sa-card-body">
        <div class="sa-case-list">
          ${openCases.map((c) => `
            <div class="sa-case-item">
              <div class="sa-case-head">
                <span class="sa-case-id">${esc(c.id)}</span>
                ${pill(c.status || "Open", c.status === "Closed" ? "green" : c.status === "Escalated" ? "red" : "yellow")}
              </div>
              <div class="sa-case-desc">${esc(c.description)}</div>
            </div>`).join("")}
        </div>
      </div>
    </div>` : "";

  const recHtml = recommendation ? `
    <div class="sa-card">
      <div class="sa-card-head"><span class="sa-card-head-icon">💡</span><h3>Recommended Approach</h3></div>
      <div class="sa-card-body">
        <div class="sa-recommendation">${esc(recommendation)}</div>
      </div>
    </div>` : "";

  const ts = meta.generatedAt
    ? `<div class="sa-timestamp">Generated ${new Date(meta.generatedAt).toLocaleTimeString()}${meta.fromCache ? " · cached" : ""}</div>`
    : "";

  const rightHtml = `
    ${callsHtml || casesHtml ? `<div class="sa-row">${callsHtml}${casesHtml}</div>` : ""}
    ${recHtml}
    ${ts}
  `;

  saBody.innerHTML = `
    <div class="sa-left">${leftHtml}</div>
    <div class="sa-right">${rightHtml}</div>
  `;
  notifyHeight();
}

// ── RENDER: fallback markdown (for real AI freeform text) ────────────────────
function renderMarkdown(text, meta) {
  const html = text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/^### (.+)$/gm,"<h3>$1</h3>")
    .replace(/^## (.+)$/gm,"<h2>$1</h2>")
    .replace(/^# (.+)$/gm,"<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/^[-*] (.+)$/gm,"<li>$1</li>")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => b.startsWith("<h") || b.startsWith("<li") ? b.startsWith("<li") ? `<ul>${b}</ul>` : b : `<p>${b.replace(/\n/g,"<br>")}</p>`)
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

// ── Parse freeform AI text → structured sections ─────────────────────────────
function parseAiText(text) {
  if (!text) return null;

  const sections = {};
  let current = null;
  let buffer = [];

  for (const line of text.split("\n")) {
    const headMatch = line.match(/^#+\s+(.+)/);
    if (headMatch) {
      if (current) sections[current] = buffer.join("\n").trim();
      current = headMatch[1].toLowerCase().replace(/[^a-z0-9]+/g,"_");
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  if (current) sections[current] = buffer.join("\n").trim();

  if (Object.keys(sections).length < 2) return null;

  // Try to map known sections
  const findSection = (...keys) => {
    for (const k of keys) {
      const match = Object.keys(sections).find((s) => s.includes(k));
      if (match) return sections[match];
    }
    return null;
  };

  const recText = findSection("recommend", "approach", "suggested");
  const callText = findSection("call_hist", "recent_call", "call_log");
  const caseText = findSection("open_case", "case", "ticket");
  const flagText = findSection("flag", "alert", "note", "warn");
  const profileText = findSection("profile", "customer", "account_info");
  const accountText = findSection("account_status", "billing");

  if (!recText && !callText && !caseText) return null;

  return {
    profile: profileText ? { name: "", phone: "", raw: profileText } : null,
    accountStatus: accountText ? { raw: accountText } : null,
    recentCalls: callText ? parseCallLines(callText) : [],
    openCases: caseText ? parseCaseLines(caseText) : [],
    flags: flagText ? parseFlagLines(flagText) : [],
    recommendation: recText || null
  };
}

function parseCallLines(text) {
  return text.split("\n")
    .map((l) => l.replace(/^[-*]\s*/,"").trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((l) => {
      const dateMatch = l.match(/(\w{3,9} \d{1,2},? \d{4})/);
      return { date: dateMatch ? dateMatch[1] : "", reason: l.replace(dateMatch?.[0] || "","").replace(/^[—–-]\s*/,"").trim(), status: "resolved" };
    });
}

function parseCaseLines(text) {
  return text.split("\n")
    .map((l) => l.replace(/^[-*]\s*/,"").trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((l) => {
      const caseId = l.match(/([A-Z]+-\d+)/)?.[1] || "CASE";
      const statusMatch = l.match(/\b(open|closed|pending|escalated)\b/i)?.[1];
      return { id: caseId, status: statusMatch || "Open", description: l };
    });
}

function parseFlagLines(text) {
  return text.split("\n")
    .map((l) => l.replace(/^[-*⚠️⭐ℹ️]\s*/u,"").trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((l) => ({ type: l.toLowerCase().includes("escalat") ? "escalation" : "info", message: l }));
}

// ── Main render from API response ────────────────────────────────────────────
function renderSummary(data) {
  renderSourceDots(data.sources || []);

  const structured = parseAiText(data.summary || "");

  if (structured) {
    renderStructured(structured, data);
  } else {
    renderMarkdown(data.summary || "(No summary generated.)", data);
  }

  saRefreshBtn.hidden = false;
}

// ── DEMO data ────────────────────────────────────────────────────────────────
const DEMO_PARSED = {
  profile: {
    name: "John Smith",
    phone: "+1 (555) 123-4567",
    accountNumber: "ACC-00291847",
    plan: "Business Pro",
    segment: "SMB · Priority: Medium",
    since: "March 2021"
  },
  accountStatus: {
    status: "Active",
    balance: "$0.00",
    nextInvoice: "$149.00",
    nextInvoiceDate: "May 1, 2026",
    contract: "Month-to-month"
  },
  recentCalls: [
    { date: "Apr 14, 2026", reason: "Billing inquiry", status: "resolved",  agent: "Maria L.", duration: "4m 32s" },
    { date: "Apr 02, 2026", reason: "Service outage report", status: "escalated", agent: "Carlos R.", duration: "8m 14s" },
    { date: "Mar 18, 2026", reason: "Password reset assistance", status: "resolved", agent: "Ana P.", duration: "2m 10s" },
    { date: "Feb 27, 2026", reason: "Plan upgrade inquiry", status: "resolved", agent: "Tom W.", duration: "5m 02s" }
  ],
  openCases: [
    { id: "CASE-88421", status: "Open",      description: "Intermittent connectivity issues reported. Awaiting follow-up call from Tier 2." },
    { id: "CASE-88109", status: "Escalated", description: "Billing discrepancy — overcharged in March invoice. Pending finance review." }
  ],
  flags: [
    { type: "escalation", message: "Escalation risk — 2 escalations in the last 60 days" },
    { type: "info",       message: "Expressed frustration in Apr 2 call regarding response time" },
    { type: "vip",        message: "Long-term customer — 5 years of continuous service" }
  ],
  recommendation: "Greet John by name and acknowledge CASE-88421 proactively before he asks. Offer a status update on the connectivity issue. If billing comes up, confirm the next invoice date and note the March discrepancy is under review. Be patient and empathetic — customer has shown frustration recently. Avoid transfer if possible."
};

const DEMO_DATA = {
  ok: true,
  sources: [
    { id: "crm",     name: "CRM History",   ok: true,  error: null },
    { id: "billing", name: "Billing API",   ok: true,  error: null },
    { id: "cases",   name: "Case Manager",  ok: true,  error: null },
    { id: "aux",     name: "Aux System",    ok: false, error: "Timeout" }
  ],
  summary: "",
  _parsed: DEMO_PARSED,
  generatedAt: Date.now(),
  fromCache: false
};

function loadDemo() {
  saPhoneLabel.textContent = "+15551234567";
  renderSourceDots(DEMO_DATA.sources);
  renderStructured(DEMO_DATA._parsed, DEMO_DATA);
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

if (isDemo) {
  loadDemo();
} else {
  loadSummary();
}
