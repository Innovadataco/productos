# Tasks: Panel de Administración

**Input**: Design documents from `/specs/004-panel-admin/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/admin-api.md, quickstart.md

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Migración AuditLog, protección de ruta admin, estructura base

- [x] T001 Verificar si `AuditLog` existe en BD; si no, crear migración `prisma/migrations/20260714120000_add_audit_log/migration.sql` + registrar en `_prisma_migrations` + `npx prisma generate`
- [x] T002 [P] Crear `src/app/dashboard/admin/layout.tsx` — server component, verifica rol ADMIN vía `verifyAuth`, redirige si no cumple
- [x] T003 [P] Crear `src/components/modules/AdminNav.tsx` — navegación lateral: Bandeja, Dashboard, Anonimización

**Checkpoint**: Migración aplicada, layout protege rol ADMIN, nav renderiza

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Endpoints de agregación que bloquean el dashboard

- [x] T004 Crear `src/app/api/admin/estadisticas/route.ts` — GET, rol ADMIN, queries agregadas (totales, porEstado, porCategoria, porPlataforma, porCiudad, tendencia 30 días)
- [x] T005 Crear `src/app/api/admin/audit-logs/route.ts` — GET, rol ADMIN, paginado con filtros (accion, usuarioId, fechaDesde/Hasta); nunca incluye texto de reporte
- [x] T006 Actualizar `src/lib/audit.ts` — helper `auditLog(accion, tipoRecurso, recursoId, valorAnterior, valorNuevo)` que guarda solo metadata (estado/categoría/ID)

**Checkpoint**: `curl /api/admin/estadisticas` retorna métricas; `curl /api/admin/audit-logs` retorna logs sin PII

---

## Phase 3: User Story 1 — Bandeja de reportes (Priority: P1) 🎯 MVP

**Goal**: Lista paginada con filtros y detalle completo

**Independent Test**: Escenario B del quickstart — filtrar por REQUIERE_ANONIMIZACION y ver detalle

- [x] T007 [P] [US1] Crear `src/components/modules/AdminReportesTable.tsx` — tabla HTML con paginación server-side, ordenación por columnas, filtros por estado/plataforma/categoría/fecha
- [x] T008 [P] [US1] Crear `src/components/modules/AdminReporteDetalle.tsx` — drawer/modal con textoOriginal (solo admin), clasificación IA, acciones (corregir, anonimizar)
- [x] T009 [US1] Implementar `src/app/dashboard/admin/page.tsx` — renderiza AdminReportesTable + integración con `GET /api/admin/reportes-revision`
- [x] T010 [US1] Integrar filtros en la URL (query params) para que el estado de filtros sea compartible

**Checkpoint**: Escenario B pasa — filtro por estado funciona, detalle muestra textoOriginal

---

## Phase 4: User Story 2 — Corrección de clasificación (Priority: P1) 🎯 MVP

**Goal**: Cambiar categoría de un reporte clasificado

**Independent Test**: Escenario C del quickstart — corregir categoría y ver reflejado

- [x] T011 [US2] Integrar corrección en `AdminReporteDetalle.tsx` — dropdown de `CategoriaConducta` + input motivo + botón confirmar
- [x] T012 [US2] Conectar a `POST /api/admin/correcciones` vía fetch nativo; manejar 201 y errores
- [x] T013 [US2] Llamar `auditLog` desde el frontend tras corrección exitosa (o desde el backend)

**Checkpoint**: Escenario C pasa — corrección reflejada en detalle, audit log registrado

---

## Phase 5: User Story 3 — Anonimización de PII (Priority: P1) 🎯 MVP

**Goal**: Editar texto sin PII para reportes REQUIERE_ANONIMIZACION

**Independent Test**: Escenario D del quickstart — anonimizar y verificar estado CLASIFICADO

- [x] T014 [US3] Integrar anonimización en `AdminReporteDetalle.tsx` — textarea para textoAnonimizado (20-5000 chars, contador), botón confirmar
- [x] T015 [US3] Conectar a `PATCH /api/admin/reportes/[id]/anonimizar` vía fetch nativo
- [x] T016 [US3] Deshabilitar/hidear acción de anonimizar si estado != REQUIERE_ANONIMIZACION
- [x] T017 [US3] Llamar `auditLog` tras anonimización exitosa (solo metadata: estado anterior → nuevo)

**Checkpoint**: Escenario D pasa — textoOriginal preservado, texto = anonimizado, estado = CLASIFICADO

---

## Phase 6: User Story 4 — Dashboard de estadísticas (Priority: P2)

**Goal**: Métricas agregadas con visualizaciones SVG

**Independent Test**: Escenario F del quickstart — métricas reales y gráficos correctos

- [x] T018 [P] [US4] Crear `src/components/modules/AdminDashboard.tsx` — tarjetas de métricas (totales, pendientes)
- [x] T019 [P] [US4] Crear `src/components/modules/BarChart.tsx` — barras horizontales SVG nativo
- [x] T020 [P] [US4] Crear `src/components/modules/DonutChart.tsx` — donut SVG con `stroke-dasharray`
- [x] T021 [P] [US4] Crear `src/components/modules/Sparkline.tsx` — línea de tendencia SVG `<polyline>`
- [x] T022 [US4] Implementar `src/app/dashboard/admin/estadisticas/page.tsx` — renderiza dashboard con `GET /api/admin/estadisticas`
- [x] T023 [US4] Asegurar que el lenguaje del dashboard es descriptivo: "N reportes", nunca "peligroso"

**Checkpoint**: Escenario F pasa — tarjetas y gráficos muestran datos reales

---

## Phase 7: User Story 5 — Acceso restringido (Priority: P1) 🎯 MVP

**Goal**: Solo ADMIN accede al área admin

**Independent Test**: Escenario G del quickstart — no-admin redirigido/bloqueado

- [x] T024 [US5] Verificar que `layout.tsx` redirige usuarios no autenticados a `/login`
- [x] T025 [US5] Verificar que `layout.tsx` redirige usuarios PARENT/SCHOOL_ADMIN a `/`
- [x] T026 [US5] Verificar que todos los endpoints `/api/admin/**` retornan 403 para non-ADMIN

**Checkpoint**: Escenario G pasa — todas las combinaciones de rol prueban acceso denegado

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Build, validación end-to-end, reglas duras

- [x] T027 `npm run build` pasa sin errores TypeScript
- [x] T028 Verificar que PII no filtra: `GET /api/admin/estadisticas` no incluye texto/textoOriginal/identificador
- [x] T029 Verificar audit logs: `valorAnterior`/`valorNuevo` nunca contienen texto de reporte (solo estado/categoría/ID)
- [x] T030 Ejecutar escenarios A-G del quickstart y registrar PASS/FAIL
- [x] T031 Commit final + push `origin/feature/001-scaffolding`

**Checkpoint**: Build OK, quickstart validado, reglas duras verificadas

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends on | Bloquea |
|-------|-----------|---------|
| Phase 1 (Setup) | Nada | Phase 2 |
| Phase 2 (Foundational) | Phase 1 | Phase 3-6 |
| Phase 3 (US1 Bandeja) | Phase 2 | Phase 4, 5 |
| Phase 4 (US2 Corrección) | Phase 3 | Nada |
| Phase 5 (US3 Anonimización) | Phase 3 | Nada |
| Phase 6 (US4 Dashboard) | Phase 2 | Nada |
| Phase 7 (US5 Acceso) | Phase 1 | Nada |
| Phase 8 (Polish) | Todas las anteriores | Nada |

### Within Each User Story

- Componentes UI antes de integración con APIs
- Core implementation antes de polish

### Parallel Opportunities

- Phase 1: T001-T003 en paralelo
- Phase 2: T004-T006 en paralelo
- Phase 3: T007-T008 en paralelo; T009-T010 secuencial
- Phase 4: T011-T013 secuencial
- Phase 5: T014-T017 secuencial
- Phase 6: T018-T021 en paralelo; T022-T023 secuencial
- Phase 7: T024-T026 en paralelo

---

## Implementation Strategy

### MVP First (User Story 1 + Acceso)

1. Phase 1: Setup
2. Phase 2: Foundational (endpoints agregación)
3. Phase 3: US1 — Bandeja de reportes
4. Phase 7: US5 — Acceso restringido
5. **STOP and VALIDATE**: Escenarios A, B, G del quickstart

### Incremental Delivery

6. Phase 4: US2 — Corrección de clasificación
7. Phase 5: US3 — Anonimización
8. Phase 6: US4 — Dashboard
9. Phase 8: Polish

---

## Notes

- Total tasks: 31 (T001-T031)
- Tasks por fase: P1=3, P2=3, P3=4, P4=3, P5=4, P6=6, P7=3, P8=5
- Sin tareas de test explícitas (no fueron solicitadas en spec)
- Reglas duras a verificar en cada fase:
  - Solo rol ADMIN accede (FR-001, FR-009)
  - PII visible solo al admin; APIs públicas sin cambios (FR-010)
  - Sin librerías de charts externas (FR-012)
  - AuditLog.valorAnterior/valorNuevo solo metadata, nunca texto/PII
  - Lenguaje sin culpabilizar (FR-011)
  - Cookie httpOnly, sin localStorage