# Implementation Plan: Spec 095 — Default seguro, JWT parametrizado y banco gobernado

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

## Summary

Aplicar D-19/D-20/D-21 del ACTA_ARQ_01: legacy como motor por defecto (la rúbrica conservada, fuera del camino), JWT y parámetros muertos cableados o retirados, banco único gobernado en CasoEval v2 con export, hoja de adjudicación de los 42 casos en disputa con votos por modelo, y runner dual legacy+rúbrica listo para la re-medición con etiquetas adjudicadas.

## Diseño

1. **US1**: seed `ia.rubrica.enabled=false` + fallback del loader (`enabled === "true"` requerido) + flip en BD dev. Tests del loader (3 casos).
2. **US2**: `auth.ts` lee `security.jwt_ttl_hours` (fallback 24h); `security.password_min_length` cableado en `cambiar-password`; `system.maintenance_mode`, `reportes.worker.max_retries`, `reportes.worker.stalled_threshold_minutes` retirados del seed (documentado cuál fue cuál).
3. **US3a**: `seedBancoGobernado()` siembra los 200 casos en `CasoEval` con `fixtureVersion=2` (upsert, preservando secundarias); el v1 (110) subordinado. `scripts/exportar-banco-simulacion.ts` regenera el JSON desde CasoEval.
4. **US3b**: `scripts/hoja-adjudicacion-095.ts` re-corre la rúbrica en los 42 casos (confianza=1.0 en la corrida 092) y genera `docs/adjudicacion-095-casos-disputa.md` con votos por modelo y columnas vacías.
5. **US3c**: `scripts/eval-dual-banco.ts` corre legacy + rúbrica por caso y escribe `scripts/simulacion/resultados-dual-095.json` (verificado en submuestra 4/4 ambos).

## Contratos / datos

- `CasoEval`: +200 filas `fixtureVersion=2` (sin migración de schema; datos por seed).
- `docs/adjudicacion-095-casos-disputa.md`: hoja de trabajo (no contrato).
- Parámetros: `ia.rubrica.enabled=false` (seed+dev), `security.jwt_ttl_hours` leído, 3 claves retiradas del seed.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Romper el pipeline al cambiar el default | Tests del loader + suite completa como regresión |
| Adjudicar etiquetas por error | Las columnas van vacías; la hoja no decide (D-20) |
| Duplicar banco en re-seeds | Upsert por texto+fuente+fixtureVersion (idempotente) |
