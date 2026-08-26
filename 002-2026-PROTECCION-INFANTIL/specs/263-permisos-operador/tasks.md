# Tasks — SPEC-263 · Barrido de permisos (I-118, I-119, I-120, I-121)

**Branch**: `work/002-PI-ciclo-operador`  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Grants por rol

- **T001** [C] `seed-modulos-grants.ts` — OPERADOR=[bandeja_reportes, expediente_revelar_original]; COMITE añade expediente_revelar_original.

## Fase 2 — Endpoint

- **T002** [C] `reportes-revision/[id]/route.ts:77` — `puedeRevelarOriginal` a OPERADOR y COMITE.

## Fase 3 — Script de revocación

- **T003** [C] Crear `scripts/revocar-grants-pagos-operador.ts` (patrón SPEC-128).
- **T004** [C] Crear `specs/263-permisos-operador/quickstart.md`.

## Fase 4 — Consentimiento y UI

- **T005** [C] `src/app/dashboard/admin/layout.tsx` — eliminar bloque `requiereConsentimientoActual`.
- **T006** [C] `AdminReportesTable.tsx` — "Ver proceso" condicional `!esRolConBandejaPropia`.

## Fase 5 — Auditoría

- **T007** [C] Crear `scripts/depurar-consentimientos-internos.ts`.

## Fase 6 — Gate local

- **T008** [C] `tsc --noEmit` + lint + test + arch:check + build.
