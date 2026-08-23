> Planificado. No se ejecutan hasta aprobación de ZEUS.
> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Tareas: SPEC-204 — Piloto Migración Bienvenida Colegio (002-PI-101)

## Fase 1: Preparación

- [ ] T001 [P1] Actualizar `specs/README.md` con fila de SPEC-204.

## Fase 2: Seed

- [ ] T002 [P1] `prisma/seed.ts`: agregar plantilla `colegio.bienvenida.email`.
- [ ] T003 [P1] `prisma/seed.ts`: agregar regla `colegio.bienvenida` obligatoria.

## Fase 3: Migración de rutas

- [ ] T004 [P1] `src/app/api/admin/colegios/route.ts`: reemplazar `enviarEmailBienvenidaColegio` por `motor.programar`.
- [ ] T005 [P1] `src/app/api/admin/colegios/[id]/reenviar-email/route.ts`: reemplazar `enviarEmailBienvenidaColegio` por `motor.programar`.

## Fase 4: Tests

- [ ] T006 [P1] Actualizar `src/app/api/admin/colegios/route.test.ts`.
- [ ] T007 [P1] Actualizar `src/app/api/admin/colegios/[id]/reenviar-email/route.test.ts`.
- [ ] T008 [P1] Añadir caso de bienvenida colegio a `src/lib/notificaciones/motor.test.ts`.

## Fase 5: Limpieza

- [ ] T009 [P1] Marcar `@deprecated` o eliminar `enviarEmailBienvenidaColegio` en `src/lib/email.ts`.

## Fase 6: Gate y cierre

- [ ] T010 [P1] Gate local completo.
- [ ] T011 [P1] Completar sección Implementación en `spec.md` y crear `cierre.md`.
