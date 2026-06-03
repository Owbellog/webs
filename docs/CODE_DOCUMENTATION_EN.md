# Technical Code Documentation

This guide documents the `nextiq-chat` repository structure, main modules, endpoints, public pages, integrations, and operational flows. It intentionally excludes secret values, tokens, and private local configuration contents.

## Overview

The project is a Node.js application without an external web framework. `server.js` implements the HTTP server, API routing, storage, authentication, upstream proxies, AI provider integrations, Firestore support, and static file serving. The `public/` directory contains HTML/CSS/JS pages that consume those APIs.

The app can run locally with `node server.js` or deploy as a Google Cloud Function through `index.js`, which exports `handleRequest` as `nextiq`.

## Root Files

| File | Purpose |
| --- | --- |
| `server.js` | Main backend. Defines routes, authentication, campaign configuration, Thrio/NCC integrations, AI providers, Firestore, and local file fallback. |
| `index.js` | Cloud Functions entry point. Exports `nextiq = handleRequest`. |
| `package.json` | Runtime and deployment scripts. Dependencies: Firestore and Functions Framework. |
| `README.md` | Quick start, admin, embed, and usage guide. |
| `DEPLOY.md` | Branch and deployment workflow. |
| `migrate-encrypt.js` | Local utility to migrate existing secrets to encrypted format. |
| `.env.example` and `env/*.yaml.example` | Configuration templates without secrets. |
| `campaigns.json`, `users.json` | Local persistence when Firestore is unavailable. These may contain sensitive data in real environments. |

## Running The App

### Local

```bash
npm install
npm start
```

By default, the server listens on `127.0.0.1:3000`. This is configurable with `HOST` and `PORT`.

### Cloud Functions

`index.js` imports `handleRequest` from `server.js` and exports it as `nextiq`.

```js
const { handleRequest } = require("./server");
exports.nextiq = handleRequest;
```

The `deploy:staging`, `deploy:production`, and `deploy:demo` scripts run `node --check server.js` before deployment.

## Configuration And Persistence

### Relevant Environment Variables

| Variable | Use |
| --- | --- |
| `PORT`, `HOST` | Local port and host. |
| `ADMIN_PASSWORD` | Session signing and encryption key derivation. |
| `ENCRYPTION_SALT` | Salt for PBKDF2 and HMAC. |
| `THRIO_API_URL`, `THRIO_AUTH_TOKEN`, `THRIO_KB_ID`, `THRIO_DOMAIN` | Default values for Thrio calls. |
| `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT` | Enable Firestore usage in GCP environments. |
| `FIRESTORE_PREFIX`, `FIRESTORE_COLLECTION`, `FIRESTORE_DATABASE_ID` | Firestore collection and database naming. |

### Storage

The backend tries to create a Firestore client with `createFirestoreClient()`. If Firestore is unavailable, it falls back to local files.

| Domain | Firestore | Local File |
| --- | --- | --- |
| Campaigns | `${FIRESTORE_PREFIX}_campaigns` or `FIRESTORE_COLLECTION` | `campaigns.json` |
| Admin users | `${FIRESTORE_PREFIX}_users` | `users.json` |
| Wieland contacts | `${FIRESTORE_PREFIX}_wieland_contacts` | `wieland-contacts.json` |
| Wieland upload logs | `${FIRESTORE_PREFIX}_wieland_upload_logs` | `wieland-upload-logs.json` |
| Widget state | `${FIRESTORE_PREFIX}_widget_state` | `widget-state.json` |
| Widget drafts | `${FIRESTORE_PREFIX}_widget_draft` | `widget-draft.json` |
| NCC Builder admin accounts | `${FIRESTORE_PREFIX}_ncc_builder_admin_accounts` | Firestore required |
| NCC Builder AI config | `${FIRESTORE_PREFIX}_ncc_builder_ai_config` | Firestore required |

## Security

### Secret Encryption

`server.js` encrypts sensitive fields with AES-256-GCM. The key is derived from `ADMIN_PASSWORD + ENCRYPTION_SALT` using PBKDF2. Encrypted values use this prefix:

```text
enc:v1:<iv>:<authTag>:<ciphertext>
```

Encrypted fields:

- `token`
- `cookie`
- `geminiApiKey`
- `questionsGeminiApiKey`
- `wielandNccCredential`
- `summaryagenticAiApiKey`
- `summaryagenticHubspotToken`
- `pulseformsAiApiKey`
- `pulseformsSugarPassword`
- `pulseformsSugarClientSecret`
- `pulseformsWidgetStateReadToken`

