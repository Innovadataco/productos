# Implementation Plan: SPEC-303 · Ficha colegio admin Fase 1

**Branch**: `work/pi-SPEC-303-ficha-colegio-cimiento` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/303-ficha-colegio-cimiento/spec.md`

## Summary

Cierra el defecto de fondo que causa "Sin datos" en la ficha del colegio del admin (raíz de I-98) y añade la leyenda del semáforo + columna "Reportes" + motivo bajo estado no-verde en el listado (cierra I-104). Se crea un único método `ColegioActividadRepository.actividadDelColegio(colegioId, rango)` en la capa DAL como fuente única de verdad para "reportes que pertenecen al colegio", cruzando 3 rutas de pertenencia con UNIÓN sin duplicados por `Reporte.id`. Los umbrales del semáforo se REUTILIZAN sobre el namespace existente `analytics.colegios.*` (5 keys ya sembradas en `prisma/seed.ts:1969-1985`) añadiendo 3 keys nuevas con upsert anti-I-100. Los dos endpoints admin (`/api/admin/analytics/colegios` y `[id]`) devuelven `umbralesSemaforo` + `actividadReportes` para que el frontend pinte la leyenda con umbrales reales. UI: cambios acotados en `ColegiosAnalyticsTable.tsx` (leyenda + columna + motivo) y sección "3. Actividad de reportes" de `ColegioDetalleSecciones.tsx` (EmptyState → números reales). Cero migración destructiva, cero librería nueva, cero rediseño 4 bloques (eso es Fase 2 SPEC-304).

**Decisión clave del plan**: NO se toca `analytics-colegio.ts` existente ni `hallazgos-colegio.ts` (fórmula del semáforo actual). El nuevo repo se compone en los endpoints, respetando el patrón que ya funciona y evitando regresión de comportamiento del listado. Detalle y descarte de alternativas en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Node.js ≥ 22, Next.js 16.2.10 (App Router API Routes), React 19 (Server Components + `useEffect` client hydration en el detalle).

**Primary Dependencies**: Prisma 5.22.0 + PostgreSQL 16 (schema existente, cero migración), `@prisma/client`. Sin librerías nuevas.

**Storage**: PostgreSQL — modelos existentes `Reporte`, `AlertaColegio`, `Colegio`, `Usuario`, `IdentificadorEstudiante` (+ `Estudiante`), `IdentificadorProfesor`, `IdentificadorAcudiente`, `Expediente`, `ParametroSistema`. Nuevos registros en `ParametroSistema` (3 keys `analytics.colegios.*`) via seed idempotente.

**Testing**: Vitest + jsdom + Testing Library (constitución §5). Fábricas en `@/lib/reporte-test-utils`. Limpieza `beforeEach(await resetDatabase())`. Los tests de repo del DAL se ubican junto al código (`src/lib/dal/repositories/colegio-actividad.test.ts`).

**Target Platform**: `002-2026-PROTECCION-INFANTIL` (mono-producto). Sin impacto en BI.

**Project Type**: Feature de producto sobre stack existente (Next.js App Router API + DAL + React client component). Sin nuevos servicios, sin nuevos workers.

**Performance Goals**: `actividadDelColegio` responde < 800 ms para el colegio con más volumen de reportes de producción (SC-009). Cero N+1: consulta agregada única (o pocas consultas paralelas dedup en memoria por `Reporte.id`).

**Constraints**:
- Cero cambio a `src/lib/ai/**`, `scripts/deploy-prod.sh`, `.github/workflows/verificar-base-pr.yml` (candados instructivo).
- Names de jobs de CI intocados (herencia SPEC-300).
- Multi-tenant estricto: filtro explícito por `colegioId` (o `tenantId` derivado); jamás disableRLS ni bypass.
- Upsert anti-I-100 en las 3 keys nuevas del seed.
- Status canónico y `Impacto en arquitectura:` obligatorio (candado disciplina Spec-Kit).

**Scale/Scope**: ~15-25 archivos totales según ratchet del instructivo (repo nuevo + tests + endpoint amplia + seed + 2 componentes UI + spec Kit).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitución `.specify/memory/constitution.md` v1.1.0. Análisis por sección:

| Sección | Aplicabilidad | Veredicto |
|---|---|---|
| §1 Principios del producto (solo texto, presunción de inocencia, IA local, disputas, umbral) | Fase 1 NO toca contenido, procesamiento IA, consulta pública, disputas ni umbral de visibilidad público | ✅ PASS trivial |
| §2 Stack técnico (Next.js 16.2.10, React 19, Prisma 5.22.0, JWT, Vitest) | Reutiliza stack existente, cero librería nueva | ✅ PASS |
| §3 Calidad TS estricto (any prohibido, error handling, tipos Prisma) | El nuevo repo y los cambios a endpoints DEBEN respetar `strict: true`, tipar filtros con `Prisma.ReporteWhereInput`, sin `any`. Se codifica como candado en tasks | ✅ PASS con nota |
| §4 Arquitectura API + persistencia (singleton Prisma, paginación, jobs pg-boss) | Reutiliza singleton `prisma` a través de `this.db`; endpoints ya paginan; no encola jobs (query síncrona ligera) | ✅ PASS |
| §5 Testing (Vitest, cobertura, patrón repo) | Añade `colegio-actividad.test.ts` + tests de componentes UI, siguiendo el patrón existente `resetDatabase()` + fábricas | ✅ PASS |
| §6 Seguridad (JWT, encriptación, rate limit) | Endpoints admin ya usan `verifyAuth` + `verificarAccesoPagina("analytics_colegios")`. Sin exposición de texto crudo de reportes (payload usa metadata agregada) | ✅ PASS |
| §7 UI (Tailwind, no `Math.random` en render) | Cambios en `ColegiosAnalyticsTable` y `ColegioDetalleSecciones` respetan tokens PI, sin `Math.random`, sin `setState` sincrónico en `useEffect` | ✅ PASS |
| §8 Proceso desarrollo (commit atómico, lint, test, build) | Antes de PR: lint + test + build en verde; commit atómico por US si es factible, o bundle único con secciones claras en el mensaje | ✅ PASS |

**Gates**: sin violaciones. Cero justificación pendiente.

**Complexity Tracking**: N/A.

## Project Structure

### Documentation (this feature)

```text
specs/303-ficha-colegio-cimiento/
├── plan.md                 # este archivo
├── spec.md                 # feature spec (Status PLANEADO)
├── research.md             # Phase 0: decisiones sobre las 4 zonas + reuso namespace + descarte alternativas
├── data-model.md           # Phase 1: modelos existentes usados + shape del resultado + estados abiertos
├── quickstart.md           # Phase 1: guía del test + verificación BD prod caso testigo
├── contracts/
│   └── api-payload.md      # Phase 1: shape exacto de umbralesSemaforo + actividadReportes en endpoints
├── checklists/
│   └── requirements.md     # 12/12 PASS generada por /speckit-specify
└── tasks.md                # Phase 2 output (/speckit-tasks — NO creado aquí)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── src/lib/dal/repositories/
│   ├── colegio-actividad.ts             # NUEVO — clase ColegioActividadRepository
│   └── colegio-actividad.test.ts        # NUEVO — tests integración (3 colegios fixture)
├── src/app/api/admin/analytics/colegios/
│   ├── route.ts                          # MODIFICADO — payload listado suma umbralesSemaforo + total Reportes por fila
│   └── [id]/route.ts                     # MODIFICADO — payload detalle suma umbralesSemaforo + actividadReportes
├── src/components/modules/admin/
│   ├── ColegiosAnalyticsTable.tsx       # MODIFICADO — leyenda inline + columna Reportes + motivo no-verde
│   └── ColegioDetalleSecciones.tsx      # MODIFICADO — sección 3 "Actividad de reportes" usa números reales
├── prisma/
│   └── seed.ts                           # MODIFICADO — añade 3 upsert `analytics.colegios.*`
├── src/lib/analytics/
│   ├── hallazgos-colegio.ts             # SOLO LECTURA (no se toca — regresión previsible)
│   └── (otros)                           # SOLO LECTURA
├── src/lib/dal/repositories/
│   ├── analytics-colegio.ts             # SOLO LECTURA (no se toca — composición en endpoints)
│   ├── colegio.ts                       # SOLO LECTURA — plantilla de convención
│   └── (otros)                           # SOLO LECTURA
└── specs/303-ficha-colegio-cimiento/    # docs de esta spec
```

**Rutas prohibidas** (candados instructivo · SOLO LECTURA absoluta):
```text
002-2026-PROTECCION-INFANTIL/src/lib/ai/**
002-2026-PROTECCION-INFANTIL/scripts/deploy-prod.sh
.github/workflows/verificar-base-pr.yml
002-2026-PROTECCION-INFANTIL/prisma/schema.prisma        # aditivo permitido si necesario · esta Fase 1 NO lo requiere
```

**Coordinación con Dev PI-2** (`[855ff8]` en `pi-SPEC-302-deuda-motor-notif`): rutas ortogonales verificadas.
- Dev PI-2 opera en: `src/lib/notificaciones/**`, `src/lib/monitor/**` (probablemente), workflows CI.
- Dev PI-1 (esta spec) opera en: `src/lib/dal/repositories/colegio-actividad.*`, `src/app/api/admin/analytics/colegios/**`, `src/components/modules/admin/**`, `prisma/seed.ts`, `specs/303-*`.
- Cero solape previsto. Si aparece conflicto en `prisma/seed.ts` (posible si Dev PI-2 también siembra params), se resuelve por merge textual (ambos usan upsert `{create,update:{}}` así que el orden no importa).

**Structure Decision**: feature de producto sobre stack existente. Convención de repo DAL preservada. Composición en endpoints en vez de modificar `analytics-colegio.ts` (evita regresión y respeta principio "extender, no reescribir").

## Complexity Tracking

Sin violaciones a la constitución. Tabla vacía.
