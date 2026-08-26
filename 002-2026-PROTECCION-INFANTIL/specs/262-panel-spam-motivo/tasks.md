# Tasks — SPEC-262 · Panel spam motivo de ingreso real (I-113)

**Branch**: `work/002-PI-ciclo-operador`  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Helper

- **T001** [C] Crear `src/lib/spam/motivo-ingreso.ts` con `derivarMotivoIngreso()`.

## Fase 2 — Endpoint

- **T002** [C] `SELECT_BANDEJA_SPAM` — añadir `categoriasSecundarias`.
- **T003** [C] `/api/admin/spam/pendientes/route.ts` — cargar params + `derivarMotivoIngreso` + `motivoIngreso` en respuesta.

## Fase 3 — Gate local

- **T004** [C] `tsc --noEmit` + lint + test + arch:check + build.
