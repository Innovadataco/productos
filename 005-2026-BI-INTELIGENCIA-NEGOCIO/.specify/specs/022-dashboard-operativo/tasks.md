# TASKS-022 · Dashboard OPERATIVO

## F2 · Verificación vocabulario
- [ ] `SELECT DISTINCT estado FROM "Reporte" ...` · anotar
- [ ] `SELECT DISTINCT estado FROM "SolicitudComite"` · anotar
- [ ] `SELECT DISTINCT "responsableTipo" FROM "TransicionReporte"` · anotar

## F3 · Bloqueador D-022.1
- [ ] Fábrica BI-2 pregunta a Jelkin definición "no cerrado" (POSIBLE_SPAM · DUPLICADO)
- [ ] Respuesta recibida y documentada en research.md

## F4 · Charts OPERATIVO
- [ ] `op_reportes_en_flujo_v1` · Big Number · refresh 15 min
- [ ] `op_comite_pendientes_v1` · Big Number · refresh 15 min
- [ ] `op_comite_horas_promedio_v1` · Big Number horas · refresh 60 min
- [ ] `op_distribucion_estado_reporte_v1` · Pie chart · refresh 15 min
- [ ] `op_revision_manual_gt_7d_v1` · Tabla · refresh 15 min
- [ ] `op_transiciones_por_responsable_v1` · Bar chart · refresh 30 min
- [ ] `op_vencimientos_suscripciones_30d_v1` (Big Number + Tabla) · refresh 60 min
- [ ] Dashboard `Operativo` creado
- [ ] Export `superset/dashboards/operativo.yaml`

## F5 · Gate local
- [ ] Cruce KPI 1 master vs Superset · mismo N
- [ ] Cruce KPI 2 master vs Superset · mismo N
- [ ] Todos los charts < 3 s

## F6 · Ratchets CI
- [ ] `run-all.sh` verde

## Cierre
- [ ] `cierre.md`
- [ ] Entrada en `DASHBOARDS-CATALOGO.md`
