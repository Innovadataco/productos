# Contrato API — POST /api/reportes (modificado por SPEC-323)

**Fecha**: 2026-08-30

---

## Caso A: 1.er reporte (sin cambio en comportamiento)

```
POST /api/reportes
Authorization: Bearer <token>
Content-Type: application/json

{
  "identificador": "XXX01",
  "plataformaId": "<uuid>",
  "texto": "...",
  "fechaIncidente": "2026-08-01",
  "ciudad": "Medellín",
  "pais": "Colombia"
}
```

**Respuesta exitosa**:
```json
// HTTP 201
{ "reporte": { "id": "<uuid>", "numeroSeguimiento": "...", ... } }
```

---

## Caso B: 2.º reporte con mismo identificador (oferta — NUEVO)

**Situación**: El padre ya tiene un reporte dentro de la ventana de 30 días para el mismo `identificador`.

**Request** (idéntico al caso A):
```json
{
  "identificador": "XXX01",
  "plataformaId": "<uuid>",
  "texto": "...",
  "fechaIncidente": "2026-08-20",
  "ciudad": "Bogotá",
  "pais": "Colombia"
}
```

**Respuesta NUEVA** (antes era HTTP 429):
```json
// HTTP 200
{
  "oferta": true,
  "reporteExistenteId": "<uuid-del-reporte-1>",
  "identificador": "XXX01"
}
```

**Nota**: Aplica SOLO si el usuario tiene rol PARENT. Anónimos y otros roles continúan siendo bloqueados.

---

## Caso C: Aceptar la oferta — vinculación intencional (NUEVO)

**Situación**: El padre acepta la oferta y envía el 2.º reporte con `reportePrevioId`.

**Request**:
```json
{
  "identificador": "XXX01",
  "plataformaId": "<uuid>",
  "texto": "En esta ocasión el incidente fue...",
  "fechaIncidente": "2026-08-20",
  "ciudad": "Bogotá",
  "pais": "Colombia",
  "reportePrevioId": "<uuid-del-reporte-1>"   // ← nuevo campo
}
```

**Schema Zod** (adición):
```typescript
reportePrevioId: z.string().uuid().optional()
```

**Guard del servicio**:
- Detección de duplicado: se ejecuta normalmente (`tomarLockDedup` + `findDuplicadoReciente`)
- Si `existente !== null` Y `input.reportePrevioId === existente.id` Y `existente.usuarioId === usuarioId`:
  → bypass de la devolución de oferta
  → crear Reporte #2, crear/buscar Expediente, agregar eventos
- Si `existente !== null` Y `input.reportePrevioId !== existente.id`:
  → `{oferta: true, reporteExistenteId: existente.id}` (oferta actualizada)

**Respuesta exitosa** (NUEVA):
```json
// HTTP 201
{
  "reporte": {
    "id": "<uuid-reporte-2>",
    "numeroSeguimiento": "...",
    ...
  },
  "expediente": {
    "id": "<uuid-expediente>",
    "identificadorReportado": "XXX01",
    "numEventos": 2,
    "estado": "ACTIVO"
  }
}
```

---

## Regresión: anónimos y no-PARENT

Sin cambio. El bloque `if (usuarioId)` en `reporte-creation.ts:77` ya aísla la lógica de dedup para usuarios autenticados. El anónimo nunca llega al dedup y nunca ve la oferta.
