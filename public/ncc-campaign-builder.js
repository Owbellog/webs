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
const toolMenu = document.getElementById("toolMenu");
const builderViewBtn = document.getElementById("builderViewBtn");
const surveyViewBtn = document.getElementById("surveyViewBtn");
const surveyDesignerViewBtn = document.getElementById("surveyDesignerViewBtn");
const adminAccountsViewBtn = document.getElementById("adminAccountsViewBtn");
const userReportsViewBtn = document.getElementById("userReportsViewBtn");
const surveyGrid = document.getElementById("surveyGrid");
const surveyDesignerGrid = document.getElementById("surveyDesignerGrid");
const adminAccountsGrid = document.getElementById("adminAccountsGrid");
const userReportsGrid = document.getElementById("userReportsGrid");
const form = document.getElementById("builderForm");
const domainInput = document.getElementById("domain");
const domainLabel = document.getElementById("domainLabel");
const campaignType = document.getElementById("campaignType");
const recordCalls = document.getElementById("recordCalls");
const recordCallsHint = document.getElementById("recordCallsHint");
const enableRealtimeTranscription = document.getElementById("enableRealtimeTranscription");
const transcriptionHint = document.getElementById("transcriptionHint");
const recordingEventsTranscriptionRow = document.getElementById("recordingEventsTranscriptionRow");
const recordingEventsTranscription = document.getElementById("recordingEventsTranscription");
const recordingEventsTranscriptionHint = document.getElementById("recordingEventsTranscriptionHint");
const recordingAnalysisServiceId = document.getElementById("recordingAnalysisServiceId");
const generativeAIServiceId = document.getElementById("generativeAIServiceId");
const realtimeAnalysisServiceId = document.getElementById("realtimeAnalysisServiceId");
const knowledgeBaseServiceId = document.getElementById("knowledgeBaseServiceId");
const inboundField = document.getElementById("inboundField");
const outboundField = document.getElementById("outboundField");
const inboundOnlyFields = Array.from(document.querySelectorAll(".inbound-only"));
const inboundAddress = document.getElementById("inboundAddress");
const newQueueName = document.getElementById("newQueueName");
const newQueueAssignmentType = document.getElementById("newQueueAssignmentType");
const addQueueBtn = document.getElementById("addQueueBtn");
const queueList = document.getElementById("queueList");
const queueSummary = document.getElementById("queueSummary");
const submitBtn = document.getElementById("submitBtn");
const prevStepBtn = document.getElementById("prevStepBtn");
const nextStepBtn = document.getElementById("nextStepBtn");
const reloadNumbersBtn = document.getElementById("reloadNumbersBtn");
const reloadSupervisorsBtn = document.getElementById("reloadSupervisorsBtn");
const logoutBtn = document.getElementById("logoutBtn");
const wizardStepper = document.getElementById("wizardStepper");
const reviewLog = document.getElementById("reviewLog");
const stepList = document.getElementById("stepList");
const resultLog = document.getElementById("resultLog");
const surveyDomainLabel = document.getElementById("surveyDomainLabel");
const surveySelect = document.getElementById("surveySelect");
const campaignSurveySearch = document.getElementById("campaignSurveySearch");
const reloadSurveyCampaignsBtn = document.getElementById("reloadSurveyCampaignsBtn");
const campaignSurveyList = document.getElementById("campaignSurveyList");
const surveySelectionSummary = document.getElementById("surveySelectionSummary");
const surveySaveSummary = document.getElementById("surveySaveSummary");
const saveSurveyCampaignsBtn = document.getElementById("saveSurveyCampaignsBtn");
const cancelSurveyBtn = document.getElementById("cancelSurveyBtn");
const surveyStepList = document.getElementById("surveyStepList");
const surveyResultLog = document.getElementById("surveyResultLog");
const surveyDesignerName = document.getElementById("surveyDesignerName");
const surveyDesignerAudience = document.getElementById("surveyDesignerAudience");
const surveyDesignerStory = document.getElementById("surveyDesignerStory");
const surveyDesignerIntegrations = document.getElementById("surveyDesignerIntegrations");
const surveyDesignerPrimaryId = document.getElementById("surveyDesignerPrimaryId");
const surveyDesignerContactMode = document.getElementById("surveyDesignerContactMode");
const surveyFieldFile = document.getElementById("surveyFieldFile");
const downloadSurveyFieldTemplateBtn = document.getElementById("downloadSurveyFieldTemplateBtn");
const clearSurveyFieldsBtn = document.getElementById("clearSurveyFieldsBtn");
const manualSurveyFieldLabel = document.getElementById("manualSurveyFieldLabel");
const manualSurveyFieldMapping = document.getElementById("manualSurveyFieldMapping");
const manualSurveyFieldType = document.getElementById("manualSurveyFieldType");
const addSurveyFieldBtn = document.getElementById("addSurveyFieldBtn");
const surveyFieldList = document.getElementById("surveyFieldList");
const generateSurveyDesignBtn = document.getElementById("generateSurveyDesignBtn");
const generateSurveyWithAiBtn = document.getElementById("generateSurveyWithAiBtn");
const createSurveyInNccBtn = document.getElementById("createSurveyInNccBtn");
const copySurveyJsonBtn = document.getElementById("copySurveyJsonBtn");
const downloadSurveyJsonBtn = document.getElementById("downloadSurveyJsonBtn");
const surveyDesignerSummary = document.getElementById("surveyDesignerSummary");
const surveyDesignerAnalysis = document.getElementById("surveyDesignerAnalysis");
const surveyDesignerJsonLog = document.getElementById("surveyDesignerJsonLog");
const supervisorList = document.getElementById("supervisorList");
const newDispositionName = document.getElementById("newDispositionName");
const newDispositionAction = document.getElementById("newDispositionAction");
const addDispositionBtn = document.getElementById("addDispositionBtn");
const dispositionList = document.getElementById("dispositionList");
const dispositionSummary = document.getElementById("dispositionSummary");
const adminTenant = document.getElementById("adminTenant");
const adminCluster = document.getElementById("adminCluster");
const adminTimezone = document.getElementById("adminTimezone");
const adminUsername = document.getElementById("adminUsername");
const adminPassword = document.getElementById("adminPassword");
const saveAdminAccountBtn = document.getElementById("saveAdminAccountBtn");
const reloadAdminAccountsBtn = document.getElementById("reloadAdminAccountsBtn");
const adminAccountList = document.getElementById("adminAccountList");
const adminAccountsSummary = document.getElementById("adminAccountsSummary");
const adminAccountLog = document.getElementById("adminAccountLog");
const tenantReportAccount = document.getElementById("tenantReportAccount");
const tenantReportId = document.getElementById("tenantReportId");
const saveTenantReportBtn = document.getElementById("saveTenantReportBtn");
const tenantReportList = document.getElementById("tenantReportList");
const tenantReportSummary = document.getElementById("tenantReportSummary");
const reportStartDate = document.getElementById("reportStartDate");
const reportEndDate = document.getElementById("reportEndDate");
const runUserReportsBtn = document.getElementById("runUserReportsBtn");
const exportUserReportsBtn = document.getElementById("exportUserReportsBtn");
const reportAccountList = document.getElementById("reportAccountList");
const reportAccountSummary = document.getElementById("reportAccountSummary");
const userReportSummary = document.getElementById("userReportSummary");
const userReportResults = document.getElementById("userReportResults");
const userReportStepList = document.getElementById("userReportStepList");
const userReportLog = document.getElementById("userReportLog");

const DISPOSITION_ACTION_OPTIONS = [
  { label: "No action", value: "" },
  { label: "Do Not Call - TenantDNC", value: "TenantDNC" },
  { label: "Answering Machine - answeringMachine", value: "answeringMachine" },
  { label: "Callback - connectedCallback", value: "connectedCallback" },
  { label: "Fax Machine - fax", value: "fax" },
  { label: "Invalid Number - invalidNumber", value: "invalidNumber" },
  { label: "No Answer - noAnswer", value: "noAnswer" },
  { label: "Personal Callback - connectedPersonalCallback", value: "connectedPersonalCallback" },
  { label: "Remove From List - connectedHandled", value: "connectedHandled" }
];

const DISPOSITION_WORKITEM_TYPES = [
  "Chat",
  "Email",
  "InboundCall",
  "InboundFax",
  "InboundSMS",
  "OutboundCall",
  "OutboundEmail",
  "OutboundFax",
  "OutboundSMS",
  "PredictiveSMS",
  "ProgressiveCall",
  "PredictiveCall"
];

const QUEUE_ASSIGNMENT_OPTIONS = [
  { label: "First In First Out Across All Queues", value: "fifo_across_all_queues" },
  { label: "First In First Out by Status", value: "fifo_by_status" },
  { label: "First In First Out Per Queue", value: "fifo_per_queue" },
  { label: "Last In First Out Across All Queues", value: "lifo_across_all_queues" },
  { label: "Last In First Out by Status", value: "lifo_by_status" },
  { label: "Last In First Out Per Queue", value: "lifo_per_queue" }
];

const SURVEY_FIELD_TYPES = ["input", "textarea", "select", "boolean"];
const SURVEY_FIELD_TEMPLATE = [
  "field_name,fieldmapping_name,field_type",
  "Customer ID,customer_id,input",
  "Reason for Contact,reason_for_contact,select",
  "Issue Description,issue_description,textarea",
  "Escalation Required,escalation_required,boolean"
].join("\n");

const wizardSteps = [
  "Campaign",
  "Phone",
  "Workflow",
  "Hours",
  "Messages",
  "Dispositions",
  "Review"
];
let activeStep = 0;
const completedSteps = new Set();
let currentToolView = "builder";
let surveyCampaigns = [];
let surveysLoaded = false;
let campaignsLoaded = false;
let transcriptionServicesLoaded = false;
let generativeAIServicesLoaded = false;
let realtimeAnalysisServicesLoaded = false;
let knowledgeBaseServicesLoaded = false;
let adminAccountsLoaded = false;
let adminAccounts = [];
let userReportRows = [];
let currentSurveyDesign = null;
let surveyDesignerFields = [];

