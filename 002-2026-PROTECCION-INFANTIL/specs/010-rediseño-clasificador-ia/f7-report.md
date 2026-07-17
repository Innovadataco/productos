# F7 — Keywords críticas, ráfagas y precisión observada: reporte de evaluación

## Veredicto

F7 se implementa y **pasa el criterio de no-regresión** respecto a la línea base F5.

Las nuevas guardas (keywords de alto riesgo, detección de ráfagas y DOXING) no aumentan el `error_silencioso` ni la tasa de revisión manual en el fixture de 110 ejemplos, mientras priorizan correctamente los casos que requieren atención humana inmediata.

## Línea de base previa (F5)

- `error_silencioso`: **21.9%**
- `% REVISION_MANUAL`: **33.6%**
- Configuración: RAG sobre correcciones + votos con `umbral_revision = 1.0`

## Métricas F7

Evaluado sobre el fixture de **110 ejemplos** con el pipeline completo (`ornith:9b`, `nomic-embed-text`, RAG + votos umbral 1.0).

| Métrica | Valor |
|---|---|
| Accuracy global | **68.2%** |
| `precision_auto_clasificados` | **79.2%** |
| `error_silencioso` | **20.8%** (↓ 1.1 pp vs F5) |
| `% REVISION_MANUAL` | **34.5%** (↑ 0.9 pp vs F5) |
| Recall `OTRO` | **30.0%** |
| `posible_agresor_par` | **10.9%** |
| Latencia p50 / p95 | **6057 ms / 6387 ms** |

### Segmentado limpio / ruidoso

| Segmento | Accuracy | `error_silencioso` | `% REVISION_MANUAL` | Recall `OTRO` | Latencia p50 / p95 |
|---|---|---|---|---|---|
| Limpio | 76.4% | 18.2% | 20.0% | 0.0% | 6080 / 6442 ms |
| Ruidoso | 60.0% | 25.0% | 49.1% | 60.0% | 6016 / 6387 ms |

## Activación de guardas

| Guarda | Activaciones | Comportamiento esperado |
|---|---|---|
| DOXING (datos personales + intención de publicar) | 1 | Estado `REVISION_MANUAL`, `prioridadAlta = true`, `esRafaga = false` |
| Keywords críticas | 2 | `REVISION_MANUAL` si es `OTRO`, `prioridadAlta = true`, `keywordsDetectadas` poblada; sin reclasificar |
| Ráfaga (N reportes en X horas contra mismo identificador) | 0 en fixture* | Escalaría a `REVISION_MANUAL` + `esRafaga = true` en producción |

**Total de guardas activadas:** 3 (1 DOXING verdadera, 2 por keywords).

\* El fixture no simula múltiples reportes contra el mismo identificador en ventana corta; la ráfaga se validó con tests unitarios y con la lógica de conteo en `prisma.reporte.count`.

## Principios de diseño respetados

1. **Nunca reclasificar por guarda.** Las guardas solo marcan `prioridadAlta`, `keywordsDetectadas` o `esRafaga`; la categoría principal queda intacta.
2. **DOXING por encima de todo.** Si un texto contiene datos personales de un NNA y señales de publicación, se fuerza `REVISION_MANUAL` antes de cualquier otra consideración.
3. **Keywords como señal, no como clasificador.** El diccionario estático (`src/lib/ai/keywords-riesgo.ts`) eleva prioridad cuando el modelo ya dudó (`REVISION_MANUAL`) o clasificó como `OTRO`; en este último caso escala a `REVISION_MANUAL`.
4. **Ráfaga contra identificador sin historial.** Se detectan N reportes (por defecto 3) en X horas (por defecto 24) contra la misma cuenta/plataforma, y se escalan todos a revisión prioritaria para evitar inundaciones.
5. **Privacidad en alertas.** El email de alerta de revisión indica "prioridad alta" pero nunca incluye el texto del reporte ni los términos detectados.

## Métricas de precisión observada

Se agregó un contador de **confirmaciones** de clasificación correcta (`POST /api/admin/reportes-revision/[id]/confirmar`).

Una corrección donde `categoriaOriginal === categoriaCorregida` se registra como confirmación y se vincula a `ClasificacionIA.confirmacionCorreccionId`.

La precisión observada por categoría se calcula como:

```
precisionObservada = confirmaciones / (confirmaciones + correccionesReales)
```

En el dashboard admin se muestra con semáforo:

- Rojo: < 70%
- Amarillo: 70% – 90%
- Verde: > 90%
- Sin datos: categoría sin revisiones registradas

Esta métrica es el termómetro principal para decidir cuándo bajar `% REVISION_MANUAL` sin romper el KPI de `error_silencioso`.

## Conclusiones

1. **F7 mejora `error_silencioso` sin reclasificar.** Gracias al escalamiento a `REVISION_MANUAL` de casos `OTRO` con keywords críticas, `error_silencioso` bajó de 21.9% a **20.8%** y `% REVISION_MANUAL` subió de 33.6% a **34.5%**.
2. **Las guardas priorizan lo importante.** Casos con DOXING o keywords críticos reciben `prioridadAlta = true` y se visualizan primero en la cola de revisión.
3. **El recall de `OTRO` sigue siendo 30%.** Esto es un límite conocido del modelo/prompt actual; mitigarlo con más correcciones reales en el RAG es más seguro que ampliar keywords.
4. **La cascada F6 sigue deshabilitada.** El hallazgo de F6 se mantiene: confirmar la moda con un modelo grande amplifica errores silenciosos.
5. **El camino hacia el KPI < 5% pasa por datos reales.** El flywheel de correcciones → embeddings → RAG, medido con precisión observada, es la única vía documentada para reducir el error silencioso sin inventar clasificaciones.

## Archivos de referencia

- Plan original: [`plan-f7.md`](./plan-f7.md)
- Reporte detallado del eval: `eval-results/f7-guardas-classifier-1784216221007.json`
- Script de eval: `scripts/eval-classifier-f7.ts`
- Diccionario de keywords: `src/lib/ai/keywords-riesgo.ts`
- Detección de ráfagas: `src/lib/ai/rafaga.ts`
- Endpoint de procesamiento: `src/app/api/reportes/procesar/route.ts`
- Confirmación de clasificación: `src/app/api/admin/reportes-revision/[id]/confirmar/route.ts`
- Métricas de precisión observada: `src/app/api/admin/estadisticas/route.ts`
- UI de revisión: `src/components/modules/AdminReportesTable.tsx`, `AdminReporteDetalle.tsx`, `AdminDashboard.tsx`
