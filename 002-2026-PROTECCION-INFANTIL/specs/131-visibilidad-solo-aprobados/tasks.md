# Tasks: SPEC-131 — Visibilidad pública solo por reportes aprobados

**Estado**: PENDIENTE — compuerta §4.

Las tareas (`TNNN`) se generan con `/speckit.tasks` **tras la aprobación de ZEUS** del
spec.md y plan.md de esta carpeta (instructivo 002-PI-054). Este archivo existe como
marcador para la disciplina de specs; no contiene tareas aún.

Orden previsto por el plan (se materializará en TNNN al aprobarse):

1. Migración aditiva: `reportesAprobados` + `autenticadosAprobados` en
   `IdentificadorReportado` (+ regenerar `01-modelo-datos.md`).
2. Recálculo escribe los contadores aprobados (`recalcularYGuardarScore`) — TDD.
3. `visibility.ts` decide con aprobados (umbral + ratio sobre base aprobada) — TDD:
   solo-spam no visible, spam no empuja el umbral, ratio aprobado.
4. `scripts/backfill-aprobados-agregado.ts` (lotes, conteos, idempotente) + corrida en dev.
5. Gates: suite + tsc + lint + build + arch:check; validación con `quickstart.md`.
6. Cierre: sección Implementación en spec.md + índice specs/README.md.
