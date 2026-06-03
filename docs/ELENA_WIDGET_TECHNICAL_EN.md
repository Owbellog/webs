# Technical Documentation - Elena NCC / Sugar CRM Widget

## 1. Components

| Component | File / Route | Responsibility |
| --- | --- | --- |
| Agent-token widget | `public/widget/index-agent-token.html` | Form UI, agent validation, call flow, and submission. |
| Dynamic config | `public/widget/config.js` | Loads public campaign configuration from the backend. |
| Frontend Sugar client | `public/widget/sugar.js` | Calls widget backend endpoints. Does not expose Sugar credentials. |
| NCC adapter | `public/widget/ncc.js` | Normalizes call events from URL, `postMessage`, or `ncc:*` browser events. |
| Backend | `server.js` | Validates Thrio sessions, loads workitems, proxies Sugar, persists state/drafts. |
| Firestore staging | `staging_campaigns/elena` | Campaign configuration. |
| Widget state | `staging_widget_state` | Contact, Ticket, and Needs Assessment IDs by call. |
| Widget draft | `staging_widget_draft` | Partial form values by call. |

## 2. Integration URL

```text
https://us-central1-voicebot-451222.cloudfunctions.net/nextiq-staging/widget/index-agent-token.html?campaign=elena&callId=${workitemInformation.workitemId}&agentToken=${window.thrio.sessionService.getHndlbarToken()}
```

Supported parameters:

| Parameter | Aliases | Use |
| --- | --- | --- |
| `campaign` | - | Campaign to load. Must be `elena`. |
| `callId` | `callid`, `workitemid`, `workitemId`, `call_id` | Call/workitem ID. |
| `agentToken` | `agent_token`, `token`, `authorization` | Thrio token used to validate the agent session. |
| `ani` | `phone`, `callerId` | Customer phone if the workitem is not used. |
| `agentName` | `agent` | Agent name/user. |
| `queueName` | `queue` | Call queue. |

## 3. Current Non-Sensitive Elena Configuration

| Key | Value |
| --- | --- |
| Campaign ID | `elena` |
| Thrio domain | `astonvilla.thrio.io` |
| Workitem API | `https://mancity.thrio.io/users/api/workitems` |
| PulseForms | enabled |
| PulseForms mode | `both` |
| Sugar base URL | `https://devcrm.elliott-tool.com` |
| Sugar API version | `v11_1` |
| Sugar username | `jd1` |
| Sugar clientId | `sugar` |
| Sugar platform | `base` |
| Contact module | `Contacts` |
| Contact lookup field | `phone_work` |
| Ticket module | `tic_Tickets` |
| Needs Assessment module | `NA_NeedsAssessment` |
| Legacy submit module | `Opportunities` |
| Max fields per request | `100` |
| NCC event origin | `*` |
| Widget state read token | configured, stored encrypted |

Do not document or share in plain text:

- `token`
- `pulseformsSugarPassword`
- `pulseformsSugarClientSecret`
- `pulseformsWidgetStateReadToken`
- JWTs or API keys from other widgets

## 4. Technical Load Flow

1. The browser opens `index-agent-token.html`.
2. The initial script reads `agentToken`.
3. If the token is missing, the widget remains blocked.
4. If the token exists, the widget calls:

```http
POST /api/pulseforms/agent-session
Content-Type: application/json

{ "token": "<AGENT_TOKEN>" }
```

5. The backend validates the token against:

```http
GET https://astonvilla.thrio.io/users/api/session
Authorization: <AGENT_TOKEN>
```

6. If the session is valid, the validation screen is hidden and the form loads.
7. `config.js` calls `/api/pulseforms/widget-config?campaign=elena`.
8. The widget initializes `sugar.js` and `ncc.js`.
9. If a `callId` exists, it loads the workitem and runs contact lookup.

## 5. Endpoints Used by the Widget

### Agent Validation

```http
POST /api/pulseforms/agent-session
```

Body:

```json
{ "token": "<AGENT_TOKEN>" }
```

Successful response:

```json
{ "ok": true, "active": true, "session": {} }
```

### Public Widget Configuration

```http
GET /api/pulseforms/widget-config?campaign=elena
```

Returns only non-sensitive Sugar data: base URL, API version, modules, and allowed event origin.

### Workitem

```http
GET /api/workitem?campaign=elena&workitemid=<CALL_ID>
```

The frontend uses the response to pre-fill:

- `ncc_call_id_c`
- `ncc_agent_c`
- `contact_phone`
- `ai_transcript_c`

### Contact Lookup

```http
GET /api/pulseforms/widget-contact?campaign=elena&phone=<PHONE>
```

Searches Sugar by `phone_work` and variants:

- original value
- digits only
- `+<digits>`
- `+1<digits>` when applicable to 10 digits

### Account Search

```http
GET /api/pulseforms/widget-accounts?campaign=elena&q=<QUERY>
```

Requires at least 2 characters. Searches `Accounts` by `name` prefix and returns up to 10 records.

### Create Contact

```http
POST /api/pulseforms/widget-contact
Content-Type: application/json

{
  "campaign": "elena",
  "payload": {
    "contact_name": "Jane Doe",
    "account_id": "<ACCOUNT_ID>",
    "account_name": "Company",
    "marketing_title_c": "Operator / User",
    "lead_source": "Cold Call"
  }
}
```

### Create Sugar Workflow

```http
POST /api/pulseforms/widget-opportunity
Content-Type: application/json

{
  "campaign": "elena",
  "payload": {
    "...": "form values"
  }
}
```

Although the endpoint keeps the historical `widget-opportunity` name, for Elena it executes the current Sugar workflow:

