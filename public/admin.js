const statusNode = document.getElementById("adminStatus");
const campaignList = document.getElementById("campaignList");
const campaignForm = document.getElementById("campaignForm");
const newCampaignButton = document.getElementById("newCampaignButton");
const deleteCampaignButton = document.getElementById("deleteCampaignButton");
const duplicateCampaignButton = document.getElementById("duplicateCampaignButton");
const adminGrid = document.getElementById("adminGrid");
const adminLockedMessage = document.getElementById("adminLockedMessage");
const previewPageType = document.getElementById("previewPageType");
const previewViewportWidth = document.getElementById("previewViewportWidth");
const previewViewportHeight = document.getElementById("previewViewportHeight");
const previewScale = document.getElementById("previewScale");
const previewStage = document.getElementById("previewStage");
const previewFrame = document.getElementById("previewFrame");
const adminBreadcrumb = document.getElementById("adminBreadcrumb");
const adminToast = document.getElementById("adminToast");
const campaignSearch = document.getElementById("campaignSearch");
const saveCampaignButton = document.getElementById("saveCampaignButton");
const questionItemsContainer = document.getElementById("questionItemsContainer");
const addQuestionButton = document.getElementById("addQuestionButton");
const collapseAllButton = document.getElementById("collapseAllButton");
const expandAllButton = document.getElementById("expandAllButton");
const adminUserBar = document.getElementById("adminUserBar");
const adminUserName = document.getElementById("adminUserName");
const adminUserRole = document.getElementById("adminUserRole");
const logoutButton = document.getElementById("logoutButton");
const usersSection = document.getElementById("usersSection");
const userList = document.getElementById("userList");
const addUserButton = document.getElementById("addUserButton");
const userFormWrap = document.getElementById("userFormWrap");
const saveUserButton = document.getElementById("saveUserButton");
const cancelUserButton = document.getElementById("cancelUserButton");
const newUserRole = document.getElementById("newUserRole");
const newUserPermissionsWrap = document.getElementById("newUserPermissionsWrap");
const newUserCanCreateCampaign = document.getElementById("newUserCanCreateCampaign");
const newUserCanEditCampaign = document.getElementById("newUserCanEditCampaign");
const newUserCanDeleteCampaign = document.getElementById("newUserCanDeleteCampaign");
const wielandConfiguredFieldmappingInfo = document.getElementById("wielandConfiguredFieldmappingInfo");
const wielandAvailableFieldmappingsInfo = document.getElementById("wielandAvailableFieldmappingsInfo");
const wielandRefreshFieldmappingsButton = document.getElementById("wielandRefreshFieldmappings");
const wielandWidgetMappingRows = document.getElementById("wielandWidgetMappingRows");
const wielandContactToListRows = document.getElementById("wielandContactToListRows");
const summaryagenticSourcesList = document.getElementById("summaryagenticSourcesList");
const summaryagenticAddSourceButton = document.getElementById("summaryagenticAddSource");
const summaryagenticLoadDefaultPromptButton = document.getElementById("summaryagenticLoadDefaultPrompt");
const summaryagenticImportToggle = document.getElementById("summaryagenticImportToggle");
const summaryagenticImportForm = document.getElementById("summaryagenticImportForm");
const summaryagenticAnalyzeBtn = document.getElementById("summaryagenticAnalyzeBtn");
const summaryagenticAnalyzeResult = document.getElementById("summaryagenticAnalyzeResult");
const summaryagenticAddFromAnalysis = document.getElementById("summaryagenticAddFromAnalysis");
const pulseformsSourcesList = document.getElementById("pulseformsSourcesList");
const pulseformsAddSourceButton = document.getElementById("pulseformsAddSource");
const pulseformsFieldsList = document.getElementById("pulseformsFieldsList");
const pulseformsAddFieldButton = document.getElementById("pulseformsAddField");
const pulseformsFieldFiles = document.getElementById("pulseformsFieldFiles");
const pulseformsAnalyzeFieldsBtn = document.getElementById("pulseformsAnalyzeFieldsBtn");
const pulseformsAddSuggestedFieldsBtn = document.getElementById("pulseformsAddSuggestedFieldsBtn");
const pulseformsSuggestedFieldsList = document.getElementById("pulseformsSuggestedFieldsList");
const pulseformsJsonFieldsFile = document.getElementById("pulseformsJsonFieldsFile");
const pulseformsJsonFieldsText = document.getElementById("pulseformsJsonFieldsText");
const pulseformsImportJsonFieldsBtn = document.getElementById("pulseformsImportJsonFieldsBtn");
const pulseformsAddJsonFieldsBtn = document.getElementById("pulseformsAddJsonFieldsBtn");
const pulseformsJsonFieldsPreview = document.getElementById("pulseformsJsonFieldsPreview");
const pulseformsImportToggle = document.getElementById("pulseformsImportToggle");
const pulseformsImportForm = document.getElementById("pulseformsImportForm");
const pulseformsAnalyzeBtn = document.getElementById("pulseformsAnalyzeBtn");
const pulseformsAnalyzeResult = document.getElementById("pulseformsAnalyzeResult");
const pulseformsAddFromAnalysis = document.getElementById("pulseformsAddFromAnalysis");
const pulseformsLayoutGenerateBtn = document.getElementById("pulseformsLayoutGenerateBtn");

const DEFAULT_WIELAND_WIDGET_TO_CONTACT_MAP = {
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

const WIELAND_CONTACT_FIELD_DESCRIPTIONS = [
  ["firstName",           "Employee first name"],
  ["lastName",            "Employee last name"],
  ["phone",               "Primary phone number"],
  ["mobile",              "Alternate phone number"],
  ["email",               "Email address"],
  ["externalId",          "Employee ID — e.g. map to 'email' to pass employee ID through the NCC email column"],
  ["shift_type",          "Shift / cambio"],
  ["trade",               "Trade / role"],
  ["plant_location",      "Plant location (NCC field: addresss)"],
  ["seniority_start_date","Seniority start date (NCC field: dob)"],
  ["seniority_years",     "Computed seniority in years"],
  ["active_status",       "Employment status (NCC field: state)"],
  ["union_eligible",      "Union flag (NCC field: zip — '1' or '0')"],
  ["do_not_call",         "Do not call flag"],
  ["call_priority",       "Computed call priority (NCC field: fax)"],
  ["name",                "Full display name"],
  ["address",             "Address (NCC field name: addresss)"],
  ["city",                "City"],
  ["state",               "State"],
  ["zip",                 "ZIP code"],
  ["dob",                 "Date of birth"],
  ["fax",                 "Fax / priority slot (NCC)"]
];

const fields = {
  id: document.getElementById("campaignId"),
  name: document.getElementById("campaignName"),
  domain: document.getElementById("campaignDomain"),
  apiUrl: document.getElementById("chatApiUrl"),
  workitemApiUrl: document.getElementById("workitemApiUrl"),
  agentChatApiUrl: document.getElementById("agentChatApiUrl"),
  agentUserId: document.getElementById("agentUserId"),
  transcriptRefreshSeconds: document.getElementById("transcriptRefreshSeconds"),
  sentimentProvider: document.getElementById("sentimentProvider"),
  geminiApiKey: document.getElementById("geminiApiKey"),
  geminiModel: document.getElementById("geminiModel"),
  geminiApiUrl: document.getElementById("geminiApiUrl"),
  geminiPrompt: document.getElementById("geminiPrompt"),
  wielandNccCampaignId: document.getElementById("wielandNccCampaignId"),
  wielandSlotsNeeded: document.getElementById("wielandSlotsNeeded"),
  wielandUploadFileName: document.getElementById("wielandUploadFileName"),
  wielandNccFieldmappingId: document.getElementById("wielandNccFieldmappingId"),
  wielandNccAuthType: document.getElementById("wielandNccAuthType"),
  wielandNccCredential: document.getElementById("wielandNccCredential"),
  wielandTabContacts: document.getElementById("wielandTabContacts"),
  wielandTabLists: document.getElementById("wielandTabLists"),
  wielandTabCampaign: document.getElementById("wielandTabCampaign"),
  wielandTabMapping: document.getElementById("wielandTabMapping"),
  wielandListButtonActivate: document.getElementById("wielandListButtonActivate"),
  wielandListButtonAssign: document.getElementById("wielandListButtonAssign"),
  wielandListButtonUpdate: document.getElementById("wielandListButtonUpdate"),
  wielandListButtonRefresh: document.getElementById("wielandListButtonRefresh"),
  wielandListButtonLog: document.getElementById("wielandListButtonLog"),
  wielandListButtonDelete: document.getElementById("wielandListButtonDelete"),
  token: document.getElementById("campaignToken"),
  cookie: document.getElementById("campaignCookie"),
  allowedKbIds: document.getElementById("chatKbIds"),
  sharedLanguage: document.getElementById("sharedLanguage"),
  sharedFontFamily: document.getElementById("sharedFontFamily"),
  sharedBaseFontSize: document.getElementById("sharedBaseFontSize"),
  chatTitleText: document.getElementById("chatTitleText"),
  chatTitleSize: document.getElementById("chatTitleSize"),
  chatMetaSize: document.getElementById("chatMetaSize"),
  chatEmbedMinHeight: document.getElementById("chatEmbedMinHeight"),
  chatEmbedMaxHeight: document.getElementById("chatEmbedMaxHeight"),
  chatShowTitle: document.getElementById("chatShowTitle"),
  chatShowMeta: document.getElementById("chatShowMeta"),
  workitemTitleText: document.getElementById("workitemTitleText"),
  workitemTitleSize: document.getElementById("workitemTitleSize"),
  workitemMetaSize: document.getElementById("workitemMetaSize"),
  workitemEmbedMinHeight: document.getElementById("workitemEmbedMinHeight"),
  workitemEmbedMaxHeight: document.getElementById("workitemEmbedMaxHeight"),
  workitemShowTitle: document.getElementById("workitemShowTitle"),
  workitemShowMeta: document.getElementById("workitemShowMeta"),
  questionsGeminiApiKey: document.getElementById("questionsGeminiApiKey"),
  questionsUseGemini: document.getElementById("questionsUseGemini"),
  clientQuestionsUseGemini: document.getElementById("clientQuestionsUseGemini"),
  clientQuestionsRefreshSeconds: document.getElementById("clientQuestionsRefreshSeconds"),
  questionsGeminiModel: document.getElementById("questionsGeminiModel"),
  questionsGeminiApiUrl: document.getElementById("questionsGeminiApiUrl"),
  questionsGeminiPrompt: document.getElementById("questionsGeminiPrompt"),
  questionsTitleText: document.getElementById("questionsTitleText"),
  questionsTitleSize: document.getElementById("questionsTitleSize"),
  questionsMetaSize: document.getElementById("questionsMetaSize"),
  questionsQuestionSize: document.getElementById("questionsQuestionSize"),
  questionsEvidenceSize: document.getElementById("questionsEvidenceSize"),
  questionsMetaFontSize: document.getElementById("questionsMetaFontSize"),
  questionsEmbedMinHeight: document.getElementById("questionsEmbedMinHeight"),
  questionsEmbedMaxHeight: document.getElementById("questionsEmbedMaxHeight"),
  questionsRefreshIntervalSeconds: document.getElementById("questionsRefreshIntervalSeconds"),
  questionsShowTitle: document.getElementById("questionsShowTitle"),
  questionsShowPageHeader: document.getElementById("questionsShowPageHeader"),
  questionsShowMeta: document.getElementById("questionsShowMeta"),
  questionsShowEvidence: document.getElementById("questionsShowEvidence"),
  questionsShowCardShadow: document.getElementById("questionsShowCardShadow"),
  nextStepTitleText: document.getElementById("nextStepTitleText"),
  nextStepTitleSize: document.getElementById("nextStepTitleSize"),
  nextStepMetaSize: document.getElementById("nextStepMetaSize"),
  nextStepEmbedMinHeight: document.getElementById("nextStepEmbedMinHeight"),
  nextStepEmbedMaxHeight: document.getElementById("nextStepEmbedMaxHeight"),
  nextStepRefreshIntervalSeconds: document.getElementById("nextStepRefreshIntervalSeconds"),
  nextStepShowCardShadow: document.getElementById("nextStepShowCardShadow"),
  nextStepLiveSize: document.getElementById("nextStepLiveSize"),
  nextStepBadgeSize: document.getElementById("nextStepBadgeSize"),
  nextStepKickerSize: document.getElementById("nextStepKickerSize"),
  nextStepActionTitleSize: document.getElementById("nextStepActionTitleSize"),
  nextStepActionTextSize: document.getElementById("nextStepActionTextSize"),
  nextStepSuggestedLabelSize: document.getElementById("nextStepSuggestedLabelSize"),
  nextStepSuggestedTextSize: document.getElementById("nextStepSuggestedTextSize"),
  nextStepButtonTextSize: document.getElementById("nextStepButtonTextSize"),
  nextStepArticleTitleSize: document.getElementById("nextStepArticleTitleSize"),
  nextStepArticleTextSize: document.getElementById("nextStepArticleTextSize"),
  nextStepChipSize: document.getElementById("nextStepChipSize"),
  nextStepReasonSize: document.getElementById("nextStepReasonSize"),
  nextStepMetaFontSize: document.getElementById("nextStepMetaFontSize"),
  nextStepUseGemini: document.getElementById("nextStepUseGemini"),
  nextStepGeminiPrompt: document.getElementById("nextStepGeminiPrompt"),
  sentimentTitleText: document.getElementById("sentimentTitleText"),
  sentimentTitleSize: document.getElementById("sentimentTitleSize"),
  sentimentMetaSize: document.getElementById("sentimentMetaSize"),
  sentimentEmbedMinHeight: document.getElementById("sentimentEmbedMinHeight"),
  sentimentEmbedMaxHeight: document.getElementById("sentimentEmbedMaxHeight"),
  sentimentLayout: document.getElementById("sentimentLayout"),
  sentimentStylePreset: document.getElementById("sentimentStylePreset"),
  sentimentCardMaxWidth: document.getElementById("sentimentCardMaxWidth"),
  sentimentCardMinHeight: document.getElementById("sentimentCardMinHeight"),
  sentimentCardMaxHeight: document.getElementById("sentimentCardMaxHeight"),
  sentimentCardPadding: document.getElementById("sentimentCardPadding"),
  sentimentCardRadius: document.getElementById("sentimentCardRadius"),
  sentimentOrbSize: document.getElementById("sentimentOrbSize"),
  sentimentDualPanelGlowSize: document.getElementById("sentimentDualPanelGlowSize"),
  sentimentDualPanelSectionGap: document.getElementById("sentimentDualPanelSectionGap"),
  sentimentDualPanelTextOrbGap: document.getElementById("sentimentDualPanelTextOrbGap"),
  sentimentDualPanelTextGap: document.getElementById("sentimentDualPanelTextGap"),
  sentimentDualPanelHeartSize: document.getElementById("sentimentDualPanelHeartSize"),
  sentimentCardTitleFontSize: document.getElementById("sentimentCardTitleFontSize"),
  sentimentLabelFontSize: document.getElementById("sentimentLabelFontSize"),
  sentimentScoreFontSize: document.getElementById("sentimentScoreFontSize"),
  sentimentInsightTitleSize: document.getElementById("sentimentInsightTitleSize"),
  sentimentInsightTextSize: document.getElementById("sentimentInsightTextSize"),
  sentimentMetaFontSize: document.getElementById("sentimentMetaFontSize"),
  sentimentDualPanelChartHeight: document.getElementById("sentimentDualPanelChartHeight"),
  sentimentDualPanelChartTopGap: document.getElementById("sentimentDualPanelChartTopGap"),
  sentimentCompactBreakpoint: document.getElementById("sentimentCompactBreakpoint"),
  sentimentCompactCardPadding: document.getElementById("sentimentCompactCardPadding"),
  sentimentCompactOrbSize: document.getElementById("sentimentCompactOrbSize"),
  sentimentCompactTitleFontSize: document.getElementById("sentimentCompactTitleFontSize"),
  sentimentCompactLabelFontSize: document.getElementById("sentimentCompactLabelFontSize"),
  sentimentCompactScoreFontSize: document.getElementById("sentimentCompactScoreFontSize"),
  sentimentCompactInsightTitleSize: document.getElementById("sentimentCompactInsightTitleSize"),
  sentimentCompactInsightTextSize: document.getElementById("sentimentCompactInsightTextSize"),
  sentimentCompactMetaFontSize: document.getElementById("sentimentCompactMetaFontSize"),
  sentimentRefreshIntervalSeconds: document.getElementById("sentimentRefreshIntervalSeconds"),
  sentimentShowTitle: document.getElementById("sentimentShowTitle"),
  sentimentShowPageHeader: document.getElementById("sentimentShowPageHeader"),
  sentimentShowMeta: document.getElementById("sentimentShowMeta"),
  summaryagenticEnabled: document.getElementById("summaryagenticEnabled"),
  summaryagenticCacheSeconds: document.getElementById("summaryagenticCacheSeconds"),
  summaryagenticAiProvider: document.getElementById("summaryagenticAiProvider"),
  summaryagenticAiModel: document.getElementById("summaryagenticAiModel"),
  summaryagenticAiApiKey: document.getElementById("summaryagenticAiApiKey"),
  summaryagenticAiPrompt: document.getElementById("summaryagenticAiPrompt"),
  summaryagenticHubspotEnabled: document.getElementById("summaryagenticHubspotEnabled"),
  summaryagenticHubspotToken: document.getElementById("summaryagenticHubspotToken"),
  summaryagenticWarmToken: document.getElementById("summaryagenticWarmToken"),
  pulseformsEnabled: document.getElementById("pulseformsEnabled"),
  pulseformsMode: document.getElementById("pulseformsMode"),
  pulseformsAiProvider: document.getElementById("pulseformsAiProvider"),
  pulseformsAiModel: document.getElementById("pulseformsAiModel"),
  pulseformsAiApiKey: document.getElementById("pulseformsAiApiKey"),
  pulseformsAiPrompt: document.getElementById("pulseformsAiPrompt")
};

const state = {
  campaigns: [],
  selectedId: "",
  previewTimer: null,
  isDirty: false,
  toastTimer: null,
  currentUser: null
};

function getCurrentPermissions() {
  if (!state.currentUser || state.currentUser.role === "admin") {
    return { createCampaign: true, editCampaign: true, deleteCampaign: true };
  }
  if (!state.currentUser.permissions) {
    return { createCampaign: true, editCampaign: true, deleteCampaign: true };
  }
  return {
    createCampaign: Boolean(state.currentUser.permissions?.createCampaign),
    editCampaign: Boolean(state.currentUser.permissions?.editCampaign),
    deleteCampaign: Boolean(state.currentUser.permissions?.deleteCampaign)
  };
}

function updateAdminPermissionUi() {
  const permissions = getCurrentPermissions();
  newCampaignButton.disabled = !permissions.createCampaign;
  duplicateCampaignButton.disabled = !permissions.createCampaign;
  saveCampaignButton.disabled = state.selectedId ? !permissions.editCampaign : !permissions.createCampaign;
  deleteCampaignButton.disabled = !permissions.deleteCampaign;
}

function markDirty() {
  if (state.isDirty) return;
  state.isDirty = true;
  const activeItem = campaignList.querySelector(".admin-item.active");
  if (activeItem) activeItem.classList.add("admin-dirty");
}

function clearDirty() {
  state.isDirty = false;
  campaignList.querySelectorAll(".admin-item.admin-dirty").forEach((el) => el.classList.remove("admin-dirty"));
}

function showToast(message, isError = false) {
  clearTimeout(state.toastTimer);
  adminToast.textContent = message;
  adminToast.className = "admin-toast admin-toast--visible" + (isError ? " admin-toast--error" : "");
  state.toastTimer = setTimeout(() => {
    adminToast.classList.remove("admin-toast--visible");
  }, 3200);
}

function renderQuestionItems(items) {
  questionItemsContainer.innerHTML = "";
  const list = items.length > 0 ? items : [""];
  for (const text of list) {
    addQuestionRow(text);
  }
}

function addQuestionRow(value = "") {
  const row = document.createElement("div");
  row.className = "question-item-row";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "question-item-input";
  input.placeholder = "Enter a checklist question…";
  input.value = value;
  input.addEventListener("input", () => { markDirty(); schedulePreviewRender(); });
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "question-item-remove";
  removeBtn.textContent = "✕";
  removeBtn.title = "Remove question";
  removeBtn.addEventListener("click", () => {
    row.remove();
    markDirty();
    schedulePreviewRender();
  });
  row.appendChild(input);
  row.appendChild(removeBtn);
  questionItemsContainer.appendChild(row);
}

function readQuestionItems() {
  return Array.from(questionItemsContainer.querySelectorAll(".question-item-input"))
    .map((el) => el.value.trim())
    .filter(Boolean);
}

function renderWielandMappingEditors(widgetMap = {}, contactToListMap = {}) {
  if (wielandWidgetMappingRows) {
    wielandWidgetMappingRows.innerHTML = Object.entries(DEFAULT_WIELAND_WIDGET_TO_CONTACT_MAP).map(([widgetField, defaultContactField]) => `
      <tr>
        <td><span class="admin-mapping-code">${escapeHtml(widgetField)}</span></td>
        <td><input class="admin-mapping-input" type="text" data-wieland-widget-field="${escapeHtml(widgetField)}" value="${escapeHtml(Object.prototype.hasOwnProperty.call(widgetMap, widgetField) ? widgetMap[widgetField] : (defaultContactField || ""))}" /></td>
        <td class="admin-mapping-description">Logical field used by the widget.</td>
      </tr>
    `).join("");
  }

  if (wielandContactToListRows) {
    wielandContactToListRows.innerHTML = WIELAND_CONTACT_FIELD_DESCRIPTIONS.map(([contactField, description]) => {
      const raw = contactToListMap[contactField];
      const val = Array.isArray(raw) ? raw.join(", ") : (raw || "");
      return `<tr>
        <td><span class="admin-mapping-code">${escapeHtml(contactField)}</span></td>
        <td><input class="admin-mapping-input${val ? " admin-mapping-input--filled" : ""}" type="text" data-wieland-contact-field="${escapeHtml(contactField)}" value="${escapeHtml(val)}" placeholder="NCC column (use commas for multiple)" /></td>
        <td class="admin-mapping-description">${escapeHtml(description)}</td>
      </tr>`;
    }).join("");
  }
}

function readWielandWidgetMap() {
  const result = {};
  document.querySelectorAll("[data-wieland-widget-field]").forEach((input) => {
    const key = input.getAttribute("data-wieland-widget-field");
    const value = input.value.trim();
    if (key) result[key] = value;
  });
  return result;
}

function readWielandContactToListMap() {
  const result = {};
  document.querySelectorAll("[data-wieland-contact-field]").forEach((input) => {
    const key = input.getAttribute("data-wieland-contact-field");
    const raw = input.value.trim();
    if (!key || !raw) return;
    const parts = raw.split(",").map((v) => v.trim()).filter(Boolean);
    result[key] = parts.length === 1 ? parts[0] : parts;
  });
  return result;
}

function normalizeWielandVisibleTabs(visibleTabs = {}) {
  return {
    contacts: visibleTabs.contacts !== false,
    lists: visibleTabs.lists !== false,
    campaign: visibleTabs.campaign !== false,
    mapping: visibleTabs.mapping !== false
  };
}

function setWielandVisibleTabs(visibleTabs = {}) {
  const normalized = normalizeWielandVisibleTabs(visibleTabs);
  fields.wielandTabContacts.checked = normalized.contacts;
  fields.wielandTabLists.checked = normalized.lists;
  fields.wielandTabCampaign.checked = normalized.campaign;
  fields.wielandTabMapping.checked = normalized.mapping;
}

function readWielandVisibleTabs() {
  return {
    contacts: fields.wielandTabContacts.checked,
    lists: fields.wielandTabLists.checked,
    campaign: fields.wielandTabCampaign.checked,
    mapping: fields.wielandTabMapping.checked
  };
}

function normalizeWielandListButtons(listButtons = {}) {
  return {
    activate: listButtons.activate !== false,
    assign: listButtons.assign !== false,
    update: listButtons.update !== false,
    refresh: listButtons.refresh !== false,
    log: listButtons.log !== false,
    delete: listButtons.delete !== false
  };
}

function setWielandListButtons(listButtons = {}) {
  const normalized = normalizeWielandListButtons(listButtons);
  fields.wielandListButtonActivate.checked = normalized.activate;
  fields.wielandListButtonAssign.checked = normalized.assign;
  fields.wielandListButtonUpdate.checked = normalized.update;
  fields.wielandListButtonRefresh.checked = normalized.refresh;
  fields.wielandListButtonLog.checked = normalized.log;
  fields.wielandListButtonDelete.checked = normalized.delete;
}

function readWielandListButtons() {
  return {
    activate: fields.wielandListButtonActivate.checked,
    assign: fields.wielandListButtonAssign.checked,
    update: fields.wielandListButtonUpdate.checked,
    refresh: fields.wielandListButtonRefresh.checked,
    log: fields.wielandListButtonLog.checked,
    delete: fields.wielandListButtonDelete.checked
  };
}

// ── Summary Agentic data-source management ───────────────────────────────────
function renderSummaryDataSources(sources) {
  summaryagenticSourcesList.innerHTML = "";
  (sources || []).forEach((src) => addSummarySourceCard(src));
}

function renderPulseFormsDataSources(sources) {
  if (!pulseformsSourcesList) return;
  pulseformsSourcesList.innerHTML = "";
  (sources || []).forEach((src) => addPulseFormsSourceCard(src));
}

function normalizePulseFormsFieldId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function renderPulseFormsFields(fields = []) {
  if (!pulseformsFieldsList) return;
  pulseformsFieldsList.innerHTML = "";
  (fields || []).forEach((field) => addPulseFormsFieldRow(field));
}

function addPulseFormsFieldRow(field = {}) {
  if (!pulseformsFieldsList) return;
  const row = document.createElement("div");
  row.className = "sa-source-card";
  row.style.padding = "12px";
  row.innerHTML = `
    <div class="sa-source-body" style="display:grid;">
      <div class="sa-source-field">
        <label>Field ID</label>
        <input class="pf-form-field-id" type="text" value="${escapeHtml(field.id || "")}" placeholder="phone" />
      </div>
      <div class="sa-source-field">
        <label>Label</label>
        <input class="pf-form-field-label" type="text" value="${escapeHtml(field.label || "")}" placeholder="Phone number" />
      </div>
      <div class="sa-source-field">
        <label>Type</label>
        <select class="pf-form-field-type">
          <option value="text"${(field.type || "text") === "text" ? " selected" : ""}>Text</option>
          <option value="textarea"${field.type === "textarea" ? " selected" : ""}>Textarea</option>
          <option value="number"${field.type === "number" ? " selected" : ""}>Number</option>
          <option value="phone"${field.type === "phone" ? " selected" : ""}>Phone</option>
          <option value="email"${field.type === "email" ? " selected" : ""}>Email</option>
          <option value="date"${field.type === "date" ? " selected" : ""}>Date</option>
          <option value="select"${field.type === "select" ? " selected" : ""}>Select</option>
          <option value="checkbox"${field.type === "checkbox" ? " selected" : ""}>Checkbox</option>
        </select>
      </div>
      <div class="sa-source-field">
        <label>Options</label>
        <input class="pf-form-field-options" type="text" value="${escapeHtml(field.options || "")}" placeholder="Only for select: A, B, C" />
      </div>
      <div class="sa-source-field">
        <label><input class="pf-form-field-required" type="checkbox"${field.required ? " checked" : ""} /> Required</label>
      </div>
      <div class="sa-source-field">
        <button type="button" class="sa-source-remove">Remove field</button>
      </div>
    </div>`;
  const idInput = row.querySelector(".pf-form-field-id");
  const labelInput = row.querySelector(".pf-form-field-label");
  labelInput?.addEventListener("blur", () => {
    if (idInput && !idInput.value.trim()) {
      idInput.value = normalizePulseFormsFieldId(labelInput.value);
      refreshPulseFormsMappingOptions();
      markDirty();
    }
  });
  row.querySelector(".sa-source-remove")?.addEventListener("click", () => {
    row.remove();
    refreshPulseFormsMappingOptions();
    markDirty();
  });
  row.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", () => { refreshPulseFormsMappingOptions(); markDirty(); });
    el.addEventListener("change", () => { refreshPulseFormsMappingOptions(); markDirty(); });
  });
  pulseformsFieldsList.appendChild(row);
}

