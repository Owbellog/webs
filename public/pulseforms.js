/* pulseforms.js — CRM query/submit widget
 * URL: ?campaign=ID&phone=+15551234567
 *      ?campaign=ID&customer_id=C-001
 *      ?demo=1   (no campaign/key needed)
 */

const pageParams  = new URLSearchParams(window.location.search);
const isEmbedded  = window.self !== window.top || pageParams.get("embed") === "1";
const isDemo      = pageParams.get("demo") === "1";
const campaignId  = pageParams.get("campaign") || "";
const phone       = pageParams.get("phone") || "";
const customerId  = pageParams.get("customer_id") || pageParams.get("customerId") || "";
const appBase     = new URL(".", window.location.href);

const pfBody       = document.getElementById("pfBody");
const pfTitle      = document.getElementById("pfTitle");
const pfSubtitle   = document.getElementById("pfSubtitle");
const pfBadge      = document.getElementById("pfBadge");
const pfSourcesRow = document.getElementById("pfSourcesRow");
const pfRefreshBtn = document.getElementById("pfRefreshBtn");

if (isEmbedded) document.documentElement.classList.add("embedded");

// ── State ────────────────────────────────────────────────────────────────────
const state = { config: null, values: {}, submitting: false };

// ── API helpers ──────────────────────────────────────────────────────────────
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

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Source dots ──────────────────────────────────────────────────────────────
function renderSourceDots(sources) {
  pfSourcesRow.innerHTML = (sources || []).map((s) =>
    `<span class="pf-src-dot pf-src-dot--${s.ok ? "ok" : "error"}" title="${esc(s.name)}${s.ok ? "" : ": " + esc(s.error || "error")}"></span>`
  ).join("");
}

function iconForSection(section, index = 0) {
  const text = `${section?.title || ""} ${section?.id || ""}`.toLowerCase();
  if (/contact|customer|basic|name|account|cliente|cuenta/.test(text)) return "ti-user";
  if (/tool|technical|spec|product|assessment|detalle|t[eé]cnico/.test(text)) return "ti-tool";
  if (/note|summary|description|additional|extra|info|nota/.test(text)) return "ti-list-details";
  const icons = ["ti-user", "ti-tool", "ti-list-details", "ti-file-description", "ti-database"];
  return icons[index % icons.length];
}

function isMissingRequiredValue(value, field) {
  if (field?.type === "checkbox") return value !== "true" && value !== true;
  return !String(value ?? "").trim();
}

// ── Form rendering ────────────────────────────────────────────────────────────
function renderFormField(field, prefilled = false) {
  const cls = prefilled ? " pf-prefilled" : "";
  const val = esc(state.values[field.id] || "");
  const req  = field.required ? `<span class="pf-required" title="Required">*</span>` : "";
  const fullClass = (field.type === "textarea") ? " pf-field--full" : "";

  let input;
  switch (field.type) {
    case "textarea":
      input = `<textarea class="pf-textarea${cls}" id="pf-f-${esc(field.id)}" name="${esc(field.id)}"${field.required ? " required" : ""}>${val}</textarea>`;
      break;
    case "select": {
      const opts = String(field.options || "").split(",").map((o) => o.trim()).filter(Boolean);
      const selected = state.values[field.id] || "";
      const optHtml = opts.map((o) => `<option value="${esc(o)}"${o === selected ? " selected" : ""}>${esc(o)}</option>`).join("");
      input = `<select class="pf-select${cls}" id="pf-f-${esc(field.id)}" name="${esc(field.id)}"${field.required ? " required" : ""}><option value="">Select…</option>${optHtml}</select>`;
      break;
    }
    case "checkbox": {
      const checked = state.values[field.id] === "true" || state.values[field.id] === true ? " checked" : "";
      input = `<label class="pf-checkbox-row"><input type="checkbox" id="pf-f-${esc(field.id)}" name="${esc(field.id)}"${checked} /><span>${esc(field.label)}</span></label>`;
      break;
    }
    default: {
      const typeMap = { phone: "tel", email: "email", number: "number", date: "date" };
      const t = typeMap[field.type] || "text";
      input = `<input class="pf-input${cls}" id="pf-f-${esc(field.id)}" name="${esc(field.id)}" type="${t}" value="${val}"${field.required ? " required" : ""} />`;
      break;
    }
  }

  if (field.type === "checkbox") {
    return `<div class="pf-field${fullClass}" data-field-id="${esc(field.id)}">${input}</div>`;
  }

  return `
    <label class="pf-field${fullClass}" data-field-id="${esc(field.id)}" for="pf-f-${esc(field.id)}">
      <span class="pf-label">${esc(field.label)} ${req}</span>
      ${input}
    </label>`;
}

