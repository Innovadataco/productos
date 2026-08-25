# Tasks — SPEC-245 · Admin activar suscripción manual

## Fase 1 · Specify / Plan
- [x] Escribir `spec.md`, `plan.md`, `tasks.md`.

## Fase 2 · Schema
- [x] Reutilizar/extender migración de `Suscripcion` + enums (coordinar con SPEC-244).
- [x] Agregar valor `SUSCRIPCION_ACTIVADA_MANUAL` a `AccionAudit` (migración aditiva SPEC-245).

## Fase 3 · Repositorios y servicios
- [x] Extender `PagosRepository` con `listarSinSuscripcion` y `listarSolicitudesPendientes`.
- [x] Crear servicios `admin-activacion-manual.service.ts` y `admin-autorizar-solicitud.service.ts`.

## Fase 4 · Endpoints
- [x] `POST /api/admin/pagos/activar-manual`.
- [x] `GET /api/admin/pagos/sin-suscripcion`.
- [x] `GET /api/admin/pagos/solicitudes-pendientes`.
- [x] Extender `POST /api/admin/pagos/pendientes/[id]/autorizar` para soportar suscripciones `PENDIENTE_AUTORIZACION`.

## Fase 5 · UI
- [x] Tab "Sin suscripción" en `/dashboard/admin/pagos`.
- [x] Modal `ActivarSuscripcionManual`.
- [x] Enriquecer tab "Pendientes" con autorización.

## Fase 6 · Seed/eventos
- [x] Alinear payload del evento `suscripcion.activada` con plantillas del seed.
- [x] Alinear payload del evento `suscripcion.solicitada` con plantillas del seed.

## Fase 7 · Validate
- [x] Tests de integración (22/22 verdes).
- [x] Tests unitarios del modal (10/10 verdes).
- [x] Gate local: `tsc` verde, `lint` 0 errores / 49 warnings preexistentes, `tokens:check` verde.