domainInput.value = currentDomain;
domainLabel.textContent = currentDomain || "Detected after login";
surveyDomainLabel.textContent = currentDomain || "Detected after login";

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
  if (currentDomain || domainInput.value.trim()) {
    url.searchParams.set("domain", currentDomain || domainInput.value.trim());
  }
  return url.toString();
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (currentToken) headers["x-ncc-token"] = currentToken;
  const response = await fetch(buildApi(path), {
    ...options,
    credentials: "include",
    headers
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

function renderSurveySteps(steps = []) {
  surveyStepList.innerHTML = steps.map((step) => `
    <div class="step ${step.ok ? "ok" : "err"}">
      <span>${escapeHtml(step.name || "step")}</span>
      <span>${escapeHtml(String(step.status || ""))}</span>
    </div>
  `).join("");
}

function showLog(data) {
  resultLog.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

function showSurveyLog(data) {
  surveyResultLog.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
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

function setToolView(view) {
  currentToolView = ["survey", "surveyDesigner", "adminAccounts", "userReports"].includes(view) ? view : "builder";
  builderGrid.classList.toggle("hidden", currentToolView !== "builder");
  surveyGrid.classList.toggle("hidden", currentToolView !== "survey");
  surveyDesignerGrid.classList.toggle("hidden", currentToolView !== "surveyDesigner");
  adminAccountsGrid.classList.toggle("hidden", currentToolView !== "adminAccounts");
  userReportsGrid.classList.toggle("hidden", currentToolView !== "userReports");
  builderViewBtn.classList.toggle("active", currentToolView === "builder");
  surveyViewBtn.classList.toggle("active", currentToolView === "survey");
  surveyDesignerViewBtn.classList.toggle("active", currentToolView === "surveyDesigner");
  adminAccountsViewBtn.classList.toggle("active", currentToolView === "adminAccounts");
  userReportsViewBtn.classList.toggle("active", currentToolView === "userReports");
  if (currentToolView === "survey") loadSurveyCampaignTool();
  if (currentToolView === "adminAccounts") loadAdminAccounts();
  if (currentToolView === "userReports") loadUserReportsTool();
}

function nccItemId(item, suffix = "") {
  return item?._id || (suffix ? item?.[`${suffix}Id`] : "") || item?.id || "";
}

function nccItemName(item) {
  return item?.localizations?.name?.en?.value || item?.name || item?.label || item?.description || nccItemId(item);
}

function readSelectedSurveyCampaignIds() {
  return Array.from(campaignSurveyList.querySelectorAll("[data-survey-campaign-id]:checked"))
    .map((input) => input.dataset.surveyCampaignId || "")
    .filter(Boolean);
}

function renderSurveyOptions(surveys = []) {
  if (!surveys.length) {
    surveySelect.innerHTML = `<option value="">No surveys found</option>`;
    return;
  }
  surveySelect.innerHTML = `<option value="">Select a survey</option>` + surveys.map((survey) => {
    const id = nccItemId(survey, "survey");
    return `<option value="${escapeHtml(id)}">${escapeHtml(nccItemName(survey))} - ${escapeHtml(id)}</option>`;
  }).join("");
}

function campaignHasSurvey(campaign) {
  return Boolean(campaign?.surveyId || campaign?.survey?._id || campaign?.survey?.surveyId);
}

function renderSurveyCampaigns() {
  const query = campaignSurveySearch.value.trim().toLowerCase();
  const filtered = surveyCampaigns.filter((campaign) => {
    if (!query) return true;
    return `${nccItemName(campaign)} ${nccItemId(campaign, "campaign")}`.toLowerCase().includes(query);
  });
  if (!filtered.length) {
    campaignSurveyList.innerHTML = `<div class="hint">No campaigns match the current filter.</div>`;
    updateSurveySaveSummary();
    return;
  }
  campaignSurveyList.innerHTML = filtered.map((campaign) => {
    const id = nccItemId(campaign, "campaign");
    const hasSurvey = campaignHasSurvey(campaign);
    return `
      <label class="campaign-survey-row">
        <input type="checkbox" data-survey-campaign-id="${escapeHtml(id)}" data-has-survey="${hasSurvey ? "true" : "false"}" />
        <span>
          <span class="campaign-survey-name">${escapeHtml(nccItemName(campaign))}</span>
          <span class="campaign-survey-id">${escapeHtml(id)}</span>
        </span>
        <span class="survey-status ${hasSurvey ? "on" : ""}">${hasSurvey ? "Has survey" : "No survey"}</span>
      </label>
    `;
  }).join("");
  updateSurveySaveSummary();
}

function updateSurveySaveSummary() {
  const selected = readSelectedSurveyCampaignIds();
  const surveyId = surveySelect.value;
  surveySelectionSummary.textContent = `${selected.length} selected of ${campaignSurveyList.querySelectorAll("[data-survey-campaign-id]").length} campaigns loaded`;
  surveySaveSummary.textContent = surveyId && selected.length
    ? `Save will PATCH ${selected.length} campaign${selected.length === 1 ? "" : "s"} with surveyId ${surveyId}.`
    : "Select a survey and at least one campaign.";
}

async function loadSurveys() {
  surveySelect.innerHTML = `<option value="">Loading surveys...</option>`;
  const data = await request("/api/ncc-builder/surveys");
  renderSurveyOptions(data.objects || []);
  surveysLoaded = true;
}

async function loadSurveyCampaigns() {
  campaignSurveyList.innerHTML = `<div class="hint">Loading campaigns...</div>`;
  const data = await request("/api/ncc-builder/campaigns");
  surveyCampaigns = Array.isArray(data.objects) ? data.objects : [];
  campaignsLoaded = true;
  renderSurveyCampaigns();
}

async function loadSurveyCampaignTool() {
  if (!currentToken) return;
  try {
    if (!surveysLoaded) await loadSurveys();
    if (!campaignsLoaded) await loadSurveyCampaigns();
  } catch (error) {
    showSurveyLog(error.message);
  }
}

function surveyDesignerSelectedIntegrations() {
  return Array.from(surveyDesignerIntegrations.querySelectorAll("input:checked"))
    .map((input) => input.value)
    .filter(Boolean);
}

function resetCurrentSurveyDesign() {
  currentSurveyDesign = null;
}

function toSnakeCase(value, fallback = "field") {
  const clean = String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return clean || fallback;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const input = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if (char === "\n" && !quoted) {
      row.push(value);
      if (row.some((cell) => String(cell || "").trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some((cell) => String(cell || "").trim())) rows.push(row);
  return rows;
}

function normalizeSurveyFieldType(value) {
  const type = String(value || "input").trim().toLowerCase();
  return SURVEY_FIELD_TYPES.includes(type) ? type : "input";
}

function normalizeSurveyDesignerField(field) {
  const label = String(field.label || field.field_name || field.name || "").trim();
  const fieldname = toSnakeCase(field.fieldname || field.fieldmapping_name || field.mapping || label, "");
  const component = normalizeSurveyFieldType(field.component || field.field_type || field.type);
  if (!label || !fieldname) return null;
  return {
    label,
    fieldname,
    component,
    panel: "custom",
    mandatory: false,
    default: "",
    options: component === "select" ? ["Option 1", "Option 2"] : undefined
  };
}

function parseSurveyFieldsCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => toSnakeCase(header));
  return rows.slice(1).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = String(row[index] || "").trim();
    });
    return normalizeSurveyDesignerField(item);
  }).filter(Boolean);
}

function addSurveyDesignerFields(fields) {
  const existing = new Set(surveyDesignerFields.map((field) => field.fieldname));
  fields.forEach((field) => {
    const normalized = normalizeSurveyDesignerField(field);
    if (!normalized || existing.has(normalized.fieldname)) return;
    surveyDesignerFields.push(normalized);
    existing.add(normalized.fieldname);
  });
  resetCurrentSurveyDesign();
  renderSurveyDesignerFields();
}

function renderSurveyDesignerFields() {
  if (!surveyDesignerFields.length) {
    surveyFieldList.innerHTML = `<div class="hint">No custom survey fields added yet.</div>`;
    return;
  }
  surveyFieldList.innerHTML = surveyDesignerFields.map((field, index) => `
    <div class="campaign-survey-row">
      <span>
        <span class="campaign-survey-name">${escapeHtml(field.label)}</span>
        <span class="campaign-survey-id">${escapeHtml(field.fieldname)} · ${escapeHtml(field.component)}</span>
      </span>
      <span class="survey-status on">${escapeHtml(field.component)}</span>
      <button class="preset" type="button" data-survey-field-remove="${index}">Remove</button>
    </div>
  `).join("");
}

