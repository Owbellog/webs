(function () {
  "use strict";

  const listeners = new Map();
  const ncc = {
    currentCallId: "",
    currentAgent: "",
    currentQueue: "",
    callDuration: "",
    currentAni: "",
    currentWorkitemId: "",
    on(eventName, handler) {
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(handler);
      return () => listeners.get(eventName)?.delete(handler);
    },
    emit(eventName, payload) {
      listeners.get(eventName)?.forEach((handler) => handler(payload || {}));
    },
    handleCallStarted(payload) {
      const data = normalizeCallData(payload);
      ncc.currentCallId = data.callId;
      ncc.currentAgent = data.agentName;
      ncc.currentQueue = data.queueName;
      ncc.currentAni = data.ani;
      ncc.currentWorkitemId = data.workitemId;
      ncc.callDuration = "";
      ncc.emit("call_started", data);
    },
    handleCallEnded(payload) {
      const data = normalizeCallData(payload);
      ncc.callDuration = data.duration || ncc.callDuration;
      ncc.emit("call_ended", data);
    }
  };

  function firstValue(source, keys) {
    for (const key of keys) {
      if (source && source[key] !== undefined && source[key] !== null && String(source[key]).trim() !== "") {
        return String(source[key]);
      }
    }
    return "";
  }

  function normalizeCallData(raw = {}) {
    const data = raw.data && typeof raw.data === "object" ? raw.data : raw;
    return {
      callId: firstValue(data, ["callId", "call_id", "id", "workitemId", "workitem_id"]),
      agentName: firstValue(data, ["agentName", "agent", "agent_name", "userName", "username"]),
      queueName: firstValue(data, ["queueName", "queue", "queue_name"]),
      ani: firstValue(data, ["ani", "callerId", "caller_id", "from", "phone", "phoneNumber"]),
      workitemId: firstValue(data, ["workitemId", "workitem_id", "workitemid", "callId", "call_id", "id"]),
      duration: firstValue(data, ["duration", "callDuration", "call_duration"]),
      transcript: firstValue(data, ["transcript", "aiTranscript", "ai_transcript"])
    };
  }

  function isCallStartedType(type) {
    return ["call_started", "ncc:call_started", "nextiva:call_started", "workitem:started"].includes(type);
  }

  function isCallEndedType(type) {
    return ["call_ended", "ncc:call_ended", "nextiva:call_ended", "workitem:ended"].includes(type);
  }

  window.addEventListener("message", (event) => {
    const allowedOrigin = window.PULSEFORMS_CONFIG?.NCC_EVENT_ORIGIN || "";
    if (!allowedOrigin || event.origin !== allowedOrigin) return;
    const message = event.data || {};
    const type = message.type || message.event || message.name;
    if (isCallStartedType(type)) ncc.handleCallStarted(message.payload || message.data || message);
    if (isCallEndedType(type)) ncc.handleCallEnded(message.payload || message.data || message);
  });

  window.addEventListener("ncc:call_started", (event) => ncc.handleCallStarted(event.detail || {}));
  window.addEventListener("ncc:call_ended", (event) => ncc.handleCallEnded(event.detail || {}));

  window.ncc = ncc;
})();