function renderFormWithTabs(pf, layout, prefilled, mode, canSubmit) {
  const formFields = pf.formFields || [];
  const sections = layout.sections;
  const fieldMap = Object.fromEntries(formFields.map((f) => [f.id, f]));
  const total = sections.length;
  const modeLabelMap = { query: "Query", submit: "Submit", both: "Query and submit" };
  const modeLabel = modeLabelMap[mode] || mode;
  const modeBadge = `<span class="pf-mode-badge pf-mode-badge--${esc(mode)}">${esc(modeLabel)}</span>`;

  const tabNav = sections.map((s, i) =>
    `<button type="button" class="tab-btn${i === 0 ? " is-active" : ""}" data-tab="${i}"><i class="ti ${iconForSection(s, i)}" aria-hidden="true"></i><span>${esc(s.title || s.id || `Step ${i + 1}`)}</span></button>`
  ).join("");

  const panels = sections.map((s, i) => {
    const sectionFields = (s.fields || []).map((id) => fieldMap[id]).filter(Boolean);
    const hasTwoCols = sectionFields.length >= 3;
    const fieldsHtml = sectionFields.map((f) => renderFormField(f, prefilled && f.id in state.values)).join("");
    const isLast = i === total - 1;
    const footer = `
      <div class="pf-actions">
        <button type="button" class="pf-btn pf-tabs-footer-prev"${i === 0 ? " disabled" : ""}><i class="ti ti-arrow-left" aria-hidden="true"></i> Previous</button>
        ${isLast && canSubmit
          ? `<button type="submit" class="pf-submit-btn" id="pfSubmitBtn"><i class="ti ti-send" aria-hidden="true"></i> Submit</button>`
          : !isLast
          ? `<button type="button" class="pf-btn pf-btn-primary pf-tabs-footer-next">Next <i class="ti ti-arrow-right" aria-hidden="true"></i></button>`
          : ""}
      </div>`;
    return `
      <section class="pf-section${i === 0 ? " is-active" : ""}" data-panel="${i}">
        <div class="pf-card">
          <div class="section-header"><i class="ti ${iconForSection(s, i)}" aria-hidden="true"></i>${esc(s.title || s.id || "")}</div>
          <div class="pf-grid">
              ${fieldsHtml || '<span style="color:#aab0bf;font-size:.8rem;">Sin campos asignados</span>'}
          </div>
        </div>
        ${footer}
      </section>`;
  }).join("");

  pfBody.innerHTML = `
    <div class="prog-row">
      <span class="prog-label" id="progLabel">Step 1 of ${total}</span>
      <div class="prog-track"><div class="prog-fill" id="pfProgressBar" style="width:${Math.round(100 / total)}%"></div></div>
    </div>
    <nav class="tab-nav" aria-label="Form sections">${tabNav}</nav>
    <form id="pfForm" novalidate>${panels}</form>
    <div id="pfStatusArea"></div>
    <div>${modeBadge}</div>
    ${prefilled ? `<div class="pf-timestamp" id="pfTimestamp"></div>` : ""}`;

  let current = 0;

  function goToTab(idx) {
    if (idx < 0 || idx >= total) return;
    pfBody.querySelectorAll(".pf-section").forEach((p, i) => p.classList.toggle("is-active", i === idx));
    pfBody.querySelectorAll(".tab-btn").forEach((b, i) => b.classList.toggle("is-active", i === idx));
    const bar = document.getElementById("pfProgressBar");
    if (bar) bar.style.width = `${Math.round((idx + 1) / total * 100)}%`;
    const label = document.getElementById("progLabel");
    if (label) label.textContent = `Step ${idx + 1} of ${total}`;
    current = idx;
    notifyHeight();
  }

  function validateTab(idx) {
    const s = sections[idx];
    const required = (s.fields || []).map((id) => fieldMap[id]).filter((f) => f?.required);
    const missing = required.filter((f) => isMissingRequiredValue(state.values[f.id], f));
    if (missing.length) {
      showStatus("error", "Required fields", `Complete: ${missing.map((f) => f.label).join(", ")}`);
      return false;
    }
    return true;
  }

  pfBody.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => goToTab(Number(btn.dataset.tab)));
  });
  pfBody.querySelectorAll(".pf-tabs-footer-next").forEach((btn) => {
    btn.addEventListener("click", () => { if (validateTab(current)) goToTab(current + 1); });
  });
  pfBody.querySelectorAll(".pf-tabs-footer-prev").forEach((btn) => {
    btn.addEventListener("click", () => goToTab(current - 1));
  });

  wireFormEvents(pf);
  notifyHeight();
}

