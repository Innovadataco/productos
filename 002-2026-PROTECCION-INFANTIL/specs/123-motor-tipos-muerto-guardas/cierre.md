# Cierre — Spec 123 (Bloque R5, 002-PI-041 FASE 3)

## Qué se hizo

### b) Tipos desde Prisma (commit 50e502b1)

- `src/lib/ai/classifier.ts`: los tipos manuales `CategoriaConducta` (línea 6) y
  `EstadoReporte` (línea 20) eran uniones **idénticas** a los enums de
  `prisma/schema.prisma:154` y `:169` (verificado miembro a miembro). Reemplazados
  por `import type { CategoriaConducta, EstadoReporte } from "@prisma/client"` con
  re-export de `CategoriaConducta` para compatibilidad.
- Evidencia de seguridad: nadie importaba `CategoriaConducta` desde
  `@/lib/ai/classifier` (grep en `src/` y `scripts/`); el único importador del
  módulo (`helpers/clasificacion.ts`) solo usa `clasificarConVotos`. `tsc` limpio.

### c) Código muerto (commits a456256f, 91dcabf2)

- **`getDefaultOllamaBaseUrl`** (`src/lib/ai/ollama-config.ts:47`): podado. Grep en
  `src`/`scripts` (ts/tsx/mjs) encontraba solo su definición — 0 importadores.
- **`llamarOllama`** (`src/lib/ai/ollama-client.ts:41-94`): podada. Grep (excluyendo
  `llamarOllamaStructured`) encontraba solo su definición y su propio test; toda la
  producción usa `llamarOllamaStructured`. `ollama-timeout.test.ts` ajustado a la
  variante viva con las mismas aserciones de timeout (6/6 verde).
- **`ReporteStepUbicacion.tsx`**: verificado muerto (única referencia de código es su
  propia definición; las specs 073/115 ya lo declaran muerto). **NO podado**: vive en
  `src/components/**`, fuera del alcance de este bloque → queda para ZEUS.
- **Falso positivo documentado**: `procesarBackfill*` y `persistEvalRun` /
  `markEvalRunFailed` / `updateEvalRunProgress` parecían muertos por grep de ts/tsx,
  pero `scripts/worker-reportes.mjs` (líneas 20-21 y 313-318) los importa
  dinámicamente. NO son código muerto.

### d) Guardas unificadas (commit 6ecd18f2)

- Las tres copias: producción (`src/app/api/reportes/procesar/helpers/guardas.ts`,
  única con spam/ráfaga), `src/lib/ai/sandbox.ts` y `src/lib/ai/eval-runner.ts`.
- **Producción intacta** (diff vacío en `src/app/**`): es la referencia.
- Nuevo `src/lib/ai/guardas-decision.ts`: réplica pura y exacta de
  `aplicarGuardasSeguridad` (mismo orden de ramas y cortocircuitos
  `estadoFinal !== "POSIBLE_SPAM"`), sin el side-effect `registrarPaso`.
- `sandbox.ts` y `eval-runner.ts` la adoptan con `esRafaga=false` y `umbralSpam` de
  `clasificacion.umbral_spam` (default 0.7, misma clave y default que
  `helpers/parametros.ts:53-54`).
- **Demostración de decisiones** (`src/lib/ai/guardas-decision.test.ts`, 44 tests):
  - 36 de paridad: módulo compartido vs helper de producción (`registrarPaso`
    mockeado), 12 fixtures × 3 umbrales → `estadoFinal`, `prioridadAlta` y
    `keywordsDetectadas` idénticos en todos.
  - 8 de antes/después con la lógica vieja copiada inline: decisiones idénticas en
    todos los casos; el ÚNICO cambio es la rama SPAM adoptada (SPAM con
    confianza ≥ umbral pasa de `CLASIFICADO` a `POSIBLE_SPAM` en sandbox/eval),
    que es exactamente lo que producción ya decidía.

## Qué NO se tocó y por qué

- `src/app/api/reportes/procesar/helpers/guardas.ts` — referencia de producción
  (motor). Intocable por regla del bloque.
- `src/app/api/reportes/procesar/helpers/guardas-previas.ts` — pre-filtro barato del
  spec 092; NO es una copia de la lógica triplicada.
- `src/lib/ai/schemas.ts:8` (`CATEGORIAS_VALIDAS`) — alimenta el JSON schema del
  prompt del modelo (motor). Además es literal runtime, no tipo sombra.
- `src/lib/ai/eval-runner.ts:13` (`CATEGORIAS_EVAL`/`CategoriaEval`) — **diverge**
  del enum (omite `SPAM`) → no se unifica; anotado para ZEUS.
- `scripts/eval-classifier-f3..f6.ts` — harnesses históricos ligados a fixes F3–F6
  (solo guarda doxing); no son la tercera copia viva.
- Rúbrica, terna de modelos, umbral 60%, `ia.rubrica.enabled` — motor, prohibido.
- `src/components/modules/ReporteStepUbicacion.tsx` — muerto verificado pero fuera
  de alcance (componente) → ZEUS.

## Gate

Todo bajo candado `/tmp/pi-gate-lock`:

- `npx tsc --noEmit`: limpio (exit 0).
- `npm run lint`: 0 errores (1 warning preexistente en `IaModelSelector.tsx`, ajeno).
- Tests tocados/relacionados: `src/lib/ai` (14 archivos, 131/131) +
  `api/admin/ia/sandbox` + `api/reportes/procesar` + `efecto-motor-111` (24/24).
- `npm run build`: OK.
- Suite completa (`npm run test`): **1192 passed / 2 failed / 1 skipped** (190 archivos).
  Los 2 fallos son únicamente `src/lib/specs-discipline.test.ts`, que exige que
  `specs/README.md` indexe las carpetas de specs nuevas en vuelo (122, 123, 124,
  125 de los bloques paralelos). La corrección corresponde al coordinador: este
  bloque tiene prohibido tocar `specs/README.md`. Ningún otro test falló.

## Para ZEUS

1. `ReporteStepUbicacion.tsx` muerto verificado → podar en un bloque con alcance de componentes.
2. `CategoriaEval` omite `SPAM` (`src/lib/ai/eval-runner.ts:13-27`): decisión de
   diseño de fixtures de eval o bug latente (un `predicted: "SPAM"` queda fuera del
   tipo). Revisar.
3. Duplicación residual intocable por motor: `CATEGORIAS_VALIDAS` en
   `src/lib/ai/schemas.ts:8` vs enum Prisma (literal del prompt).
