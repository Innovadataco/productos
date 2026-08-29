# Implementation Plan: SPEC-192 — UX del simulador anti-abuso (002-PI-086)

**Branch**: `work/002-pi-086` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/192-ux-simulador-anti-abuso/spec.md`

---

## Summary

Cerrar 6 incidencias de UX + 1 de fingerprint rate-limit del simulador anti-abuso en un solo PR: reset limpio al cambiar escenario (I-70), bypass seguro de `report_fingerprint` mediante secret compartido server-only (I-71), dropdown de plataformas reales (I-74), priorización de arrays sobre campos únicos (I-75), historial con escenario legible y nota interna (I-76), y botón Iniciar re-habilitado tras corrida (I-77). Todo con migración aditiva opcional para `nota`, sin tocar el motor ni modificar scopes de rate-limit.

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
| I-22 No secretos | ✅ Pass | Ningún valor secreto en docs; solo referencia a env var |
| I-49 Migraciones aditivas | ✅ Pass | Solo `ALTER TABLE ... ADD COLUMN nota VARCHAR(200)` |
| Q-3 Frontera DAL | ✅ Pass | Acceso a `SimulacionAbusoRun` por su repositorio |

---

## Estado actual (verificado en fuente)

- **UI**: `src/components/modules/AdminAntiAbusoSimulador.tsx` tiene form de nueva corrida con sub-tabs, autofill de sugerencias, polling de run y detalle visible debajo del form. El botón "Iniciar simulación" usa `disabled={enviando || !!runId}`.
- **Historial**: `src/components/modules/AdminAntiAbusoSimuladorHistorial.tsx` muestra tabla con escenario (clave técnica), estado, progreso, creada y acción.
- **Worker**: `scripts/simulador-abuso.mjs` envía POST reales a `/api/reportes` con headers `Content-Type`, `x-forwarded-for` y `user-agent`. No envía header de simulación.
- **Endpoint reporte**: `src/app/api/reportes/route.ts` aplica rate-limits `report`, `report_fingerprint` y `report_identificador`. El fingerprint se calcula con `user-agent|accept-language|truncarIp(ip)`. Rechaza usuarios con rol distinto a PARENT con 403 antes del rate-limit.
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

### Fase 2 — Bypass seguro de `report_fingerprint` con secret compartido (I-71)

**Configuración**:

- Añadir `SIMULADOR_ABUSO_SECRET` a `.env.example` y `.env.production.example` con comentario claro.
- No añadir valor real; el CEO/deployment lo genera con `openssl rand -hex 32`.

**Helper** `src/lib/anti-abuso/simulador-secreto.ts` (nuevo):

```typescript
import { timingSafeEqual } from "crypto";

export function validarSecretoSimulacion(request: Request): boolean {
    const secret = process.env.SIMULADOR_ABUSO_SECRET;
    if (!secret) return false;
    const header = request.headers.get("x-simulacion-secret");
    if (!header) return false;
    if (header.length !== secret.length) return false;
    try {
        return timingSafeEqual(Buffer.from(header), Buffer.from(secret));
    } catch {
        return false;
    }
}
```

**Endpoint** `src/app/api/reportes/route.ts`:

- Antes de `checkRateLimit(request, "report_fingerprint", ...)`, determinar:
  ```ts
  const bypassFingerprint = validarSecretoSimulacion(request);
  ```
- Si `bypassFingerprint` es `true`, omitir `checkRateLimit` para `report_fingerprint` (no incrementar, no rechazar).
- Si es `false`, comportamiento actual.

**Worker** `scripts/simulador-abuso.mjs`:

- Al inicio, verificar `process.env.SIMULADOR_ABUSO_SECRET`. Si falta, loggear error y `process.exit(1)`.
- En `enviarReporte`, añadir header `"x-simulacion-secret": process.env.SIMULADOR_ABUSO_SECRET`.

**Tests**:

- `src/app/api/reportes/route.test.ts`: con secret correcto → no bloquea por fingerprint; sin header → bloquea tras 5 intentos; con secret incorrecto → bloquea tras 5 intentos.
- `scripts/simulador-abuso.mjs`: no arranca si falta secret (test unitario del helper o verificación manual documentada en cierre).

### Fase 3 — Dropdown de plataformas (I-74)

**Componente** `src/components/modules/AdminAntiAbusoSimulador.tsx`:

- Reemplazar el `<Input>` de Plataforma por `<Select>`.
- Cargar `/api/plataformas` en `useEffect` al montar.
- Fallback hardcoded si la respuesta está vacía: `[{clave:"whatsapp",nombre:"WhatsApp"}, {clave:"telegram",nombre:"Telegram"}, {clave:"instagram",nombre:"Instagram"}, {clave:"facebook",nombre:"Facebook"}]`.
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

- Tests unitarios/integration para bypass fingerprint con secret correcto/incorrecto/ausente.
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

.env.example
.env.production.example
└── SIMULADOR_ABUSO_SECRET=          # referenciado, sin valor

prisma/migrations/20260820030000_spec_192_simulador_nota/
└── migration.sql

prisma/schema.prisma
└── model SimulacionAbusoRun (+ nota String? @db.VarChar(200))

src/lib/anti-abuso/simulador-secreto.ts   # NUEVO: validarSecretoSimulacion

src/lib/dal/repositories/simulacion-abuso.ts
└── crear/listar aceptan y devuelven nota

src/app/api/reportes/route.ts
└── bypass condicional report_fingerprint con validarSecretoSimulacion

src/app/api/admin/anti-abuso/simular/route.ts
└── body schema acepta nota

src/components/modules/AdminAntiAbusoSimulador.tsx
└── reset escenario, dropdown plataformas, array priority, nota, botón habilitado

src/components/modules/AdminAntiAbusoSimuladorHistorial.tsx
└── label escenario, columna nota

scripts/simulador-abuso.mjs
└── header x-simulacion-secret + fail-loud si falta env
```

---

## Decisiones técnicas propuestas

1. **Bypass solo en endpoint público**: el worker habla con `/api/reportes`; por eso el bypass vive allí y no en una ruta de admin.
2. **Secret compartido server-only**: se usa `SIMULADOR_ABUSO_SECRET` en vez de sesión ADMIN porque `POST /api/reportes` rechaza roles distintos a PARENT. Validación con `crypto.timingSafeEqual`.
3. **Fail-loud en worker**: si falta el secret, el worker no arranca. Esto evita simulaciones que no tengan bypass y saturarían el fingerprint.
4. **Migración aditiva `nota`**: aunque el brief la marca opcional, se implementa para cerrar I-76 completamente. Es un campo seguro (texto libre interno, sin PII forzada).
5. **No se modifica `rate-limit.ts`**: el bypass se implementa en `src/app/api/reportes/route.ts` omitiendo la llamada a `checkRateLimit`, no cambiando la librería.
6. **Fallback de plataformas hardcoded**: garantiza UX funcional aunque el seed no haya corrido o la BD esté vacía.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Exponer bypass fingerprint al público | Validación con `crypto.timingSafeEqual` y secret de 32 bytes; sin secret correcto no hay bypass |
| Secret ausente en worker | Fail-loud: worker no arranca |
| Cambios en `POST /api/reportes` afecten reportes reales | Bypass condicional; caminos de reporte real intactos |
| Nota vacía en corridas antiguas | Columna opcional; historial maneja null |
| Dropdown plataformas vacío | Fallback hardcoded de 4 opciones comunes |
| Array vacío + campo único vacío | Validación Zod existente + hint visual |
