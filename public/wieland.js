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
  const data = await res.json();
  if (!res.ok) {
    const detail = data.details ? ` — ${typeof data.details === "string" ? data.details : JSON.stringify(data.details)}` : "";
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

// ── Init check ────────────────────────────────────────────────────────────────
function initCheck() {
  if (!campaignId) {
    const el = document.getElementById("initMessage");
    el.textContent = "Missing ?campaign= parameter. Access this page from the Admin panel.";
    el.hidden = false;
    return false;
  }
  document.getElementById("campaignLabel").textContent = `— ${campaignId}`;
  document.getElementById("initMessage").hidden = true;
  document.getElementById("mainBody").hidden = false;
  loadContactFieldHints();
  loaded.contacts = true;
  loadContacts();
  return true;
}

// ── Tab navigation ────────────────────────────────────────────────────────────
const tabs = document.querySelectorAll(".w-tab");
const panels = document.querySelectorAll(".w-panel");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
  });
});

// ── Priority chip ─────────────────────────────────────────────────────────────
function priorityChip(p) {
  const cls = p <= 3 ? "top" : p <= 9 ? "mid" : "low";
  const label = p >= 9999 ? "—" : p;
  return `<span class="w-priority ${cls}">${label}</span>`;
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
  else if (currentFilter === "eligible") list = list.filter(c => c.call_priority < 9999);
  return list;
}