Main functions:

- `encryptSecret()`
- `decryptSecret()`
- `encryptCampaignSecrets()`
- `decryptCampaignSecrets()`

### Admin Sessions

Admin sessions use the `niq_sess` cookie, signed with HMAC-SHA256. A session includes user id, username, role, permissions, and expiration. Login has an in-memory per-IP rate limit: 5 attempts, then a 15-minute block.

Related functions:

- `createSessionToken()`
- `verifySessionToken()`
- `handleAdminLogin()`
- `handleAdminLogout()`
- `handleAdminMe()`
- `handleAdminSetup()`

### Wieland Sessions

Wieland uses a separate `niq_w_sess` cookie with a 4-hour expiration, NCC JWT validation, and support for admin/service-token behavior depending on campaign configuration.

## Backend: `server.js`

### Request Flow

`handleRequest(req, res)` is the main router:

1. Normalizes Cloud Functions URLs that may include the `/nextiq` prefix.
2. Handles `/api/health`.
3. Validates widget API tokens where required.
4. Dispatches API endpoints by route and method.
5. Handles admin, Wieland, Thrio Data, NCC Builder, and widget routes.
6. Serves static files from `public/`.

### HTTP Helpers

| Function | Use |
| --- | --- |
| `sendJson(res, status, data)` | Standard JSON response. |
| `readJson(req)` | Reads and parses JSON request bodies. |
| `serveStatic(requestPath, isHeadRequest, res)` | Serves HTML, JS, CSS, and image files from `public/`. |
| `loadEnv(filePath)` | Loads `.env` without an external dependency. |
| `getHealthStatus()` | Basic runtime, Firestore, and configuration health. |

### Campaign Configuration

Campaigns are the central configuration object for most pages and endpoints. They can be resolved by `campaign`, `domain`, or related URL parameters.

Main functions:

- `readCampaigns()`
- `writeCampaigns()`
- `normalizeCampaign()`
- `resolveCampaignSelectionAsync()`
- `resolveCampaignConfigAsync()`
- `handleConfig()`
- `handleAdmin()`

A campaign may contain UI, Thrio, Gemini, questions, Summary Agentic, PulseForms, Wieland, history, and NCC settings.

## Main Endpoints

### Health And Configuration

| Method | Route | Handler | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | `getHealthStatus()` | Backend health status. |
| `GET` | `/api/config` | `handleConfig()` | Public campaign configuration. |

### Chat, Prediction, And Workitems

| Method | Route | Handler | Description |
| --- | --- | --- | --- |
| `POST` | `/api/prediction` | `handlePrediction()` | Proxy to the configured Thrio/NextIQ prediction endpoint. |
| `GET` | `/api/workitem` | `handleWorkitem()` | Loads a workitem and messages, including computed sentiment. |
| `GET` | `/api/workitem-history` | `handleWorkitemHistory()` | Workitem history. |
| `GET` | `/api/workitem-history/*` | `handleWorkitemHistory()` | Subroute-specific history detail. |
| `GET` | `/api/workitem-dispositions` | `handleWorkitemDispositions()` | Workitem dispositions. |
| `POST` | `/api/ticket` | `handleSaveTicket()` | Saves a ticket associated with a workitem. |
| `GET` | `/api/ticket` | `handleGetTicket()` | Reads an associated ticket. |

### Questions, Checklist, And Agent Assistance

| Method | Route | Handler | Description |
| --- | --- | --- | --- |
| `GET` | `/api/questions-check` | `handleQuestionsCheck()` | Validates checklist questions against the transcript. |
| `GET` | `/api/client-questions` | `handleClientQuestions()` | Extracts customer questions. |
| `GET` | `/api/agent-next-step` | `handleAgentNextStep()` | Suggests the agent's next best action. |
| `POST` | `/api/tts` | `handleTts()` | Text-to-speech proxy to the configured upstream. |
| `GET` | `/api/agent-quality-board` | `handleAgentQualityBoard()` | Agent quality dashboard with sentiment, compliance, and alerts. |

### Agent Chat

