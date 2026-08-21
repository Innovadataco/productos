# Implementation Plan: SPEC-192 — UX del simulador anti-abuso (002-PI-086)

**Branch**: `work/002-pi-086` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/192-ux-simulador-anti-abuso/spec.md`

---

## Summary

Cerrar 6 incidencias de UX + 1 de fingerprint rate-limit del simulador anti-abuso en un solo PR: reset limpio al cambiar escenario (I-70), bypass seguro de `report_fingerprint` para simulaciones ADMIN (I-71), dropdown de plataformas reales (I-74), priorización de arrays sobre campos únicos (I-75), historial con escenario legible y nota interna (I-76), y botón Iniciar re-habilitado tras corrida (I-77). Todo con migración aditiva opcional para `nota`, sin tocar el motor ni modificar scopes de rate-limit.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, React 19 |
| **Storage** | PostgreSQL 16 — migración aditiva para `simulacion_abuso_runs.nota` |
| **Testing** | Vitest integration para endpoints; unit/componente para helpers y React |
| **Target Platform** | Web (admin) + worker Node.js `scripts/simulador-abuso.mjs` |
| **Constraints** | No tocar `src/lib/ai/**`; no modificar scopes/límites de rate-limit; RFC 5737 intacto |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | El simulador sigue generando reportes de texto |
| §1.3 Presunción de inocencia | ✅ Pass | Lenguaje descriptivo/estadístico; no veredictos |
| §1.4 Umbral parametrizable | ✅ Pass | No se modifica visibilidad pública |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma; sin cambios de stack |
| §3.5 Logs y auditoría | ✅ Pass | Se reutilizan acciones de audit existentes |
| I-22 No secretos | ✅ Pass | Ningún valor secreto en docs |
| I-49 Migraciones aditivas | ✅ Pass | Solo `ALTER TABLE ... ADD COLUMN nota VARCHAR(200)` |
| Q-3 Frontera DAL | ✅ Pass | Acceso a `SimulacionAbusoRun` por su repositorio |

---

## Estado actual (verificado en fuente)

- **UI**: `src/components/modules/AdminAntiAbusoSimulador.tsx` tiene form de nueva corrida con sub-tabs, autofill de sugerencias, polling de run y detalle visible debajo del form. El botón "Iniciar simulación" usa `disabled={enviando || !!runId}`.
- **Historial**: `src/components/modules/AdminAntiAbusoSimuladorHistorial.tsx` muestra tabla con escenario (clave técnica), estado, progreso, creada y acción.
- **Worker**: `scripts/simulador-abuso.mjs` envía POST reales a `/api/reportes` con headers `Content-Type`, `x-forwarded-for` y `user-agent`. No envía `x-simulacion`.
- **Endpoint reporte**: `src/app/api/reportes/route.ts` aplica rate-limits `report`, `report_fingerprint` y `report_identificador`. El fingerprint se calcula con `user-agent|accept-language|truncarIp(ip)`.
- **Rate-limit**: `src/lib/rate-limit.ts` define scope `report_fingerprint` con 5/hora por default.
- **Plataformas**: `src/app/api/plataformas/route.ts` devuelve plataformas activas. El form público las usa en `ReporteStepPlataforma.tsx`.
- **Schema**: `SimulacionAbusoRun` no tiene campo `nota`.

---

## Diseño por fase

### Fase 1 — Reset limpio al cambiar de escenario (I-70)

**Componente** `src/components/modules/AdminAntiAbusoSimulador.tsx`:

- En el `onChange` del `<Select>` de escenario, además de `setEscenario`, resetear:
  - `setRun(null)`
  - `setRunId(null)`
  - `setError(null)`
  - `setSugerencia(null)`
- `cargarSugerencia` ya limpia campos para "personalizado"; asegurar que para otros escenarios también resetee el error/run.

### Fase 2 — Bypass seguro de `report_fingerprint` (I-71)

**Endpoint** `src/app/api/reportes/route.ts`:

- Antes de `checkRateLimit(request, "report_fingerprint", ...)`, determinar si aplica bypass:
  - Leer header `x-simulacion`.
  - Llamar `verifyAuth()` o reutilizar `user` ya obtenido de `getUserFromToken(request)`.
  - Bypass solo si `header === "true"` y `user?.rol === "ADMIN"`.
- Si bypass aplica, omitir `checkRateLimit` para `report_fingerprint` (no incrementar, no rechazar).
- Si no aplica, comportamiento actual.

**Worker** `scripts/simulador-abuso.mjs`:

- En `enviarReporte`, añadir header `"x-simulacion": "true"`.

**Test**:

- `src/app/api/reportes/route.test.ts`: con header + ADMIN → no bloquea por fingerprint; sin header → bloquea tras 5 intentos.

### Fase 3 — Dropdown de plataformas (I-74)

**Componente** `src/components/modules/AdminAntiAbusoSimulador.tsx`:

- Reemplazar el `<Input>` de Plataforma por `<Select>`.
- Cargar `/api/plataformas` en `useEffect` al montar.
- Fallback hardcoded si la respuesta está vacía: `[{clave:"whatsapp",nombre:"WhatsApp"}, ...]`.
- El valor seleccionado sigue siendo `clave`.

### Fase 4 — Priorizar arrays sobre campos únicos (I-75)

**Componente** `src/components/modules/AdminAntiAbusoSimulador.tsx`:

- En `iniciar`:
  ```ts
  if (identificadores.trim()) body.identificadores = arraysFromInput(identificadores);
  else if (identificador.trim()) body.identificador = identificador.trim();
  
  if (ips.trim()) body.ips = arraysFromInput(ips);
  else if (ip.trim()) body.ip = ip.trim();
  ```
- Deshabilitar `identificador` cuando `identificadores.trim() !== ""` con leyenda "Se usa el array de arriba".
- Deshabilitar `ip` cuando `ips.trim() !== ""` con leyenda similar.

**Backend** `src/lib/anti-abuso/simulador.ts`:

- `identificadorParaEscenario` e `ipParaIndice` ya priorizan arrays; verificar que el `configJson` guarde solo el array cuando aplica.

### Fase 5 — Historial con escenario legible + nota (I-76)

**Migración** `prisma/migrations/20260820030000_spec_192_simulador_nota/`:

```sql
ALTER TABLE simulacion_abuso_runs ADD COLUMN nota VARCHAR(200);
```

**Schema** `prisma/schema.prisma`:

```prisma
model SimulacionAbusoRun {
  // ... campos existentes ...
  nota String? @db.VarChar(200)
  // ...
}
```

**Repositorio** `src/lib/dal/repositories/simulacion-abuso.ts`:

- `crear` acepta `nota` opcional.
- `listar` devuelve `nota`.

**Endpoint** `src/app/api/admin/anti-abuso/simular/route.ts` (POST):

- Añadir `nota` al schema Zod del body (`simularAbusoBodySchema`).
- Pasar `nota` a `crearSimulacionAbuso`.

**Componente** `AdminAntiAbusoSimuladorHistorial.tsx`:

- Primera columna: label de `ESCENARIO_OPCIONES` en vez de clave técnica.
- Añadir columna "Nota" con truncado + tooltip.

**Componente** `AdminAntiAbusoSimulador.tsx`:

- Añadir input "Nota (interna)" debajo de los campos técnicos.
- Estado `nota` incluido en `iniciar`.

### Fase 6 — Botón Iniciar re-habilitado (I-77)

**Componente** `AdminAntiAbusoSimulador.tsx`:

- Cambiar `disabled={enviando || !!runId}` a `disabled={enviando || (!!runId && !finalizada)}`.
- Asegurar que `finalizada` se calcula correctamente (`run.estado IN COMPLETADA/FALLIDA/CANCELADA`).

### Fase 7 — Tests y gate

- Tests unitarios/integration para bypass fingerprint.
- Test de componente para reset al cambiar escenario.
- Test de componente para priorización array.
- Test de API para nota persistida.
- Gate local: `tsc`, `lint --no-cache`, `test:unit`, `test:integration`, `build`.

---

## Project Structure

```text
specs/192-ux-simulador-anti-abuso/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
└── checklists/
    └── requirements.md

prisma/migrations/20260820030000_spec_192_simulador_nota/
└── migration.sql

prisma/schema.prisma
└── model SimulacionAbusoRun (+ nota String? @db.VarChar(200))

src/lib/dal/repositories/simulacion-abuso.ts
└── crear/listar aceptan y devuelven nota

src/app/api/reportes/route.ts
└── bypass condicional report_fingerprint para ADMIN + x-simulacion

src/app/api/admin/anti-abuso/simular/route.ts
└── body schema acepta nota

src/components/modules/AdminAntiAbusoSimulador.tsx
└── reset escenario, dropdown plataformas, array priority, nota, botón habilitado

src/components/modules/AdminAntiAbusoSimuladorHistorial.tsx
└── label escenario, columna nota

scripts/simulador-abuso.mjs
└── header x-simulacion: true
```

---

## Decisiones técnicas propuestas

1. **Bypass solo en endpoint público**: el worker habla con `/api/reportes`; por eso el bypass vive allí y no en una ruta de admin.
2. **Validación ADMIN doble**: se usa `getUserFromToken(request)` (ya llamado en el endpoint) y se verifica `rol === "ADMIN"`. El header solo funciona con sesión ADMIN.
3. **Migración aditiva `nota`**: aunque el brief la marca opcional, se implementa para cerrar I-76 completamente. Es un campo seguro (texto libre interno, sin PII forzada).
4. **No se modifica `rate-limit.ts`**: el bypass se implementa en `src/app/api/reportes/route.ts` omitiendo la llamada a `checkRateLimit`, no cambiando la librería.
5. **Fallback de plataformas hardcoded**: garantiza UX funcional aunque el seed no haya corrido o la BD esté vacía.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Exponer bypass fingerprint al público | Verificación estricta de sesión ADMIN en `POST /api/reportes` |
| Cambios en `POST /api/reportes` afecten reportes reales | Bypass condicional; caminos de reporte real intactos |
| Nota vacía en corridas antiguas | Columna opcional; historial maneja null |
| Dropdown plataformas vacío | Fallback hardcoded de 4 opciones comunes |
| Array vacío + campo único vacío | Validación Zod existente + hint visual |
