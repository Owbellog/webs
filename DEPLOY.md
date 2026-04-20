# Flujo de despliegue — NextIQ Chat

## Ramas

| Rama | Propósito | Despliega a |
|------|-----------|-------------|
| `develop` | Trabajo diario, experimentos | — (solo local) |
| `staging` | Pruebas antes de producción | `nextiq-staging` en GCP |
| `main` | Código en producción | `nextiq-production` en GCP |

## Flujo normal

```
develop → staging → main
```

1. Trabaja en `develop`
2. Cuando está listo, haz merge a `staging` y despliega
3. Prueba en staging
4. Si todo está bien, merge a `main` y despliega a producción

## Configuración inicial (primera vez)

```bash
# Copia las plantillas y rellena los secretos
cp env/staging.yaml.example    env/staging.yaml
cp env/production.yaml.example env/production.yaml
cp env/local.env.example       .env
```

## Comandos de deploy

```bash
# Staging (desde rama staging)
npm run deploy:staging

# Producción (desde rama main)
npm run deploy:production
```

## Desarrollo local

```bash
# Con variables de entorno del .env
node -r dotenv/config server.js

# O directamente con el functions-framework
npm run start:functions
```

## Reglas

- **Nunca** commitear `env/staging.yaml`, `env/production.yaml` o `.env` — contienen secretos
- **Nunca** hacer deploy a producción directamente desde `develop`
- **Siempre** pasar por staging antes de subir a main
- Los archivos `env/*.yaml.example` sí se commitean — son plantillas sin secretos
