// ── Constants ─────────────────────────────────────────────────────────────────
const INELIGIBLE_PRIORITY = 9999;

// ── Campaign param ────────────────────────────────────────────────────────────
const appBase = new URL(".", window.location.href);
const campaignId = new URLSearchParams(window.location.search).get("campaign") || "";

function buildUrl(pathname) {
  const p = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return new URL(p, appBase).toString();
}

function withCampaign(path) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}campaign=${encodeURIComponent(campaignId)}`;
}

// ── API ───────────────────────────────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(buildUrl(withCampaign(path)), {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const detailSource = data.details ?? data.raw ?? "";
    const detail = detailSource ? ` — ${typeof detailSource === "string" ? detailSource : JSON.stringify(detailSource)}` : "";
    throw new Error(`[${res.status}] ${data.error || "Request failed."}${detail}`);
  }
  return data;
}

function apiPost(path, body) {
  return api(path, { method: "POST", body: JSON.stringify(body) });
}

function apiPatch(path, body) {
  return api(path, { method: "PATCH", body: JSON.stringify(body) });
}

function apiDelete(path) {
  return api(path, { method: "DELETE" });
}

// ── Campaign status cache ─────────────────────────────────────────────────────
let campaignStatusCache = null;
async function getCampaignStatus() {
  if (campaignStatusCache) return campaignStatusCache;
  campaignStatusCache = await api("/api/wieland/campaign/status");
  return campaignStatusCache;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
const toast = document.getElementById("wToast");
let toastTimer;

function showToast(msg, type = "") {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `w-toast visible${type ? " " + type : ""}`;
  toastTimer = setTimeout(() => { toast.className = "w-toast"; }, 3200);
}

// ── State ─────────────────────────────────────────────────────────────────────
let allContacts = [];
let allLists = [];
let currentFilter = "all";
let contactSearchValue = "";
let currentContactToListMap = {};
let currentWidgetToContactMap = {};
let visibleTabs = { contacts: true, lists: true, campaign: true, mapping: true };
let loaded = { contacts: false, lists: false, campaign: false, mapping: false };

// ── Init check ────────────────────────────────────────────────────────────────
function normalizeVisibleTabs(config = {}) {
  return {
    contacts: config.contacts !== false,
    lists: config.lists !== false,
    campaign: config.campaign !== false,
    mapping: config.mapping !== false
  };
}

async function loadCampaignUiConfig() {
  try {
    const data = await api("/api/config");
    visibleTabs = normalizeVisibleTabs(data?.campaign?.wieland?.visibleTabs || {});
  } catch (err) {
    console.warn("Unable to load Wieland UI config:", err);
    visibleTabs = normalizeVisibleTabs();
  }
}

function applyTabVisibility() {
  const order = ["contacts", "lists", "campaign", "mapping"];
  tabs.forEach(tab => {
    tab.hidden = visibleTabs[tab.dataset.tab] === false;
    tab.classList.remove("active");
  });
  panels.forEach(panel => panel.classList.remove("active"));

  const firstVisible = order.find(name => visibleTabs[name] !== false);
  if (!firstVisible) {
    document.getElementById("mainBody").hidden = true;
    const el = document.getElementById("initMessage");
    el.textContent = "No Wieland tabs are enabled for this campaign.";
    el.hidden = false;
    return null;
  }
  return firstVisible;
}

function loadTabData(name) {
  if (loaded[name]) return;
  loaded[name] = true;
  if (name === "contacts") loadContacts();
  if (name === "lists") loadLists();
  if (name === "campaign") loadCampaignStatus();
  if (name === "mapping") loadFieldMapping();
}

function activateTab(name) {
  if (visibleTabs[name] === false) return;
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  panels.forEach(p => p.classList.toggle("active", p.id === `panel-${name}`));
  loadTabData(name);
}

async function initCheck() {
  if (!campaignId) {
    const el = document.getElementById("initMessage");
    el.textContent = "Missing ?campaign= parameter. Access this page from the Admin panel.";
    el.hidden = false;
    return false;
  }
  document.getElementById("campaignLabel").textContent = `— ${campaignId}`;
  await loadCampaignUiConfig();
  document.getElementById("initMessage").hidden = true;
  document.getElementById("mainBody").hidden = false;
  loadContactFieldHints();
  const firstVisible = applyTabVisibility();
  if (firstVisible) activateTab(firstVisible);
  return true;
}

// ── Tab navigation ────────────────────────────────────────────────────────────
const tabs = document.querySelectorAll(".w-tab");
const panels = document.querySelectorAll(".w-panel");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    activateTab(tab.dataset.tab);
  });
});

// ── Priority chip ─────────────────────────────────────────────────────────────
function priorityChip(p, total) {
  if (p >= INELIGIBLE_PRIORITY) return `<span class="w-priority low">—</span>`;
  // Higher number = higher priority; color by relative position
  const pct = total > 0 ? p / total : 0;
  const cls = pct > 0.66 ? "top" : pct > 0.33 ? "mid" : "low";
  return `<span class="w-priority ${cls}">${p}</span>`;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function statusBadge(status) {
  const map = { Active: "active", LOA: "loa", Terminated: "terminated" };
  return `<span class="w-badge ${map[status] || "loa"}">${status || "Unknown"}</span>`;
}

function getContactKey(contact) {
  return contact?.externalId || contact?.id || contact?._id || contact?.contactId || "";
}

// ── Contacts ──────────────────────────────────────────────────────────────────
function filteredContacts() {
  let list = allContacts;
  const q = contactSearchValue.toLowerCase();
  if (q) {
    list = list.filter(c =>
      (c.firstName || "").toLowerCase().includes(q) ||
      (c.lastName || "").toLowerCase().includes(q) ||
      (c.externalId || "").toLowerCase().includes(q) ||
      (c.shift_type || "").toLowerCase().includes(q) ||
      (c.trade || "").toLowerCase().includes(q) ||
      (c.plant_location || "").toLowerCase().includes(q)
    );
  }
  if (currentFilter === "union") list = list.filter(c => c.union_eligible);
  else if (currentFilter === "active") list = list.filter(c => c.active_status === "Active");
  else if (currentFilter === "dnc") list = list.filter(c => c.do_not_call);
  else if (currentFilter === "eligible") list = list.filter(c => c.call_priority < INELIGIBLE_PRIORITY);
  return list;
}

function updateStats() {
  const total = allContacts.length;
  const union = allContacts.filter(c => c.union_eligible).length;
  const active = allContacts.filter(c => c.active_status === "Active").length;
  const dnc = allContacts.filter(c => c.do_not_call).length;
  const eligible = allContacts.filter(c => c.call_priority < INELIGIBLE_PRIORITY).length;
  document.getElementById("statTotal").textContent = total;
  document.getElementById("statUnion").textContent = union;
  document.getElementById("statActive").textContent = active;
  document.getElementById("statDNC").textContent = dnc;
  document.getElementById("statEligible").textContent = eligible;
}

function renderContactsTable() {
  const wrap = document.getElementById("contactsTable");
  const list = filteredContacts();

  if (!list.length) {
    wrap.innerHTML = `<div class="w-empty"><div class="w-empty-icon">👥</div>No contacts found.</div>`;
    wrap.hidden = false;
    return;
  }

  const rows = list.map(c => {
    const name = `${c.firstName || ""} ${c.lastName || ""}`.trim() || "—";
    const unionBadge = c.union_eligible ? `<span class="w-badge union">Union</span>` : "";
    const dncBadge = c.do_not_call ? `<span class="w-badge dnc">DNC</span>` : "";
    const cid = escHtml(getContactKey(c));
    const employeeId = getWidgetValue(c, "externalId") || c.contactId || c._id || "—";
    return `<tr>
      <td>${priorityChip(c.call_priority || INELIGIBLE_PRIORITY, allContacts.length)}</td>
      <td>${escHtml(employeeId)}</td>
      <td><strong>${escHtml(name)}</strong></td>
      <td>${escHtml(c.shift_type || "—")}</td>
      <td>${escHtml(c.trade || "—")}</td>
      <td>${escHtml(c.plant_location || "—")}</td>
      <td>${unionBadge}</td>
      <td>${statusBadge(c.active_status)}</td>
      <td>${escHtml(c.phone || "—")}</td>
      <td>${dncBadge}</td>
      <td>${escHtml(c.seniority_years != null ? c.seniority_years + "y" : "—")}</td>
      <td>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="w-btn w-btn-secondary w-btn-sm" data-action="edit-contact" data-id="${cid}">Edit</button>
          <button class="w-btn ${c.active_status === "Active" ? "w-btn-danger" : "w-btn-secondary"} w-btn-sm" data-action="toggle-contact" data-id="${cid}">${c.active_status === "Active" ? "Deactivate" : "Activate"}</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  wrap.innerHTML = `<table class="w-table">
    <thead><tr>
      <th>Priority</th><th>Employee ID</th><th>Name</th><th>Shift</th><th>Trade</th><th>Plant</th>
      <th>Union</th><th>Status</th><th>Phone</th><th>DNC</th><th>Seniority</th><th></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  wrap.hidden = false;
}

async function loadContacts() {
  document.getElementById("contactsLoading").style.display = "";
  document.getElementById("contactsTable").hidden = true;
  try {
    const data = await api("/api/wieland/contacts");
    allContacts = data.contacts || [];
    updateStats();
    renderContactsTable();
  } catch (err) {
    document.getElementById("contactsLoading").textContent = `Error: ${err.message}`;
    return;
  }
  document.getElementById("contactsLoading").style.display = "none";
}

// Event delegation — contacts table
document.getElementById("contactsWrap").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === "edit-contact") openEditContact(id);
  if (action === "toggle-contact") toggleContactActive(id);
});

// Search with debounce
let searchDebounce;
document.getElementById("contactSearch").addEventListener("input", (e) => {
  clearTimeout(searchDebounce);
  contactSearchValue = e.target.value;
  searchDebounce = setTimeout(renderContactsTable, 200);
});

document.querySelectorAll(".w-filter-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".w-filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    renderContactsTable();
  });
});

// ── Contact modal ─────────────────────────────────────────────────────────────
const contactModal = document.getElementById("contactModal");
const contactModalAlert = document.getElementById("contactModalAlert");

document.getElementById("newContactBtn").addEventListener("click", () => openNewContact());
document.getElementById("contactModalCancel").addEventListener("click", () => contactModal.classList.add("hidden"));
document.getElementById("contactModalSave").addEventListener("click", saveContact);

function openNewContact() {
  clearModalAlert(contactModalAlert);
  document.getElementById("contactModalTitle").textContent = "New Contact";
  document.getElementById("mContactId").value = "";
  clearContactForm();
  contactModal.classList.remove("hidden");
}

function openEditContact(externalId) {
  const c = allContacts.find(x => getContactKey(x) === externalId);
  if (!c) return;
  clearModalAlert(contactModalAlert);
  document.getElementById("contactModalTitle").textContent = "Edit Contact";
  document.getElementById("mContactId").value = externalId;
  document.getElementById("mFirstName").value = c.firstName || "";
  document.getElementById("mLastName").value = c.lastName || "";
  document.getElementById("mPhone").value = c.phone || "";
  document.getElementById("mMobile").value = c.mobile || "";
  document.getElementById("mExternalId").value = getWidgetValue(c, "externalId");
  document.getElementById("mTrade").value = c.trade || "";
  document.getElementById("mShift").value = c.shift_type || "";
  document.getElementById("mPlant").value = c.plant_location || "";
  document.getElementById("mSeniorityStartDate").value = c.seniority_start_date || "";
  document.getElementById("mStatus").value = c.active_status || "Active";
  document.getElementById("mUnion").checked = Boolean(c.union_eligible);
  document.getElementById("mDNC").checked = Boolean(c.do_not_call);
  contactModal.classList.remove("hidden");
}

async function toggleContactActive(externalId) {
  const c = allContacts.find(x => getContactKey(x) === externalId);
  if (!c) return;
  const nextStatus = c.active_status === "Active" ? "Terminated" : "Active";
  try {
    await apiPatch(`/api/wieland/contacts/${encodeURIComponent(externalId)}`, {
      active_status: nextStatus
    });
    showToast(`Contact ${nextStatus === "Active" ? "activated" : "deactivated"}.`);
    await loadContacts();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function clearContactForm() {
  ["mFirstName","mLastName","mPhone","mMobile","mExternalId","mTrade","mShift","mPlant","mSeniorityStartDate"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("mStatus").value = "Active";
  document.getElementById("mUnion").checked = false;
  document.getElementById("mDNC").checked = false;
}

async function saveContact() {
  const btn = document.getElementById("contactModalSave");
  const id = document.getElementById("mContactId").value.trim();
  const externalId = document.getElementById("mExternalId").value.trim();
  const firstName = document.getElementById("mFirstName").value.trim();
  const lastName = document.getElementById("mLastName").value.trim();

  // Send only semantic fields — server maps to NCC field names
  const payload = {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    phone: document.getElementById("mPhone").value.trim(),
    mobile: document.getElementById("mMobile").value.trim(),
    externalId,
    union_eligible: document.getElementById("mUnion").checked,
    active_status: document.getElementById("mStatus").value,
    do_not_call: document.getElementById("mDNC").checked,
    seniority_start_date: document.getElementById("mSeniorityStartDate").value || "",
    seniority_years: yearsFromDate(document.getElementById("mSeniorityStartDate").value) || 0,
    plant_location: document.getElementById("mPlant").value.trim(),
    trade: document.getElementById("mTrade").value.trim(),
    shift_type: document.getElementById("mShift").value.trim()
  };

  if (!payload.firstName || !payload.lastName) {
    showModalAlert(contactModalAlert, "First name and last name are required.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Saving…";
  clearModalAlert(contactModalAlert);

  try {
    if (id) {
      await apiPatch(`/api/wieland/contacts/${id}`, payload);
    } else {
      await apiPost("/api/wieland/contacts", payload);
    }
    contactModal.classList.add("hidden");
    showToast(id ? "Contact updated." : "Contact created.");
    await loadContacts();
  } catch (err) {
    showModalAlert(contactModalAlert, err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Save contact";
  }
}

// ── Lists ─────────────────────────────────────────────────────────────────────
async function loadLists() {
  document.getElementById("listsLoading").style.display = "";
  document.getElementById("listsContainer").innerHTML = "";
  try {
    const data = await api("/api/wieland/lists");
    allLists = data.lists || [];
    renderLists();
  } catch (err) {
    document.getElementById("listsLoading").textContent = `Error: ${err.message}`;
    return;
  }
  document.getElementById("listsLoading").style.display = "none";
}

function renderLists() {
  const container = document.getElementById("listsContainer");
  if (!allLists.length) {
    container.innerHTML = `<div class="w-empty"><div class="w-empty-icon">📋</div>No outbound lists yet. Create one to get started.</div>`;
    return;
  }
  container.innerHTML = allLists.map(list => {
    const listId = list.id || list._id || "";
    const name = list.name || list.localizations?.name?.en?.value || listId;
    const status = list.status || list.state || "";
    const isActive = Boolean(list.active);
    const uploadStatus = list.uploadStatus || {};
    const uploadBlock = renderUploadStatus(uploadStatus);
    return `<div class="w-list-card" id="list-${escHtml(listId)}">
      <div class="w-list-header" data-action="toggle-list" data-list-id="${escHtml(listId)}">
        <span class="w-list-name">${escHtml(name)}</span>
        <span class="w-list-meta">${isActive ? "Active" : "Inactive"}</span>
        ${status ? `<span class="w-list-meta">${escHtml(status)}</span>` : ""}
        <span class="w-list-chevron">▼</span>
      </div>
      <div class="w-list-body">
        ${uploadBlock}
        <div class="w-list-toolbar">
          <button class="w-btn w-btn-secondary w-btn-sm" data-action="toggle-list-active" data-list-id="${escHtml(listId)}" data-active="${isActive}">${isActive ? "Deactivate list" : "Activate list"}</button>
          <button class="w-btn w-btn-secondary w-btn-sm" data-action="assign-contacts" data-list-id="${escHtml(listId)}">Assign contacts</button>
          <button class="w-btn w-btn-secondary w-btn-sm" data-action="refresh-priority" data-list-id="${escHtml(listId)}">Update list</button>
          <button class="w-btn w-btn-secondary w-btn-sm" data-action="load-leads" data-list-id="${escHtml(listId)}">Refresh leads</button>
          <button class="w-btn w-btn-secondary w-btn-sm" data-action="view-upload-log" data-list-id="${escHtml(listId)}">View upload log</button>
          <button class="w-btn w-btn-danger w-btn-sm" data-action="delete-list" data-list-id="${escHtml(listId)}" data-name="${escHtml(name)}">Delete</button>
        </div>
        <div id="leads-${escHtml(listId)}" style="padding:12px 20px;">
          <span style="color:var(--muted);font-size:0.85rem;">Click "Refresh leads" to load.</span>
        </div>
      </div>
    </div>`;
  }).join("");
}

function renderUploadStatus(uploadStatus = {}) {
  const hasAny = Boolean(uploadStatus.status || uploadStatus.duration)
    || ["totalInFile", "totalFailed", "totalDuplicates", "totalInserted", "totalScrubbed"]
      .some((key) => Number(uploadStatus[key] || 0) > 0);
  if (!hasAny) return "";
  const failed = Number(uploadStatus.totalFailed || 0);
  const inserted = Number(uploadStatus.totalInserted || 0);
  const status = uploadStatus.status || "Unknown";
  const color = failed > 0 ? "#991b1b" : inserted > 0 ? "#166534" : "var(--muted)";
  return `<div style="padding:12px 20px;border-bottom:1px solid var(--line-soft);background:#f8fafc;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <strong style="color:var(--brand);font-size:0.9rem;">Upload status</strong>
      <span style="color:${color};font-weight:800;font-size:0.86rem;">${escHtml(status)}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,minmax(90px,1fr));gap:8px;margin-top:10px;font-size:0.82rem;color:var(--muted);">
      <span>In file: <strong>${escHtml(uploadStatus.totalInFile ?? 0)}</strong></span>
      <span>Inserted: <strong>${escHtml(uploadStatus.totalInserted ?? 0)}</strong></span>
      <span>Failed: <strong>${escHtml(uploadStatus.totalFailed ?? 0)}</strong></span>
      <span>Duplicates: <strong>${escHtml(uploadStatus.totalDuplicates ?? 0)}</strong></span>
      <span>Scrubbed: <strong>${escHtml(uploadStatus.totalScrubbed ?? 0)}</strong></span>
    </div>
    ${uploadStatus.duration ? `<div style="margin-top:6px;font-size:0.8rem;color:var(--muted);">Duration: ${escHtml(uploadStatus.duration)}</div>` : ""}
  </div>`;
}

function formatCreateListToast(data) {
  const upload = data.uploadStatus || {};
  if (upload.status || upload.totalInFile !== undefined) {
    return `List created. ${upload.totalInserted || 0}/${upload.totalInFile || data.contactsInCsv || 0} inserted, ${upload.totalFailed || 0} failed.`;
  }
  return `List created with ${data.contactsInCsv || 0} contacts.`;
}

async function loadListLeads(listId) {
  const leadsEl = document.getElementById(`leads-${listId}`);
  leadsEl.innerHTML = `<span style="color:var(--muted);font-size:0.85rem;">Loading…</span>`;
  try {
    const data = await api(`/api/wieland/lists/${encodeURIComponent(listId)}/leads`);
    const leads = data.leads || [];
    if (!leads.length) {
      leadsEl.innerHTML = `<span style="color:var(--muted);font-size:0.85rem;">No leads in this list.</span>`;
      return;
    }
    const rows = leads.map(l => {
      const name = `${l.firstName || ""} ${l.lastName || ""}`.trim();
      const status = l.status || l.outcomeResActionResult || "—";
      const leadId = l.id || l._id || l.resId || "";
      return `<tr>
        <td>${escHtml(l.externalId || leadId || "—")}</td>
        <td>${escHtml(name || "—")}</td>
        <td>${escHtml(l.phone || l.mobile || "—")}</td>
        <td>${escHtml(String(status))}</td>
        <td><button class="w-btn w-btn-danger w-btn-sm" data-action="delete-lead" data-list-id="${escHtml(listId)}" data-lead-id="${escHtml(leadId)}">Remove</button></td>
      </tr>`;
    }).join("");
    leadsEl.innerHTML = `<table class="w-table">
      <thead><tr><th>External ID</th><th>Name</th><th>Phone</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  } catch (err) {
    leadsEl.innerHTML = `<span style="color:#991b1b;font-size:0.85rem;">Error: ${escHtml(err.message)}</span>`;
  }
}

