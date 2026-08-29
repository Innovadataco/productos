# RESEARCH-020 · Dashboard MOTOR IA

## Estructura verificada de `ClasificacionRubricaVoto` (candado 15)

Fuente: `productos/002-.../prisma/schema.prisma` líneas 2173-2185:

```prisma
model ClasificacionRubricaVoto {
  id                String   @id @default(cuid())
  clasificacionIAId String
  clasificacionIA   ClasificacionIA @relation(...)
  modelo            String
  categoria         String
  cumple            Boolean
  preguntasJson     Json
  creadoEn          DateTime @default(now())

  @@index([clasificacionIAId])
  @@map("clasificacion_rubrica_votos")
}
```

**Nombre físico:** `clasificacion_rubrica_votos` (snake_case) por `@@map`. Prisma model es CamelCase, tabla real es snake_case.

**Interpretación:** cada fila = un voto de un modelo (jurado 2-3 modelos) sobre una categoría. `cumple = true` significa que el modelo considera que la clasificación encaja en esa categoría; múltiples filas por `clasificacionIAId` (una por combinación modelo × categoria).

**Consenso ≥2/3 (candado 5):** hay consenso cuando al menos una categoría recibe `cumple=true` de ≥2 modelos.

---

## Verificación de vocabulario (candado 15)

Diferida al PASO 5. Comandos a ejecutar contra `bi-db-replica` con `bi_reader`:

```sql
-- 1. Estructura confirmada
\d public.clasificacion_rubrica_votos

-- 2. Volumen del jurado últimos 7 días
SELECT count(*) AS votos_totales,
       count(DISTINCT "clasificacionIAId") AS clasificaciones_votadas
FROM "clasificacion_rubrica_votos"
WHERE "creadoEn" >= NOW() - INTERVAL '7 days';

-- 3. Catálogo de modelos activos
SELECT "modeloUsado", count(*) AS uso, min("creadoEn"), max("creadoEn")
FROM "ClasificacionIA"
WHERE "creadoEn" >= NOW() - INTERVAL '30 days'
GROUP BY "modeloUsado"
ORDER BY uso DESC;

-- 4. Rango de latencias observado
SELECT min("latenciaMs"), max("latenciaMs"),
       percentile_cont(0.5)  WITHIN GROUP (ORDER BY "latenciaMs") AS p50,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY "latenciaMs") AS p95
FROM "ClasificacionIA"
WHERE "creadoEn" >= NOW() - INTERVAL '7 days';
```

Resultados a anotar aquí en PASO 5:
```
-- votos_totales:         [pendiente]
-- clasificaciones_votadas: [pendiente]
-- modelos activos top-6:   [pendiente]
-- p50 / p95 latencia:      [pendiente]
```

---

## Decisiones de diseño

### D-020.1 · Consenso ≥2/3 con `votos_totales >= 2`
La query del KPI 4 exige `votos_totales >= 2` en la CTE `votos_por_categoria` para descartar votaciones incompletas (por ejemplo, un modelo que aún no respondió). Un solo voto no constituye jurado; se cuenta como "sin consenso".

### D-020.2 · Fallback a `ClasificacionIA.votos` (JSON)
Si `clasificacion_rubrica_votos` está vacía en la réplica (`count = 0` en F2), la lógica del jurado sigue viviendo en `ClasificacionIA.votos` (columna Json línea 1980 schema PI). El SQL del KPI 4 se reescribiría como:
```sql
-- fallback JSON (aplicar solo si votos_totales = 0)
SELECT ROUND(100.0 * count(*) FILTER (
    WHERE jsonb_array_length(("votos"::jsonb->'a_favor')) >= 2
  ) / NULLIF(count(*), 0), 2) AS tasa_acuerdo_pct
FROM "ClasificacionIA"
WHERE "creadoEn" >= NOW() - INTERVAL '7 days'
  AND votos IS NOT NULL;
```
Estructura exacta del JSON `ClasificacionIA.votos` se documenta en PASO 5 después de `SELECT votos FROM "ClasificacionIA" WHERE votos IS NOT NULL LIMIT 3;`.

### D-020.3 · Timezone en KPI 7
`date_trunc('hour', "creadoEn")` retorna UTC por default. Superset chart se configura con `TIMEZONE = America/Bogota` en display para que el eje temporal coincida con la lectura de Fábrica.

### D-020.4 · Umbral 90 % en KPI 4
El brief §3.2 KPI 4 fija umbral 90 %. Colorización condicional Big Number:
- ≥ 95 % → verde
- 90-95 % → amarillo
- < 90 % → rojo (dispara alerta futura en INSTRUCTIVO-008)

---

## Fuentes consultadas

- `schema.prisma` PI · ClasificacionIA 1967-1992 · CorreccionAdmin 1994-2009 · ClasificacionRubricaVoto 2173-2185
- `prisma/migrations/20260828120100_mv_fact_bi/migration.sql` MV `mv_fact_motor_ia_diario` líneas 37-52
- BRIEF-A-02 v1.1 §3.2 (7 KPIs · notas sobre `ClasificacionRubricaVoto` y `ClasificacionIA.votos`)

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
