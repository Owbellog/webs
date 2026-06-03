# Revision de Seguridad Adversarial - NextIQ Chat (`server.js` + `public/`)

**Fecha:** 2026-06-02
**Revisor:** gerry.holly (via Claude Code, 4 subagentes de seguridad en paralelo)
**Objetivo:** Una unica GCP Cloud Function de unas 12.2k lineas (Gen2), desplegada con `--allow-unauthenticated` (invocable publicamente).
**Alcance:** autenticacion/control de acceso, inyeccion/SSRF, secretos/criptografia/despliegue, frontend. Todos los hallazgos fueron confirmados en el codigo fuente.

## Veredicto: **NO esta listo para lanzar.** Multiples problemas criticos explotables remotamente sin autenticacion.

Causa raiz recurrente: varios grupos de endpoints hacen proxy hacia APIs upstream **usando credenciales guardadas en el servidor** mientras **no autentican al llamador**, y seleccionan el objetivo solo mediante un parametro `?campaign=`. Un atacante remoto que conozca (o adivine) un id de campana opera con los privilegios del servidor.

---

## CRITICO - corregir antes de cualquier despliegue

| ID | Hallazgo | Ubicacion | Explotacion |
|----|----------|-----------|-------------|
| **C1** | `/api/wieland/*` - grupo completo sin autenticacion; hace proxy con credencial NCC almacenada. El codigo dice literalmente `// No auth required for Wieland routes`. | `server.js:8830`, gate `:909` | `GET /api/wieland/contacts?campaign=wieland` -> PII completa de contactos; `POST` crea registros; el endpoint de migracion hace PATCH masivo del email de todos los contactos. |
| **C2** | `/api/thrio-data/*` - sin autenticacion; hace proxy con token Thrio almacenado. Incluye acciones destructivas y facturables. | `server.js:11227`, gate `:914` | `DELETE /api/thrio-data/campaigns/{id}?campaign=<id>`; `POST .../pstnnumbers` asigna numeros telefonicos facturables. |
| **C3** | `/api/workitem-history`, `/api/workitem-dispositions` - sin autenticacion; filtran historial de llamadas/work-items via token almacenado. | `server.js:7290`, `:7329` | `GET /api/workitem-history/{id}?campaign=<id>`. |
| **C4** | **SSRF -> robo de token de metadata de GCP.** `fetchSummaryDataSource` llama `fetch(userUrl)` sin allowlist ni filtrado de IP/esquema; el atacante controla la URL *y* los headers. | `server.js:4849`, via `/api/summaryagentic/test-source` `:2013` | `POST` `{"url":"http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token","headersJson":"{\"Metadata-Flavor\":\"Google\"}"}` -> el cuerpo de respuesta se devuelve al llamador = **token OAuth de la cuenta de servicio = compromiso de todo el proyecto**. |
| **C5** | El mismo sink SSRF es alcanzable **sin autenticacion** via `GET /api/summaryagentic/summary` y `/api/pulseforms/query`/`submit` (URLs de data-source plantadas/almacenadas; parametros extra de query se convierten en variables de plantilla inyectadas en la URL/cuerpo upstream). | `server.js:1891`, `:847`, `:3377` | No se comprueba sesion; dispara `fetchSummaryDataSource` para cada data source habilitado. |
| **C6** | **DOM XSS** en ambos widgets de Ilunion: la respuesta del copiloto de IA se interpola dentro de un `onclick` inline entre comillas dobles, pero `safeText` solo escapa `\` y `'`, **no `"`**. | `ilunion-widgetv2.html:930`, `ilunion-widget.html:923` | Una respuesta que contenga `") onmouseover="...` rompe el contexto -> JS arbitrario en el origen del widget -> roba el token del agente (ver H8). |
| **C7** | **Secretos en texto plano incluidos en el bundle de despliegue.** `.gcloudignore` excluye `.env`/`users.json` pero **no** `env/*.yaml`. Los YAML de staging/prod/demo (JWT Thrio vivo, password admin, salt de cifrado) se suben al archive fuente de GCS, legible por cualquier viewer del proyecto. | `.gcloudignore` | - |