async function loadUploadLog(listId) {
  const leadsEl = document.getElementById(`leads-${listId}`);
  leadsEl.innerHTML = `<span style="color:var(--muted);font-size:0.85rem;">Loading upload log…</span>`;
  try {
    const data = await api(`/api/wieland/lists/${encodeURIComponent(listId)}/upload-log`);
    const log = data.latest;
    if (!log) {
      leadsEl.innerHTML = `<span style="color:var(--muted);font-size:0.85rem;">No upload log found for this list.</span>`;
      return;
    }
    const formatted = JSON.stringify(log, null, 2);
    leadsEl.innerHTML = `<div style="padding:0;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px;">
        <strong style="color:var(--brand);font-size:0.9rem;">Latest upload log</strong>
        <span style="color:var(--muted);font-size:0.8rem;">${escHtml(log.createdAt || "")}</span>
      </div>
      <pre style="white-space:pre-wrap;word-break:break-word;background:#0f172a;color:#e5e7eb;border-radius:10px;padding:12px;font-size:0.78rem;line-height:1.45;max-height:420px;overflow:auto;">${escHtml(formatted)}</pre>
    </div>`;
  } catch (err) {
    leadsEl.innerHTML = `<span style="color:#991b1b;font-size:0.85rem;">Error: ${escHtml(err.message)}</span>`;
  }
}

