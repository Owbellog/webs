# NextIQ Chat

Interfaz web tipo chat para consultar el endpoint de predicciones de Thrio con soporte multi-campaña.

## Ejecutar

1. Crea `.env` desde el ejemplo:

```bash
cp .env.example .env
```

2. Configura al menos:

```env
ADMIN_PASSWORD=una-clave-fuerte
PORT=3000
```

3. Arranca el servidor:

```bash
node server.js
```

4. Abre:

```text
http://127.0.0.1:3000
```

## Administración

La administración vive en:

```text
http://127.0.0.1:3000/admin.html
```

Ahí guardas por campaña:

- `id`
- `domain`
- `apiUrl`
- `workitemApiUrl`
- `token`
- `cookie`
- `allowedKbIds`
- `titleText`
- `showTitle`
- `showMeta`
- `fontFamily`
- `baseFontSize`
- `titleSize`
- `metaSize`
- `refreshIntervalSeconds`
- `sentimentLayout`
- `sentimentCardMaxWidth`
- `sentimentCardPadding`
- `sentimentCardRadius`
- `sentimentOrbSize`
- `sentimentProvider`
- `geminiApiKey`
- `geminiModel`
- `geminiApiUrl`
- `geminiPrompt`

La información se guarda en [`campaigns.json`](/Users/oscar.bello/Documents/Code/webs/campaigns.json) cuando creas campañas desde la UI.

## Uso en producción

La URL pública puede pasar solo parámetros no sensibles:

```text
http://127.0.0.1:3000/?campaign=nextiva-es
http://127.0.0.1:3000/?campaign=nextiva-es&kb_id=69b7c1301d31ed595dfef3cb
http://127.0.0.1:3000/?domain=mancity.thrio.io&kb_ids=69b7c1301d31ed595dfef3cb,otro-kb
```

El backend resuelve internamente el token según la campaña o dominio configurado.

La vista local de documentación del SDK de Nextiva se publica en:

```text
http://127.0.0.1:3000/nextiva-sdk.html
```

## Cloud Functions

El proyecto ya puede desplegarse como HTTP Cloud Function usando [`index.js`](/Users/oscar.bello/Documents/Code/webs/index.js), que exporta `nextiq`.
En Google Cloud, las campañas se guardan en Firestore si el proyecto tiene configurado `GOOGLE_CLOUD_PROJECT` o `GCLOUD_PROJECT`.

Dependencias:

```bash
npm install
```

Despliegue base en Cloud Functions 2nd gen:

```bash
gcloud functions deploy nextiq \
  --gen2 \
  --runtime=nodejs22 \
  --region=us-central1 \
  --source=. \
  --entry-point=nextiq \
  --trigger-http \
  --allow-unauthenticated
```

Variables de entorno recomendadas:

```bash
gcloud functions deploy nextiq \
  --gen2 \
  --runtime=nodejs22 \
  --region=us-central1 \
  --source=. \
  --entry-point=nextiq \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars=ADMIN_PASSWORD=tu-clave,THRIO_AUTH_TOKEN=tu-token,THRIO_KB_ID=tu-kb,THRIO_API_URL=https://mancity.thrio.io/data/api/ai/prediction,THRIO_DOMAIN=mancity.thrio.io,FIRESTORE_PREFIX=nextiq,FIRESTORE_COLLECTION=nextiq_campaigns
```

Firestore:

1. Crea una base Firestore en el proyecto.
2. Despliega la función con permisos por defecto de la service account.
3. El panel `admin.html` guardará campañas en la colección indicada por `FIRESTORE_COLLECTION`.
4. Si quieres separar este proyecto de otros, usa el prefijo `nextiq`, por ejemplo `nextiq_campaigns`.

Fallback local:

- Fuera de Google Cloud, si Firestore no está configurado, la app sigue usando [`campaigns.json`](/Users/oscar.bello/Documents/Code/webs/campaigns.json).

## Iframe

La página puede embebirse en un `iframe`. Detecta automáticamente ese contexto y usa un layout más compacto.

Ejemplo:

```html
<iframe
  src="http://127.0.0.1:3000/?campaign=nextiva-property"
  style="width:100%;height:640px;border:0;"
></iframe>
```

También puedes forzar el modo embebido con:

```text
http://127.0.0.1:3000/?campaign=nextiva-property&embed=1
```

Y puedes sobrescribir por URL la altura embebida configurada en la campaña:

```text
http://127.0.0.1:3000/?campaign=nextiva-property&embed=1&embed_min_height=220px&embed_max_height=420px
```

Parámetros soportados:

- `embed_min_height` o `embedMinHeight`
- `embed_max_height` o `embedMaxHeight`

