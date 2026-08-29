# Tasks: SPEC-173 — Módulo Colegio: restructura nav por rol + fixes H01-H06

**Input**: `specs/173-restructura-nav-colegio/{spec,plan,data-model,quickstart}.md`
**Compuerta §4**: APROBADA por ZEUS (2026-08-18) con candados A/B: (A) H02 = union UUID+CUID; (B) `/comite/integrantes` excluido del predicado del comité.

## Phase 1: Schemas + API (base de H01/H02)

- [ ] **T001** [US4] `src/lib/schemas/index.ts`: `cursoMateriaBodySchema.materiaId` y `cursoMateriaIdParamsSchema.materiaId` → `z.union([cuidIdSchema, z.string().uuid()])` (candado A). `profesorId` intacto.
- [ ] **T002** [US3] `src/lib/schemas/index.ts`: `alertaBatchSchema.accion` → `z.enum(["vista"])` (batch final del rector = solo "Revisar en lote"; `escalada` prohibida → 400).
- [ ] **T003** [P] [US4] Tests API `src/app/api/colegio/cursos/[id]/materias/route.test.ts`: asignar materia con id UUID (backfill) → 201; con id CUID → 201; formato inválido → 400.
- [ ] **T004** [P] [US3] Tests API `src/app/api/colegio/alertas/route.test.ts`: batch con `accion: "escalada"` → 400; batch `vista` sigue marcando N como vistas. Actualizar tests que usaban acciones retiradas del batch.

## Phase 2: UI alertas (H06 + H01 modales) — depende de T002

- [ ] **T005** [US8] `src/app/dashboard/colegio/alertas/AlertasColegioPageClient.tsx`: tarjeta con exactamente 3 acciones (Revisar si `nueva` · Resolver aquí · Escalar al Comité); retirar Asignar/Reasignar/Desasignar/Cerrar y modal de asignación; barra batch solo "Revisar en lote"; chips de estado con tooltip en criollo (nueva/vista/gestionada/escalada/cerrada).
- [ ] **T006** [US3] `src/components/modules/colegio/alertas/EscalarAlertaModal.tsx` (NUEVO): motivo obligatorio (`z.string().trim().min(1).max(2000)`), POST `/api/colegio/alertas/[id]/escalar` con `{"motivo": "..."}`.
- [ ] **T007** [US8] `src/components/modules/colegio/alertas/ResolverAlertaModal.tsx` (NUEVO): nota de bitácora obligatoria → alerta `gestionada` + nota en `SeguimientoCaso` (reusar endpoint/servicio de notas SPEC-159: `src/app/api/colegio/alertas/[id]/notas` + cambio de estado, o endpoint `resolver` que haga ambas en una transacción).
- [ ] **T008** [P] [US8] Test unit `src/app/dashboard/colegio/alertas/AlertasColegioPageClient.test.tsx` (NUEVO): fija 3 botones individuales + 1 batch + tooltips + ausencia de Asignar/Cerrar.

## Phase 3: Nav + proxy (Bloque A, A1-A3)

- [ ] **T009** [US1] `src/lib/nav-items.ts`: `COLEGIO_NAV_ITEMS` = 8 items exactos (Inicio · Estadísticas · Alertas · Cursos · Casos comité · Usuarios[Profesores, Comité de convivencia] · Configuración · Auditoría); `NavItem` + `children?: NavItem[]`; nuevo `COMITE_COLEGIO_NAV_ITEMS` (3 items, modulo `colegios_comite_bandeja`). Retirar Onboarding/Materias/Subir lista del array.
- [ ] **T010** [US1] `src/components/modules/colegio/ColegioSideNav.tsx`: rama por rol (comité → array de 3); nodo "Usuarios" expandible (useState + aria-expanded/controls, auto-expandido si ruta activa hija); iconos nuevos en `ICONS` para las rutas que caen al default.
- [ ] **T011** [US2] `src/lib/proxy.ts`: `homeForRole` COMITE_CONVIVENCIA → `/dashboard/colegio/comite`; predicado del comité excluye `/dashboard/colegio/comite/integrantes` y `/api/colegio/comite/integrantes` (candado B); SCHOOL_ADMIN sin cambios.
- [ ] **T012** [P] [US2] `src/lib/proxy.test.ts`: cobertura COMITE_CONVIVENCIA (home nueva, integrantes 403, estadísticas ok, rutas rector 403) + rector accede integrantes.
- [ ] **T013** [P] [US1] Test unit `src/components/modules/colegio/ColegioSideNav.test.tsx` (NUEVO): rector ve 8 items con Usuarios expandible; comité ve 3; Onboarding/Materias/Subir lista ausentes.