async function toggleListActive(listId, currentActive, btn) {
  const nextActive = !currentActive;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = nextActive ? "Activating…" : "Deactivating…";
  try {
    const result = await apiPatch(`/api/wieland/lists/${encodeURIComponent(listId)}`, { active: nextActive });
    const updatedList = result.list || {};
    allLists = allLists.map((item) => {
      const itemId = item.id || item._id;
      if (itemId !== listId) return item;
      return { ...item, ...updatedList, active: updatedList.active ?? nextActive };
    });
    renderLists();
    showToast(nextActive ? "List activated." : "List deactivated.");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = originalText;
    showToast(err.message, "error");
  }
}

async function refreshListPriority(listId, btn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Updating…";
  try {
    const result = await apiPost(`/api/wieland/lists/${encodeURIComponent(listId)}/refresh-priority`, {});
    showToast(`List updated. ${result.updated || 0} leads synced.`);
    await loadListLeads(listId);
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function deleteLead(listId, leadId, btn) {
  if (!confirm("Remove this lead from the list?")) return;
  btn.disabled = true;
  btn.textContent = "…";
  try {
    await apiDelete(`/api/wieland/lists/${encodeURIComponent(listId)}/leads/${encodeURIComponent(leadId)}`);
    btn.closest("tr").remove();
    showToast("Lead removed.");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Remove";
    showToast(err.message, "error");
  }
}

async function deleteList(listId, name, btn) {
  if (!confirm(`Delete list "${name}"? This cannot be undone.`)) return;
  btn.disabled = true;
  btn.textContent = "Deleting…";
  try {
    await apiDelete(`/api/wieland/lists/${encodeURIComponent(listId)}`);
    allLists = allLists.filter(l => (l.id || l._id) !== listId);
    renderLists();
    showToast("List deleted.");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Delete";
    showToast(err.message, "error");
  }
}

// Event delegation — lists container
document.getElementById("listsContainer").addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const { action, listId, leadId, name } = el.dataset;
  const active = el.dataset.active === "true";

  if (action === "toggle-list") {
    document.getElementById(`list-${listId}`)?.classList.toggle("open");
  } else if (action === "toggle-list-active") {
    await toggleListActive(listId, active, el);
  } else if (action === "assign-contacts") {
    openAssignModal(listId);
  } else if (action === "refresh-priority") {
    await refreshListPriority(listId, el);
  } else if (action === "load-leads") {
    await loadListLeads(listId);
  } else if (action === "view-upload-log") {
    await loadUploadLog(listId);
  } else if (action === "delete-list") {
    await deleteList(listId, name, el);
  } else if (action === "delete-lead") {
    await deleteLead(listId, leadId, el);
  }
});

