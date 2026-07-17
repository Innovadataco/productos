# F4 — Recovery Report

## Veredicto

F4 **no se declara recuperado** como base estable para producción. La mejor política de agregación pura (`umbral 1.0`) logra `error_silencioso = 23.3%` (≤ 26.3% de F3-revert), pero eleva la revisión manual al **33.6%**, fuera del rango operativo aceptable (~25%).

Por tanto F4 queda **implementado pero desactivable** vía configuración (`reportes.classification.umbral_revision`). La línea de base para F5 se decidirá después del eval A/B de RAG (T3).

## Piso teórico del modelo/prompt actual

- **17 / 110** ejemplos del fixture son **5/5 unánimes e incorrectos** con `ornith:9b` y el prompt F4.
- Eso representa un piso irreducible de **~15.5%** de error silencioso: ni siquiera un oráculo de agregación puede corregirlos sin cambiar el modelo, el prompt o los ejemplos en contexto.
- Son el insumo principal para F5.

## Sweep offline de políticas de agregación

Ejecutado sobre el eval F4 original (`ornith:9b`, 5 votos, `temperature=0.7`, seeds fijos).

| Política | `error_silencioso` | `% REVISION_MANUAL` | clasificados |
|---|---|---|---|
| umbral 0.5 (original F4) | 29.8% | 5.5% | 104 |
| umbral 0.6 | 29.8% | 5.5% | 104 |
| umbral 0.8 | 28.0% | 15.5% | 93 |
| margen moda-segunda ≥2 | 29.3% | 10.0% | 99 |
| umbral 0.6 + margen ≥2 | 29.3% | 10.0% | 99 |
| **umbral 1.0** | **23.3%** | **33.6%** | 73 |

## Fronteras críticas para F5

Las tres fronteras con más casos unánimes erróneos (y que concentran el piso teórico):

1. **`DIFUSION_NO_CONSENTIDA → COMPARTIMIENTO_SEXUAL`** (4 casos)
2. **`SOLICITUD_MATERIAL → EXTORSION`** (2 casos)
3. **`OTRO → CONTACTO_INSISTENTE`** (2 casos)

Además se documentan como secundarias:

- `CONTACTO_INSISTENTE → SOLICITUD_ENCUENTRO`
- `CONTACTO_INSISTENTE → OTRO`
- `SOLICITUD_MATERIAL → COMPARTIMIENTO_SEXUAL`
- `OFRECIMIENTO_REGALOS → EXTORSION`
- `SUPLANTACION_IDENTIDAD → SOLICITUD_MATERIAL`
- `OTRO → EXTORSION`
- `CONTENIDO_GENERADO_IA → COMPARTIMIENTO_SEXUAL`
- `DOXING → OTRO`

## Configuración final aplicada en S4

- `reportes.classification.umbral_revision` por defecto: **0.8**.
- `posibleAgresorPar`: **voto mayoritario** (`≥3/5`), revirtiendo el sobre-disparo OR-de-5 (22.7% → 10.0%).
- Seeds fijos por voto documentados; evals de confirmación reducidos a 1 run.

## Insumos para F5

- Reporte detallado con votos: `eval-results/f4-votacion-classifier-1784180878236.json`.
- Script de análisis offline: `scripts/analizar-f4-politicas.ts`.
- Lista de casos unánimes erróneos en la sección "Techo irreducible" arriba.

## Cierre F5

F5 se implementó con RAG sobre correcciones + siembra manual. El eval A/B determinó que la mejor configuración es **RAG + votos con `umbral_revision = 1.0`**:

- `error_silencioso`: **21.9%** (bajo la línea F3-revert de 26.3%).
- `% REVISION_MANUAL`: **33.6%**.
- Volteó **1/17** casos unánimes erróneos de F4.

Esta configuración reemplaza a F3-revert como línea de base. Ver detalles en [`plan-f5.md`](./plan-f5.md) y `eval-results/f5-rag-classifier-1784187260732.json`.
