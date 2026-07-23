# Cierre — Spec 085: Evaluación por error silencioso y modelo por defecto (ADR_006)

**Fecha**: 2026-07-23
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/085-evaluacion-error-silencioso/`
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS (ver nota de ranking abajo)

## Resumen por entregable

| D | Entregable | Estado |
|---|---|---|
| D1 | Banco saneado (#43→SOLICITUD_MATERIAL, secundarias #45/#27, acierto multi-etiqueta, auditoría 3+) | Implementado |
| D2 | Métricas: errores silenciosos, subestimaciones, ESPS (severidad desde parámetros) + UI seguridad-primero | Implementado |
| D3 | Modelo por defecto gemma2:27b vía parámetro | Implementado (ver ⚠️ ranking) |
| D4 | Banco 200 casos, `fuente` + `fixtureVersion: 2`, anti-mezcla en comparador | Implementado |

## ⚠️ Reporte obligatorio (punto 3 del brief): EL RANKING CAMBIÓ

Recomputo sobre el banco saneado (sin re-correr modelos):

| Modelo | Accuracy | Silenciosos | Subestim. | ESPS | Lat p50 |
|---|---|---|---|---|---|
| **qwen2.5:32b** | **100.0%** | **0** | 0 | **0** | 64.5 s |
| gemma2:27b | 98.0% | **0** | 0 | **0** | 58.2 s |
| qwen2.5:14b | 98.0% | 1 | 0 | 10 | 11.9 s |
| ornith:9b | 96.0% | 1 | 2 | 150 | 17.2 s |
| aya-expanse:32b | 94.0% | 3 | 0 | 60 | 56.3 s |

**gemma2:27b ya no es el mejor por errores silenciosos**: empata 0/0 con qwen2.5:32b, que además tiene 100% de accuracy (1 caso de diferencia, no significativo con n=50). El default se aplicó por D3 antes del recomputo; **NO se revierte por mi cuenta** — mantener gemma2:27b o enmendar el ADR es decisión de ZEUS + CEO. El banco ampliado (200 casos) permitirá una comparación con potencia real.

## Pregunta abierta (#43) — respondida

**0 reportes reales afectados** (dataset vacío; solo artefactos de simulación, cuya metadata de evaluación se saneó). Detalle en research.md.

## Cambios

- Migración aditiva `20260723130000_add_secundaria_esperada` (columna nullable).
- `metricas.ts`: multi-etiqueta, silenciosos, subestimaciones, ESPS, severidad vía `obtenerSeveridades()` (params `scoring.severity.*` sembrados ×12).
- UI: detalle y comparador muestran seguridad primero; accuracy ya no es titular. `MetricCard` gana `formato="numero"`.
- Parser: formato `{fixtureVersion, casos}` retrocompatible; schema caso +`secundariaEsperada`/`fuente`; comparador advierte mezcla de procedencias.
- Banco: 200 casos (50 originales + 150 nuevos en 2 lotes validados), 24 multi-etiqueta, cobertura de las 12 categorías.
- Param vivo + seed: `reportes.classification_model = gemma2:27b` (antes `ornith:9b`). **Reversión**: `UPDATE "ParametroSistema" SET valor='ornith:9b' WHERE clave='reportes.classification_model';`

## Validación

- Tests nuevos: ESPS (incl. función pura), silenciosos, subestimaciones, multi-etiqueta → 9/9 en metricas.test.ts.
- Banco: parser OK 200/200; ids únicos; categorías del enum; primaria ≥ secundaria.
- Recomputo persistido en las 5 runs (`metricasJson` actualizado con las claves nuevas).
- Gate: lint 0 errores (1 warning heredado) · tsc OK · suite **777/777** (tras registrar la 085 en el índice — el propio chequeo US5 de la 087 lo exigió) · build limpio · `dev-restart.sh` healthcheck OK.

## Deuda / fuera de alcance

- Compuerta por severidad y contraste entre modelos (ADR §3.2/§3.3): spec aparte.
- `scripts/recomputar-085.ts`: script de recomputo (documentado, reutilizable para futuras evaluaciones).

## Commit

- `feat(simulacion): evaluación por error silencioso (ESPS) y banco de 200 casos saneado (spec 085, ADR_006)`
