# Tasks: SPEC-150 — Observación especial

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

- [x] T001 Schema: `EstudianteObservacion` + `AccionAudit` ×2 + migración aditiva
      (diff+shadow, **I-49: cero DROP INDEX**) + reset/deploy/seed en test
- [x] T002 [P] Repo `estudiante-observacion.ts` (marcar idempotente, desmarcar soft
      delete, activaPorEstudiantes, historial) + tests A/B
- [x] T003 `POST/DELETE /api/colegio/alumnos/[id]/observacion` (tenant-first, Zod
      motivo ≤500, audit ambas) + route.test.ts (A/B, idempotencia, histórico)
- [x] T004 Sensibilidad en `avisos.ts`: umbral efectivo 1 si observación activa
      (detalle "observación especial") + test (observado → 1er reporte;
      desmarcado → umbral estándar; idempotencia por día)
- [x] T005 [P] UI: flag `observado` en `cursoDetalle` + `Star` toggle en
      `TablaEstudiantes` (aria-label, tap ≥48px) + estado/historial en
      `AlumnoDetallePageClient` + tests
- [x] T006 Arch: regenerar 01 + oráculo modelos 56→57 + `arch:check` VERDE
- [x] T007 Checks de día: tsc + lint + tokens:check (≤1122) + arch:check + tests
      del área + push (sin pipes con tail; verificar ls-remote)

## Analyze (2026-08-09)

- Cobertura: US1→T001-T003 · US2→T004 · US3→T005 · FR-005→T001-T007. Toda FR tiene
  tarea; FR-006 invariante en T007.
- Consistencia: idempotencia en servicio (buscar activa antes de crear) coherente
  con el doble clic; soft delete estilo Reporte (fila conservada); umbral 1 fijo
  documentado como decisión.
