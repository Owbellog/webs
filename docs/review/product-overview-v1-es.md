# Vision General de Producto - NextIQ Chat (lo que esta app intenta hacer)

**Fecha:** 2026-06-02
**Autor:** gerry.holly (via Claude Code)
**Documentos relacionados:** `adversarial-review-v1.md`, `production-readiness-v1.md`, `docs/CODE_DOCUMENTATION_EN.md`

> Este informe explica el *proposito* de la app: el problema que resuelve, quien la usa y como encajan las piezas, a nivel de producto. Para detalle endpoint por endpoint ver `docs/CODE_DOCUMENTATION_EN.md`; para postura de seguridad ver los documentos de review/readiness.

---

## En una frase

NextIQ Chat es una **capa adicional de IA multi-tenant para la plataforma Thrio / Nextiva Contact Center (NCC)**: un unico backend Node.js mas una libreria de widgets embebibles en navegador que insertan asistencia de IA en tiempo real (sentimiento, resumenes, next-best-action, formularios inteligentes, gestion de leads) dentro de la pantalla del agente de contact center, configurada por cliente ("campaign") sin tocar el producto NCC subyacente.

## El problema que resuelve

Los agentes de contact center trabajan dentro de Thrio/NCC gestionando llamadas y work-items en vivo. La plataforma base expone APIs de prediccion, transcripcion y CRM, pero no una experiencia de IA pulida y especifica por cliente dentro del escritorio del agente. NextIQ Chat cubre ese espacio: se situa **entre** la plataforma NCC (y CRMs/proveedores de IA de terceros) y un conjunto de **widgets embebibles via iframe**, de modo que un cliente puede recibir un copiloto de IA, monitor de sentimiento o formulario de captura de datos a medida, embebido directamente en la UI del agente, con marca y configuracion propias, sin fork de codigo por cliente.

La idea central de diseno es la **campana**: un objeto de configuracion que contiene las credenciales upstream del cliente (token/cookie/dominio de Thrio), ajustes de UI/branding, proveedor de IA y prompts a usar (Gemini / OpenAI / Claude), y configuracion por feature (preguntas, resumenes, formularios, listas de leads). Cada widget y llamada API resuelve su comportamiento desde un parametro `?campaign=<id>` (o `?domain=`), y el backend inyecta server-side las credenciales upstream correctas. Esto es lo que permite multi-tenancy desde un unico despliegue.

## Quien lo usa

- **Agentes de contact center**: consumen los widgets embebidos durante llamadas en vivo (sentimiento, copiloto, resumenes, formularios).
- **Supervisores / QA**: usan tableros de calidad y vistas de historial.
- **Admins de cliente / operaciones internas**: usan `admin.html` para crear y configurar campanas, y el wizard NCC Campaign Builder para provisionar nuevas campanas/surveys NCC.
- **Host de embedding**: la app web de NCC/CRM (y partners como Wieland, Ilunion, Diana, Sugar CRM) que inserta estos widgets en frames dentro del workspace del agente.

## Que hace - areas funcionales

| Area | Para que sirve | Paginas / APIs clave |
|------|----------------|----------------------|
| **Prediction chat** | La funcionalidad original: una UI de chat sobre el endpoint de prediccion/base de conocimiento de Thrio NextIQ. | `index.html` / `app.js` -> `/api/prediction`, `/api/config` |
| **Monitoreo de sentimiento** | Lectura en vivo del sentimiento del cliente en una llamada (verde/amarillo/rojo), via heuristica local o Gemini. Multiples formatos de visualizacion. | `sentiment*.html`, `sentiment-bar`, `sentiment-chip` -> `/api/workitem` |
| **Preguntas / checklist inteligente** | Verifica si el agente cubrio puntos obligatorios, validado contra la transcripcion por IA. | `questions.html`, `smart-checklist` -> `/api/questions-check` |
| **Asistencia al agente / copiloto** | Sugiere la siguiente mejor accion y destaca preguntas del cliente en tiempo real. | `agent-next-step`, `agent-copilot` -> `/api/agent-next-step` |
| **Tablero de calidad del agente** | Dashboard de supervisor que combina sentimiento, compliance y alertas. | `agent-quality-board` -> `/api/agent-quality-board` |
| **Workspace de chat del agente** | Una consola de agente mas completa: login, listar/inspeccionar work-items, enviar mensajes, cambiar estado ACD. | `agent-chat` -> `/api/agent-chat/*` |
| **Summary Agentic** | Genera un resumen IA del cliente extrayendo datos de fuentes configuradas (incl. HubSpot CRM) y componiendo con Claude/OpenAI/Gemini; los admins pueden generar con IA el propio layout del widget. | `summaryagentic` -> `/api/summaryagentic/*` |
| **PulseForms** | Formularios embebibles de captura de datos asistidos por IA (incl. lookup y write-back de contactos/oportunidades en Sugar CRM); la IA puede derivar campos/layout desde una URL o archivos subidos. | `pulseforms`, `pulseformv2`, `widget/` -> `/api/pulseforms/*` |
| **Wieland** | **Gestion de leads y contactos** para outbound dialer del cliente Wieland: gestionar contactos/listas/leads, refrescar prioridades, plantillas SMS, mapeos de campos, respaldado por NCC, con SSO via JWT NCC. | `wieland` -> `/api/wieland/*` |
| **Herramientas Thrio Data** | Gestion directa de campanas Thrio, numeros PSTN y workflows. | `thrio-campaigns` -> `/api/thrio-data/*` |
| **NCC Campaign Builder** | Un **wizard de provisionamiento** que crea campanas NCC completas end-to-end: workflows, queues, dispositions, business hours, surveys (disenador de surveys asistido por IA), desde una UI guiada. | `ncc-campaign-builder` -> `/api/ncc-builder/*` |
| **Admin** | Crear/configurar campanas y usuarios; configurar todas las features anteriores por campana. | `admin.html` / `admin.js` -> `/api/admin/*` |

