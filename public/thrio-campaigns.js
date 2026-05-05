"use strict";

// ── Estado ────────────────────────────────────────────────────────────────
let allCampaigns = [];
let filteredCampaigns = [];
let sortCol = "name";
let sortDir = 1;
let widgetLanguage = "es";

const I18N = {
  es: {
    page_title: "NCC — Gestión de Campañas SMS",
    tab_campaigns: "Campañas NCC",
    tab_create: "Crear campaña",
    missing_campaign_title: "Campaña no especificada",
    missing_campaign_text: 'Accede con el parámetro <code>?campaign=id</code> en la URL. Contacta al administrador para obtener tu enlace.',
    search_placeholder: "Buscar por nombre, ID, teléfono, workflow…",
    filter_all: "Todos los campos",
    filter_name: "Nombre",
    filter_phone: "Teléfono",
    export_csv: "⬇ Exportar CSV",
    refresh: "↺ Actualizar",
    table_name: "Nombre",
    table_phones: "Teléfonos",
    table_actions: "Acciones",
    loading: "Cargando…",
    loading_campaigns: "Cargando campañas de NCC…",
    no_results: "Sin resultados.",
    create_single_title: "Crear campaña individual",
    campaign_name_label: "Nombre de la campaña",
    campaign_name_placeholder: "Ej: SMS Outreach Q3",
    caller_id_label: "Caller ID (número de salida)",
    loading_numbers: "— Cargando números… —",
    no_numbers: "— Sin números disponibles —",
    select_number: "— Selecciona un número —",
    caller_id_hint: "Números sin asignar en NCC",
    loading_workflows: "— Cargando workflows… —",
    no_workflows: "— Sin workflows —",
    select_workflow: "— Selecciona un workflow —",
    fixed_true: "✓ true (fijo)",
    create_campaign: "Crear campaña",
    creating: "Creando…",
    bulk_title: "Carga masiva desde Excel",
    file_format_title: "Formato del archivo (.xlsx / .xls / .csv)",
    file_format_text: "3 columnas: <code>name</code> &nbsp;|&nbsp; <code>callerId</code> &nbsp;|&nbsp; <code>workflowId</code>",
    dropzone_text: "Haz clic o arrastra tu archivo aquí",
    dropzone_sub: "Formatos: .xlsx, .xls, .csv",
    processing: "Procesando…",
    upload_result: "Resultado del cargue",
    bulk_ok_zero: "✓ 0 exitosos",
    bulk_err_zero: "✗ 0 errores",
    delete: "Eliminar",
    delete_missing_id: "No se encontró el ID de la campaña.",
    delete_confirm: '¿Eliminar la campaña "{name}"? Esta acción no se puede deshacer.',
    deleted: 'Campaña "{name}" eliminada.',
    export_empty: "No hay campañas para exportar.",
    exported: "CSV exportado.",
    enter_name: "Ingresa el nombre.",
    select_caller_id: "Selecciona un Caller ID.",
    select_workflow_error: "Selecciona un Workflow.",
    created: 'Campaña "{name}" creada.',
    load_error: "Error: {message}",
    numbers_error: "Números: {message}",
    workflows_error: "Workflows: {message}",
    load_failed: "Error al cargar",
    no_campaign_url: "No hay campaña configurada en la URL.",
    read_error: "Error leyendo: {message}",
    empty_file: "El archivo está vacío o sin filas válidas.",
    processing_row: "Procesando {index} de {total}: {name}",
    row_label: "Fila {index}",
    missing_bulk_fields: "Faltan campos: name, callerId o workflowId",
    created_ok: "Creada exitosamente",
    bulk_ok_count: "✓ {count} exitosos",
    bulk_err_count: "✗ {count} errores",
    bulk_complete: "Cargue completo: {ok} ok, {err} errores.",
    file_read_error: "Error leyendo el archivo."
  },
  en: {
    page_title: "NCC — SMS Campaign Management",
    tab_campaigns: "NCC Campaigns",
    tab_create: "Create campaign",
    missing_campaign_title: "Campaign not specified",
    missing_campaign_text: 'Open this page with the <code>?campaign=id</code> URL parameter. Contact your administrator for your link.',
    search_placeholder: "Search by name, ID, phone, workflow…",
    filter_all: "All fields",
    filter_name: "Name",
    filter_phone: "Phone",
    export_csv: "⬇ Export CSV",
    refresh: "↺ Refresh",
    table_name: "Name",
    table_phones: "Phones",
    table_actions: "Actions",
    loading: "Loading…",
    loading_campaigns: "Loading NCC campaigns…",
    no_results: "No results.",
    create_single_title: "Create individual campaign",
    campaign_name_label: "Campaign name",
    campaign_name_placeholder: "Example: SMS Outreach Q3",
    caller_id_label: "Caller ID (outbound number)",
    loading_numbers: "— Loading numbers… —",
    no_numbers: "— No numbers available —",
    select_number: "— Select a number —",
    caller_id_hint: "Unassigned numbers in NCC",
    loading_workflows: "— Loading workflows… —",
    no_workflows: "— No workflows —",
    select_workflow: "— Select a workflow —",
    fixed_true: "✓ true (fixed)",
    create_campaign: "Create campaign",
    creating: "Creating…",
    bulk_title: "Bulk upload from Excel",
    file_format_title: "File format (.xlsx / .xls / .csv)",
    file_format_text: "3 columns: <code>name</code> &nbsp;|&nbsp; <code>callerId</code> &nbsp;|&nbsp; <code>workflowId</code>",
    dropzone_text: "Click or drag your file here",
    dropzone_sub: "Formats: .xlsx, .xls, .csv",
    processing: "Processing…",
    upload_result: "Upload result",
    bulk_ok_zero: "✓ 0 successful",
    bulk_err_zero: "✗ 0 errors",
    delete: "Delete",
    delete_missing_id: "Campaign ID was not found.",
    delete_confirm: 'Delete campaign "{name}"? This action cannot be undone.',
    deleted: 'Campaign "{name}" deleted.',
    export_empty: "There are no campaigns to export.",
    exported: "CSV exported.",
    enter_name: "Enter the campaign name.",
    select_caller_id: "Select a Caller ID.",
    select_workflow_error: "Select a workflow.",
    created: 'Campaign "{name}" created.',
    load_error: "Error: {message}",
    numbers_error: "Numbers: {message}",
    workflows_error: "Workflows: {message}",
    load_failed: "Failed to load",
    no_campaign_url: "No campaign is configured in the URL.",
    read_error: "Read error: {message}",
    empty_file: "The file is empty or has no valid rows.",
    processing_row: "Processing {index} of {total}: {name}",
    row_label: "Row {index}",
    missing_bulk_fields: "Missing fields: name, callerId, or workflowId",
    created_ok: "Created successfully",
    bulk_ok_count: "✓ {count} successful",
    bulk_err_count: "✗ {count} errors",
    bulk_complete: "Upload complete: {ok} ok, {err} errors.",
    file_read_error: "Error reading the file."
  }
};

