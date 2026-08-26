# Tasks — SPEC-264 · SLA spam 48h configurable (I-116)

**Branch**: `work/002-PI-ciclo-operador`  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Seed

- **T001** [C] `prisma/seed.ts` — upsert anti-I-100 de `spam.sla_horas=48`.

## Fase 2 — Gate local

- **T002** [C] `tsc --noEmit` + lint + test + arch:check + build.