## Phase 4: Comité (A4-A6) — depende de T011

- [ ] **T014** [US1] `src/app/dashboard/colegio/comite/integrantes/page.tsx` (NUEVO): mover contenido actual de `comite/page.tsx` (guard SCHOOL_ADMIN + `ComiteCuentaCard` + `IntegrantesList`).
- [ ] **T015** [US2] `src/app/dashboard/colegio/comite/page.tsx`: SCHOOL_ADMIN → `redirect("/dashboard/colegio/comite/integrantes")`; COMITE_CONVIVENCIA → home nueva `ComiteHome`.
- [ ] **T016** [US2] `src/components/modules/colegio/comite/ComiteHome.tsx` (NUEVO): casos abiertos, mis pendientes, SLA — reusando `ComiteConvivenciaBandejaService`; sin texto de reporte ni denunciante.
- [ ] **T017** [US2] `src/app/api/colegio/comite/estadisticas/route.ts` (NUEVO) + `src/app/dashboard/colegio/comite/estadisticas/page.tsx` (NUEVO) + `src/components/modules/colegio/comite/ComiteEstadisticas.tsx` (NUEVO): casos por estado, tiempo medio de resolución, top categorías escaladas; `verifyAuth` comité + `assertModulo("colegios_comite_bandeja")`; solo agregados.
- [ ] **T018** [P] [US2] Test API `src/app/api/colegio/comite/estadisticas/route.test.ts` (NUEVO): agregados correctos, aislamiento `colegioId`, sin PII, 403 a rector sin módulo/otros roles.

## Phase 5: H03 + H04 + H05

- [ ] **T019** [US5] `src/app/dashboard/colegio/profesores/[id]/ProfesorDetallePageClient.tsx`: verificar/alinear shape de `GET /api/plataformas`; reemplazar `catch(() => {})` por estado de error visible; submit deshabilitado con hint si `plataformas.length === 0`.
- [ ] **T020** [US6] `src/lib/dal/repositories/alerta-colegio.ts`: `contarPorTipoSujeto(colegioId)` (groupBy tipoSujeto, ESTADOS_VISIBLES); `src/lib/colegio/inteligencia.ts`: + `alertasPorTipoSujeto` en DTO; `src/app/dashboard/colegio/estadisticas/ColegioEstadisticasPageClient.tsx`: sección visible del desglose.
- [ ] **T021** [P] [US6] Test: `src/app/api/colegio/estadisticas/route.test.ts` incluye `alertasPorTipoSujeto` con conteos correctos por colegio.
- [ ] **T022** [US7] `src/app/api/colegio/onboarding/route.ts`: + `resumen {estudiantes, cursos, profesores}` cuando `estado === "completado"`; `src/app/dashboard/colegio/onboarding/page.tsx`: rama completado → tarjeta resumen + CTA a `/dashboard/colegio` (sin tocar OnboardingModal para otros estados).
- [ ] **T023** [P] [US7] Test: onboarding completado devuelve resumen y la página lo renderiza (unit del componente o integration del endpoint).

## Phase 6: Arquitectura + cierre

- [ ] **T024** Regenerar `docs/architecture/` (`npx tsx scripts/arch/generar-pantallas.ts` + generadores afectados por proxy/nav/rutas) → `npm run arch:check` VERDE.
- [ ] **T025** Gate local completo: `npx tsc --noEmit` + `npm run lint` + `npm run arch:check` + `npm run test:unit` + `npm run test:integration` + `npm run test:journeys` + `npm run build`.
- [ ] **T026** Actualizar `specs/README.md` (fila SPEC-173 en las DOS tablas) + sección Implementación en `spec.md` + `cierre.md` con evidencia.

**Orden de dependencias**: T001/T002 → T003/T004 → T005-T008 · T009-T013 · T014-T018 (tras T011) · T019-T023 → T024 → T025 → T026.
