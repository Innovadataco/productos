# Tasks — SPEC-244 · Vista `/suscripcion` enriquecida

## Fase 1 · Specify / Plan
- [x] Escribir `spec.md` con User Stories, FR, SC, Edge Cases, Assumptions e Impacto en arquitectura.
- [x] Escribir `plan.md` con pasos de implementación.
- [x] Escribir `tasks.md` con checkboxes.

## Fase 2 · Schema (coordinar con SPEC-245)
- [ ] Extender `Suscripcion` con `origen`, `autorizadoPorAdminId`, `autorizadoEn`, `metodoPagoManual`, `referenciaPagoManual`, `montoRealPagado`, `fechaPagoReal`.
- [ ] Crear enums `OrigenSuscripcion` y `MetodoPagoManual`.
- [ ] Generar migración aditiva con timestamp coordinado con SPEC-245.

## Fase 3 · Repositorios y servicios
- [ ] Extender `suscripcion-repository.ts` con `crearSolicitud()` y `crearFreemium()`.
- [ ] Extender `plan-repository.ts` con `listarActivosPorRol()`.
- [ ] Crear servicio de cálculo de totales e IVA.
- [ ] Crear servicio `freemium-activacion.service.ts` con rate-limit y guard de uso único.

## Fase 4 · Endpoints
- [ ] `POST /api/padre/suscripcion/solicitar-plan`.
- [ ] `POST /api/colegio/suscripcion/solicitar-plan`.
- [ ] `POST /api/padre/suscripcion/activar-freemium`.

## Fase 5 · UI
- [ ] Crear `PlanesSelector` (cielo/pino).
- [ ] Crear `ConfirmarPagoManual`.
- [ ] Crear `EsperandoAutorizacion`.
- [ ] Enriquecer `/dashboard/padre/suscripcion` y `/dashboard/colegio/suscripcion` reutilizando SPEC-211.

## Fase 6 · Seed/eventos
- [ ] Sembrar reglas/plantillas de `suscripcion.solicitada` y `suscripcion.activada` (coordinar con SPEC-245).

## Fase 7 · Validate
- [ ] Tests unitarios de cálculos.
- [ ] Tests de integración de endpoints.
- [ ] Gate local: tsc, lint, arch:check, tokens:check, build.
