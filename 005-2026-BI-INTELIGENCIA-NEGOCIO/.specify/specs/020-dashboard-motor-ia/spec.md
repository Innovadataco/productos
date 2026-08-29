# SPEC-020 · Dashboard MOTOR IA

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 020 |
| **Nombre** | dashboard-motor-ia |
| **Origen** | BI · INSTRUCTIVO-010 · F3C 2026-08-28 22:34 COT |
| **Brief** | BI · A-02 v1.1 §3.2 |
| **Audiencia** | Fábrica (ADMIN técnico) · vigilancia continua |
| **Estado** | ⏳ spec+plan LISTO · implementación pendiente (REVISO) |

---

## Objetivo

Entregar en Superset el tablero **MOTOR IA** con 7 KPIs para cazar deriva del motor rúbrica multi-modelo (candados 5 · 12). Detección temprana de caídas de precisión, latencia, y desacuerdo del jurado.

---

## Alcance · 7 KPIs

| # | KPI | Fuente | Visualización | Refresh |
|---|---|---|---|---|
| 1 | Clasificaciones últimas 24h | `ClasificacionIA` | Big Number | 5 min |
| 2 | Latencia p50/p95 por modelo (7d) | `ClasificacionIA` | Tabla 3 col | 15 min |
| 3 | Distribución de categorías (7d) | `ClasificacionIA` | Bar chart | 30 min |
| 4 | Tasa de acuerdo del jurado (7d) | `clasificacion_rubrica_votos` | Big Number % (umbral 90 %) | 15 min |
| 5 | Uso de cascada (7d) | `ClasificacionIA` | Big Number % | 30 min |
| 6 | Correcciones admin (30d) | `CorreccionAdmin` | Big Number con delta | 60 min |
| 7 | Latencia motor timeline (3d por hora) | `ClasificacionIA` | Line chart | 15 min |

### SQL base (verificado contra `schema.prisma` PI · candado 15)

**1 · Clasificaciones últimas 24h**
```sql
SELECT count(*) AS total
FROM "ClasificacionIA"
WHERE "creadoEn" >= NOW() - INTERVAL '24 hours';
```

**2 · Latencia p50/p95 por modelo (7 días)**
```sql
SELECT "modeloUsado",
       percentile_cont(0.5)  WITHIN GROUP (ORDER BY "latenciaMs") AS p50_ms,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY "latenciaMs") AS p95_ms,
       count(*) AS clasificaciones
FROM "ClasificacionIA"
WHERE "creadoEn" >= NOW() - INTERVAL '7 days'
GROUP BY "modeloUsado"
ORDER BY p95_ms DESC;
```

**3 · Distribución de categorías (7 días)**
```sql
SELECT categoria::text AS categoria, count(*) AS total
FROM "ClasificacionIA"
WHERE "creadoEn" >= NOW() - INTERVAL '7 days'
GROUP BY categoria
ORDER BY total DESC;
```

**4 · Tasa de acuerdo del jurado (7 días · candado 5)**

`ClasificacionRubricaVoto` (línea 2173 schema PI · tabla física `clasificacion_rubrica_votos`) tiene: `clasificacionIAId · modelo · categoria · cumple (Boolean) · preguntasJson · creadoEn`. Cada clasificación recibe un voto por modelo (típicamente 2-3 modelos jurado). Hay consenso si ≥2/3 modelos vota `cumple=true` sobre la misma categoría ganadora.

```sql
WITH votos_por_categoria AS (
  SELECT "clasificacionIAId",
         categoria,
         count(*) FILTER (WHERE cumple = true) AS votos_a_favor,
         count(*)                              AS votos_totales
  FROM "clasificacion_rubrica_votos"
  WHERE "creadoEn" >= NOW() - INTERVAL '7 days'
  GROUP BY "clasificacionIAId", categoria
),
consenso_por_clasificacion AS (
  SELECT "clasificacionIAId",
         bool_or(votos_a_favor >= 2 AND votos_totales >= 2) AS hay_consenso
  FROM votos_por_categoria
  GROUP BY "clasificacionIAId"
)
SELECT ROUND(100.0 * count(*) FILTER (WHERE hay_consenso) / NULLIF(count(*), 0), 2) AS tasa_acuerdo_pct
FROM consenso_por_clasificacion;
```

**5 · Uso de cascada (7 días)**
```sql
SELECT ROUND(100.0 * count(*) FILTER (WHERE "usoCascada" = true) / NULLIF(count(*), 0), 2) AS pct_cascada
FROM "ClasificacionIA"
WHERE "creadoEn" >= NOW() - INTERVAL '7 days';
```

**6 · Correcciones admin (30 días · métrica de deriva)**
```sql
SELECT count(*) AS correcciones_30d
FROM "CorreccionAdmin"
WHERE "creadoEn" >= NOW() - INTERVAL '30 days';
```

**7 · Latencia motor timeline (últimas 72 h por hora)**
```sql
SELECT date_trunc('hour', "creadoEn") AS hora,
       "modeloUsado",
       percentile_cont(0.5)  WITHIN GROUP (ORDER BY "latenciaMs") AS p50_ms,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY "latenciaMs") AS p95_ms
FROM "ClasificacionIA"
WHERE "creadoEn" >= NOW() - INTERVAL '3 days'
GROUP BY hora, "modeloUsado"
ORDER BY hora;
```

---

## Fuera de alcance

- Alertas Telegram cuando `tasa_acuerdo_pct < 90 %` (INSTRUCTIVO-008)
- Panel de expediente por consulta (candado 12 · `/admin/consultas/{id}`) → SPEC futura
- Retrain automático si deriva > umbral (Fase 2)
- Row-level security multi-tenant (Fase 2)

---

## Candados aplicables

| # | Candado | Aplicación |
|---|---|---|
| 5 | Jurado multi-modelo con voto de mayoría | KPI 4 mide tasa de consenso ≥2/3 |
| 9 | Sin datos → "No data" nunca inventa | Superset default respeta |
| 12 | Traza completa por consulta | Dashboard es la lectura del expediente agregado |
| 13 | Sanitizer PII | Motor IA no expone `Reporte.texto` · agrega solo métricas |
| 14 | Verde CI ≠ funciona | Fábrica valida en vivo bajando consenso en un caso conocido → tasa baja |
| 15 | Verificar en fuente | Estructura de `ClasificacionRubricaVoto` verificada línea 2173 schema PI |
| 17 | spec+plan commiteado antes de implementar | Aplicado |

---

## Riesgos

- **Query 4 (tasa acuerdo) costosa** si el volumen mensual pasa 200k clasificaciones → mitigación: agregar índice `(clasificacionIAId, creadoEn)` en migración aditiva si p95 chart > 3 s.
- **`modeloUsado` con etiquetas heterogéneas** ("qwen2.5:14b" vs "qwen") por versiones → PASO 5 hace `SELECT DISTINCT "modeloUsado" FROM "ClasificacionIA"` y agrupa en catálogo si es necesario.
- **`ClasificacionIA.votos` JSON alternativo** (línea 1980) al detalle de `ClasificacionRubricaVoto` → si `clasificacion_rubrica_votos` está vacía en la réplica, el brief §3.2 admite caer a `ClasificacionIA.votos` como fallback. Se documenta hallazgo en research.md.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
| **Aprobado por** | pendiente REVISO Fábrica BI-2 |