function renderForm(pf, prefilled = false) {
  const formFields = pf.formFields || [];
  const mode = pf.mode || "query";
  const canSubmit = mode === "submit" || mode === "both";
  const modeLabelMap = { query: "Query", submit: "Submit", both: "Query and submit" };
  const modeLabel = modeLabelMap[mode] || mode;
  const modeBadge = `<span class="pf-mode-badge pf-mode-badge--${esc(mode)}">${esc(modeLabel)}</span>`;
  const submitBtn = canSubmit
    ? `<button type="submit" class="pf-submit-btn" id="pfSubmitBtn"><i class="ti ti-send" aria-hidden="true"></i> Submit</button>`
    : "";

  const layout = pf.activeLayout;

  if (layout?.sections?.length) {
    if (layout.layoutStyle === "tabs" && layout.sections.length > 1) {
      renderFormWithTabs(pf, layout, prefilled, mode, canSubmit);
      return;
    }
    const fieldMap = Object.fromEntries(formFields.map((f) => [f.id, f]));
    const assignedIds = new Set(layout.sections.flatMap((s) => s.fields || []));
    const unassigned = formFields.filter((f) => !assignedIds.has(f.id));

    const renderSection = (section) => {
      const sectionFields = (section.fields || []).map((id) => fieldMap[id]).filter(Boolean);
      if (!sectionFields.length) return "";
      const hasTwoCols = sectionFields.length >= 3;
      const fieldsHtml = sectionFields.map((f) => renderFormField(f, prefilled && f.id in state.values)).join("");
      return `
        <div class="pf-card">
          <div class="section-header"><i class="ti ${iconForSection(section)}" aria-hidden="true"></i>${esc(section.title || section.id || "")}</div>
          <div class="pf-grid">
              ${fieldsHtml}
          </div>
        </div>`;
    };

    const mainSections = layout.sections.filter((s) => s.placement !== "side");
    const sideSections = layout.sections.filter((s) => s.placement === "side");

    const unassignedHtml = unassigned.length
      ? `<div class="pf-card"><div class="section-header"><i class="ti ti-list-details" aria-hidden="true"></i>Additional information</div><div class="pf-grid">
           ${unassigned.map((f) => renderFormField(f, prefilled && f.id in state.values)).join("")}
         </div></div>`
      : "";

    let bodyHtml;
    if (mainSections.length && sideSections.length) {
      bodyHtml = `
        <div class="pf-layout-grid">
          <div class="pf-layout-main">${mainSections.map(renderSection).join("")}${unassignedHtml}</div>
          <div class="pf-layout-side">${sideSections.map(renderSection).join("")}</div>
        </div>`;
    } else {
      bodyHtml = layout.sections.map(renderSection).join("") + unassignedHtml;
    }

    pfBody.innerHTML = `
      <form id="pfForm" novalidate>
        ${bodyHtml}
        ${submitBtn ? `<div class="pf-submit-wrap">${submitBtn}</div>` : ""}
      </form>
      <div id="pfStatusArea"></div>
      <div>${modeBadge}</div>
      ${prefilled ? `<div class="pf-timestamp" id="pfTimestamp"></div>` : ""}`;
  } else {
    const fieldsHtml = formFields.map((f) => renderFormField(f, prefilled && f.id in state.values)).join("");
    pfBody.innerHTML = `
      <div class="pf-card">
        <div class="section-header"><i class="ti ti-list-details" aria-hidden="true"></i>Information</div>
          <form class="pf-grid" id="pfForm" novalidate>
            ${fieldsHtml}
            ${submitBtn ? `<div class="pf-field pf-field--full">${submitBtn}</div>` : ""}
          </form>
      </div>
      <div id="pfStatusArea"></div>
      <div>${modeBadge}</div>
      ${prefilled ? `<div class="pf-timestamp" id="pfTimestamp"></div>` : ""}`;
  }

  wireFormEvents(pf);
  notifyHeight();
}

