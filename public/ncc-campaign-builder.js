"use strict";

const params = new URLSearchParams(window.location.search);
const appBase = new URL(".", window.location.href);
const STORAGE_KEY = "ncc_campaign_builder_session";
const initialDomain = params.get("domain") || "astonvilla.thrio.io";
let currentToken = params.get("token") || "";

const sessionBadge = document.getElementById("sessionBadge");
const loginForm = document.getElementById("loginForm");
const loginDomain = document.getElementById("loginDomain");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const builderGrid = document.getElementById("builderGrid");
const form = document.getElementById("builderForm");
const domainInput = document.getElementById("domain");
const campaignType = document.getElementById("campaignType");
const inboundField = document.getElementById("inboundField");
const outboundField = document.getElementById("outboundField");
const inboundAddress = document.getElementById("inboundAddress");
const submitBtn = document.getElementById("submitBtn");
const reloadNumbersBtn = document.getElementById("reloadNumbersBtn");
const logoutBtn = document.getElementById("logoutBtn");
const stepList = document.getElementById("stepList");
const resultLog = document.getElementById("resultLog");

domainInput.value = initialDomain;
loginDomain.value = initialDomain;

try {
  const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "{}");
  if (!currentToken && saved.token) currentToken = saved.token;
  if (saved.domain && !params.get("domain")) {
    domainInput.value = saved.domain;
    loginDomain.value = saved.domain;
  }
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
        domain: loginDomain.value.trim() || initialDomain,
        username: loginUsername.value.trim(),
        password: loginPassword.value
      })
    });
    currentToken = data.token || "";
    domainInput.value = loginDomain.value.trim() || initialDomain;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: currentToken, domain: domainInput.value }));
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
    token: currentToken,
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
loginForm.addEventListener("submit", login);
logoutBtn.addEventListener("click", () => {
  currentToken = "";
  window.sessionStorage.removeItem(STORAGE_KEY);
  setBadge("", "Sign in required");
  builderGrid.classList.add("hidden");
  loginForm.classList.remove("hidden");
  showLog("Signed out.");
});
domainInput.addEventListener("change", validateSession);

updateTypeUi();
validateSession();
