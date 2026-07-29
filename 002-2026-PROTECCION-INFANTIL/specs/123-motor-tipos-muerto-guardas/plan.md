# Plan — Spec 123

## Inventario de los frentes (archivo:línea)

### b) Tipos manuales vs `@prisma/client`

| Ubicación | Tipo manual | ¿Idéntico al enum? | Acción |
|---|---|---|---|
| `src/lib/ai/classifier.ts:6-18` | `CategoriaConducta` (12 miembros) | Sí (schema.prisma:154) | Reemplazar por import de `@prisma/client` + re-export |
| `src/lib/ai/classifier.ts:20-28` | `EstadoReporte` (8 miembros) | Sí (schema.prisma:169) | Reemplazar por `import type` |
| `src/lib/ai/eval-runner.ts:13-27` | `CATEGORIAS_EVAL` / `CategoriaEval` | **Diverge**: omite `SPAM` | NO unificar; anotar para ZEUS |
| `src/lib/ai/schemas.ts:8-21` | `CATEGORIAS_VALIDAS` (literal para JSON schema del prompt) | Idéntico en contenido | NO tocar: alimenta el prompt (motor); además es literal runtime, no tipo |
| `src/lib/apelacion-test-utils.ts:60`, `src/lib/reporte-transiciones.test.ts:7` | subconjuntos inline de `EstadoReporte` | Subconjuntos deliberados en helpers de test | No son sombras; se dejan |

Consumidores: nadie importa `CategoriaConducta` desde `@/lib/ai/classifier`
(grep: único importador de classifier es `helpers/clasificacion.ts` y solo usa
`clasificarConVotos`), así que el reemplazo es mecánico y seguro.

### c) Código muerto (verificado con cero importadores, incl. `.mjs` dinámicos)

| Candidato | Evidencia | Acción |
|---|---|---|
| `getDefaultOllamaBaseUrl` (`src/lib/ai/ollama-config.ts:47`) | 0 usos en `src`/`scripts` (ts/tsx/mjs) | Podar |
| `llamarOllama` (`src/lib/ai/ollama-client.ts:41-94`) | 0 usos productivos; solo `ollama-timeout.test.ts` | Podar y ajustar el test a `llamarOllamaStructured` (misma aserción de timeout) |
| `src/components/modules/ReporteStepUbicacion.tsx` | Solo autodefinición + specs que ya lo declaran muerto (115/cierre.md) | NO podar (fuera de alcance: componente); reportar a ZEUS |
| Backfills, `persistEvalRun`, `markEvalRunFailed`, `updateEvalRunProgress` | Parecían muertos pero `scripts/worker-reportes.mjs:20-21,313-318` los importa dinámicamente | NO podar (falso positivo documentado) |

### d) Guardas triplicadas

| Copia | Ramas | Rol |
|---|---|---|
| `src/app/api/reportes/procesar/helpers/guardas.ts:26-83` | spam + doxing + keywords + ráfaga | **REFERENCIA (producción) — intocable** |
| `src/lib/ai/sandbox.ts:201-228` | doxing + keywords (ráfaga reportada como `esRafaga:false`) | Adopta |
| `src/lib/ai/eval-runner.ts:291-315` | doxing + keywords (orden de `keywordsDetectadas` divergente) | Adopta |
| `src/app/api/reportes/procesar/helpers/guardas-previas.ts` | pre-filtro barato (spec 092), lógica distinta | NO es copia; no se toca |
| `scripts/eval-classifier-f3..f6.ts` | solo doxing | Harnesses históricos; se anotan, no se tocan |

Diseño: nuevo módulo puro `src/lib/ai/guardas-decision.ts` con
`decidirGuardasSeguridad(...)` que replica exactamente el orden y condiciones de
`guardas.ts` (spam → doxing → keywords → ráfaga, con cortocircuitos
`estadoFinal !== "POSIBLE_SPAM"`), sin el side-effect `registrarPaso` y devolviendo
además `reglasAplicadas`, `doxing` y `keywords` para la traza del sandbox.

- Sandbox: `esRafaga=false`; `umbralSpam` leído de `ParametroSistema`
  (`clasificacion.umbral_spam`, default 0.7 — misma clave y default que
  `helpers/parametros.ts:53-54`).
- Eval-runner: `esRafaga=false`; mismo parámetro/default.
- Paridad: nuevo `src/lib/ai/guardas-decision.test.ts` compara salida del módulo
  vs `aplicarGuardasSeguridad` (con `registrarPaso` mockeado) sobre fixtures que
  cubren todas las ramas.

### Impacto esperado en decisiones

- Producción: ninguno (archivo intocable; lo prueban el test de paridad y los tests
  existentes de `api/reportes/procesar`).
- Sandbox/eval-runner: solo cambian decisiones para entradas SPAM con
  `confianza >= umbralSpam` (ahora `POSIBLE_SPAM`, como producción) — es la
  adopción mandatada, no una desviación.

## Orden

1. Artefactos spec (commit docs).
2. b) tipos (commit).
3. c) podas, un commit por poda con evidencia.
4. d) módulo compartido + adopción + test de paridad (commit).
5. Gate bajo candado + suite completa + cierre.
