# Tasks — SPEC-245 · Admin activar suscripción manual

## Fase 1 · Specify / Plan
- [x] Escribir `spec.md`, `plan.md`, `tasks.md`.

## Fase 2 · Schema
- [ ] Reutilizar/extender migración de `Suscripcion` + enums (coordinar con SPEC-244).

## Fase 3 · Repositorios y servicios
- [ ] Extender `suscripcion-repository.ts`.
- [ ] Extender `plan-repository.ts`.
- [ ] Crear servicios `admin-activacion-manual.service.ts` y `admin-autorizar-solicitud.service.ts`.

## Fase 4 · Endpoints
- [ ] `POST /api/admin/pagos/activar-manual`.
- [ ] `POST /api/admin/pagos/pendientes/[id]/autorizar`.

## Fase 5 · UI
- [ ] Tab "Sin suscripción" en `/dashboard/admin/pagos`.
- [ ] Modal `ActivarSuscripcionManual`.
- [ ] Enriquecer tab "Pendientes" con autorización.

## Fase 6 · Seed/eventos
- [ ] Sembrar `suscripcion.solicitada` y `suscripcion.activada` idempotentemente.

## Fase 7 · Validate
- [ ] Tests de integración.
- [ ] Gate local.
