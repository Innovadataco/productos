# Implementation Plan: SPEC-185 — Historial y sugerencias del simulador de abusos

**Branch**: `work/002-pi-080` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/185-simulador-historial/spec.md`

---

## Summary

Extender el simulador de abusos de SPEC-184 con: (1) historial paginado de corridas, (2) endpoint de sugerencias frescas por escenario para evitar colisiones de IP, (3) autofill inteligente del form "Nueva corrida", (4) detalle de corrida con explicación en criollo, y (5) fix del bug I-64 (`fechaFin` inexistente) más backfill. Todo sin migraciones, reutilizando `SimulacionAbusoRun` y ampliando `resultadosJson`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, React 19 |
| **Storage** | PostgreSQL 16 — sin migraciones (JSON existente) |
| **Testing** | Vitest integration para endpoints/repositorios; unit para helpers |
| **Target Platform** | Web (admin) + worker Node.js `scripts/simulador-abuso.mjs` |
| **Constraints** | No tocar `src/lib/ai/**`; no modificar rate-limit real; RFC 5737; frontera DAL |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | El simulador sigue generando reportes de texto |
| §1.3 Presunción de inocencia | ✅ Pass | Historial usa lenguaje estadístico; no veredictos |
| §1.4 Umbral parametrizable | ✅ Pass | No se modifica visibilidad pública |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma; sin cambios de stack |
| §3.5 Logs y auditoría | ✅ Pass | Se reutilizan acciones de audit existentes |
| I-22 No secretos | ✅ Pass | Ningún valor secreto en docs |
| I-49 Migraciones aditivas | ✅ Pass | No se añade migración; si ZEUS pide `fechaFin`, se evalúa |
| Q-3 Frontera DAL | ✅ Pass | Todo acceso a `SimulacionAbusoRun` por su repositorio |

---

## Estado actual (verificado en fuente)

- **Simulador**: `src/lib/anti-abuso/simulador.ts` genera payloads y crea corridas; `crearSimulacionAbuso` valida IP RFC 5737 y encola job.
- **Worker**: `scripts/simulador-abuso.mjs` consume cola `simulacion-abuso`, envía POST reales a `/api/reportes`, actualiza progreso y resultados. **Bug I-64**: línea 184 llama `repo.actualizarEstado(runId, estadoFinal, new Date())` pasando `fechaFin`, campo inexistente en `SimulacionAbusoRun`.
- **Repositorio**: `src/lib/dal/repositories/simulacion-abuso.ts` tiene `actualizarEstado(id, estado, fechaFin?)` que expande `fechaFin` en el data object; Prisma falla porque el modelo no tiene el campo.
- **Endpoints**: `POST /api/admin/anti-abuso/simular`, `GET /api/admin/anti-abuso/simular/[id]`, `POST /api/admin/anti-abuso/simular/[id]/cancelar` existen. Falta `GET /api/admin/anti-abuso/simular` (listado) y `GET /api/admin/anti-abuso/simular/sugerencias`.
- **UI**: `src/components/modules/AdminAntiAbusoSimulador.tsx` es el form actual dentro de `/dashboard/admin/anti-abuso` (tab "Simulador"). No tiene historial ni sub-tabs.
- **Schema**: `SimulacionAbusoRun` tiene `id`, `escenario`, `totalReportes`, `progreso`, `estado`, `configJson`, `resultadosJson`, `creadoPorId`, timestamps. No tiene `fechaFin`.
- **Rate-limit**: `RateLimit` almacena `ipHash`, `scope`, `ventana`, `contador`, etc. Se lee para detectar IPs usadas recientemente.

---

## Diseño por fase

### Fase 0 — Fix I-64 + backfill (fundacional)

**Objetivo**: que el simulador no marque `FALLIDA` por un campo inexistente.

- En `scripts/simulador-abuso.mjs`:
  - Cambiar `repo.actualizarEstado(runId, "EN_PROGRESO", undefined)` → `repo.actualizarEstado(runId, "EN_PROGRESO")`.
  - Cambiar `repo.actualizarEstado(runId, estadoFinal, new Date())` → `repo.actualizarEstado(runId, estadoFinal)`.
- En `src/lib/dal/repositories/simulacion-abuso.ts`:
  - Simplificar `actualizarEstado(id, estado)` eliminando el parámetro `fechaFin` y el spread.
  - Ajustar `cancelarSimulacionAbuso` para llamar sin `new Date()`.
- Backfill: `scripts/reparar-simulaciones-fechafin.mjs`:
  - Conecta a Prisma.
  - `UPDATE SimulacionAbusoRun SET estado='COMPLETADA' WHERE estado='FALLIDA' AND progreso = totalReportes AND creadoEn > '2026-08-20T15:00:00.000Z'`.
  - Log de cuántas filas cambió.
- Test: `src/lib/anti-abuso/simulador.test.ts` (existente) se amplía para verificar que una corrida terminada queda `COMPLETADA`.

### Fase 1 — Sugerencias frescas por escenario

**Servicio** `src/lib/anti-abuso/sugerencias-simulador.ts`:

- `generarSugerencia(escenario, opts)`:
  - Para cada escenario predefinido, calcula IP/identificador/plataforma/N frescos.
  - Consulta `SimulacionAbusoRepository` y `RateLimitRepository` para IPs usadas en las últimas 2h.
  - Genera IPs aleatorias dentro del rango RFC 5737 correspondiente, saltando las usadas.
  - Para `denunciante_spam`, lee `ParametroSistema` `simulacion.spam.usuario_id`; si existe y el usuario es PARENT activo, lo incluye; si no, `null`.
- `esIpUsadaRecientemente(ipHash, desde)` helper.

**Repositorio** `src/lib/dal/repositories/simulacion-abuso.ts`:

- Añadir `buscarIpsUsadas(ips: string[], desde: Date)` que devuelve el subset usado.
- Añadir `listar({ estado?, escenario? }, page, pageSize)` con orden `creadoEn desc`.

**Repositorio** `src/lib/dal/repositories/rate-limit.ts` (extensión):

- Añadir `buscarIpsBloqueadasRecientemente(ips: string[], desde: Date, scope: string)` para saber cuáles ya tienen bloqueos.

**Endpoint** `GET /api/admin/anti-abuso/simular/sugerencias?escenario=`:

- `verifyAuth` ADMIN + `assertModulo(user, "anti_abuso")`.
- Rate-limit `admin_read`.
- Valida `escenario` con Zod.
- Devuelve `{ ok: true, sugerencia: { n, ip, identificador, plataforma, usuarioId? } }`.

### Fase 2 — Listado paginado de corridas

**Endpoint** `GET /api/admin/anti-abuso/simular?estado=&escenario=&page=&pageSize=`:

- `verifyAuth` ADMIN + `assertModulo`.
- Rate-limit `admin_read`.
- Llama a `SimulacionAbusoRepository.listar`.
- Arma DTO con conteos agregados: `totalEnviados`, `totalBloqueados`, `totalSpam`, `latenciaPromedioMs` leídos de `resultadosJson`.
- Respuesta `{ items: [...], pagination: { page, pageSize, totalPages, totalItems } }`.

**Tests**: `src/app/api/admin/anti-abuso/simular/route.test.ts` (GET).

### Fase 3 — Detalle de corrida en criollo

**Endpoint** `GET /api/admin/anti-abuso/simular/[id]` (ya existe): extender para incluir:

- `descripcionEscenario`: texto en criollo según `escenario`.
- `latenciaP50Ms`, `latenciaP95Ms` desde `resultadosJson`.
- `detalles`: array `{ status, latencia, motivo? }` desde `resultadosJson.detalles`.

**Servicio** `src/lib/anti-abuso/descripcion-escenario.ts`:

- Mapa escenario → párrafo en criollo.

**Worker**: actualizar `scripts/simulador-abuso.mjs` para:

- Guardar cada request en array local: `{ status, latencia, motivo? }`.
- Al finalizar, calcular p50/p95 de latencias.
- Incluir `detalles`, `latenciaP50Ms`, `latenciaP95Ms` en `resultadosJson`.

### Fase 4 — Frontend: sub-tabs y autofill

**Componente** `src/components/modules/AdminAntiAbusoSimulador.tsx` refactor:

- Sub-tabs "Nueva corrida" / "Historial".
- En "Nueva corrida":
  - Dropdown de escenario con `onChange` que llama `/api/admin/anti-abuso/simular/sugerencias?escenario=...`.
  - Rellena `n`, `ip`, `identificador`, `plataforma`, `usuarioId`.
  - Hint y botón "Refrescar sugerencia".
  - Validación RFC 5737 al lanzar (reutiliza `validarIpInyectable`).
- En "Historial":
  - Tabla con filtros `estado` y `escenario`.
  - Paginación estándar.
  - Clic en fila abre modal de detalle.
- **Modal detalle** (nuevo componente `SimulacionAbusoDetalleModal.tsx`):
  - Bloques: "¿Qué probó este escenario?", "Configuración usada", "Resultado".
  - Tabla colapsable por reporte.
  - Botón "Cancelar" si está en progreso.
  - Botón "Repetir con nueva sugerencia" / "Repetir".

### Fase 5 — Seed y parámetros

- En `prisma/seed.ts` añadir idempotentemente `simulacion.spam.usuario_id` (STRING, vacío por defecto, categoría SYSTEM).
- Documentar en `quickstart.md` cómo configurar el usuario PARENT de prueba.

### Fase 6 — Tests y gate

- Tests de integración para listado, sugerencias, bugfix I-64.
- Gate local: `tsc`, `lint`, `test:unit`, `test:integration`, `build`, `dev-restart`.

---

## Project Structure

```text
specs/185-simulador-historial/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
└── checklists/
    └── requirements.md

src/lib/anti-abuso/
├── sugerencias-simulador.ts          # NUEVO: lógica de sugerencias
├── descripcion-escenario.ts          # NUEVO: textos en criollo
└── simulador.ts                      # MOD: tipos/exports si aplica

src/lib/dal/repositories/
├── simulacion-abuso.ts               # MOD: listar, buscarIpsUsadas, actualizarEstado sin fechaFin
└── rate-limit.ts                     # MOD: buscarIpsBloqueadasRecientemente

src/app/api/admin/anti-abuso/simular/
├── route.ts                          # MOD: +GET listado
├── sugerencias/route.ts              # NUEVO
├── [id]/route.ts                     # MOD: +descripcion +detalles +percentiles
└── [id]/cancelar/route.ts            # sin cambios

src/components/modules/
├── AdminAntiAbusoSimulador.tsx       # MOD: sub-tabs + autofill + historial
└── SimulacionAbusoDetalleModal.tsx   # NUEVO

scripts/
├── simulador-abuso.mjs               # MOD: fix fechaFin, guarda detalles y percentiles
└── reparar-simulaciones-fechafin.mjs # NUEVO

prisma/seed.ts                        # MOD: param simulacion.spam.usuario_id
```

---

## Decisiones técnicas propuestas

1. **No migración**: se reutiliza `SimulacionAbusoRun` y se guardan detalles/percentiles en `resultadosJson`. Si ZEUS pide persistencia estructurada del detalle, se discute migración aditiva en compuerta.
2. **Fix I-64 sin `fechaFin`**: se elimina el argumento `fechaFin` del worker y del repo. El estado final + `actualizadoEn` es suficiente. Si se requiere un campo explícito de fin, se añade en una spec posterior.
3. **Modal para detalle**: evita nueva ruta de página y mantiene al usuario dentro del tab "Simulador".
4. **Usuario PARENT de prueba configurable**: parámetro `simulacion.spam.usuario_id` en seed (vacío). Más seguro que buscar automáticamente cualquier PARENT.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Agotar IPs RFC 5737 con sugerencias | Ventana de 2h + 3 rangos /24 (768 IPs); escenarios usan <=50 |
| `resultadosJson` crece con detalles | Máximo 200 items; cada item ~50 bytes; aceptable para PG JSON |
| Backfill toque corridas realmente fallidas | Condición estricta: `estado=FALLIDA AND progreso=totalReportes` |
| Autofill pise edición manual del usuario | El autofill solo ocurre al cambiar escenario o refrescar; edición posterior se respeta |
