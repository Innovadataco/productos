# PLAN-023 · Dashboard SALUD

## Fases

### F1 · Datasets (mayoría hereda de SPEC-019 · agregar 2 nuevos)
Heredados: `ReintentoReporte` · `RateLimit`.

Nuevos datasets a agregar (adicional a SPEC-019 F1):
- **SQL Lab dataset virtual** para `pg_last_xact_replay_timestamp()` (KPI 1) — Superset acepta SQL virtual como dataset. Nombre `bi_lag_replica_virtual`.
- **Dataset `bi_consulta_log`** en la réplica (creado por INSTRUCTIVO-006 · migración `20260828120000_schema_catalogo_bi_inicial`).
- **Segunda conexión Superset** a `bi-superset-db:5432` con usuario read-only `superset_reader` (usuario nuevo · documentar en `INVENTARIO-DE-SECRETOS.md`) para leer tabla `logs` (KPI 4).

### F2 · Verificación de estructura en fuente (candado 15)
```sql
-- En bi-db-replica
\d "ReintentoReporte"                                             -- confirmar columnas exitoso, creadoEn
\d "RateLimit"                                                    -- confirmar scope, count, windowStart
SELECT to_regclass('public.bi_consulta_log') AS existe;           -- verificar si la tabla ya está desplegada
\d public.bi_consulta_log                                         -- si existe, listar columnas para KPIs 2, 3, 6

-- En bi-superset-db (con superset_reader)
\d public.logs                                                    -- estructura de la tabla de logs Superset
```
Anotar en research.md.

### F3 · GRANT superset_reader
En `bi-superset-db`:
```sql
CREATE ROLE superset_reader WITH LOGIN PASSWORD '<en .env.bi.production>';
GRANT CONNECT ON DATABASE <superset_metadata> TO superset_reader;
GRANT USAGE ON SCHEMA public TO superset_reader;
GRANT SELECT ON TABLE logs TO superset_reader;
```
(SQL propuesto · Jelkin ejecuta manualmente en producción · Fábrica coordina.)

### F4 · Charts SALUD (8 KPIs)
1. `salud_lag_replica_v1` · Big Number · umbral rojo > 30 s · refresh 1 min · dataset virtual SQL Lab
2. `salud_consultas_vanna_24h_v1` · Big Number · placeholder "No data" acepta
3. `salud_precision_vanna_v1` · Big Number % · placeholder
4. `salud_errores_superset_24h_v1` · Tabla (dttm, user, error) · datasource `bi-superset-db`
5. `salud_uptime_servicios_v1` · Line chart · placeholder
6. `salud_cache_hit_vanna_v1` · Big Number % · placeholder
7. `salud_reintentos_reporte_v1` · Big Number con umbral configurable · refresh 30 min
8. `salud_rate_limits_hoy_v1` · Tabla scope+SUM · refresh 60 min

Dashboard `Salud` · export `superset/dashboards/salud.yaml`.

### F5 · Gate local (candado 14)
- **KPI 1 lag:** desconectar temporalmente la réplica del publisher pg_logical (Fábrica lo hace en gate local con contenedores) → lag debe subir; reconectar → lag baja. Documentar tiempos.
- **KPI 4:** provocar un error de query en Superset (SQL malformada) → aparece en el chart en < 30 s.
- **KPI 7:** insertar registro con `exitoso = false` en `ReintentoReporte` local → contador sube.
- **KPI 8:** insertar fila en `RateLimit` con `windowStart` de hoy → aparece.
- Placeholders 2, 3, 5, 6: verificar que muestren "No data" limpio (no crashee el dashboard).
- Todos los charts < 3 s.

### F6 · Ratchets CI verdes.

---

## Dependencias

- SPEC-019 F1 (datasets base).
- INSTRUCTIVO-006 CUMPLE (tabla `bi_consulta_log` creada · aunque esté vacía).
- Superset con acceso a `bi-superset-db` para KPI 4 (Jelkin crea `superset_reader`).
- INSTRUCTIVO-007 e INSTRUCTIVO-008 NO son bloqueantes — su ausencia se refleja como "No data" limpio.

---

## Artefactos producidos

- `superset/dashboards/salud.yaml`
- `superset/charts/salud_*.yaml` (8 charts)
- Entrada en `DASHBOARDS-CATALOGO.md` marcando 4 KPIs como placeholder
- Anotación en `INVENTARIO-DE-SECRETOS.md`: nuevo usuario `superset_reader` para KPI 4

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
