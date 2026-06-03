# Documentacion tecnica - Widget NCC / Sugar CRM Elena

## 1. Componentes

| Componente | Archivo / ruta | Responsabilidad |
| --- | --- | --- |
| Widget con token de agente | `public/widget/index-agent-token.html` | UI del formulario, validacion de agente, flujo de llamada y envio. |
| Config dinamica | `public/widget/config.js` | Carga configuracion publica por campana desde backend. |
| Cliente Sugar frontend | `public/widget/sugar.js` | Llama endpoints backend del widget. No expone credenciales Sugar. |
| Adaptador NCC | `public/widget/ncc.js` | Normaliza eventos de llamada por URL, `postMessage` o eventos `ncc:*`. |
| Backend | `server.js` | Valida sesion Thrio, consulta workitem, proxy Sugar, persistencia de estado/borrador. |
| Firestore staging | `staging_campaigns/elena` | Configuracion de campana. |
| Estado widget | `staging_widget_state` | IDs de Contact, Ticket y Needs Assessment por llamada. |
| Borrador widget | `staging_widget_draft` | Valores parciales del formulario por llamada. |

## 2. URL de integracion

```text
https://us-central1-voicebot-451222.cloudfunctions.net/nextiq-staging/widget/index-agent-token.html?campaign=elena&callId=${workitemInformation.workitemId}&agentToken=${window.thrio.sessionService.getHndlbarToken()}
```

Parametros soportados:

| Parametro | Aliases | Uso |
| --- | --- | --- |
| `campaign` | - | Campana a cargar. Debe ser `elena`. |
| `callId` | `callid`, `workitemid`, `workitemId`, `call_id` | ID de llamada/workitem. |
| `agentToken` | `agent_token`, `token`, `authorization` | Token Thrio para validar sesion del agente. |
| `ani` | `phone`, `callerId` | Telefono de cliente si no se usa workitem. |
| `agentName` | `agent` | Nombre/usuario del agente. |
| `queueName` | `queue` | Cola de llamada. |

## 3. Configuracion actual no sensible de Elena

| Clave | Valor |
| --- | --- |
| Campaign ID | `elena` |
| Dominio Thrio | `astonvilla.thrio.io` |
| Workitem API | `https://mancity.thrio.io/users/api/workitems` |
| PulseForms | habilitado |
| Modo PulseForms | `both` |
| Sugar base URL | `https://devcrm.elliott-tool.com` |
| Sugar API version | `v11_1` |
| Sugar username | `jd1` |
| Sugar clientId | `sugar` |
| Sugar platform | `base` |
| Contact module | `Contacts` |
| Contact lookup field | `phone_work` |
| Ticket module | `tic_Tickets` |
| Needs Assessment module | `NA_NeedsAssessment` |
| Submit module legacy | `Opportunities` |
| Max fields per request | `100` |
| NCC event origin | `*` |
| Widget state read token | configurado, almacenado cifrado |

No documentar ni compartir en texto plano:

- `token`
- `pulseformsSugarPassword`
- `pulseformsSugarClientSecret`
- `pulseformsWidgetStateReadToken`
- JWTs o API keys de otros widgets

## 4. Flujo tecnico de carga

1. El navegador abre `index-agent-token.html`.
2. El script inicial lee `agentToken`.
3. Si falta el token, el widget queda bloqueado.
4. Si existe, llama:

```http
POST /api/pulseforms/agent-session
Content-Type: application/json

{ "token": "<AGENT_TOKEN>" }
```

5. El backend valida el token contra:

```http
GET https://astonvilla.thrio.io/users/api/session
Authorization: <AGENT_TOKEN>
```

6. Si la sesion es valida, se oculta la pantalla de validacion y carga el formulario.
7. `config.js` llama `/api/pulseforms/widget-config?campaign=elena`.
8. El widget inicializa `sugar.js` y `ncc.js`.
9. Si hay `callId`, carga el workitem y ejecuta lookup de contacto.

## 5. Endpoints usados por el widget

### Validacion de agente

```http
POST /api/pulseforms/agent-session
```

Body:

```json
{ "token": "<AGENT_TOKEN>" }
```

Respuesta exitosa:

```json
{ "ok": true, "active": true, "session": {} }
```

### Configuracion publica del widget

```http
GET /api/pulseforms/widget-config?campaign=elena
```

Devuelve solo datos no sensibles de Sugar: URL base, version API, modulos y origen permitido de eventos.

### Workitem

```http
GET /api/workitem?campaign=elena&workitemid=<CALL_ID>
```

El frontend usa la respuesta para precargar:

- `ncc_call_id_c`
- `ncc_agent_c`
- `contact_phone`
- `ai_transcript_c`

### Lookup de contacto

```http
GET /api/pulseforms/widget-contact?campaign=elena&phone=<PHONE>
```

Busca en Sugar por `phone_work` y variantes:

- valor original
- solo digitos
- `+<digitos>`
- `+1<digitos>` si aplica a 10 digitos

### Busqueda de Accounts

```http
GET /api/pulseforms/widget-accounts?campaign=elena&q=<QUERY>
```

Requiere minimo 2 caracteres. Busca en `Accounts` por prefijo de `name` y devuelve hasta 10 registros.

### Crear contacto

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

### Crear workflow en Sugar

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

Aunque el endpoint conserva el nombre historico `widget-opportunity`, para Elena ejecuta el workflow Sugar actual:

1. Crea o reutiliza `Contacts`.
2. Crea o recupera `tic_Tickets` por llamada.
3. Crea `NA_NeedsAssessment`.
4. Intenta relacionar Contacto-Ticket y Ticket-Needs Assessment.
5. Guarda IDs en `staging_widget_state`.