## Como esta construido (arquitectura breve)

- **Un backend, sin framework web.** `server.js` (~12k lineas) es todo el backend: routing (cadena if/else por metodo+ruta), auth/sesiones, cifrado de secretos, proxy upstream, integracion con proveedores de IA y serving de archivos estaticos. `index.js` lo exporta como la Cloud Function `nextiq`.
- **Despliegue.** Corre localmente con `node server.js`, o como **GCP Gen2 HTTP Cloud Function** (`--allow-unauthenticated`) en tres entornos: `staging`, `production`, `demo`.
- **Storage.** Prefiere **Firestore** (campanas, usuarios, contactos Wieland, estado de widgets, cuentas de NCC builder); cae a archivos JSON locales (`campaigns.json`, `users.json`, ...) cuando Firestore no esta configurado.
- **Secretos.** Los campos sensibles de campana (tokens, API keys, passwords CRM) se cifran en reposo con AES-256-GCM, con clave derivada por PBKDF2 desde `ADMIN_PASSWORD` + `ENCRYPTION_SALT`.
- **Proveedores de IA.** Configurables por campana: Gemini, OpenAI o Claude, detras de funciones wrapper (`callAiForSummary`, etc.), con fallbacks heuristicos locales para sentimiento/checklist/next-step para que las features degraden con gracia sin IA.
- **Modelo de embedding.** Los widgets estan disenados para ser iframed en escritorios de agente de terceros; detectan automaticamente modo embed, aceptan configuracion/branding via query string y reportan su altura al frame padre mediante `postMessage` para que el host ajuste el iframe. Las sesiones cross-site (por ejemplo Wieland) usan cookies `SameSite=None` porque las paginas corren dentro de un frame ajeno.

## Como fluye una request tipica (ejemplo Summary Agentic)

1. El widget embebido llama `/api/summaryagentic/summary?campaign=<id>&phone=<x>`.
2. El backend resuelve la configuracion de la campana, sus data sources, cache y proveedor de IA elegido.
3. Carga data sources externas (por ejemplo HubSpot) usando credenciales guardadas en el servidor.
4. `callAiForSummary()` compone un resumen estructurado via Claude/OpenAI/Gemini.
5. El JSON se normaliza, cachea y devuelve.
6. `summaryagentic.js` renderiza las secciones del resumen en el iframe del agente.

Las demas features siguen la misma forma: **widget -> API scoped por campana -> servidor resuelve credenciales -> proxy upstream / llamada IA -> JSON normalizado -> render en frame**.

## Trayectoria del producto (lo que sugiere el historial del codigo)

Empezo como un "chat UI sobre predicciones Thrio" enfocado (segun el titulo en espanol del README) y crecio hasta convertirse en un **toolkit de IA para contact center / plataforma white-label de widgets**. Commits recientes se centran en NCC Campaign Builder, PulseForms + integracion Sugar CRM, y hardening del parser JSON de AI-layout; es decir, el impulso va hacia *configuracion/autoria* asistida por IA (generar widgets, formularios, surveys, layouts desde prompts/URLs) encima de los widgets runtime de asistencia al agente.

## Advertencias honestas (relevantes para "que intenta hacer" vs. que es seguro lanzar)

La intencion de producto es solida y coherente. Sin embargo, el modelo **multi-tenant, con credenciales en el servidor, embebible en cualquier lugar** es exactamente lo que vuelve serios los hallazgos de seguridad: varios endpoints proxy scoped por campana actualmente no autentican al llamador, asi que la comodidad de "resolver las credenciales del cliente server-side desde un campaign id" se convierte en exposicion cuando el id por si solo concede acceso. Ver `production-readiness-v1.md`: la app entrega la funcionalidad prevista, pero **todavia no esta lista para produccion** sin los fixes criticos.
