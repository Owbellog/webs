"use strict";

// ── Estado ────────────────────────────────────────────────────────────────
let allCampaigns = [];
let filteredCampaigns = [];
let sortCol = "name";
let sortDir = 1;

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
function initCampaign() {
  const badge = document.getElementById("campaignBadge");
  const noCampaign = document.getElementById("noCampaignMsg");
  const main = document.getElementById("mainContent");

  if (!selectedCampaignId) {
    noCampaign.style.display = "";
    main.style.display = "none";
    return;
  }

  badge.textContent = selectedCampaignId;
  noCampaign.style.display = "none";
  main.style.display = "";
  loadThrioCampaigns();
  loadPhoneNumbers();
  loadWorkflows();
}

// ── Campañas Thrio ────────────────────────────────────────────────────────
async function loadThrioCampaigns() {
  const tbody = document.getElementById("campaignTableBody");
  tbody.innerHTML = `<tr><td colspan="5" class="tc-loading">Cargando campañas de Thrio…</td></tr>`;
  try {
    const data = await apiGet(apiPath("/api/thrio-data/campaigns"));
    allCampaigns = asList(data, "objects", "data", "items", "campaigns");
    applyFilter();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" class="tc-empty">Error: ${escHtml(e.message)}</td></tr>`;
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
  document.getElementById("campaignCount").textContent = `${filteredCampaigns.length} de ${allCampaigns.length}`;

  document.querySelectorAll(".tc-table th[data-col]").forEach((th) => {
    th.classList.toggle("sorted", th.dataset.col === sortCol);
    const icon = th.querySelector(".sort-icon");
    if (icon) icon.textContent = th.dataset.col === sortCol ? (sortDir === 1 ? "↑" : "↓") : "↕";
  });

  if (!filteredCampaigns.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="tc-empty">Sin resultados.</td></tr>`;
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
      <td><button class="tc-btn tc-btn-danger" data-delete-index="${index}">Eliminar</button></td>
    </tr>`;
  }).join("");
}