function readPulseFormsFields() {
  if (!pulseformsFieldsList) return [];
  return Array.from(pulseformsFieldsList.querySelectorAll(".sa-source-card")).map((row) => {
    const label = row.querySelector(".pf-form-field-label")?.value.trim() || "";
    const rawId = row.querySelector(".pf-form-field-id")?.value.trim() || label;
    return {
      id: normalizePulseFormsFieldId(rawId),
      label,
      type: row.querySelector(".pf-form-field-type")?.value || "text",
      required: row.querySelector(".pf-form-field-required")?.checked === true,
      options: row.querySelector(".pf-form-field-options")?.value.trim() || ""
    };
  }).filter((field) => field.id && field.label);
}

function getPulseFormsFieldOptions(selected = "") {
  const fieldsList = readPulseFormsFields();
  const options = ['<option value="">Select form field...</option>'];
  fieldsList.forEach((field) => {
    const label = `${field.label} (${field.id})`;
    options.push(`<option value="${escapeHtml(field.id)}"${field.id === selected ? " selected" : ""}>${escapeHtml(label)}</option>`);
  });
  return options.join("");
}

function addPulseFormsMappingRow(container, formField = "", crmField = "") {
  if (!container) return;
  const row = document.createElement("div");
  row.className = "sa-kv-row pf-mapping-row";
  row.innerHTML = `
    <select class="pf-map-form-field">${getPulseFormsFieldOptions(formField)}</select>
    <input type="text" class="pf-map-crm-field" placeholder="CRM/API field, e.g. phone_work" value="${escapeHtml(crmField)}" />
    <button type="button" class="sa-kv-remove" title="Remove">✕</button>
  `;
  row.querySelector(".sa-kv-remove")?.addEventListener("click", () => {
    row.remove();
    markDirty();
  });
  row.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", markDirty);
    el.addEventListener("change", markDirty);
  });
  container.appendChild(row);
}

function renderPulseFormsMappingRows(container, mappings = {}) {
  if (!container) return;
  container.innerHTML = "";
  const pairs = Array.isArray(mappings)
    ? mappings.map((item) => [item.formField || item.source || "", item.crmField || item.target || ""])
    : Object.entries(mappings || {});
  pairs.forEach(([formField, crmField]) => addPulseFormsMappingRow(container, formField, crmField));
}

function readPulseFormsMappings(container) {
  if (!container) return {};
  return Array.from(container.querySelectorAll(".pf-mapping-row")).reduce((acc, row) => {
    const formField = row.querySelector(".pf-map-form-field")?.value.trim() || "";
    const crmField = row.querySelector(".pf-map-crm-field")?.value.trim() || "";
    if (formField && crmField) acc[formField] = crmField;
    return acc;
  }, {});
}

function refreshPulseFormsMappingOptions() {
  document.querySelectorAll(".pf-map-form-field").forEach((select) => {
    const selected = select.value;
    select.innerHTML = getPulseFormsFieldOptions(selected);
  });
}

function renderPulseFormsSuggestedFields(fields = []) {
  if (!pulseformsSuggestedFieldsList) return;
  pulseformsSuggestedFieldsList.innerHTML = "";
  (fields || []).forEach((field, index) => {
    const card = document.createElement("div");
    card.className = "sa-source-card";
    card.style.padding = "12px";
    card.innerHTML = `
      <label style="display:flex;align-items:flex-start;gap:10px;margin:0;">
        <input class="pf-suggested-field-check" type="checkbox" data-index="${index}" checked style="margin-top:4px;" />
        <span>
          <strong>${escapeHtml(field.label || field.id || "Field")}</strong>
          <span style="display:block;color:#667085;font-size:.82rem;">${escapeHtml(field.id || "")} · ${escapeHtml(field.type || "text")}${field.required ? " · required" : ""}</span>
          ${field.reason ? `<span style="display:block;color:#667085;font-size:.78rem;margin-top:4px;">${escapeHtml(field.reason)}</span>` : ""}
        </span>
      </label>`;
    pulseformsSuggestedFieldsList.appendChild(card);
  });
  pulseformsSuggestedFieldsList.dataset.fields = JSON.stringify(fields || []);
}

function renderPulseFormsJsonFields(fields = []) {
  if (!pulseformsJsonFieldsPreview) return;
  pulseformsJsonFieldsPreview.innerHTML = "";
  (fields || []).forEach((field, index) => {
    const card = document.createElement("div");
    card.className = "sa-source-card";
    card.style.padding = "12px";
    card.innerHTML = `
      <label style="display:flex;align-items:flex-start;gap:10px;margin:0;">
        <input class="pf-json-field-check" type="checkbox" data-index="${index}" checked style="margin-top:4px;" />
        <span>
          <strong>${escapeHtml(field.label || field.id || "Field")}</strong>
          <span style="display:block;color:#667085;font-size:.82rem;">${escapeHtml(field.id || "")} · ${escapeHtml(field.type || "text")}${field.required ? " · required" : ""}</span>
          ${field.reason ? `<span style="display:block;color:#667085;font-size:.78rem;margin-top:4px;">${escapeHtml(field.reason)}</span>` : ""}
        </span>
      </label>`;
    pulseformsJsonFieldsPreview.appendChild(card);
  });
  pulseformsJsonFieldsPreview.dataset.fields = JSON.stringify(fields || []);
}

function addPulseFormsFieldsFromSelection(fieldsSource, selector) {
  const existingIds = new Set(readPulseFormsFields().map((field) => field.id));
  let added = 0;
  document.querySelectorAll(selector).forEach((checkbox) => {
    const idx = Number(checkbox.dataset.index);
    const field = fieldsSource[idx];
    if (!field) return;
    const id = normalizePulseFormsFieldId(field.id || field.label);
    if (!id || existingIds.has(id)) return;
    existingIds.add(id);
    addPulseFormsFieldRow({ ...field, id });
    added += 1;
  });
  refreshPulseFormsMappingOptions();
  markDirty();
  return added;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function shouldReadPulseFormsFileAsText(file) {
  const type = String(file.type || "").toLowerCase();
  return type.startsWith("text/")
    || ["application/json", "application/xml", "text/csv"].includes(type)
    || /\.(txt|csv|json|md|xml)$/i.test(file.name || "");
}

async function readPulseFormsDiscoveryFiles(fileList) {
  const files = Array.from(fileList || []);
  const maxBytes = 5 * 1024 * 1024;
  const selected = [];
  for (const file of files) {
    if (file.size > maxBytes) {
      throw new Error(`${file.name} supera 5 MB.`);
    }
    const item = {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size
    };
    if (shouldReadPulseFormsFileAsText(file)) {
      item.text = (await readFileAsText(file)).slice(0, 40000);
    } else {
      const dataUrl = await readFileAsDataUrl(file);
      item.base64 = dataUrl.split(",")[1] || "";
    }
    selected.push(item);
  }
  return selected;
}

function normalizePulseFormsImportedField(field = {}) {
  const label = String(field.label || field.name || field.id || "").trim();
  const id = normalizePulseFormsFieldId(field.id || field.name || label);
  const validTypes = new Set(["text", "textarea", "number", "phone", "email", "date", "select", "checkbox"]);
  const rawType = String(field.type || "text").toLowerCase();
  const mappedType = rawType === "dropdown" || rawType === "picklist" ? "select" : rawType;
  const type = validTypes.has(mappedType) ? mappedType : "text";
  return {
    id,
    label,
    type,
    required: field.required === true,
    options: Array.isArray(field.options) ? field.options.join(", ") : String(field.options || "").trim(),
    reason: String(field.reason || field.description || "").trim()
  };
}

function parsePulseFormsFieldsJson(rawJson) {
  const parsed = JSON.parse(String(rawJson || "").trim());
  const fields = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.fields)
      ? parsed.fields
      : Array.isArray(parsed.formFields)
        ? parsed.formFields
        : Array.isArray(parsed.suggestedFields)
          ? parsed.suggestedFields
          : [];
  return fields.map(normalizePulseFormsImportedField).filter((field) => field.id && field.label);
}

function addHeaderRow(container, key = "", value = "") {
  const row = document.createElement("div");
  row.className = "sa-kv-row";
  row.innerHTML = `
    <input type="text" class="sa-kv-key" placeholder="Header name" value="${escapeHtml(key)}" />
    <input type="text" class="sa-kv-val" placeholder="Value" value="${escapeHtml(value)}" />
    <button type="button" class="sa-kv-remove" title="Remove">✕</button>
  `;
  row.querySelector(".sa-kv-remove").addEventListener("click", () => {
    row.remove();
    markDirty();
  });
  row.querySelectorAll("input").forEach((el) => el.addEventListener("input", markDirty));
  container.appendChild(row);
}

function addParamRow(container, key = "", value = "") {
  const row = document.createElement("div");
  row.className = "sa-kv-row";
  row.innerHTML = `
    <input type="text" class="sa-kv-key" placeholder="Param name" value="${escapeHtml(key)}" />
    <input type="text" class="sa-kv-val" placeholder="Value" value="${escapeHtml(value)}" />
    <button type="button" class="sa-kv-remove" title="Remove">✕</button>
  `;
  row.querySelector(".sa-kv-remove").addEventListener("click", () => {
    row.remove();
    markDirty();
  });
  row.querySelectorAll("input").forEach((el) => el.addEventListener("input", markDirty));
  container.appendChild(row);
}

function readParamsKv(container) {
  if (!container) return "";
  const lines = [];
  container.querySelectorAll(".sa-kv-row").forEach((row) => {
    const k = row.querySelector(".sa-kv-key")?.value.trim();
    const v = row.querySelector(".sa-kv-val")?.value.trim();
    if (k) lines.push(`${k}=${v || ""}`);
  });
  return lines.join("\n");
}

function readHeadersKv(container) {
  if (!container) return "{}";
  const obj = {};
  container.querySelectorAll(".sa-kv-row").forEach((row) => {
    const k = row.querySelector(".sa-kv-key")?.value.trim();
    const v = row.querySelector(".sa-kv-val")?.value.trim();
    if (k) obj[k] = v || "";
  });
  return JSON.stringify(obj);
}

