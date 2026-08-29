# TASKS-023 · Dashboard SALUD

## F2 · Verificación fuentes (schema ya citado en research.md)
- [ ] `SELECT to_regclass('public.bi_consulta_log')` · confirmar existencia en la réplica
- [ ] `SELECT DISTINCT estado FROM bi_consulta_log` · anotar vocabulario libre observado
- [ ] Confirmar contra `005-.../prisma/schema.prisma` líneas 96-111 que columnas usadas son `estado`, `error`, `fuenteCache`, `latenciaMs` (NO `sqlValido`/`hit`)
- [ ] En `bi-superset-db` con `superset_reader`: `SELECT column_name FROM information_schema.columns WHERE table_name='logs';` · confirmar `action`, `dttm`, `json`, `user_id`

## F3 · GRANT superset_reader (Jelkin ejecuta)
- [ ] SQL propuesto a Jelkin (Fábrica coordina)
- [ ] Usuario `superset_reader` con GRANT SELECT sobre `logs`
- [ ] Entrada en `INVENTARIO-DE-SECRETOS.md`

## F4 · Charts SALUD (8 KPIs)
- [ ] `salud_lag_replica_v1` · Big Number · umbral 30 s · refresh 1 min
- [ ] `salud_consultas_vanna_24h_v1` · Big Number placeholder
- [ ] `salud_precision_vanna_v1` · Big Number % placeholder
- [ ] `salud_errores_superset_24h_v1` · Tabla · datasource bi-superset-db
- [ ] `salud_uptime_servicios_v1` · Line chart placeholder
- [ ] `salud_cache_hit_vanna_v1` · Big Number % placeholder
- [ ] `salud_reintentos_reporte_v1` · Big Number · refresh 30 min
- [ ] `salud_rate_limits_hoy_v1` · Tabla · refresh 60 min
- [ ] Dashboard `Salud` creado · 8 charts
- [ ] Export `superset/dashboards/salud.yaml`

## F5 · Gate local
- [ ] KPI 1: desconectar/reconectar réplica → lag sube/baja
- [ ] KPI 4: forzar error Superset → aparece
- [ ] KPI 7: insertar `exitoso=false` local → contador sube
- [ ] KPI 8: insertar `RateLimit` local → fila aparece
- [ ] Placeholders 2/3/5/6 muestran "No data" limpio

## F6 · Ratchets CI
- [ ] `run-all.sh` verde

## Cierre
- [ ] `cierre.md` con marcado 4 KPIs placeholder
- [ ] Entrada en `DASHBOARDS-CATALOGO.md`
- [ ] Actualización `INVENTARIO-DE-SECRETOS.md` con `superset_reader`
