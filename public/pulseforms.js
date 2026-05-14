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
    <div class="pf-field${fullClass}" data-field-id="${esc(field.id)}">
      <label class="pf-label" for="pf-f-${esc(field.id)}">${esc(field.label)} ${req}</label>
      ${input}
    </div>`;
}

function renderForm(pf, prefilled = false) {
  const formFields = pf.formFields || [];
  const mode = pf.mode || "query";
  const canSubmit = mode === "submit" || mode === "both";

  const modeLabelMap = { query: "Consulta", submit: "Envío", both: "Consulta y envío" };
  const modeLabel = modeLabelMap[mode] || mode;

  const fieldsHtml = formFields.map((f) => renderFormField(f, prefilled && f.id in state.values)).join("");

  const submitBtn = canSubmit
    ? `<div class="pf-field pf-field--full">
        <button type="submit" class="pf-submit-btn" id="pfSubmitBtn">Enviar información</button>
       </div>`
    : "";

  const hasTwoCols = formFields.length >= 3;

  pfBody.innerHTML = `
    <div class="pf-card">
      <div class="pf-card-head">
        <h3>
          <span class="pf-mode-badge pf-mode-badge--${esc(mode)}">${esc(modeLabel)}</span>
        </h3>
      </div>
      <div class="pf-card-body">
        <form class="pf-form${hasTwoCols ? " pf-form--2col" : ""}" id="pfForm" novalidate>
          ${fieldsHtml}
          ${submitBtn}
        </form>
      </div>
    </div>
    <div id="pfStatusArea"></div>
    ${prefilled ? `<div class="pf-timestamp" id="pfTimestamp"></div>` : ""}`;

  wireFormEvents(pf);
  notifyHeight();
}

function setTimestamp(ts) {
  const el = document.getElementById("pfTimestamp");
  if (el && ts) el.textContent = `Consultado ${new Date(ts).toLocaleTimeString()}`;
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
    const missing = (pf.formFields || []).filter((f) => f.required && !formData[f.id]?.trim());
    if (missing.length) {
      showStatus("error", "Campos requeridos", `Completa: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }

    state.submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";

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
        showStatus("ok", "Información enviada", "Los datos se guardaron correctamente en el CRM.");
      } else {
        const errors = (result.sources || []).filter((s) => !s.ok).map((s) => s.error || s.name).join("; ");
        showStatus("error", "Error al enviar", errors || "Uno o más destinos fallaron.");
      }
    } catch (err) {
      showStatus("error", "Error al enviar", err.message);
    } finally {
      state.submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar información";
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
function renderLoading(msg = "Cargando formulario…") {
  pfBody.innerHTML = `
    <div class="pf-loading">
      <div class="pf-spinner"></div>
      <span>${esc(msg)}</span>
    </div>`;
}

function renderError(msg) {
  pfBody.innerHTML = `
    <div class="pf-error-full">
      <strong>No se pudo cargar PulseForms</strong>${esc(msg)}
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
  activeLayout: null
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

  renderLoading("Cargando configuración…");

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
    document.title = campaignName;
  } catch (err) {
    renderError(err.message);
    return;
  }

  const mode = pf.mode || "query";
  const needsQuery = (mode === "query" || mode === "both") && identifier && pf.sourceCount > 0;

  // 2. If query mode and we have an identifier, pre-fill
  if (needsQuery) {
    renderLoading("Consultando CRM…");
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
      showStatus("error", "No se pudo consultar el CRM", err.message);
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