**C4 es el hallazgo clave**: exfiltracion en una sola peticion del token de la cuenta de servicio de la funcion, lo que permite pivotar a todo el proyecto `voicebot-451222`. Arreglarlo en el punto central (`fetchSummaryDataSource`) tambien cierra C5.

---

## ALTO

- **H1 - Bypass de autenticacion JWT de Wieland.** `decodeJwtPayload` (`:220`) nunca verifica la firma. En modo `nccAuthType:"key"` (`:359`, *"trust the JWT's own expiry"*) el servidor crea una sesion a partir de claims controlados por el atacante. Un JWT falsificado con `alg:none` -> `niq_w_sess` valido para cualquier usuario/tenant. Rompe el modelo de confianza SSO independientemente de C1.
- **H2 - Fuerza bruta del admin.** El rate limiter se basa en `X-Forwarded-For`, que es falseable (`:47`), y se aplica en el gate *posterior al login*, **no** dentro de `handleAdminLogin` (`:506`), asi que el endpoint de prueba de password no tiene limitacion efectiva.
- **H3 - Secretos compartidos entre todos los entornos.** `ADMIN_PASSWORD` + `ENCRYPTION_SALT` son identicos byte a byte en staging/production/demo; el JWT Thrio se comparte entre staging y prod. No hay aislamiento de blast radius; el entorno demo publico compromete produccion.
- **H4 - `env/demo.yaml` no trackeado pero TAMPOCO gitignorado.** Un `git add .` bastaria para commitear secretos vivos. Buena noticia: `git log --all` confirma que ningun archivo de secretos fue commiteado jamas; el historial esta limpio.
- **H5 - Secretos via `--env-vars-file`, sin Secret Manager.** Visibles en metadata de la funcion para cualquier viewer del proyecto; combinado con `--allow-unauthenticated`.
- **H6 - Derivacion de claves ligada a `ADMIN_PASSWORD`.** La clave AES de datos, ambas claves HMAC de sesion y el login derivan de un unico valor. Rotar la password (algo ahora obligatorio) haria silenciosamente indescifrables todos los campos cifrados de `campaigns.json`, desincentivando la rotacion justo cuando mas se necesita.
- **H7 - El handler de postMessage confia en cualquier origen.** `public/widget/ncc.js:67` usa por defecto `allowedOrigin = "*"`; un embedder hostil puede falsificar `call_started`/`call_ended`, identidad del llamador o `workitemId` -> acceso cross-customer a datos.
- **H8 - Tokens de sesion en `sessionStorage` + tokens en parametros de URL.** `ncc-campaign-builder.js` (token admin NCC via `?token=`, persistido y re-anadido), `agent-chat.js:587`. Extraibles por XSS (encadena con C6); se filtran via historial/Referer/logs.
- **H9 - CSRF en mutaciones de Wieland.** `wieland.js` usa `credentials:"include"` sin token CSRF; la cookie Wieland usa `SameSite=None` -> cambios de estado cross-site (activar listas, subir leads).

---

## MEDIO