const selectedCampaignId = new URLSearchParams(window.location.search).get("campaign") || "";
const pathParts = window.location.pathname.split("/").filter(Boolean);
const functionBasePath = pathParts.length > 1 ? `/${pathParts[0]}` : "";

function apiPath(path) {
  const fullPath = `${functionBasePath}${path}`;
  return selectedCampaignId ? `${fullPath}?campaign=${encodeURIComponent(selectedCampaignId)}` : fullPath;
}

function asList(data, ...keys) {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function translate(key, vars = {}) {
  const dictionary = I18N[widgetLanguage] || I18N.es;
  const template = dictionary[key] || I18N.es[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
}

function applyTranslations() {
  document.documentElement.lang = widgetLanguage;
  document.title = translate("page_title");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = translate(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = translate(el.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = translate(el.dataset.i18nPlaceholder);
  });
}

function setLanguage(value) {
  const normalized = String(value || "").toLowerCase();
  widgetLanguage = normalized.startsWith("en") ? "en" : "es";
  applyTranslations();
}

async function loadCampaignSettings() {
  if (!selectedCampaignId) return;
  try {
    const data = await apiGet(apiPath("/api/config"));
    setLanguage(data?.campaign?.ui?.shared?.language || "es");
  } catch {
    applyTranslations();
  }
}

// ── API ───────────────────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiDelete(path) {
  const res = await fetch(path, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Tabs ──────────────────────────────────────────────────────────────────
document.querySelectorAll(".tc-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tc-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tc-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
  });
});

