# Contratos de API — SPEC-226

## Autenticación y permisos

- Cookie `token` con JWT válido (`verifyAuth`).
- Rol requerido: `ADMIN` en ambos endpoints.
- `assertModulo` del módulo admin de análisis (mismo permiso que el panel de reglas/recomendaciones).
- Rate-limit de admin (`checkRateLimit` con scope de escritura admin).
- Errores con códigos canónicos vía `AppError`/`errorToResponse`; nunca stack traces.

## POST /api/admin/analisis/recomendaciones/[id]/aplicar

Aplica manualmente una sugerencia `PENDIENTE`: ejecuta su acción por el mismo ejecutor de las reglas `EJECUTA` (misma trazabilidad, mismo rate-limit por regla) y marca la recomendación `APLICADA`.

### Request

Sin body (o body vacío `{}`).

### Response 200

```json
{
  "recomendacion": {
    "id": "cuid",
    "estado": "APLICADA",
    "ejecutadaAutomatica": false
  },
  "ejecucion": {
    "id": "cuid",
    "tipoAccion": "CREAR_BONO",
    "estado": "EJECUTADA",
    "origenEjecucion": "MANUAL_ADMIN",
    "resultado": { "bonoId": "cuid" }
  }
}
```

Notas:

- Si la recomendación no tiene acción ejecutable asociada (solo sugerencia de contacto, ej. "llamar"), la respuesta trae `ejecucion: null` y la recomendación queda `APLICADA`.
- `ejecutadaAutomatica` permanece `false` en aplicaciones manuales; el origen se distingue por `EjecucionAccion.origenEjecucion = MANUAL_ADMIN`.

### Response 400 — entrada inválida

```json
{ "error": { "message": "Parámetros inválidos", "code": "VALIDATION_ERROR" } }
```

### Response 401 / 403

- `401`: sin sesión válida.
- `403`: autenticado pero rol distinto de `ADMIN` o sin permiso del módulo.

### Response 404 — recomendación inexistente

```json
{ "error": { "message": "Recomendación no encontrada", "code": "NOT_FOUND" } }
```

### Response 409 — estado no aplicable

```json
{ "error": { "message": "La recomendación no está pendiente", "code": "CONFLICT" } }
```

Aplica cuando la recomendación ya está `APLICADA`, `IGNORADA` o `EXPIRADA`.

### Response 429

```json
{ "error": { "message": "Demasiadas solicitudes. Espere un momento.", "code": "RATE_LIMITED" } }
```

---

## POST /api/admin/analisis/recomendaciones/[id]/revertir

Revierte la `EjecucionAccion` en estado `EJECUTADA` asociada a la recomendación, ejecutando el rollback específico del tipo de acción.

### Request

```json
{
  "motivo": "El bono se creó con un descuento mayor al autorizado"
}
```

- `motivo`: string requerido, 5–500 caracteres (Zod).

### Response 200

```json
{
  "ejecucion": {
    "id": "cuid",
    "tipoAccion": "CREAR_BONO",
    "estado": "REVERTIDA",
    "revertidaEn": "2026-08-24T14:03:00.000000-05:00",
    "revertidaPorAdminId": "cuid",
    "motivoReversion": "El bono se creó con un descuento mayor al autorizado"
  },
  "efectoReversion": {
    "tipo": "CREAR_BONO",
    "detalle": "Bono desactivado",
    "bonoId": "cuid"
  }
}
```

Efectos por tipo (`efectoReversion.tipo`):

| Tipo | Efecto del rollback |
|------|---------------------|
| `CREAR_BONO` | `BonoPromocional.activo = false`. Si el bono ya tiene usos (`BonoAplicado`), solo se desactiva y `detalle` lo indica ("bono con usos: solo desactivado"); pagos y usos previos no se tocan. |
| `ENVIAR_NOTIFICACION` | `cancelar()` del Motor Notif sobre las programaciones futuras de la ejecución. Si ya se envió, `detalle` = "no reversible (ya enviada)" y queda registrado. |
| `ASIGNAR_OPERADOR` | Desasigna al operador y le notifica la desasignación; la recomendación vuelve a `PENDIENTE`. |
| `CREAR_ALERTA` | Marca la alerta como atendida (registro). Las alertas ya enviadas no se des-envían. |

### Response 400 — falta motivo

```json
{ "error": { "message": "El motivo de reversión es requerido", "code": "VALIDATION_ERROR" } }
```

### Response 401 / 403 / 404

Igual que en `aplicar`.

### Response 409 — nada que revertir

```json
{ "error": { "message": "No hay una ejecución revertible para esta recomendación", "code": "CONFLICT" } }
```

Aplica cuando: no existe `EjecucionAccion`, o la más reciente ya está `REVERTIDA` o `FALLIDA`.

### Response 429

Igual que en `aplicar`.

---

## Eventos de Motor Notificaciones consumidos/emitidos

Esta spec no define endpoints adicionales. Emite (vía seed + `programar()`):

| Evento | Audiencia | Plantilla |
|--------|-----------|-----------|
| `analisis.alerta.admin` | ADMIN | `es` — asunto "Alerta {{severidad}} · {{reglaClave}}", cuerpo con `{{mensaje}}` y `{{urlPanel}}` |
| `analisis.operador.asignacion` | OPERADOR | `es` — asunto "Caso asignado: {{tituloRecomendacion}}", cuerpo con `{{descripcionRecomendacion}}` y `{{urlPanel}}` |

Las reglas de disparo (canal, offset) quedan configuradas en `NotificacionRegla` por seed; el módulo no escribe en `Notificacion` directamente.
