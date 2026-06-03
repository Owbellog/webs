(function () {
  "use strict";

  const defaults = {
    SUGAR_API_VERSION: "v11_1",
    CAMPAIGN_ID: "",
    CONTACT_LOOKUP_MODULE: "Contacts",
    CONTACT_LOOKUP_FIELD: "phone_work",
    OPPORTUNITY_MODULE: "Opportunities",
    MAX_FIELDS_PER_REQUEST: 100,
    NCC_EVENT_ORIGIN: "*"
  };

  window.PULSEFORMS_CONFIG = { ...defaults, ...(window.PULSEFORMS_CONFIG || {}) };

  async function loadPulseFormsWidgetConfig() {
    const params = new URLSearchParams(window.location.search);
    const campaign = params.get("campaign");
    if (!campaign) return window.PULSEFORMS_CONFIG;
    window.PULSEFORMS_CONFIG.CAMPAIGN_ID = campaign;

    const endpoint = new URL("../api/pulseforms/widget-config", window.location.href);
    endpoint.searchParams.set("campaign", campaign);
    const response = await fetch(endpoint.toString(), { credentials: "include" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Unable to load widget config (${response.status})`);
    }
    window.PULSEFORMS_CONFIG = { ...window.PULSEFORMS_CONFIG, ...(payload.config || {}), CAMPAIGN_ID: campaign };
    return window.PULSEFORMS_CONFIG;
  }

  window.loadPulseFormsWidgetConfig = loadPulseFormsWidgetConfig;
  window.PULSEFORMS_CONFIG_READY = loadPulseFormsWidgetConfig().catch((error) => {
    window.PULSEFORMS_CONFIG_ERROR = error;
    return window.PULSEFORMS_CONFIG;
  });
})();
