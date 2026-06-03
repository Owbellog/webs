# NCC Agent Widget — Sugar CRM Integration

This widget is an iframe-ready NCC agent form for a Tube Tool Needs Assessment. It supports project-type conditional sections, Sugar CRM screen pop by ANI, OAuth2 authentication, opportunity creation, and transcript update on call end.

## Files

- `index.html`: main widget UI.
- `config.js`: environment configuration template.
- `sugar.js`: Sugar CRM REST client with OAuth2 token refresh and one retry on `401`.
- `ncc.js`: NCC event adapter for `call_started` and `call_ended`.

## Setup

1. Configure the campaign in the admin page under `PulseForms` > `Sugar CRM Connection`.
2. Use the generated widget URL with the campaign id.
3. Embed in NCC as an iframe:

```html
<iframe src="https://your-domain.example/widget/index.html?campaign=wieland" title="NCC Sugar CRM widget"></iframe>
```

For platforms that pass call variables through the iframe URL, include the caller number as `phone`, `ani`, or `callerId`:

```html
<iframe src="https://your-domain.example/widget/index.html?campaign=wieland&phone={{PHONE}}" title="NCC Sugar CRM widget"></iframe>
```

Optional URL parameters for call context are `callId`, `agentName`, and `queueName`.
The Sugar screen pop searches the configured lookup field first, then common Sugar contact phone fields: `phone_work`, `phone_mobile`, `phone_home`, and `phone_other`.

When a Workitem id is available, pass it as `workitemid`, `workitemId`, or `callId`. The widget will load call details through the same backend endpoint used by the Workitem widget:

```html
<iframe src="https://your-domain.example/widget/index.html?campaign=wieland&workitemid={{WORKITEM_ID}}" title="NCC Sugar CRM widget"></iframe>
```

## NCC events

The widget listens for `postMessage` payloads with these types:

- `call_started`
- `ncc:call_started`
- `nextiva:call_started`
- `workitem:started`
- `call_ended`
- `ncc:call_ended`
- `nextiva:call_ended`
- `workitem:ended`

Expected call payload fields can use common aliases:

- `callId`, `call_id`, `workitemId`
- `agentName`, `agent`, `username`
- `queueName`, `queue`
- `ani`, `callerId`, `from`, `phone`
- `duration`, `callDuration`
- `transcript`, `aiTranscript`

For local testing:

```js
window.ncc.handleCallStarted({
  callId: "CALL-001",
  agentName: "Agent Name",
  queueName: "Sales",
  ani: "+19092502944"
});
```

## Sugar Studio fields

Create the required custom fields in Sugar Studio using the `_c` names used by the form, including:

- `project_type_c`
- `buyer_type_c`
- `priority_c`
- `tube_od_c`
- `groove_type_c`
- `tube_material_c`
- `metal_finish_c`
- `ai_transcript_c`
- `ncc_call_id_c`
- `ncc_agent_c`
- `ncc_queue_c`
- `call_duration_c`
- `call_date_c`

Keep the field API names exactly aligned with the form `name` attributes.

## Security note

This implementation follows the requested browser-side `config.js` approach. For production, a backend proxy is safer because browser-served credentials can be inspected by users with access to the iframe.
