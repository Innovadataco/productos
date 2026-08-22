# Research: SPEC-199

## Hallazgos verificados en fuente

- `src/lib/ai/rubrica-semilla.ts` (2026-08-22): `RUBRICA_SEMILLA` tiene 10 categorías; falta SPAM.
- `src/lib/ai/guardas-decision.ts`: solo recibe categoría ganadora; no ve categorías secundarias.
- `prisma/seed.ts`: `ia.rubrica.preguntas` usa `update: {}` → no propaga cambios estructurales.
- Escala de severidades en BD (verificado por ZEUS): 0-95; acoso grave comienza en 75.

## Decisiones tomadas

- Forzar update de `ia.rubrica.preguntas` en seed para este parámetro estructural.
- Umbral de dominancia SPAM = 0.66 (2/3 modelos).
- Severidad mínima para bloquear dominancia = 75 (conservador, protege acoso grave).
