# Tasks — SPEC-261 · ESTADOS_CARGA_OPERADOR (I-114, I-119, I-120, I-121)

**Branch**: `work/002-PI-ciclo-operador`  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Fuente única

- **T001** [C] Crear `src/lib/operadores/estados.ts` con `ESTADOS_CARGA_OPERADOR` y `esEstadoCargaOperador`.

## Fase 2 — 6 superficies

- **T002** [C] `OperadorService.listar()` — countWhere con `whereReporteEnEstados`.
- **T003** [C] `OperadorService.panelAsignacion()` — 2 queries con `whereReporteEnEstados`.
- **T004** [C] `reconciliacion-huerfanos.ts` — `estado: { in: [...ESTADOS_CARGA_OPERADOR] }`.
- **T005** [C] `reasignar-service.ts` — guarda `esEstadoCargaOperador`.
- **T006** [C] `reportes-revision/[id]/route.ts` — `puedeEscalar` + `puedeRevelarOriginal`.
- **T007** [C] `reportes/[id]/escalar/route.ts` — guarda `esEstadoCargaOperador`.

## Fase 3 — Gate local

- **T008** [C] `tsc --noEmit` + lint + test + arch:check + build.