| Method | Route | Handler | Description |
| --- | --- | --- | --- |
| `GET` | `/api/agent-chat/workitems` | `handleAgentChatWorkitems()` | Lists workitems for the agent workspace. |
| `GET` | `/api/agent-chat/workitem` | `handleAgentChatWorkitem()` | Workitem conversation detail. |
| `POST` | `/api/agent-chat/auth/login` | `handleAgentChatLogin()` | Agent login against campaign configuration. |
| `POST` | `/api/agent-chat/auth/logout` | `handleAgentChatLogout()` | Agent logout. |
| `POST` | `/api/agent-chat/messages` | `handleAgentChatMessage()` | Sends an agent message. |
| `POST` | `/api/agent-chat/acd-status` | `handleAgentChatAcdStatus()` | Updates ACD status. |

### Summary Agentic

| Method | Route | Handler | Description |
| --- | --- | --- | --- |
| `GET` | `/api/summaryagentic/summary` | `handleSummaryAgenticSummary()` | Generates or reads a customer summary. |
| `POST` | `/api/summaryagentic/warm` | `handleSummaryAgenticWarm()` | Warms the summary cache. |
| `POST` | `/api/summaryagentic/test-source` | `handleSummaryAgenticTestSource()` | Tests a configured data source. |
| `POST` | `/api/summaryagentic/analyze-url` | `handleSummaryAgenticAnalyzeUrl()` | Analyzes a URL and proposes configuration. |
| `POST` | `/api/summaryagentic/suggest-fields` | `handleSummaryAgenticSuggestFields()` | Suggests fields with AI. |
| `POST` | `/api/summaryagentic/widget-from-template` | `handleSummaryAgenticWidgetFromTemplate()` | Generates a widget from a template. |
| `POST` | `/api/summaryagentic/widget-from-chat` | `handleSummaryAgenticWidgetFromChat()` | Generates a widget from a free-form instruction. |
| `POST` | `/api/summaryagentic/save-widget` | `handleSummaryAgenticSaveWidget()` | Saves a widget to the campaign library. |
| `DELETE` | `/api/summaryagentic/save-widget` | `handleSummaryAgenticDeleteWidget()` | Deletes a widget from the library. |
| `POST` | `/api/summaryagentic/hubspot-test` | `handleSummaryAgenticHubspotTest()` | Validates a HubSpot token. |
| `POST` | `/api/summaryagentic/generate-layouts` | `handleSummaryAgenticGenerateLayouts()` | Generates layouts with AI. |

### PulseForms

| Method | Route | Handler | Description |
| --- | --- | --- | --- |
| `POST` | `/api/pulseforms/analyze-url` | `handlePulseFormsAnalyzeUrl()` | Analyzes a URL to generate form structure. |
| `POST` | `/api/pulseforms/analyze-fields` | `handlePulseFormsAnalyzeFields()` | Discovers fields from uploaded files. |
| `POST` | `/api/pulseforms/generate-layouts` | `handlePulseFormsGenerateLayouts()` | Generates form layouts. |
| `POST` | `/api/pulseforms/agent-session` | `handlePulseFormsAgentSession()` | Creates an agent/widget session. |
| `GET` | `/api/pulseforms/config` | `handlePulseFormsConfig()` | Public form configuration. |
| `GET` | `/api/pulseforms/widget-config` | `handlePulseFormsWidgetConfig()` | Embedded widget configuration. |
| `GET` | `/api/pulseforms/widget-contact` | `handlePulseFormsWidgetContact()` | Looks up a CRM/Sugar contact. |
| `GET` | `/api/pulseforms/widget-accounts` | `handlePulseFormsWidgetAccounts()` | Looks up CRM accounts. |
| `POST` | `/api/pulseforms/widget-contact` | `handlePulseFormsWidgetContactCreate()` | Creates a contact. |
| `POST` | `/api/pulseforms/widget-opportunity` | `handlePulseFormsWidgetOpportunity()` | Creates an opportunity. |
| `PATCH` | `/api/pulseforms/widget-opportunity` | `handlePulseFormsWidgetOpportunityPatch()` | Updates an opportunity. |
| `GET` | `/api/pulseforms/query` | `handlePulseFormsQuery()` | Generic query for configured data. |
| `POST` | `/api/pulseforms/submit` | `handlePulseFormsSubmit()` | Submits the form. |
| Multiple | `/api/pulseforms/widget-state` | `handleWidgetState()` | Widget state persistence. |
| Multiple | `/api/pulseforms/widget-draft` | `handleWidgetDraft()` | Widget draft persistence. |

### Admin