function parseAdminFixedParams(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf("=");
      return idx === -1 ? [line, ""] : [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
    .filter(([key]) => key);
}

function addSummarySourceCard(src = {}) {
  const id = src.id || crypto.randomUUID();
  const card = document.createElement("div");
  card.className = "sa-source-card";
  card.dataset.sourceId = id;

  card.innerHTML = `
    <div class="sa-source-card-header">
      <strong class="sa-source-name-label">${escapeHtml(src.name || "New source")}</strong>
      <button type="button" class="sa-source-toggle">▲ Collapse</button>
      <button type="button" class="sa-source-remove">✕ Remove</button>
    </div>
    <div class="sa-source-body">
      <div class="sa-source-field">
        <label>Name</label>
        <input class="sa-field-name" type="text" value="${escapeHtml(src.name || "")}" placeholder="e.g. CRM History" />
      </div>
      <div class="sa-source-field">
        <label>Method</label>
        <select class="sa-field-method">
          <option value="GET"${(src.method || "GET") === "GET" ? " selected" : ""}>GET</option>
          <option value="POST"${src.method === "POST" ? " selected" : ""}>POST</option>
        </select>
      </div>
      <div class="sa-source-field sa-source-field--full">
        <label>URL (use <code>{{phone}}</code> / <code>{{customer_id}}</code>)</label>
        <input class="sa-field-url" type="text" value="${escapeHtml(src.url || "")}" placeholder="https://api.example.com/calls?phone={{phone}}" />
      </div>
      <div class="sa-source-field sa-source-field--full">
        <label>Headers</label>
        <div class="sa-headers-kv"></div>
        <button type="button" class="sa-add-header-btn">+ Add header</button>
      </div>
      <div class="sa-source-field sa-source-field--full">
        <label>Body template (POST only, JSON)</label>
        <textarea class="sa-field-body" rows="2" placeholder='{"phone":"{{phone}}"}'>${escapeHtml(src.bodyTemplate || "")}</textarea>
      </div>
      <div class="sa-source-field sa-source-field--full">
        <label>Fixed params <span style="font-weight:400;color:var(--muted)">(siempre aplicados, URL params los sobreescriben)</span></label>
        <div class="sa-params-kv"></div>
        <button type="button" class="sa-add-param-btn">+ Add param</button>
      </div>
      <div class="sa-source-field sa-source-field--full">
        <label>¿Qué información contiene este endpoint? <span style="font-weight:400;color:var(--muted)">(ayuda a la IA a interpretar los datos)</span></label>
        <textarea class="sa-field-description" rows="2" placeholder="Ej: Historial de llamadas del cliente — incluye fecha, duración, motivo, agente asignado y estado de resolución.">${escapeHtml(src.description || "")}</textarea>
      </div>
      <div class="sa-source-field sa-source-field--full">
        <label><input class="sa-field-enabled" type="checkbox"${src.enabled !== false ? " checked" : ""} /> Enabled</label>
      </div>
    </div>
    <div class="sa-wlib-panel" style="display:none;">
      <div class="sa-wlib-tabs">
        <button type="button" class="sa-wlib-tab sa-wlib-tab--active" data-tab="templates">📐 Plantillas</button>
        <button type="button" class="sa-wlib-tab" data-tab="chat">💬 Chat</button>
        <button type="button" class="sa-wlib-tab" data-tab="saved">⭐ Mis widgets</button>
      </div>
      <div class="sa-wlib-body">
        <div class="sa-wlib-pane" data-pane="templates"></div>
        <div class="sa-wlib-pane sa-wlib-pane--hidden" data-pane="chat">
          <textarea class="sa-wlib-chat-input" rows="2" placeholder="Ej: Quiero ver el total de llamadas perdidas esta semana como un indicador de riesgo"></textarea>
          <button type="button" class="sa-wlib-chat-send">Generar widget</button>
          <div class="sa-wlib-chat-result" style="display:none;"></div>
        </div>
        <div class="sa-wlib-pane sa-wlib-pane--hidden" data-pane="saved"></div>
      </div>
    </div>
    <button type="button" class="sa-wlib-toggle">📐 Widget library</button>
    <div class="sa-test-bar">
      <span style="font-size:.82rem;font-weight:600;color:var(--muted);">Test phone:</span>
      <input class="sa-test-phone" type="text" placeholder="+15551234567" value="${escapeHtml(src.testPhone || "")}" style="max-width:160px;" />
      <span style="font-size:.82rem;font-weight:600;color:var(--muted);">Extra params:</span>
      <input class="sa-test-extra" type="text" placeholder="date_from=2024-01-01&agent_id=A1" style="flex:2;" />
      <button type="button" class="sa-test-btn">Test endpoint</button>
      <button type="button" class="sa-suggest-btn" title="Pide a la IA que sugiera qué mostrar">✨ Sugerir secciones</button>
      <button type="button" class="sa-curl-btn">cURL</button>
      <div class="sa-test-result" style="display:none;"></div>
      <div class="sa-suggestions-panel" style="display:none;"></div>
      <div class="sa-curl-box" style="display:none;">
        <textarea class="sa-curl-output" rows="5" readonly></textarea>
        <button type="button" class="sa-curl-copy">📋 Copy</button>
      </div>
    </div>
  `;

  const nameInput = card.querySelector(".sa-field-name");
  const nameLabel = card.querySelector(".sa-source-name-label");
  const bodyEl = card.querySelector(".sa-source-body");
  const toggleBtn = card.querySelector(".sa-source-toggle");
  const removeBtn = card.querySelector(".sa-source-remove");
  const testBtn = card.querySelector(".sa-test-btn");
  const suggestBtn = card.querySelector(".sa-suggest-btn");
  const testResult = card.querySelector(".sa-test-result");
  const suggestionsPanel = card.querySelector(".sa-suggestions-panel");
  const curlBtn = card.querySelector(".sa-curl-btn");
  const curlBox = card.querySelector(".sa-curl-box");
  const curlOutput = card.querySelector(".sa-curl-output");
  const curlCopy = card.querySelector(".sa-curl-copy");
  const headersKv = card.querySelector(".sa-headers-kv");
  const addHeaderBtn = card.querySelector(".sa-add-header-btn");
  const paramsKv = card.querySelector(".sa-params-kv");
  const addParamBtn = card.querySelector(".sa-add-param-btn");
  const wlibToggleBtn = card.querySelector(".sa-wlib-toggle");
  const wlibPanel = card.querySelector(".sa-wlib-panel");
  const wlibTabs = card.querySelectorAll(".sa-wlib-tab");
  const wlibPanes = card.querySelectorAll(".sa-wlib-pane");
  const wlibTemplatesPane = card.querySelector('.sa-wlib-pane[data-pane="templates"]');
  const wlibChatPane = card.querySelector('.sa-wlib-pane[data-pane="chat"]');
  const wlibSavedPane = card.querySelector('.sa-wlib-pane[data-pane="saved"]');
  const wlibChatInput = card.querySelector(".sa-wlib-chat-input");
  const wlibChatSend = card.querySelector(".sa-wlib-chat-send");
  const wlibChatResult = card.querySelector(".sa-wlib-chat-result");

  // Populate headers
  try {
    const existing = JSON.parse(src.headersJson || "{}");
    Object.entries(existing).forEach(([k, v]) => addHeaderRow(headersKv, k, v));
  } catch { /* ignore */ }

  addHeaderBtn.addEventListener("click", () => {
    addHeaderRow(headersKv, "", "");
    markDirty();
  });

  // Populate fixed params from "key=value\n" string
  (src.fixedParams || "").split(/\n/).forEach((line) => {
    const eq = line.indexOf("=");
    if (eq === -1) return;
    addParamRow(paramsKv, line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  });

  addParamBtn.addEventListener("click", () => {
    addParamRow(paramsKv, "", "");
    markDirty();
  });

  // ── Saved suggestions restore ────────────────────────────────────────────
  let _lastTestData = null;

  function renderSuggestions(suggestions, accepted = new Set()) {
    suggestionsPanel.innerHTML = "";
    if (!suggestions?.length) { suggestionsPanel.style.display = "none"; return; }

    const SECTION_TYPE_LABELS = { kv: "Key-Value", calllog: "Historial de llamadas", caselist: "Casos/Tickets", flags: "Indicadores", recommendation: "Recomendación", text: "Texto" };
    const wrap = document.createElement("div");
    wrap.className = "sa-sug-wrap";

    const head = document.createElement("div");
    head.className = "sa-sug-head";
    head.innerHTML = `<span>✨ Secciones sugeridas por la IA — selecciona las que quieres incluir:</span>`;
    wrap.appendChild(head);

    suggestions.forEach((s, idx) => {
      const isAccepted = accepted.size === 0 || accepted.has(s.id);
      const card2 = document.createElement("div");
      card2.className = "sa-sug-card" + (isAccepted ? " sa-sug-card--accepted" : "");
      card2.dataset.sugId = s.id;

      const previewRows = (s.preview || []).slice(0, 4).map((p) =>
        `<div class="sa-sug-preview-row"><span class="sa-sug-preview-label">${escapeHtml(p.label)}</span><span class="sa-sug-preview-value">${escapeHtml(String(p.value ?? ""))}</span></div>`
      ).join("");

      card2.innerHTML = `
        <div class="sa-sug-card-top">
          <label class="sa-sug-check-label">
            <input type="checkbox" class="sa-sug-check" data-sug-idx="${idx}" ${isAccepted ? "checked" : ""} />
            <span class="sa-sug-icon">${escapeHtml(s.icon || "📄")}</span>
            <span class="sa-sug-title">${escapeHtml(s.title)}</span>
            <span class="sa-sug-type-badge">${escapeHtml(SECTION_TYPE_LABELS[s.type] || s.type)}</span>
          </label>
          <span class="sa-sug-placement">${s.placement === "left" ? "← Izquierda" : "→ Derecha"}</span>
        </div>
        <div class="sa-sug-rationale">${escapeHtml(s.rationale || "")}</div>
        ${previewRows ? `<div class="sa-sug-preview">${previewRows}</div>` : ""}
      `;

      card2.querySelector(".sa-sug-check").addEventListener("change", () => {
        card2.classList.toggle("sa-sug-card--accepted", card2.querySelector(".sa-sug-check").checked);
        markDirty();
      });

      wrap.appendChild(card2);
    });

    suggestionsPanel.appendChild(wrap);
    suggestionsPanel.style.display = "block";
  }

  // Restore from saved state
  if (Array.isArray(src.suggestions) && src.suggestions.length > 0) {
    const accepted = new Set((src.selectedFields || []).map((f) => String(f)));
    renderSuggestions(src.suggestions, accepted);
  }

  // ── Suggest button ───────────────────────────────────────────────────────
  suggestBtn.addEventListener("click", async () => {
    if (!_lastTestData) {
      alert("Primero haz clic en 'Test endpoint' para obtener datos del API.");
      return;
    }
    const campaignId = (document.getElementById("campaignId")?.value || "").trim();
    const sourceName = card.querySelector(".sa-field-name")?.value.trim() || "Data source";
    const description = card.querySelector(".sa-field-description")?.value.trim() || "";

    suggestBtn.disabled = true;
    suggestBtn.textContent = "✨ Analizando…";
    suggestionsPanel.style.display = "none";

    try {
      const result = await apiRequest("/api/summaryagentic/suggest-fields", {
        method: "POST",
        body: JSON.stringify({ data: _lastTestData, sourceName, description, campaignId })
      });
      card.dataset.suggestions = JSON.stringify(result.suggestions || []);
      renderSuggestions(result.suggestions || [], new Set());
      markDirty();
    } catch (err) {
      alert("Error al sugerir secciones: " + err.message);
    } finally {
      suggestBtn.disabled = false;
      suggestBtn.textContent = "✨ Sugerir secciones";
    }
  });

  // ── Widget Library ───────────────────────────────────────────────────────
  const WIDGET_TEMPLATES_CLIENT = [
    { id: "profile_kv",     icon: "👤", title: "Perfil del cliente",      desc: "Nombre, teléfono, email, dirección" },
    { id: "recent_calls",   icon: "📞", title: "Historial de llamadas",   desc: "Fecha, motivo, agente, duración, estado" },
    { id: "metrics",        icon: "📊", title: "Métricas rápidas",        desc: "Totales de llamadas, chats, SMS" },
    { id: "open_cases",     icon: "📋", title: "Casos abiertos",          desc: "Tickets activos con estado y descripción" },
    { id: "risk_flags",     icon: "🚩", title: "Indicadores de riesgo",   desc: "Quejas, escalaciones, patrones de riesgo" },
    { id: "notes",          icon: "📝", title: "Notas del cliente",       desc: "Observaciones y comentarios internos" },
    { id: "recommendation", icon: "💡", title: "Recomendación al agente", desc: "Sugerencia de acción basada en el historial" },
    { id: "subscriptions",  icon: "💳", title: "Suscripciones activas",   desc: "Productos, planes y servicios contratados" },
  ];

  const SECTION_TYPE_LABELS_WLIB = { kv: "Key-Value", calllog: "Historial de llamadas", caselist: "Casos/Tickets", flags: "Indicadores", recommendation: "Recomendación", text: "Texto" };

  // Switch tabs
  wlibTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      wlibTabs.forEach((t) => t.classList.remove("sa-wlib-tab--active"));
      wlibPanes.forEach((p) => p.classList.add("sa-wlib-pane--hidden"));
      tab.classList.add("sa-wlib-tab--active");
      const pane = card.querySelector(`.sa-wlib-pane[data-pane="${tab.dataset.tab}"]`);
      if (pane) pane.classList.remove("sa-wlib-pane--hidden");
    });
  });

  // Toggle panel
  wlibToggleBtn.addEventListener("click", () => {
    const isHidden = wlibPanel.style.display === "none";
    wlibPanel.style.display = isHidden ? "block" : "none";
  });

  // Render a suggestion card (reusable for template/chat results)
  function renderWlibSuggestionCard(suggestion, container, onAccept) {
    container.innerHTML = "";
    const previewRows = (suggestion.preview || []).slice(0, 4).map((p) =>
      `<div class="sa-sug-preview-row"><span class="sa-sug-preview-label">${escapeHtml(p.label)}</span><span class="sa-sug-preview-value">${escapeHtml(String(p.value ?? ""))}</span></div>`
    ).join("");
    const wrap = document.createElement("div");
    wrap.className = "sa-sug-card sa-sug-card--accepted";
    wrap.innerHTML = `
      <div class="sa-sug-card-top">
        <span class="sa-sug-icon">${escapeHtml(suggestion.icon || "📄")}</span>
        <span class="sa-sug-title">${escapeHtml(suggestion.title)}</span>
        <span class="sa-sug-type-badge">${escapeHtml(SECTION_TYPE_LABELS_WLIB[suggestion.type] || suggestion.type)}</span>
        <span class="sa-sug-placement">${suggestion.placement === "left" ? "← Izquierda" : "→ Derecha"}</span>
      </div>
      <div class="sa-sug-rationale">${escapeHtml(suggestion.rationale || "")}</div>
      ${previewRows ? `<div class="sa-sug-preview">${previewRows}</div>` : ""}
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button type="button" class="sa-wlib-accept-btn" style="background:rgba(24,178,107,.1);border:none;border-radius:6px;padding:4px 12px;font-size:.75rem;font-weight:700;color:#18b26b;cursor:pointer;font-family:inherit;">✓ Agregar</button>
        <button type="button" class="sa-wlib-discard-btn" style="background:none;border:1px solid rgba(229,57,53,.25);border-radius:6px;padding:4px 10px;font-size:.75rem;color:#e53935;cursor:pointer;font-family:inherit;">✕ Descartar</button>
      </div>
    `;
    wrap.querySelector(".sa-wlib-accept-btn").addEventListener("click", () => {
      onAccept(suggestion);
      container.innerHTML = "";
      container.style.display = "none";
    });
    wrap.querySelector(".sa-wlib-discard-btn").addEventListener("click", () => {
      container.innerHTML = "";
      container.style.display = "none";
    });
    container.appendChild(wrap);
    container.style.display = "block";
  }

  // Accept a widget: add to suggestions panel + save to library
  async function acceptWidget(suggestion) {
    const campaignId = (document.getElementById("campaignId")?.value || "").trim();

    // Add to suggestions panel
    let existing = [];
    try { existing = JSON.parse(card.dataset.suggestions || "[]"); } catch { existing = []; }
    // Dedup by id
    existing = existing.filter((s) => s.id !== suggestion.id);
    existing.push(suggestion);
    card.dataset.suggestions = JSON.stringify(existing);
    const acceptedSet = new Set(Array.from(card.querySelectorAll(".sa-sug-check:checked")).map((cb) => {
      const idx = parseInt(cb.dataset.sugIdx);
      try { const sugs = JSON.parse(card.dataset.suggestions || "[]"); return sugs[idx]?.id; } catch { return null; }
    }).filter(Boolean));
    acceptedSet.add(suggestion.id);
    renderSuggestions(existing, acceptedSet);
    markDirty();

    // Save to campaign widget library
    if (campaignId) {
      try {
        const result = await apiRequest("/api/summaryagentic/save-widget", {
          method: "POST",
          body: JSON.stringify({ campaignId, widget: suggestion })
        });
        // Refresh saved pane in all cards
        if (result.library) {
          summaryagenticSourcesList.dataset.widgetLibrary = JSON.stringify(result.library);
          summaryagenticSourcesList.querySelectorAll(".sa-source-card").forEach((c) => {
            const savedPane = c.querySelector('.sa-wlib-pane[data-pane="saved"]');
            if (savedPane) renderWlibSavedPane(savedPane, result.library);
          });
        }
      } catch (err) {
        console.error("Failed to save widget to library:", err);
      }
    }
  }

  // Render saved pane
  function renderWlibSavedPane(pane, library) {
    pane.innerHTML = "";
    const campaignId = (document.getElementById("campaignId")?.value || "").trim();
    if (!library || library.length === 0) {
      pane.innerHTML = `<div style="font-size:.78rem;color:#888;padding:8px 0;">No hay widgets guardados aún.</div>`;
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "sa-wlib-saved";
    library.forEach((w) => {
      const item = document.createElement("div");
      item.className = "sa-wlib-saved-item";
      item.innerHTML = `
        <span class="sa-wlib-saved-icon">${escapeHtml(w.icon || "📄")}</span>
        <div class="sa-wlib-saved-info">
          <div class="sa-wlib-saved-title">${escapeHtml(w.title)}</div>
          <div class="sa-wlib-saved-type">${escapeHtml(SECTION_TYPE_LABELS_WLIB[w.type] || w.type)} · ${w.placement === "left" ? "← Izquierda" : "→ Derecha"}</div>
        </div>
        <button type="button" class="sa-wlib-saved-add">Agregar</button>
        <button type="button" class="sa-wlib-saved-del">🗑 Eliminar</button>
      `;
      item.querySelector(".sa-wlib-saved-add").addEventListener("click", () => {
        let existing = [];
        try { existing = JSON.parse(card.dataset.suggestions || "[]"); } catch { existing = []; }
        existing = existing.filter((s) => s.id !== w.id);
        existing.push(w);
        card.dataset.suggestions = JSON.stringify(existing);
        const acceptedSet = new Set(Array.from(card.querySelectorAll(".sa-sug-check:checked")).map((cb) => {
          const idx2 = parseInt(cb.dataset.sugIdx);
          try { const sugs = JSON.parse(card.dataset.suggestions || "[]"); return sugs[idx2]?.id; } catch { return null; }
        }).filter(Boolean));
        acceptedSet.add(w.id);
        renderSuggestions(existing, acceptedSet);
        markDirty();
      });
      item.querySelector(".sa-wlib-saved-del").addEventListener("click", async () => {
        if (!confirm(`¿Eliminar "${w.title}" de la biblioteca?`)) return;
        if (!campaignId) return;
        try {
          await apiRequest("/api/summaryagentic/save-widget", {
            method: "DELETE",
            body: JSON.stringify({ campaignId, widgetId: w.id })
          });
          const newLibrary = library.filter((x) => x.id !== w.id);
          summaryagenticSourcesList.dataset.widgetLibrary = JSON.stringify(newLibrary);
          summaryagenticSourcesList.querySelectorAll(".sa-source-card").forEach((c) => {
            const savedPane2 = c.querySelector('.sa-wlib-pane[data-pane="saved"]');
            if (savedPane2) renderWlibSavedPane(savedPane2, newLibrary);
          });
        } catch (err) {
          alert("Error al eliminar widget: " + err.message);
        }
      });
      wrap.appendChild(item);
    });
    pane.appendChild(wrap);
  }

  // Render templates pane
  function renderWlibTemplatesPane() {
    wlibTemplatesPane.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "sa-wlib-templates";
    WIDGET_TEMPLATES_CLIENT.forEach((tpl) => {
      const tplCard = document.createElement("div");
      tplCard.className = "sa-wlib-tpl-card";
      tplCard.innerHTML = `
        <span class="sa-wlib-tpl-icon">${escapeHtml(tpl.icon)}</span>
        <span class="sa-wlib-tpl-title">${escapeHtml(tpl.title)}</span>
        <span class="sa-wlib-tpl-desc">${escapeHtml(tpl.desc)}</span>
        <button type="button" class="sa-wlib-tpl-btn" data-tpl-id="${escapeHtml(tpl.id)}">Generar</button>
      `;
      const genBtn = tplCard.querySelector(".sa-wlib-tpl-btn");
      genBtn.addEventListener("click", async () => {
        if (!_lastTestData) { alert("Primero haz clic en 'Test endpoint' para obtener datos del API."); return; }
        const campaignId = (document.getElementById("campaignId")?.value || "").trim();
        const sourceName = card.querySelector(".sa-field-name")?.value.trim() || "Data source";
        const description = card.querySelector(".sa-field-description")?.value.trim() || "";
        genBtn.disabled = true;
        genBtn.textContent = "Generando…";
        // Show result area near this template card
        const resultArea = document.createElement("div");
        tplCard.appendChild(resultArea);
        try {
          const result = await apiRequest("/api/summaryagentic/widget-from-template", {
            method: "POST",
            body: JSON.stringify({ templateId: tpl.id, data: _lastTestData, sourceName, description, campaignId })
          });
          renderWlibSuggestionCard(result.suggestion, resultArea, acceptWidget);
        } catch (err) {
          alert("Error al generar widget: " + err.message);
          tplCard.removeChild(resultArea);
        } finally {
          genBtn.disabled = false;
          genBtn.textContent = "Generar";
        }
      });
      grid.appendChild(tplCard);
    });
    wlibTemplatesPane.appendChild(grid);
  }

  renderWlibTemplatesPane();

  // Populate saved pane from dataset
  const initialLibrary = (() => {
    try { return JSON.parse(summaryagenticSourcesList.dataset.widgetLibrary || "[]"); } catch { return []; }
  })();
  renderWlibSavedPane(wlibSavedPane, initialLibrary);

  // Chat send
  wlibChatSend.addEventListener("click", async () => {
    const message = wlibChatInput.value.trim();
    if (!message) { alert("Escribe qué widget quieres crear."); return; }
    if (!_lastTestData) { alert("Primero haz clic en 'Test endpoint' para obtener datos del API."); return; }
    const campaignId = (document.getElementById("campaignId")?.value || "").trim();
    const sourceName = card.querySelector(".sa-field-name")?.value.trim() || "Data source";
    const description = card.querySelector(".sa-field-description")?.value.trim() || "";
    wlibChatSend.disabled = true;
    wlibChatSend.textContent = "Generando…";
    wlibChatResult.style.display = "none";
    try {
      const result = await apiRequest("/api/summaryagentic/widget-from-chat", {
        method: "POST",
        body: JSON.stringify({ message, data: _lastTestData, sourceName, description, campaignId })
      });
      renderWlibSuggestionCard(result.suggestion, wlibChatResult, acceptWidget);
    } catch (err) {
      alert("Error al generar widget: " + err.message);
    } finally {
      wlibChatSend.disabled = false;
      wlibChatSend.textContent = "Generar widget";
    }
  });

  nameInput.addEventListener("input", () => {
    nameLabel.textContent = nameInput.value || "New source";
    markDirty();
  });

  card.querySelectorAll("input, select, textarea").forEach((el) => {
    el.addEventListener("input", markDirty);
    el.addEventListener("change", markDirty);
  });

  toggleBtn.addEventListener("click", () => {
    const collapsed = bodyEl.classList.toggle("sa-source-body--hidden");
    toggleBtn.textContent = collapsed ? "▼ Expand" : "▲ Collapse";
  });

  removeBtn.addEventListener("click", () => {
    if (!confirm(`Remove data source "${nameInput.value || "this source"}"?`)) return;
    card.remove();
    markDirty();
  });

  curlBtn.addEventListener("click", () => {
    const sourceUrl  = card.querySelector(".sa-field-url").value.trim();
    const method     = card.querySelector(".sa-field-method").value || "GET";
    const bodyTpl    = card.querySelector(".sa-field-body").value.trim();
    const testPhone  = card.querySelector(".sa-test-phone").value.trim() || "PHONE";
    const extraRaw   = card.querySelector(".sa-test-extra").value.trim();

    // Build merged vars (same logic as backend)
    const fixedStr   = readParamsKv(card.querySelector(".sa-params-kv"));
    const fixedLines = fixedStr.split("\n").filter(Boolean);
    const vars = { phone: testPhone, customer_id: testPhone };
    fixedLines.forEach((line) => {
      const eq = line.indexOf("=");
      if (eq !== -1) vars[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    });
    if (extraRaw) {
      extraRaw.split("&").forEach((pair) => {
        const [k, v] = pair.split("=");
        if (k) vars[k.trim()] = (v || "").trim();
      });
    }

    // Interpolate template
    function interpolate(tpl) {
      return tpl.replace(/\{\{([^}]+)\}\}/g, (_, k) => vars[k.trim()] ?? `{{${k.trim()}}}`);
    }

    // Build URL with fixed params appended
    let finalUrl = interpolate(sourceUrl);
    try {
      const INTERNAL = new Set(["days"]);
      const urlObj = new URL(finalUrl);
      fixedLines.forEach((line) => {
        const eq = line.indexOf("=");
        if (eq === -1) return;
        const k = line.slice(0, eq).trim();
        const v = interpolate(line.slice(eq + 1).trim());
        if (!INTERNAL.has(k) && !urlObj.searchParams.has(k)) urlObj.searchParams.set(k, v);
      });
      finalUrl = urlObj.toString();
    } catch { /* leave as-is */ }

    // Build headers
    const headersObj = JSON.parse(readHeadersKv(card.querySelector(".sa-headers-kv")) || "{}");
    const headerLines = Object.entries(headersObj)
      .map(([k, v]) => `--header '${k}: ${v}'`)
      .join(" \\\n");

    // Build body
    const bodyLine = (method === "POST" && bodyTpl)
      ? `\\\n--data '${interpolate(bodyTpl)}'`
      : "";

    const curl = [
      `curl --location '${finalUrl}'`,
      headerLines,
      bodyLine
    ].filter(Boolean).join(" \\\n");

    curlOutput.value = curl;
    curlBox.style.display = "block";
    testResult.style.display = "none";
  });

  curlCopy.addEventListener("click", () => {
    navigator.clipboard.writeText(curlOutput.value).then(() => {
      curlCopy.textContent = "✓ Copied!";
      setTimeout(() => { curlCopy.textContent = "📋 Copy"; }, 1500);
    });
  });

  testBtn.addEventListener("click", async () => {
    const sourceUrl = card.querySelector(".sa-field-url").value.trim();
    const method = card.querySelector(".sa-field-method").value;
    const headersJson = readHeadersKv(card.querySelector(".sa-headers-kv"));
    const bodyTemplate = card.querySelector(".sa-field-body").value.trim();
    const testPhone = card.querySelector(".sa-test-phone").value.trim() || "1234567890";
    const extraRaw = card.querySelector(".sa-test-extra").value.trim();

    // Parse extra params: "date_from=2024-01-01&agent_id=A1" → { date_from: "2024-01-01", agent_id: "A1" }
    const extraParams = {};
    if (extraRaw) {
      for (const pair of extraRaw.split("&")) {
        const [k, v] = pair.split("=");
        if (k) extraParams[k.trim()] = (v || "").trim();
      }
    }

    if (!sourceUrl) {
      testResult.style.display = "block";
      testResult.textContent = "Please enter a URL first.";
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = "Testing…";
    testResult.style.display = "block";
    testResult.textContent = "Calling endpoint…";

    try {
      const data = await apiRequest("/api/summaryagentic/test-source", {
        method: "POST",
        body: JSON.stringify({ url: sourceUrl, method, headersJson, bodyTemplate, testPhone, extraParams })
      });

      // Save data for suggest button
      _lastTestData = data.data;

      // Show compact preview
      testResult.style.display = "block";
      const raw = JSON.stringify(data.data, null, 2);
      testResult.textContent = raw.slice(0, 600) + (raw.length > 600 ? "\n…" : "");
      suggestBtn.style.display = "inline-block";
    } catch (err) {
      testResult.style.display = "block";
      testResult.textContent = "Error: " + err.message;
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = "Test endpoint";
    }
  });

  summaryagenticSourcesList.appendChild(card);
}

function addPulseFormsSourceCard(src = {}) {
  if (!pulseformsSourcesList) return;
  const id = src.id || crypto.randomUUID();
  const card = document.createElement("div");
  card.className = "sa-source-card";
  card.dataset.sourceId = id;
  card.innerHTML = `
    <div class="sa-source-card-header">
      <strong class="sa-source-name-label">${escapeHtml(src.name || "New PulseForms source")}</strong>
      <button type="button" class="sa-source-toggle">▲ Collapse</button>
      <button type="button" class="sa-source-remove">✕ Remove</button>
    </div>
    <div class="sa-source-body">
      <div class="sa-source-field">
        <label>Name</label>
        <input class="sa-field-name" type="text" value="${escapeHtml(src.name || "")}" placeholder="Sugar CRM Contacts" />
      </div>
      <div class="sa-source-field">
        <label>Mode</label>
        <select class="pf-field-mode">
          <option value="query"${(src.mode || "query") === "query" ? " selected" : ""}>Query</option>
          <option value="submit"${src.mode === "submit" ? " selected" : ""}>Submit</option>
        </select>
      </div>
      <div class="sa-source-field">
        <label>Method</label>
        <select class="sa-field-method">
          <option value="GET"${(src.method || "GET") === "GET" ? " selected" : ""}>GET</option>
          <option value="POST"${src.method === "POST" ? " selected" : ""}>POST</option>
          <option value="PATCH"${src.method === "PATCH" ? " selected" : ""}>PATCH</option>
        </select>
      </div>
      <div class="sa-source-field sa-source-field--full">
        <label>URL</label>
        <input class="sa-field-url" type="text" value="${escapeHtml(src.url || "")}" placeholder="https://sugar.example.com/rest/v11/Contacts?phone={{phone}}" />
      </div>
      <div class="sa-source-field sa-source-field--full">
        <label>Headers</label>
        <div class="sa-headers-kv"></div>
        <button type="button" class="sa-add-header-btn">+ Add header</button>
      </div>
      <div class="sa-source-field sa-source-field--full">
        <label>Body template</label>
        <textarea class="sa-field-body" rows="3" placeholder='{"phone":"{{phone}}","status":"{{status}}"}'>${escapeHtml(src.bodyTemplate || "")}</textarea>
      </div>
      <div class="sa-source-field sa-source-field--full">
        <label>Fixed params</label>
        <div class="sa-params-kv"></div>
        <button type="button" class="sa-add-param-btn">+ Add param</button>
      </div>
      <div class="sa-source-field sa-source-field--full">
        <label>Description</label>
        <textarea class="sa-field-description" rows="2" placeholder="Ej: Consulta contactos en Sugar CRM por telefono.">${escapeHtml(src.description || "")}</textarea>
      </div>
      <div class="sa-source-field sa-source-field--full">
        <label>Field homologation</label>
        <span class="admin-field-note">Mapea campos PulseForms contra los campos esperados por este CRM/API.</span>
        <div class="pf-mapping-rows" style="margin-top:8px;"></div>
        <button type="button" class="pf-add-mapping-btn">+ Add mapping</button>
      </div>
      <div class="sa-source-field sa-source-field--full">
        <label><input class="sa-field-enabled" type="checkbox"${src.enabled !== false ? " checked" : ""} /> Enabled</label>
      </div>
    </div>`;

  card.querySelector(".sa-source-toggle").addEventListener("click", (event) => {
    const body = card.querySelector(".sa-source-body");
    const collapsed = body.style.display === "none";
    body.style.display = collapsed ? "grid" : "none";
    event.currentTarget.textContent = collapsed ? "▲ Collapse" : "▼ Expand";
  });
  card.querySelector(".sa-source-remove").addEventListener("click", () => {
    card.remove();
    markDirty();
  });
  card.querySelectorAll("input, select, textarea").forEach((el) => {
    el.addEventListener("input", markDirty);
    el.addEventListener("change", markDirty);
  });
  const headersWrap = card.querySelector(".sa-headers-kv");
  const paramsWrap = card.querySelector(".sa-params-kv");
  try {
    const headers = JSON.parse(src.headersJson || "{}");
    Object.entries(headers).forEach(([k, v]) => addHeaderRow(headersWrap, k, v));
  } catch {}
  parseAdminFixedParams(src.fixedParams || "").forEach(([k, v]) => addParamRow(paramsWrap, k, v));
  const mappingWrap = card.querySelector(".pf-mapping-rows");
  renderPulseFormsMappingRows(mappingWrap, src.fieldMappings || {});
  card.querySelector(".sa-add-header-btn").addEventListener("click", () => { addHeaderRow(headersWrap); markDirty(); });
  card.querySelector(".sa-add-param-btn").addEventListener("click", () => { addParamRow(paramsWrap); markDirty(); });
  card.querySelector(".pf-add-mapping-btn").addEventListener("click", () => { addPulseFormsMappingRow(mappingWrap); markDirty(); });
  pulseformsSourcesList.appendChild(card);
}

function updateSummaryAgenticUrls(campaignId) {
  const saLink = document.getElementById("summaryagenticOpenLink");
  const urlPhone = document.getElementById("summaryagenticUrlPhone");
  const urlCustomerId = document.getElementById("summaryagenticUrlCustomerId");
  const embedCode = document.getElementById("summaryagenticEmbedCode");
  const warmUrl = document.getElementById("summaryagenticWarmUrl");
  const warmCurl = document.getElementById("summaryagenticWarmCurl");
  const base = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "/summaryagentic.html")}`;
  const apiBase = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "")}`;

  if (campaignId) {
    if (saLink) { saLink.href = `./summaryagentic.html?campaign=${encodeURIComponent(campaignId)}`; saLink.hidden = false; }
    if (urlPhone) urlPhone.value = `${base}?campaign=${encodeURIComponent(campaignId)}&phone=+15551234567`;
    if (urlCustomerId) urlCustomerId.value = `${base}?campaign=${encodeURIComponent(campaignId)}&customer_id=C-001`;
    if (embedCode) embedCode.value = `<iframe src="${base}?campaign=${encodeURIComponent(campaignId)}&phone={{PHONE}}" style="width:100%;height:900px;border:none;" allow="clipboard-write"></iframe>`;
    const warmEndpoint = `${apiBase}/api/summaryagentic/warm`;
    const warmTokenVal = fields.summaryagenticWarmToken?.value.trim() || "TU_WARM_TOKEN";
    if (warmUrl) warmUrl.value = warmEndpoint;
    if (warmCurl) warmCurl.value = `curl -X POST ${warmEndpoint} \\\n  -H "Content-Type: application/json" \\\n  -d '{"campaign":"${campaignId}","phone":"+15551234567","token":"${warmTokenVal}"}'`;
  } else {
    if (saLink) saLink.hidden = true;
    if (urlPhone) urlPhone.value = "";
    if (urlCustomerId) urlCustomerId.value = "";
    if (embedCode) embedCode.value = "";
    if (warmUrl) warmUrl.value = "";
    if (warmCurl) warmCurl.value = "";
  }
}

