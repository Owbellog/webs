(function () {
  "use strict";

  function config() {
    return window.PULSEFORMS_CONFIG || {};
  }

  async function ensureConfig() {
    if (window.PULSEFORMS_CONFIG_READY) await window.PULSEFORMS_CONFIG_READY;
    if (window.PULSEFORMS_CONFIG_ERROR) throw window.PULSEFORMS_CONFIG_ERROR;
    return config();
  }

  async function parseResponse(res) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error_message || data.error_description || data.error || `HTTP ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      error.payload = data;
      throw error;
    }
    return data;
  }

  function campaignId() {
    const campaign = config().CAMPAIGN_ID || new URLSearchParams(window.location.search).get("campaign") || "";
    if (!campaign) throw new Error("Missing campaign in widget URL.");
    return campaign;
  }

  function apiUrl(path) {
    return new URL(path, window.location.href).toString();
  }

  async function lookupContactByPhone(phone) {
    await ensureConfig();
    const endpoint = new URL(apiUrl("../api/pulseforms/widget-contact"));
    endpoint.searchParams.set("campaign", campaignId());
    endpoint.searchParams.set("phone", phone || "");
    const response = await fetch(endpoint.toString(), { credentials: "include" });
    const payload = await parseResponse(response);
    return payload.contact || null;
  }

  async function searchAccounts(query) {
    await ensureConfig();
    const endpoint = new URL(apiUrl("../api/pulseforms/widget-accounts"));
    endpoint.searchParams.set("campaign", campaignId());
    endpoint.searchParams.set("q", query || "");
    const response = await fetch(endpoint.toString(), { credentials: "include" });
    const payload = await parseResponse(response);
    return Array.isArray(payload.accounts) ? payload.accounts : [];
  }

  async function createOpportunity(payload) {
    await ensureConfig();
    const response = await fetch(apiUrl("../api/pulseforms/widget-opportunity"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ campaign: campaignId(), payload })
    });
    const result = await parseResponse(response);
    return result;
  }

  async function createContact(payload) {
    await ensureConfig();
    const response = await fetch(apiUrl("../api/pulseforms/widget-contact"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ campaign: campaignId(), payload })
    });
    const result = await parseResponse(response);
    return result.contact || { id: result.id };
  }

  async function updateOpportunity(id, payload) {
    await ensureConfig();
    const response = await fetch(apiUrl("../api/pulseforms/widget-opportunity"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ campaign: campaignId(), id, payload })
    });
    const result = await parseResponse(response);
    return result.record || { id: result.id };
  }

  window.sugar = {
    lookupContactByPhone,
    searchAccounts,
    createContact,
    createOpportunity,
    updateOpportunity
  };
})();
