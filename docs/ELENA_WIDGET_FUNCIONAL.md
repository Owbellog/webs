# Documentacion funcional - Widget NCC / Sugar CRM Elena

## 1. Objetivo

El widget de Elena permite que el agente de NCC atienda una llamada, identifique el contacto en Sugar CRM, capture la informacion del proyecto y genere en Sugar los registros operativos necesarios para dar seguimiento al caso.

URL de uso:

```text
https://us-central1-voicebot-451222.cloudfunctions.net/nextiq-staging/widget/index-agent-token.html?campaign=elena&callId=${workitemInformation.workitemId}&agentToken=${window.thrio.sessionService.getHndlbarToken()}
```

## 2. Usuarios

- Agente de NCC: usa el formulario durante la llamada.
- Equipo de produccion: instala el widget en Thrio/NCC y valida el flujo operativo.
- Equipo CRM/Sugar: recibe y gestiona Contactos, Tickets y Needs Assessments creados desde el widget.

## 3. Alcance funcional

El widget cubre este flujo:

1. Valida la sesion del agente con el `agentToken` de Thrio antes de mostrar el formulario.
2. Recibe el `callId`/`workitemId` desde Thrio.
3. Carga detalles de la llamada desde la API de workitems.
4. Busca el contacto en Sugar CRM usando el telefono.
5. Si el contacto existe, precarga sus datos y los deja protegidos.
6. Si el contacto no existe, permite crear un contacto nuevo.
7. Permite buscar y seleccionar la cuenta/compania en Sugar.
8. Captura la informacion del proyecto y de la evaluacion.
9. Crea el flujo en Sugar: Contacto si aplica, Ticket y Needs Assessment.
10. Guarda los IDs resultantes para que NCC/produccion pueda consumirlos por `callId`.
11. Guarda borrador por llamada mientras el agente completa el formulario.

## 4. Datos esperados desde Thrio/NCC

La URL debe enviar:

| Parametro | Requerido | Descripcion |
| --- | --- | --- |
| `campaign=elena` | Si | Identifica la configuracion del widget. |
| `callId` | Si | Debe corresponder al `workitemInformation.workitemId`. Tambien se aceptan `workitemid`, `workitemId`, `callid`. |
| `agentToken` | Si | Token de sesion Thrio obtenido con `window.thrio.sessionService.getHndlbarToken()`. |

La integracion tambien puede enviar eventos `postMessage` o eventos del navegador para iniciar/finalizar llamada, pero para el caso de produccion propuesto la URL ya entrega el `callId`.

## 5. Pantallas y campos principales

### Paso 1 - Project type, compania y contacto

El agente selecciona el tipo de proyecto:

- Tube Tool
- Metal Finish
- Pipe Rattling

Tambien captura o valida:

- Company / Account
- Direccion de facturacion
- PO / Job #
- Budget
- Budgetary quote
- Rental
- Preferred shipping method
- Credit terms
- Latest delivery date
- Still satisfied

El bloque de contacto muestra:

- Name
- Title
- Marketing Title
- Lead Source
- Phone type
- Phone
- Email

Si Sugar devuelve mas de un contacto, el agente puede seleccionar el contacto correcto.

### Paso 2 - Evaluacion

Segun el tipo de proyecto seleccionado se carga la encuesta correspondiente:

- Tube Tool: evaluacion de vessel, tube, herramientas y detalles del trabajo.
- Pipe Rattling: evaluacion especifica de pipe rattling.
- Metal Finish: actualmente aparece como pendiente de definicion.

### Paso 3 - Job details

El agente completa detalles adicionales del trabajo y envia el formulario a Sugar.

## 6. Comportamiento de contacto

Cuando entra la llamada:

1. El widget toma el telefono desde la API de workitem o desde la URL/evento.
2. Busca en Sugar CRM dentro del modulo `Contacts`.
3. Campo de busqueda configurado: `phone_work`.
4. Tambien se consideran variantes del telefono, incluyendo digitos limpios y formato con prefijo `+`.

Si no hay contacto:

1. El widget habilita los campos requeridos para crearlo.
2. Para crear el contacto se requiere:
   - Name
   - Account seleccionado desde busqueda
   - Marketing Title
   - Lead Source
3. Al crearlo, el ID queda guardado en el estado de llamada.

## 7. Resultado esperado en Sugar CRM

Al enviar el formulario, el backend crea o reutiliza:

| Registro | Modulo Sugar configurado |
| --- | --- |
| Contacto | `Contacts` |
| Ticket | `tic_Tickets` |
| Needs Assessment | `NA_NeedsAssessment` |

El widget intenta relacionar:

- Ticket con Contacto.
- Ticket con Needs Assessment.

Si Sugar crea los registros pero falla alguna relacion, el widget muestra una advertencia operativa; los IDs creados quedan disponibles igualmente.

## 8. Comportamiento dinamico de campos y flujo

### Carga inicial

Al abrir el widget, el formulario no se muestra hasta que el `agentToken` queda validado. Si el token es correcto, el agente entra al paso principal. En este estado inicial solo esta disponible el primer paso; las secciones de evaluacion y detalles se habilitan despues de seleccionar `Project type`.

### Project type

El campo `Project type` controla que pasos y secciones aparecen:

| Seleccion | Que aparece | Que desaparece o se deshabilita | Boton final |
| --- | --- | --- | --- |
| Sin seleccion | Solo el paso principal. | Oculta Tube assessment, Metal Finish, Pipe Rattling y Job details. | No disponible. |
| `Tube Tool` | Muestra `Tube assessment`, mantiene visible `Job type` y habilita `Job details`. | Oculta Metal Finish y Pipe Rattling. | El envio a Sugar queda en el paso 3. |
| `Metal Finish` | Muestra la seccion `Metal finish`. | Oculta `Job type` y `Job details`. | El boton `Push to Sugar CRM` aparece en el paso 2. |
| `Pipe Rattling` | Muestra la seccion `Pipe rattling`. | Oculta `Job type` y `Job details`. | El boton `Push to Sugar CRM` aparece en el paso 2. |

Cada vez que cambia `Project type`, el widget vuelve al paso 1, actualiza el texto del tab de evaluacion y deshabilita los campos de las secciones que quedan ocultas para que no se envien valores fuera del flujo seleccionado.

### Job type para Tube Tool

`Job type` solo aparece cuando `Project type = Tube Tool`. Es una seleccion multiple; cada opcion activa una seccion adicional en `Job details`:

| Opcion marcada | Seccion que aparece |
| --- | --- |
| `Clean` | `Tube cleaning` |
| `Test` | `Tube testing` |
| `Plug` | `Tube plugging` |
| `Remove` | `Tube removal` |
| `Install` | `Tube installation` |

Si el agente desmarca una opcion, la seccion correspondiente se oculta. Las otras secciones seleccionadas permanecen visibles, por lo que se permiten trabajos hibridos, por ejemplo `Clean + Test + Plug`.

### Tube removal - Pulling subtype

Dentro de `Tube removal`, el bloque `Tube pulling` tiene el campo `Sub-type selector`. Solo se muestra el bloque de accesorios del subtipo seleccionado:

| Subtipo seleccionado | Accesorios visibles |
| --- | --- |
| `Collet Puller` | Collet Set, Draw Bar, Nose Piece, Counter Balance, Pump. |
| `Super Collet Puller` | Collet Set, Draw Bar, Nose Piece, Counter Balance, Pump, Tie Rod. |
| `Manual Tube Puller` | Spears Nose Piece, Stub Tugger option, Spears, Horseshoe Lock, Spear Adapter, Counter Balance, Pump. |
| `Cyclgrip` | Counter Balance, Pump. |
| `Stub Tugger` | Spears, Collet Set, Counter Balance, Nose Piece, Pump. |
| `Tube Tugger` | Spears, Collet Set, Counter Balance, Nose Piece, Pump. |

Al cambiar de subtipo, el widget oculta los accesorios del subtipo anterior y muestra solo los del nuevo.

### Tube installation - Handhole seat grinder

Dentro de `Tube installation`, el campo `Handhole seat grinder` controla `Seat grinder width`:

| Seleccion | Comportamiento |
| --- | --- |
| `Yes` | Aparece el campo `Seat grinder width`. |
| `No` | Se oculta `Seat grinder width`. |

### Contacto encontrado vs contacto nuevo

El comportamiento del bloque de contacto depende del resultado de Sugar:

| Resultado de busqueda | Comportamiento de campos |
| --- | --- |
| Contacto encontrado | `Name`, `Title`, `Phone` y `Email` quedan prellenados y en solo lectura. `Marketing Title`, `Lead Source` y `Phone type` quedan deshabilitados. El boton `Create in Sugar` se oculta. |
| Varios contactos encontrados | Ademas de lo anterior, aparece `Select contact` para escoger el contacto correcto. |
| Contacto no encontrado | El widget habilita la captura para crear contacto nuevo y muestra `Create in Sugar`. |