function updatePulseFormsUrls(campaignId) {
  const link = document.getElementById("pulseformsOpenLink");
  const urlPhone = document.getElementById("pulseformsUrlPhone");
  const urlCustomerId = document.getElementById("pulseformsUrlCustomerId");
  const embedCode = document.getElementById("pulseformsEmbedCode");
  const base = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "/pulseforms.html")}`;
  if (campaignId) {
    if (link) { link.href = `./pulseforms.html?campaign=${encodeURIComponent(campaignId)}`; link.hidden = false; }
    if (urlPhone) urlPhone.value = `${base}?campaign=${encodeURIComponent(campaignId)}&phone=+15551234567`;
    if (urlCustomerId) urlCustomerId.value = `${base}?campaign=${encodeURIComponent(campaignId)}&customer_id=C-001`;
    if (embedCode) embedCode.value = `<iframe src="${base}?campaign=${encodeURIComponent(campaignId)}&phone={{PHONE}}" style="width:100%;height:720px;border:none;" allow="clipboard-write"></iframe>`;
  } else {
    if (link) link.hidden = true;
    if (urlPhone) urlPhone.value = "";
    if (urlCustomerId) urlCustomerId.value = "";
    if (embedCode) embedCode.value = "";
  }
}

function readSummaryDataSources() {
  const cards = summaryagenticSourcesList.querySelectorAll(".sa-source-card");
  return Array.from(cards).map((card) => ({
    id: card.dataset.sourceId || crypto.randomUUID(),
    name: card.querySelector(".sa-field-name")?.value.trim() || "",
    url: card.querySelector(".sa-field-url")?.value.trim() || "",
    method: card.querySelector(".sa-field-method")?.value || "GET",
    headersJson: readHeadersKv(card.querySelector(".sa-headers-kv")),
    bodyTemplate: card.querySelector(".sa-field-body")?.value.trim() || "",
    selectedFields: Array.from(card.querySelectorAll(".sa-sug-check:checked")).map((cb) => {
      const idx = parseInt(cb.dataset.sugIdx);
      try { const sugs = JSON.parse(card.dataset.suggestions || "[]"); return sugs[idx]?.id; } catch { return null; }
    }).filter(Boolean),
    suggestions: (() => { try { return JSON.parse(card.dataset.suggestions || "[]"); } catch { return []; } })(),
    enabled: card.querySelector(".sa-field-enabled")?.checked !== false,
    testPhone: card.querySelector(".sa-test-phone")?.value.trim() || "",
    fixedParams: readParamsKv(card.querySelector(".sa-params-kv")),
    description: card.querySelector(".sa-field-description")?.value.trim() || ""
  })).filter((s) => s.url);
}

function readPulseFormsDataSources() {
  if (!pulseformsSourcesList) return [];
  const cards = pulseformsSourcesList.querySelectorAll(".sa-source-card");
  return Array.from(cards).map((card) => ({
    id: card.dataset.sourceId || crypto.randomUUID(),
    name: card.querySelector(".sa-field-name")?.value.trim() || "",
    mode: card.querySelector(".pf-field-mode")?.value || "query",
    url: card.querySelector(".sa-field-url")?.value.trim() || "",
    method: card.querySelector(".sa-field-method")?.value || "GET",
    headersJson: readHeadersKv(card.querySelector(".sa-headers-kv")),
    bodyTemplate: card.querySelector(".sa-field-body")?.value.trim() || "",
    enabled: card.querySelector(".sa-field-enabled")?.checked !== false,
    fixedParams: readParamsKv(card.querySelector(".sa-params-kv")),
    description: card.querySelector(".sa-field-description")?.value.trim() || "",
    fieldMappings: readPulseFormsMappings(card.querySelector(".pf-mapping-rows"))
  })).filter((s) => s.url);
}
// ─────────────────────────────────────────────────────────────────────────────

const apiBaseUrl = new URL(".", window.location.href);

previewPageType.addEventListener("change", schedulePreviewRender);
previewViewportWidth.addEventListener("input", schedulePreviewRender);
previewViewportHeight.addEventListener("input", schedulePreviewRender);
previewScale.addEventListener("change", schedulePreviewRender);

newCampaignButton.addEventListener("click", () => {
  if (state.isDirty && !confirm("You have unsaved changes. Discard them?")) return;
  if (!getCurrentPermissions().createCampaign) {
    showToast("You do not have permission to create campaigns.", true);
    return;
  }
  state.selectedId = "";
  campaignForm.reset();
  applyDefaultUiValues();
  clearDirty();
  updateBreadcrumb("");
  renderCampaigns();
  updateAdminPermissionUi();
  schedulePreviewRender();
});

duplicateCampaignButton.addEventListener("click", () => {
  if (!getCurrentPermissions().createCampaign) {
    showToast("You do not have permission to create campaigns.", true);
    return;
  }
  const id = fields.id.value.trim();
  if (!id) { showToast("Select a campaign to duplicate.", true); return; }
  const newId = id + "-copy";
  fields.id.value = newId;
  fields.name.value = (fields.name.value || id) + " (copy)";
  state.selectedId = "";
  markDirty();
  updateBreadcrumb(fields.name.value);
  updateAdminPermissionUi();
});

newUserRole.addEventListener("change", () => {
  const isAdmin = newUserRole.value === "admin";
  newUserPermissionsWrap.hidden = isAdmin;
  newUserCanCreateCampaign.disabled = isAdmin;
  newUserCanEditCampaign.disabled = isAdmin;
  newUserCanDeleteCampaign.disabled = isAdmin;
});

addQuestionButton.addEventListener("click", () => {
  addQuestionRow();
  markDirty();
  schedulePreviewRender();
});

wielandRefreshFieldmappingsButton?.addEventListener("click", () => {
  loadWielandFieldmappingInfo();
});

summaryagenticAddSourceButton?.addEventListener("click", () => {
  addSummarySourceCard({});
  markDirty();
});

// ── Import from URL ──────────────────────────────────────────────────────────
summaryagenticImportToggle?.addEventListener("click", () => {
  const open = summaryagenticImportForm.style.display === "none";
  summaryagenticImportForm.style.display = open ? "block" : "none";
  summaryagenticImportToggle.textContent = open ? "✕ Cerrar" : "🔍 Import from URL";
});

summaryagenticAnalyzeBtn?.addEventListener("click", async () => {
  const rawUrl = document.getElementById("summaryagenticImportUrl")?.value.trim();
  const method = document.getElementById("summaryagenticImportMethod")?.value || "GET";

  if (!rawUrl) { alert("Pega una URL primero."); return; }

  const campaignId = (document.getElementById("campaignId")?.value || "").trim();

  summaryagenticAnalyzeBtn.disabled = true;
  summaryagenticAnalyzeBtn.textContent = "Analizando…";
  summaryagenticAnalyzeResult.style.display = "none";

  try {
    const data = await apiRequest("/api/summaryagentic/analyze-url", {
      method: "POST",
      body: JSON.stringify({ url: rawUrl, method, campaignId })
    });

    document.getElementById("summaryagenticSugName").value    = data.name || "";
    document.getElementById("summaryagenticSugUrl").value     = data.url  || rawUrl;
    document.getElementById("summaryagenticSugFixed").value   = data.fixedParams || "";
    document.getElementById("summaryagenticSugHeaders").value = data.headersJson || "{}";
    document.getElementById("summaryagenticExplanation").textContent = data.explanation || "";

    summaryagenticAnalyzeResult.style.display = "block";
  } catch (err) {
    alert("Error al analizar: " + err.message);
  } finally {
    summaryagenticAnalyzeBtn.disabled = false;
    summaryagenticAnalyzeBtn.textContent = "Analizar con IA";
  }
});

summaryagenticAddFromAnalysis?.addEventListener("click", () => {
  const name        = document.getElementById("summaryagenticSugName")?.value.trim();
  const url         = document.getElementById("summaryagenticSugUrl")?.value.trim();
  const fixedParams = document.getElementById("summaryagenticSugFixed")?.value.trim();
  const headersJson = document.getElementById("summaryagenticSugHeaders")?.value.trim();
  const method      = document.getElementById("summaryagenticImportMethod")?.value || "GET";

  addSummarySourceCard({ name, url, method, fixedParams, headersJson });
  markDirty();

  // Reset and close the import panel
  summaryagenticAnalyzeResult.style.display = "none";
  summaryagenticImportForm.style.display = "none";
  summaryagenticImportToggle.textContent = "🔍 Import from URL";
  document.getElementById("summaryagenticImportUrl").value = "";
});

pulseformsAddSourceButton?.addEventListener("click", () => {
  addPulseFormsSourceCard({});
  markDirty();
});

pulseformsAddFieldButton?.addEventListener("click", () => {
  addPulseFormsFieldRow({});
  refreshPulseFormsMappingOptions();
  markDirty();
});

pulseformsAnalyzeFieldsBtn?.addEventListener("click", async () => {
  const files = pulseformsFieldFiles?.files;
  if (!files || !files.length) { alert("Selecciona al menos un archivo."); return; }
  const status = document.getElementById("pulseformsFieldDiscoveryStatus");
  const result = document.getElementById("pulseformsFieldDiscoveryResult");
  const explanation = document.getElementById("pulseformsFieldDiscoveryExplanation");
  const notes = document.getElementById("pulseformsFieldDiscoveryNotes")?.value.trim() || "";
  const campaignId = fields.id.value.trim();
  pulseformsAnalyzeFieldsBtn.disabled = true;
  pulseformsAnalyzeFieldsBtn.textContent = "Analizando...";
  if (status) status.textContent = "Leyendo archivos...";
  if (result) result.style.display = "none";
  if (pulseformsAddSuggestedFieldsBtn) pulseformsAddSuggestedFieldsBtn.style.display = "none";
  try {
    const attachments = await readPulseFormsDiscoveryFiles(files);
    if (status) status.textContent = "Consultando IA...";
    const data = await apiRequest("/api/pulseforms/analyze-fields", {
      method: "POST",
      body: JSON.stringify({ campaignId, notes, existingFields: readPulseFormsFields(), files: attachments })
    });
    renderPulseFormsSuggestedFields(data.fields || []);
    if (explanation) explanation.textContent = data.explanation || "Campos sugeridos por IA.";
    if (result) result.style.display = "block";
    if (pulseformsAddSuggestedFieldsBtn && (data.fields || []).length) {
      pulseformsAddSuggestedFieldsBtn.style.display = "inline-block";
    }
    if (status) status.textContent = `${(data.fields || []).length} campos sugeridos.`;
  } catch (err) {
    if (status) status.textContent = "";
    alert("Error al analizar archivos: " + err.message);
  } finally {
    pulseformsAnalyzeFieldsBtn.disabled = false;
    pulseformsAnalyzeFieldsBtn.textContent = "Analizar archivos con IA";
  }
});

pulseformsAddSuggestedFieldsBtn?.addEventListener("click", () => {
  let suggestions = [];
  try { suggestions = JSON.parse(pulseformsSuggestedFieldsList?.dataset.fields || "[]"); } catch { suggestions = []; }
  const added = addPulseFormsFieldsFromSelection(suggestions, ".pf-suggested-field-check:checked");
  const status = document.getElementById("pulseformsFieldDiscoveryStatus");
  if (status) status.textContent = `${added} campos agregados a Form Fields.`;
});

pulseformsImportJsonFieldsBtn?.addEventListener("click", async () => {
  const status = document.getElementById("pulseformsJsonFieldsStatus");
  const result = document.getElementById("pulseformsJsonFieldsResult");
  if (status) status.textContent = "Leyendo JSON...";
  if (result) result.style.display = "none";
  if (pulseformsAddJsonFieldsBtn) pulseformsAddJsonFieldsBtn.style.display = "none";
  try {
    let rawJson = pulseformsJsonFieldsText?.value.trim() || "";
    const file = pulseformsJsonFieldsFile?.files?.[0];
    if (file) rawJson = await readFileAsText(file);
    if (!rawJson) throw new Error("Sube un archivo JSON o pega el contenido.");
    const fieldsFromJson = parsePulseFormsFieldsJson(rawJson);
    if (!fieldsFromJson.length) {
      throw new Error("No se encontraron campos validos. Usa fields, formFields, suggestedFields o un array directo.");
    }
    renderPulseFormsJsonFields(fieldsFromJson);
    if (result) result.style.display = "block";
    if (pulseformsAddJsonFieldsBtn) pulseformsAddJsonFieldsBtn.style.display = "inline-block";
    if (status) status.textContent = `${fieldsFromJson.length} campos listos para agregar.`;
  } catch (err) {
    if (status) status.textContent = "";
    alert("Error al cargar JSON: " + err.message);
  }
});

pulseformsAddJsonFieldsBtn?.addEventListener("click", () => {
  let imported = [];
  try { imported = JSON.parse(pulseformsJsonFieldsPreview?.dataset.fields || "[]"); } catch { imported = []; }
  const added = addPulseFormsFieldsFromSelection(imported, ".pf-json-field-check:checked");
  const status = document.getElementById("pulseformsJsonFieldsStatus");
  if (status) status.textContent = `${added} campos agregados a Form Fields.`;
});

pulseformsImportToggle?.addEventListener("click", () => {
  const open = pulseformsImportForm.style.display === "none";
  pulseformsImportForm.style.display = open ? "block" : "none";
  pulseformsImportToggle.textContent = open ? "Cerrar" : "Import from URL";
});

pulseformsAnalyzeBtn?.addEventListener("click", async () => {
  const rawUrl = document.getElementById("pulseformsImportUrl")?.value.trim();
  const method = document.getElementById("pulseformsImportMethod")?.value || "GET";
  if (!rawUrl) { alert("Pega una URL primero."); return; }
  const campaignId = fields.id.value.trim();
  pulseformsAnalyzeBtn.disabled = true;
  pulseformsAnalyzeBtn.textContent = "Analizando...";
  pulseformsAnalyzeResult.style.display = "none";
  try {
    const data = await apiRequest("/api/pulseforms/analyze-url", {
      method: "POST",
      body: JSON.stringify({ url: rawUrl, method, campaignId })
    });
    document.getElementById("pulseformsSugName").value = data.name || "";
    document.getElementById("pulseformsSugUrl").value = data.url || rawUrl;
    document.getElementById("pulseformsSugFixed").value = data.fixedParams || "";
    document.getElementById("pulseformsSugHeaders").value = data.headersJson || "{}";
    document.getElementById("pulseformsExplanation").textContent = data.explanation || "";
    pulseformsAnalyzeResult.style.display = "block";
  } catch (err) {
    alert("Error al analizar: " + err.message);
  } finally {
    pulseformsAnalyzeBtn.disabled = false;
    pulseformsAnalyzeBtn.textContent = "Analizar con IA";
  }
});

pulseformsAddFromAnalysis?.addEventListener("click", () => {
  const name = document.getElementById("pulseformsSugName")?.value.trim();
  const url = document.getElementById("pulseformsSugUrl")?.value.trim();
  const fixedParams = document.getElementById("pulseformsSugFixed")?.value.trim();
  const headersJson = document.getElementById("pulseformsSugHeaders")?.value.trim();
  const method = document.getElementById("pulseformsImportMethod")?.value || "GET";
  addPulseFormsSourceCard({ name, url, method, fixedParams, headersJson });
  markDirty();
  pulseformsAnalyzeResult.style.display = "none";
  pulseformsImportForm.style.display = "none";
  pulseformsImportToggle.textContent = "Import from URL";
  document.getElementById("pulseformsImportUrl").value = "";
});

function renderPulseFormsActiveLayout(layout) {
  const badge = document.getElementById("pulseformsLayoutActiveBadge");
  const info = document.getElementById("pulseformsLayoutActiveInfo");
  if (!badge || !info) return;
  if (layout?.sections?.length) {
    badge.textContent = "Layout activo";
    badge.style.color = "var(--color-success, #15803d)";
    info.textContent = `${layout.sections.length} secciones · guardado ${layout.generatedAt ? new Date(layout.generatedAt).toLocaleString() : ""}`;
  } else {
    badge.textContent = "Sin layout fijo";
    badge.style.color = "#888";
    info.textContent = "";
  }
}

function renderPulseFormsLayoutCards(layouts) {
  const container = document.getElementById("pulseformsLayoutCards");
  if (!container) return;
  container.innerHTML = "";
  layouts.forEach((layout) => {
    const card = document.createElement("div");
    card.className = "sa-layout-card";
    card.innerHTML = `
      <div class="sa-layout-card-head">
        <div>
          <strong>${safeHtml(layout.name || layout.id || "PulseForms layout")}</strong>
          <div class="sa-layout-card-desc">${safeHtml(layout.description || "")}</div>
        </div>
        <button type="button" class="primary" style="flex-shrink:0;">Usar este layout</button>
      </div>
      <pre style="white-space:pre-wrap;font-size:.78rem;background:#f6f7fb;border:1px solid #dde2ef;border-radius:8px;padding:10px;">${safeHtml(JSON.stringify(layout.sections || [], null, 2))}</pre>`;
    card.querySelector("button").addEventListener("click", () => {
      const activeLayout = {
        sections: (layout.sections || []).map(({ id, title, type, placement, fields }) => ({ id, title, type, placement, fields: fields || [] })),
        generatedAt: Date.now()
      };
      const el = document.getElementById("pulseformsActiveLayout");
      if (el) el.value = JSON.stringify(activeLayout);
      renderPulseFormsActiveLayout(activeLayout);
      container.innerHTML = "";
      document.getElementById("pulseformsLayoutGeneratePanel").style.display = "none";
      markDirty();
    });
    container.appendChild(card);
  });
}

pulseformsLayoutGenerateBtn?.addEventListener("click", async () => {
  const status = document.getElementById("pulseformsLayoutGenerateStatus");
  const panel = document.getElementById("pulseformsLayoutGeneratePanel");
  const campaignId = fields.id.value.trim();
  if (!campaignId) { alert("Guarda el campaign primero."); return; }
  pulseformsLayoutGenerateBtn.disabled = true;
  pulseformsLayoutGenerateBtn.textContent = "Generando layouts...";
  if (status) { status.textContent = "Generando opciones con IA..."; status.style.color = "#888"; }
  if (panel) panel.style.display = "none";
  try {
    const data = await apiRequest("/api/pulseforms/generate-layouts", {
      method: "POST",
      body: JSON.stringify({ campaignId })
    });
    if (!data.ok || !data.layouts?.length) throw new Error(data.error || "No layouts returned");
    if (panel) panel.style.display = "block";
    renderPulseFormsLayoutCards(data.layouts);
    if (status) { status.textContent = `${data.layouts.length} opciones generadas.`; status.style.color = "#15803d"; }
  } catch (err) {
    if (status) { status.textContent = `Error: ${err.message}`; status.style.color = "#dc2626"; }
  } finally {
    pulseformsLayoutGenerateBtn.disabled = false;
    pulseformsLayoutGenerateBtn.textContent = "Generar opciones de layout";
  }
});

document.getElementById("pulseformsLayoutClearBtn")?.addEventListener("click", () => {
  const el = document.getElementById("pulseformsActiveLayout");
  if (el) el.value = "null";
  renderPulseFormsActiveLayout(null);
  markDirty();
});

const SUMMARY_AGENTIC_DEFAULT_PROMPT = `You are an intelligent assistant for a BPO call center agent.
The agent is about to answer a call from a customer.
Based ONLY on the data actually available below, generate a structured JSON summary.
IMPORTANT: Only include sections for which there is real data. Do NOT invent or hallucinate information.
If a data source returned an error or is empty, skip that section entirely.

Return a JSON object with a single key "sections", which is an array of section objects.
Each section object has:
  - id: string (snake_case unique identifier)
  - title: string (display title for the section)
  - icon: string (single emoji that represents the section)
  - placement: "left" or "right" (left = compact profile-like info, right = lists and main content)
  - type: one of: "kv" | "calllog" | "caselist" | "flags" | "text" | "recommendation"
  - items: array of objects depending on type:
    - kv:             [{ label, value, highlight? }]  (highlight: "green"|"yellow"|"red")
    - calllog:        [{ date, reason, agent?, duration?, status }]  (status: "resolved"|"escalated"|"pending"|"missed")
    - caselist:       [{ id, status, description }]  (status: "Open"|"Closed"|"Escalated"|"Pending")
    - flags:          [{ type: "warning"|"info"|"vip"|"escalation", message }]
    - text:           [{ content }]
    - recommendation: [{ content }]