// ── New list modal ────────────────────────────────────────────────────────────
const listModal = document.getElementById("listModal");
const listModalAlert = document.getElementById("listModalAlert");
let listUploadRows = [];
let listUploadHeaders = [];
let listUploadFileName = "";

function showListStep(step) {
  document.getElementById("listStep1").hidden = step !== 1;
  document.getElementById("listStep2").hidden = step !== 2;
  updateListSourceUi();
}

function getListSource() {
  return document.querySelector("input[name='listSource']:checked")?.value || "file";
}

function updateListSourceUi() {
  const canUseContacts = visibleTabs.contacts !== false;
  const sourceWrap = document.getElementById("listSourceWrap");
  const contactsRadio = document.getElementById("listSourceContacts");
  const fileRadio = document.getElementById("listSourceFile");
  if (!canUseContacts) {
    sourceWrap.hidden = true;
    contactsRadio.checked = false;
    fileRadio.checked = true;
  } else {
    sourceWrap.hidden = false;
  }

  const useContacts = canUseContacts && getListSource() === "contacts";
  document.getElementById("listContactPicker").hidden = !useContacts;
  document.getElementById("listFilePicker").hidden = useContacts;
}

document.getElementById("newListBtn").addEventListener("click", () => {
  clearModalAlert(listModalAlert);
  document.getElementById("listName").value = "";
  document.getElementById("listDescription").value = "";
  document.getElementById("listIsSms").checked = false;
  document.getElementById("listFileInput").value = "";
  document.getElementById("listFileSummary").textContent = "No file selected.";
  listUploadRows = [];
  listUploadHeaders = [];
  listUploadFileName = "";
  if (visibleTabs.contacts !== false) {
    document.getElementById("listSourceContacts").checked = true;
  } else {
    document.getElementById("listSourceFile").checked = true;
  }
  showListStep(1);
  listModal.classList.remove("hidden");
});