Cuando está embebida, la app envía al padre:

```text
window.postMessage({ type: "nextiq:resize", height }, "*")
```

para que el sitio contenedor pueda ajustar la altura del `iframe`.

## Workitems

Hay una segunda página pública para inspección de workitems:

```text
http://127.0.0.1:3000/workitem.html?campaign=nextiva-property&workitemid=459f0ada-9ec1-485d-b904-6f6dbcbf65e8
```

También soporta modo embebido:

```text
http://127.0.0.1:3000/workitem.html?campaign=nextiva-property&workitemid=459f0ada-9ec1-485d-b904-6f6dbcbf65e8&embed=1
```

Flujo:

- toma `campaign` o `domain` desde la URL
- toma `workitemid` o `workitemId` desde la URL
- resuelve internamente `token` y `cookie` desde la configuración de campaña
- llama al `workitemApiUrl`
- filtra `transcriptionMessages` con `type = CLIENT`
- calcula un sentimiento simple y lo muestra como `green`, `yellow` o `red`

## Sentiment Monitor

Hay una tercera página pública para monitor visual de sentimiento:

```text
http://127.0.0.1:3000/sentiment.html?campaign=nextiva-property&workitemid=459f0ada-9ec1-485d-b904-6f6dbcbf65e8
```

Modo embebido:

```text
http://127.0.0.1:3000/sentiment.html?campaign=nextiva-property&workitemid=459f0ada-9ec1-485d-b904-6f6dbcbf65e8&embed=1
```

La tarjeta:

- usa el mismo `/api/workitem`
- se refresca automáticamente
- toma el intervalo desde `refreshIntervalSeconds` en la campaña
- cambia la apariencia entre `green`, `yellow` y `red` según el sentimiento agregado
- puede analizar sentimiento con `heuristic` o con `gemini`

También puedes sobrescribir el intervalo por URL:

```text
http://127.0.0.1:3000/sentiment.html?campaign=nextiva-property&workitemid=...&refresh_seconds=30
```

Y también puedes adaptar el layout por URL para distintos embeds:

```text
http://127.0.0.1:3000/sentiment.html?campaign=nextiva-property&workitemid=...&sentiment_layout=wide&sentiment_card_width=100%&sentiment_card_padding=24px%2030px%2020px&sentiment_card_radius=24px&sentiment_orb_size=140px
```

Parámetros soportados:

- `sentiment_layout` o `sentimentLayout`: `centered`, `compact`, `wide`
- `sentiment_card_width` o `sentimentCardWidth`
- `sentiment_card_padding` o `sentimentCardPadding`
- `sentiment_card_radius` o `sentimentCardRadius`
- `sentiment_orb_size` o `sentimentOrbSize`

Gemini:

- en admin puedes elegir `Sentiment provider = Gemini`
- rellena `Gemini API key`
- opcionalmente ajusta `Gemini model`, `Gemini API URL` y `Gemini prompt`
- si no eliges Gemini, la app sigue usando la heurística local actual

## Questions Checklist

Hay una página pública adicional para validar un checklist de preguntas contra la conversación del workitem (`CLIENT` y `USER`):

```text
http://127.0.0.1:3000/questions.html?campaign=nextiva-property&workitemid=459f0ada-9ec1-485d-b904-6f6dbcbf65e8
```

Modo embebido:

```text
http://127.0.0.1:3000/questions.html?campaign=nextiva-property&workitemid=459f0ada-9ec1-485d-b904-6f6dbcbf65e8&embed=1
```

Flujo:

- usa el mismo `campaign` y `workitemid`
- revisa hasta 5 preguntas configuradas por campaña
- consulta Gemini para decidir si cada pregunta ya quedó respondida usando mensajes de cliente y agente
- muestra cada fila en `green` o `red`
- se refresca automáticamente con el intervalo configurado en `Questions Page`

Configuración en admin:

- `Questions Page > Questions`: 5 preguntas
- `Questions Page > Gemini`: `Gemini API key`, `Gemini model`, `Gemini API URL`, `Gemini prompt`
- `Questions Page > Structure`: título, línea informativa, alturas embebidas y `refresh interval`

## Fallback

Si no tienes `campaigns.json`, el servidor puede seguir funcionando con una sola campaña usando estas variables:

- `THRIO_AUTH_TOKEN`
- `THRIO_COOKIE`
- `THRIO_KB_ID`
- `THRIO_API_URL`
- `THRIO_DOMAIN`

## Notas

- No abras `public/index.html` con `file:///...`; usa siempre `http://127.0.0.1:3000`.
- No pongas tokens en la URL ni en el frontend.
- Si cambias `.env`, reinicia `node server.js`.