function updateStats() {
  const total = allContacts.length;
  const union = allContacts.filter(c => c.union_eligible).length;
  const active = allContacts.filter(c => c.active_status === "Active").length;
  const dnc = allContacts.filter(c => c.do_not_call).length;
  const eligible = allContacts.filter(c => c.call_priority < 9999).length;
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
    return `<tr>
      <td>${priorityChip(c.call_priority || 9999)}</td>
      <td>${escHtml(c.externalId || c.contactId || c._id || "—")}</td>
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
          <button class="w-btn w-btn-secondary w-btn-sm" onclick="openEditContact('${cid}')">Edit</button>
          <button class="w-btn ${c.active_status === "Active" ? "w-btn-danger" : "w-btn-secondary"} w-btn-sm" onclick="toggleContactActive('${cid}')">${c.active_status === "Active" ? "Deactivate" : "Activate"}</button>
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

document.getElementById("contactSearch").addEventListener("input", (e) => {
  contactSearchValue = e.target.value;
  renderContactsTable();
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
  document.getElementById("mExternalId").value = c.externalId || "";
  document.getElementById("mTrade").value = c.trade || "";
  document.getElementById("mShift").value = c.shift_type || "";
  document.getElementById("mPlant").value = c.plant_location || "";
  document.getElementById("mSeniorityStartDate").value = c.seniority_start_date || "";
  document.getElementById("mStatus").value = c.active_status || "Active";
  document.getElementById("mUnion").checked = Boolean(c.union_eligible);
  document.getElementById("mDNC").checked = Boolean(c.do_not_call);
  contactModal.classList.remove("hidden");
}

window.openEditContact = openEditContact;

async function toggleContactActive(externalId) {
  const c = allContacts.find(x => getContactKey(x) === externalId);
  if (!c) return;
  const nextStatus = c.active_status === "Active" ? "Inactive" : "Active";
  try {
    await apiPatch(`/api/wieland/contacts/${encodeURIComponent(externalId)}`, {
      active_status: nextStatus,
      state: nextStatus
    });
    showToast(`Contact ${nextStatus === "Active" ? "activated" : "deactivated"}.`);
    await loadContacts();
  } catch (err) {
    showToast(err.message, "error");
  }
}

window.toggleContactActive = toggleContactActive;

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

  const payload = {
    firstName: document.getElementById("mFirstName").value.trim(),
    lastName: document.getElementById("mLastName").value.trim(),
    name: `${document.getElementById("mFirstName").value.trim()} ${document.getElementById("mLastName").value.trim()}`.trim(),
    phone: document.getElementById("mPhone").value.trim(),
    mobile: document.getElementById("mMobile").value.trim(),
    externalId,
    city: document.getElementById("mTrade").value.trim(),
    addresss: document.getElementById("mPlant").value.trim(),
    state: document.getElementById("mStatus").value,
    zip: document.getElementById("mUnion").checked ? "1" : "0",
    dob: document.getElementById("mSeniorityStartDate").value || "",
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
    const count = list.leadCount || list.recordCount || list.count || "";
    const isActive = Boolean(list.active);
    return `<div class="w-list-card" id="list-${escHtml(listId)}">
      <div class="w-list-header" onclick="toggleList('${escHtml(listId)}')">
        <span class="w-list-name">${escHtml(name)}</span>
        <span class="w-list-meta">${isActive ? "Activa" : "Inactiva"}</span>
        ${status ? `<span class="w-list-meta">${escHtml(status)}</span>` : ""}
        ${count !== "" ? `<span class="w-list-meta">${count} records</span>` : ""}
        <span class="w-list-chevron">▼</span>
      </div>
      <div class="w-list-body">
        <div class="w-list-toolbar">
          <button class="w-btn w-btn-secondary w-btn-sm" onclick="toggleListActive('${escHtml(listId)}', ${isActive}, this)">${isActive ? "Desactivar lista" : "Activar lista"}</button>
          <button class="w-btn w-btn-secondary w-btn-sm" onclick="openAssignModal('${escHtml(listId)}')">Assign contacts</button>
          <button class="w-btn w-btn-secondary w-btn-sm" onclick="refreshListPriority('${escHtml(listId)}', this)">Actualizar lista</button>
          <button class="w-btn w-btn-secondary w-btn-sm" onclick="loadListLeads('${escHtml(listId)}')">Refresh leads</button>
          <button class="w-btn w-btn-danger w-btn-sm" onclick="deleteList('${escHtml(listId)}', '${escHtml(name)}')">Delete</button>
        </div>
        <div id="leads-${escHtml(listId)}" style="padding:12px 20px;">
          <span style="color:var(--muted);font-size:0.85rem;">Click "Refresh leads" to load.</span>
        </div>
      </div>
    </div>`;
  }).join("");
}

window.toggleList = function(listId) {
  document.getElementById(`list-${listId}`)?.classList.toggle("open");
};

window.deleteLead = async function(listId, leadId, btn) {
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
};

window.toggleListActive = async function(listId, currentActive, btn) {
  const nextActive = !currentActive;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = nextActive ? "Activando…" : "Desactivando…";
  try {
    const result = await apiPatch(`/api/wieland/lists/${encodeURIComponent(listId)}`, { active: nextActive });
    const updatedList = result.list || {};
    allLists = allLists.map((item) => {
      const itemId = item.id || item._id;
      if (itemId !== listId) return item;
      return { ...item, ...updatedList, active: updatedList.active ?? nextActive };
    });
    renderLists();
    showToast(nextActive ? "Lista activada." : "Lista desactivada.");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = originalText;
    showToast(err.message, "error");
  }
};

window.deleteList = async function(listId, name) {
  if (!confirm(`Delete list "${name}"? This cannot be undone.`)) return;
  try {
    await apiDelete(`/api/wieland/lists/${encodeURIComponent(listId)}`);
    allLists = allLists.filter(l => (l.id || l._id) !== listId);
    renderLists();
    showToast("List deleted.");
  } catch (err) {
    showToast(err.message, "error");
  }
};

window.loadListLeads = async function(listId) {
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
        <td><button class="w-btn w-btn-danger w-btn-sm" onclick="deleteLead('${escHtml(listId)}','${escHtml(leadId)}',this)">Remove</button></td>
      </tr>`;
    }).join("");
    leadsEl.innerHTML = `<table class="w-table">
      <thead><tr><th>External ID</th><th>Name</th><th>Phone</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  } catch (err) {
    leadsEl.innerHTML = `<span style="color:#991b1b;font-size:0.85rem;">Error: ${escHtml(err.message)}</span>`;
  }
};

window.refreshListPriority = async function(listId, btn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Actualizando…";
  try {
    const result = await apiPost(`/api/wieland/lists/${encodeURIComponent(listId)}/refresh-priority`, {});
    showToast(`Lista actualizada. ${result.updated || 0} leads sincronizados.`);
    await loadListLeads(listId);
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

// ── New list modal ────────────────────────────────────────────────────────────
const listModal = document.getElementById("listModal");
const listModalAlert = document.getElementById("listModalAlert");

document.getElementById("newListBtn").addEventListener("click", () => {
  clearModalAlert(listModalAlert);
  document.getElementById("listName").value = "";
  document.getElementById("listDescription").value = "";
  listModal.classList.remove("hidden");
});
document.getElementById("listModalCancel").addEventListener("click", () => listModal.classList.add("hidden"));
document.getElementById("listModalSave").addEventListener("click", createList);

async function createList() {
  const btn = document.getElementById("listModalSave");
  const name = document.getElementById("listName").value.trim();
  const description = document.getElementById("listDescription").value.trim();
  if (!name) { showModalAlert(listModalAlert, "List name is required."); return; }

  btn.disabled = true;
  btn.textContent = "Creating…";
  clearModalAlert(listModalAlert);
  try {
    const data = await apiPost("/api/wieland/lists", { name, description });
    listModal.classList.add("hidden");
    showToast(`List created with ${data.contactsInCsv || 0} eligible contacts.`);
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

window.openAssignModal = function(listId) {
  clearModalAlert(assignModalAlert);
  document.getElementById("assignListId").value = listId;
  const eligible = allContacts.filter(c => c.call_priority < 9999);
  eligible.sort((a, b) => (b.call_priority || 0) - (a.call_priority || 0));
  const listEl = document.getElementById("assignContactList");
  if (!eligible.length) {
    listEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted);">No eligible contacts found.</div>`;
  } else {
    listEl.innerHTML = eligible.map(c => {
      const name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
      const cid = escHtml(getContactKey(c));
      return `<label class="w-check-item">
        <input type="checkbox" value="${cid}" checked />
        ${priorityChip(c.call_priority)} ${escHtml(name)} — ${escHtml(c.shift_type || c.trade || "—")} (${c.seniority_years || 0}y)
      </label>`;
    }).join("");
  }
  assignModal.classList.remove("hidden");
};

