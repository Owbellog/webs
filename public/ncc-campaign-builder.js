"use strict";

const params = new URLSearchParams(window.location.search);
const appBase = new URL(".", window.location.href);
const STORAGE_KEY = "ncc_campaign_builder_session";
const initialDomain = params.get("domain") || "";
let currentToken = params.get("token") || "";
let currentDomain = initialDomain;

const sessionBadge = document.getElementById("sessionBadge");
const loginForm = document.getElementById("loginForm");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const builderGrid = document.getElementById("builderGrid");
const form = document.getElementById("builderForm");
const domainInput = document.getElementById("domain");
const domainLabel = document.getElementById("domainLabel");
const campaignType = document.getElementById("campaignType");
const inboundField = document.getElementById("inboundField");
const outboundField = document.getElementById("outboundField");
const inboundOnlyFields = Array.from(document.querySelectorAll(".inbound-only"));
const inboundAddress = document.getElementById("inboundAddress");
const submitBtn = document.getElementById("submitBtn");
const prevStepBtn = document.getElementById("prevStepBtn");
const nextStepBtn = document.getElementById("nextStepBtn");
const reloadNumbersBtn = document.getElementById("reloadNumbersBtn");
const logoutBtn = document.getElementById("logoutBtn");
const wizardStepper = document.getElementById("wizardStepper");
const reviewLog = document.getElementById("reviewLog");
const stepList = document.getElementById("stepList");
const resultLog = document.getElementById("resultLog");

const wizardSteps = [
  "Campaign",
  "Phone",
  "Workflow",
  "Hours",
  "Messages",
  "Review"
];
let activeStep = 0;

domainInput.value = currentDomain;
domainLabel.textContent = currentDomain || "Detected after login";

try {
  const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "{}");
  if (!currentToken && saved.token) currentToken = saved.token;
  if (saved.domain && !params.get("domain")) currentDomain = saved.domain;
  domainInput.value = currentDomain;
  domainLabel.textContent = currentDomain || "Detected after login";
} catch {
  window.sessionStorage.removeItem(STORAGE_KEY);
}

function decodeJwt(tokenValue) {
  try {
    const parts = String(tokenValue || "").split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function tokenSummary() {
  const payload = decodeJwt(currentToken);
  const preview = currentToken
    ? `${currentToken.slice(0, 36)}...${currentToken.slice(-18)}`
    : "";
  if (!payload) return { validJwt: false };
  const now = Math.floor(Date.now() / 1000);
  return {
    validJwt: true,
    length: currentToken.length,
    preview,
    username: payload.username || payload.sub || "",
    userId: payload.userId || "",
    tenantId: payload.tenantId || "",
    expiresAt: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : "",
    expired: payload.exp ? now >= payload.exp : false
  };
}

function buildApi(path) {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(cleanPath, appBase);
  url.searchParams.set("token", currentToken);
  if (currentDomain || domainInput.value.trim()) {
    url.searchParams.set("domain", currentDomain || domainInput.value.trim());
  }
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
    const raw = data.raw ? ` ${String(data.raw).slice(0, 300)}` : "";
    throw new Error(`[${response.status}] ${data.error || "Request failed."}${details}${raw}`);
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
  if (!currentToken) {
    setBadge("", "Sign in required");
    loginForm.classList.remove("hidden");
    builderGrid.classList.add("hidden");
    showLog("Sign in to start.");
    return;
  }
  const summary = tokenSummary();
  if (summary.validJwt && summary.expired) {
    setBadge("err", "Token expired");
    submitBtn.disabled = true;
    showLog({ error: "The token in the URL is expired.", token: summary });
    return;
  }
  try {
    showLog({ message: "Validating NCC session with URL token.", token: tokenSummary() });
    const data = await request("/api/ncc-builder/session");
    setDetectedDomain(data.domain || currentDomain);
    setBadge("ok", `${data.user?.name || "Admin"} · ${data.profile?.name || "Administrator"}`);
    loginForm.classList.add("hidden");
    builderGrid.classList.remove("hidden");
    showLog({ session: data });
    await loadInboundNumbers();
  } catch (error) {
    setBadge("err", "Not authorized");
    loginForm.classList.remove("hidden");
    builderGrid.classList.add("hidden");
    submitBtn.disabled = true;
    showLog(error.message);
  }
}

async function login(event) {
  event.preventDefault();
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";
  setBadge("", "Signing in…");
  showLog("Signing in with NCC credentials…");
  try {
    const data = await request("/api/ncc-builder/login", {
      method: "POST",
      body: JSON.stringify({
        username: loginUsername.value.trim(),
        password: loginPassword.value
      })
    });
    currentToken = data.token || "";
    setDetectedDomain(data.domain || "");
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: currentToken, domain: currentDomain }));
    loginPassword.value = "";
    submitBtn.disabled = false;
    setBadge("ok", `${data.user?.name || "Admin"} · ${data.profile?.name || "Administrator"}`);
    loginForm.classList.add("hidden");
    builderGrid.classList.remove("hidden");
    showLog({ login: data });
    await loadInboundNumbers();
  } catch (error) {
    setBadge("err", "Login failed");
    showLog(error.message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in";
  }
}