// ── Init de campaña ───────────────────────────────────────────────────────
async function initCampaign() {
  const badge = document.getElementById("campaignBadge");
  const noCampaign = document.getElementById("noCampaignMsg");
  const main = document.getElementById("mainContent");

  if (!selectedCampaignId) {
    applyTranslations();
    noCampaign.style.display = "";
    main.style.display = "none";
    return;
  }

  await loadCampaignSettings();
  badge.textContent = selectedCampaignId;
  noCampaign.style.display = "none";
  main.style.display = "";
  loadThrioCampaigns();
  loadPhoneNumbers();
  loadWorkflows();
}

// ── Campañas NCC ──────────────────────────────────────────────────────────
async function loadThrioCampaigns() {
  const tbody = document.getElementById("campaignTableBody");
  tbody.innerHTML = `<tr><td colspan="5" class="tc-loading">${translate("loading_campaigns")}</td></tr>`;
  try {
    const data = await apiGet(apiPath("/api/thrio-data/campaigns"));
    allCampaigns = asList(data, "objects", "data", "items", "campaigns");
    applyFilter();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="tc-empty">${escHtml(translate("load_error", { message: e.message }))}</td></tr>`;
    showToast(e.message, true);
  }
}

function applyFilter() {
  const q = document.getElementById("campaignSearch").value.toLowerCase().trim();
  const field = document.getElementById("filterField").value;

  filteredCampaigns = allCampaigns.filter((c) => {
    if (!q) return true;
    const id = String(c._id || c.campaignId || c.id || "").toLowerCase();
    const name = String(c.name || "").toLowerCase();
    const wf = String(c.workflowId || "").toLowerCase();
    const phones = (c.addresses || []).join(" ").toLowerCase();
    if (field === "name")       return name.includes(q);
    if (field === "id")         return id.includes(q);
    if (field === "workflowId") return wf.includes(q);
    if (field === "addresses")  return phones.includes(q);
    return name.includes(q) || id.includes(q) || wf.includes(q) || phones.includes(q);
  });

  sortCampaigns();
  renderCampaignTable();
}

function sortCampaigns() {
  filteredCampaigns.sort((a, b) => {
    let va = "", vb = "";
    if (sortCol === "name")           { va = (a.name || "").toLowerCase(); vb = (b.name || "").toLowerCase(); }
    else if (sortCol === "id")        { va = a._id || a.campaignId || ""; vb = b._id || b.campaignId || ""; }
    else if (sortCol === "workflowId"){ va = a.workflowId || ""; vb = b.workflowId || ""; }
    return va < vb ? -sortDir : va > vb ? sortDir : 0;
  });
}

function renderCampaignTable() {
  const tbody = document.getElementById("campaignTableBody");
  document.getElementById("campaignCount").textContent = `${filteredCampaigns.length} / ${allCampaigns.length}`;

  document.querySelectorAll(".tc-table th[data-col]").forEach((th) => {
    th.classList.toggle("sorted", th.dataset.col === sortCol);
    const icon = th.querySelector(".sort-icon");
    if (icon) icon.textContent = th.dataset.col === sortCol ? (sortDir === 1 ? "↑" : "↓") : "↕";
  });

  if (!filteredCampaigns.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="tc-empty">${translate("no_results")}</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredCampaigns.map((c, index) => {
    const rawId = c._id || c.campaignId || c.id || "";
    const id = escHtml(rawId || "—");
    const name = escHtml(c.name || "—");
    const wf = escHtml(c.workflowId || "—");
    const phones = (c.addresses || []).map((p) => `<span class="phone-chip">${escHtml(p)}</span>`).join("") || "—";
    return `<tr>
      <td>${name}</td>
      <td class="mono">${id}</td>
      <td>${phones}</td>
      <td class="mono">${wf}</td>
      <td><button class="tc-btn tc-btn-danger" data-delete-index="${index}">${translate("delete")}</button></td>
    </tr>`;
  }).join("");
}

async function deleteCampaignByIndex(index) {
  const campaign = filteredCampaigns[index];
  if (!campaign) return;
  const id = campaign._id || campaign.campaignId || campaign.id || "";
  const name = campaign.name || id;
  if (!id) { showToast(translate("delete_missing_id"), true); return; }
  if (!confirm(translate("delete_confirm", { name }))) return;

  try {
    await apiDelete(apiPath(`/api/thrio-data/campaigns/${encodeURIComponent(id)}`));
    showToast(translate("deleted", { name }));
    await loadThrioCampaigns();
    await loadPhoneNumbers();
  } catch (e) {
    showToast(e.message, true);
  }
}

document.getElementById("campaignTableBody").addEventListener("click", (e) => {
  const button = e.target.closest("[data-delete-index]");
  if (!button) return;
  deleteCampaignByIndex(Number(button.dataset.deleteIndex));
});

document.querySelector(".tc-table thead").addEventListener("click", (e) => {
  const th = e.target.closest("th[data-col]");
  if (!th || !["name", "id", "workflowId"].includes(th.dataset.col)) return;
  if (sortCol === th.dataset.col) { sortDir *= -1; } else { sortCol = th.dataset.col; sortDir = 1; }
  sortCampaigns();
  renderCampaignTable();
});

let searchDebounce;
document.getElementById("campaignSearch").addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(applyFilter, 180);
});
document.getElementById("filterField").addEventListener("change", applyFilter);

// ── Exportar CSV ──────────────────────────────────────────────────────────
function exportCampaigns() {
  if (!filteredCampaigns.length) { showToast(translate("export_empty"), true); return; }
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = filteredCampaigns.map((c) => [
    esc(c.name || ""), esc(c._id || c.campaignId || c.id || ""),
    esc((c.addresses || []).join("; ")), esc(c.workflowId || "")
  ].join(","));
  const csv = ["name,campaignId,addresses,workflowId", ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `ncc-campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast(translate("exported"));
}

// ── Selects de creación ───────────────────────────────────────────────────
async function loadPhoneNumbers() {
  const sel = document.getElementById("newCallerId");
  sel.innerHTML = `<option value="">${translate("loading")}</option>`;
  try {
    const data = await apiGet(apiPath("/api/thrio-data/pstnnumbers"));
    const numbers = asList(data, "objects", "data", "items");
    if (!numbers.length) { sel.innerHTML = `<option value="">${translate("no_numbers")}</option>`; return; }
    sel.innerHTML = `<option value="">${translate("select_number")}</option>` +
      numbers.map((n) => {
        const val = n.number || n.address || n.pstnnumberId || n._id || String(n);
        const label = n.name || n.number || n.address || val;
        return `<option value="${escHtml(val)}">${escHtml(label)}</option>`;
      }).join("");
  } catch (e) {
    sel.innerHTML = `<option value="">${translate("load_failed")}</option>`;
    showToast(translate("numbers_error", { message: e.message }), true);
  }
}

async function loadWorkflows() {
  const sel = document.getElementById("newWorkflowId");
  sel.innerHTML = `<option value="">${translate("loading")}</option>`;
  try {
    const data = await apiGet(apiPath("/api/thrio-data/workflows"));
    const workflows = asList(data, "objects", "data", "items");
    if (!workflows.length) { sel.innerHTML = `<option value="">${translate("no_workflows")}</option>`; return; }
    sel.innerHTML = `<option value="">${translate("select_workflow")}</option>` +
      workflows.map((w) => {
        const id = w._id || w.workflowId || w.id || "";
        const label = w.name || id;
        return `<option value="${escHtml(id)}">${escHtml(label)}${label !== id ? ` — ${escHtml(id)}` : ""}</option>`;
      }).join("");
  } catch (e) {
    sel.innerHTML = `<option value="">${translate("load_failed")}</option>`;
    showToast(translate("workflows_error", { message: e.message }), true);
  }
}

// ── Crear individual ──────────────────────────────────────────────────────
async function createSingleCampaign() {
  const name = document.getElementById("newName").value.trim();
  const callerId = document.getElementById("newCallerId").value;
  const workflowId = document.getElementById("newWorkflowId").value;

  if (!name)       { showToast(translate("enter_name"), true); return; }
  if (!callerId)   { showToast(translate("select_caller_id"), true); return; }
  if (!workflowId) { showToast(translate("select_workflow_error"), true); return; }

  const btn = document.getElementById("createBtn");
  btn.disabled = true; btn.textContent = translate("creating");
  try {
    await apiPost(apiPath("/api/thrio-data/campaigns"), { name, callerId, workflowId });
    showToast(translate("created", { name }));
    document.getElementById("newName").value = "";
    document.getElementById("newCallerId").value = "";
    document.getElementById("newWorkflowId").value = "";
    loadPhoneNumbers();
  } catch (e) {
    showToast(e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = translate("create_campaign");
  }
}

// ── Bulk upload ───────────────────────────────────────────────────────────
const dropzone = document.getElementById("dropzone");
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault(); dropzone.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) handleBulkFile(e.dataTransfer.files[0]);
});