document.getElementById("listModalCancel").addEventListener("click", () => listModal.classList.add("hidden"));

document.getElementById("listSelectAll").addEventListener("click", () => {
  document.querySelectorAll("#listContactList input[type='checkbox']").forEach(i => { i.checked = true; });
  updateListContactCount();
});
document.getElementById("listClearAll").addEventListener("click", () => {
  document.querySelectorAll("#listContactList input[type='checkbox']").forEach(i => { i.checked = false; });
  updateListContactCount();
});

document.querySelectorAll("input[name='listSource']").forEach((input) => {
  input.addEventListener("change", updateListSourceUi);
});

document.getElementById("listFileInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  listUploadRows = [];
  listUploadHeaders = [];
  listUploadFileName = "";
  document.getElementById("listFileSummary").textContent = "Reading file…";
  if (!file) {
    document.getElementById("listFileSummary").textContent = "No file selected.";
    return;
  }
  try {
    const parsed = await readListUploadFile(file);
    listUploadRows = parsed.rows;
    listUploadHeaders = parsed.headers;
    listUploadFileName = file.name;
    document.getElementById("listFileSummary").textContent = `${file.name} — ${listUploadRows.length} rows ready.`;
  } catch (err) {
    document.getElementById("listFileSummary").textContent = `Error: ${err.message}`;
  }
});

document.getElementById("listStepNext").addEventListener("click", async () => {
  const name = document.getElementById("listName").value.trim();
  if (!name) { showModalAlert(listModalAlert, "List name is required."); return; }
  clearModalAlert(listModalAlert);
  if (getListSource() === "contacts") {
    if (!loaded.contacts) {
      loaded.contacts = true;
      await loadContacts();
    }
    renderListContactPicker();
  }
  showListStep(2);
});

document.getElementById("listStepBack").addEventListener("click", () => {
  clearModalAlert(listModalAlert);
  showListStep(1);
});

document.getElementById("listModalSave").addEventListener("click", createList);

function updateListContactCount() {
  const total = document.querySelectorAll("#listContactList input[type='checkbox']").length;
  const checked = document.querySelectorAll("#listContactList input:checked").length;
  document.getElementById("listContactCount").textContent = `${checked} / ${total} seleccionados`;
}

function renderListContactPicker() {
  const listEl = document.getElementById("listContactList");
  const eligible = allContacts
    .filter(c => c.call_priority < INELIGIBLE_PRIORITY)
    .sort((a, b) => (b.call_priority || 0) - (a.call_priority || 0));

  if (!eligible.length) {
    listEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted);">No eligible contacts found.</div>`;
    document.getElementById("listContactCount").textContent = "";
    return;
  }

  listEl.innerHTML = eligible.map(c => {
    const name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
    const cid = escHtml(getContactKey(c));
    return `<label class="w-check-item">
      <input type="checkbox" value="${cid}" checked />
      ${priorityChip(c.call_priority, allContacts.length)} ${escHtml(name)} — ${escHtml(c.shift_type || c.trade || "—")} (${c.seniority_years || 0}y)
    </label>`;
  }).join("");

  document.getElementById("listContactList").addEventListener("change", updateListContactCount);
  updateListContactCount();
}

function parseSimpleCsv(text) {
  const lines = String(text || "").trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], headers: [] };
  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
    const row = {};
    headers.forEach((header, index) => { row[header] = values[index] || ""; });
    return row;
  }).filter((row) => Object.values(row).some(Boolean));
  return { rows, headers };
}

function readListUploadFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    reader.onload = (event) => {
      try {
        if (!isCsv && typeof XLSX === "undefined") {
          reject(new Error("Excel parser is not available. Use CSV or reload the page."));
          return;
        }
        if (typeof XLSX !== "undefined") {
          const workbook = isCsv
            ? XLSX.read(event.target.result, { type: "string" })
            : XLSX.read(event.target.result, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          const headers = rows.length ? Object.keys(rows[0]) : [];
          resolve({ rows, headers });
          return;
        }
        resolve(parseSimpleCsv(event.target.result));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("File could not be read."));
    if (isCsv) reader.readAsText(file, "utf-8");
    else reader.readAsArrayBuffer(file);
  });
}

