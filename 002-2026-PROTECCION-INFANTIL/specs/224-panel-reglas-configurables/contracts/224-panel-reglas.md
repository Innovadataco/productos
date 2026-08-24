# Contratos de API — SPEC-224

## Autenticación y permisos (todos los endpoints)

- Cookie `token` con JWT válido (`verifyAuth("ADMIN")`).
- Permiso de módulo `analisis_admin` (`assertModulo`) → `403` si falta.
- Rate limit: `admin_read` en GET, `admin_write` en POST/PATCH → `429` con headers estándar.
- Errores con formato del proyecto: `{ "error": { "message", "code", "details?" } }` vía `errorToResponse`.
- Sin sesión → `401`. Sin rol `ADMIN` o sin permiso → `403`.

## GET /api/admin/analisis/reglas

Query: `page` (default 1), `pageSize` (default 25, máx 100), `activa` (`true|false`, opcional), `q` (busca en nombre/clave, opcional).

### Response 200

```json
{
  "items": [
    {
      "id": "cuid",
      "clave": "vencimiento.T_menos_7",
      "nombre": "Llamar a clientes que vencen esta semana",
      "categoria": "renovacion",
      "modo": "RECOMIENDA",
      "frecuenciaMin": 60,
      "prioridad": 80,
      "activa": true,
      "version": 3,
      "recomendacionesGeneradas7d": 12
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 7, "totalPages": 1 }
}
```

## POST /api/admin/analisis/reglas

### Request

```json
{
  "clave": "test.vencimientos_7d",
  "nombre": "Vencimientos en 7 días",
  "descripcion": "Suscripciones activas que vencen en la próxima semana",
  "categoria": "renovacion",
  "sqlQuery": "SELECT s.id AS \"suscripcionId\", s.\"fechaFin\" FROM \"suscripciones\" s WHERE s.estado = 'ACTIVA'",
  "plantillaRecomendacion": "Llama a {{colegio}} · vence {{fechaFin}}",
  "prioridad": 80,
  "frecuenciaMin": 60,
  "umbralMinimo": null,
  "accionEjecutable": null,
  "accionParametros": null
}
```

Validaciones Zod: `clave` (`^[a-z][a-z0-9_.-]{2,80}$`), `nombre` (3..150), `sqlQuery` (1..10000 + validador estático FR-006), `plantillaRecomendacion` (1..2000), `prioridad` (int 0..100, default 50), `frecuenciaMin` (int 5..10080, default 60), `accionEjecutable` (enum `crear_bono_retencion | enviar_notificacion | asignar_a_operador | crear_alerta_admin`, opcional).

### Response 201

Regla creada con `modo: "RECOMIENDA"` (toda regla nace en RECOMIENDA, D-77), `activa: true`, `version: 1`.

### Response 409

`clave` ya existe: `{ "error": { "message": "Ya existe una regla con esa clave", "code": "CONFLICT" } }`

## GET /api/admin/analisis/reglas/[id]

### Response 200

Regla completa (incluye `sqlQuery`, `plantillaRecomendacion`, `accionEjecutable`, `accionParametros`, `umbralMinimo`) + `recomendacionesGeneradas7d`. `404` si no existe.

## PATCH /api/admin/analisis/reglas/[id]

### Request

```json
{
  "prioridad": 90,
  "umbralMinimo": 5,
  "activa": true,
  "motivo": "subo umbral por ruido en la primera semana"
}
```

- Campos editables: `nombre`, `descripcion`, `categoria`, `sqlQuery`, `plantillaRecomendacion`, `accionEjecutable`, `accionParametros`, `prioridad`, `umbralMinimo`, `frecuenciaMin`, `activa`.
- `motivo` (trim, 10..500) **obligatorio** en toda edición.
- `modo` **no editable** aquí → `400` (usar `/modo`). `clave` distinta → `400`.
- Si viene `sqlQuery`, validador estático en servidor antes de persistir.

### Response 200

Regla actualizada con `version` incrementada. El estado anterior quedó en `ReglaRecomendacionHistorial` (misma TX).

## POST /api/admin/analisis/reglas/test-sql

### Request

```json
{
  "sqlQuery": "SELECT s.id AS \"suscripcionId\" FROM \"suscripciones\" s WHERE s.estado = 'ACTIVA'",
  "reglaId": "cuid-opcional-solo-contexto-audit"
}
```

### Response 200

```json
{
  "columnas": ["suscripcionId"],
  "filas": [{ "suscripcionId": "cuid" }],
  "filasMuestra": 1,
  "duracionMs": 12,
  "limitAplicado": 50,
  "timeoutMs": 5000
}
```

### Response 400

- Validador estático: `{ "error": { "message": "Solo se permiten consultas SELECT de una sola sentencia", "code": "VALIDATION_ERROR" } }`
- Error de PostgreSQL (sintaxis, tabla inexistente): mensaje truncado legible, sin stack trace.
- Timeout de `statement_timeout`: `{ "error": { "message": "La consulta excedió el tiempo máximo de prueba (5000 ms)", "code": "VALIDATION_ERROR" } }`

Auditoría: `REGLA_SQL_TEST` con metadatos `{ huellaQuery, duracionMs, filasMuestra, reglaId? }`. Nunca filas.

## POST /api/admin/analisis/reglas/[id]/modo

### Request — promoción

```json
{
  "modo": "EJECUTA",
  "confirmacion": "EJECUTA",
  "motivo": "la regla lleva 3 semanas con 90% de aplicación manual"
}
```

### Request — reversión

```json
{
  "modo": "RECOMIENDA",
  "motivo": "generó dos bonos duplicados, vuelve a revisión humana"
}
```

Validación Zod discriminada: `EJECUTA` exige `confirmacion: z.literal("EJECUTA")` + `motivo` (trim 20..500); `RECOMIENDA` exige `motivo` (trim 20..500).

### Response 200

```json
{
  "id": "cuid",
  "modo": "EJECUTA",
  "advertencia": null
}
```

`advertencia` contiene `"La regla está inactiva"` o `"Sin acción ejecutable configurada: se comporta como Recomienda"` cuando aplica.

### Response 400

Sin `confirmacion` exacta o motivo inválido. El modo no cambia.

### Response 409

La regla ya está en el modo solicitado.

Auditoría: `REGLA_PROMOVIDA_EJECUTA` / `REGLA_REVERTIDA_RECOMIENDA` con `valorAnterior`, `valorNuevo` y motivo en metadatos.

## GET /api/admin/analisis/reglas/[id]/historial

### Response 200

```json
{
  "items": [
    {
      "version": 2,
      "creadoEn": "2026-08-24T15:04:00.000000-05:00",
      "cambiadoPor": { "id": "cuid", "nombre": "Admin" },
      "motivo": "subo umbral por ruido",
      "camposCambiados": ["umbralMinimo"],
      "snapshot": { "prioridad": 80, "umbralMinimo": 3 }
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 2, "totalPages": 1 }
}
```

Orden descendente por versión. `snapshot` es el estado completo anterior (se muestra abreviado en el ejemplo). Solo lectura.
