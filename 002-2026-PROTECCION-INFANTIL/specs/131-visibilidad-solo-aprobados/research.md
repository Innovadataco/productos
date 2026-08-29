# Research: SPEC-131 — Visibilidad pública solo por reportes aprobados

**Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

## Estado real en fuente (verificado 2026-08-01)

| Punto | Hoy | Evidencia |
|---|---|---|
| Decisión de visibilidad | `totalReportes` CRUDO (incluye SPAM/OTRO/PENDIENTE) | `visibility.ts:23-30` |
| Predicado aprobado | Existe y es único (spec 089, D-08) | `src/lib/reporte-aprobado.ts` |
| Scoring | YA cuenta solo aprobados | `scoring.ts:235` (`whereReporteAprobado`) |
| Todo lo que ve el usuario | Fluye por `calcularScore` (base aprobada) | consulta, seguimiento, ranking, simulación |
| `totalReportes` del agregado | **Semántica mixta**: crudo al crear (`upsertIncrementoReporte`), aprobado tras recalcular | `dal/repositories/identificador-reportado.ts` vs `scoring.ts:323` |
| `ocultoPorComiteEn` | Decisión humana que gana a la visibilidad (SPEC-110) | `visibility.ts:27-30` |

**Conclusión clave**: el bug es estrecho — SOLO la decisión de visibilidad lee el crudo.
Todo lo demás ya es aprobado. La corrección es quirúrgica.

## La semántica mixta (hallazgo a registrar)

`upsertIncrementoReporte` (creación) incrementa `totalReportes`/`reportesAutenticados`/
`reportesAnonimos` en CRUDO (todo nuevo reporte suma). `recalcularYGuardarScore` los
SOBRESCRIBE con el conteo aprobado. Un agregado vale cosas distintas según el último
escritor: campo con dos significados. Esta spec NO lo redefine (deuda documentada);
la visibilidad deja de leerlo y los contadores aprobados quedan explícitos.

## Alternativas consideradas

| Opción | Veredicto | Motivo |
|---|---|---|
| Campos aprobados explícitos (D1) | **Elegida** | Aditiva, explícita, sin redefinir nada; backfill verificable |
| Redefinir `totalReportes` como aprobado con escritor único (recalc) | Descartada | Cambia el significado de un campo con consumidores actuales (diagnóstico); más invasiva y confusa |
| Calcular aprobados on-the-fly en visibility (query por evaluación) | Descartada | Más lenta y otra forma de contar (riesgo de divergir del predicado persistido); el recalc ya corre en el momento justo |
| Umbral sobre `totalReportes` pero excluyendo spam en la creación | Descartada | La aprobación depende de la clasificación (posterior a la creación); no se puede saber al crear |

## Riesgos y mitigaciones

- **Menor volumen visible** (el umbral ahora exige aprobados, no crudo): es el EFECTO
  DESEADO (§1.3). Si el CEO quiere bajar el umbral por el menor volumen, es un parámetro
  aparte (documentado).
- **Agregados sin recalc tras el backfill**: el backfill deja todo consistente; cada
  finalización/resolución futura recalcula (escritora única).
- **División por cero**: ratio = 0 con 0 aprobados (definido en D3).