| Method | Route | Handler | Description |
| --- | --- | --- | --- |
| `POST` | `/api/admin/login` | `handleAdminLogin()` | Admin login. |
| `POST` | `/api/admin/logout` | `handleAdminLogout()` | Admin logout. |
| `GET` | `/api/admin/me` | `handleAdminMe()` | Current admin user. |
| `GET` | `/api/admin/setup-status` | `handleAdminSetupStatus()` | Whether first-user setup is still required. |
| `POST` | `/api/admin/setup` | `handleAdminSetup()` | Creates the first admin user. |
| Multiple | `/api/admin/*` | `handleAdmin()` | Campaign, user, and configuration CRUD. |

### Wieland

| Method | Route | Handler | Description |
| --- | --- | --- | --- |
| `POST` | `/api/wieland/auth` | `handleWielandAuth()` | Login with an NCC token. |
| `GET` | `/api/wieland/me` | `handleWielandMe()` | Current Wieland user/session. |
| `POST` | `/api/wieland/logout` | inline | Clears the Wieland cookie. |
| Multiple | `/api/wieland/*` | `handleWieland()` | Contacts, lists, leads, SMS templates, and field mappings. |

### Thrio Data

| Method | Route | Handler | Description |
| --- | --- | --- | --- |
| `GET` | `/api/thrio-data/campaigns` | `handleThrioData()` | Lists Thrio campaigns. |
| `POST` | `/api/thrio-data/campaigns` | `handleThrioData()` | Creates a Thrio campaign. |
| `DELETE` | `/api/thrio-data/campaigns/:id` | `handleThrioData()` | Deletes a Thrio campaign. |
| `GET` | `/api/thrio-data/pstnnumbers` | `handleThrioData()` | Lists PSTN numbers. |
| `POST` | `/api/thrio-data/pstnnumbers` | `handleThrioData()` | Creates a PSTN number. |
| `GET` | `/api/thrio-data/workflows` | `handleThrioData()` | Lists workflows. |

### NCC Campaign Builder

`handleNccCampaignBuilder()` groups endpoints for creating NCC campaigns, handling login, loading services, managing surveys, running reports, and storing admin accounts.

Main routes:

- `/api/ncc-builder/login`
- `/api/ncc-builder/session`
- `/api/ncc-builder/pstn-unused`
- `/api/ncc-builder/supervisors`
- `/api/ncc-builder/admin-accounts`
- `/api/ncc-builder/admin-accounts/:id/test`
- `/api/ncc-builder/admin-accounts/:id/user-report`
- `/api/ncc-builder/user-reports/run`
- `/api/ncc-builder/surveys`
- `/api/ncc-builder/survey-designer/ai`
- `/api/ncc-builder/survey-designer/create`
- `/api/ncc-builder/transcription-services`
- `/api/ncc-builder/generative-ai-services`
- `/api/ncc-builder/realtime-analysis-services`
- `/api/ncc-builder/knowledge-base-services`
- `/api/ncc-builder/campaigns`
- `/api/ncc-builder/campaign-surveys`
- `/api/ncc-builder/create`

## AI Integrations

The backend supports Gemini, OpenAI, and Claude in specific flows.

### Gemini

Direct functions:

- `detectClientQuestionsWithGemini()`: extracts customer questions.
- `callGeminiForSummary()`: generates JSON summaries.
- `callGeminiForPulseFormsFields()`: detects form fields, including uploaded file support.
- `analyzeMessagesWithGemini()`: classifies sentiment.
- `analyzeChecklistWithGemini()`: validates checklist questions.
- `buildAgentNextStep()`: uses Gemini for next-action guidance when `ui.nextStep.useGemini` is not `false`.
- `buildGeminiEndpoint()`: builds `/v1beta/models/{model}:generateContent`.

Wrappers that may call Gemini:

- `callAiForSummary()`: uses Gemini when provider is neither `claude` nor `openai`.
- `callAiForPulseFormsFieldDiscovery()`: uses Gemini when provider is neither `claude` nor `openai`.

### OpenAI

Used by Summary Agentic and PulseForms when provider is `openai`. The implementation builds payloads for `https://api.openai.com/v1/chat/completions`.

### Claude

Used by Summary Agentic and PulseForms when provider is `claude`. The implementation calls `https://api.anthropic.com/v1/messages`.

## Sentiment, Checklist, And Next-Step Logic

### Sentiment

