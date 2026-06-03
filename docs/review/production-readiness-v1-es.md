# Informe de Preparacion para Produccion - NextIQ Chat

**Fecha:** 2026-06-02
**Revisor:** gerry.holly (via Claude Code)
**Objetivo:** GCP Cloud Function (Gen2), `server.js` ~12.2k lineas + assets estaticos `public/`.
**Documento relacionado:** `adversarial-review-v1.md` (detalle completo de hallazgos).

---

## Veredicto: ROJO **NO-GO**

La aplicacion no debe desplegarse (o, si ya esta desplegada, deberia bloquearse) hasta remediar los hallazgos criticos de seguridad. Tres grupos de endpoints estan completamente sin autenticacion mientras hacen proxy con credenciales upstream guardadas en el servidor, y un sink SSRF permite robar en una sola peticion el token de la cuenta de servicio de GCP: compromiso de todo el proyecto. No son problemas teoricos: cada uno fue confirmado en el codigo fuente y es alcanzable por un atacante remoto no autenticado que solo necesita un campaign id.

Un GO condicional es posible una vez cerrados y verificados los bloqueadores de abajo.

---

## Scorecard de readiness

| Dimension | Estado | Notas |
|-----------|--------|-------|
| **Seguridad - authn/authz** | ROJO Bloqueante | C1-C3 proxies con credenciales y sin autenticacion; H1 bypass JWT; H2 login sin throttling. |
| **Seguridad - SSRF/inyeccion** | ROJO Bloqueante | C4/C5 metadata SSRF -> robo de token SA. Sin command-injection/path-traversal (verificado limpio). |
| **Seguridad - secretos/despliegue** | ROJO Bloqueante | C7 secretos en bundle de despliegue; H3 compartidos entre entornos; H4 demo.yaml a un `git add` de filtrarse; H5 sin Secret Manager. |
| **Seguridad - frontend** | NARANJA Alto | C6 XSS en widgets Ilunion; H7 postMessage abierto; H8 almacenamiento de tokens; H9 CSRF. |
| **Proteccion de datos** | NARANJA Alto | Implementacion AES-GCM correcta, pero H6 clave ligada a `ADMIN_PASSWORD` -> la rotacion destruye datos; sin versionado de claves. |
| **Observabilidad / logging** | NARANJA Medio | M4 PII + substrings de token a Cloud Logging; sin audit log estructurado para acciones admin/destructivas. |
| **Resiliencia / DoS** | NARANJA Medio | M1 sin limite de tamano de body; `writeUsers` borra y luego escribe (M6), lo que puede vaciar el user store ante fallo parcial. |
| **Higiene de config / entornos** | NARANJA Medio | Secretos identicos entre staging/prod/demo; `--allow-unauthenticated` en los tres. |
| **Estructura de codigo / mantenibilidad** | AMARILLO Vigilar | Todo el backend en un archivo de 12.2k lineas; routing como larga cadena if/else: funciona, pero aumenta riesgo de cambio y coste de revision. |
| **Dependencias** | VERDE OK | Solo `@google-cloud/firestore` + functions-framework; superficie minima de supply chain. |
| **Primitivas criptograficas** | VERDE OK | IV aleatorio por operacion, auth-tag verificado, hashing PBKDF2 de usuarios con salt aleatorio + comparacion constant-time. Subir iteraciones (M2). |
| **Tests / CI** | BLANCO Desconocido | No se observo suite de tests; los scripts de deploy solo corren `node --check` (sintaxis). Sin gate automatico de seguridad. |

Leyenda: ROJO bloqueante - NARANJA corregir pronto - AMARILLO monitorizar - VERDE aceptable - BLANCO gap/desconocido

---

## Bloqueadores de go-live (deben cerrarse antes de GO)

1. **Autenticar C1/C2/C3**: proteger `/api/wieland/*`, `/api/thrio-data/*`, `/api/workitem-history*` al inicio del handler.
2. **Filtro de egreso SSRF** en `fetchSummaryDataSource` (cierra C4 + C5): bloquear link-local/loopback/RFC-1918/`metadata.google.internal`, restringir a http(s), fijar DNS, eliminar headers `Metadata-*`.
3. **Sacar secretos del bundle de despliegue**: agregar `env/*.yaml` a `.gcloudignore`; agregar `env/demo.yaml` a `.gitignore`.
4. **Rotar las credenciales expuestas**: JWT Thrio, `ADMIN_PASSWORD`, `ENCRYPTION_SALT`, y hacerlas distintas por entorno. Importante: desacoplar primero la clave de cifrado de datos de `ADMIN_PASSWORD` (H6), o la rotacion hara indescifrables los campos cifrados existentes de `campaigns.json`.
5. **Corregir C6 XSS** en los widgets de Ilunion.

## Muy recomendado antes de GO

- H1 (verificar firma JWT de Wieland / rechazar `alg:none`), H2 (rate-limit de `handleAdminLogin` sobre IP de cliente confiable), H7 (allowlist de origen para postMessage), H8/H9 (mover tokens de URL/`sessionStorage`; agregar proteccion CSRF en rutas de mutacion con `SameSite=None`).
- Mover secretos a Secret Manager via `--set-secrets` (H5); reconsiderar `--allow-unauthenticated` o poner IAP delante.
- M1 limite de tamano de body; M3 headers de seguridad (CSP `frame-ancestors`, HSTS, `nosniff`, `X-Frame-Options`); M4 dejar de registrar PII/substrings de token.

## Backlog de hardening post-GO

- M2 subir iteraciones PBKDF2 (-> ~210k+) / migrar a argon2id; elevar minimo de longitud de password.
- M5 eliminar fallbacks legacy `X-Admin-Password`/Basic-auth; mientras tanto, comparacion constant-time.
- M6 hacer que el gating de `/api/admin/setup` no dependa de una lectura transitoriamente vacia; hacer `writeUsers` transaccional/aditivo.
- Agregar un chequeo automatico de seguridad a CI (SAST + secret scanning) para que los scripts de deploy validen mas que `node --check`.
- Considerar descomponer `server.js` en modulos para reducir el riesgo de cambios en una codebase sensible a seguridad.

---

## Criterios de GO condicional

Cambiar a VERDE **GO** cuando: los cinco bloqueadores de go-live esten remediados **y** verificados (re-test de los PoC exactos en `adversarial-review-v1.md`), las credenciales expuestas esten rotadas y separadas por entorno, y se confirme que la ruta de secretos-en-bundle esta cerrada (inspeccionar un artefacto de despliegue fresco). Los items High deberian quedar en un calendario de correccion cercano y comprometido aunque no todos entren antes del primer despliegue controlado.
