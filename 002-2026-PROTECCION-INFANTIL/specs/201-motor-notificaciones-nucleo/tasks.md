> Planificado. No se ejecutan hasta aprobación de ZEUS.
> DEPENDE DE: SPEC-200 (timezone Bogotá).

# Tareas: SPEC-201 — Motor de Notificaciones · Núcleo (002-PI-098)

## Fase 1: Preparación

- [ ] T001 [P1] Actualizar `specs/README.md` con fila de SPEC-201.

## Fase 2: Modelo de datos y seed

- [ ] T002 [P1] `prisma/schema.prisma`: agregar enums y 5 modelos del motor.
- [ ] T003 [P1] Generar migración aditiva `add_motor_notificaciones`.
- [ ] T004 [P1] `prisma/seed.ts`: agregar plantillas, 6 reglas semilla y 6 parámetros.

## Fase 3: API pública del motor

- [ ] T005 [P1] `src/lib/notificaciones/calcular-envio.ts`: cálculo de `enviarEn` con `date-fns-tz` + offset + quiet hours.
- [ ] T006 [P1] `src/lib/notificaciones/render-plantilla.ts`: render markdown con variables.
- [ ] T007 [P1] `src/lib/notificaciones/quiet-hours.ts`: parseo de `notificaciones.horario.silencio`.
- [ ] T008 [P1] `src/lib/notificaciones/preferencias.ts`: preferencias efectivas.
- [ ] T009 [P1] `src/lib/notificaciones/motor.ts`: implementar `programar`, `cancelar`, `estado`, `recalcular`.

## Fase 4: Worker

- [ ] T010 [P1] `scripts/worker-notificaciones.mjs`: advisory lock + loop de poll.
- [ ] T011 [P1] Worker: query de cola con límite y orden.
- [ ] T012 [P1] Worker: envío email vía Resend con tracking.
- [ ] T013 [P1] Worker: envío in-app vía `NotificacionInAppRepository`.
- [ ] T014 [P1] Worker: reintentos con backoff y quiet hours.
- [ ] T015 [P1] Worker: bounce tracking.

## Fase 5: Webhook y infra

- [ ] T016 [P1] `src/app/api/webhooks/resend/route.ts`: idempotente, actualiza estados.
- [ ] T017 [P1] `src/app/api/webhooks/resend/route.test.ts`.
- [ ] T018 [P1] `docker-compose.prod.yml`: servicio `pi-notificaciones`.

## Fase 6: Tests

- [ ] T019 [P1] Tests unitarios de helpers.
- [ ] T020 [P1] `src/lib/notificaciones/motor.test.ts`.

## Fase 7: Gate y cierre

- [ ] T021 [P1] Gate local completo.
- [ ] T022 [P1] Completar sección Implementación en `spec.md` y crear `cierre.md`.
