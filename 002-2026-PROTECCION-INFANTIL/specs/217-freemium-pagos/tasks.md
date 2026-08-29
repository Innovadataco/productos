# Tasks — SPEC-217 (002-PI-117)

> Planificado. No se ejecutan hasta aprobación de ZEUS.

## Fase 1 — Especificación y diseño

- [x] T001 [P1] Redactar artefactos.
- [x] T002 [P1] Commit "docs(SPEC-217/002-PI-117): freemium 30 días".

## Fase 2 — Servicio de freemium

- [x] T003 [P1] Crear `src/lib/pagos/freemium.service.ts`.
- [x] T004 [P1] Tests unitarios de activación, histórico y extensión.

## Fase 3 — Integración en flujos

- [x] T005 [P1] Integrar activación en servicio de creación de `Suscripcion`.
- [x] T006 [P1] Integrar extensión en servicio de autorización de pago.
- [x] T007 [P1] Exponer datos freemium en endpoint de suscripción para SPEC-211.

## Fase 4 — Tests de integración

- [x] T008 [P1] Test de activación al registrar.
- [x] T009 [P1] Test de anti-doble freemium.
- [x] T010 [P1] Test de pago durante freemium.

## Fase 5 — Gate y cierre

- [x] T011 [P1] Gate local completo.
- [ ] T012 [P1] Actualizar `specs/README.md` estado a IMPLEMENTADO. (bloqueado: archivo congelado por el coordinador del mega-lote)
- [x] T013 [P1] Redactar `cierre.md`.

## Dependencias y orden

- T003 → T004.
- T005 → T006 → T007 → T008/T009/T010.

## Notas de implementación (2026-08-24)

- T005: no existía un servicio de creación de `Suscripcion` en producción (solo
  el repositorio y tests). Se implementó `crearSuscripcionCliente` en
  `freemium.service.ts` como el servicio compartido canónico que pedía la
  Deuda técnica 4 de la spec; los futuros flujos de registro de cliente y
  creación admin deben consumirlo.
- T004: activación e histórico se cubren con tests unitarios del servicio con
  dependencias mockeadas (patrón `vigencia.service.test.ts`) y con los tests
  de integración T008/T009.
- Migración `20260824100000_spec_217_freemium`: índices aditivos del
  data-model + valores de `AccionAudit` (`SUSCRIPCION_FREEMIUM_ACTIVADA`,
  `SUSCRIPCION_FREEMIUM_CONVERTIDA`).
- Hallazgo preexistente corregido (SPEC-215): `generarCodigoReferidoUnico`
  llamaba `PagosRepository.existeCodigoReferidoPropio`, método inexistente
  (tsc roto en todo el árbol). Se añadió a `PagosReferidosRepository` y se
  ajustó la firma; además dos fixtures de tests de SPEC-215 creaban
  suscripciones sin el obligatorio `codigoReferidoPropio`.
- T012 bloqueado: `specs/README.md` está en la lista de archivos que el
  coordinador del mega-lote congeló; el cambio de estado lo aplica él.
- Tests de integración (T008-T010) escritos pero NO corridos localmente: la
  BD compartida la gestiona el coordinador.
