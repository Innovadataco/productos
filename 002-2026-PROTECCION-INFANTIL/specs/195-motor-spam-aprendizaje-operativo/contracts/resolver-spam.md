# Contract: POST /api/admin/reportes/[id]/resolver-spam

## Endpoint

```
POST /api/admin/reportes/[id]/resolver-spam
```

## Auth

- Cookie JWT (`token`).
- Módulo `revision_spam` requerido.
- Rol `ADMIN` o `OPERADOR` asignado al reporte.
- Rate-limit `admin_write`.

## Request

### Params

- `id`: CUID del reporte.

### Body

```ts
{
    decision: "es_spam" | "corregir" | "procesar_como_acoso";
    categoria?: string;          // requerido cuando decision === "corregir"
    motivo?: string;             // máx 2000 chars
    notificarDenunciante?: boolean; // default true para "es_spam"
}
```

## Response

### 200 OK — es_spam

```json
{
    "reporteId": "...",
    "estado": "DADO_DE_BAJA",
    "motivoBaja": "RETIRO_LIMPIEZA",
    "datasetRegistrado": true,
    "notificacionEnviada": false
}
```

### 200 OK — corregir

```json
{
    "reporteId": "...",
    "estado": "CLASIFICADO",
    "categoria": "SOLICITUD_MATERIAL",
    "correccionRegistrada": true
}
```

### 200 OK — procesar_como_acoso

```json
{
    "reporteId": "...",
    "estado": "CLASIFICADO",
    "categoria": "OFRECIMIENTO_REGALOS",
    "procesadoComoAcoso": true
}
```

### Errores

- `400` — body inválido, falta `categoria` en corrección, o reporte no está en `POSIBLE_SPAM` / `REVISION_MANUAL` con SPAM.
- `401` — no autenticado.
- `403` — sin módulo o no es el operador asignado.
- `404` — reporte no encontrado.
- `409` — reporte ya dado de baja.
- `429` — rate limit.
- `500` — error interno.

## Side effects

- `AuditLog` con acción canónica.
- Transición de estado.
- `DatasetEntrenamiento` + `EmbeddingDataset` en `es_spam` y `corregir`.
- Notificación email en `es_spam` si `usuarioId` existe y está habilitado.
- Actualización de visibilidad/score si pasa a `CLASIFICADO`.
