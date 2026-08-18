# Implementation Plan: SPEC-174 — Aislamiento estricto de tests (fix I-55)

**Branch**: `work/002-pi-nocturno-20260817` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

---

## Summary

Tres bloques: (1) `singleFork: false` = un fork por archivo (el leak de módulos deja de poder cruzar archivos por construcción) + simplificación de `test-setup.ts`; (2) reintroducir los 7 archivos excluidos y restaurar `test-integration` como gate bloqueante; (3) regla de `arch:check` contra `vi.spyOn(prisma.)` / `vi.mock` de prisma en tests, con allowlist de un solo archivo, refactorizando los infractores actuales.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Testing** | Vitest 3.2.x, pool `forks` |
| **CI** | GitHub Actions `.github/workflows/ci.yml` (raíz del monorepo `productos/`) |
| **BD de test** | PostgreSQL 16 en `localhost:5433` (misma instancia compartida; serialización por `TestMutex`) |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Ratchet de cobertura (Q-2) | ✅ Pass | Los thresholds por proyecto se mantienen; reintroducir archivos solo sube cobertura |
| No tocar motor | ✅ Pass | Ningún cambio en `src/lib/ai/**` |
| I-55 documentado | ✅ Pass | Comentarios de exclusión/`continue-on-error` se retiran junto con la causa |

---

## Estado actual (verificado en fuente)

- `vitest.config.ts`: `pool: "forks"`, `poolOptions.forks.singleFork: true` (línea 61), `fileParallelism: false` (42), `sequence.concurrent: false` + `hooks: "list"`, bloque de exclusión I-55 con los 7 archivos (líneas 28-40).
- `src/lib/test-setup.ts`: contiene el fix multi-instancia (`__prismaInstances`, registro en `ensureRealPrismaClient`, restauración sobre todas las instancias) y el canario `[LEAK-CANARY]` en `beforeEach`. La lógica de mutex (`TestMutex`, acquire/release, huérfanos por reloj de BD) es independiente y se conserva.
- `ci.yml`: `test-integration` con `continue-on-error: true` (línea 76); `gate.needs` sin `test-integration` (línea 234).
- Infractores de la futura regla (grep `spyOn(prisma`): `src/lib/rate-limit.test.ts` (4 spyOn sobre `prisma.$queryRaw` + 1 sobre `prisma.parametroSistema.findUnique`). Mockers de módulo prisma en integration: solo `circulo-confianza-n1.test.ts` (allowlist). El resto de mockers (`queue`, `ai/*`, `simulacion/*`) viven en el project `unit`, pero la regla escanea todos los `src/**/*.test.ts(x)` — hay que decidir alcance: **la regla aplica a TODOS los archivos de test** (unit e integration) salvo allowlist, porque el patrón es igualmente indeseado en unit. Los mockers de unit se migran a factories completas o a inyección — se evalúa en implementación; si el esfuerzo crece, la regla escanea solo integration y unit queda como deuda declarada (decisión a compuerta).

---

## Diseño por bloque

### Bloque 1 — Fork por archivo + setup simplificado

**`vitest.config.ts`**:
- `poolOptions.forks.singleFork: false`. Con pool `forks` e `isolate` por defecto, cada archivo corre en su propio proceso: el singleton de Prisma, los spies y los `vi.mock` viven y mueren dentro de ese proceso.
- Se conserva `fileParallelism: false` (un archivo a la vez: tiempos estables, mutex sin contención real, cobertura determinista) y `sequence.concurrent: false` + `hooks: "list"`.

**`src/lib/test-setup.ts`** (simplificación):
- Fuera: `__prismaInstances`, `registerPrismaInstance`, el bucle multi-instancia de `restorePrismaMethods`, el canario `beforeEach`.
- Se conserva: snapshot del singleton + restauración incondicional de métodos en `beforeAll`/`beforeEach`/`afterEach` (higiene intra-archivo: un test que espía y no restaura no rompe a sus vecinos de archivo), `vi.useRealTimers()`, `vi.clearAllMocks()`, `vi.unstubAllGlobals()`, mutex completo.
- `src/lib/test-setup-restore.test.ts` se conserva (verifica la higiene intra-archivo).

**Mutex entre forks**: `acquireTestLock` ya es multi-proceso por diseño (UPDATE atómico en PostgreSQL + reloj de BD para huérfanos). Con un archivo a la vez (`fileParallelism: false`) nunca hay contención; se verifica con una corrida forzando `fileParallelism: true` en local para observar que el mutex serializa (evidencia en cierre, no requisito de CI).

### Bloque 2 — Reintroducir los 7 archivos y el gate

