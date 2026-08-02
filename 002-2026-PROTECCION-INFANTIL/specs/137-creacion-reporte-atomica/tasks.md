# Tasks: SPEC-137 — Creación de reporte atómica

**Input**: plan.md + spec.md (APROBADO por ZEUS 2026-08-01: la carrera se prueba con
test de concurrencia REAL — 2 simultáneas → 1 reporte + 1 DUPLICADO — no solo
read-committed).

## Fase 1 — Tx en la creación (FR-001/FR-002)

- [ ] T001 `route.ts` envuelve `crear()` en `withUnitOfWork` y pasa `tx` al servicio
- [ ] T002 Cierre de la carrera de dedup (lock por identificador en la tx — FOR UPDATE
      sobre el agregado o mecanismo equivalente probado)
- [ ] T003 Test de rollback: fallo inyectado en upsert → cero filas (ni reporte ni
      incremento del agregado)
- [ ] T004 Test de concurrencia REAL: 2 requests simultáneas mismo usuario+identificador
      → exactamente 1 reporte en BD y 1 respuesta DUPLICADO (429)

## Fase 2 — Reconciliación (FR-003)

- [ ] T005 `reencolarPendientesSinJob()` en queue.ts (ventana de gracia 1 min, solo
      PENDIENTE, filtro anti-reencolado, respeta backpressure)
- [ ] T006 Job periódico `reportes-reconciliacion` en worker-reportes.mjs (patrón
      carga-roster-limpieza, 15 min)
- [ ] T007 Test: PENDIENTE sin job → encolado; segunda corrida no-op (idempotente);
      POSIBLE_SPAM/REVISION_MANUAL intactos

## Fase 3 — Gates y cierre

- [ ] T008 Suite completa + tsc + lint + build + arch:check verdes; route tests y
      journeys SIN tocar
- [ ] T009 Cierre documental: spec.md (Status + §Implementación), checklist, specs/README.md