document.getElementById("assignModalCancel").addEventListener("click", () => assignModal.classList.add("hidden"));
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
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      phone: c.phone || "",
      mobile: c.mobile || "",
      email: c.email || "",
      externalId: c.externalId || "",
      thrioListId: listId
    };
  }).filter(Boolean);

  try {
    await apiPost(`/api/wieland/lists/${encodeURIComponent(listId)}/leads`, { leads });
    assignModal.classList.add("hidden");
    showToast(`${leads.length} leads added to list.`);
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
    const data = await api("/api/wieland/campaign/status");
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
  } catch {
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
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function yearsFromDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d) / (365.25 * 24 * 60 * 60 * 1000));
}

function formatHint(labelField, nccListField = "") {
  return nccListField ? `(${labelField} | NCC list: ${nccListField})` : `(${labelField})`;
}

function updateContactFieldHints() {
  const hintMap = {
    hintFirstName: ["firstName", currentContactToListMap.firstName],
    hintLastName: ["lastName", currentContactToListMap.lastName],
    hintPhone: ["phone", currentContactToListMap.phone],
    hintMobile: ["mobile", currentContactToListMap.mobile],
    hintExternalId: ["externalId"],
    hintTrade: ["city", currentContactToListMap.city],
    hintShiftType: ["shift_type"],
    hintPlantLocation: ["addresss", currentContactToListMap.addresss],
    hintSeniorityStartDate: ["dob"],
    hintStatus: ["state"],
    hintUnionEligible: ["zip"],
    hintDoNotCall: ["do_not_call"]
  };
  Object.entries(hintMap).forEach(([id, [labelField, nccListField]]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatHint(labelField, nccListField);
  });
}

async function loadContactFieldHints() {
  try {
    const data = await api("/api/wieland/campaign/status");
    currentContactToListMap = data?.campaign?.expansions?.fieldMappingsId?.fields || {};
  } catch {
    currentContactToListMap = {};
  }
  updateContactFieldHints();
}

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
  ["addresss", "Address"],
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
    const data = await api("/api/wieland/campaign/status");
    const campaign = data.campaign || {};
    const widgetMap = DEFAULT_WIDGET_TO_CONTACT_MAP;
    const listMap = campaign?.expansions?.fieldMappingsId?.fields || {};
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

// ── Tab-aware lazy loading ────────────────────────────────────────────────────
let loaded = { contacts: false, lists: false, campaign: false, mapping: false };

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    if (name === "lists" && !loaded.lists) { loaded.lists = true; loadLists(); }
    if (name === "campaign" && !loaded.campaign) { loaded.campaign = true; loadCampaignStatus(); }
    if (name === "mapping" && !loaded.mapping) { loaded.mapping = true; loadFieldMapping(); }
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
initCheck();