async function createList() {
  const btn = document.getElementById("listModalSave");
  const name = document.getElementById("listName").value.trim();
  const description = document.getElementById("listDescription").value.trim();
  const isSMS = document.getElementById("listIsSms").checked;
  if (!name) { showModalAlert(listModalAlert, "List name is required."); return; }

  const source = getListSource();
  const selectedContactIds = source === "contacts"
    ? Array.from(document.querySelectorAll("#listContactList input:checked")).map(i => i.value)
    : [];
  if (source === "contacts" && !selectedContactIds.length) {
    showModalAlert(listModalAlert, "Select at least one contact.");
    return;
  }
  if (source === "file" && !listUploadRows.length) {
    showModalAlert(listModalAlert, "Upload an Excel or CSV file with at least one row.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Creating…";
  clearModalAlert(listModalAlert);
  try {
    const data = await apiPost("/api/wieland/lists", {
      name,
      description,
      isSMS,
      selectedContactIds,
      leads: source === "file" ? listUploadRows : [],
      headers: source === "file" ? listUploadHeaders : [],
      fileName: source === "file" ? listUploadFileName : ""
    });
    listModal.classList.add("hidden");
    showToast(formatCreateListToast(data), Number(data.uploadStatus?.totalFailed || 0) > 0 ? "error" : "");
    await loadLists();
  } catch (err) {
    showModalAlert(listModalAlert, err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Create & upload";
  }
}

// ── Assign modal ──────────────────────────────────────────────────────────────
const assignModal = document.getElementById("assignModal");
const assignModalAlert = document.getElementById("assignModalAlert");

function buildLeadFingerprints(item) {
  const values = [
    item?.externalId,
    item?.email,
    item?.phone,
    item?.mobile,
    `${item?.firstName || ""} ${item?.lastName || ""}`.trim(),
    item?.name
  ];
  return new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean));
}

async function openAssignModal(listId) {
  clearModalAlert(assignModalAlert);
  document.getElementById("assignListId").value = listId;
  const listEl = document.getElementById("assignContactList");
  listEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted);">Loading…</div>`;
  let existingFingerprints = new Set();
  try {
    const data = await api(`/api/wieland/lists/${encodeURIComponent(listId)}/leads`);
    const existingLeads = data.leads || [];
    existingFingerprints = new Set(existingLeads.flatMap((lead) => Array.from(buildLeadFingerprints(lead))));
  } catch {
    existingFingerprints = new Set();
  }

  const eligible = allContacts.filter((c) => {
    if (c.call_priority >= INELIGIBLE_PRIORITY) return false;
    const fingerprints = buildLeadFingerprints(c);
    for (const fingerprint of fingerprints) {
      if (existingFingerprints.has(fingerprint)) return false;
    }
    return true;
  });
  eligible.sort((a, b) => (b.call_priority || 0) - (a.call_priority || 0));
  if (!eligible.length) {
    listEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted);">No eligible contacts available to add.</div>`;
  } else {
    listEl.innerHTML = eligible.map(c => {
      const name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
      const cid = escHtml(getContactKey(c));
      return `<label class="w-check-item">
        <input type="checkbox" value="${cid}" />
        ${priorityChip(c.call_priority, allContacts.length)} ${escHtml(name)} — ${escHtml(c.shift_type || c.trade || "—")} (${c.seniority_years || 0}y)
      </label>`;
    }).join("");
  }
  assignModal.classList.remove("hidden");
}

document.getElementById("assignModalCancel").addEventListener("click", () => assignModal.classList.add("hidden"));
document.getElementById("assignSelectAll").addEventListener("click", () => {
  document.querySelectorAll("#assignContactList input[type='checkbox']").forEach((input) => {
    input.checked = true;
  });
});
document.getElementById("assignClearAll").addEventListener("click", () => {
  document.querySelectorAll("#assignContactList input[type='checkbox']").forEach((input) => {
    input.checked = false;
  });
});
document.getElementById("assignModalSave").addEventListener("click", assignContacts);