function setTimestamp(ts) {
  const el = document.getElementById("pfTimestamp");
  if (el && ts) el.textContent = `Queried ${new Date(ts).toLocaleTimeString()}`;
}

// ── Form events ───────────────────────────────────────────────────────────────
function wireFormEvents(pf) {
  const form = document.getElementById("pfForm");
  if (!form) return;

  // Track value changes
  form.querySelectorAll("input, select, textarea").forEach((el) => {
    el.addEventListener("change", () => {
      const id = el.name;
      state.values[id] = el.type === "checkbox" ? String(el.checked) : el.value;
    });
    el.addEventListener("input", () => {
      const id = el.name;
      state.values[id] = el.type === "checkbox" ? String(el.checked) : el.value;
    });
  });

  const submitBtn = document.getElementById("pfSubmitBtn");
  if (!submitBtn) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.submitting) return;

    // Collect current values
    const formData = {};
    form.querySelectorAll("[name]").forEach((el) => {
      formData[el.name] = el.type === "checkbox" ? String(el.checked) : el.value;
    });

    // Basic required validation
    const missing = (pf.formFields || []).filter((f) => f.required && isMissingRequiredValue(formData[f.id], f));
    if (missing.length) {
      showStatus("error", "Required fields", `Complete: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }

    state.submitting = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="ti ti-loader" aria-hidden="true"></i> Sending...';

    try {
      const result = await apiFetch("/api/pulseforms/submit", {
        method: "POST",
        body: JSON.stringify({
          campaign: campaignId,
          phone,
          customer_id: customerId,
          values: formData
        })
      });

      renderSourceDots(result.sources || []);

      if (result.ok) {
        showStatus("ok", "Information sent", "The data was saved successfully in the CRM.");
      } else {
        const errors = (result.sources || []).filter((s) => !s.ok).map((s) => s.error || s.name).join("; ");
        showStatus("error", "Submit error", errors || "One or more destinations failed.");
      }
    } catch (err) {
      showStatus("error", "Submit error", err.message);
    } finally {
      state.submitting = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="ti ti-send" aria-hidden="true"></i> Submit';
      notifyHeight();
    }
  });
}

function showStatus(type, title, detail) {
  const el = document.getElementById("pfStatusArea");
  if (!el) return;
  el.innerHTML = `
    <div class="pf-banner pf-banner--${esc(type)}">
      <strong>${esc(title)}</strong>${esc(detail)}
    </div>`;
  notifyHeight();
}

// ── Loading / Error ───────────────────────────────────────────────────────────
function renderLoading(msg = "Loading form...") {
  pfBody.innerHTML = `
    <div class="pf-loading">
      <div class="pf-spinner"></div>
      <span>${esc(msg)}</span>
    </div>`;
}

function renderError(msg) {
  pfBody.innerHTML = `
    <div class="pf-error-full">
      <strong>PulseForms could not be loaded</strong>${esc(msg)}
    </div>`;
  notifyHeight();
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_CONFIG = {
  enabled: true,
  mode: "both",
  formFields: [
    { id: "first_name", label: "First name",  type: "text",  required: true  },
    { id: "last_name",  label: "Last name",   type: "text",  required: true  },
    { id: "phone",      label: "Phone",       type: "phone", required: true  },
    { id: "email",      label: "Email",       type: "email", required: false },
    { id: "account",    label: "Account",     type: "text",  required: false },
    { id: "notes",      label: "Notes",       type: "textarea", required: false }
  ],
  sourceCount: 1,
  activeLayout: {
    layoutStyle: "tabs",
    sections: [
      { id: "contact", title: "Contacto",  type: "form", placement: "main", fields: ["first_name", "last_name", "phone", "email"] },
      { id: "account", title: "Cuenta",    type: "form", placement: "main", fields: ["account"] },
      { id: "notes",   title: "Notas",     type: "form", placement: "main", fields: ["notes"] }
    ],
    generatedAt: Date.now()
  }
};

const DEMO_VALUES = {
  first_name: "John",
  last_name:  "Smith",
  phone:      "+15551234567",
  email:      "john.smith@example.com",
  account:    "ACC-00291847"
};

function loadDemo() {
  pfBadge.textContent = "+15551234567";
  pfBadge.hidden = false;
  if (pfSubtitle) pfSubtitle.textContent = "Sugar CRM integration";
  renderSourceDots([{ id: "crm", name: "Sugar CRM (demo)", ok: true }]);
  pfRefreshBtn.hidden = false;
  state.config = DEMO_CONFIG;
  state.values = { ...DEMO_VALUES };
  renderForm(DEMO_CONFIG, true);
  setTimestamp(Date.now());
}

// ── Load real data ────────────────────────────────────────────────────────────
async function load() {
  const identifier = phone || customerId;
  if (!campaignId) { renderError("Missing ?campaign= parameter."); return; }

  const displayId = phone || customerId || campaignId;
  pfBadge.textContent = displayId;
  pfBadge.hidden = false;

  renderLoading("Loading configuration...");

  // 1. Fetch pulseforms config (dedicated endpoint — no token/kbIds required)
  let pf;
  try {
    const configData = await apiFetch(`/api/pulseforms/config?campaign=${encodeURIComponent(campaignId)}`);
    if (!configData.configured) throw new Error(configData.error || "Campaign not configured.");

    pf = configData.campaign?.pulseforms;
    if (!pf) throw new Error("PulseForms is not enabled for this campaign.");

    state.config = pf;

    const campaignName = configData.campaign?.name || "PulseForms";
    pfTitle.textContent = campaignName;
    if (pfSubtitle) pfSubtitle.textContent = "CRM integration";
    document.title = campaignName;
  } catch (err) {
    renderError(err.message);
    return;
  }

  const mode = pf.mode || "query";
  const needsQuery = (mode === "query" || mode === "both") && identifier && pf.sourceCount > 0;

  // 2. If query mode and we have an identifier, pre-fill
  if (needsQuery) {
    renderLoading("Consulting CRM...");
    try {
      const params = new URLSearchParams({ campaign: campaignId });
      if (phone) params.set("phone", phone);
      if (customerId) params.set("customer_id", customerId);

      const queryData = await apiFetch(`/api/pulseforms/query?${params}`);
      state.values = queryData.values || {};
      renderSourceDots(queryData.sources || []);
      renderForm(pf, true);
      setTimestamp(queryData.queriedAt);
    } catch (err) {
      // Query failed — still show empty form
      renderSourceDots([]);
      renderForm(pf, false);
      showStatus("error", "CRM query failed", err.message);
    }
  } else {
    renderForm(pf, false);
  }

  pfRefreshBtn.hidden = mode === "submit";
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function refresh() {
  pfRefreshBtn.disabled = true;
  state.values = {};
  await (isDemo ? Promise.resolve(loadDemo()) : load());
  pfRefreshBtn.disabled = false;
}

pfRefreshBtn.addEventListener("click", refresh);

if (window.location.protocol === "file:") {
  renderError("Open through the server (not file://).");
} else if (isDemo) {
  loadDemo();
} else {
  load();
}