`extractClientMessages()` extracts `CLIENT` messages. If `config.sentimentProvider === "gemini"` and `ui.sentiment.useGemini !== false`, it delegates to `analyzeMessagesWithGemini()`. Otherwise, it uses `scoreSentiment()`, a keyword-based local heuristic.

### Checklist

`handleQuestionsCheck()` gets client and agent messages through `extractChecklistMessages()`. If Gemini is enabled for questions, it uses `analyzeChecklistWithGemini()`. Otherwise, it uses `analyzeChecklistHeuristically()`.

### Customer Questions

`handleClientQuestions()` extracts doubts or questions expressed by the customer. It can use either `detectClientQuestionsWithGemini()` or `detectClientQuestionsHeuristically()`.

### Next Best Action

`handleAgentNextStep()` calls `buildAgentNextStep()`. If no transcript exists, it returns a base action. If `ui.nextStep.useGemini === false`, it uses `buildHeuristicAgentNextStep()`.

## Frontend: Public Pages

| File | Purpose | APIs Used |
| --- | --- | --- |
| `public/index.html`, `public/app.js` | Main prediction chat. | `/api/config`, `/api/prediction` |
| `public/admin.html`, `public/admin.js` | Admin panel for campaigns, users, UI, AI, PulseForms, Summary Agentic, Wieland, and NCC Builder AI. | `/api/admin/*`, `/api/config`, auxiliary AI endpoints |
| `public/workitem.html`, `public/workitem.js` | Workitem and transcript view. | `/api/config`, `/api/workitem` |
| `public/sentiment.html`, `public/sentiment.js` | Visual sentiment monitor. | `/api/config`, `/api/workitem` |
| `public/sentiment-bar.html`, `public/sentiment-bar.js` | Sentiment bar/widget with trend and suggested action. | `/api/config`, `/api/workitem` |
| `public/sentiment-chip.html`, `public/sentiment-chip.js` | Compact sentiment chip. | `/api/config`, `/api/workitem` |
| `public/questions.html`, `public/questions.js` | Questions checklist. | `/api/config`, `/api/questions-check` |
| `public/smart-checklist.html`, `public/smart-checklist.js` | Visual checklist with suggested prompts. | `/api/config`, `/api/questions-check` |
| `public/agent-next-step.html`, `public/agent-next-step.js` | Next-action widget. | `/api/config`, `/api/agent-next-step` |
| `public/agent-quality-board.html`, `public/agent-quality-board.js` | Agent quality dashboard. | `/api/config`, `/api/agent-quality-board` |
| `public/agent-chat.html`, `public/agent-chat.js` | Agent workspace with login, workitems, messages, and ACD status. | `/api/agent-chat/*` |
| `public/agent-copilot.html`, `public/agent-copilot.js` | Agent copilot based on guidance/next step. | `/api/config`, `/api/agent-next-step` |
| `public/history-widget.html`, `public/history-widget.js` | Workitem history. | `/api/workitem-history` |
| `public/summaryagentic.html`, `public/summaryagentic.js` | Agentic summary widget. | `/api/summaryagentic/summary` |
| `public/pulseforms.html`, `public/pulseforms.js` | Embeddable PulseForms form. | `/api/pulseforms/*` |
| `public/pulseformv2.html`, `public/pulseformv2.js` | PulseForms V2 variant. | `/api/pulseforms/*` |
| `public/wieland.html`, `public/wieland.js` | Wieland contact/list/lead management. | `/api/wieland/*` |
| `public/thrio-campaigns.html`, `public/thrio-campaigns.js` | Thrio campaigns and numbers tool. | `/api/thrio-data/*` |
| `public/ncc-campaign-builder.html`, `public/ncc-campaign-builder.js` | Wizard to create NCC campaigns and surveys. | `/api/ncc-builder/*` |
| `public/login.html` | Login/entry page. | Depends on selected flow |
| `public/nextiva-sdk.html` | Local Nextiva SDK documentation. | Static |
| `public/i18n.js` | Shared localized text. | Static |
| `public/styles.css` | Global styles. | Static |

## Sugar/NCC Widget

Directory: `public/widget/`.

| File | Purpose |
| --- | --- |
| `index.html` | Main embedded widget UI. |
| `index-agent-token.html` | Agent-token oriented variant. |
| `config.js` | Widget configuration template. |
| `sugar.js` | Sugar CRM client with OAuth2, token refresh, and one retry on `401`. |
| `ncc.js` | NCC event adapter via `postMessage`. |
| `README.md` | Widget-specific guide. |

