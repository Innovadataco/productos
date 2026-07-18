# Reporte de cierre — Spec 010 Rediseño del Clasificador IA

> **Documentado retroactivamente el 2026-07-18** como resumen del reporte final completo en [`final-report.md`](final-report.md).

## Estado

**CERRADA** — fecha de cierre: 2026-07-16.

## Resumen ejecutivo

Se rediseñó el pipeline de clasificación IA con RAG sobre correcciones de administrador, self-consistency de 5 votos, detector determinístico + LLM para PII, guardas de seguridad (keywords, ráfagas, DOXING → revisión) y taxonomía LATAM 2024-2026 de 11 categorías.

## Arquitectura final

- **Clasificador:** RAG + 5 votos, `umbral_revision = 1.0`.
- **Anonimización/PII:** detector determinístico propio + LLM.
- **Guardas:** keywords críticas, ráfagas y DOXING derivan a `REVISION_MANUAL` o `prioridadAlta` sin reclasificar.
- **Feedback loop:** confirmaciones/correcciones alimentan `DatasetEntrenamiento` y métricas de precisión observada.

## Métricas finales (F7)

| Métrica | Valor |
|---|---|
| Accuracy | 68.2 % |
| Error silencioso | 20.8 % |
| Revisión manual | 34.5 % |
| Recall OTRO | 30.0 % |
| Latencia p50 / p95 | 6.0 / 6.4 s |

## Estado vs KPI de producto

- **KPI:** error silencioso < 5 %.
- **Estado:** ❌ No cumplido (brecha de 15.8 pp).
- **Camino documentado:** cerrar la brecha con correcciones reales de producción, no más ingeniería de prompts local.

## Verificaciones de cierre

- Lint, tsc, build y tests verdes.
- Eval F7 ejecutado y reproducible.

## Decisiones clave

- F6 (cascada a modelos grandes) fue descartada por no mejorar métricas y aumentar latencia.
- El rediseño priorizó reducir error silencioso sin romper recall OTRO.

## Enlaces

- Reporte completo: [`final-report.md`](final-report.md)
- Plan de implementación: [`plan.md`](plan.md)