Example section types to consider (only if data exists): customer profile, account status, recent calls,
open cases, active subscriptions, pending orders, loyalty/points, last purchases, escalation history,
recommended approach.
Return ONLY the JSON object. No markdown, no explanation.`;

// ── Layout generator ─────────────────────────────────────────────────────────

function renderActiveLayout(layout) {
  const badge   = document.getElementById("saLayoutActiveBadge");
  const info    = document.getElementById("saLayoutActiveInfo");
  const preview = document.getElementById("saLayoutActivePreview");
  if (!badge || !info) return;
  if (layout?.sections?.length) {
    badge.textContent = "✓ Layout activo";
    badge.style.color = "var(--color-success, #15803d)";
    info.textContent = `${layout.sections.length} secciones · guardado ${layout.generatedAt ? new Date(layout.generatedAt).toLocaleString() : ""}`;
    if (preview) {
      preview.style.display = "block";
      preview.innerHTML = `<div class="sa-layout-preview-wrap">${renderLayoutPreview(layout)}</div>`;
    }
  } else {
    badge.textContent = "Sin layout fijo (la IA decide cada vez)";
    badge.style.color = "#888";
    info.textContent = "";
    if (preview) { preview.style.display = "none"; preview.innerHTML = ""; }
  }
}

// ── Mini widget preview ───────────────────────────────────────────────────────
function safeHtml(s) { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function layoutPill(text, color = "blue") {
  return `<span class="sa-pill sa-pill--${safeHtml(color)}">${safeHtml(text)}</span>`;
}
function layoutStatusColor(s) {
  const v = String(s||"").toLowerCase();
  if (["resolved","closed","active","paid","open"].some(k=>v.includes(k))) return "green";
  if (["escalated","overdue","failed","missed"].some(k=>v.includes(k))) return "red";
  if (["pending","waiting","in progress"].some(k=>v.includes(k))) return "yellow";
  return "blue";
}

function renderLayoutSectionBody(section) {
  const items = section.items || [];
  if (!items.length) return `<div style="color:#aaa;font-size:.75rem;font-style:italic;">Sin datos de ejemplo</div>`;
  switch (section.type) {
    case "kv":
      return `<div class="sa-kv-list">${items.slice(0,4).map(item=>`
        <div class="sa-kv">
          <span class="sa-kv-label">${safeHtml(item.label)}</span>
          <span class="sa-kv-value">${item.highlight ? layoutPill(item.value, item.highlight) : safeHtml(item.value)}</span>
        </div>`).join("")}</div>`;
    case "calllog":
      return `<div class="sa-call-list">${items.slice(0,3).map(item=>`
        <div class="sa-call-item">
          <div class="sa-call-dot"></div>
          <div class="sa-call-info">
            <div class="sa-call-reason">${safeHtml(item.reason)}</div>
            <div class="sa-call-meta">${item.date?safeHtml(item.date):""}${item.status?" · "+layoutPill(item.status,layoutStatusColor(item.status)):""}</div>
          </div>
        </div>`).join("")}</div>`;
    case "caselist":
      return `<div class="sa-case-list">${items.slice(0,2).map(item=>`
        <div class="sa-case-item">
          <div class="sa-case-head"><span class="sa-case-id">${safeHtml(item.id||"")}</span>${item.status?layoutPill(item.status,layoutStatusColor(item.status)):""}</div>
          <div class="sa-case-desc">${safeHtml(item.description||"")}</div>
        </div>`).join("")}</div>`;
    case "flags":
      return `<div class="sa-flag-list">${items.slice(0,2).map(item=>`
        <div class="sa-flag-item">
          <span class="sa-flag-icon">${item.type==="escalation"?"⚠️":item.type==="vip"?"⭐":item.type==="warning"?"🔴":"ℹ️"}</span>
          <span>${safeHtml(item.message||"")}</span>
        </div>`).join("")}</div>`;
    case "recommendation":
      return `<div class="sa-recommendation" style="font-size:.78rem;">${safeHtml(items[0]?.content||"(se genera en tiempo real)")}</div>`;
    default:
      return `<div class="sa-text-section">${items.slice(0,2).map(i=>`<p style="font-size:.78rem;">${safeHtml(i.content||"")}</p>`).join("")}</div>`;
  }
}

function renderLayoutPreview(layout) {
  const left  = layout.sections.filter(s => s.placement === "left");
  const right = layout.sections.filter(s => s.placement !== "left");
  const renderCol = (sections) => sections.map(s => `
    <div class="sa-card" style="margin-bottom:8px;">
      <div class="sa-card-head">
        <span class="sa-card-head-icon">${safeHtml(s.icon||"📄")}</span>
        <h3 style="font-size:.78rem;">${safeHtml(s.title||"")}</h3>
      </div>
      <div class="sa-card-body">${renderLayoutSectionBody(s)}</div>
    </div>`).join("");
  return `
    <div class="sa-layout-preview">
      <div class="sa-left" style="min-width:0;">${renderCol(left)}</div>
      <div class="sa-right" style="min-width:0;">${renderCol(right)}</div>
    </div>`;
}

function renderLayoutCards(layouts) {
  const container = document.getElementById("saLayoutCards");
  if (!container) return;
  container.innerHTML = "";
  layouts.forEach((layout) => {
    const card = document.createElement("div");
    card.className = "sa-layout-card";
    card.innerHTML = `
      <div class="sa-layout-card-head">
        <div>
          <strong>${safeHtml(layout.name)}</strong>
          <div class="sa-layout-card-desc">${safeHtml(layout.description||"")}</div>
        </div>
        <button type="button" class="primary sa-layout-select-btn" style="flex-shrink:0;">Usar este layout</button>
      </div>
      <div class="sa-layout-preview-wrap">${renderLayoutPreview(layout)}</div>`;
    card.querySelector(".sa-layout-select-btn").addEventListener("click", () => {
      // Store only structure (no sample items) to keep payload small
      const cleanSections = layout.sections.map(({ id, title, icon, type, placement, fields }) =>
        ({ id, title, icon, type, placement, fields: fields || [] })
      );
      const activeLayout = { sections: cleanSections, generatedAt: Date.now() };
      const el = document.getElementById("summaryagenticActiveLayout");
      if (el) el.value = JSON.stringify(activeLayout);
      renderActiveLayout(activeLayout);
      container.innerHTML = "";
      document.getElementById("saLayoutGeneratePanel").style.display = "none";
      markDirty();
    });
    container.appendChild(card);
  });
}

document.getElementById("saLayoutGenerateBtn")?.addEventListener("click", async () => {
  const btn = document.getElementById("saLayoutGenerateBtn");
  const status = document.getElementById("saLayoutGenerateStatus");
  const panel = document.getElementById("saLayoutGeneratePanel");
  const campaignId = fields.id.value.trim();
  if (!campaignId) { alert("Guarda el campaign primero."); return; }

  // Get a test phone from first source card or hubspot token field
  const testPhoneInput = document.querySelector(".sa-source-card input[placeholder*='phone'], .sa-source-card input[placeholder*='test']");
  const testPhone = document.getElementById("summaryagenticHubspotToken") ? (testPhoneInput?.value.trim() || "") : "";

  btn.disabled = true;
  btn.textContent = "Generando layouts…";
  if (status) { status.textContent = "Consultando fuentes de datos y generando opciones con IA…"; status.style.color = "#888"; }
  if (panel) panel.style.display = "none";

  try {
    const data = await apiRequest("/api/summaryagentic/generate-layouts", {
      method: "POST",
      body: JSON.stringify({ campaignId, testPhone })
    });
    if (!data.ok || !data.layouts?.length) throw new Error(data.error || "No layouts returned");
    if (panel) panel.style.display = "block";
    renderLayoutCards(data.layouts);
    if (status) { status.textContent = `${data.layouts.length} opciones generadas. Selecciona una:`; status.style.color = "#15803d"; }
  } catch (err) {
    if (status) { status.textContent = `Error: ${err.message}`; status.style.color = "#dc2626"; }
  } finally {
    btn.disabled = false;
    btn.textContent = "Generar opciones de layout";
  }
});

document.getElementById("saLayoutClearBtn")?.addEventListener("click", () => {
  if (!confirm("¿Eliminar el layout fijo? La IA generará la estructura libremente.")) return;
  const el = document.getElementById("summaryagenticActiveLayout");
  if (el) el.value = "null";
  renderActiveLayout(null);
  markDirty();
});

document.getElementById("summaryagenticWarmTokenGenBtn")?.addEventListener("click", () => {
  const input = fields.summaryagenticWarmToken;
  if (!input) return;
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  input.value = Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
  // Regenerate cURL example if campaign is already saved
  const campaignId = fields.id?.value.trim();
  if (campaignId) updateSummaryAgenticUrls(campaignId);
});

document.getElementById("summaryagenticHubspotTestBtn")?.addEventListener("click", async () => {
  const btn = document.getElementById("summaryagenticHubspotTestBtn");
  const result = document.getElementById("summaryagenticHubspotTestResult");
  const token = fields.summaryagenticHubspotToken?.value.trim();
  if (!token) { result.textContent = "⚠ Ingresa el token primero."; result.style.color = "var(--color-warn, #b45309)"; return; }
  btn.disabled = true;
  btn.textContent = "Probando…";
  result.textContent = "";
  try {
    const campaignId = fields.id.value.trim();
    const data = await apiRequest("/api/summaryagentic/hubspot-test", { method: "POST", body: JSON.stringify({ token, campaignId }) });
    if (data.ok) {
      result.textContent = "✓ Conexión exitosa con HubSpot";
      result.style.color = "var(--color-success, #15803d)";
    } else {
      result.textContent = `✗ Error: ${data.error}`;
      result.style.color = "var(--color-error, #dc2626)";
    }
  } catch (err) {
    result.textContent = `✗ ${err.message}`;
    result.style.color = "var(--color-error, #dc2626)";
  } finally {
    btn.disabled = false;
    btn.textContent = "✓ Test conexión";
  }
});

summaryagenticLoadDefaultPromptButton?.addEventListener("click", () => {
  if (fields.summaryagenticAiPrompt.value.trim() && !confirm("This will replace your current prompt. Continue?")) return;
  fields.summaryagenticAiPrompt.value = SUMMARY_AGENTIC_DEFAULT_PROMPT;
  markDirty();
});

collapseAllButton.addEventListener("click", () => {
  campaignForm.querySelectorAll("details[open]").forEach((d) => d.removeAttribute("open"));
});

expandAllButton.addEventListener("click", () => {
  campaignForm.querySelectorAll("details:not([open])").forEach((d) => d.setAttribute("open", ""));
});

campaignSearch.addEventListener("input", renderCampaigns);

logoutButton.addEventListener("click", async () => {
  await fetch(buildApiUrl("/api/admin/logout"), { method: "POST", credentials: "include" });
  location.replace(buildApiUrl("/login.html"));
});

addUserButton.addEventListener("click", () => {
  userFormWrap.hidden = false;
  document.getElementById("newUsername").value = "";
  document.getElementById("newUserPassword").value = "";
  document.getElementById("newUserPasswordConfirm").value = "";
  newUserRole.value = "editor";
  newUserCanCreateCampaign.checked = false;
  newUserCanEditCampaign.checked = true;
  newUserCanDeleteCampaign.checked = false;
  newUserRole.dispatchEvent(new Event("change"));
  document.getElementById("newUsername").focus();
});

cancelUserButton.addEventListener("click", () => {
  userFormWrap.hidden = true;
});

saveUserButton.addEventListener("click", async () => {
  const username = document.getElementById("newUsername").value.trim();
  const role = newUserRole.value;
  const password = document.getElementById("newUserPassword").value;
  const confirm = document.getElementById("newUserPasswordConfirm").value;
  const permissions = {
    createCampaign: newUserCanCreateCampaign.checked,
    editCampaign: newUserCanEditCampaign.checked,
    deleteCampaign: newUserCanDeleteCampaign.checked
  };
  if (!username) { showToast("Username is required.", true); return; }
  if (password !== confirm) { showToast("Passwords do not match.", true); return; }
  if (password.length < 8) { showToast("Password must be at least 8 characters.", true); return; }
  try {
    await apiRequest("/api/admin/users", { method: "POST", body: JSON.stringify({ username, password, role, permissions }) });
    userFormWrap.hidden = true;
    showToast(`User "${username}" created.`);
    await loadUsers();
  } catch (err) {
    showToast(err.message, true);
  }
});

campaignForm.addEventListener("input", () => { markDirty(); schedulePreviewRender(); });
campaignForm.addEventListener("change", () => { markDirty(); schedulePreviewRender(); });

campaignForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const permissions = getCurrentPermissions();
  if (state.selectedId && !permissions.editCampaign) {
    showToast("You do not have permission to edit campaigns.", true);
    return;
  }
  if (!state.selectedId && !permissions.createCampaign) {
    showToast("You do not have permission to create campaigns.", true);
    return;
  }

  saveCampaignButton.setAttribute("data-loading", "1");
  saveCampaignButton.textContent = "Saving…";

  try {
    await apiRequest("/api/admin/campaigns", {
      method: "POST",
      body: JSON.stringify(readForm())
    });
    clearDirty();
    setStatus("Campaign saved.");
    showToast("Campaign saved.");
    await loadCampaigns();
  } catch (error) {
    setStatus(error.message);
    showToast(error.message, true);
  } finally {
    saveCampaignButton.removeAttribute("data-loading");
    saveCampaignButton.textContent = "Save campaign";
    updateAdminPermissionUi();
  }
});

deleteCampaignButton.addEventListener("click", async () => {
  if (!getCurrentPermissions().deleteCampaign) {
    showToast("You do not have permission to delete campaigns.", true);
    return;
  }
  const id = fields.id.value.trim();
  if (!id) {
    showToast("Select a campaign first.", true);
    return;
  }

  if (!confirm(`Delete campaign "${id}"? This cannot be undone.`)) return;

  try {
    await apiRequest("/api/admin/campaigns/delete", {
      method: "POST",
      body: JSON.stringify({ id })
    });
    clearDirty();
    setStatus("Campaign deleted.");
    showToast("Campaign deleted.");
    state.selectedId = "";
    updateBreadcrumb("");
    campaignForm.reset();
    applyDefaultUiValues();
    await loadCampaigns();
    updateAdminPermissionUi();
  } catch (error) {
    setStatus(error.message);
    showToast(error.message, true);
  }
});

async function loadCampaigns() {
  try {
    const data = await apiRequest("/api/admin/campaigns");
    state.campaigns = data.campaigns || [];

    if (state.selectedId) {
      const match = state.campaigns.find((item) => item.id === state.selectedId);
      if (match) {
        fillForm(match);
      }
    }

    renderCampaigns();
    setStatus(`Loaded ${state.campaigns.length} campaign(s).`);
    showToast(`Loaded ${state.campaigns.length} campaign(s).`);
  } catch (error) {
    setStatus(error.message);
    showToast(error.message, true);
  }
}

function updateBreadcrumb(name) {
  if (adminBreadcrumb) adminBreadcrumb.textContent = name || "";
}

function renderCampaigns() {
  campaignList.innerHTML = "";
  const query = (campaignSearch?.value || "").toLowerCase().trim();

  const filtered = query
    ? state.campaigns.filter((c) =>
        c.name.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query) ||
        (c.domain || "").toLowerCase().includes(query)
      )
    : state.campaigns;

  for (const campaign of filtered) {
    const isActive = campaign.id === state.selectedId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `admin-item${isActive ? " active" : ""}${isActive && state.isDirty ? " admin-dirty" : ""}`;
    button.innerHTML = `
      <strong>${escapeHtml(campaign.name)}</strong>
      <span>${escapeHtml(campaign.id)} | ${escapeHtml(campaign.domain)}</span>
    `;
    button.addEventListener("click", () => {
      if (state.isDirty && campaign.id !== state.selectedId && !confirm("You have unsaved changes. Discard them?")) return;
      state.selectedId = campaign.id;
      fillForm(campaign);
      clearDirty();
      renderCampaigns();
      updateAdminPermissionUi();
    });
    campaignList.appendChild(button);
  }

  if (filtered.length === 0 && query) {
    const empty = document.createElement("p");
    empty.className = "admin-section-note";
    empty.style.padding = "8px 4px";
    empty.textContent = "No campaigns match your search.";
    campaignList.appendChild(empty);
  }
}

function fillForm(campaign) {
  fields.id.value = campaign.id || "";
  fields.name.value = campaign.name || "";
  fields.domain.value = campaign.domain || "";
  fields.apiUrl.value = campaign.apiUrl || "";
  fields.workitemApiUrl.value = campaign.workitemApiUrl || "";
  fields.agentChatApiUrl.value = campaign.agentChatApiUrl || "";
  fields.agentUserId.value = campaign.agentUserId || "";
  fields.transcriptRefreshSeconds.value = campaign.transcriptRefreshSeconds || "";
  fields.sentimentProvider.value = campaign.sentimentProvider || "heuristic";
  fields.geminiApiKey.value = campaign.geminiApiKey || "";
  fields.geminiModel.value = campaign.geminiModel || "gemini-2.5-flash";
  fields.geminiApiUrl.value = campaign.geminiApiUrl || "https://generativelanguage.googleapis.com";
  fields.geminiPrompt.value = campaign.geminiPrompt || "";
  fields.wielandNccCampaignId.value = campaign.wieland?.nccCampaignId || "";
  fields.wielandSlotsNeeded.value = campaign.wieland?.slotsNeeded || 8;
  fields.wielandUploadFileName.value = campaign.wieland?.uploadFileName || "";
  fields.wielandNccFieldmappingId.value = campaign.wieland?.nccFieldmappingId || "";
  fields.wielandNccAuthType.value = campaign.wieland?.nccAuthType || "token";
  fields.wielandNccCredential.value = campaign.wielandNccCredential || "";
  setWielandVisibleTabs(campaign.wieland?.visibleTabs || {});
  setWielandListButtons(campaign.wieland?.listButtons || {});
  updateWielandCredentialField(fields.wielandNccAuthType.value);
  renderWielandMappingEditors(campaign.wieland?.widgetToContactMap || {}, campaign.wieland?.contactToListMap || {});
  const wielandLink = document.getElementById("wielandOpenLink");
  if (campaign.id) {
    wielandLink.href = `./wieland.html?campaign=${encodeURIComponent(campaign.id)}`;
    wielandLink.hidden = false;
  } else {
    wielandLink.hidden = true;
  }
  loadWielandFieldmappingInfo();
  fields.token.value = campaign.token || "";
  fields.cookie.value = campaign.cookie || "";
  fields.allowedKbIds.value = (campaign.allowedKbIds || []).join("\n");
  fields.sharedLanguage.value = campaign.ui?.shared?.language || "en";
  fields.sharedFontFamily.value = campaign.ui?.shared?.fontFamily || "";
  fields.sharedBaseFontSize.value = campaign.ui?.shared?.baseFontSize || "16px";
  fields.chatTitleText.value = campaign.ui?.chat?.titleText || "";
  fields.chatTitleSize.value = campaign.ui?.chat?.titleSize || "2rem";
  fields.chatMetaSize.value = campaign.ui?.chat?.metaSize || "0.82rem";
  fields.chatEmbedMinHeight.value = campaign.ui?.chat?.embedMinHeight || "180px";
  fields.chatEmbedMaxHeight.value = campaign.ui?.chat?.embedMaxHeight || "520px";
  fields.chatShowTitle.checked = campaign.ui?.chat?.showTitle !== false;
  fields.chatShowMeta.checked = campaign.ui?.chat?.showMeta !== false;
  fields.workitemTitleText.value = campaign.ui?.workitem?.titleText || "";
  fields.workitemTitleSize.value = campaign.ui?.workitem?.titleSize || "2rem";
  fields.workitemMetaSize.value = campaign.ui?.workitem?.metaSize || "0.82rem";
  fields.workitemEmbedMinHeight.value = campaign.ui?.workitem?.embedMinHeight || "180px";
  fields.workitemEmbedMaxHeight.value = campaign.ui?.workitem?.embedMaxHeight || "520px";
  fields.workitemShowTitle.checked = campaign.ui?.workitem?.showTitle !== false;
  fields.workitemShowMeta.checked = campaign.ui?.workitem?.showMeta !== false;
  fields.questionsGeminiApiKey.value = campaign.questionsGeminiApiKey || "";
  fields.questionsUseGemini.checked = campaign.ui?.questions?.useGemini !== false;
  fields.clientQuestionsUseGemini.checked = campaign.ui?.questions?.clientQuestionsUseGemini !== false;
  fields.clientQuestionsRefreshSeconds.value = campaign.ui?.questions?.clientQuestionsRefreshSeconds || "";
  fields.questionsGeminiModel.value = campaign.questionsGeminiModel || "gemini-2.5-flash";
  fields.questionsGeminiApiUrl.value = campaign.questionsGeminiApiUrl || "https://generativelanguage.googleapis.com";
  fields.questionsGeminiPrompt.value = campaign.questionsGeminiPrompt || "";
  fields.questionsTitleText.value = campaign.ui?.questions?.titleText || "Checklist";
  fields.questionsTitleSize.value = campaign.ui?.questions?.titleSize || "2rem";
  fields.questionsMetaSize.value = campaign.ui?.questions?.metaSize || "0.82rem";
  fields.questionsQuestionSize.value = campaign.ui?.questions?.questionSize || "1rem";
  fields.questionsEvidenceSize.value = campaign.ui?.questions?.evidenceSize || "1rem";
  fields.questionsMetaFontSize.value = campaign.ui?.questions?.metaFontSize || "0.82rem";
  fields.questionsEmbedMinHeight.value = campaign.ui?.questions?.embedMinHeight || "220px";
  fields.questionsEmbedMaxHeight.value = campaign.ui?.questions?.embedMaxHeight || "560px";
  fields.questionsRefreshIntervalSeconds.value = campaign.ui?.questions?.refreshIntervalSeconds || 30;
  fields.questionsShowTitle.checked = campaign.ui?.questions?.showTitle !== false;
  fields.questionsShowPageHeader.checked = campaign.ui?.questions?.showPageHeader !== false;
  fields.questionsShowMeta.checked = campaign.ui?.questions?.showMeta !== false;
  fields.questionsShowEvidence.checked = campaign.ui?.questions?.showEvidence !== false;
  fields.questionsShowCardShadow.checked = campaign.ui?.questions?.showCardShadow !== false;
  renderQuestionItems(campaign.ui?.questions?.items || []);
  fields.nextStepTitleText.value = campaign.ui?.nextStep?.titleText || "NextIQ Assistant";
  fields.nextStepTitleSize.value = campaign.ui?.nextStep?.titleSize || "2rem";
  fields.nextStepMetaSize.value = campaign.ui?.nextStep?.metaSize || "0.82rem";
  fields.nextStepEmbedMinHeight.value = campaign.ui?.nextStep?.embedMinHeight || "220px";
  fields.nextStepEmbedMaxHeight.value = campaign.ui?.nextStep?.embedMaxHeight || "280px";
  fields.nextStepRefreshIntervalSeconds.value = campaign.ui?.nextStep?.refreshIntervalSeconds || 30;
  fields.nextStepShowCardShadow.checked = campaign.ui?.nextStep?.showCardShadow !== false;
  fields.nextStepLiveSize.value = campaign.ui?.nextStep?.liveSize || "1rem";
  fields.nextStepBadgeSize.value = campaign.ui?.nextStep?.badgeSize || "0.82rem";
  fields.nextStepKickerSize.value = campaign.ui?.nextStep?.kickerSize || "0.86rem";
  fields.nextStepActionTitleSize.value = campaign.ui?.nextStep?.actionTitleSize || "1.6rem";
  fields.nextStepActionTextSize.value = campaign.ui?.nextStep?.actionTextSize || "1rem";
  fields.nextStepSuggestedLabelSize.value = campaign.ui?.nextStep?.suggestedLabelSize || "0.84rem";
  fields.nextStepSuggestedTextSize.value = campaign.ui?.nextStep?.suggestedTextSize || "1.35rem";
  fields.nextStepButtonTextSize.value = campaign.ui?.nextStep?.buttonTextSize || "1rem";
  fields.nextStepArticleTitleSize.value = campaign.ui?.nextStep?.articleTitleSize || "1rem";
  fields.nextStepArticleTextSize.value = campaign.ui?.nextStep?.articleTextSize || "0.84rem";
  fields.nextStepChipSize.value = campaign.ui?.nextStep?.chipSize || "0.84rem";
  fields.nextStepReasonSize.value = campaign.ui?.nextStep?.reasonSize || "0.92rem";
  fields.nextStepMetaFontSize.value = campaign.ui?.nextStep?.metaFontSize || "0.8rem";
  fields.nextStepUseGemini.checked = campaign.ui?.nextStep?.useGemini !== false;
  fields.nextStepGeminiPrompt.value = campaign.nextStepGeminiPrompt || "";
  fields.sentimentTitleText.value = campaign.ui?.sentiment?.titleText || "";
  fields.sentimentTitleSize.value = campaign.ui?.sentiment?.titleSize || "2rem";
  fields.sentimentMetaSize.value = campaign.ui?.sentiment?.metaSize || "0.82rem";
  fields.sentimentEmbedMinHeight.value = campaign.ui?.sentiment?.embedMinHeight || "180px";
  fields.sentimentEmbedMaxHeight.value = campaign.ui?.sentiment?.embedMaxHeight || "520px";
  fields.sentimentLayout.value = campaign.ui?.sentiment?.sentimentLayout || "centered";
  fields.sentimentStylePreset.value = campaign.ui?.sentiment?.sentimentStylePreset || "stacked";
  fields.sentimentCardMaxWidth.value = campaign.ui?.sentiment?.sentimentCardMaxWidth || "560px";
  fields.sentimentCardMinHeight.value = campaign.ui?.sentiment?.sentimentCardMinHeight || "0px";
  fields.sentimentCardMaxHeight.value = campaign.ui?.sentiment?.sentimentCardMaxHeight || "none";
  fields.sentimentCardPadding.value = campaign.ui?.sentiment?.sentimentCardPadding || "34px 40px 28px";
  fields.sentimentCardRadius.value = campaign.ui?.sentiment?.sentimentCardRadius || "38px";
  fields.sentimentOrbSize.value = campaign.ui?.sentiment?.sentimentOrbSize || "180px";
  fields.sentimentDualPanelGlowSize.value = campaign.ui?.sentiment?.sentimentDualPanelGlowSize || "180px";
  fields.sentimentDualPanelSectionGap.value = campaign.ui?.sentiment?.sentimentDualPanelSectionGap || "0px";
  fields.sentimentDualPanelTextOrbGap.value = campaign.ui?.sentiment?.sentimentDualPanelTextOrbGap || "18px";
  fields.sentimentDualPanelTextGap.value = campaign.ui?.sentiment?.sentimentDualPanelTextGap || "6px";
  fields.sentimentDualPanelHeartSize.value = campaign.ui?.sentiment?.sentimentDualPanelHeartSize || "68px";
  fields.sentimentCardTitleFontSize.value = campaign.ui?.sentiment?.sentimentCardTitleFontSize || "3.6rem";
  fields.sentimentLabelFontSize.value = campaign.ui?.sentiment?.sentimentLabelFontSize || "3rem";
  fields.sentimentScoreFontSize.value = campaign.ui?.sentiment?.sentimentScoreFontSize || "4rem";
  fields.sentimentInsightTitleSize.value = campaign.ui?.sentiment?.sentimentInsightTitleSize || "1rem";
  fields.sentimentInsightTextSize.value = campaign.ui?.sentiment?.sentimentInsightTextSize || "0.98rem";
  fields.sentimentMetaFontSize.value = campaign.ui?.sentiment?.sentimentMetaFontSize || "0.82rem";
  fields.sentimentDualPanelChartHeight.value = campaign.ui?.sentiment?.sentimentDualPanelChartHeight || "92px";
  fields.sentimentDualPanelChartTopGap.value = campaign.ui?.sentiment?.sentimentDualPanelChartTopGap || "18px";
  fields.sentimentCompactBreakpoint.value = campaign.ui?.sentiment?.sentimentCompactBreakpoint || "560px";
  fields.sentimentCompactCardPadding.value = campaign.ui?.sentiment?.sentimentCompactCardPadding || "16px 14px 12px";
  fields.sentimentCompactOrbSize.value = campaign.ui?.sentiment?.sentimentCompactOrbSize || "126px";
  fields.sentimentCompactTitleFontSize.value = campaign.ui?.sentiment?.sentimentCompactTitleFontSize || "2.4rem";
  fields.sentimentCompactLabelFontSize.value = campaign.ui?.sentiment?.sentimentCompactLabelFontSize || "2rem";
  fields.sentimentCompactScoreFontSize.value = campaign.ui?.sentiment?.sentimentCompactScoreFontSize || "2.8rem";
  fields.sentimentCompactInsightTitleSize.value = campaign.ui?.sentiment?.sentimentCompactInsightTitleSize || "0.92rem";
  fields.sentimentCompactInsightTextSize.value = campaign.ui?.sentiment?.sentimentCompactInsightTextSize || "0.88rem";
  fields.sentimentCompactMetaFontSize.value = campaign.ui?.sentiment?.sentimentCompactMetaFontSize || "0.72rem";
  fields.sentimentRefreshIntervalSeconds.value = campaign.ui?.sentiment?.refreshIntervalSeconds || 30;
  fields.sentimentShowTitle.checked = campaign.ui?.sentiment?.showTitle !== false;
  fields.sentimentShowPageHeader.checked = campaign.ui?.sentiment?.showPageHeader !== false;
  fields.sentimentShowMeta.checked = campaign.ui?.sentiment?.showMeta !== false;
  // Summary Agentic
  const sa = campaign.summaryagentic || {};
  fields.summaryagenticEnabled.checked = sa.enabled !== false;
  fields.summaryagenticCacheSeconds.value = sa.cacheSeconds ?? 60;
  fields.summaryagenticAiProvider.value = sa.aiProvider || "claude";
  fields.summaryagenticAiModel.value = sa.aiModel || "";
  fields.summaryagenticAiApiKey.value = campaign.summaryagenticAiApiKey || "";
  fields.summaryagenticAiPrompt.value = sa.aiPrompt || "";
  summaryagenticSourcesList.dataset.widgetLibrary = JSON.stringify(sa.widgetLibrary || []);
  renderSummaryDataSources(sa.dataSources || []);
  // HubSpot
  const hs = sa.hubspot || {};
  if (fields.summaryagenticHubspotEnabled) fields.summaryagenticHubspotEnabled.checked = hs.enabled === true;
  if (fields.summaryagenticHubspotToken) fields.summaryagenticHubspotToken.value = campaign.summaryagenticHubspotToken || "";
  if (fields.summaryagenticWarmToken) fields.summaryagenticWarmToken.value = campaign.summaryagenticWarmToken || "";
  const hsObjects = Array.isArray(hs.objects) ? hs.objects : ["contacts","deals","tickets","calls"];
  document.querySelectorAll(".sa-hs-obj").forEach((cb) => { cb.checked = hsObjects.includes(cb.value); });
  // Active layout
  const activeLayoutEl = document.getElementById("summaryagenticActiveLayout");
  if (activeLayoutEl) activeLayoutEl.value = JSON.stringify(sa.activeLayout || null);
  renderActiveLayout(sa.activeLayout || null);
  updateSummaryAgenticUrls(campaign.id || "");
  const pf = campaign.pulseforms || {};
  if (fields.pulseformsEnabled) fields.pulseformsEnabled.checked = pf.enabled !== false;
  if (fields.pulseformsMode) fields.pulseformsMode.value = pf.mode || "query";
  if (fields.pulseformsAiProvider) fields.pulseformsAiProvider.value = pf.aiProvider || "claude";
  if (fields.pulseformsAiModel) fields.pulseformsAiModel.value = pf.aiModel || "";
  if (fields.pulseformsAiApiKey) fields.pulseformsAiApiKey.value = campaign.pulseformsAiApiKey || "";
  if (fields.pulseformsAiPrompt) fields.pulseformsAiPrompt.value = pf.aiPrompt || "";
  renderPulseFormsFields(pf.formFields || []);
  renderPulseFormsDataSources(pf.dataSources || []);
  const pfLayoutEl = document.getElementById("pulseformsActiveLayout");
  if (pfLayoutEl) pfLayoutEl.value = JSON.stringify(pf.activeLayout || null);
  renderPulseFormsActiveLayout(pf.activeLayout || null);
  updatePulseFormsUrls(campaign.id || "");
  updateBreadcrumb(campaign.name || campaign.id || "");
  updateAdminPermissionUi();
  schedulePreviewRender();
}

function readForm() {
  return {
    id: fields.id.value.trim(),
    name: fields.name.value.trim(),
    domain: fields.domain.value.trim(),
    apiUrl: fields.apiUrl.value.trim(),
    workitemApiUrl: fields.workitemApiUrl.value.trim(),
    agentChatApiUrl: fields.agentChatApiUrl.value.trim(),
    agentUserId: fields.agentUserId.value.trim(),
    transcriptRefreshSeconds: parseInt(fields.transcriptRefreshSeconds.value) || 10,
    sentimentProvider: fields.sentimentProvider.value,
    geminiApiKey: fields.geminiApiKey.value.trim(),
    geminiModel: fields.geminiModel.value.trim(),
    geminiApiUrl: fields.geminiApiUrl.value.trim(),
    geminiPrompt: fields.geminiPrompt.value.trim(),
    questionsGeminiApiKey: fields.questionsGeminiApiKey.value.trim(),
    questionsGeminiModel: fields.questionsGeminiModel.value.trim(),
    questionsGeminiApiUrl: fields.questionsGeminiApiUrl.value.trim(),
    questionsGeminiPrompt: fields.questionsGeminiPrompt.value.trim(),
    nextStepGeminiPrompt: fields.nextStepGeminiPrompt.value.trim(),
    wieland: {
      nccCampaignId: fields.wielandNccCampaignId.value.trim(),
      slotsNeeded: parseInt(fields.wielandSlotsNeeded.value) || 8,
      uploadFileName: fields.wielandUploadFileName.value.trim(),
      nccFieldmappingId: fields.wielandNccFieldmappingId.value.trim(),
      nccAuthType: fields.wielandNccAuthType.value || "token",
      visibleTabs: readWielandVisibleTabs(),
      listButtons: readWielandListButtons(),
      widgetToContactMap: readWielandWidgetMap(),
      contactToListMap: readWielandContactToListMap()
    },
    wielandNccCredential: fields.wielandNccCredential.value.trim(),
    token: fields.token.value.trim(),
    cookie: fields.cookie.value.trim(),
    allowedKbIds: fields.allowedKbIds.value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean),
    ui: {
      shared: {
        language: fields.sharedLanguage.value,
        fontFamily: fields.sharedFontFamily.value.trim(),
        baseFontSize: fields.sharedBaseFontSize.value.trim()
      },
      chat: {
        titleText: fields.chatTitleText.value.trim(),
        titleSize: fields.chatTitleSize.value.trim(),
        metaSize: fields.chatMetaSize.value.trim(),
        embedMinHeight: fields.chatEmbedMinHeight.value.trim(),
        embedMaxHeight: fields.chatEmbedMaxHeight.value.trim(),
        showTitle: fields.chatShowTitle.checked,
        showMeta: fields.chatShowMeta.checked
      },
      workitem: {
        titleText: fields.workitemTitleText.value.trim(),
        titleSize: fields.workitemTitleSize.value.trim(),
        metaSize: fields.workitemMetaSize.value.trim(),
        embedMinHeight: fields.workitemEmbedMinHeight.value.trim(),
        embedMaxHeight: fields.workitemEmbedMaxHeight.value.trim(),
        showTitle: fields.workitemShowTitle.checked,
        showMeta: fields.workitemShowMeta.checked
      },
      questions: {
        titleText: fields.questionsTitleText.value.trim(),
        titleSize: fields.questionsTitleSize.value.trim(),
        metaSize: fields.questionsMetaSize.value.trim(),
        questionSize: fields.questionsQuestionSize.value.trim(),
        evidenceSize: fields.questionsEvidenceSize.value.trim(),
        metaFontSize: fields.questionsMetaFontSize.value.trim(),
        embedMinHeight: fields.questionsEmbedMinHeight.value.trim(),
        embedMaxHeight: fields.questionsEmbedMaxHeight.value.trim(),
        refreshIntervalSeconds: Number(fields.questionsRefreshIntervalSeconds.value || 30),
        useGemini: fields.questionsUseGemini.checked,
        clientQuestionsUseGemini: fields.clientQuestionsUseGemini.checked,
        clientQuestionsRefreshSeconds: parseInt(fields.clientQuestionsRefreshSeconds.value) || 30,
        showTitle: fields.questionsShowTitle.checked,
        showPageHeader: fields.questionsShowPageHeader.checked,
        showMeta: fields.questionsShowMeta.checked,
        showEvidence: fields.questionsShowEvidence.checked,
        showCardShadow: fields.questionsShowCardShadow.checked,
        items: readQuestionItems()
      },
      nextStep: {
        titleText: fields.nextStepTitleText.value.trim(),
        titleSize: fields.nextStepTitleSize.value.trim(),
        metaSize: fields.nextStepMetaSize.value.trim(),
        embedMinHeight: fields.nextStepEmbedMinHeight.value.trim(),
        embedMaxHeight: fields.nextStepEmbedMaxHeight.value.trim(),
        refreshIntervalSeconds: Number(fields.nextStepRefreshIntervalSeconds.value || 30),
        showCardShadow: fields.nextStepShowCardShadow.checked,
        liveSize: fields.nextStepLiveSize.value.trim(),
        badgeSize: fields.nextStepBadgeSize.value.trim(),
        kickerSize: fields.nextStepKickerSize.value.trim(),
        actionTitleSize: fields.nextStepActionTitleSize.value.trim(),
        actionTextSize: fields.nextStepActionTextSize.value.trim(),
        suggestedLabelSize: fields.nextStepSuggestedLabelSize.value.trim(),
        suggestedTextSize: fields.nextStepSuggestedTextSize.value.trim(),
        buttonTextSize: fields.nextStepButtonTextSize.value.trim(),
        articleTitleSize: fields.nextStepArticleTitleSize.value.trim(),
        articleTextSize: fields.nextStepArticleTextSize.value.trim(),
        chipSize: fields.nextStepChipSize.value.trim(),
        reasonSize: fields.nextStepReasonSize.value.trim(),
        metaFontSize: fields.nextStepMetaFontSize.value.trim(),
        useGemini: fields.nextStepUseGemini.checked
      },
      sentiment: {
        titleText: fields.sentimentTitleText.value.trim(),
        titleSize: fields.sentimentTitleSize.value.trim(),
        metaSize: fields.sentimentMetaSize.value.trim(),
        embedMinHeight: fields.sentimentEmbedMinHeight.value.trim(),
        embedMaxHeight: fields.sentimentEmbedMaxHeight.value.trim(),
        sentimentLayout: fields.sentimentLayout.value,
        sentimentStylePreset: fields.sentimentStylePreset.value,
        sentimentCardMaxWidth: fields.sentimentCardMaxWidth.value.trim(),
        sentimentCardMinHeight: fields.sentimentCardMinHeight.value.trim(),
        sentimentCardMaxHeight: fields.sentimentCardMaxHeight.value.trim(),
        sentimentCardPadding: fields.sentimentCardPadding.value.trim(),
        sentimentCardRadius: fields.sentimentCardRadius.value.trim(),
        sentimentOrbSize: fields.sentimentOrbSize.value.trim(),
        sentimentDualPanelGlowSize: fields.sentimentDualPanelGlowSize.value.trim(),
        sentimentDualPanelSectionGap: fields.sentimentDualPanelSectionGap.value.trim(),
        sentimentDualPanelTextOrbGap: fields.sentimentDualPanelTextOrbGap.value.trim(),
        sentimentDualPanelTextGap: fields.sentimentDualPanelTextGap.value.trim(),
        sentimentDualPanelHeartSize: fields.sentimentDualPanelHeartSize.value.trim(),
        sentimentCardTitleFontSize: fields.sentimentCardTitleFontSize.value.trim(),
        sentimentLabelFontSize: fields.sentimentLabelFontSize.value.trim(),
        sentimentScoreFontSize: fields.sentimentScoreFontSize.value.trim(),
        sentimentInsightTitleSize: fields.sentimentInsightTitleSize.value.trim(),
        sentimentInsightTextSize: fields.sentimentInsightTextSize.value.trim(),
        sentimentMetaFontSize: fields.sentimentMetaFontSize.value.trim(),
        sentimentDualPanelChartHeight: fields.sentimentDualPanelChartHeight.value.trim(),
        sentimentDualPanelChartTopGap: fields.sentimentDualPanelChartTopGap.value.trim(),
        sentimentCompactBreakpoint: fields.sentimentCompactBreakpoint.value.trim(),
        sentimentCompactCardPadding: fields.sentimentCompactCardPadding.value.trim(),
        sentimentCompactOrbSize: fields.sentimentCompactOrbSize.value.trim(),
        sentimentCompactTitleFontSize: fields.sentimentCompactTitleFontSize.value.trim(),
        sentimentCompactLabelFontSize: fields.sentimentCompactLabelFontSize.value.trim(),
        sentimentCompactScoreFontSize: fields.sentimentCompactScoreFontSize.value.trim(),
        sentimentCompactInsightTitleSize: fields.sentimentCompactInsightTitleSize.value.trim(),
        sentimentCompactInsightTextSize: fields.sentimentCompactInsightTextSize.value.trim(),
        sentimentCompactMetaFontSize: fields.sentimentCompactMetaFontSize.value.trim(),
        refreshIntervalSeconds: Number(fields.sentimentRefreshIntervalSeconds.value || 30),
        useGemini: fields.sentimentProvider.value !== "heuristic",
        showTitle: fields.sentimentShowTitle.checked,
        showPageHeader: fields.sentimentShowPageHeader.checked,
        showMeta: fields.sentimentShowMeta.checked
      }
    },
    summaryagenticAiApiKey: fields.summaryagenticAiApiKey.value.trim(),
    summaryagenticHubspotToken: fields.summaryagenticHubspotToken?.value.trim() || "",
    summaryagenticWarmToken: fields.summaryagenticWarmToken?.value.trim() || "",
    summaryagentic: {
      enabled: fields.summaryagenticEnabled.checked,
      cacheSeconds: Number(fields.summaryagenticCacheSeconds.value || 60),
      aiProvider: fields.summaryagenticAiProvider.value || "claude",
      aiModel: fields.summaryagenticAiModel.value.trim(),
      aiPrompt: fields.summaryagenticAiPrompt.value.trim(),
      dataSources: readSummaryDataSources(),
      hubspot: {
        enabled: fields.summaryagenticHubspotEnabled?.checked === true,
        objects: [...document.querySelectorAll(".sa-hs-obj:checked")].map((cb) => cb.value)
      },
      activeLayout: (() => {
        try { return JSON.parse(document.getElementById("summaryagenticActiveLayout")?.value || "null"); } catch { return null; }
      })()
    },
    pulseformsAiApiKey: fields.pulseformsAiApiKey?.value.trim() || "",
    pulseforms: {
      enabled: fields.pulseformsEnabled?.checked !== false,
      mode: fields.pulseformsMode?.value || "query",
      aiProvider: fields.pulseformsAiProvider?.value || "claude",
      aiModel: fields.pulseformsAiModel?.value.trim() || "",
      aiPrompt: fields.pulseformsAiPrompt?.value.trim() || "",
      formFields: readPulseFormsFields(),
      dataSources: readPulseFormsDataSources(),
      activeLayout: (() => {
        try { return JSON.parse(document.getElementById("pulseformsActiveLayout")?.value || "null"); } catch { return null; }
      })()
    }
  };
}

function resetWielandFieldmappingInfo(message = "Save the campaign to load field mapping details.") {
  if (wielandConfiguredFieldmappingInfo) wielandConfiguredFieldmappingInfo.value = message;
  if (wielandAvailableFieldmappingsInfo) wielandAvailableFieldmappingsInfo.value = message;
}

function formatFieldmappingSummary(item) {
  if (!item) return "No field mapping resolved.";
  const fieldsList = Object.entries(item.fields || {})
    .map(([contactField, mappedField]) => `${contactField} -> ${mappedField}`)
    .join("\n");
  return [
    `Name: ${item.name || item.localizations?.name?.en?.value || "—"}`,
    `ID: ${item._id || item.fieldmappingsId || item.id || "—"}`,
    `Schema: ${item.schema || "—"}`,
    `File: ${item.fileName || "—"}`,
    "",
    fieldsList || "No mapped fields."
  ].join("\n");
}

async function loadWielandFieldmappingInfo() {
  if (!wielandConfiguredFieldmappingInfo || !wielandAvailableFieldmappingsInfo) return;
  const campaignId = fields.id.value.trim() || state.selectedId;
  if (!campaignId) {
    resetWielandFieldmappingInfo();
    return;
  }

  wielandConfiguredFieldmappingInfo.value = "Loading…";
  wielandAvailableFieldmappingsInfo.value = "Loading…";

  try {
    const [statusData, fieldmapData] = await Promise.all([
      apiRequest(`/api/wieland/campaign/status?campaign=${encodeURIComponent(campaignId)}`),
      apiRequest(`/api/wieland/fieldmap/ncc?campaign=${encodeURIComponent(campaignId)}`)
    ]);

    const configured = statusData?.campaign?.expansions?.fieldMappingsId || null;
    const forcedId = fields.wielandNccFieldmappingId.value.trim();
    const available = (fieldmapData?.fieldmappings || []).filter((item) => item?.schema === "contact");
    const forced = available.find((item) => (item?._id || item?.fieldmappingsId || item?.id || "") === forcedId);

    wielandConfiguredFieldmappingInfo.value = [
      "Campaign field mapping",
      formatFieldmappingSummary(configured),
      "",
      "Forced field mapping from Admin",
      forcedId ? formatFieldmappingSummary(forced || { _id: forcedId, name: "Configured ID not found in NCC response" }) : "No forced field mapping configured."
    ].join("\n");

    wielandAvailableFieldmappingsInfo.value = available.length
      ? available.map((item) => [
          `${item.name || item.localizations?.name?.en?.value || "Unnamed"}`,
          `ID: ${item._id || item.fieldmappingsId || item.id || "—"}`,
          `File: ${item.fileName || "—"}`,
          `Fields: ${Object.keys(item.fields || {}).length}`
        ].join("\n")).join("\n\n")
      : "No NCC contact field mappings found.";
  } catch (error) {
    resetWielandFieldmappingInfo(`Unable to load field mapping details.\n${error.message}`);
  }
}

function updateWielandCredentialField(authType) {
  const row = document.getElementById("wielandCredentialField");
  const label = document.getElementById("wielandCredentialLabel");
  const note = document.getElementById("wielandCredentialNote");
  const input = fields.wielandNccCredential;
  const isNone = authType === "none";
  row.hidden = isNone;
  row.style.display = isNone ? "none" : "";
  if (isNone) return;
  if (authType === "key") {
    label.textContent = "NCC Credential";
    input.placeholder = "eyJ0eXAiOiJKV1Qi\u2026";
    note.innerHTML = "Sent as <code>Authorization: Bearer &lt;token&gt;</code>.";
  } else {
    label.textContent = "NCC Token";
    input.placeholder = "eyJ0eXAiOiJKV1Qi\u2026";
    note.innerHTML = "Sent as <code>Authorization: &lt;token&gt;</code> (NCC/Thrio format).";
  }
}

function applyDefaultUiValues() {
  fields.wielandNccCampaignId.value = "";
  fields.wielandSlotsNeeded.value = 8;
  fields.wielandUploadFileName.value = "";
  fields.wielandNccFieldmappingId.value = "";
  fields.wielandNccAuthType.value = "token";
  fields.wielandNccCredential.value = "";
  setWielandVisibleTabs();
  setWielandListButtons();
  updateWielandCredentialField("token");
  document.getElementById("wielandOpenLink").hidden = true;
  resetWielandFieldmappingInfo();
  fields.apiUrl.value = "https://mancity.thrio.io/data/api/ai/prediction";
  fields.workitemApiUrl.value = "https://mancity.thrio.io/users/api/workitems";
  fields.agentChatApiUrl.value = "https://mancity.thrio.io/chats/api/agent/chats";
  fields.agentUserId.value = "";
  fields.sentimentProvider.value = "heuristic";
  fields.geminiApiKey.value = "";
  fields.geminiModel.value = "gemini-2.5-flash";
  fields.geminiApiUrl.value = "https://generativelanguage.googleapis.com";
  fields.geminiPrompt.value = "";
  fields.sharedLanguage.value = "en";
  fields.sharedFontFamily.value = "";
  fields.sharedBaseFontSize.value = "16px";
  fields.chatTitleText.value = "";
  fields.chatTitleSize.value = "2rem";
  fields.chatMetaSize.value = "0.82rem";
  fields.chatEmbedMinHeight.value = "180px";
  fields.chatEmbedMaxHeight.value = "520px";
  fields.chatShowTitle.checked = true;
  fields.chatShowMeta.checked = true;
  fields.workitemTitleText.value = "";
  fields.workitemTitleSize.value = "2rem";
  fields.workitemMetaSize.value = "0.82rem";
  fields.workitemEmbedMinHeight.value = "180px";
  fields.workitemEmbedMaxHeight.value = "520px";
  fields.workitemShowTitle.checked = true;
  fields.workitemShowMeta.checked = true;
  fields.questionsGeminiApiKey.value = "";
  fields.questionsUseGemini.checked = true;
  fields.clientQuestionsUseGemini.checked = true;
  fields.clientQuestionsRefreshSeconds.value = "";
  fields.questionsGeminiModel.value = "gemini-2.5-flash";
  fields.questionsGeminiApiUrl.value = "https://generativelanguage.googleapis.com";
  fields.questionsGeminiPrompt.value = "";
  fields.questionsTitleText.value = "Checklist";
  fields.questionsTitleSize.value = "2rem";
  fields.questionsMetaSize.value = "0.82rem";
  fields.questionsQuestionSize.value = "1rem";
  fields.questionsEvidenceSize.value = "1rem";
  fields.questionsMetaFontSize.value = "0.82rem";
  fields.questionsEmbedMinHeight.value = "220px";
  fields.questionsEmbedMaxHeight.value = "560px";
  fields.questionsRefreshIntervalSeconds.value = 30;
  fields.questionsShowTitle.checked = true;
  fields.questionsShowPageHeader.checked = true;
  fields.questionsShowMeta.checked = true;
  fields.questionsShowEvidence.checked = true;
  fields.questionsShowCardShadow.checked = true;
  renderQuestionItems([
    "Did the client confirm their name?",
    "Did the client confirm their phone number?",
    "Did the client explain the issue?",
    "Did the client provide an address or unit?",
    "Did the client mention urgency or severity?"
  ]);
  fields.nextStepTitleText.value = "NextIQ Assistant";
  fields.nextStepTitleSize.value = "2rem";
  fields.nextStepMetaSize.value = "0.82rem";
  fields.nextStepEmbedMinHeight.value = "220px";
  fields.nextStepEmbedMaxHeight.value = "280px";
  fields.nextStepRefreshIntervalSeconds.value = 30;
  fields.nextStepShowCardShadow.checked = true;
  fields.nextStepLiveSize.value = "1rem";
  fields.nextStepBadgeSize.value = "0.82rem";
  fields.nextStepKickerSize.value = "0.86rem";
  fields.nextStepActionTitleSize.value = "1.6rem";
  fields.nextStepActionTextSize.value = "1rem";
  fields.nextStepSuggestedLabelSize.value = "0.84rem";
  fields.nextStepSuggestedTextSize.value = "1.35rem";
  fields.nextStepButtonTextSize.value = "1rem";
  fields.nextStepArticleTitleSize.value = "1rem";
  fields.nextStepArticleTextSize.value = "0.84rem";
  fields.nextStepChipSize.value = "0.84rem";
  fields.nextStepReasonSize.value = "0.92rem";
  fields.nextStepMetaFontSize.value = "0.8rem";
  fields.nextStepUseGemini.checked = true;
  fields.nextStepGeminiPrompt.value = "";
  fields.sentimentTitleText.value = "";
  fields.sentimentTitleSize.value = "2rem";
  fields.sentimentMetaSize.value = "0.82rem";
  fields.sentimentEmbedMinHeight.value = "180px";
  fields.sentimentEmbedMaxHeight.value = "520px";
  fields.sentimentLayout.value = "centered";
  fields.sentimentStylePreset.value = "stacked";
  fields.sentimentCardMaxWidth.value = "560px";
  fields.sentimentCardMinHeight.value = "0px";
  fields.sentimentCardMaxHeight.value = "none";
  fields.sentimentCardPadding.value = "34px 40px 28px";
  fields.sentimentCardRadius.value = "38px";
  fields.sentimentOrbSize.value = "180px";
  fields.sentimentDualPanelGlowSize.value = "180px";
  fields.sentimentDualPanelSectionGap.value = "0px";
  fields.sentimentDualPanelTextOrbGap.value = "18px";
  fields.sentimentDualPanelTextGap.value = "6px";
  fields.sentimentDualPanelHeartSize.value = "68px";
  fields.sentimentCardTitleFontSize.value = "3.6rem";
  fields.sentimentLabelFontSize.value = "3rem";
  fields.sentimentScoreFontSize.value = "4rem";
  fields.sentimentInsightTitleSize.value = "1rem";
  fields.sentimentInsightTextSize.value = "0.98rem";
  fields.sentimentMetaFontSize.value = "0.82rem";
  fields.sentimentDualPanelChartHeight.value = "92px";
  fields.sentimentDualPanelChartTopGap.value = "18px";
  fields.sentimentCompactBreakpoint.value = "560px";
  fields.sentimentCompactCardPadding.value = "16px 14px 12px";
  fields.sentimentCompactOrbSize.value = "126px";
  fields.sentimentCompactTitleFontSize.value = "2.4rem";
  fields.sentimentCompactLabelFontSize.value = "2rem";
  fields.sentimentCompactScoreFontSize.value = "2.8rem";
  fields.sentimentCompactInsightTitleSize.value = "0.92rem";
  fields.sentimentCompactInsightTextSize.value = "0.88rem";
  fields.sentimentCompactMetaFontSize.value = "0.72rem";
  fields.sentimentRefreshIntervalSeconds.value = 30;
  fields.sentimentShowTitle.checked = true;
  fields.sentimentShowPageHeader.checked = true;
  fields.sentimentShowMeta.checked = true;
  // Summary Agentic defaults
  fields.summaryagenticEnabled.checked = true;
  fields.summaryagenticCacheSeconds.value = 60;
  fields.summaryagenticAiProvider.value = "claude";
  fields.summaryagenticAiModel.value = "";
  fields.summaryagenticAiApiKey.value = "";
  fields.summaryagenticAiPrompt.value = "";
  if (fields.pulseformsEnabled) fields.pulseformsEnabled.checked = true;
  if (fields.pulseformsMode) fields.pulseformsMode.value = "query";
  if (fields.pulseformsAiProvider) fields.pulseformsAiProvider.value = "claude";
  if (fields.pulseformsAiModel) fields.pulseformsAiModel.value = "";
  if (fields.pulseformsAiApiKey) fields.pulseformsAiApiKey.value = "";
  if (fields.pulseformsAiPrompt) fields.pulseformsAiPrompt.value = "";
  renderPulseFormsFields([
    { id: "first_name", label: "First name", type: "text", required: false },
    { id: "last_name", label: "Last name", type: "text", required: false },
    { id: "phone", label: "Phone", type: "phone", required: true },
    { id: "email", label: "Email", type: "email", required: false }
  ]);
  renderPulseFormsDataSources([
    {
      id: crypto.randomUUID(),
      name: "Sugar CRM — Contact lookup",
      mode: "query",
      url: "https://sugar.example.com/rest/v11/Contacts?filter[0][phone_work][$equals]={{phone}}",
      method: "GET",
      headersJson: '{"OAuth-Token": "YOUR_SUGAR_TOKEN"}',
      bodyTemplate: "",
      fixedParams: "",
      enabled: true,
      description: "Consulta contactos de Sugar CRM por telefono.",
      fieldMappings: {
        first_name: "first_name",
        last_name: "last_name",
        phone: "phone_work",
        email: "email1"
      }
    }
  ]);
  const pfLayoutEl = document.getElementById("pulseformsActiveLayout");
  if (pfLayoutEl) pfLayoutEl.value = "null";
  renderPulseFormsActiveLayout(null);
  updatePulseFormsUrls("");
  renderSummaryDataSources([
    {
      id: crypto.randomUUID(),
      name: "Example CRM — Call History",
      url: "https://api.example.com/calls?phone={{phone}}",
      method: "GET",
      headersJson: '{"Authorization": "Bearer YOUR_TOKEN_HERE"}',
      bodyTemplate: "",
      selectedFields: [],
      enabled: true,
      testPhone: "+15551234567"
    }
  ]);
  updateSummaryAgenticUrls("");
  schedulePreviewRender();
}

async function apiRequest(url, options = {}) {
  const response = await fetch(buildApiUrl(url), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (response.status === 401) {
    location.replace(buildApiUrl("/login.html"));
    throw new Error("Session expired. Redirecting to login…");
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function setStatus(message) {
  statusNode.textContent = message;
}

async function initSession() {
  try {
    const data = await fetch(buildApiUrl("/api/admin/me"), { credentials: "include" }).then(r => r.json());
    if (!data.user) {
      location.replace(buildApiUrl("/login.html"));
      return;
    }
    state.currentUser = data.user;
    adminUserName.textContent = data.user.username;
    adminUserRole.textContent = data.user.role;
    adminUserBar.hidden = false;
    updateAdminPermissionUi();

    if (data.user.role === "admin" && usersSection) {
      usersSection.hidden = false;
    }

    adminGrid.hidden = false;
    adminLockedMessage.hidden = true;

    await loadCampaigns();
    if (data.user.role === "admin") await loadUsers();
    schedulePreviewRender();
  } catch {
    location.replace(buildApiUrl("/login.html"));
  }
}

async function loadUsers() {
  try {
    const data = await apiRequest("/api/admin/users");
    renderUsers(data.users || []);
  } catch (err) {
    setStatus(err.message);
  }
}

function renderUsers(users) {
  userList.innerHTML = "";
  if (!users.length) {
    const p = document.createElement("p");
    p.className = "admin-section-note";
    p.style.padding = "8px 0";
    p.textContent = "No users yet.";
    userList.appendChild(p);
    return;
  }
  for (const user of users) {
    const row = document.createElement("div");
    row.className = "admin-user-item";
    const isSelf = state.currentUser && user.id === state.currentUser.id;
    const permissionLabel = user.role === "admin"
      ? "All permissions"
      : formatUserPermissions(user.permissions);
    row.innerHTML = `
      <span class="admin-user-item-name">${escapeHtml(user.username)}${isSelf ? " (you)" : ""}</span>
      <span class="admin-user-item-role ${user.role}">${escapeHtml(user.role)}</span>
      <span class="admin-user-item-permissions">${escapeHtml(permissionLabel)}</span>
      <span class="admin-user-item-date">${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ""}</span>
      <div class="admin-user-item-actions">
        ${!isSelf ? `<button type="button" class="danger" data-delete="${escapeHtml(user.id)}">Delete</button>` : ""}
      </div>
    `;
    const deleteBtn = row.querySelector("[data-delete]");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        if (!confirm(`Delete user "${user.username}"?`)) return;
        try {
          await apiRequest("/api/admin/users/delete", { method: "POST", body: JSON.stringify({ id: user.id }) });
          showToast(`User "${user.username}" deleted.`);
          await loadUsers();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    }
    userList.appendChild(row);
  }
}

function formatUserPermissions(permissions) {
  const labels = [];
  if (permissions?.createCampaign) labels.push("create");
  if (permissions?.editCampaign) labels.push("edit");
  if (permissions?.deleteCampaign) labels.push("delete");
  return labels.length ? labels.join(", ") : "No campaign permissions";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildApiUrl(pathname) {
  const normalized = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return new URL(normalized, apiBaseUrl).toString();
}

function schedulePreviewRender() {
  clearTimeout(state.previewTimer);
  state.previewTimer = window.setTimeout(renderPreview, 80);
}

function renderPreview() {
  if (!previewFrame || !previewStage) {
    return;
  }

  const config = readForm();
  const width = normalizePreviewDimension(previewViewportWidth.value, "960px");
  const height = normalizePreviewDimension(previewViewportHeight.value, "540px");
  const scale = Number(previewScale.value || "1");

  previewStage.style.width = width;
  previewStage.style.height = height;
  previewFrame.style.width = width;
  previewFrame.style.height = height;
  previewFrame.style.transform = `scale(${scale})`;

  const previewPage = previewPageType.value || "sentiment";
  previewFrame.srcdoc = buildPreviewDocument(previewPage, config, {
    width,
    height,
    styleUrl: new URL("styles.css", apiBaseUrl).toString()
  });
}

function renderPreviewPlaceholder(message) {
  if (!previewFrame) {
    return;
  }

  previewFrame.srcdoc = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          font-family: "Manrope", sans-serif;
          background: linear-gradient(180deg, #faf8f4 0%, #f5f2ec 100%);
          color: #666d7d;
        }
        p {
          margin: 0;
          max-width: 420px;
          text-align: center;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <p>${escapeHtml(message)}</p>
    </body>
  </html>`;
}

