(function () {
  const params = new URLSearchParams(window.location.search);
  const state = {
    campaign: params.get("campaign") || "",
    domain: params.get("domain") || "",
    selectedId: "",
    records: []
  };

  const $ = (id) => document.getElementById(id);
  const appBase = new URL(".", window.location.href);

  function setStatus(message, type) {
    const node = $("status");
    if (!node) return;
    node.textContent = message || "";
    node.className = "status" + (type ? " " + type : "");
  }

  function apiBase(path) {
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    const url = new URL(normalizedPath, appBase);
    if (state.campaign) url.searchParams.set("campaign", state.campaign);
    if (state.domain) url.searchParams.set("domain", state.domain);
    const token = params.get("token");
    if (token) url.searchParams.set("token", token);
    return url;
  }

  function extractRecords(payload) {
    const root = payload?.history || payload || {};
    const candidates = [
      root.objects,
      root.records,
      root.items,
      root.data,
      root.rows,
      root.results,
      Array.isArray(root) ? root : null
    ];
    for (const item of candidates) {
      if (Array.isArray(item)) return item;
    }
    return [];
  }

  function recordId(record) {
    return String(
      record?._id ||
      record?.id ||
      record?.workitemId ||
      record?.workitem_id ||
      record?.workItemId ||
      record?.wid ||
      ""
    ).trim();
  }

  function pick(record, keys) {
    for (const key of keys) {
      const value = key.split(".").reduce((acc, part) => acc && acc[part], record);
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  }

  function formatDate(value) {
    if (!value) return "";
    const raw = typeof value === "number" ? value : String(value);
    const numeric = Number(raw);
    const date = Number.isFinite(numeric) && String(Math.trunc(numeric)).length >= 10
      ? new Date(numeric)
      : new Date(raw);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function dateInputToTimestamp(value, endOfDay = false) {
    if (!value) return "";
    const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
    const date = new Date(value + suffix);
    return Number.isNaN(date.getTime()) ? "" : String(date.getTime());
  }

  function timestampToDateInput(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "";
    const date = new Date(numeric);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function short(value, max) {
    const text = String(value || "").trim();
    if (text.length <= max) return text;
    return text.slice(0, max - 1) + "...";
  }

  function renderRows(records) {
    const body = $("rowsBody");
    const count = $("count");
    if (count) count.textContent = records.length + (records.length === 1 ? " record" : " records");
    if (!body) return;
    if (!records.length) {
      body.innerHTML = '<tr><td colspan="4" class="muted">No records found.</td></tr>';
      return;
    }
    body.innerHTML = records.map((record, index) => {
      const id = recordId(record);
      const customer = pick(record, ["customerName", "customer.name", "contactName", "name", "ani", "from", "phone"]);
      const queue = pick(record, ["queueName", "queue.name", "queue", "campaignName", "campaign.name"]);
      const agent = pick(record, ["agentName", "agent.name", "agentUsername", "username", "user.name"]);
      const date = pick(record, ["createdAt", "created_at", "startedAt", "startTime", "dateCreated", "date", "timestamp"]);
      const type = pick(record, ["type", "channel", "mediaType", "direction"]);
      return `
        <tr data-index="${index}" data-id="${escapeHtml(id)}" class="${id === state.selectedId ? "is-selected" : ""}">
          <td>
            <span class="cell-main mono cell-id" title="${escapeHtml(id || "No id")}">${escapeHtml(short(id || "No id", 58))}</span>
            <span class="cell-sub" title="${escapeHtml(type)}">${escapeHtml(short(type, 42))}</span>
          </td>
          <td><span class="cell-main" title="${escapeHtml(customer)}">${escapeHtml(short(customer, 44))}</span></td>
          <td><span class="cell-main" title="${escapeHtml([queue, agent].filter(Boolean).join(" / "))}">${escapeHtml(short([queue, agent].filter(Boolean).join(" / "), 48))}</span></td>
          <td><span class="cell-main cell-date">${escapeHtml(formatDate(date))}</span></td>
        </tr>
      `;
    }).join("");
    body.querySelectorAll("tr[data-index]").forEach((row) => {
      row.addEventListener("click", () => loadDetail(row.getAttribute("data-id")));
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderValue(value, key) {
    if (Array.isArray(value)) {
      if (!value.length) return '<div class="muted">[]</div>';
      return `<details open><summary>${escapeHtml(key)} (${value.length})</summary><div class="nested">${value.map((item, index) => renderValue(item, String(index))).join("")}</div></details>`;
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value);
      if (!entries.length) return '<div class="muted">{}</div>';
      return `<details open><summary>${escapeHtml(key)}</summary><div class="nested">${entries.map(([childKey, childValue]) => renderValue(childValue, childKey)).join("")}</div></details>`;
    }
    return `<div class="kv"><div class="kv-key">${escapeHtml(key)}</div><div class="kv-value">${escapeHtml(value === undefined || value === null ? "" : value)}</div></div>`;
  }

  function renderRecording(root) {
    const recordingUrl = pick(root, ["recordingURL", "recordingUrl", "recording.url", "recordingUrlSigned", "media.recordingURL"]);
    if (!recordingUrl) return "";
    const safeUrl = escapeHtml(recordingUrl);
    return `
      <div class="recording-card">
        <div class="section-title"><i class="ti ti-player-play"></i> Recording</div>
        <audio controls preload="none" src="${safeUrl}"></audio>
        <a class="recording-link" href="${safeUrl}" target="_blank" rel="noopener">Open recording in new tab</a>
      </div>
    `;
  }

  function renderDetail(payload) {
    const body = $("detailBody");
    if (!body) return;
    const detail = payload?.detail || payload || {};
    const root = [detail.object, detail.record, detail.workitem]
      .find((item) => item && typeof item === "object" && !Array.isArray(item)) || detail;
    const info = {
      id: root.workitemId || root._id || root.id || "",
      from: root.from || "",
      to: root.to || ""
    };
    const entries = Object.entries(info);
    body.innerHTML = Object.entries(root).length
      ? renderRecording(root) + entries.map(([key, value]) => renderValue(value, key)).join("")
      : '<div class="empty">No detail returned.</div>';
  }

  function buildHistoryUrl() {
    const url = apiBase("/api/workitem-history");
    const selectedRange = $("rangeType")?.value === "custom" ? "thisMonth" : ($("rangeType")?.value || "today");
    const dispositionId = $("dispositionId")?.value || "";
    url.searchParams.set("rows", $("rows")?.value || "100");
    url.searchParams.set("start", $("start")?.value || "0");
    url.searchParams.set("q", $("q")?.value || "");
    url.searchParams.set("maxHeight", "500px");
    const from = dateInputToTimestamp($("rangeFromDate")?.value || "", false);
    const to = dateInputToTimestamp($("rangeToDate")?.value || "", true);
    url.searchParams.set("rangeType", selectedRange);
    if (from) url.searchParams.set("rangeFrom", from);
    if (to) url.searchParams.set("rangeTo", to);
    if (dispositionId) url.searchParams.set("dispositionId", dispositionId);
    params.getAll("campaignId").forEach((value) => {
      String(value || "").split(",").forEach((id) => {
        const normalized = id.trim();
        if (normalized) url.searchParams.append("campaignId", normalized);
      });
    });
    return url;
  }

  function extractDispositions(payload) {
    const root = payload?.dispositions || payload?.data || payload || {};
    const candidates = [
      root.objects,
      root.records,
      root.items,
      root.data,
      root.rows,
      root.results,
      Array.isArray(root) ? root : null
    ];
    for (const item of candidates) {
      if (Array.isArray(item)) return item;
    }
    return [];
  }

  function dispositionIdOf(item) {
    return String(item?._id || item?.id || item?.dispositionId || "").trim();
  }

  function dispositionNameOf(item) {
    return String(item?.name || item?.displayName || item?.label || dispositionIdOf(item)).trim();
  }

  async function loadDispositions() {
    const select = $("dispositionId");
    if (!select) return;
    select.disabled = true;
    select.innerHTML = '<option value="">All</option>';
    try {
      const response = await fetch(apiBase("/api/workitem-dispositions"));
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Disposition request failed.");
      const dispositions = extractDispositions(payload)
        .map((item) => ({ id: dispositionIdOf(item), name: dispositionNameOf(item) }))
        .filter((item) => item.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const disposition of dispositions) {
        const option = document.createElement("option");
        option.value = disposition.id;
        option.textContent = disposition.name;
        select.appendChild(option);
      }
      const requested = params.get("dispositionId") || "";
      if (requested && dispositions.some((item) => item.id === requested)) select.value = requested;
    } catch (error) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Unable to load dispositions";
      select.appendChild(option);
      setStatus(error.message, "error");
    } finally {
      select.disabled = false;
    }
  }

  async function loadHistory() {
    const button = $("loadBtn");
    if (button) button.disabled = true;
    setStatus("Loading workitem history...");
    try {
      const response = await fetch(buildHistoryUrl());
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "History request failed.");
      state.records = extractRecords(payload);
      renderRows(state.records);
      setStatus("History loaded.");
    } catch (error) {
      renderRows([]);
      setStatus(error.message, "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function loadDetail(id) {
    if (!id) {
      setStatus("Selected row has no workitem id.", "error");
      return;
    }
    state.selectedId = id;
    $("selectedId").textContent = short(id, 42);
    renderRows(state.records);
    $("detailBody").innerHTML = '<div class="empty">Loading detail...</div>';
    setStatus("Loading workitem detail...");
    try {
      const url = apiBase("/api/workitem-history/" + encodeURIComponent(id));
      url.searchParams.set("rangeType", $("rangeType")?.value === "custom" ? "thisMonth" : ($("rangeType")?.value || "today"));
      const response = await fetch(url);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Detail request failed.");
      renderDetail(payload);
      setStatus("Detail loaded.");
    } catch (error) {
      $("detailBody").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
      setStatus(error.message, "error");
    }
  }

  function init() {
    const subtitle = $("subtitle");
    if (subtitle) subtitle.textContent = [state.campaign && "Campaign: " + state.campaign, state.domain && "Domain: " + state.domain].filter(Boolean).join(" | ") || "No campaign selected";
    if (params.get("rangeType") && $("rangeType")) $("rangeType").value = params.get("rangeType") === "custom" ? "thisMonth" : params.get("rangeType");
    if (params.get("rangeFrom") && $("rangeFromDate")) $("rangeFromDate").value = timestampToDateInput(params.get("rangeFrom"));
    if (params.get("rangeTo") && $("rangeToDate")) $("rangeToDate").value = timestampToDateInput(params.get("rangeTo"));
    if (params.get("dispositionId") && $("dispositionId")) $("dispositionId").value = params.get("dispositionId");
    $("filters")?.addEventListener("submit", (event) => {
      event.preventDefault();
      loadHistory();
    });
    $("q")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        loadHistory();
      }
    });
    loadDispositions().finally(loadHistory);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