The widget listens for events such as `call_started`, `ncc:call_started`, `workitem:started`, `call_ended`, `ncc:call_ended`, and aliases. It can receive `phone`, `ani`, `callerId`, `workitemid`, `callId`, `agentName`, and `queueName` through URL parameters or events.

## Main Flows

### Prediction Chat

1. `public/app.js` reads URL parameters.
2. It calls `/api/config` to resolve campaign and UI configuration.
3. It sends messages to `/api/prediction`.
4. `handlePrediction()` resolves token, cookie, and API URL from the campaign.
5. `fetchPredictionUpstream()` calls the configured upstream.
6. The frontend renders the response as a rich chat message.

### Workitem And Sentiment

1. The page receives `campaign` and `workitemid`.
2. The frontend calls `/api/workitem`.
3. `handleWorkitem()` resolves configuration and loads the upstream workitem.
4. `extractClientMessages()` filters `CLIENT` messages.
5. Sentiment is computed by local heuristic or Gemini.
6. The frontend renders transcript, cards, chip, bar, or board depending on the page.

### Summary Agentic

1. The widget calls `/api/summaryagentic/summary`.
2. The backend resolves campaign, data sources, cache, and AI provider.
3. External data sources are loaded, including HubSpot when configured.
4. `callAiForSummary()` calls Claude, OpenAI, or Gemini.
5. The JSON response is normalized and cached.
6. `summaryagentic.js` renders summary sections.

### PulseForms

1. Admin configures fields, data sources, Sugar CRM, and layout.
2. `pulseforms.js` or `pulseformv2.js` loads `/api/pulseforms/config`.
3. If call context exists, the widget queries contact/account APIs.
4. The agent completes or confirms fields.
5. `/api/pulseforms/submit` sends data to the configured destination.
6. Sugar-specific endpoints support contact and opportunity operations.

### Wieland

1. The user signs in with an NCC token through `/api/wieland/auth`.
2. The backend validates the JWT and stores a session cookie.
3. `wieland.js` consumes `/api/wieland/*`.
4. The backend manages local/Firestore contacts and NCC lists/leads.
5. Users can refresh priorities, assign contacts, and configure SMS templates.

### NCC Campaign Builder

1. `ncc-campaign-builder.js` signs in with NCC credentials.
2. It loads available PSTN, supervisor, AI, realtime, KB, and survey services.
3. The wizard builds campaign, workflow, queue, disposition, and business-hour payloads.
4. `/api/ncc-builder/create` executes the creation sequence and returns `steps`.
5. The survey designer can generate JSON through local heuristics or AI.

## UI And Embed Conventions

Many pages accept:

- `campaign`
- `domain`
- `workitemid` or `workitemId`
- `embed=1`
- visual overrides through query string

When embedded, several pages notify the parent frame height with:

```js
window.parent.postMessage({ type: "nextiq:resize", height }, "*");
```

## Error Handling

Common patterns:

- Input validation returns `400`.
- Missing authentication returns `401`.
- Missing campaign or resource returns `404`.
- Configuration problems use `throwConfig()` and usually return `400`.
- Upstream failures usually return `502`.
- Internal failures return `500`.

Handlers often include `details` when doing so does not expose secrets.

## Testing And Verification

There is no automated test suite declared in `package.json`. Available checks:

```bash
node --check server.js
npm start
```

Deployment scripts already run `node --check server.js`.

Manual validation targets:

- `/api/health`
- `/admin.html`
- `/index.html?campaign=<id>`
- `/workitem.html?campaign=<id>&workitemid=<id>`
- Specific widgets depending on the configured campaign

## Maintenance Recommendations

- Do not commit `.env`, `env/staging.yaml`, `env/production.yaml`, or local files containing secrets.
- Keep `server.js` handlers small where possible; the file currently owns many responsibilities.
- When adding endpoints, update this documentation and the route map.
- When adding sensitive campaign fields, include them in `SECRET_FIELDS`.
- When changing the campaign schema, update `normalizeCampaign()`, the admin UI, and pages that consume `/api/config`.
- For new AI flows, reuse `callAiForSummary()` or create an equivalent wrapper that supports `claude`, `openai`, and `gemini`.
- For new embedded widgets, implement `notifyParentHeight()` and support `embed=1`.

