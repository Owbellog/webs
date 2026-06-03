# Documentacion Tecnica del Codigo

Esta guia documenta la estructura del repositorio `nextiq-chat`, los modulos principales, los endpoints, las paginas publicas y los flujos de integracion. No incluye valores de secretos, tokens ni contenido privado de archivos locales.

## Resumen

El proyecto es una aplicacion Node.js sin framework web externo. `server.js` implementa el servidor HTTP, los handlers de API, el almacenamiento, la autenticacion, los proxies a servicios externos y la publicacion de archivos estaticos. `public/` contiene las paginas HTML/CSS/JS que consumen esas APIs.

La aplicacion puede ejecutarse localmente con `node server.js` o desplegarse como Google Cloud Function mediante `index.js`, que exporta `handleRequest` como `nextiq`.

## Archivos Raiz

| Archivo | Proposito |
| --- | --- |
| `server.js` | Backend principal. Define rutas, autenticacion, configuracion de campanas, integraciones con Thrio/NCC, AI providers, Firestore y archivos locales. |
| `index.js` | Entry point para Cloud Functions. Exporta `nextiq = handleRequest`. |
| `package.json` | Scripts de ejecucion y despliegue. Dependencias: Firestore y Functions Framework. |
| `README.md` | Guia rapida de ejecucion, administracion, embeds y uso general. |
| `DEPLOY.md` | Flujo de ramas y despliegue a staging/produccion. |
| `migrate-encrypt.js` | Utilidad local para migrar secretos existentes a formato cifrado. |
| `.env.example` y `env/*.yaml.example` | Plantillas de configuracion sin secretos. |
| `campaigns.json`, `users.json` | Persistencia local cuando Firestore no esta disponible. Contienen datos sensibles en entornos reales. |

## Ejecucion

### Local

```bash
npm install
npm start
```

Por defecto escucha en `127.0.0.1:3000`, configurable con `HOST` y `PORT`.

### Cloud Functions

`index.js` importa `handleRequest` desde `server.js` y lo exporta como `nextiq`.

```js
const { handleRequest } = require("./server");
exports.nextiq = handleRequest;
```

Los scripts `deploy:staging`, `deploy:production` y `deploy:demo` ejecutan `node --check server.js` antes de desplegar.

## Configuracion y Persistencia

### Variables relevantes

| Variable | Uso |
| --- | --- |
| `PORT`, `HOST` | Puerto y host local. |
| `ADMIN_PASSWORD` | Firma de sesiones y derivacion de clave para cifrado de secretos. |
| `ENCRYPTION_SALT` | Sal para PBKDF2 y HMAC. |
| `THRIO_API_URL`, `THRIO_AUTH_TOKEN`, `THRIO_KB_ID`, `THRIO_DOMAIN` | Valores por defecto para llamadas a Thrio. |
| `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT` | Activan uso de Firestore en despliegues GCP. |
| `FIRESTORE_PREFIX`, `FIRESTORE_COLLECTION`, `FIRESTORE_DATABASE_ID` | Nombres de colecciones y base de Firestore. |

### Almacenamiento

El backend intenta crear cliente Firestore con `createFirestoreClient()`. Si Firestore no esta disponible, usa archivos locales.

| Dominio | Firestore | Archivo local |
| --- | --- | --- |
| Campanas | `${FIRESTORE_PREFIX}_campaigns` o `FIRESTORE_COLLECTION` | `campaigns.json` |
| Usuarios admin | `${FIRESTORE_PREFIX}_users` | `users.json` |
| Contactos Wieland | `${FIRESTORE_PREFIX}_wieland_contacts` | `wieland-contacts.json` |
| Logs de carga Wieland | `${FIRESTORE_PREFIX}_wieland_upload_logs` | `wieland-upload-logs.json` |
| Estado de widget | `${FIRESTORE_PREFIX}_widget_state` | `widget-state.json` |
| Draft de widget | `${FIRESTORE_PREFIX}_widget_draft` | `widget-draft.json` |
| Cuentas admin NCC Builder | `${FIRESTORE_PREFIX}_ncc_builder_admin_accounts` | Firestore requerido |
| Configuracion AI NCC Builder | `${FIRESTORE_PREFIX}_ncc_builder_ai_config` | Firestore requerido |

## Seguridad

### Cifrado de secretos

`server.js` cifra campos sensibles con AES-256-GCM. La clave se deriva de `ADMIN_PASSWORD + ENCRYPTION_SALT` mediante PBKDF2. Los valores cifrados usan el prefijo:

```text
enc:v1:<iv>:<authTag>:<ciphertext>
```

Campos cifrados:

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

Funciones principales:

- `encryptSecret()`
- `decryptSecret()`
- `encryptCampaignSecrets()`
- `decryptCampaignSecrets()`

### Sesiones admin

El admin usa cookie `niq_sess`, firmada con HMAC-SHA256. La sesion incluye usuario, rol, permisos y expiracion. Hay rate limit en memoria para login admin: 5 intentos y bloqueo de 15 minutos por IP.

Funciones relacionadas:

- `createSessionToken()`
- `verifySessionToken()`
- `handleAdminLogin()`
- `handleAdminLogout()`
- `handleAdminMe()`
- `handleAdminSetup()`

### Sesiones Wieland

Wieland usa cookie separada `niq_w_sess`, con expiracion de 4 horas, validacion de JWT NCC y soporte de modo admin/service-token segun configuracion.

## Backend: `server.js`

### Flujo general de request

`handleRequest(req, res)` es el router principal:

1. Normaliza URLs de Cloud Functions que pueden llegar con prefijo `/nextiq`.
2. Atiende `/api/health`.
3. Valida token de widget cuando aplica.
4. Despacha endpoints API por ruta y metodo.
5. Atiende rutas publicas admin, Wieland, Thrio Data, NCC Builder y widgets.
6. Sirve archivos estaticos desde `public/`.

### Helpers HTTP

| Funcion | Uso |
| --- | --- |
| `sendJson(res, status, data)` | Respuesta JSON estandar. |
| `readJson(req)` | Lectura y parseo del body JSON. |
| `serveStatic(requestPath, isHeadRequest, res)` | Sirve HTML, JS, CSS e imagenes desde `public/`. |
| `loadEnv(filePath)` | Carga `.env` sin dependencia externa. |
| `getHealthStatus()` | Estado basico de runtime, Firestore y configuracion. |

### Configuracion de campanas

Las campanas son el centro de configuracion de casi todas las paginas y endpoints. Se resuelven por `campaign`, `domain` o parametros relacionados.

Funciones principales:

- `readCampaigns()`
- `writeCampaigns()`
- `normalizeCampaign()`
- `resolveCampaignSelectionAsync()`
- `resolveCampaignConfigAsync()`
- `handleConfig()`
- `handleAdmin()`

Una campana puede contener configuracion de UI, Thrio, Gemini, preguntas, Summary Agentic, PulseForms, Wieland, historial y NCC.

## Endpoints Principales

### Salud y configuracion

| Metodo | Ruta | Handler | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/api/health` | `getHealthStatus()` | Estado del backend. |
| `GET` | `/api/config` | `handleConfig()` | Devuelve configuracion publica de campana. |

### Chat, prediccion y workitems

| Metodo | Ruta | Handler | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/api/prediction` | `handlePrediction()` | Proxy a endpoint de prediccion Thrio/NextIQ. |
| `GET` | `/api/workitem` | `handleWorkitem()` | Obtiene workitem y mensajes, con sentimiento calculado. |
| `GET` | `/api/workitem-history` | `handleWorkitemHistory()` | Historial de workitems. |
| `GET` | `/api/workitem-history/*` | `handleWorkitemHistory()` | Detalles segun subruta. |
| `GET` | `/api/workitem-dispositions` | `handleWorkitemDispositions()` | Disposiciones de workitem. |
| `POST` | `/api/ticket` | `handleSaveTicket()` | Guarda ticket asociado a workitem. |
| `GET` | `/api/ticket` | `handleGetTicket()` | Lee ticket asociado. |

### Preguntas, checklist y asistencia al agente

