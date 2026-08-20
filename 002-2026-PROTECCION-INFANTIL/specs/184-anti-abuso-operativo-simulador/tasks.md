# Tasks: SPEC-184 — Anti-abuso operativo + simulador de abusos

**Branch**: `work/002-pi-079` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Migración, seed y repositorios base

- [ ] **T001 [P1]** Crear migración aditiva `prisma/migrations/20260819010000_spec_184_anti_abuso_operativo/migration.sql` con `BlockList`, `SimulacionAbusoRun`, nuevos valores `AccionAudit` y relación en `Usuario`.
- [ ] **T002 [P1]** Añadir 4 parámetros `alerts.ratelimit.*` en `prisma/seed.ts` (idempotente, categoría SYSTEM).
- [ ] **T003 [P1]** Crear `src/lib/dal/repositories/block-list.ts` con findByIpHash, findPaginadosVigentes, crear, eliminar.
- [ ] **T004 [P1]** Crear `src/lib/dal/repositories/simulacion-abuso.ts` con CRUD de corridas y búsqueda por estado.
- [ ] **T005 [P1]** Crear `src/lib/dal/repositories/rate-limit.ts` con agregados para tops de IPs bloqueadas y conteo de bloqueos por hora.
- [ ] **T006 [P2]** Tests de integración para `BlockListRepository` y `SimulacionAbusoRepository`.

## Fase 2 — BlockList y rate-limit

- [ ] **T007 [P1]** Crear `src/lib/anti-abuso/block-list.ts` con `estaBloqueada`, `bloquearIp`, `desbloquearIp` + `AuditLog`.
- [ ] **T008 [P1]** Modificar `src/lib/rate-limit.ts` para consultar `BlockList` antes de contar; IP baneada → 429 sin gastar cuota.
- [ ] **T009 [P1]** Test en `src/lib/rate-limit.test.ts`: IP baneada recibe 429 y no incrementa `RateLimit`.
- [ ] **T010 [P2]** Test de fail-open de BlockList ante error de BD.

## Fase 3 — Tablero operativo (backend)

- [ ] **T011 [P1]** Crear `src/lib/anti-abuso/tablero.ts` que orqueste agregados de IPs, identificadores, fingerprints y alertas activas.
- [ ] **T012 [P1]** Crear `src/app/api/admin/anti-abuso/tablero/route.ts` (`GET`, ADMIN, `assertModulo anti_abuso`).
- [ ] **T013 [P1]** Crear `src/app/api/admin/anti-abuso/bloquear/route.ts` (`POST`, validación Zod, audit).
- [ ] **T014 [P1]** Crear `src/app/api/admin/anti-abuso/desbloquear/route.ts` (`POST`, validación Zod, audit).
- [ ] **T015 [P2]** Tests de integración para los 3 endpoints.

## Fase 4 — Tablero operativo (UI)

- [ ] **T016 [P1]** Crear `src/components/modules/anti-abuso/AdminAntiAbusoOperativo.tsx` con tops, selector de ventana, botones bloquear/desbloquear y alertas activas.
- [ ] **T017 [P1]** Modificar `src/app/dashboard/admin/anti-abuso/page.tsx` para renderizar tabs: Operativo, Simulador, Scoring por fuente.
- [ ] **T018 [P2]** Tests de componente para `AdminAntiAbusoOperativo`.

## Fase 5 — Alertas rate-limit throttled

- [ ] **T019 [P1]** Crear `src/lib/anti-abuso/rate-limit-alerts.ts` con `evaluarAlertaRateLimit` (cuenta bloqueos/hora, abre/actualiza `IncidenteInfra`, throttle).
- [ ] **T020 [P1]** Añadir `enviarAlertaRateLimit` en `src/lib/email.ts`.
- [ ] **T021 [P1]** Integrar llamada best-effort en `src/lib/rate-limit.ts` cuando `allowed === false`.
- [ ] **T022 [P2]** Tests de integración en `src/lib/anti-abuso/rate-limit-alerts.test.ts`.

## Fase 6 — Simulador de abusos (backend)

- [ ] **T023 [P1]** Crear `src/lib/anti-abuso/rfc5737.ts` con `esIpRfc5737` y tests (rechaza `8.8.8.8`).
- [ ] **T024 [P1]** Crear `src/lib/anti-abuso/simulador-textos.ts` con pool de textos de prueba realistas.
- [ ] **T025 [P1]** Crear schemas Zod en `src/lib/schemas/index.ts` para simulación (escenario, IP, identificador, plataforma, usuarioId).
- [ ] **T026 [P1]** Crear `src/app/api/admin/anti-abuso/simular/route.ts` (`POST`, 202, crea `SimulacionAbusoRun`).
- [ ] **T027 [P1]** Crear `src/app/api/admin/anti-abuso/simular/[id]/route.ts` (`GET`, estado y resultados).
- [ ] **T028 [P1]** Crear `src/app/api/admin/anti-abuso/simular/[id]/cancelar/route.ts` (`POST`, actualiza a CANCELADA + audit).
- [ ] **T029 [P2]** Tests de integración para endpoints de simulación (incluido rechazo de IP real).

## Fase 7 — Worker del simulador

- [ ] **T030 [P1]** Crear `scripts/simulador-abuso.mjs` con advisory lock, loop de corridas, POST reales a `/api/reportes`, actualización de progreso y cancelación.
- [ ] **T031 [P1]** Añadir servicio `pi-simulador-abuso` en `docker-compose.prod.yml` (mismo patrón que `pi-monitor`).
- [ ] **T032 [P1]** Modificar `scripts/dev-restart.sh` para levantar/detener el simulador (1 solo proceso).
- [ ] **T033 [P2]** Test de integración del worker contra endpoint local (mock de Ollama o con `DISABLE_RATE_LIMIT`).

## Fase 8 — Simulador de abusos (UI)

- [ ] **T034 [P1]** Crear `src/components/modules/anti-abuso/SimuladorAbusoPanel.tsx` con selector de escenario, formulario personalizado, progreso en vivo, resultados y botón cancelar.
- [ ] **T035 [P2]** Tests de componente para `SimuladorAbusoPanel`.

## Fase 9 — Scoring por fuente como tab secundario

- [ ] **T036 [P1]** Renombrar/mover `src/components/modules/AdminAntiAbusoSimulacion.tsx` a `src/components/modules/anti-abuso/AdminAntiAbusoScoring.tsx`.
- [ ] **T037 [P1]** Actualizar importes en la nueva página de tabs para mantener la ruta `/api/admin/anti-abuso/simulacion-score`.
- [ ] **T038 [P2]** Verificar que la tab "Scoring por fuente" sigue funcionando.

## Fase 10 — Cierre

- [ ] **T039 [P1]** Regenerar docs de arquitectura (`npm run arch:generate` o script correspondiente) y dejar `npm run arch:check` verde.
- [ ] **T040 [P1]** Gate local completo: `npx tsc --noEmit`, `npm run lint -- --no-cache`, `npm run arch:check`, `npm run test`, `npm run build`, `./scripts/dev-restart.sh`.
- [ ] **T041 [P1]** Revisar conflictos con SPEC-182 en `prisma/seed.ts`; si los hay, rebasar conservando ambos bloques.
- [ ] **T042 [P1]** Push único de `work/002-pi-079` y señal `002-PI-079 · REALIZADO · <hash> · PR`.
