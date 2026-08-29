# Tasks: SPEC-170 — Limpieza del Centro de Control IA

**Branch**: `work/002-pi-068`

---

## Fase 1 · Split del job `test` de CI

| Id | Tarea | Archivo(s) | TDD / Gate |
|----|-------|------------|------------|
| F1-T001 | Reorganizar `vitest.config.ts` en projects `unit` e `integration` | `vitest.config.ts` | `npm run test:unit` y `npm run test:integration` pasan |
| F1-T002 | Clasificar cada test file en `unit` o `integration` según import de prisma/setup | `vitest.config.ts` | Suma de tests = 2083 |
| F1-T003 | Agregar scripts `test:unit` y `test:integration` | `package.json` | Scripts ejecutables |
| F1-T004 | Modificar `.github/workflows/ci.yml`: job `test-unit` sin BD | `.github/workflows/ci.yml` | Workflow válido (`gh workflow view`) |
| F1-T005 | Modificar `.github/workflows/ci.yml`: job `test-integration` con BD | `.github/workflows/ci.yml` | Workflow válido |
| F1-T006 | Actualizar `gate.needs` con `test-unit` y `test-integration` | `.github/workflows/ci.yml` | Workflow válido |
| F1-T007 | Gate local completo | — | tsc, lint, test:unit, test:integration, arch:check, build |

**Commit**: `fase 1 (002-PI-068): split job test en test-unit + test-integration`

---

## Fase 2 · Retiro de Experimentos + preservación del banco curado

| Id | Tarea | Archivo(s) | TDD / Gate |
|----|-------|------------|------------|
| F2-T001 | Crear `scripts/exportar-banco-curado.ts` | `scripts/exportar-banco-curado.ts` | Script genera JSONL válido |
| F2-T002 | Agregar script `exportar-banco-curado` en `package.json` | `package.json` | Script ejecutable |
| F2-T003 | Crear `fixtures/README.md` | `fixtures/README.md` | Documentación completa |
| F2-T004 | Correr script y commitear `fixtures/banco-curado-v2.jsonl` | `fixtures/banco-curado-v2.jsonl` | Archivo versionado |
| F2-T005 | Eliminar endpoints `/api/admin/ia/experimentos/**` y `/api/admin/ia/evals/**` | `src/app/api/admin/ia/experimentos/`, `src/app/api/admin/ia/evals/` | tsc pasa |
| F2-T006 | Eliminar componentes `src/components/modules/ia/eval/**` | `src/components/modules/ia/eval/` | tsc + lint |
| F2-T007 | Eliminar DAL de evals | `src/lib/dal/repositories/caso-eval.ts`, `eval-resultado.ts`, `eval-run.ts`, `src/lib/dal/services/ia-evals.ts`, `src/lib/ai/eval-runner.ts` | tsc pasa |
| F2-T008 | Eliminar modelos Prisma `EvalRun`, `EvalResultado`, `CasoEval` y enums | `prisma/schema.prisma` | `npx prisma generate` pasa |
| F2-T009 | Crear migración DROP IF EXISTS para tablas/eliminados | `prisma/migrations/...` | `npx prisma migrate deploy` pasa en local |
| F2-T010 | Simplificar `IaEvalManager.tsx` a solo tab Simulación | `src/components/modules/ia/IaEvalManager.tsx` | Smoke test |
| F2-T011 | Renombrar `IA_TABS` key `"eval"` → `"simulacion"` | `src/lib/nav-items.ts` | `nav-items.test.ts` pasa |
| F2-T012 | Retirar `ia_eval` del catálogo de módulos | `src/lib/permisos-catalogo.ts` | Tests de permisos pasan |
| F2-T013 | Verificar `grep -rE "EvalRun|EvalResultado|CasoEval|ExperimentCard|LaboratorioTab|HistorialTab|CasosTab" src/` = 0 | — | Verificación manual |
| F2-T014 | Gate local completo | — | tsc, lint, test:unit, test:integration, arch:check, build |

**Commit**: `fase 2 (002-PI-068): export banco curado como fixture + retiro Experimentos`

---

## Fase 3 · Retiro del motor Legacy

| Id | Tarea | Archivo(s) | TDD / Gate |
|----|-------|------------|------------|
| F3-T001 | Simplificar `src/lib/ai/motor.ts` a solo rúbrica | `src/lib/ai/motor.ts` | tsc + tests de motor pasan |
| F3-T002 | Eliminar `src/lib/ai/classifier.ts` | `src/lib/ai/classifier.ts` | `grep -r "classifier" src/lib/ai` solo quedan tests propios |
| F3-T003 | Limpiar `src/lib/ai/defaults.ts` si aplica | `src/lib/ai/defaults.ts` | tsc |
| F3-T004 | Limpiar `src/lib/ai/sandbox.ts`: overrides de rúbrica, quitar guards legacy | `src/lib/ai/sandbox.ts` | tsc + tests de sandbox |
| F3-T005 | Actualizar Playground: cartel "Motor: RÚBRICA" y sliders rúbrica | `src/components/modules/ia/IaPlayground.tsx`, `IaModelSelector.tsx` | Smoke test |
| F3-T006 | Eliminar `ia.rubrica.enabled` del seed y código (Opción 1) | `prisma/seed.ts`, `src/lib/ai/rubrica-config.ts`, etc. | tsc |
| F3-T007 | Crear migración DELETE para `ia.rubrica.enabled` si aplica | `prisma/migrations/...` | `npx prisma migrate deploy` pasa |
| F3-T008 | Verificar `grep -rE "legacy|clasificarConVotos|VotingConfig|MotorClasificacion" src/lib/ai src/components/modules/ia` = 0 | — | Verificación manual |
| F3-T009 | Gate local completo | — | tsc, lint, test:unit, test:integration, arch:check, build |

**Commit**: `fase 3 (002-PI-068): retiro motor Legacy — solo rúbrica`

---

## CI final

| Id | Tarea | Gate |
|----|-------|------|
| CI-T001 | Push `work/002-pi-068` | — |
| CI-T002 | Abrir PR a `feature/001-scaffolding` | — |
| CI-T003 | Verificar CI verde con jobs `test-unit`, `test-integration` y `gate` | CI verde |

---

## Comandos de verificación

```bash
# Fase 2
grep -rE "EvalRun|EvalResultado|CasoEval|ExperimentCard|LaboratorioTab|HistorialTab|CasosTab" src/ || echo "OK: no hay referencias"

# Fase 3
grep -rE "legacy|clasificarConVotos|VotingConfig|MotorClasificacion" src/lib/ai src/components/modules/ia || echo "OK: no hay referencias"

# Gate local por fase
npx tsc --noEmit
npm run lint
npm run test:unit
npm run test:integration
npm run arch:check
npm run build
```