1. Creates or reuses `Contacts`.
2. Creates or recovers `tic_Tickets` by call.
3. Creates `NA_NeedsAssessment`.
4. Attempts to relate Contact-Ticket and Ticket-Needs Assessment.
5. Stores IDs in `staging_widget_state`.

### Update Ticket When the Call Ends

```http
PATCH /api/pulseforms/widget-opportunity
Content-Type: application/json

{
  "campaign": "elena",
  "id": "<TICKET_ID>",
  "payload": {
    "ai_transcript_c": "<TRANSCRIPT>",
    "call_duration_c": "<DURATION>"
  }
}
```

The widget runs this on the `call_ended` event if a `ticketId` already exists.

## 6. State and Production Consumption

The widget stores IDs with `POST /api/widget-state`:

```http
POST /api/widget-state?campaign=elena&callId=<CALL_ID>
Content-Type: application/json

{
  "ids": {
    "contactId": "<CONTACT_ID>",
    "ticketId": "<TICKET_ID>",
    "needsAssessmentId": "<NEEDS_ASSESSMENT_ID>"
  }
}
```

The document is saved with a normalized ID:

```text
<campaign>_<callId>
```

Characters outside `[A-Za-z0-9_.-]` are replaced with `_`.

Production reads with:

```http
GET /api/widget-state?campaign=elena&callId=<CALL_ID>&consume=1
Authorization: Bearer <WIDGET_STATE_READ_TOKEN>
```

The token is also accepted in:

- `Authorization: Bearer <token>`
- `x-widget-state-token: <token>`
- `x-pulseforms-token: <token>`

If `consume=1` or `consume=true`, the backend deletes:

- Record in `staging_widget_state`.
- Associated draft in `staging_widget_draft`.

Relevant errors:

| HTTP | Cause |
| --- | --- |
| 400 | Missing `campaign`, `callId`, or invalid body. |
| 401 | Invalid read token. |
| 403 | Campaign does not have a read token configured. |
| 404 | State does not exist or was already consumed. |
| 405 | Method not allowed. |

## 7. Drafts

The widget auto-saves every form change with an 800 ms debounce:

```http
POST /api/widget-draft?campaign=elena&callId=<CALL_ID>
```

It stores:

- `values`: form values.
- `currentTab`: active tab.
- timestamps.

When the same `callId` is opened again, the widget attempts to restore the draft. On `pagehide`, it uses `navigator.sendBeacon` when available.

## 8. Supported NCC Events

The adapter accepts these `postMessage` events:

- `call_started`
- `ncc:call_started`
- `nextiva:call_started`
- `workitem:started`
- `call_ended`
- `ncc:call_ended`
- `nextiva:call_ended`
- `workitem:ended`

Normalized payload:

| Normalized Field | Aliases |
| --- | --- |
| `callId` | `callId`, `call_id`, `id`, `workitemId`, `workitem_id` |
| `agentName` | `agentName`, `agent`, `agent_name`, `userName`, `username` |
| `queueName` | `queueName`, `queue`, `queue_name` |
| `ani` | `ani`, `callerId`, `caller_id`, `from`, `phone`, `phoneNumber` |
| `workitemId` | `workitemId`, `workitem_id`, `workitemid`, `callId`, `call_id`, `id` |
| `duration` | `duration`, `callDuration`, `call_duration` |
| `transcript` | `transcript`, `aiTranscript`, `ai_transcript` |

## 9. Security

- The form is not rendered without a valid `agentToken`.
- The `agentToken` is validated server-side against Thrio.
- Sugar credentials are not exposed to the browser.
- The frontend only receives public Sugar configuration.
- Production ID reads require `pulseformsWidgetStateReadToken`.
- The read token comparison uses constant-time comparison.
- Secrets are stored encrypted in Firestore.

Remaining risk:

- `NCC_EVENT_ORIGIN` is configured as `*`. If the widget is only embedded from Thrio, set the exact allowed origin to reduce the `postMessage` attack surface.

## 10. Technical Production Handoff Checklist

- Confirm whether the final URL will keep pointing to `nextiq-staging` or move to production function/hosting.
- Configure the exact URL in Thrio with `campaign=elena`, `callId`, and `agentToken`.
- Deliver `WIDGET_STATE_READ_TOKEN` to production through a secure channel.
- Validate that the configured Sugar user has permissions to:
  - read `Contacts`
  - read `Accounts`
  - create `Contacts`
  - create/read `tic_Tickets`
  - create `NA_NeedsAssessment`
  - create relationships between modules
- Validate that `https://devcrm.elliott-tool.com/rest/v11_1/oauth2/token` responds for the configured credentials.
- Run a test call with a real `callId`.
- Confirm Ticket and Needs Assessment creation in Sugar.
- Confirm `/api/widget-state?consume=1` returns IDs and is then consumed.
- Review Cloud Functions logs for any `Push failed`, `Lookup failed`, or relationship warning.

## 11. Suggested Technical Test

1. Open the widget from Thrio with a logged-in agent.
2. Verify 200 response from `/api/pulseforms/agent-session`.
3. Verify 200 response from `/api/pulseforms/widget-config?campaign=elena`.
4. Verify 200 response from `/api/workitem?campaign=elena&workitemid=<CALL_ID>`.
5. Search Account with 2 or more characters.
6. Create or select Contact.
7. Submit the form.
8. Save the `ticketId` and `needsAssessmentId` shown by the widget.
9. Consume state:

```bash
curl -s \
  "https://us-central1-voicebot-451222.cloudfunctions.net/nextiq-staging/api/widget-state?campaign=elena&callId=<CALL_ID>&consume=1" \
  -H "Authorization: Bearer <WIDGET_STATE_READ_TOKEN>"
```

10. Repeat the same curl and confirm 404 to validate one-time consumption.
