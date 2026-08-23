# TASKS — SPEC-235 · Guías de acción parametrizables

## Fase 1 — Schema y migración

- [ ] T001 [P] Extender `prisma/schema.prisma`: enum `EstadoGuiaAccion`, modelo `GuiaAccionCategoria`, relación inversa `guiasAccionCreadas` en `Usuario`, 7 valores nuevos en `AccionAudit`.
- [ ] T002 Crear migración aditiva `prisma/migrations/20260822xx_add_guia_accion_categoria/migration.sql` con `CREATE TYPE`, `CREATE TABLE`, FKs, índices e índice único parcial `WHERE estado='ACTIVA'`.
- [ ] T003 [P] Ejecutar `npx prisma migrate dev` y verificar que el cliente genera tipos sin errores.

## Fase 2 — Seed y parámetros

- [ ] T004 [P] Añadir parámetro `padre.comite.miembros_minimos_aprobacion` (INTEGER, default 2) en `prisma/seed.ts` de forma idempotente.
- [ ] T005 [P] Añadir seed idempotente de 8 guías ACTIVA v1 en `prisma/seed.ts`: `GROOMING`, `SEXTORSION`, `DIFUSION_NO_CONSENTIDA`, `EXTORSION`, `DOXING`, `CIBERACOSO`, `SOLICITUD_ENCUENTRO`, `COMPARTIMIENTO_SEXUAL`; todas marcadas como contenido preliminar.

## Fase 3 — DAL y validadores

- [ ] T006 [P] Crear `src/lib/dal/repositories/guia-accion-repository.ts` con CRUD, transiciones, reemplazo de activa, consulta pública y soporte de tx.
- [ ] T007 Crear validadores Zod para payloads de guía, pasos, botones y votos (ej. `src/lib/schemas/guia-accion.ts`).
- [ ] T008 Crear helper de transiciones de estado `src/lib/guias-accion/estado.ts` con máquina de estados explícita.

## Fase 4 — Endpoints admin

- [ ] T009 [P] Crear `src/app/api/admin/guias-accion/route.ts` (POST crear guía en BORRADOR, solo ADMIN).
- [ ] T010 [P] Crear `src/app/api/admin/guias-accion/[id]/route.ts` (PATCH editar BORRADOR, solo ADMIN).
- [ ] T011 [P] Crear `src/app/api/admin/guias-accion/[id]/enviar-comite/route.ts` (POST BORRADOR → PENDIENTE_APROBACION_COMITE).
- [ ] T012 [P] Crear `src/app/api/admin/comite/guias-accion/[id]/aprobar/route.ts` (POST voto de aprobación, solo COMITE_VALIDACION).
- [ ] T013 [P] Crear `src/app/api/admin/comite/guias-accion/[id]/rechazar/route.ts` (POST rechazo con motivo, solo COMITE_VALIDACION).
- [ ] T014 [P] Crear `src/app/api/admin/guias-accion/[id]/preview/route.ts` (GET preview, solo ADMIN).

## Fase 5 — Endpoint público

- [ ] T015 [P] Crear `src/app/api/publico/guia-accion/categoria/[cat]/route.ts` (GET solo ACTIVA, rate-limit scope `guias_accion_publica`).

## Fase 6 — UI admin

- [ ] T016 Crear `src/app/dashboard/admin/configuracion/guias-accion/page.tsx` reutilizando layout de configuración (D-72: secciones Ámbar/Cielo).
- [ ] T017 Crear componentes `src/components/modules/guias-accion/` (editor de pasos/botones, preview, listado, badge de estado).
- [ ] T018 Añadir sección de aprobación en `/dashboard/admin/comite/guias-pendientes` (o ruta equivalente) listando guías pendientes con acciones aprobar/rechazar.

## Fase 7 — Tests

- [ ] T019 [P] `src/lib/dal/repositories/guia-accion-repository.test.ts` — CRUD, transiciones, reemplazo de activa.
- [ ] T020 [P] Tests de integración para endpoints admin (`route.test.ts` junto a cada `route.ts`).
- [ ] T021 [P] Test de índice parcial único: intentar activar segunda guía de la misma categoría debe fallar con `P2002`/409.
- [ ] T022 [P] Test de transiciones de estado: intentos inválidos (ej. ACTIVA → BORRADOR) devuelven 409.
- [ ] T023 [P] Test de aprobación multi-miembro: con default 2, una sola aprobación no publica; la segunda publica.
- [ ] T024 [P] Test de endpoint público: solo devuelve ACTIVA; BORRADOR/PENDIENTE/REEMPLAZADA responden 404; rate-limit devuelve 429.
- [ ] T025 [P] Test de seed idempotente: reejecutar seed no sobrescribe guías con contenido custom.

## Fase 8 — Cierre

- [ ] T026 Actualizar artefactos Spec-Kit: `spec.md` (sección Implementación), `cierre.md` si aplica.
- [ ] T027 Gate local: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, `./scripts/dev-restart.sh`.
- [ ] T028 Commit con mensaje en español imperativo y señal ZEUS al finalizar.
