# Checklist de requisitos — Spec 092

**Spec**: `specs/092-motor-logica-corregida/spec.md` · **Verificado**: 2026-07-24

## US1 — Decisivas vs contexto

- [x] `PreguntaRubrica.tipo` con tolerancia al formato viejo (sin tipo → contexto).
- [x] Categoría cumple solo si TODAS las decisivas cumplidas (verificación determinista).
- [x] Semilla reestructurada (13 decisivas / 10 categorías).
- [x] Tests (8/8).

## US2 — Embudo medido

- [x] Medición sobre los 200 casos: 70 descartes erróneos (35%) — documentado con script y artefacto.
- [x] Embudo permisivo ("ante la duda incluye") + red de seguridad (plausibles < 2 → todas). Criterio en research.

## US3 — Todas las conductas

- [x] Sin principal por gravedad: `categoriasPresentes` es el resultado; `categoria` = mayor % solo por schema.
- [x] ≥1 presente → CLASIFICADO; ninguna → REVISION_MANUAL (tests).
- [x] Gravedad solo para priorización interna de bandeja.

## US4 — Guardas baratas

- [x] Ráfaga + doxing cortan a REVISION_MANUAL antes de los modelos (test: sin llamada al clasificador).
- [x] RAG después de la deduplicación.

## US5 — Longitud mínima

- [x] Backend valida desde `reportes.spam.min_text_length` (fallback 20).
- [x] Front lee el parámetro público (`useMinTextoReporte`).
- [x] Zod solo no-vacío; tests 17/17.

## US6 — Re-corrida

- [ ] Resultados del banco de 200 con la lógica corregida — EN CURSO (background).
- [ ] Análisis de fallos uno por uno + etiquetas sospechadas — tras la corrida.

## No negociable

- [x] Migraciones aditivas (ninguna en esta spec) · ADR_004 · sin score público · 089/090/091 intactas · staging explícito 002.
- [x] NO se tocó la terna ni el umbral 60% (una variable a la vez, como se ordenó).
- [ ] ACTA-VALIDACION de ZEUS — PENDIENTE.
