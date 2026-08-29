# PLAN-019 · Dashboard EJECUTIVO

## Fases

### F1 · Datasets Superset (transversal a 019..023 · se hace una vez)
1. Crear conexión Superset → `bi-db-replica:5432` con `bi_reader` (URI en `.env.bi.production` fuera de git).
2. Registrar 10 datasets físicos: `Reporte` · `ClasificacionIA` · `Subscription` · `BillingCycle` · `Colegio` · `Plan` · `SolicitudComite` · `TransicionReporte` · `CorreccionAdmin` · `clasificacion_rubrica_votos`.
3. Registrar 5 datasets sobre MVs: `mv_fact_reporte_diario` · `mv_fact_motor_ia_diario` · `mv_fact_operativo` · `mv_fact_comercial_mensual` · `mv_fact_salud_sistema`.
4. Export JSON de cada dataset en `superset/datasets/*.yaml` (Superset usa YAML para import/export).

### F2 · Verificación GRANT PII (candado 20 · transversal)

**Método: prueba activa** (no `\dp` de inspección). Autenticado como `bi_reader` intentar el SELECT prohibido y confirmar `ERROR: permission denied for column ...`. `\dp` se acepta solo como diagnóstico complementario, nunca como veredicto.

```bash
export PGPASSWORD="$BI_READER_PASSWORD"
for q in \
  'SELECT "passwordHash" FROM public."Usuario" LIMIT 1;' \
  'SELECT "representanteLegalNombre" FROM public."Colegio" LIMIT 1;' \
  'SELECT "representanteLegalIdentificacion" FROM public."Colegio" LIMIT 1;' \
  'SELECT "representanteLegalEmail" FROM public."Colegio" LIMIT 1;' \
  'SELECT "representanteLegalTelefono" FROM public."Colegio" LIMIT 1;' \
  'SELECT texto FROM public."Reporte" LIMIT 1;' \
  'SELECT "textoOriginal" FROM public."Reporte" LIMIT 1;' \
  ; do
  out=$(psql -h bi-db-replica -U bi_reader -d proteccion_infantil -c "$q" 2>&1 || true)
  echo "$q → $out"
  [[ "$out" == *"permission denied"* ]] || { echo "CANDADO 20 ROTO: $q devolvió datos"; exit 2; }
done
```

Si CUALQUIER query no devuelve `permission denied` → PARA · escala a Fábrica BI-2 (candado 20 rompe · GRANT mal configurado). El `passwordHash` es el nombre real del campo (schema PI línea 534) — no `password`.

### F3 · Verificación vocabulario real (candado 15 · transversal)
Contra `bi-db-replica` con `bi_reader`:
```sql
SELECT DISTINCT estado FROM "Reporte";       -- esperado enum EstadoReporte 8 valores
SELECT DISTINCT estado FROM "Subscription";  -- esperado default 'activo' + otros libres
SELECT DISTINCT estado FROM "BillingCycle";  -- esperado default 'pendiente' + 'pagado' + otros
SELECT DISTINCT estado FROM "SolicitudComite"; -- esperado default 'PENDIENTE' + otros
SELECT DISTINCT estado FROM "Colegio";       -- esperado default 'activo' + otros
```
Anotar valores REALES en `research.md` de cada SPEC afectada. Si difieren del brief, ajustar SQL antes de guardar chart.

### F4 · Construcción del dashboard EJECUTIVO en Superset
1. Crear 6 charts (uno por KPI del spec.md):
   - Big Number (KPI 1, 2, 3, 4) con delta configurado y colorización condicional.
   - Line chart (KPI 5).
   - Bar chart horizontal (KPI 6).
2. Nombre canónico de charts: `ejec_<slug>_v1` (ejemplo `ejec_reportes_24h_v1`).
3. Refresh interval configurado por chart según tabla del spec.md.
4. Dashboard `Ejecutivo` como default landing tras login.
5. Export dashboard JSON en `superset/dashboards/ejecutivo.yaml`.

### F5 · Gate local (candado 14 · verificación en vivo)
- `docker compose -f docker-compose.bi.yml up -d bi-superset bi-db-replica` → logs sin errores.
- Test conexión Superset → `bi-db-replica` → `SELECT 1` OK.
- Cada chart carga en < 3 s primera visita (log tiempos en `research.md`).
- Cruce master vs Superset:
  ```
  psql -h pi-db -U proteccion -c "SELECT count(*) FROM \"Reporte\" WHERE \"creadoEn\" >= NOW() - INTERVAL '24 hours' AND \"eliminado\" = false"
  ```
  → mismo N que KPI 1 (diff ≤ 10 s lag replica).
- Cruce MRR: consultar en réplica el KPI 3 y validar centavo por centavo contra cierre financiero mensual de Jelkin (Fábrica BI-2 hace este cruce · registro en `research.md`).

### F6 · Ratchets CI
- `bash scripts/ratchets/run-all.sh` verde (cero-secretos · cero-sql-raw en app · mv-schema-check).

---

## Dependencias

- **INSTRUCTIVO-006 CUMPLE** → MV `mv_fact_reporte_diario` disponible (verificado migración `20260828120100_mv_fact_bi`).
- **INSTRUCTIVO-002 CUMPLE** → `bi-db-replica` levantada con datos frescos vía pg_logical.
- **GRANT PII revocado** → confirmado en F2 antes de F4.

---

## Artefactos producidos

- `superset/datasets/*.yaml` (10 tablas físicas + 5 MVs, transversal a 019..023)
- `superset/dashboards/ejecutivo.yaml`
- `superset/charts/ejec_*.yaml` (6 charts EJECUTIVO)
- `05-ENTREGABLES/DASHBOARDS-CATALOGO.md` (transversal · entrada del EJECUTIVO)

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
