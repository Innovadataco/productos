# Quickstart — Validación de SPEC-323

**Fecha**: 2026-08-30

Este documento describe cómo ejercer el flujo completo de la SPEC-323 para producir la evidencia §6 que requiere el instructivo.

---

## Prerrequisitos

- Servidor Next.js corriendo localmente (`npm run dev`)
- BD PostgreSQL accesible (la misma que usa el dev server)
- Cuenta de padre (PARENT) ya registrada
- Herramienta de prueba HTTP (curl / Postman / cliente de pruebas)
- **NO** se usan las credenciales de Calidad (`~/.config/pi-e2e/.env.e2e`)

---

## Recorrido de evidencia §6

### Paso 1 — 1.er reporte

```bash
POST /api/reportes
Body: { identificador: "XXX01", plataformaId: "...", texto: "Primer evento", ... }
```

**Verificar**:
- HTTP 201
- `reporte.id` guardado como `REPORTE_1_ID`
- BD: `SELECT * FROM "Reporte" WHERE id = '<REPORTE_1_ID>'` → existe

### Paso 2 — 2.º intento del mismo identificador (oferta)

```bash
POST /api/reportes
Body: { identificador: "XXX01", plataformaId: "...", texto: "Segundo evento", ... }
# Sin reportePrevioId
```

**Verificar**:
- HTTP 200 (NO 429)
- Body: `{ oferta: true, reporteExistenteId: "<REPORTE_1_ID>", identificador: "XXX01" }`
- BD: Nada nuevo creado en `Expediente`

### Paso 3 — Aceptar la oferta (vinculación)

```bash
POST /api/reportes
Body: {
  identificador: "XXX01",
  plataformaId: "...",
  texto: "Segundo evento detallado",
  fechaIncidente: "...",
  ciudad: "Bogotá",
  pais: "Colombia",
  reportePrevioId: "<REPORTE_1_ID>"
}
```

**Verificar**:
- HTTP 201
- Body: `{ reporte: { id: <REPORTE_2_ID> }, expediente: { id: <EXPEDIENTE_ID>, numEventos: 2 } }`
- BD:
  ```sql
  SELECT * FROM "Expediente" WHERE id = '<EXPEDIENTE_ID>';
  -- → estado: ACTIVO, numEventos: 2
  
  SELECT * FROM "EventoExpediente" WHERE "expedienteId" = '<EXPEDIENTE_ID>' ORDER BY "ordenSecuencial";
  -- → 2 filas: evento #1 (texto="", reporteId=REPORTE_1_ID), evento #2 (reporteId=REPORTE_2_ID)
  ```

### Paso 4 — Vista del expediente

```bash
GET /api/padre/expedientes/<EXPEDIENTE_ID>
Authorization: Bearer <token-padre>
```

**Verificar**:
- HTTP 200
- `eventosPropios` tiene 2 elementos con fecha Colombia
- Evento #1: `texto: ""`, pero con ciudad/país/clasificación del Reporte #1
- Evento #2: `texto: "Segundo evento detallado"`, con ciudad/país/clasificación del Reporte #2
- Si existe un Reporte de otro padre para "XXX01": aparece en `contextoOtros` sin campo `texto` ni identificador del autor

### Paso 4b — Verificar Ley 1581 en payload

Inspeccionar el JSON completo de `contextoOtros`. Confirmar que ningún objeto contiene:
- `texto`
- `textoOriginal`
- `usuarioId`
- `email` o `nombre`

### Paso 5 — PDF del expediente

```bash
GET /api/padre/expedientes/<EXPEDIENTE_ID>/pdf
Authorization: Bearer <token-padre>
```

**Verificar**:
- HTTP 200
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="expediente-XXX01-...pdf"`
- Abrir el PDF: debe contener carátula + 2 eventos propios + contexto de otros (solo 4 campos)

---

## Regresión crítica

### Anónimo: sin cambio

```bash
POST /api/reportes
# Sin Authorization header
Body: { identificador: "XXX01", ... }
```

- 1.er POST: HTTP 201
- 2.º POST mismo identificador: comportamiento anterior (NO se ofrece vinculación)

### Tests automáticos (candado 24 v2)

```bash
# Desde el directorio del proyecto
npx vitest run src/lib/dal/services/reporte-creation.test.ts
npx vitest run src/lib/dal/repositories/expediente-repository.test.ts
npx vitest run src/app/api/reportes/route.test.ts

# E2E (si entorno disponible)
npx playwright test tests/e2e/reportes.spec.ts
```

Los tests de `reportes.spec.ts:81-107` deben pasar con la aserción fuerte del nuevo comportamiento (200 + `oferta: true`) en lugar del 429 anterior.
