# Tasks — SPEC-246 · Bonos recompensa transferibles

## Fase 1 · Specify / Plan
- [x] Escribir `spec.md`, `plan.md`, `tasks.md`.

## Fase 2 · Schema
- [x] Extender `BonoPromocional` y crear enum `OrigenBono` (migración compartida del mega-lote).

## Fase 3 · Servicios
- [x] Extender `PagosRepository` con métodos de recompensa.
- [x] Crear `entregar-cupones-recompensa.service.ts`.

## Fase 4 · Trigger
- [x] Cablear entrega en `admin-activacion-manual.service.ts` y `admin-autorizar-solicitud.service.ts`.

## Fase 5 · UI
- [x] Crear `MisCuponesCard`.
- [x] Integrar en `/dashboard/padre/suscripcion`.
- [x] Filtro `origen` en admin `/dashboard/admin/bonos`.

## Fase 6 · Aplicación
- [x] Ajustar `validarCodigoBono` y `aplicarBonoPromocional` para `transferible`.

## Fase 7 · Seed/eventos
- [x] Sembrar plantillas/reglas de `bono.entregado_recompensa` (parámetros ya sembrados en SPEC-244/245).

## Fase 8 · Validate
- [x] Tests (integración + unitarios).
- [x] Gate local: `tsc`, `lint`, `tokens:check` verdes; `arch:check` rojo por drift (se regenera en SPEC-247).
