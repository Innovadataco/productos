# Plan · SPEC-431 — La franja horaria le mentía al modelo

## Análisis en fuente

| Archivo | Qué se sacó |
|---|---|
| `armar-payload.ts:61-67` | `franjaDe` con `getUTCHours()` — el defecto. |
| `lectura-capa1.ts:57-59` | El patrón correcto: `OFFSET_BOGOTA_MS = 5h`, restar antes de leer. UTC-5 fijo, sin DST. |
| `caso/hechos-caso.ts:51` | La otra implementación correcta, con `Intl`. Sirve de oráculo para el contraste. |
| `armar-payload.test.ts:16,24,53` | Fixture en UTC crudo; el assert pasaba por casualidad. |
| `ejecutar-analisis.ts:176` | `timeStyle` a propósito (SPEC-349) — NO se toca. |
| Barrido `getUTCHours`/`getHours` en `src/` | Solo `armar-payload` calculaba franja de análisis sobre UTC. Los saludos de UI (`getHours` local) no son este defecto. |

## Decisión

Arreglar con el offset fijo de `lectura-capa1` (no con `Intl`): es el vecino más cercano, ya probado, y no depende de que la zona horaria del runtime esté bien configurada. Se exporta `franjaBogota` de `hechos-caso.ts` solo para poder contrastar las dos implementaciones en el test.

## Riesgo

| Riesgo | Cómo se acota |
|---|---|
| Que el arreglo y `hechos-caso` discrepen en algún borde | Test que compara las 24 horas del día contra `franjaBogota`. |
| Que el test vuelva a afirmar UTC | Fixture comentado en hora local + assert que niega explícitamente `"0-6"`. |
| Textos viejos con la franja corrida | Fuera de alcance: no se regeneran (decisión de Jelkin). Anotado en la spec. |
