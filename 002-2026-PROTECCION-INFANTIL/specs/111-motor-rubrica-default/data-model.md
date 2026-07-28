# Data Model — SPEC-111

**Date**: 2026-07-28 · Sin migración de schema.

## Parámetro

| Clave | Tipo | Valor tras la spec | Notas |
|-------|------|--------------------|-------|
| `ia.rubrica.enabled` | BOOLEAN | `true` | Seed en base nueva (FR-001) y script idempotente en BD operada (FR-002). Reversión: `false` en caliente, sin desplegar. |

## Evidencia de efecto (para el test FR-003)

| Señal | `enabled=true` | `enabled=false` |
|-------|----------------|-----------------|
| Filas en `ClasificacionRubricaVoto` para el reporte procesado | EXISTEN (clasificado por rúbrica) | NO EXISTEN (clasificado por legacy) |

Sin cambios en `ClasificacionRubricaVoto` ni en ningún modelo: el pipeline ya ramifica por
el parámetro (D-19 lo implementó así).
