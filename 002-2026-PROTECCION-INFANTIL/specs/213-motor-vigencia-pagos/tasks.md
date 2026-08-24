# Tasks — SPEC-213 (002-PI-113)

> Planificado. No se ejecutan hasta aprobación de ZEUS.

## Fase 1 — Especificación y diseño

- [x] T001 [P1] Redactar `spec.md` con US/AS/FR/NFR/SC y deuda.
- [x] T002 [P1] Redactar `plan.md` con fases, estructura y cambios de código.
- [x] T003 [P1] Crear artefactos auxiliares.
- [x] T004 [P1] Commit "docs(SPEC-213/002-PI-113): motor vigencia y estados".

## Fase 2 — Servicio de vigencia

- [x] T005 [P1] Crear `src/lib/pagos/vigencia.service.ts` con lógica de transiciones y programación de eventos.
- [x] T006 [P1] Extender `PagosRepository` con métodos de consulta de candidatas y transición.
- [x] T007 [P1] Tests unitarios/integración de `vigencia.service.ts`. (16 tests unitarios con repo/motor/audit mockeados; los de integración con BD los corre el coordinador.)

## Fase 3 — Worker

- [x] T008 [P1] Crear `scripts/worker-vigencia-pagos.mjs` con advisory lock y scheduling. (Lock id **123456792**; 123456791 quedó reservado por otro worker del lote.)
- [x] T009 [P1] Agregar servicio `pi-vigencia` a `docker-compose.yml` y `docker-compose.prod.yml`.
- [x] T010 [P1] Tests del worker: transiciones, idempotencia, lock. (Transiciones e idempotencia cubiertas en `vigencia.service.test.ts`; el scheduling/cron se cubre con tests de `horaCorridaACron`. El comportamiento del advisory lock —segundo intento sale con código 2— se verifica por quickstart SC-001: el script no es importable sin ejecutarse, patrón igual a `worker-tasas.mjs`, que tampoco tiene test propio.)

## Fase 4 — Seed y parámetros

- [x] T011 [P1] Sembrar `pagos.vigencia.hora_corrida` en seed de pagos. (Función `seedParametrosVigenciaPagos()` con `update: {}` para no pisar la hora ajustada por el admin.)
- [x] T012 [P1] Verificar catálogo de eventos del motor notif; documentar faltantes.
  - **HALLAZGO**: el seed de SPEC-201 define `suscripcion.por_vencer` (offset -5d/-1d), `suscripcion.en_gracia` (+2d) y `suscripcion.cortada` (+3d) — nombres DISTINTOS del catálogo §10 que emite este worker (`suscripcion.por_vencer.T_menos_5`, `.T_menos_1`, `suscripcion.vencida.T_0`, `suscripcion.gracia.T_mas_2`, `suscripcion.cortada.T_mas_3`).
  - **HALLAZGO**: no existe ninguna regla/plantilla sembrada para `suscripcion.freemium.T_menos_7`, `suscripcion.freemium.T_menos_1` ni `suscripcion.freemium.terminado`.
  - Resultado: los 8 eventos del worker quedan sin reglas activas → `motor.programar()` loguea warning y programa 0 (fail-open FR-012; las transiciones y el AuditLog NO se bloquean). El servicio verifica el catálogo al inicio de cada corrida y loguea los faltantes. Pendiente: que SPEC-201/seed agregue las reglas/plantillas del catálogo §10 con los nombres del contrato, o que se alineen los nombres (decisión de ZEUS).

## Fase 5 — Gate y cierre

- [ ] T013 [P1] Gate local completo.
- [ ] T014 [P1] Actualizar `specs/README.md` estado a IMPLEMENTADO (post-aprobacional).
- [ ] T015 [P1] Redactar `cierre.md`.

## Dependencias y orden

- T005 → T007.
- T006 → T005.
- T008 → T005/T009.
- T010 → T008.
- T011 → T012 → T013.