function normalizePreviewDimension(value, fallback) {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
}

function buildPreviewDocument(pageType, config, previewOptions) {
  const shellClass = pageType === "chat" ? "shell" : "shell";
  const content = pageType === "chat"
    ? buildChatPreview(config)
    : pageType === "sentiment-chip"
      ? buildSentimentChipPreview(config)
    : pageType === "agent-next-step"
      ? buildAgentNextStepPreview(config)
    : pageType === "agent-quality-board"
      ? buildAgentQualityBoardPreview(config)
    : pageType === "smart-checklist"
      ? buildSmartChecklistPreview(config)
    : pageType === "questions"
      ? buildQuestionsPreview(config)
    : pageType === "workitem"
      ? buildWorkitemPreview(config)
    : pageType === "pulseforms"
      ? buildPulseFormsPreview(config)
      : buildSentimentPreview(config);

  return `<!DOCTYPE html>
  <html lang="en" class="embedded">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="${escapeHtml(previewOptions.styleUrl)}" />
      <style>
        html, body {
          width: ${escapeHtml(previewOptions.width)};
          min-width: ${escapeHtml(previewOptions.width)};
          height: ${escapeHtml(previewOptions.height)};
          min-height: ${escapeHtml(previewOptions.height)};
          overflow: auto;
        }

        body {
          --campaign-font-family: ${escapeHtml(config.ui.shared.fontFamily || '"Manrope", sans-serif')};
          --campaign-base-font-size: ${escapeHtml(config.ui.shared.baseFontSize || "16px")};
          --campaign-questions-card-shadow: ${escapeHtml(config.ui.questions.showCardShadow === false ? "none" : "0 30px 80px rgba(28, 40, 83, 0.14)")};
          --campaign-questions-question-size: ${escapeHtml(config.ui.questions.questionSize || "1rem")};
          --campaign-questions-evidence-size: ${escapeHtml(config.ui.questions.evidenceSize || "1rem")};
          --campaign-questions-meta-font-size: ${escapeHtml(config.ui.questions.metaFontSize || "0.82rem")};
          --campaign-next-step-title-size: ${escapeHtml(config.ui.nextStep?.titleSize || "2rem")};
          --campaign-next-step-card-shadow: ${escapeHtml(config.ui.nextStep?.showCardShadow === false ? "none" : "0 22px 60px rgba(26, 40, 82, 0.12)")};
          --campaign-next-step-inner-shadow: ${escapeHtml(config.ui.nextStep?.showCardShadow === false ? "none" : "0 14px 30px rgba(30, 44, 89, 0.08)")};
          --campaign-next-step-article-shadow: ${escapeHtml(config.ui.nextStep?.showCardShadow === false ? "none" : "0 12px 24px rgba(30, 44, 89, 0.06)")};
          --campaign-next-step-live-size: ${escapeHtml(config.ui.nextStep?.liveSize || "1rem")};
          --campaign-next-step-badge-size: ${escapeHtml(config.ui.nextStep?.badgeSize || "0.82rem")};
          --campaign-next-step-kicker-size: ${escapeHtml(config.ui.nextStep?.kickerSize || "0.86rem")};
          --campaign-next-step-action-title-size: ${escapeHtml(config.ui.nextStep?.actionTitleSize || "1.6rem")};
          --campaign-next-step-action-text-size: ${escapeHtml(config.ui.nextStep?.actionTextSize || "1rem")};
          --campaign-next-step-suggested-label-size: ${escapeHtml(config.ui.nextStep?.suggestedLabelSize || "0.84rem")};
          --campaign-next-step-suggested-text-size: ${escapeHtml(config.ui.nextStep?.suggestedTextSize || "1.35rem")};
          --campaign-next-step-button-text-size: ${escapeHtml(config.ui.nextStep?.buttonTextSize || "1rem")};
          --campaign-next-step-article-title-size: ${escapeHtml(config.ui.nextStep?.articleTitleSize || "1rem")};
          --campaign-next-step-article-text-size: ${escapeHtml(config.ui.nextStep?.articleTextSize || "0.84rem")};
          --campaign-next-step-chip-size: ${escapeHtml(config.ui.nextStep?.chipSize || "0.84rem")};
          --campaign-next-step-reason-size: ${escapeHtml(config.ui.nextStep?.reasonSize || "0.92rem")};
          --campaign-next-step-meta-font-size: ${escapeHtml(config.ui.nextStep?.metaFontSize || "0.8rem")};
          margin: 0;
        }

        .shell {
          min-height: ${escapeHtml(previewOptions.height)};
        }

        .frame {
          min-height: auto;
        }

        .frame-static {
          min-height: auto;
        }
      </style>
    </head>
    <body class="embedded">
      <main class="${shellClass}">
        ${content}
      </main>
    </body>
  </html>`;
}