| Metodo | Ruta | Handler | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/api/questions-check` | `handleQuestionsCheck()` | Valida checklist contra transcript. |
| `GET` | `/api/client-questions` | `handleClientQuestions()` | Extrae preguntas del cliente. |
| `GET` | `/api/agent-next-step` | `handleAgentNextStep()` | Sugiere siguiente accion del agente. |
| `POST` | `/api/tts` | `handleTts()` | Proxy de text-to-speech hacia configuracion upstream. |
| `GET` | `/api/agent-quality-board` | `handleAgentQualityBoard()` | Dashboard de agentes con sentimiento, compliance y alertas. |

### Agent Chat

| Metodo | Ruta | Handler | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/api/agent-chat/workitems` | `handleAgentChatWorkitems()` | Lista workitems para workspace del agente. |
| `GET` | `/api/agent-chat/workitem` | `handleAgentChatWorkitem()` | Detalle y conversacion de un workitem. |
| `POST` | `/api/agent-chat/auth/login` | `handleAgentChatLogin()` | Login del agente contra la configuracion de campana. |
| `POST` | `/api/agent-chat/auth/logout` | `handleAgentChatLogout()` | Logout del agente. |
| `POST` | `/api/agent-chat/messages` | `handleAgentChatMessage()` | Envia mensaje de agente. |
| `POST` | `/api/agent-chat/acd-status` | `handleAgentChatAcdStatus()` | Cambia estado ACD. |

### Summary Agentic

| Metodo | Ruta | Handler | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/api/summaryagentic/summary` | `handleSummaryAgenticSummary()` | Genera o lee resumen de cliente. |
| `POST` | `/api/summaryagentic/warm` | `handleSummaryAgenticWarm()` | Precarga cache de resumen. |
| `POST` | `/api/summaryagentic/test-source` | `handleSummaryAgenticTestSource()` | Prueba una fuente de datos. |
| `POST` | `/api/summaryagentic/analyze-url` | `handleSummaryAgenticAnalyzeUrl()` | Analiza una URL y propone configuracion. |
| `POST` | `/api/summaryagentic/suggest-fields` | `handleSummaryAgenticSuggestFields()` | Sugiere campos con AI. |
| `POST` | `/api/summaryagentic/widget-from-template` | `handleSummaryAgenticWidgetFromTemplate()` | Genera widget desde plantilla. |
| `POST` | `/api/summaryagentic/widget-from-chat` | `handleSummaryAgenticWidgetFromChat()` | Genera widget desde instruccion libre. |
| `POST` | `/api/summaryagentic/save-widget` | `handleSummaryAgenticSaveWidget()` | Guarda widget en libreria de campana. |
| `DELETE` | `/api/summaryagentic/save-widget` | `handleSummaryAgenticDeleteWidget()` | Borra widget de libreria. |
| `POST` | `/api/summaryagentic/hubspot-test` | `handleSummaryAgenticHubspotTest()` | Valida token HubSpot. |
| `POST` | `/api/summaryagentic/generate-layouts` | `handleSummaryAgenticGenerateLayouts()` | Genera layouts con AI. |

### PulseForms

| Metodo | Ruta | Handler | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/api/pulseforms/analyze-url` | `handlePulseFormsAnalyzeUrl()` | Analiza URL para generar formulario. |
| `POST` | `/api/pulseforms/analyze-fields` | `handlePulseFormsAnalyzeFields()` | Descubre campos desde archivos. |
| `POST` | `/api/pulseforms/generate-layouts` | `handlePulseFormsGenerateLayouts()` | Genera layouts del formulario. |
| `POST` | `/api/pulseforms/agent-session` | `handlePulseFormsAgentSession()` | Crea sesion de agente/widget. |
| `GET` | `/api/pulseforms/config` | `handlePulseFormsConfig()` | Configuracion publica del formulario. |
| `GET` | `/api/pulseforms/widget-config` | `handlePulseFormsWidgetConfig()` | Configuracion para widget embebido. |
| `GET` | `/api/pulseforms/widget-contact` | `handlePulseFormsWidgetContact()` | Busca contacto en CRM/Sugar. |
| `GET` | `/api/pulseforms/widget-accounts` | `handlePulseFormsWidgetAccounts()` | Busca cuentas CRM. |
| `POST` | `/api/pulseforms/widget-contact` | `handlePulseFormsWidgetContactCreate()` | Crea contacto. |
| `POST` | `/api/pulseforms/widget-opportunity` | `handlePulseFormsWidgetOpportunity()` | Crea oportunidad. |
| `PATCH` | `/api/pulseforms/widget-opportunity` | `handlePulseFormsWidgetOpportunityPatch()` | Actualiza oportunidad. |
| `GET` | `/api/pulseforms/query` | `handlePulseFormsQuery()` | Query generica para datos configurados. |
| `POST` | `/api/pulseforms/submit` | `handlePulseFormsSubmit()` | Envia formulario. |
| Varios | `/api/pulseforms/widget-state` | `handleWidgetState()` | Persistencia de estado. |
| Varios | `/api/pulseforms/widget-draft` | `handleWidgetDraft()` | Persistencia de borrador. |

