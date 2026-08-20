# Tasks: SPEC-184 — Anti-abuso operativo + simulador de abusos

**Branch**: `work/002-pi-079` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Migración, seed y repositorios base

- [x] **T001 [P1]** Crear migración aditiva `prisma/migrations/20260819010000_spec_184_anti_abuso_operativo/migration.sql` con `BlockList`, `SimulacionAbusoRun`, nuevos valores `AccionAudit` y relación en `Usuario`.
- [x] **T002 [P1]** Añadir 4 parámetros `alerts.ratelimit.*` en `prisma/seed.ts` (idempotente, categoría SYSTEM).
- [x] **T003 [P1]** Crear `src/lib/dal/repositories/block-list.ts` con findByIpHash, findPaginadosVigentes, crear, eliminar.
- [x] **T004 [P1]** Crear `src/lib/dal/repositories/simulacion-abuso.ts` con CRUD de corridas y búsqueda por estado.
- [x] **T005 [P1]** Crear `src/lib/dal/repositories/rate-limit.ts` con agregados para tops de IPs bloqueadas y conteo de bloqueos por hora.
- [x] **T006 [P2]** Tests de integración para `BlockListRepository` y `SimulacionAbusoRepository`.

## Fase 2 — BlockList y rate-limit

- [x] **T007 [P1]** Crear `src/lib/anti-abuso/block-list.ts` con `estaBloqueada`, `bloquearIp`, `desbloquearIp` + `AuditLog`.
- [x] **T008 [P1]** Modificar `src/lib/rate-limit.ts` para consultar `BlockList` antes de contar; IP baneada → 429 sin gastar cuota.
- [x] **T009 [P1]** Test en `src/lib/rate-limit.test.ts`: IP baneada recibe 429 y no incrementa `RateLimit`.
- [x] **T010 [P2]** Test de fail-open de BlockList ante error de BD.

## Fase 3 — Tablero operativo (backend)

- [x] **T011 [P1]** Crear `src/lib/anti-abuso/tablero.ts` que orqueste agregados de IPs, identificadores, fingerprints y alertas activas.
- [x] **T012 [P1]** Crear `src/app/api/admin/anti-abuso/tablero/route.ts` (`GET`, ADMIN, `assertModulo anti_abuso`).
- [x] **T013 [P1]** Crear `src/app/api/admin/anti-abuso/bloquear/route.ts` (`POST`, validación Zod, audit).
- [x] **T014 [P1]** Crear `src/app/api/admin/anti-abuso/desbloquear/route.ts` (`POST`, validación Zod, audit).
- [x] **T015 [P2]** Tests de integración para los 3 endpoints.

## Fase 4 — Tablero operativo (UI)

- [x] **T016 [P1]** Crear `src/components/modules/anti-abuso/AdminAntiAbusoOperativo.tsx` con tops, selector de ventana, botones bloquear/desbloquear y alertas activas.
- [x] **T017 [P1]** Modificar `src/app/dashboard/admin/anti-abuso/page.tsx` para renderizar tabs: Operativo, Simulador, Scoring por fuente.
- [x] **T018 [P2]** Tests de componente para `AdminAntiAbusoOperativo`.

## Fase 5 — Alertas rate-limit throttled

- [x] **T019 [P1]** Crear `src/lib/anti-abuso/rate-limit-alerts.ts` con `evaluarAlertaRateLimit` (cuenta bloqueos/hora, abre/actualiza `IncidenteInfra`, throttle).
- [x] **T020 [P1]** Añadir `enviarAlertaRateLimit` en `src/lib/email.ts`.
- [x] **T021 [P1]** Integrar llamada best-effort en `src/lib/rate-limit.ts` cuando `allowed === false`.
- [x] **T022 [P2]** Tests de integración en `src/lib/anti-abuso/rate-limit-alerts.test.ts`.

## Fase 6 — Simulador de abusos (backend)

- [x] **T023 [P1]** Crear `src/lib/anti-abuso/rfc5737.ts` con `esIpRfc5737` y tests (rechaza `8.8.8.8`).
- [x] **T024 [P1]** Crear `src/lib/anti-abuso/simulador-textos.ts` con pool de textos de prueba realistas.
- [x] **T025 [P1]** Crear schemas Zod en `src/lib/schemas/index.ts` para simulación (escenario, IP, identificador, plataforma, usuarioId).
- [x] **T026 [P1]** Crear `src/app/api/admin/anti-abuso/simular/route.ts` (`POST`, 202, crea `SimulacionAbusoRun`).
- [x] **T027 [P1]** Crear `src/app/api/admin/anti-abuso/simular/[id]/route.ts` (`GET`, estado y resultados).
- [x] **T028 [P1]** Crear `src/app/api/admin/anti-abuso/simular/[id]/cancelar/route.ts` (`POST`, actualiza a CANCELADA + audit).
- [x] **T029 [P2]** Tests de integración para endpoints de simulación (incluido rechazo de IP real).

## Fase 7 — Worker del simulador

- [x] **T030 [P1]** Crear `scripts/simulador-abuso.mjs` con advisory lock, loop de corridas, POST reales a `/api/reportes`, actualización de progreso y cancelación.
- [x] **T031 [P1]** Añadir servicio `pi-simulador-abuso` en `docker-compose.prod.yml` (mismo patrón que `pi-monitor`).
- [x] **T032 [P1]** Modificar `scripts/dev-restart.sh` para levantar/detener el simulador (1 solo proceso).
- [x] **T033 [P2]** Test de integración del worker contra endpoint local (mock de Ollama o con `DISABLE_RATE_LIMIT`).

## Fase 8 — Simulador de abusos (UI)

- [x] **T034 [P1]** Crear `src/components/modules/anti-abuso/SimuladorAbusoPanel.tsx` con selector de escenario, formulario personalizado, progreso en vivo, resultados y botón cancelar.
- [x] **T035 [P2]** Tests de componente para `SimuladorAbusoPanel`.

## Fase 9 — Scoring por fuente como tab secundario

- [x] **T036 [P1]** Renombrar/mover `src/components/modules/AdminAntiAbusoSimulacion.tsx` a `src/components/modules/anti-abuso/AdminAntiAbusoScoring.tsx`.
- [x] **T037 [P1]** Actualizar importes en la nueva página de tabs para mantener la ruta `/api/admin/anti-abuso/simulacion-score`.
- [x] **T038 [P2]** Verificar que la tab "Scoring por fuente" sigue funcionando.

## Fase 10 — Cierre

- [x] **T039 [P1]** Regenerar docs de arquitectura (`npm run arch:generate` o script correspondiente) y dejar `npm run arch:check` verde.
- [x] **T040 [P1]** Gate local completo: `npx tsc --noEmit`, `npm run lint -- --no-cache`, `npm run arch:check`, `npm run test`, `npm run build`, `./scripts/dev-restart.sh`.
- [x] **T041 [P1]** Revisar conflictos con SPEC-182 en `prisma/seed.ts`; si los hay, rebasar conservando ambos bloques.
- [x] **T042 [P1]** Push único de `work/002-pi-079` y señal `002-PI-079 · REALIZADO · <hash> · PR`.
