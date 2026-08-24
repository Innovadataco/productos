# Tasks: SPEC-239 — Escalación ROJO + SLA 12h + Contacto emergencia

**Branch**: `work/002-pi-padre-lote-core` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Migración, seed y repositorios base

- [x] **T001 [P1]** Crear migración aditiva `prisma/migrations/20260822010000_spec_239_contacto_emergencia/migration.sql` con `ContactoEmergencia`, relación inversa en `Usuario` y valores nuevos de `AccionAudit`.
- [x] **T002 [P1]** Añadir parámetro `padre.comite.sla_horas_gravedad_roja = 12` en `prisma/seed.ts` (idempotente, categoría SYSTEM).
- [x] **T003 [P1]** Añadir seed idempotente del Motor Notif para el evento `expediente.emergencia.activada` con plantilla en español.
- [x] **T004 [P1]** Crear `src/lib/dal/repositories/contacto-emergencia.ts` con `findActivosPorPadre`, `findByIdAndPadre`, `crear`, `actualizar`, `eliminar` (o baja lógica).
- [x] **T005 [P1]** Extender `src/lib/dal/repositories/expediente.ts` con `marcarEscaladoRojo(expedienteId, datos)`.
- [x] **T006 [P2]** Tests de integración para `ContactoEmergenciaRepository` y `expedienteRepository.marcarEscaladoRojo()`.

## Fase 2 — Handler `expediente.gravedad.subio_a_rojo`

- [x] **T007 [P1]** Crear `src/lib/expediente/handlers/gravedad-subio-a-rojo.ts` que fije SLA 12h, programe notificación urgente admin/CEO y audite `EXPEDIENTE_ESCALADO_A_ROJO`.
- [x] **T008 [P1]** Integrar handler en el bus de eventos del Motor de Estados (SPEC-236).
- [x] **T009 [P2]** Test unitario/integración del handler: SLA reducido, notificación programada, `AuditLog` CRITICAL.

## Fase 3 — Activación de emergencia (backend)

- [x] **T010 [P1]** Crear servicio `src/lib/expediente/activar-emergencia.ts` con lógica de selección de contacto, fallback 2/3, programación de notificación, publicación de evento y auditoría.
- [x] **T011 [P1]** Crear `src/app/api/admin/comite/expediente/[id]/activar-emergencia/route.ts` (rol `COMITE_VALIDACION`, validación ROJO, ownership).
- [x] **T012 [P2]** Tests de integración del endpoint: éxito, no ROJO, sin contactos, fallback de prioridad.

## Fase 4 — CRUD de contactos de emergencia

- [x] **T013 [P1]** Añadir schemas Zod en `src/lib/schemas/index.ts`: `relacionContactoEmergenciaSchema`, `contactoEmergenciaBodySchema`, `contactoEmergenciaUpdateSchema` (validación E.164).
- [x] **T014 [P1]** Crear `src/app/api/padre/contacto-emergencia/route.ts` (`GET`, `POST`, rol `PARENT`, ownership).
- [x] **T015 [P1]** Crear `src/app/api/padre/contacto-emergencia/[id]/route.ts` (`PATCH`, `DELETE`, rol `PARENT`, ownership).
- [x] **T016 [P2]** Tests de integración para CRUD: éxito, cross-user leak, teléfono inválido, baja lógica.

## Fase 5 — Extensión del worker `pi-expediente-motor`

- [x] **T017 [P1]** Extender el tick del worker `pi-expediente-motor` (SPEC-236/D-72) para detectar expedientes ROJO `PENDIENTE_COMITE`/`EN_APROBACION_PADRE` con >12h en Bogotá.
- [x] **T018 [P1]** Publicar evento `expediente.comite.sla_vencido`, programar notificación CRITICAL y auditar `EXPEDIENTE_COMITE_SLA_VENCIDO`.
- [x] **T019 [P2]** Tests del tick con reloj mockeado y BD de prueba.

## Fase 6 — UI botón "activar emergencia"

- [x] **T020 [P1]** Añadir botón "activar emergencia" en `src/app/admin/comite/consolidacion/[id]/page.tsx` visible solo si `scoreGravedadActual === ROJO`, color ruby.
- [x] **T021 [P1]** Reutilizar componente crítico existente para el modal de confirmación.
- [x] **T022 [P2]** Tests de componente: visible solo en ROJO, modal confirma/cancela, llamada a endpoint.

## Fase 7 — Seed idempotencia y catálogo

- [x] **T023 [P1]** Verificar idempotencia de `prisma/seed.ts` ejecutándolo dos veces sin duplicados.
- [x] **T024 [P1]** Validar que la plantilla `expediente.emergencia.activada` renderiza correctamente sus variables; la notificación admin/CEO al subir a ROJO usa la plantilla existente `expediente.gravedad.subio_a_rojo` de SPEC-236.
- [x] **T025 [P2]** Test de template variables para `expediente.emergencia.activada`.

## Fase 8 — Cierre

- [ ] **T026 [P1]** Regenerar docs de arquitectura (`npm run arch:generate`) y dejar `npm run arch:check` verde.
- [ ] **T027 [P1]** Gate local completo: `npx tsc --noEmit`, `npm run lint -- --no-cache`, `npm run arch:check`, `npm run test`, `npm run build`, `./scripts/dev-restart.sh`.
- [x] **T028 [P1]** Verificar que no se modificó `src/lib/ai/**` ni el código del Motor Notif.
- [ ] **T029 [P1]** Ejecutar quickstart.md paso a paso y documentar resultados.
- [x] **T030 [P1]** Escribir `cierre.md` con resumen de cambios, decisiones, gate y deuda técnica.