Para crear un contacto nuevo, el agente debe completar `Name`, seleccionar una `Account` desde la busqueda, `Marketing Title` y `Lead Source`.

### Account / Company

El campo `Company` permite busqueda en Sugar Accounts:

1. El agente escribe al menos 2 caracteres.
2. Pulsa `Search`.
3. Si Sugar devuelve cuentas, aparece `Select Account`.
4. Al seleccionar una cuenta, se rellenan `Company`, `Street`, `City`, `State`, `Country` y `Zip`.
5. Si el agente modifica manualmente `Company`, se limpia el `account_id` seleccionado y debe buscar/seleccionar de nuevo para crear contacto.

### Navegacion y envio

El indicador de progreso se recalcula segun los pasos visibles:

- Tube Tool usa tres pasos: principal, evaluacion y detalles.
- Metal Finish y Pipe Rattling usan dos pasos: principal y evaluacion/envio.
- Si no hay `Project type`, solo queda disponible el paso principal.

El boton `Push to Sugar CRM` aparece en el ultimo paso funcional del flujo seleccionado. Al enviar, el widget construye el payload con los campos visibles, valores prellenados, datos de llamada y campos guardados en borrador.

### Borrador y restauracion

Cuando existe `campaign` y `callId`, cada cambio del formulario se guarda como borrador. Si el agente cierra y vuelve a abrir el mismo `callId`, el widget restaura valores y tab activo. Al restaurar, tambien vuelve a aplicar las reglas dinamicas: `Project type`, `Job type` y secciones condicionales se muestran segun los valores recuperados.

## 9. IDs disponibles para produccion

Despues del envio exitoso, el widget guarda por `campaign + callId`:

- `contactId`
- `ticketId`
- `needsAssessmentId`

Produccion puede leerlos con:

```http
GET https://us-central1-voicebot-451222.cloudfunctions.net/nextiq-staging/api/widget-state?campaign=elena&callId=<CALL_ID>&consume=1
Authorization: Bearer <WIDGET_STATE_READ_TOKEN>
```

Con `consume=1`, el backend devuelve los IDs y elimina el estado y el borrador de esa llamada para evitar reprocesos.

Respuesta esperada:

```json
{
  "ok": true,
  "consumed": true,
  "campaign": "elena",
  "callId": "<CALL_ID>",
  "ids": {
    "contactId": "<SUGAR_CONTACT_ID>",
    "ticketId": "<SUGAR_TICKET_ID>",
    "needsAssessmentId": "<SUGAR_NEEDS_ASSESSMENT_ID>"
  },
  "updatedAt": 1770000000000
}
```

## 10. Estados funcionales y errores visibles

| Estado | Significado | Accion recomendada |
| --- | --- | --- |
| Validating agent session | El token Thrio se esta validando. | Esperar. |
| Missing agent token | La URL no recibio `agentToken`. | Revisar template de URL en Thrio. |
| Agent session inactive | Thrio rechazo el token. | Verificar sesion del agente. |
| Workitem lookup failed | No se pudo cargar la llamada. | Validar `callId` y permisos del token servidor. |
| No contact found | Sugar no encontro contacto por telefono. | Crear contacto desde el widget. |
| Contact create failed | Sugar rechazo la creacion de contacto. | Revisar campos requeridos o conexion Sugar. |
| Push failed | Fallo la creacion del flujo en Sugar. | Revisar configuracion Sugar y logs backend. |
| Sugar workflow created | Ticket y Needs Assessment creados. | Continuar operacion normal. |

## 11. Checklist funcional para produccion

- La URL configurada en Thrio incluye `campaign=elena`.
- `callId` usa `${workitemInformation.workitemId}`.
- `agentToken` usa `${window.thrio.sessionService.getHndlbarToken()}`.
- El agente puede abrir el widget con sesion activa.
- Al recibir llamada, se muestra `Workitem loaded` o `Call active`.
- El telefono de la llamada se usa para buscar contacto.
- La busqueda de Account devuelve resultados con al menos 2 caracteres.
- Se puede crear contacto nuevo si no existe.
- Se crea Ticket en `tic_Tickets`.
- Se crea Needs Assessment en `NA_NeedsAssessment`.
- Produccion puede leer `/api/widget-state` con Bearer token.
- Al usar `consume=1`, una segunda lectura devuelve 404 porque el estado ya fue consumido.
