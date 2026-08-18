# Tasks: SPEC-174 — Aislamiento estricto de tests (fix I-55)

**Input**: `specs/174-aislamiento-tests-strict/{spec,plan}.md`
**Compuerta §4**: PENDIENTE de ZEUS. Borrador derivado del plan; se ajusta con el veredicto.

## Phase 1: Fork por archivo + setup simplificado

- [ ] **T001** `vitest.config.ts` (integration): `poolOptions.forks.singleFork: false`; conservar `fileParallelism: false`, `sequence.concurrent: false`, `hooks: "list"`.
- [ ] **T002** `src/lib/test-setup.ts`: quitar `__prismaInstances` + `registerPrismaInstance` + restauración multi-instancia + canario `[LEAK-CANARY]`; conservar snapshot del singleton + restauración incondicional intra-archivo + `vi.useRealTimers()/clearAllMocks()/unstubAllGlobals()` + mutex `TestMutex` completo.
- [ ] **T003** Corrida local `npm run test:integration` completo: verde. Verificar mutex multi-fork con una corrida manual `fileParallelism: true` (evidencia, no requisito CI).

## Phase 2: Refactor de infractores de la regla

- [ ] **T004** `src/lib/rate-limit.test.ts`: eliminar los 4 `vi.spyOn(prisma, ...)` — mockear `@/lib/parametros` (`getParametroSistema` rechaza para "postgres caído") y/o inyectar cliente falso para `$queryRaw`; mismo observable (fail-open ante BD caída), cero pérdida de cobertura.
- [ ] **T005** Verificar con grep que ningún otro test de integration hace `vi.spyOn(prisma.` ni `vi.mock` del módulo prisma fuera de `circulo-confianza-n1.test.ts`.

## Phase 3: Regla arch:check (e)

- [ ] **T006** `scripts/arch/prisma-mocks-allowlist.json` (NUEVO): una entrada (`src/lib/dal/services/circulo-confianza-n1.test.ts`) con razón documentada.
- [ ] **T007** `scripts/arch/no-prisma-mocks.ts` (NUEVO): escanea `src/**/*.test.ts(x)`; patrones `vi.spyOn(prisma.` y `vi.mock("…prisma")`; reporta archivo:línea; exit 1 fuera de allowlist.
- [ ] **T008** Integrar como sección (e) en `scripts/arch/arch-check.ts` + `scripts/arch/no-prisma-mocks.test.ts` con fixture positivo/negativo.
- [x] **T009** Alcance final (DECISIÓN ZEUS 2026-08-18): la regla debía aplicar a TODOS los *.test salvo allowlist; el refactor de los 6 mockers del project unit (queue, ai/rubrica, ai/rubrica-config, simulacion/metricas/progreso/executor — factories parciales en zona del motor) se disparó → **fallback autorizado aplicado**: la regla escanea solo INTEGRATION (excluye `UNIT_TEST_INCLUDES`) y la migración de mockers de unit queda como **deuda I-56 declarada**. Además `src/lib/test-setup-restore.test.ts` fue eliminado (espiaba prisma para probar la higiene; quedaba flaggeado por la propia regla).

## Phase 4: Reintroducir los 7 archivos + gate CI

- [ ] **T010** `vitest.config.ts`: quitar el bloque "EXCLUSIÓN TEMPORAL · I-55" (7 archivos).
- [ ] **T011** `.github/workflows/ci.yml`: quitar `continue-on-error: true` de `test-integration`; `gate.needs` vuelve a incluir `test-integration`.
- [ ] **T012** Verificación: `npm run test:integration` verde ×3 corridas + 2 seeds `--sequence.shuffle` distintos (211 archivos).

## Phase 5: Cierre

- [ ] **T013** Gate local completo (tsc, lint, arch:check, test:unit, test:integration, journeys, build).
- [ ] **T014** `cierre.md` con evidencia (corridas, seeds, wall-clock antes/después) + sección Implementación en spec.md.