async function deleteCampaignByIndex(index) {
  const campaign = filteredCampaigns[index];
  if (!campaign) return;
  const id = campaign._id || campaign.campaignId || campaign.id || "";
  const name = campaign.name || id;
  if (!id) { showToast("No se encontró el ID de la campaña.", true); return; }
  if (!confirm(`¿Eliminar la campaña "${name}"? Esta acción no se puede deshacer.`)) return;

  try {
    await apiDelete(apiPath(`/api/thrio-data/campaigns/${encodeURIComponent(id)}`));
    showToast(`Campaña "${name}" eliminada.`);
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
  if (!filteredCampaigns.length) { showToast("No hay campañas para exportar.", true); return; }
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = filteredCampaigns.map((c) => [
    esc(c.name || ""), esc(c._id || c.campaignId || c.id || ""),
    esc((c.addresses || []).join("; ")), esc(c.workflowId || "")
  ].join(","));
  const csv = ["name,campaignId,addresses,workflowId", ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `thrio-campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast("CSV exportado.");
}

// ── Selects de creación ───────────────────────────────────────────────────
async function loadPhoneNumbers() {
  const sel = document.getElementById("newCallerId");
  sel.innerHTML = `<option value="">Cargando…</option>`;
  try {
    const data = await apiGet(apiPath("/api/thrio-data/pstnnumbers"));
    const numbers = asList(data, "objects", "data", "items");
    if (!numbers.length) { sel.innerHTML = `<option value="">— Sin números disponibles —</option>`; return; }
    sel.innerHTML = `<option value="">— Selecciona un número —</option>` +
      numbers.map((n) => {
        const val = n.number || n.address || n.pstnnumberId || n._id || String(n);
        const label = n.name || n.number || n.address || val;
        return `<option value="${escHtml(val)}">${escHtml(label)}</option>`;
      }).join("");
  } catch (e) {
    sel.innerHTML = `<option value="">Error al cargar</option>`;
    showToast(`Números: ${e.message}`, true);
  }
}

async function loadWorkflows() {
  const sel = document.getElementById("newWorkflowId");
  sel.innerHTML = `<option value="">Cargando…</option>`;
  try {
    const data = await apiGet(apiPath("/api/thrio-data/workflows"));
    const workflows = asList(data, "objects", "data", "items");
    if (!workflows.length) { sel.innerHTML = `<option value="">— Sin workflows —</option>`; return; }
    sel.innerHTML = `<option value="">— Selecciona un workflow —</option>` +
      workflows.map((w) => {
        const id = w._id || w.workflowId || w.id || "";
        const label = w.name || id;
        return `<option value="${escHtml(id)}">${escHtml(label)}${label !== id ? ` — ${escHtml(id)}` : ""}</option>`;
      }).join("");
  } catch (e) {
    sel.innerHTML = `<option value="">Error al cargar</option>`;
    showToast(`Workflows: ${e.message}`, true);
  }
}

// ── Crear individual ──────────────────────────────────────────────────────
async function createSingleCampaign() {
  const name = document.getElementById("newName").value.trim();
  const callerId = document.getElementById("newCallerId").value;
  const workflowId = document.getElementById("newWorkflowId").value;

  if (!name)       { showToast("Ingresa el nombre.", true); return; }
  if (!callerId)   { showToast("Selecciona un Caller ID.", true); return; }
  if (!workflowId) { showToast("Selecciona un Workflow.", true); return; }

  const btn = document.getElementById("createBtn");
  btn.disabled = true; btn.textContent = "Creando…";
  try {
    await apiPost(apiPath("/api/thrio-data/campaigns"), { name, callerId, workflowId });
    showToast(`Campaña "${name}" creada.`);
    document.getElementById("newName").value = "";
    document.getElementById("newCallerId").value = "";
    document.getElementById("newWorkflowId").value = "";
    loadPhoneNumbers();
  } catch (e) {
    showToast(e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = "Crear campaña";
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
  if (!selectedCampaignId) { showToast("No hay campaña configurada en la URL.", true); return; }
  let rows;
  try { rows = await parseFile(file); }
  catch (e) { showToast(`Error leyendo: ${e.message}`, true); return; }
  if (!rows.length) { showToast("El archivo está vacío o sin filas válidas.", true); return; }

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

    fill.style.width = `${Math.round(((i + 1) / rows.length) * 100)}%`;
    progressText.textContent = `Procesando ${i + 1} de ${rows.length}: ${name || `Fila ${i + 2}`}`;

    if (!name || !callerId || !workflowId) {
      log.push({ name: name || `Fila ${i + 2}`, ok: false, msg: "Faltan campos: name, callerId o workflowId" });
      err++; continue;
    }
    try {
      await apiPost(apiPath("/api/thrio-data/campaigns"), { name, callerId, workflowId });
      log.push({ name, ok: true, msg: "Creada exitosamente" });
      ok++;
    } catch (e) {
      log.push({ name, ok: false, msg: e.message });
      err++;
    }
  }

  progress.style.display = "none";
  bulkLog.style.display = "block";
  document.getElementById("bulkOkCount").textContent = `✓ ${ok} exitosos`;
  document.getElementById("bulkErrCount").textContent = `✗ ${err} errores`;
  bulkLogRows.innerHTML = log.map((item) => `
    <div class="tc-log-row ${item.ok ? "ok" : "err"}">
      <div class="tc-log-icon">${item.ok ? "✅" : "❌"}</div>
      <div class="tc-log-name">${escHtml(item.name)}</div>
      <div class="tc-log-msg">${escHtml(item.msg)}</div>
    </div>`).join("");

  showToast(`Cargue completo: ${ok} ok, ${err} errores.`, err > 0 && ok === 0);
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
    reader.onerror = () => reject(new Error("Error leyendo el archivo."));
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