### Actualizar ticket al finalizar llamada

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

El widget lo ejecuta en evento `call_ended` si ya existe `ticketId`.

## 6. Estado y consumo por produccion

El widget guarda IDs con `POST /api/widget-state`:

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

El documento se guarda con ID normalizado:

```text
<campaign>_<callId>
```

Caracteres fuera de `[A-Za-z0-9_.-]` se reemplazan por `_`.

Produccion lee con:

```http
GET /api/widget-state?campaign=elena&callId=<CALL_ID>&consume=1
Authorization: Bearer <WIDGET_STATE_READ_TOKEN>
```

Tambien se acepta el token en:

- `Authorization: Bearer <token>`
- `x-widget-state-token: <token>`
- `x-pulseforms-token: <token>`

Si `consume=1` o `consume=true`, el backend elimina:

- Registro en `staging_widget_state`.
- Borrador asociado en `staging_widget_draft`.

Errores relevantes:

| HTTP | Causa |
| --- | --- |
| 400 | Falta `campaign`, `callId` o body invalido. |
| 401 | Token de lectura invalido. |
| 403 | La campana no tiene token de lectura configurado. |
| 404 | Estado no existe o ya fue consumido. |
| 405 | Metodo no permitido. |

## 7. Borradores

El widget autosalva cada cambio del formulario con debounce de 800 ms:

```http
POST /api/widget-draft?campaign=elena&callId=<CALL_ID>
```

Guarda:

- `values`: valores del formulario.
- `currentTab`: tab activa.
- timestamps.

Al abrir de nuevo el mismo `callId`, intenta restaurar el borrador. En `pagehide` usa `navigator.sendBeacon` si esta disponible.

## 8. Eventos NCC soportados

El adaptador acepta estos eventos `postMessage`:

- `call_started`
- `ncc:call_started`
- `nextiva:call_started`
- `workitem:started`
- `call_ended`
- `ncc:call_ended`
- `nextiva:call_ended`
- `workitem:ended`

Payload normalizado:

| Campo normalizado | Aliases |
| --- | --- |
| `callId` | `callId`, `call_id`, `id`, `workitemId`, `workitem_id` |
| `agentName` | `agentName`, `agent`, `agent_name`, `userName`, `username` |
| `queueName` | `queueName`, `queue`, `queue_name` |
| `ani` | `ani`, `callerId`, `caller_id`, `from`, `phone`, `phoneNumber` |
| `workitemId` | `workitemId`, `workitem_id`, `workitemid`, `callId`, `call_id`, `id` |
| `duration` | `duration`, `callDuration`, `call_duration` |
| `transcript` | `transcript`, `aiTranscript`, `ai_transcript` |

## 9. Seguridad

- El formulario no se renderiza si no hay `agentToken` valido.
- El `agentToken` se valida server-side contra Thrio.
- Las credenciales de Sugar no se exponen al navegador.
- El frontend solo recibe configuracion publica de Sugar.
- La lectura de IDs por produccion requiere `pulseformsWidgetStateReadToken`.
- La comparacion del token de lectura usa comparacion segura por tiempo constante.
- Los secretos se almacenan cifrados en Firestore.

Riesgo pendiente:

- `NCC_EVENT_ORIGIN` esta configurado como `*`. Si el widget se usa embebido solo desde Thrio, se recomienda configurar el origin exacto permitido para reducir superficie de mensajes `postMessage`.

## 10. Checklist tecnico de entrega a produccion

- Confirmar si la URL final seguira apuntando a `nextiq-staging` o si debe moverse a funcion/hosting de produccion.
- Configurar la URL exacta en Thrio con `campaign=elena`, `callId` y `agentToken`.
- Entregar `WIDGET_STATE_READ_TOKEN` a produccion por canal seguro.
- Validar que el usuario Sugar configurado tenga permisos para:
  - leer `Contacts`
  - leer `Accounts`
  - crear `Contacts`
  - crear/leer `tic_Tickets`
  - crear `NA_NeedsAssessment`
  - crear relaciones entre los modulos
- Validar que `https://devcrm.elliott-tool.com/rest/v11_1/oauth2/token` responde para las credenciales configuradas.
- Ejecutar una llamada de prueba con `callId` real.
- Confirmar creacion de Ticket y Needs Assessment en Sugar.
- Confirmar que `/api/widget-state?consume=1` devuelve IDs y luego queda consumido.
- Revisar logs de Cloud Functions ante cualquier `Push failed`, `Lookup failed` o advertencia de relacion.

## 11. Prueba tecnica sugerida

1. Abrir widget desde Thrio con agente logueado.
2. Verificar respuesta 200 de `/api/pulseforms/agent-session`.
3. Verificar respuesta 200 de `/api/pulseforms/widget-config?campaign=elena`.
4. Verificar respuesta 200 de `/api/workitem?campaign=elena&workitemid=<CALL_ID>`.
5. Buscar Account con 2 o mas caracteres.
6. Crear o seleccionar Contact.
7. Enviar formulario.
8. Guardar `ticketId` y `needsAssessmentId` mostrados por el widget.
9. Consumir estado:

```bash
curl -s \
  "https://us-central1-voicebot-451222.cloudfunctions.net/nextiq-staging/api/widget-state?campaign=elena&callId=<CALL_ID>&consume=1" \
  -H "Authorization: Bearer <WIDGET_STATE_READ_TOKEN>"
```

10. Repetir el mismo curl y confirmar 404 para validar consumo unico.