- **M1 - Sin limite de tamano de request body** en `readJson` (`:7084`) -> DoS por agotamiento de memoria/amplificacion de coste.
- **M2 - Parametros KDF de admin algo debiles.** PBKDF2-SHA512 **100k** iteraciones (por debajo de OWASP >=210k); minimo de password de 8 caracteres. El hashing de passwords de usuario por lo demas es *correcto*: KDF lento, salt aleatorio, `timingSafeEqual`; no era el hash rapido sospechado inicialmente.
- **M3 - Sin headers de seguridad.** No CSP / `X-Frame-Options` / HSTS / `nosniff`. Las paginas de widget y admin/login son frameables -> clickjacking; sin CSP para contener XSS.
- **M4 - Datos sensibles a Cloud Logging.** `server.js:9407` registra PII de leads; `:9409` registra respuesta NCC cruda; `:7175` registra substring de token.
- **M5 - Comparacion no constant-time** con `===` en fallbacks legacy `X-Admin-Password`/Basic-auth (`:7060`); estos fallbacks de password maestra evitan el flujo de sesion y `hasAdminPermission` concede permisos completos cuando la sesion es null (`:500`).
- **M6 - `/api/admin/setup` re-ejecutable** si el user store queda vacio alguna vez; `writeUsers` usa un patron arriesgado de borrar todo y luego escribir (`:439`).
- **M7 - Campo del servidor sin escapar** dentro de `innerHTML` (`diana-agent.html:551`); `postMessage(payload,"*")` saliente incluye contenido `nextiq:insert` (`agent-next-step.js:203`).

---

## Verdaderos negativos confirmados (revisados, limpios)

Path traversal en serving estatico (`serveStatic` usa `path.normalize` + comprobacion `startsWith(PUBLIC_DIR)`, `:6034`); no hay `eval`/`child_process`/`exec`/`vm`; prototype pollution (allowlist estricta de campos en `normalizeCampaign`, `:6281`); los parsers AI-JSON son lineales de una sola pasada (sin ReDoS, output nunca ejecutado); AES-GCM usa IV nuevo por operacion y verifica auth tag (`:101`/`:121`); el historial git no tiene secretos commiteados; `wieland.html/js` no tienen credenciales hardcodeadas; el renderizado de AI-layout de admin/summaryagentic usa `safeHtml()`/`esc()`.

---

## Orden de correccion recomendado

1. **Agregar gates de autenticacion a C1/C2/C3** (`isAuthorizedWieland` / `isAuthorizedAdmin` al inicio de los handlers): tres proxies con credenciales y sin autenticacion.
2. **Filtro de egreso SSRF en `fetchSummaryDataSource`**: rechazar link-local/loopback/RFC-1918/`metadata.google.internal`, esquemas no http(s), fijar DNS; cierra C4 + C5.
3. **`.gcloudignore` + `.gitignore`**: agregar `env/*.yaml` (C7, H4); luego **rotar** el JWT Thrio, password admin y salt ahora expuestos, y diferenciarlos por entorno (H3, H5).
4. **C6** XSS: escapar `"`; mejor aun, eliminar `onclick` inline y usar `addEventListener`.
5. H1 (verificar firma JWT / rechazar `alg:none`), H2 (rate-limit del endpoint de login sobre una IP confiable), H7 (allowlist de origen para postMessage), H8/H9 (almacenamiento de tokens + CSRF).
6. Desacoplar la clave de cifrado de datos de `ADMIN_PASSWORD` (H6) **antes** de rotarla, o la rotacion destruira los datos cifrados.

---

## Metodologia

Revisado por cuatro subagentes en paralelo, cada uno con alcance en un dominio e instruidos para confirmar cada hallazgo en el codigo fuente (sin especulacion):
- **Auth / sesion / control de acceso**: tokens HMAC de sesion, manejo JWT, gate admin, IDOR, rate limiting, hashing de passwords.
- **Inyeccion / SSRF**: sinks de fetch saliente, inyeccion de comandos/codigo, path traversal, prototype pollution, inyeccion NoSQL, parsing AI-JSON, ReDoS.
- **Secretos / cripto / despliegue**: `.env`/`env/*.yaml`, historial git, AES-GCM + KDF, `--allow-unauthenticated`, CORS/headers, logging.
- **Frontend**: DOM XSS, chequeos de origen postMessage/iframe, almacenamiento client-side de tokens, open redirect, clickjacking, CSRF.

Los hallazgos principales (C1-C5, C7) fueron reverificados independientemente contra el codigo fuente por el lead antes de finalizar.
