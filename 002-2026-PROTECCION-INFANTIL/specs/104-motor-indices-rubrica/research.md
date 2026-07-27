# Research — SPEC-104

**Date**: 2026-07-27

## Problema verificado (fuente)

- `src/lib/ai/rubrica.ts:139`: `const cumplidas = new Set(preguntasCumplidas)` +
  `decisivas.every((p) => cumplidas.has(p.texto))` — igualdad exacta de cadena.
- `src/lib/ai/rubrica.ts:178`: el prompt exige "copia VERBATIM el texto de las preguntas".
- En vivo (SPEC-098): qwen copia sin "¿" inicial; aya con prefijos "1. [DECISIVA] …" →
  `cumple:false` con el caso entendido. Los mismos 20 casos: 95% vs 65% el mismo día.
- `scripts/eval-dual-banco.ts:138` (I-30): `--rubrica-only` lee
  `resultados-dual-095.json`, renombrado a `resultados-ab-098-20casos.json` (TAREA B del
  002-PI-016) → ENOENT hoy. El baseline correcto es
  `resultados-dual-095-baseline-pre098.json` (200 casos, intacto).

## Decisiones

- **Decisión: índices como formato de cable; textos canónicos como persistencia.**
  Rationale: elimina la fragilidad en el punto donde vive (formato libre del modelo) sin
  tocar consumidores ni auditoría. El modelo solo necesita enteros — salida estructurada ya
  soportada por `llamarOllamaStructured`.
  Alternativas consideradas: normalizar texto (trim/casefold/quitar prefijos) — mitiga pero
  no elimina (paráfrasis del modelo); pedir JSON por pregunta — más tokens y misma
  fragilidad en claves. Los índices son la única opción sin superficie de formato.

- **Decisión: sin id estable por pregunta (argumento completo en plan.md §2).**
  Rationale: el índice nace y muere dentro de la misma llamada; entre corridas no importa
  porque no se persiste. El id estable exigiría migrar parámetro/semilla/expediente y viola
  "una variable a la vez".

- **Decisión: persistir textos CANÓNICOS (mapeados desde índice), no los del modelo.**
  Rationale: el expediente (SPEC-096) cruza con el parámetro vivo por texto; con canónicos
  el match es exacto por construcción y no hay cambio de código en consumidores. Si un
  experto edita un texto después, degrada igual que hoy (comportamiento aceptado).

- **Decisión: índices inválidos se descartan (nunca cumplen).**
  Rationale: coherente con "denegar por defecto"; un índice fuera de rango no puede
  verificarse → 0.

- **Decisión (I-30): `--legacy-desde=<ruta>` con default al baseline, escritura intacta.**
  Rationale: el instructivo lo fija así; el default deja el modo usable sin argumentos.

- **Restricciones confirmadas en fuente**: textos de `ia.rubrica.preguntas` y
  `RUBRICA_SEMILLA` sin tocar; terna `ia.rubrica.modelos` intacta; `umbralPresencia` 0.6
  intacto; `ia.rubrica.enabled` sigue en default LEGACY (D-19).
