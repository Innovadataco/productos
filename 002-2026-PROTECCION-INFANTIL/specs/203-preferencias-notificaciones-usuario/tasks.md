> Planificado. No se ejecutan hasta aprobación de ZEUS.
> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Tareas: SPEC-203 — Preferencias de Notificaciones del Usuario (002-PI-100)

## Fase 1: Preparación

- [ ] T001 [P1] Actualizar `specs/README.md` con fila de SPEC-203.

## Fase 2: API y helpers

- [ ] T002 [P1] `src/lib/notificaciones/preferencias.ts`: helpers de lectura/escritura.
- [ ] T003 [P1] `src/app/api/notificaciones/preferencias/route.ts`.
- [ ] T004 [P1] `src/lib/dal/repositories/notificacion.ts`: listar por destinatario.

## Fase 3: Centro de notificaciones unificado

- [ ] T005 [P1] `src/components/modules/notificaciones/CentroNotificaciones.tsx`.
- [ ] T006 [P1] `src/app/api/notificaciones/route.ts`.
- [ ] T007 [P1] Reemplazar/usar el nuevo centro donde corresponda.

## Fase 4: Panel de preferencias UI

- [ ] T008 [P1] `src/app/dashboard/perfil/notificaciones/page.tsx`.
- [ ] T009 [P1] `src/components/modules/perfil/PreferenciasNotificaciones.tsx`.

## Fase 5: Integración con motor

- [ ] T010 [P1] `src/lib/notificaciones/motor.ts`: consultar preferencias antes de programar.

## Fase 6: Tests

- [ ] T011 [P1] Tests de API de preferencias.
- [ ] T012 [P1] Tests de helpers.
- [ ] T013 [P1] Tests del componente de preferencias.

## Fase 7: Gate y cierre

- [ ] T014 [P1] Gate local completo.
- [ ] T015 [P1] Completar sección Implementación en `spec.md` y crear `cierre.md`.