function buildChatPreview(config) {
  const ui = config.ui.chat;
  const titleText = ui.titleText || config.name || "NextIQ";
  const metaText = `${config.name || "Sample campaign"} | ${config.domain || "mancity.thrio.io"} | KB: ${(config.allowedKbIds[0] || "69b7c1301d31ed595dfef3cb").toUpperCase()}`;

  return `
    ${ui.showTitle ? `<header class="brandbar"><div class="brand" style="font-size:${escapeHtml(ui.titleSize || "2rem")}">${escapeHtml(titleText)}</div>${ui.showMeta ? `<div class="campaign-badge" style="font-size:${escapeHtml(ui.metaSize || "0.82rem")}">${escapeHtml(metaText)}</div>` : ""}</header>` : ""}
    <section class="frame">
      <div class="messages">
        <article class="message user">
          <div class="message-meta">You</div>
          <div class="message-bubble"><p>Do you manage short-term rentals?</p></div>
        </article>
        <article class="message assistant">
          <div class="message-meta">NextIQ</div>
          <div class="message-bubble">
            <p>Yes. We support short-term rental workflows, guest requests, and after-hours property operations.</p>
            <div class="sources">
              <a href="#" class="source-card">
                <strong>Property Playbook</strong>
                <span>Relevant policy excerpt and routing hints</span>
              </a>
            </div>
          </div>
        </article>
      </div>
      <form class="composer">
        <input type="text" placeholder="Help me find answers..." />
        <button type="button" aria-label="Send">
          <svg class="send-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12h12"></path>
            <path d="m11 5 7 7-7 7"></path>
          </svg>
        </button>
      </form>
    </section>`;
}

function buildWorkitemPreview(config) {
  const language = normalizeLanguage(config.ui.shared.language);
  const ui = config.ui.workitem;
  const titleText = ui.titleText || translate(language, "workitem_title");
  const metaText = `${config.name || "Sample campaign"} | ${config.domain || "astonvilla.thrio.io"} | ${translate(language, "workitem")}: 459F0ADA-9EC1-485D-B904-6F6DBCBF65E8`;

  return `
    ${ui.showTitle ? `<header class="brandbar"><div class="brand" style="font-size:${escapeHtml(ui.titleSize || "2rem")}">${escapeHtml(titleText)}</div>${ui.showMeta ? `<div class="campaign-badge" style="font-size:${escapeHtml(ui.metaSize || "0.82rem")}">${escapeHtml(metaText)}</div>` : ""}</header>` : ""}
    <section class="frame frame-static">
      <div class="inspector">
        <section class="summary-card">
          <div class="summary-title">Client transcript sentiment</div>
          <div class="sentiment-banner yellow">${translate(language, "neutral")} · -0.17</div>
          <div class="detail-grid">
            <div class="detail-row"><span>Caller</span><strong>Oscar Bello</strong></div>
            <div class="detail-row"><span>Channel</span><strong>Voice</strong></div>
            <div class="detail-row"><span>Phone</span><strong>+34 672 420 697</strong></div>
            <div class="detail-row"><span>Status</span><strong>Active</strong></div>
          </div>
        </section>
        <section class="transcript-list">
          <article class="transcript-card sentiment-yellow">
            <div class="transcript-meta"><span>${translate(language, "client")}</span><span>11:52 AM</span></div>
            <div class="transcript-sentiment"><span class="sentiment-pill yellow">${translate(language, "neutral")}</span></div>
            <div class="transcript-text">Hola, sí, estamos probando. Para ver si funciona.</div>
          </article>
          <article class="transcript-card sentiment-green">
            <div class="transcript-meta"><span>${translate(language, "client")}</span><span>11:53 AM</span></div>
            <div class="transcript-sentiment"><span class="sentiment-pill green">${translate(language, "positive")}</span></div>
            <div class="transcript-text">Perfecto, gracias. Eso era justo lo que necesitaba.</div>
          </article>
        </section>
      </div>
    </section>`;
}

function buildPulseFormsPreview(config) {
  const pf = config.pulseforms || {};
  const sources = pf.dataSources || [];
  const formFields = pf.formFields || [];
  return `
    <main style="padding:22px;font-family:Manrope,sans-serif;background:#f7f5f0;min-height:100%;">
      <section style="background:#fff;border:1px solid #d7deec;border-radius:12px;padding:20px;box-shadow:0 10px 24px rgba(32,42,90,.08);">
        <h1 style="margin:0 0 6px;color:#202a5a;font-size:1.55rem;">PulseForms</h1>
        <p style="margin:0 0 18px;color:#667085;">CRM query and submit widget · ${escapeHtml(pf.mode || "query")}</p>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
          <div style="border:1px solid #d7deec;border-radius:9px;padding:12px;background:#fbfcff;"><strong>AI Provider</strong><br>${escapeHtml(pf.aiProvider || "claude")}</div>
          <div style="border:1px solid #d7deec;border-radius:9px;padding:12px;background:#fbfcff;"><strong>Sources</strong><br>${sources.length}</div>
          <div style="border:1px solid #d7deec;border-radius:9px;padding:12px;background:#fbfcff;"><strong>Form fields</strong><br>${formFields.length}</div>
          ${sources.slice(0, 4).map((src) => `
            <div style="border:1px solid #d7deec;border-radius:9px;padding:12px;background:#fbfcff;">
              <strong>${escapeHtml(src.name || "CRM source")}</strong><br>
              <span style="color:#667085;">${escapeHtml(src.mode || "query")} · ${escapeHtml(src.method || "GET")} · ${Object.keys(src.fieldMappings || {}).length} mappings</span>
            </div>
          `).join("")}
          ${formFields.slice(0, 6).map((field) => `
            <div style="border:1px solid #d7deec;border-radius:9px;padding:12px;background:#fff;">
              <strong>${escapeHtml(field.label || field.id)}</strong><br>
              <span style="color:#667085;">${escapeHtml(field.id || "")} · ${escapeHtml(field.type || "text")}${field.required ? " · required" : ""}</span>
            </div>
          `).join("")}
        </div>
      </section>
    </main>`;
}

