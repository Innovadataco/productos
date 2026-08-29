# Cierre: SPEC-174 — Aislamiento estricto de tests (fix I-55)

**Fecha**: 2026-08-18 · **Rama**: `work/002-pi-nocturno-20260817` · **Compuerta §4**: APROBADA por ZEUS (fallback de alcance autorizado explícitamente).

## Qué se implementó

1. **Fork por archivo**: `vitest.config.ts` (integration) con `poolOptions.forks.singleFork: false`. Cada archivo de test corre en su propio proceso: el leak I-54 (spies/mocks del singleton de Prisma filtrados entre archivos) no puede cruzar archivos por construcción. `fileParallelism: false` y el mutex `TestMutex` se conservan (serialización de BD entre procesos).
2. **test-setup.ts simplificado**: fuera `__prismaInstances`, restauración multi-instancia y canario `[LEAK-CANARY]` (parches del incidente, innecesarios con aislamiento por fork). Se conserva la restauración incondicional de métodos del singleton como higiene intra-archivo + `useRealTimers/clearAllMocks/unstubAllGlobals` + mutex completo.
3. **7 archivos víctima reintroducidos**: el bloque "EXCLUSIÓN TEMPORAL · I-55" salió del `exclude`. Verificado que `apelaciones/*`, `ia/rubrica/*`, `permisos-modulos`, `route-atomicidad` pasan corriendo DESPUÉS de `circulo-confianza-n1` + `rate-limit` (el orden que los tumbaba en CI-Linux).
4. **Gate CI restaurado**: `.github/workflows/ci.yml` sin `continue-on-error` en `test-integration` y con `test-integration` de vuelta en `gate.needs`.
5. **Regla arch:check (e)**: `scripts/arch/no-prisma-mocks.ts` — prohíbe `vi.spyOn(prisma.` y `vi.mock` del módulo prisma en tests de INTEGRATION, con allowlist de una entrada (`circulo-confianza-n1.test.ts`, Proxy legítimo para conteo N+1). Integrada como sección (e) de `arch:check` + test propio en el project unit.
6. **Refactor de infractores**: `rate-limit.test.ts` sin `spyOn(prisma` — se añadió `options.client` a `checkRateLimit` (código de producción: inyección SOLO para tests, ver Nota) y mock de `@/lib/parametros` para el caso O-1. `test-setup-restore.test.ts` eliminado (espiaba prisma para probar la higiene; la propia regla lo flaggeaba).

## Decisiones ZEUS aplicadas

- **Regla a TODOS los *.test salvo allowlist → fallback autorizado aplicado**: el refactor de los 6 mockers del project unit (`queue`, `ai/rubrica`, `ai/rubrica-config`, `simulacion/metricas`/`progreso`/`executor` — factories parciales en zona del motor) se disparó. La regla queda sobre INTEGRATION; la migración de mockers de unit es **deuda I-56** (declarada aquí, no en silencio).
- **Medición de tiempo (candado >2×)**: suite full con los 211 archivos = **619 s (~10.3 min)** vs baseline singleFork ~16-18 min local (CI 18-33 min). NO subió; bajó ~40%. No se forzó `fileParallelism`.

## Evidencia

- Corrida 1 (nativo): **211 archivos (1 skip) / 1193 tests VERDES · 619 s** (`/tmp/int-174-r1.log`).
- Corrida 2 (nativo, estabilidad) y corrida 3 (`--sequence.shuffle --sequence.seed=42`): resultados anexos en el PR.
- `npm run arch:check` ✅ con sección (e) · `no-prisma-mocks.test.ts` 3/3 · `rate-limit.test.ts` 13/13.
- Gate completo: tsc · lint · arch:check · test:unit · test:integration · journeys · build · arranque (anexo en el PR).

## Deuda técnica

- **I-56**: los 6 mockers del project unit siguen usando `vi.mock` de prisma con factories parciales. Riesgo bajo (unit no comparte fork ni BD), pero el patrón es el mismo que causó I-54. Migrarlos a factories completas o inyección. La regla (e) los cubrirá al ampliar su alcance — decisión de ZEUS en su momento.
- `checkRateLimit` ganó `options.client` (inyección para tests). Si se quiere cero toque de producción, la alternativa es un wrapper del store — deuda menor, documentada.

## Nota (toque de producción)

`src/lib/rate-limit.ts` (código de producción) fue tocado: `options.client?: PrismaClient` usado solo por tests para simular el store caído sin espiar el singleton. Comportamiento por defecto idéntico (`options.client ?? prisma`).
