# Contratos de API — SPEC-221

## Autenticación y permisos

- Cookie `token` con JWT válido (`verifyAuth`, `src/lib/auth.ts`).
- Rol requerido: `ADMIN`. Otros roles (o anónimo) → `401`/`403` según proxy y handler.
- Sin rate limit adicional: endpoint admin de baja frecuencia, detrás del proxy de admin.

## POST /api/admin/analisis/recomendaciones/[id]/resolver

Marca una `Recomendacion` PENDIENTE como `APLICADA` o `IGNORADA`. La transición a `EXPIRADA` es exclusiva del worker; cualquier otro estado se rechaza.

### Request

```json
{
  "estado": "APLICADA",
  "motivo": "Llamé al rector, renueva mañana"
}
```

Validación Zod:

- `estado`: `"APLICADA" | "IGNORADA"` (requerido).
- `motivo`: string, máx 500 chars (opcional).

### Response 200

```json
{
  "recomendacion": {
    "id": "cuid",
    "reglaId": "cuid",
    "titulo": "Llamar a Colegio San José · vence 2026-08-31",
    "descripcion": "La suscripción del colegio vence en 5 días...",
    "categoria": "renovacion",
    "prioridad": 90,
    "sujetoTipo": "Suscripcion",
    "sujetoId": "cuid",
    "estado": "APLICADA",
    "generadaEn": "2026-08-24T13:00:00.000Z",
    "resueltaEn": "2026-08-24T15:30:00.000Z",
    "resueltaPorAdminId": "cuid",
    "motivoResolucion": "Llamé al rector, renueva mañana",
    "expiraEn": "2026-08-31T13:00:00.000Z",
    "ejecutadaAutomatica": false
  }
}
```

Efectos colaterales: `AuditLog` con acción `RECOMENDACION_RESUELTA`, `tipoRecurso = "Recomendacion"`, metadatos `{ reglaId, categoria, estado }` (nunca `datosContexto` ni datos del sujeto).

### Response 400 — body inválido

```json
{ "error": "estado debe ser APLICADA u IGNORADA", "code": "VALIDACION" }
```

Casos: `estado` ausente, `estado = "EXPIRADA"`/`"PENDIENTE"`, `motivo` > 500 chars.

### Response 401 — sin sesión

```json
{ "error": "No autenticado", "code": "NO_AUTENTICADO" }
```

### Response 403 — rol insuficiente

```json
{ "error": "No autorizado", "code": "NO_AUTORIZADO" }
```

### Response 404 — recomendación inexistente

```json
{ "error": "Recomendación no encontrada", "code": "NO_ENCONTRADO" }
```

### Response 409 — ya resuelta o expirada

```json
{ "error": "La recomendación ya fue resuelta", "code": "CONFLICTO" }
```

Aplica cuando el estado actual es `APLICADA`, `IGNORADA` o `EXPIRADA`; el estado no cambia.

## Endpoints NO incluidos en esta spec

- Listado/detalle de recomendaciones para UI: SPEC-222 (widget top-5) y SPEC-227 (historial) definen sus `GET`.
- CRUD de reglas y promoción `RECOMIENDA → EJECUTA`: SPEC-224.
- Disparo manual de evaluación: el worker la ejecuta por cadencia; si se requiere un endpoint interno de disparo, se definirá en SPEC-224 junto al "test" del editor.
