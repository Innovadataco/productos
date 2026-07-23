# Implementation Plan: Spec 085 — Evaluación por error silencioso y modelo por defecto

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md) | **Origen**: ADR_006

## Summary

Sanear el banco de 50 casos (#43, secundarias, auditoría 3+), añadir métricas de seguridad (errores silenciosos, subestimaciones, ESPS) a simulación y comparación con severidad desde parámetros, cambiar el modelo por defecto a gemma2:27b vía parámetro, y ampliar el banco a ≥200 casos con procedencia marcada. Sin compuerta por severidad ni contraste entre modelos (spec aparte).

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16, Prisma 5.22
**Storage**: PostgreSQL — sin cambios de schema (`secundariaEsperada` viaja en el JSON del banco y en `SimulacionReporte` se evalúa desde `casosJson`/nuevo campo opcional — ver D1)
**Testing**: Vitest (ESPS, silenciosos, multi-etiqueta, parser del banco) + recomputo sobre las 5 runs existentes
**Constraints**: migraciones aditivas; severidad y modelo por defecto desde parámetros; staging explícito solo del 002.

## Diseño por entregable

### D1 — Saneamiento del banco

- JSON `scripts/simulacion/simulacion-50-casos-eval.json`: #43 → `SOLICITUD_MATERIAL`; #45 → `secundariaEsperada: "SOLICITUD_ENCUENTRO"` (primaria `SUPLANTACION_IDENTIDAD`); #27 → `secundariaEsperada: "COMPARTIMIENTO_SEXUAL"` (primaria `DIFUSION_NO_CONSENTIDA`). Banco pasa a `fixtureVersion: 2` + `fuente` por caso (los 50 originales conservan procedencia documentada).
- Schema Zod (`casoSimulacionSchema`): campo opcional `secundariaEsperada`. `SimulacionReporte` persiste `secundariaEsperada` (columna aditiva opcional — ver data-model.md; si se evita columna, se evalúa desde `casosJson` — decisión: **columna aditiva** para consulta directa y métricas limpias).
- Auditoría 3+: script de análisis sobre las 5 runs de ZEUS (`cmrx12kx*`): por caso, conteo de modelos en desacuerdo con la etiqueta; los casos 3+ se documentan en research.md con resolución.

### D2 — Métricas (`src/lib/simulacion/metricas.ts`)

- Cargador de severidad: reutilizar/exportar desde `src/lib/scoring.ts` (`scoring.severity.*` con defaults del código; sembrar los parámetros). Umbral desde `reportes.classification.umbral_revision`.
- Acierto multi-etiqueta: `asignado === esperada || asignado === secundariaEsperada`.
- `erroresSilenciosos: { count, casos: [{indice, esperado, asignado, confianza}] }` — fallos con `confianza >= umbral_revision`.
- `subestimaciones: { count, severidadPerdida }` — fallos con `sev(asignado) < sev(esperado)`.
- `esps`: Σ|Δsev| sobre errores silenciosos, con |Δ| de subestimaciones ×3.
- UI: `MetricasSimulacion` muestra primero Errores silenciosos y ESPS; accuracy pasa a segundo plano. Comparador incluye las nuevas columnas.

### D3 — Modelo por defecto

- `UPDATE ParametroSistema reportes.classification_model = 'gemma2:27b'` (dev/test) + default del seed. Sin código. Reversión documentada (volver a `ornith:9b`).

### D4 — Banco ≥200

- Nuevos ~150 casos adversariales/limítrofes (vecinos de categoría, doble conducta, falsos graves) cubriendo las 11 categorías, `fuente: "curado-085"` y `fixtureVersion: 2`. Generación asistida + revisión de coherencia por lote; validación con el parser del simulador.
- La comparación marca advertencia si las runs comparadas usan bancos de distinta versión (campo en `casosJson` o metadato del run).

### Contratos

- `metricasJson` gana `erroresSilenciosos`, `subestimaciones`, `severidadPerdida`, `esps` (contracts/metricas-simulacion.md).

## Fases

1. Artefactos + D1 (JSON, schema, columna aditiva, métricas multi-etiqueta).
2. D2 (métricas + params + UI + comparador) + tests.
3. D3 (parámetro + seed).
4. D4 (banco ≥200, subagente de redacción + validación).
5. Recomputo tabla 5 modelos + validación en vivo + gate + docs + commit/push.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Ranking cambia tras sanear | Reportarlo, NO cambiar default (decisión ZEUS+CEO) — SC-003 |
| 150 casos nuevos de baja calidad | Revisión por lote con criterios explícitos (ambigüedad real, doble conducta, falsos graves) + validación parser |
| Comparación mezcla bancos | `fixtureVersion` en el banco + advertencia en comparador |
