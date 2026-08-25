# Tasks — SPEC-246 · Bonos recompensa transferibles

## Fase 1 · Specify / Plan
- [x] Escribir `spec.md`, `plan.md`, `tasks.md`.

## Fase 2 · Schema
- [ ] Extender `BonoPromocional` y crear enum `OrigenBono`.

## Fase 3 · Servicios
- [ ] Extender `bono-promocional-repository.ts`.
- [ ] Crear `entregar-cupones-recompensa.service.ts`.

## Fase 4 · Trigger
- [ ] Cablear entrega en autorización SPEC-245.

## Fase 5 · UI
- [ ] Crear `MisCuponesCard`.
- [ ] Integrar en `/dashboard/padre/suscripcion`.
- [ ] Filtro `origen` en admin `/dashboard/admin/bonos`.

## Fase 6 · Aplicación
- [ ] Ajustar `AplicarBonoCard` para `transferible`.

## Fase 7 · Seed/eventos
- [ ] Sembrar `pagos.recompensa.*` y `bono.entregado_recompensa`.

## Fase 8 · Validate
- [ ] Tests.
- [ ] Gate local.