- `vitest.config.ts`: quitar el bloque "EXCLUSIÓN TEMPORAL · I-55" completo.
- `ci.yml`: quitar `continue-on-error: true` del job `test-integration` y volver a `needs: [verificaciones, test-unit, test-integration, journeys, build]` en `gate`.
- Verificación local: `npm run test:integration` completo (211 archivos) verde ×3 corridas consecutivas + 2 corridas con `--sequence.shuffle` (seeds distintos). Si alguno de los 7 archivos falla por un defecto PROPIO (no por leak), se corrige el archivo en esta spec.

### Bloque 3 — Regla anti-mocks de Prisma en `arch:check`

**Nuevo script** `scripts/arch/no-prisma-mocks.ts`:
- Escanea `src/**/*.test.ts` y `src/**/*.test.tsx`.
- Patrones prohibidos (regex sobre fuente): `vi.spyOn(prisma.` / `vi.spyOn(\n...prisma` y `vi.mock(` cuyo primer argumento resuelve al módulo prisma (`"@/lib/prisma"`, `"./prisma"`, `"../prisma"` y variantes relativas).
- Allowlist: `scripts/arch/prisma-mocks-allowlist.json` con una sola entrada (`src/lib/dal/services/circulo-confianza-n1.test.ts`) y razón documentada.
- Salida: lista de infractores con archivo:línea; exit 1 si hay alguno fuera de allowlist.
- Se integra como sección **(e)** de `scripts/arch/arch-check.ts` (mismo estilo que las secciones a-d) + test propio (`scripts/arch/no-prisma-mocks.test.ts`) con fixture positivo/negativo.

**Refactor de infractores** (`rate-limit.test.ts`):
- `vi.spyOn(prisma, "$queryRaw")` ×3 (store no disponible): reemplazar por inyección — el módulo `rate-limit.ts` acepta cliente? Verificar firma; si no, mover el spy a una función envoltoria propia del test (ej. mockear el módulo `parametros.ts` con `vi.mock` parcial de ESE módulo, no el de prisma) o usar un `PrismaClient` falso pasado explícitamente si la API lo permite.
- `vi.spyOn(prisma.parametroSistema, "findUnique")` (postgres caído): mockear `@/lib/parametros` (`getParametroSistema` → rechaza) — el SUT es rate-limit, no parametros.
- Criterio: el test sigue cubriendo el mismo comportamiento observable (fail-open ante BD caída); cero pérdida de cobertura.

---

## Orden de implementación (tasks.md tras compuerta)

1. Bloque 1 (config + setup simplificado) → corrida local completa.
2. Refactor `rate-limit.test.ts` (Bloque 3 parcial) — antes de activar la regla.
3. Bloque 3 (script + allowlist + sección (e) + test).
4. Bloque 2 (reintroducir 7 archivos + ci.yml) → verificación ×3 + 2 seeds.
5. Gate local completo (tsc, lint, arch:check, test:unit, test:integration, journeys, build).

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Con fork por archivo, algún test dependía en secreto de estado compartido entre archivos | Corrida completa local ×3 + 2 seeds; cualquier fallo se arregla en el archivo (setup propio), nunca reintroduciendo acoplamiento |
| Wall-clock sube por arranque de forks | `fileParallelism: false` ya era el ritmo actual; el arranque de proceso por archivo suma ~1-2s × 211 — se mide y se reporta en la Nota final; límite aceptado SC-005 |
| La regla rompe mockers del project `unit` | Decisión de alcance a compuerta: escanear todo `src/**` con migración de infractores, o limitar la regla a integration con deuda declarada para unit |
| El refactor de `rate-limit.test.ts` pierde cobertura del fail-open | Tests verifican el mismo observable (rate-limit sigue respondiendo con BD caída); cobertura por proyecto se mide tras el cambio |

---

## Decisiones para compuerta §4

1. **Alcance de la regla (Bloque 3)**: ¿todos los `src/**/*.test.ts(x)` (migrando también los mockers de unit: queue, ai/rubrica*, simulacion/*) o solo integration con deuda declarada para unit? Recomendación: empezar por **integration** (donde dolía I-55) y declarar la migración de unit como deuda en el cierre — el project unit no comparte fork con nadie y su riesgo es menor.
2. **Refactor de rate-limit**: inyección/mockeo de `@/lib/parametros` en vez de espiar el singleton — mismo observable, cero spy sobre prisma.
3. **`fileParallelism: false` se mantiene** (no se busca velocidad en esta spec, se busca determinismo; la velocidad ya la dio el split unit/integration de SPEC-170).
