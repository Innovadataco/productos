# Tasks: SPEC-194 — Analítica de Colegios + Vista Usuarios PARENT (002-PI-088)

## Fase 1: Especificación (compuerta §4)

- [x] T001 Redactar `spec.md` con user stories, FR, SC y decisiones propuestas.
- [x] T002 Redactar `plan.md` con diseño técnico, riesgos y migración.
- [x] T003 Redactar `research.md`, `data-model.md`, `quickstart.md`, `contracts/endpoints.md`, `checklists/requirements.md`.
- [ ] T004 Commit + push de `work/002-pi-088`.
- [ ] T005 Señal a ZEUS: `002-PI-088 · SPEC-194 · spec+plan LISTO · PARA`.

## Fase 2: Infraestructura compartida (bloqueante)

- [ ] T006 [P] Registrar módulos `usuarios_admin` y `analytics_colegios` en `src/lib/permisos-modulos.ts` (solo ADMIN).
- [ ] T007 Actualizar `src/lib/nav-items.ts`: añadir ítem "Usuarios" → `/dashboard/admin/usuarios`.
- [ ] T008 Actualizar `src/app/dashboard/admin/estadisticas/components/EstadisticasSubNav.tsx`: añadir tab "Colegios".
- [ ] T009 Crear migración aditiva `prisma/migrations/20260821110000_spec_194_analytics_indexes/migration.sql` con índices definidos en `data-model.md`.
- [ ] T010 Añadir 5 parámetros de analytics a `prisma/seed.ts` (sección `monitoreoNuevos`, `update: {}`).
- [ ] T011 Crear `src/lib/analytics/cache.ts` (caché en memoria con TTL).
- [ ] T012 Crear `src/lib/analytics/hallazgos-colegio.ts` (reglas de hallazgos y semáforo).
- [ ] T013 Crear `src/lib/analytics/usuarios-query.ts` (helpers de filtros tipados).

## Fase 3: User Story 1 — Vista unificada de usuarios / sub-tab Padres (P1) 🎯

**Goal**: `/dashboard/admin/usuarios` con sub-tabs; "Padres" carga listado paginado y filtrable.

- [ ] T014 Implementar `GET /api/admin/usuarios/route.ts` con soporte a `rol=PARENT` y filtros.
- [ ] T015 Implementar `src/app/dashboard/admin/usuarios/page.tsx` y `UsuariosAdminClient.tsx`.
- [ ] T016 Implementar `src/components/modules/admin/UsuariosSubNav.tsx`.
- [ ] T017 Implementar `src/app/dashboard/admin/usuarios/[id]/page.tsx` y `UsuarioDetalleClient.tsx`.
- [ ] T018 Tests: `src/app/api/admin/usuarios/route.test.ts`.

## Fase 4: User Story 2 — Tabla resumen de analítica por colegio (P1) 🎯

**Goal**: sub-tab "Colegios" renderiza tabla resumen ordenable, buscable y con semáforo.

- [ ] T019 Crear `src/lib/dal/repositories/analytics-colegio.ts` con `resumenColegios`.
- [ ] T020 Implementar `GET /api/admin/analytics/colegios/route.ts` con caché.
- [ ] T021 Extender `OperacionTableroClient.tsx` para renderizar tab Colegios.
- [ ] T022 Crear `src/components/modules/admin/ColegiosAnalyticsTable.tsx`.
- [ ] T023 Tests: `src/app/api/admin/analytics/colegios/route.test.ts`.

## Fase 5: User Story 3 — Ficha detalle de colegio con 7 secciones (P1) 🎯

**Goal**: ficha `/dashboard/admin/estadisticas/operacion/colegios/[id]` con las 7 secciones.

- [ ] T024 Extender `analytics-colegio.ts` con `detalleColegio` (7 secciones).
- [ ] T025 Implementar `GET /api/admin/analytics/colegios/[id]/route.ts` con caché.
- [ ] T026 Crear `src/app/dashboard/admin/estadisticas/operacion/colegios/[colegioId]/page.tsx` y `ColegioDetalleClient.tsx`.
- [ ] T027 Crear `src/components/modules/admin/ColegioDetalleSecciones.tsx`.
- [ ] T028 Tests: `src/app/api/admin/analytics/colegios/[id]/route.test.ts`.

## Fase 6: User Story 4 — Configuración de umbrales (P2)

**Goal**: ajustar umbrales de hallazgos desde `/dashboard/admin/configuracion`.

- [ ] T029 Añadir sección "Analítica → Colegios" en `ConfigPanel.tsx` (o vista de configuración correspondiente).
- [ ] T030 Tests de recálculo de hallazgos al cambiar un umbral.

## Fase 7: User Story 5 — Exportables CSV (P3)

**Goal**: exportar resumen y detalle a CSV.

- [ ] T031 Evaluar esfuerzo; si cabe, implementar export CSV en resumen y ficha. Si no, documentar deuda técnica.

## Fase 8: Cierre

- [ ] T032 Gate local completo: `tsc`, `lint --no-cache`, `arch:check`, `test`, `build`.
- [ ] T033 Actualizar `spec.md` con estado IMPLEMENTADO y sección Implementación.
- [ ] T034 Crear `cierre.md` con evidencia.
- [ ] T035 Registrar SPEC-194 en `specs/README.md` (ambas tablas).
- [ ] T036 Commit único + push a `work/002-pi-088`; abrir PR a `feature/001-scaffolding`.

## Dependencias y orden

- Fase 2 es bloqueante para Fases 3, 4 y 5.
- Fase 5 depende de Fase 4 (usa repositorio analytics).
- Fase 6 puede ejecutarse en paralelo a Fases 3-5 una vez Fase 2 lista.
- Fase 7 es opcional y va al final.
- Fase 8 siempre al final.
