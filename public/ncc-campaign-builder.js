"use strict";

const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";
const initialDomain = params.get("domain") || "astonvilla.thrio.io";

const sessionBadge = document.getElementById("sessionBadge");
const form = document.getElementById("builderForm");
const domainInput = document.getElementById("domain");
const campaignType = document.getElementById("campaignType");
const inboundField = document.getElementById("inboundField");
const outboundField = document.getElementById("outboundField");
const inboundAddress = document.getElementById("inboundAddress");
const submitBtn = document.getElementById("submitBtn");
const reloadNumbersBtn = document.getElementById("reloadNumbersBtn");
const stepList = document.getElementById("stepList");
const resultLog = document.getElementById("resultLog");

domainInput.value = initialDomain;

function buildApi(path) {
  const url = new URL(path, window.location.href);
  url.searchParams.set("token", token);
  url.searchParams.set("domain", domainInput.value.trim() || initialDomain);
  return url.toString();
}

async function request(path, options = {}) {
  const response = await fetch(buildApi(path), {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    const details = data.details ? ` ${JSON.stringify(data.details)}` : "";
    throw new Error(`${data.error || "Request failed."}${details}`);
  }
  return data;
}

function setBadge(kind, text) {
  sessionBadge.className = `badge ${kind || ""}`.trim();
  sessionBadge.textContent = text;
}

function renderSteps(steps = []) {
  stepList.innerHTML = steps.map((step) => `
    <div class="step ${step.ok ? "ok" : "err"}">
      <span>${escapeHtml(step.name || "step")}</span>
      <span>${escapeHtml(String(step.status || ""))}</span>
    </div>
  `).join("");
}

function showLog(data) {
  resultLog.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getId(item) {
  return item?._id || item?.pstnnumberId || item?.id || item?.name || "";
}

function getPhoneValue(item) {
  return item?.name || item?.number || item?.phoneNumber?.number || getId(item);
}

function getPhoneLabel(item) {
  const phone = getPhoneValue(item);
  const description = item?.description || item?.provider || "";
  return description ? `${phone} — ${description}` : phone;
}

async function validateSession() {
  if (!token) {
    setBadge("err", "Missing token");
    form.querySelectorAll("input,select,textarea,button").forEach((el) => { el.disabled = true; });
    showLog("Open this widget with ?token=<NCC token>&domain=astonvilla.thrio.io");
    return;
  }
  try {
    const data = await request("/api/ncc-builder/session");
    setBadge("ok", `${data.user?.name || "Admin"} · ${data.profile?.name || "Administrator"}`);
    showLog({ session: data });
    await loadInboundNumbers();
  } catch (error) {
    setBadge("err", "Not authorized");
    submitBtn.disabled = true;
    showLog(error.message);
  }
}

async function loadInboundNumbers() {
  inboundAddress.innerHTML = `<option value="">Loading numbers…</option>`;
  try {
    const data = await request("/api/ncc-builder/pstn-unused");
    const numbers = Array.isArray(data.objects) ? data.objects : [];
    if (!numbers.length) {
      inboundAddress.innerHTML = `<option value="">No unused numbers found</option>`;
      return;
    }
    inboundAddress.innerHTML = `<option value="">Select a phone</option>` + numbers.map((item) => {
      const value = getPhoneValue(item);
      return `<option value="${escapeHtml(value)}">${escapeHtml(getPhoneLabel(item))}</option>`;
    }).join("");
  } catch (error) {
    inboundAddress.innerHTML = `<option value="">Error loading numbers</option>`;
    showLog(error.message);
  }
}

function updateTypeUi() {
  const inbound = campaignType.value === "inbound";
  inboundField.classList.toggle("hidden", !inbound);
  outboundField.classList.toggle("hidden", inbound);
}

function readForm() {
  const campaignName = document.getElementById("campaignName").value.trim();
  return {
    token,
    domain: domainInput.value.trim() || initialDomain,
    campaignName,
    campaignType: campaignType.value,
    inboundAddress: inboundAddress.value,
    outboundCallerId: document.getElementById("outboundCallerId").value.trim(),
    workflowName: document.getElementById("workflowName").value.trim() || `${campaignName} workflow`,
    scheduleName: document.getElementById("scheduleName").value.trim() || `${campaignName} schedule`,
    businessEventName: document.getElementById("businessEventName").value.trim() || `${campaignName} schedule`,
    startTime: document.getElementById("startTime").value,
    endTime: document.getElementById("endTime").value,
    days: Array.from(document.querySelectorAll("#days input:checked")).map((input) => input.value),
    inHoursMessage: document.getElementById("inHoursMessage").value.trim(),
    outOfHoursMessage: document.getElementById("outOfHoursMessage").value.trim()
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating…";
  renderSteps([]);
  showLog("Creating NCC campaign…");
  try {
    const data = await request("/api/ncc-builder/create", {
      method: "POST",
      body: JSON.stringify(readForm())
    });
    renderSteps(data.steps || []);
    showLog(data);
  } catch (error) {
    showLog(error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Create NCC campaign";
  }
});

campaignType.addEventListener("change", updateTypeUi);
reloadNumbersBtn.addEventListener("click", loadInboundNumbers);
domainInput.addEventListener("change", validateSession);

updateTypeUi();
validateSession();
