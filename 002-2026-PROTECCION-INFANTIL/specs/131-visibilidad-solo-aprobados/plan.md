# Implementation Plan: SPEC-131 — Visibilidad pública solo por reportes aprobados (BL-5)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/131-visibilidad-solo-aprobados/spec.md` (instructivo 002-PI-054)

## Summary

La decisión de visibilidad pública pasa del conteo crudo al conteo APROBADO (predicado
único spec 089/D-08). El agregado gana dos contadores explícitos (`reportesAprobados`,
`autenticadosAprobados`, migración ADITIVA) que SOLO escribe el recálculo
(`recalcularYGuardarScore`, que ya computa sobre `whereReporteAprobado`). `visibility.ts`
lee aprobados para el umbral y el ratio. Backfill idempotente para las filas existentes.
El motor de clasificación NO se toca; la superficie mostrada NO cambia (solo cuándo un
identificador se vuelve visible).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: las ya instaladas — Prisma 5.22, predicado `src/lib/reporte-aprobado.ts`
(fuente única), `src/lib/scoring.ts`, `src/lib/visibility.ts`. Ninguna dependencia nueva.

**Storage**: PostgreSQL 16 — migración ADITIVA: `IdentificadorReportado.reportesAprobados`
y `autenticadosAprobados` (Int, default 0)

**Testing**: Vitest — visibilidad por casos (solo-spam, umbral exacto, ratio aprobado,
baja/corrección) + backfill idempotente

**Target Platform**: Next.js (dev Mac + prod VPS); worker/pipeline existente

**Project Type**: corrección de regla de negocio (visibilidad pública)

**Performance Goals**: el recálculo añade dos escrituras por identificador (misma query
aprobada que ya hace); el backfill procesa por lotes

**Constraints**: predicado aprobado INTACTO (no se redefine); migraciones SIEMPRE
aditivas; NO tocar el motor de clasificación; NO exponer score/riesgo al público;
ratio con 0 aprobados = 0 (sin división por cero)

**Scale/Scope**: 1 campo de decisión (visibility.ts), 2 campos nuevos en el agregado,
1 punto de escritura (recalc), 1 script de backfill, tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **§1.3 Presunción de inocencia**: ES la razón de la spec — nadie se vuelve público por basura.
- **§1.4 Umbral parametrizable**: OK — el umbral sigue siendo parámetro de `ParametroSistema`;
  su interpretación pasa a base aprobada (documentado para ajuste del CEO si aplica).
- **§1.5 Sin scoring de personas al público**: OK — no se expone score/riesgo; solo conteos de hechos.
- **Migraciones aditivas/no destructivas**: OK — campos nuevos con default; nada se borra.
- **Predicados centrales (SPEC-122)**: OK — se consume el predicado único aprobado, no se duplica.
- **Metodología Spec-Kit**: OK — spec+plan; compuerta §4 (PARA antes de tasks/implement).

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/131-visibilidad-solo-aprobados/
├── plan.md              # This file
├── research.md          # Phase 0 (semántica mixta del agregado + decisión de diseño)
├── quickstart.md        # Phase 1 (verificación por casos + backfill)
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec
└── tasks.md             # Phase 2 (speckit-tasks) — TRAS aprobación de ZEUS (compuerta §4)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── schema.prisma                    # + reportesAprobados, autenticadosAprobados (ADITIVO)
│   └── migrations/NNNN_aprobados_agregado/  # migración aditiva
├── src/lib/
│   ├── visibility.ts                    # lee contadores aprobados (umbral + ratio)
│   ├── scoring.ts                       # recalcularYGuardarScore escribe los aprobados
│   └── visibility.test.ts               # tests nuevos de la regla aprobada
└── scripts/
    └── backfill-aprobados-agregado.ts   # NUEVO: recompute idempotente por lotes
```

**Structure Decision**: los contadores aprobados son campos explícitos del agregado (no
se redefine `totalReportes`, cuya semántica mixta queda documentada como deuda); una sola
escritora (recalc) y una sola lectora de la decisión (visibility).

## Decisiones de diseño (Phase 1)

### D1 — Contadores aprobados explícitos (no redefinir totalReportes)
`IdentificadorReportado` gana `reportesAprobados Int @default(0)` y
`autenticadosAprobados Int @default(0)` (migración ADITIVA). `totalReportes` se conserva
como contador de registros para diagnóstico (su semántica mixta — crudo al crear,
aprobado tras recalc — se documenta en research.md como deuda conocida; la visibilidad
deja de leerlo).

### D2 — Una sola escritora: el recálculo (FR-004)
`recalcularYGuardarScore` ya computa `resultado.totalReportes` y
`resultado.reportesAutenticados` sobre `whereReporteAprobado`: pasa a escribir ADEMÁS
`reportesAprobados = resultado.totalReportes` y
`autenticadosAprobados = resultado.reportesAutenticados` en su upsert. La creación NO
incrementa los aprobados (un PENDIENTE no cuenta); los raw counters de creación quedan
como están (son el registro bruto, no la base de visibilidad).

### D3 — Visibilidad sobre base aprobada (FR-001/FR-002)
```ts
const ratioAprobados = agregado.reportesAprobados > 0
    ? agregado.autenticadosAprobados / agregado.reportesAprobados
    : 0;
const esVisible = !agregado.ocultoPorComiteEn
    && agregado.reportesAprobados >= umbral
    && ratioAprobados >= minRatio;
```
`ocultoPorComiteEn` (SPEC-110) sigue ganando intacto.

### D4 — Backfill explícito e idempotente (FR-005)
`scripts/backfill-aprobados-agregado.ts`: por lotes, para cada agregado cuenta con
`whereReporteAprobado({ identificador, plataformaId })` los aprobados y los autenticados
aprobados (`esAnonimo: false`), escribe los campos, imprime conteos y verifica
(100% consistente; segunda corrida = 0 cambios). DEV primero; PROD como paso manual
documentado (patrón 048/130).

### D5 — Tests de la regla (FR-007)
`src/lib/visibility.test.ts` (nuevo): (a) solo-spam → no visible; (b) umbral-1 aprobados
+ spam → no visible; (c) umbral aprobados → visible; (d) ratio sobre base aprobada;
(e) ocultoPorComiteEn gana aun con umbral cumplido. Recalc escribe aprobados (test de
integración ligera sobre `recalcularYGuardarScore`).

## Research resumido (Phase 0 → research.md)

Semántica mixta de `totalReportes` (crudo al crear, aprobado tras recalc), por qué la
escritora única es el recálculo y la alternativa descartada (redefinir `totalReportes`
como aprobado con escritor único: más invasiva, rompe diagnósticos crudos).

## Quickstart (validación) → [quickstart.md](quickstart.md)

Casos SC-001..SC-004 guiados: solo-spam, umbral exacto, ratio, backfill en dev con
conteos e idempotencia, y gates.

## Contracts

N/A — no expone endpoints nuevos ni cambia contratos HTTP (la consulta pública ya filtra
aprobados; solo cambia CUÁNDO el identificador aparece).

## Data Model

Migración ADITIVA: `IdentificadorReportado.reportesAprobados Int @default(0)` y
`autenticadosAprobados Int @default(0)` (+ backfill de datos por script, idempotente).
Sin cambios destructivos ni renombrados.

## Constitution Check (post-diseño)

Re-evaluado tras Phase 1: sin cambios — ninguna violación.

## Complexity Tracking

Sin violaciones de constitución que justificar.
