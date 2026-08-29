# PLAN-020 · Dashboard MOTOR IA

## Fases

### F1 · Datasets (heredados de SPEC-019)
Los datasets `ClasificacionIA` · `clasificacion_rubrica_votos` · `CorreccionAdmin` · `mv_fact_motor_ia_diario` se importan una vez desde SPEC-019 F1. Este SPEC solo consume.

### F2 · Verificación de estructura `clasificacion_rubrica_votos` (candado 15)
```sql
\d public.clasificacion_rubrica_votos
```
Confirmar 6 columnas: `id · clasificacionIAId · modelo · categoria · cumple · preguntasJson · creadoEn`. Si difiere → PARA · escala a Fábrica BI-2 (schema drift).

Adicional:
```sql
SELECT count(*) AS votos_totales,
       count(DISTINCT "clasificacionIAId") AS clasificaciones_votadas
FROM "clasificacion_rubrica_votos"
WHERE "creadoEn" >= NOW() - INTERVAL '7 days';
```
Si `votos_totales = 0` en la réplica → fallback documentado a `ClasificacionIA.votos` JSON (línea 1980 schema PI · anotar en research.md D-020.2).

### F3 · Verificación catálogo `modeloUsado`
```sql
SELECT "modeloUsado", count(*) AS uso
FROM "ClasificacionIA"
WHERE "creadoEn" >= NOW() - INTERVAL '30 days'
GROUP BY "modeloUsado"
ORDER BY uso DESC;
```
Anotar en research.md. Si hay más de 6 etiquetas o versiones concurrentes → tabla 2 (latencia p50/p95) truncar a top-6 por volumen para legibilidad.

### F4 · Charts MOTOR IA (7 KPIs)
1. Big Number: `motor_clasificaciones_24h_v1` (KPI 1)
2. Tabla: `motor_latencia_p50p95_v1` (KPI 2)
3. Bar chart: `motor_distribucion_categorias_v1` (KPI 3)
4. Big Number %: `motor_tasa_acuerdo_jurado_v1` (KPI 4 · umbral 90 %)
5. Big Number %: `motor_uso_cascada_v1` (KPI 5)
6. Big Number: `motor_correcciones_admin_30d_v1` (KPI 6 · delta 30d anterior)
7. Line chart multi-serie: `motor_latencia_timeline_v1` (KPI 7)

Dashboard `Motor IA` · export `superset/dashboards/motor-ia.yaml`.

### F5 · Gate local (candado 14)
- Docker Compose local levanta `bi-superset` y `bi-db-replica`.
- Chart 4 (tasa acuerdo): plantar caso de prueba en réplica local con `INSERT INTO "clasificacion_rubrica_votos"` (3 votos: 2 cumple=true, 1 cumple=false) → chart muestra 100 %; luego alterar a 1 cumple=true, 2 cumple=false → chart muestra 0 %.
- Cruce KPI 6 (correcciones 30d) master vs Superset · mismo N.
- Cada chart < 3 s primera visita.

### F6 · Ratchets CI
- `bash scripts/ratchets/run-all.sh` verde.

---

## Dependencias

- SPEC-019 F1 completado (datasets registrados una vez).
- Migración `20260828120100_mv_fact_bi` aplicada en réplica (MV `mv_fact_motor_ia_diario` disponible).
- No requiere INSTRUCTIVO-007 (Vanna) — KPIs miden estado del motor rúbrica que ya está en producción.

---

## Artefactos producidos

- `superset/dashboards/motor-ia.yaml`
- `superset/charts/motor_*.yaml` (7 charts)
- Entrada en `05-ENTREGABLES/DASHBOARDS-CATALOGO.md`

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
