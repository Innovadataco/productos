# Cierre — SPEC-207 · Parche motor SPAM dominancia (002-PI-140)

## Estado

Implementada en `work/002-PI-140-142-lote-parches`.

## Resumen de cambios

- `prisma/seed.ts`: `spam.dominancia_umbral=0.33` + `spam.dominios_acortadores` JSON editable.
- `src/lib/ai/guardas-decision.ts`: hard-rule `spam_publicitario_deterministico` (≥2 señales: hashtags, links acortados, dinero+urgencia+CTA, emojis monetarios).
- `src/lib/dal/services/reporte-processing/guardas.ts`: lee dominios acortadores y pasa a la decisión.
- `src/lib/ai/sandbox.ts`: lee dominios acortadores, umbral 0.33, log de modelos fallback vía `workerLogger.error`.
- Tests: `guardas-decision.test.ts` (+4 casos) + `sandbox.test.ts` (log fallback).

## Evidencia

- Gate local: `tsc --noEmit` ✓, `lint --no-cache` ✓ (0 errores), `arch:check` ✓, `test:unit` ✓ (950 tests), `test:integration` en curso.
- Texto RPT-QFUHE8-like fuerza `POSIBLE_SPAM` con regla `spam_publicitario_deterministico`.

## Deuda técnica

Ninguna.
