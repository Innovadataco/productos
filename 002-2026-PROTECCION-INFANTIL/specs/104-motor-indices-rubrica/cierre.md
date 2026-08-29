# Cierre — SPEC-104: Motor de rúbrica — votación por índices (adiós match verbatim)

**Fecha**: 2026-07-28 (cola nocturna 002-PI-025, B1) · **Rama**: `feature/001-scaffolding` ·
**Estado**: IMPLEMENTADA, **sin medir** (la medición de reproducibilidad es B5, la lee ZEUS).

## Lo hecho (por US)

- **US1 (P1) — votación por índices**: el prompt numera las preguntas por categoría y pide
  los NÚMEROS de las que se cumplen (eliminada la instrucción "copia VERBATIM"); el schema
  estructurado devuelve `preguntasCumplidas: integer[]` (≥1). `cumpleCategoria` compara
  índices (decisivas por posición 1-based en el set activo leído en ESA llamada), nunca
  cadenas. `filtrarYTraducirIndices` descarta fuera de rango y duplicados y traduce a
  textos CANÓNICOS en orden determinista (el del set). Consumidores downstream
  (pipeline, expediente) sin cambios: reciben textos como siempre.
- **US2 (P2) — persistencia canónica**: `ClasificacionRubricaVoto.preguntasJson` guarda los
  textos canónicos mapeados desde índice (shape idéntico al histórico). Verificado:
  `src/lib/expediente` 27/27 tests verdes sin tocar una línea — el cruce con el parámetro
  vivo funciona igual.
- **US3 (P3) — I-30**: `--legacy-desde=<ruta>` con default
  `scripts/simulacion/resultados-dual-095-baseline-pre098.json`; la escritura no se toca.
  Humo: `--rubrica-only` arranca sin ENOENT y clasifica (el artefacto de humo de 2 casos se
  eliminó para no recrear la confusión del I-30 original).

## Aceptación B1 (demostrada, no afirmada)

Test `ACEPTACIÓN B1` en `rubrica.test.ts`: tres votaciones con índices en distinto orden y
con ruido (duplicados, fuera de rango) producen el MISMO veredicto (GROOMING presente,
CLASIFICADO) y la persistencia siempre con los textos canónicos. El modo viejo (verbatim)
moría con `1. [DECISIVA] …` o sin `¿`; con índices el texto ya no participa.
Además: `cumpleCategoria` por índices (con/sin decisivas), `indicesDecisivas`,
`filtrarYTraducirIndices` (fuera de rango/duplicados), y bloqueo decisivo intacto (índice
de decisiva ausente en 2/3 modelos → REVISION_MANUAL).

## Restricciones verificadas (diff)

- `rubrica-semilla.ts`, `prisma/seed.ts`: **sin cambios** (textos intactos).
- Terna de modelos, `umbral_presencia` (0.6), `ia.rubrica.enabled` (LEGACY, D-19): sin tocar.
- NO se corrió ninguna evaluación del banco (B5 la ordena ZEUS).

## Gate

tsc ✅ · lint ✅ (0 errores) · **935/935 tests** ✅ (5 nuevos spec 104) · build ✅.

## Deuda

- Si un experto edita el TEXTO de una pregunta en el parámetro, los votos históricos
  persistidos degradan en el expediente igual que hoy (match por texto); documentado en el
  plan §2 (id estable evaluado y descartado por ahora).