### Admin

| Metodo | Ruta | Handler | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/api/admin/login` | `handleAdminLogin()` | Login admin. |
| `POST` | `/api/admin/logout` | `handleAdminLogout()` | Logout admin. |
| `GET` | `/api/admin/me` | `handleAdminMe()` | Usuario admin actual. |
| `GET` | `/api/admin/setup-status` | `handleAdminSetupStatus()` | Indica si falta crear primer usuario. |
| `POST` | `/api/admin/setup` | `handleAdminSetup()` | Crea primer admin. |
| Varios | `/api/admin/*` | `handleAdmin()` | CRUD de campanas, usuarios y configuraciones. |

### Wieland

| Metodo | Ruta | Handler | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/api/wieland/auth` | `handleWielandAuth()` | Login mediante token NCC. |
| `GET` | `/api/wieland/me` | `handleWielandMe()` | Usuario/session actual. |
| `POST` | `/api/wieland/logout` | inline | Cierra cookie Wieland. |
| Varios | `/api/wieland/*` | `handleWieland()` | Contactos, listas, leads, templates SMS y field mappings. |

### Thrio Data

| Metodo | Ruta | Handler | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/api/thrio-data/campaigns` | `handleThrioData()` | Lista campanas Thrio. |
| `POST` | `/api/thrio-data/campaigns` | `handleThrioData()` | Crea campana Thrio. |
| `DELETE` | `/api/thrio-data/campaigns/:id` | `handleThrioData()` | Borra campana Thrio. |
| `GET` | `/api/thrio-data/pstnnumbers` | `handleThrioData()` | Lista numeros PSTN. |
| `POST` | `/api/thrio-data/pstnnumbers` | `handleThrioData()` | Crea numero PSTN. |
| `GET` | `/api/thrio-data/workflows` | `handleThrioData()` | Lista workflows. |

### NCC Campaign Builder

`handleNccCampaignBuilder()` agrupa endpoints para crear campanas NCC, gestionar login, servicios, encuestas, reportes y cuentas admin.

Rutas principales:

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

## Integraciones AI

El backend soporta Gemini, OpenAI y Claude en flujos especificos.

### Gemini

Funciones directas:

- `detectClientQuestionsWithGemini()`: extrae preguntas del cliente.
- `callGeminiForSummary()`: genera resumen JSON.
- `callGeminiForPulseFormsFields()`: detecta campos de formularios, con soporte de archivos.
- `analyzeMessagesWithGemini()`: clasifica sentimiento.
- `analyzeChecklistWithGemini()`: valida checklist.
- `buildAgentNextStep()`: usa Gemini para sugerir la siguiente accion si `ui.nextStep.useGemini` no es `false`.
- `buildGeminiEndpoint()`: arma `/v1beta/models/{model}:generateContent`.

Wrappers que pueden llamar Gemini:

- `callAiForSummary()`: usa Gemini cuando el provider no es `claude` ni `openai`.
- `callAiForPulseFormsFieldDiscovery()`: usa Gemini cuando el provider no es `claude` ni `openai`.

### OpenAI

Usado en Summary Agentic y PulseForms cuando el provider es `openai`. Las funciones construyen payloads para `https://api.openai.com/v1/chat/completions`.

### Claude

Usado en Summary Agentic y PulseForms cuando el provider es `claude`. Las funciones llaman `https://api.anthropic.com/v1/messages`.

## Logica De Sentimiento, Checklist y Next Step

### Sentimiento

`extractClientMessages()` obtiene mensajes `CLIENT`. Si `config.sentimentProvider === "gemini"` y `ui.sentiment.useGemini !== false`, delega en `analyzeMessagesWithGemini()`. Si no, usa `scoreSentiment()`, una heuristica por palabras clave positivas y negativas.

### Checklist

`handleQuestionsCheck()` obtiene mensajes de cliente/agente con `extractChecklistMessages()`. Si la configuracion habilita Gemini para preguntas, usa `analyzeChecklistWithGemini()`. Si no, usa `analyzeChecklistHeuristically()`.

### Preguntas del cliente

`handleClientQuestions()` extrae dudas expresadas por el cliente. Puede usar `detectClientQuestionsWithGemini()` o `detectClientQuestionsHeuristically()`.

### Siguiente accion

`handleAgentNextStep()` llama `buildAgentNextStep()`. Si no hay transcript, devuelve una accion base. Si `ui.nextStep.useGemini === false`, usa `buildHeuristicAgentNextStep()`.

## Frontend: Paginas Publicas

| Archivo | Proposito | APIs usadas |
| --- | --- | --- |
| `public/index.html`, `public/app.js` | Chat principal para predicciones. | `/api/config`, `/api/prediction` |
| `public/admin.html`, `public/admin.js` | Panel admin para campanas, usuarios, UI, AI, PulseForms, Summary Agentic, Wieland y NCC Builder AI. | `/api/admin/*`, `/api/config`, endpoints AI auxiliares |
| `public/workitem.html`, `public/workitem.js` | Vista de workitem y transcript. | `/api/config`, `/api/workitem` |
| `public/sentiment.html`, `public/sentiment.js` | Monitor visual de sentimiento. | `/api/config`, `/api/workitem` |
| `public/sentiment-bar.html`, `public/sentiment-bar.js` | Barra/widget de sentimiento con tendencia y accion sugerida. | `/api/config`, `/api/workitem` |
| `public/sentiment-chip.html`, `public/sentiment-chip.js` | Chip compacto de sentimiento. | `/api/config`, `/api/workitem` |
| `public/questions.html`, `public/questions.js` | Checklist de preguntas. | `/api/config`, `/api/questions-check` |
| `public/smart-checklist.html`, `public/smart-checklist.js` | Checklist visual con prompts sugeridos. | `/api/config`, `/api/questions-check` |
| `public/agent-next-step.html`, `public/agent-next-step.js` | Widget de siguiente accion. | `/api/config`, `/api/agent-next-step` |
| `public/agent-quality-board.html`, `public/agent-quality-board.js` | Dashboard de calidad por agente. | `/api/config`, `/api/agent-quality-board` |
| `public/agent-chat.html`, `public/agent-chat.js` | Workspace de agente con login, workitems, mensajes y estado ACD. | `/api/agent-chat/*` |
| `public/agent-copilot.html`, `public/agent-copilot.js` | Copilot de agente basado en guidance/next step. | `/api/config`, `/api/agent-next-step` |
| `public/history-widget.html`, `public/history-widget.js` | Historial de workitems. | `/api/workitem-history` |
| `public/summaryagentic.html`, `public/summaryagentic.js` | Widget de resumen agentico. | `/api/summaryagentic/summary` |
| `public/pulseforms.html`, `public/pulseforms.js` | Formulario PulseForms embebible. | `/api/pulseforms/*` |
| `public/pulseformv2.html`, `public/pulseformv2.js` | Variante V2 de PulseForms. | `/api/pulseforms/*` |
| `public/wieland.html`, `public/wieland.js` | Gestion de contactos/listas/leads Wieland. | `/api/wieland/*` |
| `public/thrio-campaigns.html`, `public/thrio-campaigns.js` | Herramienta para campanas y numeros Thrio. | `/api/thrio-data/*` |
| `public/ncc-campaign-builder.html`, `public/ncc-campaign-builder.js` | Wizard para crear campanas NCC y encuestas. | `/api/ncc-builder/*` |
| `public/login.html` | Pantalla de login/entrada. | Depende de flujo seleccionado |
| `public/nextiva-sdk.html` | Documentacion local del SDK Nextiva. | Estatico |
| `public/i18n.js` | Textos compartidos por idioma. | Estatico |
| `public/styles.css` | Estilos globales. | Estatico |

## Widget Sugar/NCC

Carpeta: `public/widget/`.

| Archivo | Proposito |
| --- | --- |
| `index.html` | UI principal del widget embebido. |
| `index-agent-token.html` | Variante orientada a token de agente. |
| `config.js` | Plantilla de configuracion del widget. |
| `sugar.js` | Cliente Sugar CRM con OAuth2, refresh token y retry en `401`. |
| `ncc.js` | Adaptador de eventos NCC por `postMessage`. |
| `README.md` | Guia especifica del widget. |

El widget escucha eventos como `call_started`, `ncc:call_started`, `workitem:started`, `call_ended`, `ncc:call_ended` y equivalentes. Puede recibir `phone`, `ani`, `callerId`, `workitemid`, `callId`, `agentName` y `queueName` por URL o por evento.

## Flujos Principales

### Chat de prediccion

1. `public/app.js` lee parametros URL.
2. Llama `/api/config` para resolver campana y UI.
3. Envia mensajes a `/api/prediction`.
4. `handlePrediction()` resuelve token/cookie/API URL de campana.
5. `fetchPredictionUpstream()` llama el upstream configurado.
6. La respuesta se renderiza como mensaje enriquecido.

### Workitem y sentimiento

1. La pagina recibe `campaign` y `workitemid`.
2. El frontend llama `/api/workitem`.
3. `handleWorkitem()` resuelve configuracion y obtiene el workitem upstream.
4. `extractClientMessages()` filtra mensajes `CLIENT`.
5. Se calcula sentimiento por heuristica o Gemini.
6. El frontend renderiza transcript, cards, chip, barra o tablero segun pagina.

### Summary Agentic

1. El widget llama `/api/summaryagentic/summary`.
2. El backend resuelve campana, fuentes de datos, cache y AI provider.
3. Se cargan datos externos configurados, incluyendo HubSpot si aplica.
4. `callAiForSummary()` llama Claude, OpenAI o Gemini.
5. La respuesta JSON se normaliza y se guarda en cache.
6. `summaryagentic.js` renderiza secciones del resumen.

### PulseForms

1. El admin configura campos, data sources, Sugar CRM y layout.
2. El widget `pulseforms.js` o `pulseformv2.js` carga `/api/pulseforms/config`.
3. Si hay contexto de llamada, consulta contacto/cuenta por APIs del widget.
4. El agente completa o confirma campos.
5. `/api/pulseforms/submit` envia los datos al destino configurado.
6. Para Sugar, existen endpoints especificos para contacto y oportunidad.

### Wieland

1. El usuario inicia sesion con token NCC en `/api/wieland/auth`.
2. El backend valida JWT y guarda cookie de sesion.
3. `wieland.js` consume `/api/wieland/*`.
4. El backend gestiona contactos locales/Firestore y listas/leads en NCC.
5. Se pueden sincronizar prioridades, asignar contactos y configurar templates SMS.

### NCC Campaign Builder

1. `ncc-campaign-builder.js` inicia sesion con credenciales NCC.
2. Carga servicios disponibles: PSTN, supervisors, AI, realtime, KB y surveys.
3. El wizard construye payloads de campana, workflow, colas, disposiciones y horarios.
4. `/api/ncc-builder/create` ejecuta la creacion secuencial y devuelve `steps`.
5. El modulo de survey designer puede generar JSON por heuristica local o AI.

## Convenciones de UI y Embeds

Muchas paginas aceptan:

- `campaign`
- `domain`
- `workitemid` o `workitemId`
- `embed=1`
- overrides visuales por query string

Cuando estan embebidas, varias paginas notifican altura al padre con:

```js
window.parent.postMessage({ type: "nextiq:resize", height }, "*");
```

## Manejo de Errores

Patrones comunes:

- Validaciones de entrada devuelven `400`.
- Falta de autenticacion devuelve `401`.
- Campana o recurso inexistente devuelve `404`.
- Problemas de configuracion usan `throwConfig()` y normalmente responden `400`.
- Errores upstream suelen devolver `502`.
- Errores internos devuelven `500`.

Los handlers suelen incluir `details` cuando el error no expone secretos.

## Pruebas y Verificacion

No hay test suite automatizada declarada en `package.json`. Las verificaciones disponibles son:

```bash
node --check server.js
npm start
```

Los scripts de despliegue ya ejecutan `node --check server.js`.

Para validar manualmente:

- `/api/health`
- `/admin.html`
- `/index.html?campaign=<id>`
- `/workitem.html?campaign=<id>&workitemid=<id>`
- widgets especificos segun la campana configurada

## Recomendaciones de Mantenimiento

- No commitear `.env`, `env/staging.yaml`, `env/production.yaml` ni archivos locales con secretos.
- Mantener `server.js` con handlers pequenos cuando sea posible; actualmente concentra demasiadas responsabilidades.
- Si se agregan endpoints, actualizar esta documentacion y el mapa de rutas.
- Si se agregan campos sensibles a campanas, incluirlos en `SECRET_FIELDS`.
- Si se cambia el esquema de campana, actualizar `normalizeCampaign()`, el admin y las paginas que consumen `/api/config`.
- Para nuevos flujos AI, reutilizar `callAiForSummary()` o crear un wrapper equivalente que soporte `claude`, `openai` y `gemini`.
- Para nuevos widgets embebidos, implementar `notifyParentHeight()` y soportar `embed=1`.

