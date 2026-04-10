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
  if (res.status === 401) {
    location.replace(buildUrl("/login.html"));
    throw new Error("Session expired.");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function apiPost(path, body) {
  return api(path, { method: "POST", body: JSON.stringify(body) });
}

function apiPatch(path, body) {
  return api(path, { method: "PATCH", body: JSON.stringify(body) });
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
let session = null;

// ── Auth + campaign check ──────────────────────────────────────────────────────
async function initSession() {
  // Check session
  try {
    const data = await fetch(buildUrl("/api/admin/me"), { credentials: "include" }).then(r => r.json());
    if (!data.user) { location.replace(buildUrl("/login.html")); return false; }
    session = data.user;
    const userBar = document.getElementById("userBar");
    document.getElementById("userName").textContent = session.username;
    document.getElementById("userRole").textContent = session.role;
    userBar.hidden = false;
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await fetch(buildUrl("/api/admin/logout"), { method: "POST", credentials: "include" });
      location.replace(buildUrl("/login.html"));
    });
  } catch {
    location.replace(buildUrl("/login.html"));
    return false;
  }

  // Validate campaign param
  if (!campaignId) {
    document.getElementById("initMessage").textContent = "Missing ?campaign= parameter. Access this page from the Admin panel.";
    return false;
  }

  document.getElementById("campaignLabel").textContent = `— ${campaignId}`;
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

// ── Contacts ──────────────────────────────────────────────────────────────────
function filteredContacts() {
  let list = allContacts;
  const q = contactSearchValue.toLowerCase();
  if (q) {
    list = list.filter(c =>
      (c.firstName || "").toLowerCase().includes(q) ||
      (c.lastName || "").toLowerCase().includes(q) ||
      (c.externalId || "").toLowerCase().includes(q) ||
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
    const cid = escHtml(c.externalId || c.id || "");
    return `<tr>
      <td>${priorityChip(c.call_priority || 9999)}</td>
      <td>${escHtml(c.externalId || "—")}</td>
      <td><strong>${escHtml(name)}</strong></td>
      <td>${escHtml(c.trade || "—")}</td>
      <td>${escHtml(c.plant_location || "—")}</td>
      <td>${unionBadge}</td>
      <td>${statusBadge(c.active_status)}</td>
      <td>${escHtml(c.phone || "—")}</td>
      <td>${dncBadge}</td>
      <td>${escHtml(c.seniority_years != null ? c.seniority_years + "y" : "—")}</td>
      <td><button class="w-btn w-btn-secondary w-btn-sm" onclick="openEditContact('${cid}')">Edit</button></td>
    </tr>`;
  }).join("");

  wrap.innerHTML = `<table class="w-table">
    <thead><tr>
      <th>Priority</th><th>Employee ID</th><th>Name</th><th>Trade</th><th>Plant</th>
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
  const c = allContacts.find(x => (x.externalId || x.id) === externalId);
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
  document.getElementById("mPlant").value = c.plant_location || "";
  document.getElementById("mSeniority").value = c.seniority_years != null ? c.seniority_years : "";
  document.getElementById("mStatus").value = c.active_status || "Active";
  document.getElementById("mUnion").checked = Boolean(c.union_eligible);
  document.getElementById("mDNC").checked = Boolean(c.do_not_call);
  contactModal.classList.remove("hidden");
}

window.openEditContact = openEditContact;

function clearContactForm() {
  ["mFirstName","mLastName","mPhone","mMobile","mExternalId","mTrade","mPlant","mSeniority"].forEach(id => {
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
    phone: document.getElementById("mPhone").value.trim(),
    mobile: document.getElementById("mMobile").value.trim(),
    externalId,
    union_eligible: document.getElementById("mUnion").checked,
    active_status: document.getElementById("mStatus").value,
    do_not_call: document.getElementById("mDNC").checked,
    seniority_years: parseFloat(document.getElementById("mSeniority").value) || 0,
    plant_location: document.getElementById("mPlant").value.trim(),
    trade: document.getElementById("mTrade").value.trim()
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
    return `<div class="w-list-card" id="list-${escHtml(listId)}">
      <div class="w-list-header" onclick="toggleList('${escHtml(listId)}')">
        <span class="w-list-name">${escHtml(name)}</span>
        ${status ? `<span class="w-list-meta">${escHtml(status)}</span>` : ""}
        ${count !== "" ? `<span class="w-list-meta">${count} records</span>` : ""}
        <span class="w-list-chevron">▼</span>
      </div>
      <div class="w-list-body">
        <div class="w-list-toolbar">
          <button class="w-btn w-btn-secondary w-btn-sm" onclick="openAssignModal('${escHtml(listId)}')">Assign contacts</button>
          <button class="w-btn w-btn-secondary w-btn-sm" onclick="loadListLeads('${escHtml(listId)}')">Refresh leads</button>
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
      return `<tr>
        <td>${priorityChip(l.call_priority || 9999)}</td>
        <td>${escHtml(l.T_EXTERNAL_ID || l.externalId || "—")}</td>
        <td>${escHtml(name || "—")}</td>
        <td>${escHtml(l.phone || "—")}</td>
        <td>${escHtml(l.placeOfEmployment || "—")}</td>
      </tr>`;
    }).join("");
    leadsEl.innerHTML = `<table class="w-table">
      <thead><tr><th>Priority</th><th>Employee ID</th><th>Name</th><th>Phone</th><th>Plant</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  } catch (err) {
    leadsEl.innerHTML = `<span style="color:#991b1b;font-size:0.85rem;">Error: ${escHtml(err.message)}</span>`;
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
  eligible.sort((a, b) => (a.call_priority || 9999) - (b.call_priority || 9999));
  const listEl = document.getElementById("assignContactList");
  if (!eligible.length) {
    listEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted);">No eligible contacts found.</div>`;
  } else {
    listEl.innerHTML = eligible.map(c => {
      const name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
      const cid = escHtml(c.externalId || c.id || "");
      return `<label class="w-check-item">
        <input type="checkbox" value="${cid}" checked />
        ${priorityChip(c.call_priority)} ${escHtml(name)} — ${escHtml(c.trade || "—")} (${c.seniority_years || 0}y)
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
    const c = allContacts.find(x => (x.externalId || x.id) === exId);
    if (!c) return null;
    return {
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      phone: c.phone || "",
      T_EXTERNAL_ID: exId,
      placeOfEmployment: c.plant_location || "",
      call_priority: c.call_priority || 9999
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
async function loadCampaignStatus() {
  const slotsInfo = document.getElementById("slotsInfo");
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
  } catch {
    slotsInfo.innerHTML = `<span style="color:var(--muted);font-size:0.85rem;">Campaign status unavailable.</span>`;
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

// ── Tab-aware lazy loading ────────────────────────────────────────────────────
let loaded = { contacts: false, lists: false, campaign: false };

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    if (name === "lists" && !loaded.lists) { loaded.lists = true; loadLists(); }
    if (name === "campaign" && !loaded.campaign) { loaded.campaign = true; loadCampaignStatus(); }
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  const ok = await initSession();
  if (!ok) return;

  document.getElementById("initMessage").hidden = true;
  document.getElementById("mainBody").hidden = false;

  loaded.contacts = true;
  await loadContacts();
})();
