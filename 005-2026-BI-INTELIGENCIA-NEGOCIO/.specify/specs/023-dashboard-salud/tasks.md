# TASKS-023 · Dashboard SALUD

> **Nota de bundle offline (Opción A · 2026-08-29):** YAML declarativos en
> `superset/`. Marco lo cerrado offline; el resto lo cierra Fábrica en VPS.

## F2 · Verificación fuentes (schema ya citado en research.md)
- [x] Confirmado contra `005-.../prisma/schema.prisma` líneas 96-111: `estado`, `error`, `fuenteCache`, `latenciaMs` existen · `sqlValido`/`hit` NO existen
- [ ] `SELECT to_regclass('public.bi_consulta_log')` · confirmar existencia en la réplica · **VPS**
- [ ] `SELECT DISTINCT estado FROM bi_consulta_log` · anotar vocabulario libre observado · **VPS**
- [ ] `bi-superset-db` con `superset_reader`: confirmar `action`, `dttm`, `json`, `user_id` en `logs` · **VPS**

## F3 · GRANT superset_reader · **VPS · Jelkin ejecuta**
- [ ] SQL propuesto a Jelkin (Fábrica coordina)
- [ ] Usuario `superset_reader` con GRANT SELECT sobre `logs`
- [ ] Entrada en `INVENTARIO-DE-SECRETOS.md`

## F4 · Charts SALUD (8 KPIs)
- [x] `salud_lag_replica_v1` · Big Number `pg_last_xact_replay_timestamp()` · refresh 1 min · YAML
- [x] `salud_consultas_vanna_24h_v1` · Big Number placeholder · YAML
- [x] `salud_precision_vanna_v1` · Big Number % (`estado='exitoso' AND error IS NULL`) · YAML
- [x] `salud_errores_superset_24h_v1` · Big Number sobre `bi-superset-db.logs` · YAML
- [x] `salud_uptime_servicios_v1` · Line chart · usa columnas reales de `mv_fact_salud_sistema` (`dia`, `total_eventos_audit`) como placeholder hasta INSTRUCTIVO-008 · YAML
- [x] `salud_cache_hit_vanna_v1` · Big Number % (`fuenteCache=true`) · YAML
- [x] `salud_reintentos_reporte_v1` · Big Number · YAML
- [x] `salud_rate_limits_hoy_v1` · Tabla · YAML
- [x] Dashboard `Salud` YAML con 8 charts
- [x] Export `superset/dashboards/salud.yaml`

## F5 · Gate local · **VPS**
- [ ] KPI 1: desconectar/reconectar réplica → lag sube/baja
- [ ] KPI 4: forzar error Superset → aparece
- [ ] KPI 7: insertar `exitoso=false` local → contador sube
- [ ] KPI 8: insertar `RateLimit` local → fila aparece
- [ ] Placeholders 2/3/5/6 muestran "No data" limpio

## F6 · Ratchets CI
- [x] 4/5 ratchets local verdes
- [ ] `mv-schema-check.sh` · SKIP en Dev BI-2; Fábrica cierra

## Cierre · **VPS**
- [ ] `cierre.md` con marcado 4 KPIs placeholder
- [ ] Entrada en `DASHBOARDS-CATALOGO.md`
- [ ] Actualización `INVENTARIO-DE-SECRETOS.md` con `superset_reader`