async function assignContacts() {
  const btn = document.getElementById("assignModalSave");
  const listId = document.getElementById("assignListId").value;
  const checked = Array.from(document.querySelectorAll("#assignContactList input:checked")).map(i => i.value);
  if (!checked.length) { showModalAlert(assignModalAlert, "Select at least one contact."); return; }

  btn.disabled = true;
  btn.textContent = "Adding…";
  clearModalAlert(assignModalAlert);

  const leads = checked.map(exId => {
    const c = allContacts.find(x => getContactKey(x) === exId);
    if (!c) return null;
    return {
      ...c,
      name: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
      outboundListId: listId
    };
  }).filter(Boolean);

  try {
    const result = await apiPost(`/api/wieland/lists/${encodeURIComponent(listId)}/leads`, { leads });
    let priorityRefreshError = null;
    if ((result.added || 0) > 0) {
      try {
        await apiPost(`/api/wieland/lists/${encodeURIComponent(listId)}/refresh-priority`, {});
      } catch (err) {
        priorityRefreshError = err;
      }
    }
    assignModal.classList.add("hidden");
    if (priorityRefreshError) {
      showToast(`${result.added || 0} leads added.${result.skippedExisting ? ` ${result.skippedExisting} already existed.` : ""} Priority refresh failed.`);
    } else {
      showToast(`${result.added || 0} leads added.${result.skippedExisting ? ` ${result.skippedExisting} already existed.` : ""}`);
    }
    await loadListLeads(listId);
  } catch (err) {
    showModalAlert(assignModalAlert, err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Add leads";
  }
}

// ── Campaign status ───────────────────────────────────────────────────────────
function campaignName(c) {
  return c?.localizations?.name?.en?.value || c?.name || c?.campaignId || c?._id || "—";
}

function campaignDescription(c) {
  return c?.localizations?.description?.en?.value || c?.description || "—";
}

function campaignMode(c) {
  const modes = [];
  if (c?.useForProgressive) modes.push("Progressive");
  if (c?.useForPredictive) modes.push("Predictive");
  if (c?.useForOutbound || c?.defaultOutbound) modes.push("Outbound");
  if (c?.useForSMS) modes.push("SMS");
  if (c?.useForEmail) modes.push("Email");
  return modes.length ? modes.join(" / ") : "—";
}

function fmtValue(value, suffix = "") {
  if (value === undefined || value === null || value === "") return "—";
  return `${value}${suffix}`;
}

function renderInfoRows(rows) {
  return rows.map(([label, value]) => `
    <div class="w-info-row">
      <span class="w-info-row-label">${escHtml(label)}</span>
      <span class="w-info-row-value">${escHtml(value)}</span>
    </div>
  `).join("");
}

async function loadCampaignStatus() {
  const slotsInfo = document.getElementById("slotsInfo");
  const campaignConfigInfo = document.getElementById("campaignConfigInfo");
  const campaignDialRulesInfo = document.getElementById("campaignDialRulesInfo");
  const campaignDispositionsInfo = document.getElementById("campaignDispositionsInfo");
  const campaignFilterInfo = document.getElementById("campaignFilterInfo");
  try {
    const data = await getCampaignStatus();
    const slotsNeeded = data.slotsNeeded || 8;
    const c = data.campaign || {};
    const accepted = c.acceptedCount || c.accepted || 0;
    const pct = Math.min(100, Math.round((accepted / slotsNeeded) * 100));
    slotsInfo.innerHTML = `
      <div style="font-size:1.5rem;font-weight:800;color:var(--brand)">${accepted} / ${slotsNeeded}</div>
      <div style="font-size:0.82rem;color:var(--muted);margin:4px 0 10px">slots accepted</div>
      <div class="w-slots-bar"><div class="w-slots-fill" style="width:${pct}%"></div></div>
    `;
    campaignConfigInfo.classList.remove("w-loading");
    campaignConfigInfo.innerHTML = renderInfoRows([
      ["Campaign", campaignName(c)],
      ["Description", campaignDescription(c)],
      ["Tenant", fmtValue(c.tenantId)],
      ["Campaign ID", fmtValue(c.campaignId || c._id)],
      ["Mode", campaignMode(c)],
      ["Dial ratio", fmtValue(c.maxDialRatio)],
      ["AMD", c.amdUnknownAsVoicemail ? "Unknown → Voicemail" : "Unknown → Human"]
    ]);
    campaignDialRulesInfo.classList.remove("w-loading");
    campaignDialRulesInfo.innerHTML = renderInfoRows([
      ["Daily max attempts", fmtValue(c.dailyMaxAttempts)],
      ["Max per number", fmtValue(c.maxAttemptsPerAddress || c.maxAttempts)],
      ["Cool off period", fmtValue(c.coolOffPeriodInSec, "s")],
      ["No answer timeout", fmtValue(c.noAnswerTimeout, "s")],
      ["Primary phone field", fmtValue(c.primaryPhoneField)],
      ["Lead order by", fmtValue(c.leadOrderByField)]
    ]);
    const dispositions = c?.dispositions?.objects || [];
    campaignDispositionsInfo.classList.remove("w-loading");
    if (dispositions.length) {
      campaignDispositionsInfo.innerHTML = `
        <div class="w-table-wrap">
          <table class="w-table">
            <thead><tr><th>Disposition</th><th>Description</th><th>Resolved</th><th>Connect again</th></tr></thead>
            <tbody>
              ${dispositions.map((item) => {
                const disposition = item?.expansions?.dispositionId || {};
                const name = disposition?.localizations?.name?.en?.value || disposition?.name || item?.dispositionId || "—";
                const description = disposition?.localizations?.description?.en?.value || disposition?.description || disposition?.note || "—";
                const resolved = disposition?.resolved === true ? "Yes" : disposition?.resolved === false ? "No" : "—";
                const connectAgain = disposition?.connectAgain === true ? "Yes" : disposition?.connectAgain === false ? "No" : "—";
                return `<tr><td><strong>${escHtml(name)}</strong></td><td>${escHtml(description)}</td><td>${escHtml(resolved)}</td><td>${escHtml(connectAgain)}</td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>`;
    } else {
      campaignDispositionsInfo.innerHTML = `<span style="color:var(--muted);font-size:0.85rem;">No campaign dispositions configured.</span>`;
    }
    campaignFilterInfo.textContent = c.filterOnLeads || "No campaign filter configured.";
  } catch (err) {
    console.error("Campaign status error:", err);
    slotsInfo.innerHTML = `<span style="color:var(--muted);font-size:0.85rem;">Campaign status unavailable.</span>`;
    campaignConfigInfo.classList.remove("w-loading");
    campaignDialRulesInfo.classList.remove("w-loading");
    campaignDispositionsInfo.classList.remove("w-loading");
    campaignConfigInfo.innerHTML = `<span style="color:var(--muted);font-size:0.85rem;">Campaign data unavailable.</span>`;
    campaignDialRulesInfo.innerHTML = `<span style="color:var(--muted);font-size:0.85rem;">Dial rules unavailable.</span>`;
    campaignDispositionsInfo.innerHTML = `<span style="color:var(--muted);font-size:0.85rem;">Dispositions unavailable.</span>`;
    campaignFilterInfo.textContent = "Campaign filter unavailable.";
  }
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function showModalAlert(el, msg) {
  el.textContent = msg;
  el.className = "w-alert error";
}

function clearModalAlert(el) {
  el.textContent = "";
  el.className = "w-alert";
}

[contactModal, listModal, assignModal].forEach(modal => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });
});

// ── Utility ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function yearsFromDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d) / (365.25 * 24 * 60 * 60 * 1000));
}

function getWidgetMappedContactField(widgetField) {
  return currentWidgetToContactMap[widgetField] || DEFAULT_WIDGET_TO_CONTACT_MAP[widgetField] || widgetField;
}

function getWidgetValue(contact, widgetField) {
  const mappedField = getWidgetMappedContactField(widgetField);
  const mappedValue = contact?.[mappedField];
  if (mappedValue !== undefined && mappedValue !== null && mappedValue !== "") return mappedValue;
  const fallbackValue = contact?.[widgetField];
  return fallbackValue !== undefined && fallbackValue !== null ? fallbackValue : "";
}

function formatHint(labelField, nccListField = "") {
  return nccListField ? `(${labelField} | NCC list: ${nccListField})` : `(${labelField})`;
}

function updateContactFieldHints() {
  const hintMap = {
    hintFirstName:        ["firstName",          currentContactToListMap.firstName],
    hintLastName:         ["lastName",           currentContactToListMap.lastName],
    hintPhone:            ["phone",              currentContactToListMap.phone],
    hintMobile:           ["mobile",             currentContactToListMap.mobile],
    hintExternalId:       [getWidgetMappedContactField("externalId"), currentContactToListMap[getWidgetMappedContactField("externalId")] || ""],
    hintTrade:            ["trade",              currentContactToListMap.city],
    hintShiftType:        ["shift_type"],
    hintPlantLocation:    ["plant_location",     currentContactToListMap.address || currentContactToListMap.addresss],
    hintSeniorityStartDate: ["seniority_start_date", currentContactToListMap.dob],
    hintStatus:           ["active_status",      currentContactToListMap.state],
    hintUnionEligible:    ["union_eligible",     currentContactToListMap.zip],
    hintDoNotCall:        ["do_not_call"]
  };
  Object.entries(hintMap).forEach(([id, [labelField, nccListField]]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatHint(labelField, nccListField);
  });
}

async function loadContactFieldHints() {
  try {
    const data = await getCampaignStatus();
    currentWidgetToContactMap = {
      ...DEFAULT_WIDGET_TO_CONTACT_MAP,
      ...(data?.localConfig?.widgetToContactMap || {})
    };
    currentContactToListMap = Object.keys(data?.localConfig?.contactToListMap || {}).length
      ? (data?.localConfig?.contactToListMap || {})
      : (data?.campaign?.expansions?.fieldMappingsId?.fields || {});
  } catch (err) {
    console.error("Field hints error:", err);
    currentWidgetToContactMap = { ...DEFAULT_WIDGET_TO_CONTACT_MAP };
    currentContactToListMap = {};
  }
  updateContactFieldHints();
}

// ── Field mapping ─────────────────────────────────────────────────────────────
const DEFAULT_WIDGET_TO_CONTACT_MAP = {
  firstName: "firstName",
  lastName: "lastName",
  phone: "phone",
  mobile: "mobile",
  externalId: "externalId",
  shiftType: "shift_type",
  trade: "trade",
  plantLocation: "plant_location",
  seniorityStartDate: "seniority_start_date",
  seniorityYears: "seniority_years",
  status: "active_status",
  priority: "call_priority",
  unionEligible: "union_eligible",
  doNotCall: "do_not_call",
  email: "email",
  name: "name",
  objectType: "objectType"
};

const KNOWN_CONTACT_FIELDS = [
  ["firstName", "Employee first name"],
  ["lastName", "Employee last name"],
  ["phone", "Primary phone number"],
  ["mobile", "Alternate phone number"],
  ["email", "Email address"],
  ["externalId", "Employee ID (external identifier)"],
  ["shift_type", "Shift / cambio"],
  ["trade", "Trade / role"],
  ["plant_location", "Plant location"],
  ["seniority_start_date", "Seniority start date"],
  ["seniority_years", "Seniority in years"],
  ["active_status", "Employment status"],
  ["union_eligible", "Union eligibility flag"],
  ["do_not_call", "Do not call flag"],
  ["call_priority", "Computed call priority"],
  ["name", "Full display name"],
  ["account", "Account"],
  ["accountId", "Account ID"],
  ["accountName", "Account name"],
  ["accountNumber", "Account number"],
  ["address", "Address"],
  ["city", "City"],
  ["contactId", "Contact ID"],
  ["country", "Country"],
  ["description", "Description"],
  ["dl", "DL"],
  ["linkedIn", "LinkedIn"],
  ["locations", "Locations"],
  ["objectType", "Object type"],
  ["operator", "Operator"],
  ["poe", "POE"],
  ["poenumber", "POE number"],
  ["preferenceEmail", "Preference email"],
  ["role", "Role"]
];

async function loadFieldMapping() {
  const loadingEl = document.getElementById("mappingLoading");
  const editorEl = document.getElementById("mappingEditor");
  const widgetRows = document.getElementById("widgetMappingRows");
  const listRows = document.getElementById("listMappingRows");
  try {
    const data = await getCampaignStatus();
    const campaign = data.campaign || {};
    const widgetMap = {
      ...DEFAULT_WIDGET_TO_CONTACT_MAP,
      ...(data?.localConfig?.widgetToContactMap || {})
    };
    const listMap = Object.keys(data?.localConfig?.contactToListMap || {}).length
      ? (data?.localConfig?.contactToListMap || {})
      : (campaign?.expansions?.fieldMappingsId?.fields || {});
    widgetRows.innerHTML = Object.entries(widgetMap).map(([field, contactField]) => `
      <tr>
        <td><code class="w-code">${escHtml(field)}</code></td>
        <td><input class="w-input w-input-sm" type="text" value="${escHtml(contactField)}" readonly style="width:150px;background:#f8fafc;color:#475569;" /></td>
        <td style="color:var(--muted);font-size:0.85rem;">Logical field used by the widget.</td>
      </tr>
    `).join("");
    const allFields = [...KNOWN_CONTACT_FIELDS];
    const knownKeys = new Set(KNOWN_CONTACT_FIELDS.map(([k]) => k));
    for (const key of Object.keys(listMap)) {
      if (!knownKeys.has(key)) allFields.push([key, "Custom field"]);
    }
    listRows.innerHTML = allFields.map(([field, desc]) => `
      <tr>
        <td><code class="w-code">${escHtml(field)}</code></td>
        <td><input class="w-input w-input-sm" type="text" value="${escHtml(listMap[field] || "")}" readonly style="width:150px;background:#f8fafc;color:#475569;" /></td>
        <td style="color:var(--muted);font-size:0.85rem;">${escHtml(desc)}</td>
      </tr>
    `).join("");
    loadingEl.style.display = "none";
    editorEl.hidden = false;
  } catch (err) {
    loadingEl.textContent = `Error: ${err.message}`;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
initCheck();
