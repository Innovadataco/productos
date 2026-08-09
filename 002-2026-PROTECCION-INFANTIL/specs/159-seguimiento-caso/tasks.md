# Tasks: SPEC-159 — Seguimiento del caso con bitácora

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

- [ ] T001 Schema: `SeguimientoCaso` + `NotaSeguimiento` + `AccionAudit`
      `COLEGIO_CASO_NOTA_AGREGADA` + migración aditiva (diff+shadow, **I-49: cero
      DROP INDEX**) + reset/deploy/seed en test
- [ ] T002 [P] Repo `seguimiento-caso.ts` (obtenerOCrearPorAlerta, agregarNota —
      tenant-first, único por alertaId) + extensiones: `alerta-colegio` (detalle
      con curso/estudiante/plataforma), `registro-aviso-colegio` (por entidad),
      `evento-match` (porReporteId agregado), `audit-log` (hitos por recurso) +
      tests A/B
- [ ] T003 `src/lib/colegio/seguimiento.ts` — `armarTimeline()` (hitos con fuentes
      reales, pendientes honestos) + `calcularPendientes()` (puro) + tests
- [ ] T004 `GET /api/colegio/alertas/[id]` (UNA llamada, 404 ajeno) + `POST
      .../notas` (withUnitOfWork, Zod 1..1000, audit) + PATCH/DELETE notas → 404 +
      route.test.ts A/B + atomicidad
- [ ] T005 [P] Componentes `TimelineCaso` + `PendientesCaso` + `BitacoraCaso` +
      página `[id]` + enlace desde la lista de alertas + tests
- [ ] T006 Arch: regenerar 01/02/03 + oráculos (modelos 54→56, páginas 56→57) +
      `arch:check` VERDE
- [ ] T007 Checks de día: tsc + lint + tokens:check (≤1122) + arch:check + tests
      del área + push (sin pipes que traguen exit codes)

## Analyze (2026-08-09)

- Cobertura: US1→T002-T005 · US2→T003,T005 · US3→T001,T002,T004,T005 · FR-006→T007.
  Toda FR tiene tarea; FR-007 invariante en T007.
- Consistencia: caso = alerta (1:1 lazy) coherente con el modelo; timeline solo de
  fuentes reales (RegistroAviso por reporteId, match agregado); notas inmutables
  por construcción (sin verbos).