function buildSentimentPreview(config) {
  const language = normalizeLanguage(config.ui.shared.language);
  const ui = config.ui.sentiment;
  const pageTitle = ui.titleText || translate(language, "sentiment");
  const metaText = `${config.name || "Sample campaign"} | ${config.domain || "astonvilla.thrio.io"} | ${translate(language, "workitem")}: 9775DE57-5AEE-4D46-A597-8550B993082C`;
  const styleClass = mapSentimentStyle(ui.sentimentStylePreset);
  const layoutClass = mapSentimentLayout(ui.sentimentLayout);

  return `
    ${ui.showPageHeader ? `<header class="brandbar"><div class="brand" style="font-size:${escapeHtml(ui.titleSize || "2rem")}">${escapeHtml(pageTitle)}</div>${ui.showMeta ? `<div class="campaign-badge" style="font-size:${escapeHtml(ui.metaSize || "0.82rem")}">${escapeHtml(metaText)}</div>` : ""}</header>` : ""}
    <section class="frame frame-static">
      <div class="sentiment-shell ${layoutClass} ${styleClass}" style="
        --campaign-title-size: ${escapeHtml(ui.titleSize || "2rem")};
        --campaign-meta-size: ${escapeHtml(ui.metaSize || "0.82rem")};
        --campaign-embed-min-height: ${escapeHtml(ui.embedMinHeight || "180px")};
        --campaign-embed-max-height: ${escapeHtml(ui.embedMaxHeight || "520px")};
        --campaign-sentiment-card-max-width: ${escapeHtml(ui.sentimentCardMaxWidth || "560px")};
        --campaign-sentiment-card-min-height: ${escapeHtml(ui.sentimentCardMinHeight || "0px")};
        --campaign-sentiment-card-max-height: ${escapeHtml(ui.sentimentCardMaxHeight || "none")};
        --campaign-sentiment-card-padding: ${escapeHtml(ui.sentimentCardPadding || "34px 40px 28px")};
        --campaign-sentiment-card-radius: ${escapeHtml(ui.sentimentCardRadius || "38px")};
        --campaign-sentiment-orb-size: ${escapeHtml(ui.sentimentOrbSize || "180px")};
        --campaign-sentiment-dual-panel-glow-size: ${escapeHtml(ui.sentimentDualPanelGlowSize || "180px")};
        --campaign-sentiment-dual-panel-section-gap: ${escapeHtml(ui.sentimentDualPanelSectionGap || "0px")};
        --campaign-sentiment-dual-panel-text-orb-gap: ${escapeHtml(ui.sentimentDualPanelTextOrbGap || "18px")};
        --campaign-sentiment-dual-panel-text-gap: ${escapeHtml(ui.sentimentDualPanelTextGap || "6px")};
        --campaign-sentiment-dual-panel-heart-size: ${escapeHtml(ui.sentimentDualPanelHeartSize || "68px")};
        --campaign-sentiment-card-title-font-size: ${escapeHtml(ui.sentimentCardTitleFontSize || "3.6rem")};
        --campaign-sentiment-label-font-size: ${escapeHtml(ui.sentimentLabelFontSize || "3rem")};
        --campaign-sentiment-score-font-size: ${escapeHtml(ui.sentimentScoreFontSize || "4rem")};
        --campaign-sentiment-insight-title-size: ${escapeHtml(ui.sentimentInsightTitleSize || "1rem")};
        --campaign-sentiment-insight-text-size: ${escapeHtml(ui.sentimentInsightTextSize || "0.98rem")};
        --campaign-sentiment-meta-font-size: ${escapeHtml(ui.sentimentMetaFontSize || "0.82rem")};
        --campaign-sentiment-dual-panel-chart-height: ${escapeHtml(ui.sentimentDualPanelChartHeight || "92px")};
        --campaign-sentiment-dual-panel-chart-top-gap: ${escapeHtml(ui.sentimentDualPanelChartTopGap || "18px")};
        --campaign-sentiment-compact-card-padding: ${escapeHtml(ui.sentimentCompactCardPadding || "16px 14px 12px")};
        --campaign-sentiment-compact-orb-size: ${escapeHtml(ui.sentimentCompactOrbSize || "126px")};
        --campaign-sentiment-compact-title-font-size: ${escapeHtml(ui.sentimentCompactTitleFontSize || "2.4rem")};
        --campaign-sentiment-compact-label-font-size: ${escapeHtml(ui.sentimentCompactLabelFontSize || "2rem")};
        --campaign-sentiment-compact-score-font-size: ${escapeHtml(ui.sentimentCompactScoreFontSize || "2.8rem")};
        --campaign-sentiment-compact-insight-title-size: ${escapeHtml(ui.sentimentCompactInsightTitleSize || "0.92rem")};
        --campaign-sentiment-compact-insight-text-size: ${escapeHtml(ui.sentimentCompactInsightTextSize || "0.88rem")};
        --campaign-sentiment-compact-meta-font-size: ${escapeHtml(ui.sentimentCompactMetaFontSize || "0.72rem")};
      ">
        <article class="sentiment-card yellow">
          <section class="sentiment-primary">
            ${ui.showTitle !== false ? `<div class="sentiment-card-title">${escapeHtml(pageTitle)}</div>` : ""}
            <div class="sentiment-orb">
              <div class="sentiment-orb-glow"></div>
              <div class="sentiment-heart" aria-hidden="true"></div>
            </div>
            <div class="sentiment-label">${translate(language, "neutral")}</div>
            <div class="sentiment-score">-0.17</div>
          </section>
          <section class="sentiment-footer">
            <div class="sentiment-insight">
              <div class="sentiment-insight-icon">
                <svg viewBox="0 0 48 48" aria-hidden="true">
                  <circle cx="24" cy="24" r="20"></circle>
                  <circle cx="18" cy="18" r="8"></circle>
                  <path d="M24 24 33 33"></path>
                </svg>
              </div>
              <div class="sentiment-insight-copy">
                <div class="sentiment-insight-title">${translate(language, "steady_tone")}</div>
                <div class="sentiment-insight-text">${translate(language, "balanced_interaction")}</div>
              </div>
            </div>
            <div class="sentiment-mini-chart">
              <svg viewBox="0 0 280 80" preserveAspectRatio="none" aria-hidden="true">
                <path class="chart-area" d="M8 24 H126 L164 54 H206 L246 24 H272 V72 H8 Z"></path>
                <path class="chart-line" d="M8 24 H126 L164 54 H206 L246 24 H272"></path>
                <path class="chart-z" d="M258 10 H278 L260 26 H280"></path>
              </svg>
            </div>
            <div class="sentiment-meta">${translate(language, "auto_refresh")}: ${escapeHtml(String(ui.refreshIntervalSeconds || 30))}s | ${translate(language, "messages")}: 18 | ${translate(language, "updated")}: 12:05:34 PM</div>
          </section>
        </article>
      </div>
    </section>`;
}

function buildSentimentChipPreview(config) {
  const language = normalizeLanguage(config.ui.shared.language);
  const ui = config.ui.sentiment;
  return `
    <section class="sentiment-chip-shell">
      <div class="sentiment-chip-board">
        <article class="sentiment-chip-card yellow" style="--sentiment-chip-basis: 250px;">
          <div class="sentiment-chip-orb yellow">
            <div class="sentiment-orb-glow"></div>
            <div class="sentiment-heart" aria-hidden="true"></div>
          </div>
          <div class="sentiment-chip-copy">
            <div class="sentiment-chip-label yellow">${translate(language, "neutral")}</div>
            <div class="sentiment-chip-score">-0.17</div>
          </div>
        </article>
      </div>
    </section>`;
}

function buildQuestionsPreview(config) {
  const language = normalizeLanguage(config.ui.shared.language);
  const ui = config.ui.questions;
  const titleText = ui.titleText || translate(language, "checklist");
  const metaText = `${config.name || "Sample campaign"} | ${config.domain || "astonvilla.thrio.io"} | ${translate(language, "workitem")}: 9775DE57-5AEE-4D46-A597-8550B993082C`;
  const items = (ui.items || []).slice(0, 5);
  const sampleStates = [true, false, true, false, true];

  return `
    ${ui.showPageHeader !== false ? `<header class="brandbar"><div class="brand" style="font-size:${escapeHtml(ui.titleSize || "2rem")}">${escapeHtml(titleText)}</div>${ui.showMeta !== false ? `<div class="campaign-badge" style="font-size:${escapeHtml(ui.metaSize || "0.82rem")}">${escapeHtml(metaText)}</div>` : ""}</header>` : ""}
    <section class="frame frame-static questions-frame">
      <div class="questions-board">
        <article class="questions-card">
          ${items.map((question, index) => `
            <div class="question-row ${sampleStates[index] ? "green" : "red"}">
              <div class="question-status"></div>
              <div class="question-copy">
                <strong>${escapeHtml(question)}</strong>
                ${ui.showEvidence !== false ? `<span>${sampleStates[index] ? translate(language, "confirmed_in_transcript") : translate(language, "not_confirmed_in_transcript")}</span>` : ""}
              </div>
            </div>
          `).join("")}
        </article>
      </div>
    </section>`;
}

function buildSmartChecklistPreview(config) {
  const language = normalizeLanguage(config.ui.shared.language);
  const ui = config.ui.questions;
  const items = (ui.items || []).slice(0, 5);
  const sampleStates = [true, true, false, false, true];
  const completed = items.filter((_, index) => sampleStates[index]).length;
  const missing = items.filter((_, index) => !sampleStates[index]);
  const required = missing[0] || "Ask for the customer's issue";
  const pendingItems = missing.slice(1);
  const completedItems = items.filter((_, index) => sampleStates[index]);

  return `
    <section class="smart-checklist-shell">
      <div class="smart-checklist-board">
        <article class="smart-checklist-card">
          <header class="smart-checklist-header">
            <div class="smart-checklist-header-copy">
              <h2>${translate(language, "smart_checklist")}</h2>
              <p>${translate(language, "checklist_progress")}: ${completed} / ${items.length || 5} ${translate(language, "completed_count")}</p>
            </div>
            <div class="smart-checklist-progress-track">
              <div class="smart-checklist-progress-bar" style="width:${Math.round((completed / Math.max(items.length, 1)) * 100)}%"></div>
            </div>
          </header>
          <section class="smart-checklist-section required expanded">
            <button class="smart-checklist-section-toggle required" type="button" aria-expanded="true">
              <span class="smart-checklist-section-label required">${buildPreviewSectionIcon("required")}<span>${translate(language, "required_now")}</span></span>
              ${buildPreviewChevronIcon()}
            </button>
            <div class="smart-checklist-section-body">
              <div class="smart-checklist-primary-row">
                <div class="smart-checklist-item-copy">${buildPreviewStatusDot("required")}<strong>${escapeHtml(required)}</strong></div>
                <button class="smart-checklist-insert-button" type="button">${buildPreviewInsertIcon()}<span>${translate(language, "insert_phrase")}</span></button>
              </div>
              <div class="smart-checklist-suggested">${buildPreviewSectionIcon("suggestion")}<p><strong>${translate(language, "suggested")}:</strong> ${escapeHtml(translate(language, "prompt_issue"))}</p></div>
            </div>
          </section>
          <section class="smart-checklist-section pending collapsed">
            <button class="smart-checklist-section-toggle pending" type="button" aria-expanded="false">
              <span class="smart-checklist-section-label pending">${buildPreviewSectionIcon("pending")}<span>${translate(language, "pending")}</span></span>
              ${buildPreviewChevronIcon()}
            </button>
            <div class="smart-checklist-section-body">
              <div class="smart-checklist-list">
                ${(pendingItems.length ? pendingItems : [translate(language, "nothing_pending")]).map((item) => `<div class="smart-checklist-row">${buildPreviewStatusDot("pending")}<span>${escapeHtml(item)}</span></div>`).join("")}
              </div>
            </div>
          </section>
          <section class="smart-checklist-section completed collapsed">
            <button class="smart-checklist-section-toggle completed" type="button" aria-expanded="false">
              <span class="smart-checklist-section-label completed">${buildPreviewSectionIcon("completed")}<span>${translate(language, "completed")}</span></span>
              ${buildPreviewChevronIcon()}
            </button>
            <div class="smart-checklist-section-body">
              <div class="smart-checklist-list">
                ${(completedItems.length ? completedItems : [translate(language, "no_completed_items")]).map((item) => `<div class="smart-checklist-row">${buildPreviewStatusDot("completed")}<span>${escapeHtml(item)}</span></div>`).join("")}
              </div>
            </div>
          </section>
          <div class="smart-checklist-meta">${translate(language, "auto_refresh")}: ${escapeHtml(String(ui.refreshIntervalSeconds || 30))}s | ${translate(language, "updated")}: 12:05:34 PM</div>
        </article>
      </div>
    </section>`;
}

function buildAgentNextStepPreview(config) {
  const language = normalizeLanguage(config.ui.shared.language);
  const ui = config.ui.nextStep || {};
  const refreshSeconds = ui.refreshIntervalSeconds || 30;
  const titleText = ui.titleText || translate(language, "nextiq_assistant");

  return `
    <section class="agent-step-shell">
      <div class="agent-step-board">
        <article class="agent-step-card">
          <header class="agent-step-header">
            <div>
              <h2>${escapeHtml(titleText)}</h2>
              <div class="agent-step-live">
                <span>${translate(language, "live_suggestions")}</span>
                <span class="agent-step-live-dot"></span>
              </div>
            </div>
            <div class="agent-step-badges">
              <span class="agent-step-badge stage">${translate(language, "stage_empathy")}</span>
              <span class="agent-step-badge urgency high">${translate(language, "urgency_high")}</span>
              <span class="agent-step-badge confidence">${translate(language, "confidence")}: 92%</span>
            </div>
          </header>
          <section class="agent-step-main">
            <div class="agent-step-primary">
              <div class="agent-step-kicker">${translate(language, "next_step")}</div>
              <h3>${escapeHtml(language === "es" ? "Reconoce la frustración" : "Acknowledge frustration")}</h3>
              <p>${escapeHtml(language === "es" ? "Valida el problema del cliente y marca con claridad que vas a revisar el fallo antes de seguir." : "Validate the customer's concern and clearly signal that you will review the failure before moving forward.")}</p>
            </div>
            <div class="agent-step-quote-card">
              <div class="agent-step-quote-label">${translate(language, "suggested_response")}</div>
              <blockquote>${escapeHtml(language === "es" ? "Entiendo lo frustrante que ha sido esto. Permítame revisar el problema para ayudarle de inmediato." : "I understand how frustrating this has been. Let me review the issue so I can help you right away.")}</blockquote>
            </div>
          </section>
          <div class="agent-step-actions">
            <button class="agent-step-button" type="button">${buildPreviewCopyIcon()}<span>${translate(language, "copy")}</span></button>
            <button class="agent-step-button" type="button">${buildPreviewRefreshIcon()}<span>${translate(language, "regenerate")}</span></button>
          </div>
          <section class="agent-step-context">
            <div class="agent-step-article">
              <div class="agent-step-context-label">${translate(language, "recommended_article")}</div>
              <a href="#" class="agent-step-article-card">
                <span class="agent-step-article-icon">${buildPreviewBookIcon()}</span>
                <span class="agent-step-article-copy">
                  <strong>${escapeHtml(language === "es" ? "Pasos para validar el método de pago" : "Steps to validate the payment method")}</strong>
                  <span>${escapeHtml(language === "es" ? "Artículo sugerido por el motor del chat para el siguiente paso." : "Article suggested by the chat engine for the next action.")}</span>
                </span>
                <span class="agent-step-article-cta">${translate(language, "open")}</span>
              </a>
            </div>
            <div class="agent-step-context-side">
              <div class="agent-step-quick-actions">
                <span class="agent-step-chip">${translate(language, "stage_empathy")}</span>
                <span class="agent-step-chip">${translate(language, "stage_clarify")}</span>
                <span class="agent-step-chip">${translate(language, "stage_troubleshoot")}</span>
              </div>
              <div class="agent-step-reason">${escapeHtml(language === "es" ? "El cliente expresa molestia explícita y todavía no hay una explicación clara del siguiente paso." : "The customer shows explicit frustration and still lacks a clear explanation of the next step.")}</div>
            </div>
          </section>
          <div class="agent-step-meta">${translate(language, "auto_refresh")}: ${escapeHtml(String(refreshSeconds))}s | ${translate(language, "messages")}: 12 | ${translate(language, "updated")}: 12:05:34 PM</div>
        </article>
      </div>
    </section>`;
}

function buildAgentQualityBoardPreview(config) {
  const language = normalizeLanguage(config.ui.shared.language);

  return `
    <section class="quality-dashboard-card">
      <section class="quality-hero">
        <div class="quality-title-block">
          <h1>${translate(language, "quality_management")}</h1>
          <p>${translate(language, "quality_management_intro")}</p>
        </div>
        <div class="quality-toolbar">
          <span class="quality-toolbar-chip">Today</span>
          <span class="quality-toolbar-chip search">Search</span>
          <span class="quality-toolbar-chip">All Teams</span>
          <span class="quality-toolbar-avatar">!</span>
        </div>
      </section>
      <section class="quality-overview-wrap">
        <section class="quality-overview">
          <article class="quality-stat-card sentiment"><div class="quality-stat-icon sentiment">♥</div><div class="quality-stat-copy"><div class="quality-stat-label">${translate(language, "average_sentiment")}</div><strong>+0.18</strong><span>${translate(language, "above_target")}</span></div></article>
          <article class="quality-stat-card compliance"><div class="quality-stat-icon compliance">✓</div><div class="quality-stat-copy"><div class="quality-stat-label">${translate(language, "compliance")}</div><strong>84%</strong><span>${translate(language, "above_target")}</span></div></article>
          <article class="quality-stat-card alerts"><div class="quality-stat-icon alerts">△</div><div class="quality-stat-copy"><div class="quality-stat-label">${translate(language, "active_alerts")}</div><strong>5</strong><span>${translate(language, "latest_alert")}</span></div></article>
          <article class="quality-stat-card risk"><div class="quality-stat-icon risk">!</div><div class="quality-stat-copy"><div class="quality-stat-label">${translate(language, "agents_at_risk")}</div><strong>2</strong><span>${translate(language, "view_metrics")}</span></div></article>
        </section>
      </section>
      <section class="quality-agent-grid">
        <details class="quality-agent-card green" open>
          <summary class="quality-agent-summary">
            <div class="quality-agent-top">
              <div class="quality-agent-head">
                <div class="quality-agent-avatar">LM</div>
                <div class="quality-agent-copy"><strong>Laura M.</strong><span>${translate(language, "call_sentiment")}</span></div>
              </div>
              <button class="quality-agent-menu" type="button" tabindex="-1" aria-hidden="true">•••</button>
            </div>
            <div class="quality-agent-trend-row">
              <div class="quality-agent-trend-copy">
                <div class="quality-agent-score">+0.45</div>
                <div class="quality-agent-benchmark">${translate(language, "above_target")}</div>
              </div>
              <div class="quality-sparkline green"><svg viewBox="0 0 180 44" preserveAspectRatio="none"><polyline points="0,30 36,24 72,28 108,20 144,24 180,16"></polyline></svg></div>
            </div>
            <div class="quality-agent-kpi-row">
              <div class="quality-agent-pill sentiment green">${translate(language, "positive")}</div>
              <div class="quality-gauge green" style="--quality-gauge:88"><div class="quality-gauge-center"><strong>88</strong><span>%</span></div></div>
            </div>
            <div class="quality-mini-panels">
              <div class="quality-mini-panel ok"><span>${translate(language, "greeting")}</span><strong>100%</strong></div>
              <div class="quality-mini-panel ok"><span>${translate(language, "empathy")}</span><strong>100%</strong></div>
            </div>
            <span class="quality-agent-toggle">${translate(language, "hide_metrics")}</span>
          </summary>
          <div class="quality-agent-body">
            <div class="quality-agent-metrics">
              <article class="quality-metric-card">
                <div class="quality-metric-title">${translate(language, "agent_metrics")}</div>
                <div class="quality-metric-row"><span>${translate(language, "messages")}</span><strong>12</strong></div>
                <div class="quality-metric-row"><span>${translate(language, "compliance")}</span><strong>100%</strong></div>
                <div class="quality-metric-row"><span>${translate(language, "latest_alert")}</span><strong>${translate(language, "above_target")}</strong></div>
              </article>
              <article class="quality-metric-card">
                <div class="quality-metric-title">${translate(language, "team_overview")}</div>
                <div class="quality-sparkline green"><svg viewBox="0 0 180 44" preserveAspectRatio="none"><polyline points="0,30 36,24 72,28 108,20 144,24 180,16"></polyline></svg></div>
              </article>
            </div>
            <div class="quality-checklist">
              <div class="quality-check-row ok"><span>${translate(language, "greeting")}</span><strong>100%</strong></div>
              <div class="quality-check-row ok"><span>${translate(language, "empathy")}</span><strong>100%</strong></div>
              <div class="quality-check-row ok"><span>${translate(language, "verification")}</span><strong>100%</strong></div>
            </div>
          </div>
        </details>
        <details class="quality-agent-card red">
          <summary class="quality-agent-summary">
            <div class="quality-agent-top">
              <div class="quality-agent-head">
                <div class="quality-agent-avatar">CR</div>
                <div class="quality-agent-copy"><strong>Carlos R.</strong><span>${translate(language, "call_sentiment")}</span></div>
              </div>
              <button class="quality-agent-menu" type="button" tabindex="-1" aria-hidden="true">•••</button>
            </div>
            <div class="quality-agent-trend-row">
              <div class="quality-agent-trend-copy">
                <div class="quality-agent-score">-0.22</div>
                <div class="quality-agent-benchmark">${translate(language, "below_target")}</div>
              </div>
              <div class="quality-sparkline red"><svg viewBox="0 0 180 44" preserveAspectRatio="none"><polyline points="0,10 36,8 72,18 108,24 144,22 180,16"></polyline></svg></div>
            </div>
            <div class="quality-agent-kpi-row">
              <div class="quality-agent-pill sentiment red">${translate(language, "negative")}</div>
              <div class="quality-gauge yellow" style="--quality-gauge:62"><div class="quality-gauge-center"><strong>62</strong><span>%</span></div></div>
            </div>
            <div class="quality-mini-panels">
              <div class="quality-mini-panel alert"><span>${translate(language, "script_alert")}</span><strong>${translate(language, "below_target")}</strong></div>
              <div class="quality-mini-panel missing"><span>${translate(language, "verification")}</span><strong>0%</strong></div>
            </div>
            <span class="quality-agent-toggle">${translate(language, "view_metrics")}</span>
          </summary>
          <div class="quality-agent-body">
            <div class="quality-agent-metrics">
              <article class="quality-metric-card">
                <div class="quality-metric-title">${translate(language, "agent_metrics")}</div>
                <div class="quality-metric-row"><span>${translate(language, "messages")}</span><strong>9</strong></div>
                <div class="quality-metric-row"><span>${translate(language, "compliance")}</span><strong>62%</strong></div>
                <div class="quality-metric-row"><span>${translate(language, "latest_alert")}</span><strong>${translate(language, "script_alert")}</strong></div>
              </article>
              <article class="quality-metric-card">
                <div class="quality-metric-title">${translate(language, "team_overview")}</div>
                <div class="quality-sparkline red"><svg viewBox="0 0 180 44" preserveAspectRatio="none"><polyline points="0,10 36,8 72,18 108,24 144,22 180,16"></polyline></svg></div>
              </article>
            </div>
            <div class="quality-checklist">
              <div class="quality-check-row ok"><span>${translate(language, "greeting")}</span><strong>100%</strong></div>
              <div class="quality-check-row missing"><span>${translate(language, "empathy")}</span><strong>0%</strong></div>
              <div class="quality-check-row missing"><span>${translate(language, "verification")}</span><strong>0%</strong></div>
            </div>
          </div>
        </details>
      </section>
      <div class="quality-meta">${translate(language, "auto_refresh")}: 30s | ${translate(language, "updated")}: 12:05:34 PM</div>
    </section>`;
}

function buildPreviewSectionIcon(type) {
  if (type === "required" || type === "pending") {
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2 18 18H2L10 2Z"></path><path d="M10 6v5"></path><circle cx="10" cy="14.5" r="1"></circle></svg>`;
  }
  if (type === "suggestion") {
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3a5 5 0 0 0-3.5 8.5l.6.6c.4.4.6.9.7 1.5h4.4c.1-.6.3-1.1.7-1.5l.6-.6A5 5 0 0 0 10 3Z"></path><path d="M8.5 15.5h3"></path></svg>`;
  }
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8"></circle><path d="m6.5 10 2.2 2.2 4.8-5"></path></svg>`;
}

function buildPreviewStatusDot(type) {
  const icon = type === "completed"
    ? `<path d="m6.5 10 2.2 2.2 4.8-5"></path>`
    : type === "pending"
      ? `<path d="M6 10h4"></path><path d="m10 7 3 3-3 3"></path>`
      : `<path d="m6.5 6.5 7 7"></path><path d="m13.5 6.5-7 7"></path>`;

  return `<span class="smart-checklist-dot ${type}"><svg viewBox="0 0 20 20" aria-hidden="true">${icon}</svg></span>`;
}

function buildPreviewInsertIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 5.5h11a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H9l-3.4 2.3v-2.3H4.5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z"></path><path d="M6.8 9.5h6.4"></path></svg>`;
}

function buildPreviewChevronIcon() {
  return `<span class="smart-checklist-chevron" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m6 8 4 4 4-4"></path></svg></span>`;
}

function buildPreviewCopyIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="5" width="9" height="11" rx="2"></rect><path d="M5 13H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1"></path></svg>`;
}

function buildPreviewRefreshIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10a6 6 0 1 1-1.5-4"></path><path d="M16 4v4h-4"></path></svg>`;
}

function buildPreviewBookIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 4.5A2.5 2.5 0 0 1 6 2h3.5v14H6a2.5 2.5 0 0 0-2.5 2V4.5Z"></path><path d="M16.5 4.5A2.5 2.5 0 0 0 14 2h-3.5v14H14a2.5 2.5 0 0 1 2.5 2V4.5Z"></path></svg>`;
}

function mapSentimentLayout(value) {
  if (value === "compact") {
    return "layout-compact";
  }
  if (value === "wide") {
    return "layout-wide";
  }
  return "layout-centered";
}

function mapSentimentStyle(value) {
  if (value === "split") {
    return "style-split";
  }
  if (value === "split-footer-top") {
    return "style-split-footer-top";
  }
  if (value === "dual-panels") {
    return "style-dual-panels";
  }
  return "style-stacked";
}

function normalizeLanguage(value) {
  return window.NextI18n?.normalizeLanguage ? window.NextI18n.normalizeLanguage(value) : "en";
}

function translate(language, key) {
  return window.NextI18n?.t ? window.NextI18n.t(language, key) : key;
}

fields.wielandNccAuthType.addEventListener("change", e => updateWielandCredentialField(e.target.value));

applyDefaultUiValues();
initSession();
