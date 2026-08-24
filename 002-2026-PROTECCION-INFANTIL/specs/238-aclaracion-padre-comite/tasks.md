# Tasks: SPEC-238 — Aclaración padre-comité

**Branch**: `work/002-pi-padre-lote-core` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Migración y schema

- [x] **T001 [P1]** Crear migración aditiva `prisma/migrations/20260823010000_spec_238_aclaracion_padre_comite/migration.sql` con `AclaracionExpediente`, relaciones inversas y valores `AccionAudit`.
- [x] **T002 [P1]** Añadir modelo `AclaracionExpediente` en `prisma/schema.prisma` respetando el brief §7.4 (`Timestamptz(6)`, `@@unique([expedienteId])`, índices).
- [x] **T003 [P1]** Añadir relaciones inversas en `Expediente`, `InformeConsolidado` y `Usuario`.
- [x] **T004 [P1]** Añadir valores `ACLARACION_SOLICITADA`, `ACLARACION_RESPONDIDA`, `ACLARACION_CERRADA_FORZOSAMENTE` al enum `AccionAudit`.

## Fase 2 — Repositorio DAL

- [x] **T005 [P1]** Crear `src/lib/dal/repositories/aclaracion-repository.ts` con `findById`, `findByExpedienteId`, `crear`, `responder`, `marcarCerradaForzosamente` y soporte de `tx`.
- [x] **T006 [P2]** Crear `src/lib/dal/repositories/aclaracion-repository.test.ts` cubriendo CRUD y restricción única.

## Fase 3 — Servicio de orquestación

- [x] **T007 [P1]** Crear `src/lib/dal/services/aclaracion-expediente.ts` con `solicitarAclaracion`, `responderAclaracion` y `cerrarForzosamente`, usando `withUnitOfWork` y `aplicarTransicion`.
- [x] **T008 [P1]** Integrar publicación best-effort de eventos `expediente.aclaracion.solicitada`, `expediente.aclaracion.respondida` y `expediente.comite.sla_vencido` vía pg-boss.
- [x] **T009 [P1]** Registrar `AuditLog` en cada transición con metadatos (sin textos).
- [x] **T010 [P2]** Crear `src/lib/dal/services/aclaracion-expediente.test.ts` con tests de transacción, idempotencia y validaciones.

## Fase 4 — Endpoints

- [x] **T011 [P1]** Crear `src/app/api/padre/expediente/[id]/pedir-aclaracion/route.ts` (`POST`, `PARENT` titular, validación Zod).
- [x] **T012 [P2]** Crear `src/app/api/padre/expediente/[id]/pedir-aclaracion/route.test.ts` (rol, 409 duplicado, transición atómica).
- [x] **T013 [P1]** Crear `src/app/api/admin/comite/aclaracion/[id]/responder/route.ts` (`POST`, `COMITE_VALIDACION`, validación Zod).
- [x] **T014 [P2]** Crear `src/app/api/admin/comite/aclaracion/[id]/responder/route.test.ts` (rol, 409 re-respuesta, transición atómica).
- [x] **T015 [P1]** Crear `src/app/api/padre/expediente/[id]/cerrar-forzoso/route.ts` (`POST`, `PARENT` o worker secret).
- [x] **T016 [P2]** Crear `src/app/api/padre/expediente/[id]/cerrar-forzoso/route.test.ts` (idempotencia, guardas, transición a `CERRADO`).

## Fase 5 — Worker `pi-expediente-motor`

- [x] **T017 [P1]** Extender `scripts/pi-expediente-motor.mjs` con tick que liste aclaraciones `PENDIENTE` y detecte SLA vencido en zona `America/Bogota`.
- [x] **T018 [P1]** Publicar evento `expediente.comite.sla_vencido` para cada aclaración vencida.
- [x] **T019 [P1]** Consumir/escuchar el evento y llamar a `cerrarForzosamente` con worker secret.
- [x] **T020 [P2]** Crear test del tick SLA con fechas controladas.

## Fase 6 — UI mínima del comité

- [x] **T021 [P2]** Crear `src/app/dashboard/admin/comite/aclaracion/[id]/page.tsx` que muestre la solicitud y formulario de respuesta.
- [x] **T022 [P2]** Integrar llamada a `POST /api/admin/comite/aclaracion/[id]/responder` y manejo de errores.

## Fase 7 — Validación y cierre

> T024–T027 quedan para el coordinador del mega-lote (gate completo, dev-restart, regeneración de docs/architecture y commits serializados); el subagente implementador no los ejecuta.

- [x] **T023 [P1]** Crear test de concurrencia: dos `pedir-aclaracion` simultáneas → una `201`, otra `409`.
- [ ] **T024 [P1]** Ejecutar gate local: `npx tsc --noEmit`, `npm run lint -- --no-cache`, `npm run arch:check`, `npm run test`, `npm run build`.
- [ ] **T025 [P1]** Ejecutar `./scripts/dev-restart.sh` y validar endpoints con `quickstart.md`.
- [ ] **T026 [P1]** Regenerar `docs/architecture` y dejar `npm run arch:check` verde.
- [ ] **T027 [P1]** Commit de docs + código con mensaje imperativo en español; push a `work/002-pi-padre-lote-core`.