function setDetectedDomain(domain) {
  currentDomain = String(domain || currentDomain || "").trim();
  domainInput.value = currentDomain;
  domainLabel.textContent = currentDomain || "Detected after login";
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
  inboundOnlyFields.forEach((field) => field.classList.toggle("hidden", !inbound));
}

function readForm() {
  const campaignName = document.getElementById("campaignName").value.trim();
  return {
    token: currentToken,
    domain: currentDomain || domainInput.value.trim(),
    campaignName,
    campaignType: campaignType.value,
    inboundAddress: inboundAddress.value,
    outboundCallerId: document.getElementById("outboundCallerId").value.trim(),
    queueName: document.getElementById("queueName").value.trim() || `${campaignName} queue`,
    queueAssignmentType: document.getElementById("queueAssignmentType").value,
    queueBlended: document.getElementById("queueBlended").checked,
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

function renderWizard() {
  wizardStepper.innerHTML = wizardSteps.map((name, index) => (
    `<div class="step-pill ${index === activeStep ? "active" : ""}">${index + 1}. ${escapeHtml(name)}</div>`
  )).join("");
  document.querySelectorAll(".wizard-step").forEach((section) => {
    section.classList.toggle("active", Number(section.dataset.step) === activeStep);
  });
  prevStepBtn.disabled = activeStep === 0;
  nextStepBtn.classList.toggle("hidden", activeStep === wizardSteps.length - 1);
  submitBtn.classList.toggle("hidden", activeStep !== wizardSteps.length - 1);
  reloadNumbersBtn.classList.toggle("hidden", activeStep !== 1);
  if (activeStep === wizardSteps.length - 1) showReview();
}

function showReview() {
  const data = readForm();
  const review = {
    domain: data.domain || "not detected",
    campaignName: data.campaignName,
    campaignType: data.campaignType,
    phone: data.campaignType === "inbound" ? data.inboundAddress : data.outboundCallerId,
    queue: data.campaignType === "inbound" ? {
      name: data.queueName,
      assignmentType: data.queueAssignmentType,
      blended: data.queueBlended
    } : "not used for outbound",
    workflowName: data.workflowName,
    scheduleName: data.scheduleName,
    businessEventName: data.businessEventName,
    hours: `${data.startTime} - ${data.endTime}`,
    days: data.days,
    outOfHoursPrompt: data.outOfHoursMessage ? "will be created and added to OUT OF HOURS" : "missing",
    inHoursMessage: data.inHoursMessage ? "captured in log" : "empty"
  };
  reviewLog.textContent = JSON.stringify(review, null, 2);
}

function validateStep() {
  const data = readForm();
  if (activeStep === 0 && !data.campaignName) return "Campaign name is required.";
  if (activeStep === 1 && data.campaignType === "inbound" && !data.inboundAddress) return "Select an inbound phone.";
  if (activeStep === 1 && data.campaignType === "inbound" && !data.queueName) return "Queue name is required.";
  if (activeStep === 1 && data.campaignType === "outbound" && !data.outboundCallerId) return "Enter an outbound caller ID.";
  if (activeStep === 3 && (!data.startTime || !data.endTime || !data.days.length)) return "Select business hours and at least one day.";
  if (activeStep === 4 && !data.outOfHoursMessage) return "Out-of-hours message is required to create the prompt.";
  return "";
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
loginForm.addEventListener("submit", login);
logoutBtn.addEventListener("click", () => {
  currentToken = "";
  currentDomain = "";
  window.sessionStorage.removeItem(STORAGE_KEY);
  setBadge("", "Sign in required");
  builderGrid.classList.add("hidden");
  loginForm.classList.remove("hidden");
  domainInput.value = "";
  domainLabel.textContent = "Detected after login";
  showLog("Signed out.");
});
prevStepBtn.addEventListener("click", () => {
  activeStep = Math.max(0, activeStep - 1);
  renderWizard();
});
nextStepBtn.addEventListener("click", () => {
  const error = validateStep();
  if (error) {
    showLog(error);
    return;
  }
  activeStep = Math.min(wizardSteps.length - 1, activeStep + 1);
  renderWizard();
});

updateTypeUi();
renderWizard();
validateSession();
