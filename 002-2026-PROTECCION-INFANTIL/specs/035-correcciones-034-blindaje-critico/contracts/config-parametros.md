# Contract: Configuración — PATCH /api/config/parametros/:clave

**Base Path**: `/api/config/parametros/:clave`

## Cambios introducidos en Spec 035

El endpoint de PATCH pasa a soportar **upsert**:
- Si el parámetro existe, se actualiza (`valor`, `actualizadoPorId`).
- Si el parámetro no existe, se crea con los metadatos proporcionados o con los defaults conocidos.

## Request Body

```json
{
  "valor": "string (requerido)",
  "motivo": "string (opcional)",
  "tipo": "STRING | INTEGER | FLOAT | BOOLEAN | JSON | STRING_ARRAY (opcional, requerido para crear)",
  "categoria": "VISIBILITY | SECURITY | LEGAL | EMAIL | SYSTEM (opcional, requerido para crear)",
  "esPublico": "boolean (opcional)",
  "esSecreto": "boolean (opcional)",
  "descripcion": "string (opcional)"
}
```

## Comportamiento

- Para parámetros conocidos (ej. `ui.grupos_categoria`), el sistema usa los metadatos por defecto si no se envían.
- Para parámetros desconocidos, `tipo` y `categoria` son obligatorios para la creación.
- Si `clave` es `system.ollama_base_url`, el valor se valida para que solo sea URL local/privada (R2).
- Se registra un `auditLog` de tipo `PARAM_UPDATE` tanto en creación como en actualización.

## Response 200

```json
{
  "id": "string",
  "clave": "string",
  "valor": "string | null",
  "tipo": "STRING",
  "categoria": "SYSTEM",
  "esPublico": true,
  "esSecreto": false,
  "descripcion": "string",
  "actualizadoPorId": "string",
  "creadoEn": "ISO string",
  "actualizadoEn": "ISO string"
}
```

## Response 400

- Valor requerido.
- URL de Ollama no local/privada para `system.ollama_base_url`.
- Tipo/categoría faltantes para crear parámetro desconocido.

## Response 404

- Parámetro no encontrado y sin metadatos para crearlo.

## Response 403

- Usuario no autenticado o sin rol ADMIN.
