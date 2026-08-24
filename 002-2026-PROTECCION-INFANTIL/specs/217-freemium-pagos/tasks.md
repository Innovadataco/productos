# Tasks — SPEC-217 (002-PI-117)

> Planificado. No se ejecutan hasta aprobación de ZEUS.

## Fase 1 — Especificación y diseño

- [x] T001 [P1] Redactar artefactos.
- [x] T002 [P1] Commit "docs(SPEC-217/002-PI-117): freemium 30 días".

## Fase 2 — Servicio de freemium

- [ ] T003 [P1] Crear `src/lib/pagos/freemium.service.ts`.
- [ ] T004 [P1] Tests unitarios de activación, histórico y extensión.

## Fase 3 — Integración en flujos

- [ ] T005 [P1] Integrar activación en servicio de creación de `Suscripcion`.
- [ ] T006 [P1] Integrar extensión en servicio de autorización de pago.
- [ ] T007 [P1] Exponer datos freemium en endpoint de suscripción para SPEC-211.

## Fase 4 — Tests de integración

- [ ] T008 [P1] Test de activación al registrar.
- [ ] T009 [P1] Test de anti-doble freemium.
- [ ] T010 [P1] Test de pago durante freemium.

## Fase 5 — Gate y cierre

- [ ] T011 [P1] Gate local completo.
- [ ] T012 [P1] Actualizar `specs/README.md` estado a IMPLEMENTADO.
- [ ] T013 [P1] Redactar `cierre.md`.

## Dependencias y orden

- T003 → T004.
- T005 → T006 → T007 → T008/T009/T010.