function downloadSurveyFieldTemplate() {
  const blob = new Blob([SURVEY_FIELD_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ncc-survey-fields-model.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function surveyElement(component, id, properties = {}, children = []) {
  const element = {
    type: component,
    component,
    properties,
    _id: id,
    show: true,
    selected: false
  };
  if (children.length) element.elements = children;
  return element;
}

function surveyPanel(id, title, children = [], layout = {}) {
  return surveyElement("panel", id, {
    label: layout.label ?? "",
    labelAlignment: "left",
    labelFontSize: "13",
    descriptionAlignment: "left",
    descriptionFontSize: "13",
    tabLabel: title,
    direction: layout.direction || "column",
    alignment: layout.alignment || "justify",
    width: layout.width || "100%",
    margin: layout.margin || "0px",
    vertical: layout.vertical || "full",
    showHeader: layout.showHeader === true,
    panelShadow: layout.panelShadow === true,
    canCollapse: false,
    state: false,
    scroll: false,
    showScrollbar: false,
    showOverlay: false,
    allowPanelInDashboard: false,
    ...(layout.panelBackgroundColor ? { panelBackgroundColor: layout.panelBackgroundColor } : {}),
    ...(layout.main === true ? { main: true } : {})
  }, children);
}

function surveyInput(id, label, fieldname, options = {}) {
  const component = options.component || "input";
  const properties = {
    label,
    fontSize: "13",
    width: "100%",
    margin: "4px 5px",
    fieldname,
    defaultValue: options.default || "",
    mandatory: options.mandatory === true,
    readOnly: options.readonly === true,
    validateOnInput: false,
    sensitiveData: false,
    saveToLocalStorage: false
  };
  if (component === "textarea") properties.height = "80px";
  if (component === "boolean") {
    properties.defaultValue = false;
    delete properties.readOnly;
    delete properties.validateOnInput;
    delete properties.sensitiveData;
    delete properties.saveToLocalStorage;
  }
  if (component === "select") {
    properties.options = (options.options || []).map((option) => ({
      label: String(option),
      value: toSnakeCase(option, String(option)).replace(/_/g, "-")
    }));
  }
  return surveyElement(component, id, properties);
}

function surveyMove(id, label, targetPanelId) {
  return surveyElement("move", id, {
    label,
    fontSize: "13",
    buttonWidth: "140px",
    buttonPadding: "10px",
    buttonMargin: "10px 5px 5px auto",
    variables: [],
    panelId: targetPanelId,
    hideApplication: false,
    sendMessageToWorkflow: false,
    properties: []
  });
}

function surveyAction(id, label, actionType, successPanelId, errorPanelId, extra = {}) {
  return surveyElement("action", id, {
    label,
    actionType,
    successPanelId,
    errorPanelId,
    ...extra
  });
}

function storyHasAny(story, terms) {
  const lower = String(story || "").toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function inferSurveyFields(story, primaryId, contactMode) {
  const fields = [
    { panel: "customer", label: "First Name", fieldname: "customer_first_name", component: "input", mandatory: true, default: "${workitem.data.firstName}" },
    { panel: "customer", label: "Last Name", fieldname: "customer_last_name", component: "input", mandatory: true, default: "${workitem.data.lastName}" }
  ];
  if (contactMode !== "none") {
    fields.push({
      panel: "customer",
      label: "Phone",
      fieldname: "customer_phone",
      component: "input",
      mandatory: contactMode === "phone" || contactMode === "phone_or_email",
      default: "${workitem.data.phone}"
    });
    fields.push({
      panel: "customer",
      label: "Email",
      fieldname: "customer_email",
      component: "input",
      mandatory: contactMode === "email",
      default: "${workitem.data.email}"
    });
  }
  const primaryField = toSnakeCase(primaryId, "account_number");
  fields.push({
    panel: "account",
    label: primaryId ? primaryId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Account Number",
    fieldname: primaryField,
    component: "input",
    mandatory: true,
    default: primaryField === "customer_id" ? "${workitem.data.customerId}" : "${workitem.data.accountNumber}"
  });
  if (storyHasAny(story, ["address", "city", "state", "zip", "property"])) {
    fields.push({ panel: "account", label: "Address", fieldname: "customer_address", component: "input", mandatory: false, default: "${workitem.data.address}" });
    fields.push({ panel: "account", label: "City", fieldname: "customer_city", component: "input", mandatory: false, default: "${workitem.data.city}" });
    fields.push({ panel: "account", label: "State", fieldname: "customer_state", component: "input", mandatory: false, default: "${workitem.data.state}" });
    fields.push({ panel: "account", label: "Zip", fieldname: "customer_zip", component: "input", mandatory: false, default: "${workitem.data.zip}" });
  }
  fields.push({
    panel: "case",
    label: "Issue Type",
    fieldname: "issue_type",
    component: "select",
    mandatory: true,
    options: ["General Inquiry", "Billing", "Technical Support", "Complaint", "Follow Up"]
  });
  fields.push({
    panel: "case",
    label: "Priority",
    fieldname: "priority",
    component: "select",
    mandatory: false,
    options: ["Low", "Normal", "High", "Urgent"]
  });
  fields.push({ panel: "details", label: "Issue Description", fieldname: "issue_description", component: "textarea", mandatory: true });
  fields.push({ panel: "details", label: "Internal Notes", fieldname: "internal_notes", component: "textarea", mandatory: false });
  if (storyHasAny(story, ["callback", "call back", "follow up", "appointment"])) {
    fields.push({ panel: "details", label: "Callback Required", fieldname: "callback_required", component: "boolean", mandatory: false });
    fields.push({ panel: "details", label: "Callback Date", fieldname: "callback_date", component: "input", mandatory: false, show: "${surveyInformation.callback_required.value} == \"true\"" });
  }
  return fields;
}

function buildSurveyDesignerOutput(config = null) {
  const story = String(config?.story ?? surveyDesignerStory.value).trim();
  const name = String(config?.name ?? surveyDesignerName.value).trim() || "NCC Generated Survey";
  const audience = String(config?.audience ?? surveyDesignerAudience.value).trim() || "NCC agents";
  const integrations = Array.isArray(config?.integrations) ? config.integrations : surveyDesignerSelectedIntegrations();
  const contactMode = config?.contactMode || surveyDesignerContactMode.value || "phone_or_email";
  const primaryId = String(config?.primaryId ?? surveyDesignerPrimaryId.value).trim() || "account_number";
  const customFields = Array.isArray(config?.fields)
    ? config.fields.map(normalizeSurveyDesignerField).filter(Boolean)
    : surveyDesignerFields;
  const inferredFields = inferSurveyFields(story, primaryId, contactMode);
  const existingFieldnames = new Set(inferredFields.map((field) => field.fieldname));
  const includedCustomFields = customFields.filter((field) => {
    if (existingFieldnames.has(field.fieldname)) return false;
    existingFieldnames.add(field.fieldname);
    return true;
  });
  const fields = inferredFields.concat(includedCustomFields);

  const fieldByPanel = fields.reduce((acc, field) => {
    acc[field.panel] = acc[field.panel] || [];
    acc[field.panel].push(field);
    return acc;
  }, {});
  const fieldElements = (panelName) => (fieldByPanel[panelName] || []).map((field) => {
    const element = surveyInput(`${field.component}_${field.fieldname}`, field.label, field.fieldname, field);
    if (field.show) element.show = field.show;
    return element;
  });

  const integrationActions = integrations.map((integration) => surveyAction(
    `action_${toSnakeCase(integration)}_lookup`,
    `Open ${integration}`,
    "integration",
    "panel_case_details",
    "panel_error",
    { integrationName: integration }
  ));
  const aiChat = integrations.includes("AI widget")
    ? [surveyElement("chat", "chat_ai_assistant", { label: "AI Assistant", context: "${workitem.data}" })]
    : [];
  const panels = [
    surveyPanel("panel_customer_info", "Customer Information", [
      ...fieldElements("customer"),
      surveyMove("btn_customer_next", "Next", "panel_account_info")
    ], { main: true, panelBackgroundColor: "#F0F2F5" }),
    surveyPanel("panel_account_info", "Account Information", [
      ...fieldElements("account"),
      surveyMove("btn_account_back", "Back", "panel_customer_info"),
      surveyMove("btn_account_next", "Next", integrations.length ? "panel_integrations" : "panel_case_details")
    ]),
    ...(integrations.length ? [surveyPanel("panel_integrations", "Integrations", [
      surveyElement("html", "html_integration_note", {
        html: "<p>Use the configured external system actions when lookup, update, or verification is required. No external API endpoint is assumed by this design.</p>"
      }),
      ...integrationActions,
      ...aiChat,
      surveyMove("btn_integrations_back", "Back", "panel_account_info"),
      surveyMove("btn_integrations_next", "Next", "panel_case_details")
    ])] : []),
    surveyPanel("panel_case_details", "Case Classification", [
      ...fieldElements("case"),
      surveyMove("btn_case_back", "Back", integrations.length ? "panel_integrations" : "panel_account_info"),
      surveyMove("btn_case_next", "Next", "panel_issue_details")
    ]),
    surveyPanel("panel_issue_details", "Issue Details", [
      ...fieldElements("details"),
      surveyMove("btn_details_back", "Back", "panel_case_details"),
      surveyMove("btn_details_next", "Next", includedCustomFields.length ? "panel_custom_fields" : "panel_confirmation")
    ]),
    ...(includedCustomFields.length ? [surveyPanel("panel_custom_fields", "Additional Fields", [
      ...fieldElements("custom"),
      surveyMove("btn_custom_fields_back", "Back", "panel_issue_details"),
      surveyMove("btn_custom_fields_next", "Next", "panel_confirmation")
    ])] : []),
    surveyPanel("panel_confirmation", "Confirmation", [
      surveyElement("html", "html_confirmation", {
        html: "<p>Review the captured information before submitting. Confirm that mandatory customer, contact, account, and issue details are accurate.</p>"
      }),
      surveyMove("btn_confirmation_back", "Back", "panel_issue_details"),
      surveyAction("btn_submit", "Submit", "submitSurvey", "panel_success", "panel_error")
    ]),
    surveyPanel("panel_success", "Success", [
      surveyElement("html", "html_success", { html: "<p>Survey submitted successfully.</p>" })
    ]),
    surveyPanel("panel_error", "Error", [
      surveyElement("html", "html_error", { html: "<p>The survey could not be submitted. Review required fields and retry.</p>" }),
      surveyMove("btn_error_back", "Back", "panel_confirmation")
    ])
  ];

  const surveyJson = {
    objectType: "survey",
    name,
    entryPanelId: "panel_customer_info",
    successPanelId: "panel_success",
    errorPanelId: "panel_error",
    components: panels
  };
  const fieldnames = fields.map((field) => field.fieldname);
  const analysis = {
    functionalAnalysis: {
      objective: story ? story.slice(0, 260) : "Capture a structured NCC agent workflow and submit a complete survey record.",
      users: {
        finalUser: "Customer or caller represented by the workitem.",
        agent: audience
      },
      flow: "Customer Information -> Account Information -> Integrations when selected -> Case Classification -> Issue Details -> Confirmation -> Submit."
    },
    surveyArchitecture: {
      panels: panels.map((panel) => panel._id),
      navigation: {
        entryPanelId: surveyJson.entryPanelId,
        successPanelId: surveyJson.successPanelId,
        errorPanelId: surveyJson.errorPanelId
      },
      fields: fieldnames
    },
    riskAmbiguities: [
      ...(integrations.length ? ["External system actions are represented as NCC action/chat components; exact API behavior must be configured in NCC or the target integration."] : ["No external integrations selected."]),
      "Business-specific picklist values may need tenant-specific refinement before import.",
      contactMode === "phone_or_email" ? "Phone is marked mandatory as the default phone-or-email guard; adjust if email should be the primary contact field." : ""
    ].filter(Boolean),
    reviewChecklist: validateSurveyJson(surveyJson)
  };
  return { analysis, surveyJson };
}

function readSurveyDesignerConfig() {
  return {
    name: surveyDesignerName.value.trim(),
    audience: surveyDesignerAudience.value.trim(),
    story: surveyDesignerStory.value.trim(),
    integrations: surveyDesignerSelectedIntegrations(),
    primaryId: surveyDesignerPrimaryId.value.trim(),
    contactMode: surveyDesignerContactMode.value || "phone_or_email",
    fields: surveyDesignerFields
  };
}

function validateSurveyJson(surveyJson) {
  const allowed = new Set(["panel", "input", "textarea", "select", "boolean", "html", "label", "action", "move", "url", "chat", "separator"]);
  const ids = [];
  const fieldnames = [];
  const panelIds = new Set();
  const moves = [];
  const visit = (item) => {
    ids.push(item._id);
    if (item.component === "panel") panelIds.add(item._id);
    if (item.properties?.fieldname) fieldnames.push(item.properties.fieldname);
    if (item.component === "move" && (item.properties?.panelId || item.properties?.targetPanelId)) {
      moves.push(item.properties.panelId || item.properties.targetPanelId);
    }
    (item.elements || item.children || []).forEach(visit);
  };
  (surveyJson.components || []).forEach(visit);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const duplicateFieldnames = fieldnames.filter((fieldname, index) => fieldnames.indexOf(fieldname) !== index);
  const invalidComponents = [];
  const collectInvalid = (item) => {
    if (!allowed.has(item.component)) invalidComponents.push(item.component);
    (item.elements || item.children || []).forEach(collectInvalid);
  };
  (surveyJson.components || []).forEach(collectInvalid);
  const invalidMoves = moves.filter((target) => !panelIds.has(target));
  return [
    duplicateIds.length ? `Duplicate IDs found: ${duplicateIds.join(", ")}` : "IDs are unique.",
    duplicateFieldnames.length ? `Duplicate fieldnames found: ${duplicateFieldnames.join(", ")}` : "Fieldnames are unique.",
    invalidComponents.length ? `Invalid components found: ${invalidComponents.join(", ")}` : "All components are NCC-compatible.",
    panelIds.has(surveyJson.entryPanelId) ? "Entry panel is valid." : "Entry panel is missing.",
    panelIds.has(surveyJson.successPanelId) ? "Success panel is valid." : "Success panel is missing.",
    panelIds.has(surveyJson.errorPanelId) ? "Error panel is valid." : "Error panel is missing.",
    invalidMoves.length ? `Invalid move targets found: ${invalidMoves.join(", ")}` : "Move navigation targets are valid.",
    "Mandatory fields are limited to name, contact, primary identifier, issue type, and issue description."
  ];
}

function renderSurveyDesignerAnalysis(output) {
  const { analysis } = output;
  const architecture = analysis.surveyArchitecture || {};
  const functional = analysis.functionalAnalysis || {};
  const users = functional.users || {};
  const panels = Array.isArray(architecture.panels) ? architecture.panels : [];
  const fields = Array.isArray(architecture.fields) ? architecture.fields : [];
  const risks = Array.isArray(analysis.riskAmbiguities) ? analysis.riskAmbiguities : [];
  const checklist = Array.isArray(analysis.reviewChecklist) ? analysis.reviewChecklist : [];
  surveyDesignerSummary.textContent = `${panels.length} panels, ${fields.length} fields, ${checklist.length} checklist items.`;
  surveyDesignerAnalysis.innerHTML = `
    <div class="campaign-survey-row">
      <span>
        <span class="campaign-survey-name">Functional Analysis</span>
        <span class="campaign-survey-id">Objective: ${escapeHtml(functional.objective || "")}</span>
        <span class="campaign-survey-id">Agent: ${escapeHtml(users.agent || "")}</span>
        <span class="campaign-survey-id">Flow: ${escapeHtml(functional.flow || "")}</span>
      </span>
      <span class="survey-status on">Ready</span>
    </div>
    <div class="campaign-survey-row">
      <span>
        <span class="campaign-survey-name">Survey Architecture</span>
        <span class="campaign-survey-id">Panels: ${escapeHtml(panels.join(" -> "))}</span>
        <span class="campaign-survey-id">Fields: ${escapeHtml(fields.join(", "))}</span>
      </span>
      <span class="survey-status on">Valid</span>
    </div>
    <div class="campaign-survey-row">
      <span>
        <span class="campaign-survey-name">Risk & Ambiguities</span>
        ${risks.map((item) => `<span class="campaign-survey-id">${escapeHtml(item)}</span>`).join("")}
      </span>
      <span class="survey-status">Review</span>
    </div>
    <div class="campaign-survey-row">
      <span>
        <span class="campaign-survey-name">Review Checklist</span>
        ${checklist.map((item) => `<span class="campaign-survey-id">${escapeHtml(item)}</span>`).join("")}
      </span>
      <span class="survey-status on">Checked</span>
    </div>
  `;
}

window.__nccSurveyDesigner = {
  buildSurveyDesignerOutput,
  validateSurveyJson
};

function showAdminLog(data) {
  adminAccountLog.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

function showUserReportLog(data) {
  userReportLog.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

function renderUserReportSteps(steps = []) {
  userReportStepList.innerHTML = steps.map((step) => `
    <div class="step ${step.ok ? "ok" : "err"}">
      <span>${escapeHtml(step.name || "step")}</span>
      <span>${escapeHtml(String(step.status || ""))}</span>
    </div>
  `).join("");
}

function accountLabel(account) {
  return `${account.tenant || account.username} - ${account.cluster || account.domain || ""}`.trim();
}

function renderAdminAccounts(accounts = adminAccounts) {
  adminAccountsSummary.textContent = `${accounts.length} saved admin account${accounts.length === 1 ? "" : "s"}`;
  if (!accounts.length) {
    adminAccountList.innerHTML = `<div class="hint">No admin accounts saved yet.</div>`;
    return;
  }
  adminAccountList.innerHTML = accounts.map((account) => `
    <div class="campaign-survey-row">
      <span>
        <span class="campaign-survey-name">${escapeHtml(accountLabel(account))}</span>
        <span class="campaign-survey-id">${escapeHtml(account.username || "")} · ${escapeHtml(account.timezone || "timezone not set")} · ${account.userReportId ? `Report ${escapeHtml(account.userReportId)}` : "No report ID"}</span>
      </span>
      <span class="survey-status ${account.lastTestOk ? "on" : ""}">${account.lastTestOk ? "Valid" : "Needs test"}</span>
      <span class="preset-row" style="margin:0;">
        <button class="preset" type="button" data-admin-command="test" data-admin-id="${escapeHtml(account.id)}">Test</button>
        <button class="preset" type="button" data-admin-command="delete" data-admin-id="${escapeHtml(account.id)}">Delete</button>
      </span>
    </div>
  `).join("");
}

async function loadAdminAccounts() {
  if (!currentToken) return;
  adminAccountList.innerHTML = `<div class="hint">Loading admin accounts...</div>`;
  try {
    const data = await request("/api/ncc-builder/admin-accounts");
    adminAccounts = Array.isArray(data.objects) ? data.objects : [];
    adminAccountsLoaded = true;
    renderAdminAccounts();
    renderTenantReportConfig();
    renderReportAccounts();
  } catch (error) {
    adminAccountList.innerHTML = `<div class="hint">Unable to load admin accounts.</div>`;
    showAdminLog(error.message);
  }
}

function readAdminAccountForm() {
  return {
    tenant: adminTenant.value.trim(),
    cluster: adminCluster.value.trim(),
    timezone: adminTimezone.value.trim(),
    username: adminUsername.value.trim(),
    password: adminPassword.value
  };
}

function readSelectedReportAccountIds() {
  return Array.from(reportAccountList.querySelectorAll("[data-report-account-id]:checked"))
    .map((input) => input.dataset.reportAccountId || "")
    .filter(Boolean);
}

function selectedReportAccounts() {
  const selected = new Set(readSelectedReportAccountIds());
  return adminAccounts.filter((account) => selected.has(account.id));
}

function hasTenantReportId(account) {
  return Boolean(String(account?.userReportId || "").trim());
}

function renderTenantReportConfig() {
  if (!adminAccounts.length) {
    tenantReportAccount.innerHTML = `<option value="">No saved tenants</option>`;
    tenantReportList.innerHTML = `<div class="hint">No admin accounts saved. Add them in Admin Accounts first.</div>`;
    tenantReportSummary.textContent = "No tenant reports configured.";
    tenantReportId.value = "";
    updateUserReportSummary();
    return;
  }
  const current = tenantReportAccount.value;
  tenantReportAccount.innerHTML = `<option value="">Select a saved tenant</option>${adminAccounts.map((account) => `
    <option value="${escapeHtml(account.id)}">${escapeHtml(accountLabel(account))}</option>
  `).join("")}`;
  tenantReportAccount.value = adminAccounts.some((account) => account.id === current) ? current : "";
  const configured = adminAccounts.filter(hasTenantReportId);
  tenantReportSummary.textContent = `${configured.length} of ${adminAccounts.length} tenant report${adminAccounts.length === 1 ? "" : "s"} configured`;
  tenantReportList.innerHTML = adminAccounts.map((account) => `
    <div class="campaign-survey-row">
      <span>
        <span class="campaign-survey-name">${escapeHtml(accountLabel(account))}</span>
        <span class="campaign-survey-id">${escapeHtml(account.username || "")} · ${escapeHtml(account.timezone || "timezone not set")}</span>
      </span>
      <span class="campaign-survey-id">${hasTenantReportId(account) ? escapeHtml(account.userReportId) : "Missing report ID"}</span>
      <span class="survey-status ${hasTenantReportId(account) ? "on" : ""}">${hasTenantReportId(account) ? "Ready" : "Missing"}</span>
    </div>
  `).join("");
  updateTenantReportForm();
  updateUserReportSummary();
}

function updateTenantReportForm() {
  const account = adminAccounts.find((item) => item.id === tenantReportAccount.value);
  tenantReportId.value = account?.userReportId || "";
}

function renderReportAccounts() {
  if (!adminAccounts.length) {
    reportAccountList.innerHTML = `<div class="hint">No admin accounts saved. Add them in Admin Accounts first.</div>`;
    updateUserReportSummary();
    return;
  }
  reportAccountList.innerHTML = adminAccounts.map((account) => `
    <label class="campaign-survey-row">
      <input type="checkbox" data-report-account-id="${escapeHtml(account.id)}" />
      <span>
        <span class="campaign-survey-name">${escapeHtml(accountLabel(account))}</span>
        <span class="campaign-survey-id">${escapeHtml(account.username || "")} · ${escapeHtml(account.timezone || "")} · ${hasTenantReportId(account) ? `Report ${escapeHtml(account.userReportId)}` : "No report ID"}</span>
      </span>
      <span class="survey-status ${hasTenantReportId(account) ? "on" : ""}">${hasTenantReportId(account) ? "Ready" : "Missing report"}</span>
    </label>
  `).join("");
  updateUserReportSummary();
}

async function loadUserReportsTool() {
  if (!currentToken) return;
  if (!adminAccountsLoaded) await loadAdminAccounts();
  renderReportAccounts();
}

function updateUserReportSummary() {
  const selected = readSelectedReportAccountIds();
  const selectedAccounts = selectedReportAccounts();
  const runnable = selectedAccounts.filter(hasTenantReportId);
  reportAccountSummary.textContent = `${selected.length} selected of ${adminAccounts.length} admin accounts`;
  userReportSummary.textContent = runnable.length && runnable.length === selected.length && reportStartDate.value && reportEndDate.value
    ? `Ready to run ${runnable.length} tenant report${runnable.length === 1 ? "" : "s"}.`
    : "Select accounts with saved report IDs and a date range.";
}

function flattenUserReportRows(data) {
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  return accounts.flatMap((account) => (Array.isArray(account.rows) ? account.rows : []).map((row) => ({
    tenant: account.tenant || "",
    cluster: account.cluster || "",
    reportId: account.reportId || "",
    userid: row.userid || row.userId || row.id || row._id || "",
    username: row.username || row.name || row.email || "",
    raw: row
  })));
}

function renderUserReportResults(rows = userReportRows) {
  if (!rows.length) {
    userReportResults.innerHTML = `<div class="hint">No report rows yet.</div>`;
    return;
  }
  userReportResults.innerHTML = `
    <div class="campaign-survey-row" style="font-weight:900;">
      <span>Tenant</span><span>User</span><span>User ID</span>
    </div>
    ${rows.slice(0, 100).map((row) => `
      <div class="campaign-survey-row">
        <span class="campaign-survey-name">${escapeHtml(row.tenant)}</span>
        <span>${escapeHtml(row.username)}</span>
        <span class="campaign-survey-id">${escapeHtml(row.userid)}</span>
      </div>
    `).join("")}
  `;
}

function exportUserReportsCsv() {
  const header = ["tenant", "cluster", "reportId", "userid", "username"];
  const csv = [header.join(",")].concat(userReportRows.map((row) => header.map((key) => `"${String(row[key] || "").replace(/"/g, '""')}"`).join(","))).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ncc-user-report-${reportStartDate.value || "from"}-to-${reportEndDate.value || "to"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function readSupervisorIds() {
  return Array.from(supervisorList.querySelectorAll("[data-supervisor-id]:checked"))
    .map((input) => input.dataset.supervisorId || "")
    .filter(Boolean);
}

function renderSupervisors(supervisors = []) {
  if (!supervisors.length) {
    supervisorList.innerHTML = `<div class="hint">No Administrator or Supervisor users were found.</div>`;
    return;
  }
  supervisorList.innerHTML = supervisors.map((user) => `
    <label class="supervisor-option">
      <input type="checkbox" data-supervisor-id="${escapeHtml(user.id)}" />
      <span>${escapeHtml(user.name || user.username || user.id)}</span>
      <span class="supervisor-profile">${escapeHtml(user.profileName || user.profileLabel || "")}</span>
    </label>
  `).join("");
}

async function loadSupervisors() {
  supervisorList.innerHTML = `<div class="hint">Loading supervisors...</div>`;
  try {
    const data = await request("/api/ncc-builder/supervisors");
    renderSupervisors(data.objects || []);
  } catch (error) {
    supervisorList.innerHTML = `<div class="hint">Unable to load supervisors.</div>`;
    showLog(error.message);
  }
}

function renderTranscriptionServices(services = []) {
  if (!services.length) {
    recordingAnalysisServiceId.innerHTML = `<option value="">No transcription services found</option>`;
    return;
  }
  recordingAnalysisServiceId.innerHTML = `<option value="">Select a transcription service</option>` + services.map((service) => {
    const id = nccItemId(service, "service");
    return `<option value="${escapeHtml(id)}">${escapeHtml(nccItemName(service))} - ${escapeHtml(id)}</option>`;
  }).join("");
}

async function loadTranscriptionServices() {
  recordingAnalysisServiceId.innerHTML = `<option value="">Loading transcription services...</option>`;
  try {
    const data = await request("/api/ncc-builder/transcription-services");
    renderTranscriptionServices(data.objects || []);
    transcriptionServicesLoaded = true;
  } catch (error) {
    recordingAnalysisServiceId.innerHTML = `<option value="">Unable to load transcription services</option>`;
    transcriptionServicesLoaded = true;
    showLog(error.message);
  }
  updateTranscriptionUi();
}

function renderSelectServices(select, emptyLabel, services = []) {
  if (!services.length) {
    select.innerHTML = `<option value="">No ${emptyLabel} services found</option>`;
    return;
  }
  select.innerHTML = `<option value="">Select a service</option>` + services.map((service) => {
    const id = nccItemId(service, "service");
    return `<option value="${escapeHtml(id)}">${escapeHtml(nccItemName(service))} - ${escapeHtml(id)}</option>`;
  }).join("");
}

async function loadGenerativeAIServices() {
  generativeAIServiceId.innerHTML = `<option value="">Loading Summary services...</option>`;
  try {
    const data = await request("/api/ncc-builder/generative-ai-services");
    renderSelectServices(generativeAIServiceId, "Summary", data.objects || []);
    generativeAIServicesLoaded = true;
  } catch (error) {
    generativeAIServiceId.innerHTML = `<option value="">Unable to load Summary services</option>`;
    generativeAIServicesLoaded = true;
    showLog(error.message);
  }
}

async function loadRealtimeAnalysisServices() {
  realtimeAnalysisServiceId.innerHTML = `<option value="">Loading Real-Time Analysis services...</option>`;
  try {
    const data = await request("/api/ncc-builder/realtime-analysis-services");
    renderSelectServices(realtimeAnalysisServiceId, "Real-Time Analysis", data.objects || []);
    realtimeAnalysisServicesLoaded = true;
  } catch (error) {
    realtimeAnalysisServiceId.innerHTML = `<option value="">Unable to load Real-Time Analysis services</option>`;
    realtimeAnalysisServicesLoaded = true;
    showLog(error.message);
  }
}

async function loadKnowledgeBaseServices() {
  knowledgeBaseServiceId.innerHTML = `<option value="">Loading KNOWLEDGE BASE services...</option>`;
  try {
    const data = await request("/api/ncc-builder/knowledge-base-services");
    renderSelectServices(knowledgeBaseServiceId, "KNOWLEDGE BASE", data.objects || []);
    knowledgeBaseServicesLoaded = true;
  } catch (error) {
    knowledgeBaseServiceId.innerHTML = `<option value="">Unable to load KNOWLEDGE BASE services</option>`;
    knowledgeBaseServicesLoaded = true;
    showLog(error.message);
  }
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
    toolMenu.classList.remove("hidden");
    setToolView(currentToolView);
    showLog({ session: data });
    await loadInboundNumbers();
    await loadSupervisors();
    await loadTranscriptionServices();
    await loadGenerativeAIServices();
    await loadRealtimeAnalysisServices();
    await loadKnowledgeBaseServices();
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
    toolMenu.classList.remove("hidden");
    setToolView(currentToolView);
    showLog({ login: data });
    await loadInboundNumbers();
    await loadSupervisors();
    await loadTranscriptionServices();
    await loadGenerativeAIServices();
    await loadRealtimeAnalysisServices();
    await loadKnowledgeBaseServices();
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
  surveyDomainLabel.textContent = currentDomain || "Detected after login";
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

function updateRecordingUi() {
  recordCallsHint.textContent = recordCalls.checked ? "100% of calls" : "0% of calls";
}

function updateTranscriptionUi() {
  const enabled = enableRealtimeTranscription.checked;
  recordingAnalysisServiceId.disabled = !enabled;
  recordingEventsTranscriptionRow.classList.toggle("hidden", !enabled);
  recordingEventsTranscription.disabled = !enabled;
  transcriptionHint.textContent = enabled ? "Realtime transcription on" : "Transcription off";
  recordingEventsTranscriptionHint.textContent = recordingEventsTranscription.checked ? "Events transcription on" : "Events transcription off";
  if (!enabled) {
    recordingAnalysisServiceId.value = "";
    recordingEventsTranscription.checked = false;
    recordingEventsTranscriptionHint.textContent = "Events transcription off";
  }
  if (enabled && !transcriptionServicesLoaded && currentToken) loadTranscriptionServices();
}

function queueAssignmentOptionsHtml(selected = "") {
  return QUEUE_ASSIGNMENT_OPTIONS.map((option) => `
    <option value="${escapeHtml(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>
  `).join("");
}

function updateQueueSummary() {
  const queues = readQueues();
  queueSummary.textContent = queues.length
    ? `${queues.length} queue${queues.length === 1 ? "" : "s"} ready. ${queues.filter((queue) => queue.useForRouting).length || 1} queue route will be used for in-hours traffic.`
    : "No queues added yet.";
}

function createQueueCard({ name = "", assignmentType = "fifo_across_all_queues", blended = true, useForRouting = false } = {}) {
  const card = document.createElement("article");
  card.className = "queue-card";
  card.innerHTML = `
    <div class="queue-card-head">
      <div>
        <label>Name</label>
        <input data-queue-field="name" type="text" value="${escapeHtml(name)}" placeholder="Queue name" />
      </div>
      <div>
        <label>Agent assignment</label>
        <select data-queue-field="assignmentType">${queueAssignmentOptionsHtml(assignmentType)}</select>
      </div>
      <button class="secondary" type="button" data-queue-command="duplicate">Duplicate</button>
      <button class="disposition-icon" type="button" data-queue-command="remove" aria-label="Remove queue">&times;</button>
    </div>
    <div class="queue-options">
      <label class="disposition-chip"><input data-queue-field="blended" type="checkbox" ${blended ? "checked" : ""} />Blended queue</label>
      <label class="disposition-chip"><input data-queue-field="useForRouting" type="checkbox" ${useForRouting ? "checked" : ""} />Use for in-hours route</label>
    </div>
    <div class="queue-note">Workflow route: ${useForRouting ? "in-hours calls can be sent to this queue." : "this queue is created in NCC but not selected for in-hours routing."}</div>
  `;
  return card;
}

function readQueueCard(card) {
  return {
    name: card.querySelector('[data-queue-field="name"]')?.value.trim() || "",
    assignmentType: card.querySelector('[data-queue-field="assignmentType"]')?.value || "fifo_across_all_queues",
    blended: card.querySelector('[data-queue-field="blended"]')?.checked === true,
    useForRouting: card.querySelector('[data-queue-field="useForRouting"]')?.checked === true
  };
}

function readQueues() {
  const seen = new Set();
  return Array.from(queueList.querySelectorAll(".queue-card"))
    .map(readQueueCard)
    .filter((queue) => {
      const key = queue.name.toLowerCase();
      if (!queue.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function syncQueueNotes() {
  queueList.querySelectorAll(".queue-card").forEach((card) => {
    const note = card.querySelector(".queue-note");
    const useForRouting = card.querySelector('[data-queue-field="useForRouting"]')?.checked === true;
    if (note) note.textContent = useForRouting
      ? "Workflow route: in-hours calls can be sent to this queue."
      : "Workflow route: this queue is created in NCC but not selected for in-hours routing.";
  });
}

function addQueueCard(data = {}) {
  const hasRoutingQueue = readQueues().some((queue) => queue.useForRouting);
  queueList.appendChild(createQueueCard({ useForRouting: !hasRoutingQueue, ...data }));
  syncQueueNotes();
  updateQueueSummary();
  if (completedSteps.has(1) && getStepError(1)) completedSteps.delete(1);
  renderWizard();
}

function dispositionActionOptionsHtml(selected = "") {
  return DISPOSITION_ACTION_OPTIONS.map((option) => `
    <option value="${escapeHtml(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>
  `).join("");
}

function updateDispositionSummary() {
  const count = dispositionList.querySelectorAll(".disposition-card").length;
  dispositionSummary.textContent = count
    ? `${count} disposition${count === 1 ? "" : "s"} ready. Action is optional and only one action can be selected per disposition.`
    : "No dispositions added yet.";
}

function createDispositionCard(data = {}) {
  const { name = "", action = "", includeWorkitemTypes = false, options = {} } = data;
  const selectedWorkitemTypes = Array.isArray(data.workitemTypes)
    ? new Set(data.workitemTypes)
    : new Set(includeWorkitemTypes ? DISPOSITION_WORKITEM_TYPES : []);
  const card = document.createElement("article");
  card.className = "disposition-card";
  card.innerHTML = `
    <div class="disposition-card-head">
      <div>
        <label>Name</label>
        <input data-disposition-field="name" type="text" value="${escapeHtml(name)}" placeholder="Disposition name" />
      </div>
      <div>
        <label>Action</label>
        <select data-disposition-field="action">${dispositionActionOptionsHtml(action)}</select>
      </div>
      <button class="secondary" type="button" data-disposition-command="duplicate">Duplicate</button>
      <button class="disposition-icon" type="button" data-disposition-command="remove" aria-label="Remove disposition">&times;</button>
    </div>
    <div class="disposition-subsection" data-disposition-section="workitemTypes">
      <div class="disposition-subsection-head">
        <div class="disposition-subsection-title">Workitem type</div>
        <div class="disposition-mini-actions">
          <button type="button" data-disposition-command="workitem-all">Select all</button>
          <button type="button" data-disposition-command="workitem-clear">Clear</button>
        </div>
      </div>
      <div class="disposition-chip-row">
        ${DISPOSITION_WORKITEM_TYPES.map((type) => `
          <label class="disposition-chip">
            <input data-disposition-field="workitemType" type="checkbox" value="${escapeHtml(type)}" ${selectedWorkitemTypes.has(type) ? "checked" : ""} />
            ${escapeHtml(type)}
          </label>
        `).join("")}
      </div>
    </div>
    <div class="disposition-subsection">
      <div class="disposition-subsection-head">
        <div class="disposition-subsection-title">Options</div>
      </div>
      <div class="disposition-options">
        <label class="disposition-chip"><input data-disposition-field="resolved" type="checkbox" ${options.resolved ? "checked" : ""} />Resolved</label>
        <label class="disposition-chip"><input data-disposition-field="connectAgain" type="checkbox" ${options.connectAgain ? "checked" : ""} />Connect again</label>
        <label class="disposition-chip"><input data-disposition-field="forceContactAssignment" type="checkbox" ${options.forceContactAssignment ? "checked" : ""} />Force contact assignment</label>
        <label class="disposition-chip"><input data-disposition-field="forceSurveyValidation" type="checkbox" ${options.forceSurveyValidation ? "checked" : ""} />Force survey validation</label>
        <label class="disposition-chip"><input data-disposition-field="blockNumber" type="checkbox" ${options.blockNumber ? "checked" : ""} />Block number</label>
      </div>
    </div>
  `;
  return card;
}

function addDispositionCard(data = {}) {
  dispositionList.appendChild(createDispositionCard(data));
  updateDispositionSummary();
  if (completedSteps.has(5) && getStepError(5)) completedSteps.delete(5);
  renderWizard();
}

function readDispositionCard(card) {
  const name = card.querySelector('[data-disposition-field="name"]')?.value.trim() || "";
  return {
    name,
    action: card.querySelector('[data-disposition-field="action"]')?.value || "",
    workitemTypes: Array.from(card.querySelectorAll('[data-disposition-field="workitemType"]:checked')).map((input) => input.value),
    options: {
      resolved: card.querySelector('[data-disposition-field="resolved"]')?.checked === true,
      connectAgain: card.querySelector('[data-disposition-field="connectAgain"]')?.checked === true,
      forceContactAssignment: card.querySelector('[data-disposition-field="forceContactAssignment"]')?.checked === true,
      forceSurveyValidation: card.querySelector('[data-disposition-field="forceSurveyValidation"]')?.checked === true,
      blockNumber: card.querySelector('[data-disposition-field="blockNumber"]')?.checked === true
    }
  };
}

function readDispositions() {
  const seen = new Set();
  return Array.from(dispositionList.querySelectorAll(".disposition-card"))
    .map(readDispositionCard)
    .filter((item) => {
      const key = item.name.toLowerCase();
      if (!item.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function readForm() {
  const campaignName = document.getElementById("campaignName").value.trim();
  return {
    token: currentToken,
    domain: currentDomain || domainInput.value.trim(),
    campaignName,
    campaignType: campaignType.value,
    recordingPercentage: recordCalls.checked ? 100 : 0,
    enableRealtimeTranscription: enableRealtimeTranscription.checked,
    recordingEventsTranscription: enableRealtimeTranscription.checked && recordingEventsTranscription.checked,
    recordingAnalysisServiceId: enableRealtimeTranscription.checked ? recordingAnalysisServiceId.value : "",
    generativeAIServiceId: generativeAIServiceId.value,
    realtimeAnalysisServiceId: realtimeAnalysisServiceId.value,
    knowledgeBaseServiceId: knowledgeBaseServiceId.value,
    supervisorIds: readSupervisorIds(),
    inboundAddress: inboundAddress.value,
    outboundCallerId: document.getElementById("outboundCallerId").value.trim(),
    queues: readQueues(),
    workflowName: document.getElementById("workflowName").value.trim() || `${campaignName} workflow`,
    scheduleName: document.getElementById("scheduleName").value.trim() || `${campaignName} schedule`,
    businessEventName: document.getElementById("businessEventName").value.trim() || `${campaignName} schedule`,
    startTime: document.getElementById("startTime").value,
    endTime: document.getElementById("endTime").value,
    days: Array.from(document.querySelectorAll("#days input:checked")).map((input) => input.value),
    inHoursMessage: document.getElementById("inHoursMessage").value.trim(),
    outOfHoursMessage: document.getElementById("outOfHoursMessage").value.trim(),
    dispositions: readDispositions()
  };
}

function renderWizard() {
  const data = readForm();
  const statuses = wizardSteps.map((_, index) => getStepStatus(index, data));
  const completed = statuses.filter((status) => status === "complete").length;
  const progress = Math.round((completed / wizardSteps.length) * 100);
  wizardStepper.innerHTML = `
    <div class="progress-top">
      <span>${completed} of ${wizardSteps.length} sections complete</span>
      <span>${progress}%</span>
    </div>
    <div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${progress}%"></div></div>
    <div class="progress-meta">
      ${wizardSteps.map((name, index) => `
        <span class="progress-chip ${statuses[index]} ${index === activeStep ? "active" : ""}">
          ${index + 1}. ${escapeHtml(name)}
        </span>
      `).join("")}
    </div>
  `;
  document.querySelectorAll(".wizard-step").forEach((section) => {
    const stepIndex = Number(section.dataset.step);
    section.classList.toggle("active", stepIndex === activeStep);
    section.classList.toggle("complete", statuses[stepIndex] === "complete");
    const title = section.querySelector(".section-title");
    if (title) title.textContent = `${stepIndex + 1}. ${wizardSteps[stepIndex]}`;
  });
  prevStepBtn.disabled = activeStep === 0;
  nextStepBtn.textContent = activeStep === wizardSteps.length - 2 ? "Review" : "Next";
  nextStepBtn.classList.toggle("hidden", activeStep === wizardSteps.length - 1);
  submitBtn.classList.toggle("hidden", activeStep !== wizardSteps.length - 1);
  if (activeStep === wizardSteps.length - 1) showReview();
}

function getStepStatus(index, data = readForm()) {
  if (index === wizardSteps.length - 1) {
    return [0, 1, 2, 3, 4, 5].every((step) => getStepStatus(step, data) === "complete") ? "complete" : "missing";
  }
  if (!completedSteps.has(index)) return "missing";
  return getStepError(index, data) ? "missing" : "complete";
}

function getStepError(stepIndex = activeStep, data = readForm()) {
  if (stepIndex === 0 && !data.campaignName) return "Campaign name is required.";
  if (stepIndex === 0 && data.enableRealtimeTranscription && !data.recordingAnalysisServiceId) return "Select a transcription service.";
  if (stepIndex === 0 && (data.generativeAIServiceId || data.realtimeAnalysisServiceId) && (!data.generativeAIServiceId || !data.realtimeAnalysisServiceId)) {
    return "Select both Summary and Real-Time Analysis services.";
  }
  if (stepIndex === 1 && data.campaignType === "inbound" && !data.inboundAddress) return "Select an inbound phone.";
  if (stepIndex === 1 && data.campaignType === "inbound" && !data.queues.length) return "Add at least one queue.";
  if (stepIndex === 1 && data.campaignType === "outbound" && !data.outboundCallerId) return "Enter an outbound caller ID.";
  if (stepIndex === 3 && (!data.startTime || !data.endTime || !data.days.length)) return "Select business hours and at least one day.";
  if (stepIndex === 4 && !data.outOfHoursMessage) return "Out-of-hours message is required to create the prompt.";
  if (stepIndex === 5 && !data.dispositions.length) return "Add at least one disposition.";
  return "";
}

function getStepAutoError(index, data = readForm()) {
  if (index === 1) {
    if (data.campaignType === "inbound" && !data.inboundAddress) return "Select an inbound phone.";
    if (data.campaignType === "inbound" && !data.queues.length) return "Add at least one queue.";
    if (data.campaignType === "outbound" && !data.outboundCallerId) return "Enter an outbound caller ID.";
  }
  return getStepError(index, data);
}

function showReview() {
  const data = readForm();
  const review = {
    domain: data.domain || "not detected",
    campaignName: data.campaignName,
    campaignType: data.campaignType,
    recordingPercentage: data.recordingPercentage,
    transcription: data.enableRealtimeTranscription
      ? {
          enableRealtimeTranscription: true,
          recordingEventsTranscription: data.recordingEventsTranscription,
          recordingAnalysisServiceId: data.recordingAnalysisServiceId
        }
      : {
          enableRealtimeTranscription: false,
          recordingEventsTranscription: false
        },
    analysisServices: data.generativeAIServiceId && data.realtimeAnalysisServiceId
      ? {
          generativeAIServiceId: data.generativeAIServiceId,
          realtimeAnalysisServiceId: [data.realtimeAnalysisServiceId],
          knowledgeBaseServiceId: data.knowledgeBaseServiceId || ""
        }
      : (data.knowledgeBaseServiceId ? { knowledgeBaseServiceId: data.knowledgeBaseServiceId } : "not configured"),
    supervisors: data.supervisorIds,
    phone: data.campaignType === "inbound" ? data.inboundAddress : data.outboundCallerId,
    queues: data.campaignType === "inbound" ? data.queues : "not used for outbound",
    workflowName: data.workflowName,
    scheduleName: data.scheduleName,
    businessEventName: data.businessEventName,
    hours: `${data.startTime} - ${data.endTime}`,
    days: data.days,
    outOfHoursPrompt: data.outOfHoursMessage ? "will be created and added to OUT OF HOURS" : "missing",
    inHoursMessage: data.inHoursMessage ? "captured in log" : "empty",
    dispositions: data.dispositions
  };
  reviewLog.textContent = JSON.stringify(review, null, 2);
}

function validateStep() {
  return getStepAutoError(activeStep);
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

builderViewBtn.addEventListener("click", () => setToolView("builder"));
surveyViewBtn.addEventListener("click", () => setToolView("survey"));
surveyDesignerViewBtn.addEventListener("click", () => setToolView("surveyDesigner"));
adminAccountsViewBtn.addEventListener("click", () => setToolView("adminAccounts"));
userReportsViewBtn.addEventListener("click", () => setToolView("userReports"));
[
  surveyDesignerName,
  surveyDesignerAudience,
  surveyDesignerStory,
  surveyDesignerPrimaryId,
  surveyDesignerContactMode
].forEach((element) => {
  element.addEventListener("input", resetCurrentSurveyDesign);
  element.addEventListener("change", resetCurrentSurveyDesign);
});
surveyDesignerIntegrations.addEventListener("change", resetCurrentSurveyDesign);
downloadSurveyFieldTemplateBtn.addEventListener("click", downloadSurveyFieldTemplate);
surveyFieldFile.addEventListener("change", async () => {
  const file = surveyFieldFile.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const fields = parseSurveyFieldsCsv(text);
    if (!fields.length) {
      surveyDesignerSummary.textContent = "No valid fields found in the uploaded CSV.";
      return;
    }
    addSurveyDesignerFields(fields);
    surveyDesignerSummary.textContent = `${fields.length} field${fields.length === 1 ? "" : "s"} loaded from CSV.`;
  } catch (error) {
    surveyDesignerSummary.textContent = "Unable to read the uploaded field file.";
  } finally {
    surveyFieldFile.value = "";
  }
});
addSurveyFieldBtn.addEventListener("click", () => {
  const field = normalizeSurveyDesignerField({
    label: manualSurveyFieldLabel.value,
    fieldname: manualSurveyFieldMapping.value,
    component: manualSurveyFieldType.value
  });
  if (!field) {
    surveyDesignerSummary.textContent = "Field name and fieldmapping name are required.";
    return;
  }
  addSurveyDesignerFields([field]);
  manualSurveyFieldLabel.value = "";
  manualSurveyFieldMapping.value = "";
  manualSurveyFieldType.value = "input";
  manualSurveyFieldLabel.focus();
  surveyDesignerSummary.textContent = `Added field ${field.fieldname}.`;
});
clearSurveyFieldsBtn.addEventListener("click", () => {
  surveyDesignerFields = [];
  resetCurrentSurveyDesign();
  renderSurveyDesignerFields();
  surveyDesignerSummary.textContent = "Custom survey fields cleared.";
});
surveyFieldList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-survey-field-remove]");
  if (!button) return;
  const index = Number(button.dataset.surveyFieldRemove);
  if (!Number.isFinite(index)) return;
  surveyDesignerFields.splice(index, 1);
  resetCurrentSurveyDesign();
  renderSurveyDesignerFields();
});
generateSurveyDesignBtn.addEventListener("click", () => {
  if (!surveyDesignerStory.value.trim()) {
    surveyDesignerSummary.textContent = "User story is required before generating a survey design.";
    surveyDesignerStory.focus();
    return;
  }
  currentSurveyDesign = buildSurveyDesignerOutput();
  renderSurveyDesignerAnalysis(currentSurveyDesign);
  surveyDesignerJsonLog.textContent = JSON.stringify(currentSurveyDesign.surveyJson, null, 2);
});
generateSurveyWithAiBtn.addEventListener("click", async () => {
  if (!surveyDesignerStory.value.trim()) {
    surveyDesignerSummary.textContent = "User story is required before using AI assisted generation.";
    surveyDesignerStory.focus();
    return;
  }
  generateSurveyWithAiBtn.disabled = true;
  generateSurveyWithAiBtn.textContent = "Generating...";
  surveyDesignerSummary.textContent = "Generating AI assisted NCC survey design...";
  try {
    const data = await request("/api/ncc-builder/survey-designer/ai", {
      method: "POST",
      body: JSON.stringify(readSurveyDesignerConfig())
    });
    currentSurveyDesign = {
      analysis: data.analysis,
      surveyJson: data.surveyJson
    };
    renderSurveyDesignerAnalysis(currentSurveyDesign);
    surveyDesignerSummary.textContent = `AI generated survey using ${data.provider} ${data.model}.`;
    surveyDesignerJsonLog.textContent = JSON.stringify(currentSurveyDesign.surveyJson, null, 2);
  } catch (error) {
    surveyDesignerSummary.textContent = `Unable to generate the survey with AI. ${error.message}`;
    surveyDesignerJsonLog.textContent = error.message;
  } finally {
    generateSurveyWithAiBtn.disabled = false;
    generateSurveyWithAiBtn.textContent = "Generate with AI";
  }
});
createSurveyInNccBtn.addEventListener("click", async () => {
  if (!surveyDesignerStory.value.trim()) {
    surveyDesignerSummary.textContent = "User story is required before creating the survey in NCC.";
    surveyDesignerStory.focus();
    return;
  }
  if (!currentSurveyDesign) {
    currentSurveyDesign = buildSurveyDesignerOutput();
    renderSurveyDesignerAnalysis(currentSurveyDesign);
    surveyDesignerJsonLog.textContent = JSON.stringify(currentSurveyDesign.surveyJson, null, 2);
  }
  createSurveyInNccBtn.disabled = true;
  createSurveyInNccBtn.textContent = "Creating...";
  surveyDesignerSummary.textContent = "Creating NCC survey and patching generated layout...";
  try {
    const data = await request("/api/ncc-builder/survey-designer/create", {
      method: "POST",
      body: JSON.stringify({
        name: currentSurveyDesign.surveyJson.name,
        surveyJson: currentSurveyDesign.surveyJson
      })
    });
    surveyDesignerSummary.textContent = `Created NCC survey ${data.surveyId}.`;
    surveyDesignerJsonLog.textContent = JSON.stringify(data, null, 2);
    surveysLoaded = false;
  } catch (error) {
    surveyDesignerSummary.textContent = "Unable to create NCC survey.";
    surveyDesignerJsonLog.textContent = error.message;
  } finally {
    createSurveyInNccBtn.disabled = false;
    createSurveyInNccBtn.textContent = "Create in NCC";
  }
});
copySurveyJsonBtn.addEventListener("click", async () => {
  if (!currentSurveyDesign) {
    surveyDesignerSummary.textContent = "Generate a survey design before copying JSON.";
    return;
  }
  try {
    await navigator.clipboard.writeText(JSON.stringify(currentSurveyDesign.surveyJson, null, 2));
    surveyDesignerSummary.textContent = "NCC JSON copied to clipboard.";
  } catch (error) {
    surveyDesignerSummary.textContent = "Clipboard is unavailable. Use the NCC JSON panel to copy manually.";
  }
});
downloadSurveyJsonBtn.addEventListener("click", () => {
  if (!currentSurveyDesign) {
    surveyDesignerSummary.textContent = "Generate a survey design before downloading JSON.";
    return;
  }
  const blob = new Blob([JSON.stringify(currentSurveyDesign.surveyJson, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${toSnakeCase(currentSurveyDesign.surveyJson.name, "ncc_survey")}.json`;
  link.click();
  URL.revokeObjectURL(url);
});
reloadSurveyCampaignsBtn.addEventListener("click", async () => {
  surveysLoaded = false;
  campaignsLoaded = false;
  await loadSurveyCampaignTool();
});
campaignSurveySearch.addEventListener("input", renderSurveyCampaigns);
surveySelect.addEventListener("change", updateSurveySaveSummary);
campaignSurveyList.addEventListener("change", updateSurveySaveSummary);
document.querySelectorAll("[data-survey-campaign-selection]").forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.surveyCampaignSelection;
    campaignSurveyList.querySelectorAll("[data-survey-campaign-id]").forEach((input) => {
      input.checked = mode === "all" || (mode === "without-survey" && input.dataset.hasSurvey !== "true");
    });
    updateSurveySaveSummary();
  });
});
cancelSurveyBtn.addEventListener("click", () => setToolView("builder"));
saveSurveyCampaignsBtn.addEventListener("click", async () => {
  const surveyId = surveySelect.value;
  const campaignIds = readSelectedSurveyCampaignIds();
  if (!surveyId || !campaignIds.length) {
    showSurveyLog("Select a survey and at least one campaign.");
    return;
  }
  saveSurveyCampaignsBtn.disabled = true;
  saveSurveyCampaignsBtn.textContent = "Saving...";
  renderSurveySteps([]);
  try {
    const data = await request("/api/ncc-builder/campaign-surveys", {
      method: "POST",
      body: JSON.stringify({ surveyId, campaignIds })
    });
    renderSurveySteps(data.steps || []);
    showSurveyLog(data);
    campaignsLoaded = false;
    await loadSurveyCampaigns();
  } catch (error) {
    showSurveyLog(error.message);
  } finally {
    saveSurveyCampaignsBtn.disabled = false;
    saveSurveyCampaignsBtn.textContent = "Save survey to selected campaigns";
  }
});

reloadAdminAccountsBtn.addEventListener("click", () => {
  adminAccountsLoaded = false;
  loadAdminAccounts();
});

saveAdminAccountBtn.addEventListener("click", async () => {
  const account = readAdminAccountForm();
  if (!account.tenant || !account.cluster || !account.username || !account.password) {
    showAdminLog("Tenant, cluster/domain, username, and password are required.");
    return;
  }
  saveAdminAccountBtn.disabled = true;
  saveAdminAccountBtn.textContent = "Saving...";
  try {
    const data = await request("/api/ncc-builder/admin-accounts", {
      method: "POST",
      body: JSON.stringify(account)
    });
    adminPassword.value = "";
    showAdminLog(data);
    adminAccountsLoaded = false;
    await loadAdminAccounts();
  } catch (error) {
    showAdminLog(error.message);
  } finally {
    saveAdminAccountBtn.disabled = false;
    saveAdminAccountBtn.textContent = "Save account";
  }
});

adminAccountList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-admin-command]");
  if (!button) return;
  const accountId = button.dataset.adminId;
  if (!accountId) return;
  button.disabled = true;
  try {
    if (button.dataset.adminCommand === "test") {
      const data = await request(`/api/ncc-builder/admin-accounts/${encodeURIComponent(accountId)}/test`, { method: "POST" });
      showAdminLog(data);
    } else if (button.dataset.adminCommand === "delete") {
      const data = await request(`/api/ncc-builder/admin-accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" });
      showAdminLog(data);
    }
    adminAccountsLoaded = false;
    await loadAdminAccounts();
  } catch (error) {
    showAdminLog(error.message);
  } finally {
    button.disabled = false;
  }
});

reportAccountList.addEventListener("change", updateUserReportSummary);
reportStartDate.addEventListener("change", updateUserReportSummary);
reportEndDate.addEventListener("change", updateUserReportSummary);
tenantReportAccount.addEventListener("change", updateTenantReportForm);
saveTenantReportBtn.addEventListener("click", async () => {
  const accountId = tenantReportAccount.value;
  const userReportId = tenantReportId.value.trim();
  if (!accountId || !userReportId) {
    showUserReportLog("Select a tenant and enter its user report ID.");
    return;
  }
  saveTenantReportBtn.disabled = true;
  saveTenantReportBtn.textContent = "Saving...";
  try {
    const data = await request(`/api/ncc-builder/admin-accounts/${encodeURIComponent(accountId)}/user-report`, {
      method: "POST",
      body: JSON.stringify({ userReportId })
    });
    showUserReportLog(data);
    adminAccountsLoaded = false;
    await loadAdminAccounts();
    tenantReportAccount.value = accountId;
    updateTenantReportForm();
  } catch (error) {
    showUserReportLog(error.message);
  } finally {
    saveTenantReportBtn.disabled = false;
    saveTenantReportBtn.textContent = "Save report ID";
  }
});
document.querySelectorAll("[data-report-account-selection]").forEach((button) => {
  button.addEventListener("click", () => {
    const checked = button.dataset.reportAccountSelection === "all";
    reportAccountList.querySelectorAll("[data-report-account-id]").forEach((input) => { input.checked = checked; });
    updateUserReportSummary();
  });
});
runUserReportsBtn.addEventListener("click", async () => {
  const accountIds = readSelectedReportAccountIds();
  const missingReportIds = selectedReportAccounts().filter((account) => !hasTenantReportId(account));
  if (!accountIds.length || !reportStartDate.value || !reportEndDate.value || missingReportIds.length) {
    showUserReportLog(missingReportIds.length
      ? `These tenants need a saved report ID first: ${missingReportIds.map(accountLabel).join(", ")}`
      : "Select accounts with saved report IDs and a date range.");
    return;
  }
  runUserReportsBtn.disabled = true;
  runUserReportsBtn.textContent = "Running...";
  renderUserReportSteps([]);
  showUserReportLog("Running user reports...");
  try {
    const data = await request("/api/ncc-builder/user-reports/run", {
      method: "POST",
      body: JSON.stringify({
        accountIds,
        from: reportStartDate.value,
        to: reportEndDate.value
      })
    });
    renderUserReportSteps(data.steps || []);
    userReportRows = flattenUserReportRows(data);
    renderUserReportResults();
    userReportSummary.textContent = `${userReportRows.length} user rows returned from ${accountIds.length} account${accountIds.length === 1 ? "" : "s"}.`;
    showUserReportLog(data);
  } catch (error) {
    showUserReportLog(error.message);
  } finally {
    runUserReportsBtn.disabled = false;
    runUserReportsBtn.textContent = "Run reports";
  }
});
exportUserReportsBtn.addEventListener("click", exportUserReportsCsv);

campaignType.addEventListener("change", updateTypeUi);
recordCalls.addEventListener("change", updateRecordingUi);
enableRealtimeTranscription.addEventListener("change", () => {
  updateTranscriptionUi();
  renderWizard();
});
recordingEventsTranscription.addEventListener("change", () => {
  updateTranscriptionUi();
  renderWizard();
});
recordingAnalysisServiceId.addEventListener("change", renderWizard);
generativeAIServiceId.addEventListener("change", renderWizard);
realtimeAnalysisServiceId.addEventListener("change", renderWizard);
knowledgeBaseServiceId.addEventListener("change", renderWizard);
reloadNumbersBtn.addEventListener("click", loadInboundNumbers);
reloadSupervisorsBtn.addEventListener("click", loadSupervisors);
loginForm.addEventListener("submit", login);
addQueueBtn.addEventListener("click", () => {
  const name = newQueueName.value.trim();
  if (!name) {
    newQueueName.focus();
    return;
  }
  addQueueCard({ name, assignmentType: newQueueAssignmentType.value || "fifo_across_all_queues" });
  newQueueName.value = "";
  newQueueAssignmentType.value = "fifo_across_all_queues";
  newQueueName.focus();
});
newQueueName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addQueueBtn.click();
  }
});
queueList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-queue-command]");
  if (!button) return;
  const card = button.closest(".queue-card");
  if (!card) return;
  if (button.dataset.queueCommand === "remove") {
    card.remove();
  } else if (button.dataset.queueCommand === "duplicate") {
    card.after(createQueueCard(readQueueCard(card)));
  }
  syncQueueNotes();
  updateQueueSummary();
  if (completedSteps.has(1) && getStepError(1)) completedSteps.delete(1);
  renderWizard();
});
queueList.addEventListener("input", () => {
  syncQueueNotes();
  updateQueueSummary();
  if (completedSteps.has(1) && getStepError(1)) completedSteps.delete(1);
  renderWizard();
});
queueList.addEventListener("change", () => {
  syncQueueNotes();
  updateQueueSummary();
  renderWizard();
});
document.querySelectorAll(".wizard-step > .section-title").forEach((title) => {
  title.addEventListener("click", () => {
    activeStep = Number(title.closest(".wizard-step")?.dataset.step || 0);
    renderWizard();
  });
});
addDispositionBtn.addEventListener("click", () => {
  const name = newDispositionName.value.trim();
  if (!name) {
    newDispositionName.focus();
    return;
  }
  addDispositionCard({ name, action: newDispositionAction.value || "" });
  newDispositionName.value = "";
  newDispositionAction.value = "";
  newDispositionName.focus();
});
newDispositionName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addDispositionBtn.click();
  }
});
dispositionList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-disposition-command]");
  if (!button) return;
  const card = button.closest(".disposition-card");
  if (!card) return;
  if (button.dataset.dispositionCommand === "remove") {
    card.remove();
  } else if (button.dataset.dispositionCommand === "duplicate") {
    card.after(createDispositionCard(readDispositionCard(card)));
  } else if (button.dataset.dispositionCommand === "workitem-all") {
    card.querySelectorAll('[data-disposition-field="workitemType"]').forEach((input) => { input.checked = true; });
  } else if (button.dataset.dispositionCommand === "workitem-clear") {
    card.querySelectorAll('[data-disposition-field="workitemType"]').forEach((input) => { input.checked = false; });
  }
  updateDispositionSummary();
  if (completedSteps.has(5) && getStepError(5)) completedSteps.delete(5);
  renderWizard();
});
dispositionList.addEventListener("input", () => {
  if (completedSteps.has(5) && getStepError(5)) completedSteps.delete(5);
  renderWizard();
});
dispositionList.addEventListener("change", () => {
  renderWizard();
});
document.querySelectorAll("[data-supervisor-selection]").forEach((button) => {
  button.addEventListener("click", () => {
    const checked = button.dataset.supervisorSelection === "all";
    supervisorList.querySelectorAll("[data-supervisor-id]").forEach((input) => { input.checked = checked; });
    renderWizard();
  });
});
logoutBtn.addEventListener("click", () => {
  currentToken = "";
  currentDomain = "";
  completedSteps.clear();
  surveysLoaded = false;
  campaignsLoaded = false;
  transcriptionServicesLoaded = false;
  generativeAIServicesLoaded = false;
  realtimeAnalysisServicesLoaded = false;
  knowledgeBaseServicesLoaded = false;
  adminAccountsLoaded = false;
  adminAccounts = [];
  userReportRows = [];
  surveyCampaigns = [];
  window.sessionStorage.removeItem(STORAGE_KEY);
  setBadge("", "Sign in required");
  toolMenu.classList.add("hidden");
  builderGrid.classList.add("hidden");
  surveyGrid.classList.add("hidden");
  surveyDesignerGrid.classList.add("hidden");
  adminAccountsGrid.classList.add("hidden");
  userReportsGrid.classList.add("hidden");
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
  completedSteps.add(activeStep);
  activeStep = Math.min(wizardSteps.length - 1, activeStep + 1);
  renderWizard();
});

form.addEventListener("input", () => {
  completedSteps.forEach((step) => {
    if (getStepError(step)) completedSteps.delete(step);
  });
  renderWizard();
});

form.addEventListener("change", () => {
  completedSteps.forEach((step) => {
    if (getStepError(step)) completedSteps.delete(step);
  });
  renderWizard();
});

updateTypeUi();
updateRecordingUi();
updateTranscriptionUi();
newQueueAssignmentType.innerHTML = queueAssignmentOptionsHtml();
updateQueueSummary();
newDispositionAction.innerHTML = dispositionActionOptionsHtml();
updateDispositionSummary();
renderSurveyDesignerFields();
renderWizard();
validateSession();
