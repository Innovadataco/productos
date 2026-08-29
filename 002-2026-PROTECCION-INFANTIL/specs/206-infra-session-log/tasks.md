# Tasks — SPEC-206 (002-PI-120)

## Fase 1 — Especificación y diseño
- [x] T001 [P1] Redactar `spec.md` con US/AS/FR/NFR/SC.
- [x] T002 [P1] Redactar `plan.md` con fases, estructura y cambios de código.
- [x] T003 [P1] Crear artefactos auxiliares: `data-model.md`, `research.md`, `quickstart.md`, `contracts/endpoints.md`, `checklists/requirements.md`.
- [ ] T004 [P1] Actualizar `specs/README.md` con SPEC-206 en estado PLANEADO.
- [ ] T005 [P1] Commit + push de spec+plan a `work/002-pi-120` y señal a ZEUS.

## Fase 2 — Migración y schema
- [ ] T006 [P1] Añadir modelo `SesionLog`, enum `MotivoCierreSesion` y valores `AccionAudit` en `prisma/schema.prisma`.
- [ ] T007 [P1] Crear migración aditiva `20260822000000_add_sesion_log`.
- [ ] T008 [P1] Añadir parámetros `sesion.*` en `prisma/seed.ts` con `update: {}`.
- [ ] T009 [P1] Añadir módulo `sesiones_admin` en `src/lib/permisos-catalogo.ts`.
- [ ] T010 [P1] Ejecutar `npx prisma migrate dev` y `npx prisma generate` localmente.

## Fase 3 — Servicio y auth
- [ ] T011 [P1] Crear `src/lib/session-log/session-log-service.ts` con crear/ping/cerrar/listar.
- [ ] T012 [P1] Crear `src/lib/session-log/ip-hash.ts` reutilizando helper anti-abuso.
- [ ] T013 [P1] Modificar `src/lib/auth.ts`: `verifyAuth` rechaza JWT si `sesionLogId` está cerrado.
- [ ] T014 [P1] Modificar `src/app/api/auth/login/route.ts`: registrar sesión e incluir `sesionLogId` en JWT.
- [ ] T015 [P1] Tests de integración para login + sesión.

## Fase 4 — Endpoints
- [ ] T016 [P1] Crear `POST /api/session/ping/route.ts` + rate-limit `session_ping`.
- [ ] T017 [P1] Crear `GET /api/admin/sesiones/route.ts` (listado paginado de activas).
- [ ] T018 [P1] Crear `POST /api/admin/sesiones/[id]/cerrar/route.ts`.
- [ ] T019 [P1] Tests de integración para ping, listado y forzar cierre.

## Fase 5 — Cliente
- [ ] T020 [P1] Crear hook `src/hooks/useSessionPing.ts` con Page Visibility API.
- [ ] T021 [P1] Crear `src/components/providers/SessionPingProvider.tsx`.
- [ ] T022 [P1] Montar provider en layout de dashboard.
- [ ] T023 [P1] Añadir tab "Sesiones" en `EstadisticasSubNav.tsx`.
- [ ] T024 [P1] Crear componente `SesionesTab.tsx` con tabla y acción de forzar cierre.

## Fase 6 — Worker
- [ ] T025 [P1] Crear `scripts/worker-sesiones.mjs` con `ensureQueue`, `boss.schedule` y `boss.work`.
- [ ] T026 [P1] Implementar cierre por inactividad masivo y registro en `AuditLog`.
- [ ] T027 [P1] Test de integración del worker (sesión inactiva -> cerrada).

## Fase 7 — Cierre
- [ ] T028 [P1] Gate local completo: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test`, `build`.
- [ ] T029 [P1] Actualizar `specs/README.md` estado SPEC-206 a IMPLEMENTADO.
- [ ] T030 [P1] Commit único + push a `origin/work/002-pi-120`.
- [ ] T031 [P1] Abrir PR a `feature/001-scaffolding` y esperar CI verde.
- [ ] T032 [P2] Redactar `cierre.md` con evidencia y deuda técnica.