async function handleBulkFile(file) {
  if (!file) return;
  if (!selectedCampaignId) { showToast(translate("no_campaign_url"), true); return; }
  let rows;
  try { rows = await parseFile(file); }
  catch (e) { showToast(translate("read_error", { message: e.message }), true); return; }
  if (!rows.length) { showToast(translate("empty_file"), true); return; }

  const progress = document.getElementById("bulkProgress");
  const fill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const bulkLog = document.getElementById("bulkLog");
  const bulkLogRows = document.getElementById("bulkLogRows");

  progress.style.display = "block"; bulkLog.style.display = "none";
  bulkLogRows.innerHTML = ""; fill.style.width = "0%";

  const log = []; let ok = 0, err = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row.name || row.Name || row.NOMBRE || row.nombre || "").trim();
    const callerId = String(row.callerId || row.callerid || row.CallerId || row.telefono || row.phone || "").trim();
    const workflowId = String(row.workflowId || row.workflowid || row.WorkflowId || row.workflow || "").trim();
    const rowLabel = translate("row_label", { index: i + 2 });

    fill.style.width = `${Math.round(((i + 1) / rows.length) * 100)}%`;
    progressText.textContent = translate("processing_row", { index: i + 1, total: rows.length, name: name || rowLabel });

    if (!name || !callerId || !workflowId) {
      log.push({ name: name || rowLabel, ok: false, msg: translate("missing_bulk_fields") });
      err++; continue;
    }
    try {
      await apiPost(apiPath("/api/thrio-data/campaigns"), { name, callerId, workflowId });
      log.push({ name, ok: true, msg: translate("created_ok") });
      ok++;
    } catch (e) {
      log.push({ name, ok: false, msg: e.message });
      err++;
    }
  }

  progress.style.display = "none";
  bulkLog.style.display = "block";
  document.getElementById("bulkOkCount").textContent = translate("bulk_ok_count", { count: ok });
  document.getElementById("bulkErrCount").textContent = translate("bulk_err_count", { count: err });
  bulkLogRows.innerHTML = log.map((item) => `
    <div class="tc-log-row ${item.ok ? "ok" : "err"}">
      <div class="tc-log-icon">${item.ok ? "✅" : "❌"}</div>
      <div class="tc-log-name">${escHtml(item.name)}</div>
      <div class="tc-log-msg">${escHtml(item.msg)}</div>
    </div>`).join("");

  showToast(translate("bulk_complete", { ok, err }), err > 0 && ok === 0);
  if (ok > 0) loadPhoneNumbers();
  document.getElementById("bulkFileInput").value = "";
}

function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    reader.onload = (e) => {
      try {
        if (isCsv) { resolve(parseCsv(e.target.result)); return; }
        const wb = XLSX.read(e.target.result, { type: "array" });
        resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" }));
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error(translate("file_read_error")));
    if (isCsv) reader.readAsText(file, "utf-8"); else reader.readAsArrayBuffer(file);
  });
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1)
    .map((line) => {
      const vals = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
      const row = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ""; });
      return row;
    })
    .filter((r) => Object.values(r).some(Boolean));
}

// ── Helpers ───────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

let toastTimer;
function showToast(msg, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `tc-toast${isError ? " error" : ""} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3800);
}

// ── Init ──────────────────────────────────────────────────────────────────
initCampaign();
