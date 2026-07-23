# Data Model — 085-evaluacion-error-silencioso

> Migración aditiva `20260723130000_add_secundaria_esperada`. Nada destructivo.

## Cambio de schema

| Tabla | Columna nueva | Tipo | Nulo | Notas |
|---|---|---|---|---|
| `simulacion_reportes` | `secundariaEsperada` | TEXT | SÍ | Categoría alternativa que también cuenta como acierto (multi-etiqueta). Sin índice (solo lectura en métricas). |

## Columnas/entidades usadas (sin cambios)

- `SimulacionRun.metricasJson`: gana claves `erroresSilenciosos {count, casos[]}`, `subestimaciones {count, severidadPerdida}`, `esps`, `umbralRevision` (además de las existentes de la 083).
- `SimulacionRun.casosJson`: casos con `fuente` y `secundariaEsperada` opcionales.
- `ClasificacionIA`: fuente de `categoria`, `confianza` (para silenciosos), `latenciaMs`, `usoCascada`.

## Parámetros (ParametroSistema)

| Clave | Valor | Notas |
|---|---|---|
| `scoring.severity.<CAT>` ×12 | 0–95 | Sembrados por esta spec (antes: solo defaults del código). Fuente de severidad para ESPS/subestimaciones (ADR_004) |
| `reportes.classification.umbral_revision` | 1.0 (sin cambio) | Umbral para errores silenciosos |
| `reportes.classification_model` | `ornith:9b` → **`gemma2:27b`** | Modelo por defecto (D3). Reversión: volver a `ornith:9b` por el mismo parámetro. Ver nota de ranking en research.md §R4 |
| `ia.simulacion_timeout_minutos` | 60 (sin cambio) | — |

## Banco de simulación (`scripts/simulacion/simulacion-50-casos-eval.json`)

- Formato nuevo: `{ fixtureVersion: 2, casos: [...] }` (parser acepta también array plano).
- 200 casos: 50 originales (`fuente: "banco-50-original"`) + 150 nuevos (`fuente: "curado-085"`).
- 24 casos con `secundariaEsperada`; primaria = mayor severidad.
- El comparador advierte si las runs comparadas mezclan procedencias.
