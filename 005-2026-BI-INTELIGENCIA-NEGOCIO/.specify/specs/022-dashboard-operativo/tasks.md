# TASKS-022 · Dashboard OPERATIVO

> **Nota de bundle offline (Opción A · 2026-08-29):** YAML declarativos en
> `superset/`. Marco lo cerrado offline; el resto lo cierra Fábrica en VPS.

## F2 · Verificación vocabulario
- [x] `SELECT DISTINCT estado FROM "Reporte"` · upstream (2 filas · REVISION_MANUAL)
- [x] `SELECT DISTINCT estado FROM "SolicitudComite"` · upstream (∅ · default `'PENDIENTE'` schema 1691; uso en código: `PENDIENTE`, `ASIGNADA`, `REVISION_MANUAL`, `RESUELTA`)
- [x] `SELECT DISTINCT "responsableTipo" FROM "TransicionReporte"` · enum cerrado schema 488-495 (IA · WORKER · SISTEMA · OPERADOR · COMITE · ADMIN)

## F3 · Bloqueador D-022.1
- [ ] Fábrica BI-2 pregunta a Jelkin definición "no cerrado" (POSIBLE_SPAM · DUPLICADO) · **coordina Fábrica**
- [ ] Respuesta recibida y documentada en research.md
- [x] KPI 1 usa la propuesta por defecto del spec (`NOT IN ('CLASIFICADO', 'CORREGIDO')`) hasta que llegue respuesta

## F4 · Charts OPERATIVO (SQLs cita literal del spec.md §Alcance)
- [x] `op_reportes_en_flujo_v1` · Big Number `count(*) NOT IN ('CLASIFICADO','CORREGIDO')` · YAML
- [x] `op_comite_pendientes_v1` · Big Number · YAML
- [x] `op_comite_horas_promedio_v1` · Big Number horas 30 d · YAML
- [x] `op_distribucion_estado_reporte_v1` · Pie chart (KPI 4 · antes ausente) · YAML
- [x] `op_revision_manual_gt_7d_v1` · Tabla sin PII (numeroSeguimiento en vez de identificador) · YAML
- [x] `op_transiciones_por_responsable_v1` · Bar chart · YAML
- [x] `op_vencimientos_suscripciones_30d_v1` · Tabla · YAML
- [x] Dashboard `Operativo` YAML con 7 charts
- [x] Export `superset/dashboards/operativo.yaml`

## F5 · Gate local · **VPS**
- [ ] Cruce KPI 1 master vs Superset · mismo N
- [ ] Cruce KPI 2 master vs Superset · mismo N
- [ ] Todos los charts < 3 s

## F6 · Ratchets CI
- [x] 4/5 ratchets local verdes
- [ ] `mv-schema-check.sh` · SKIP en Dev BI-2; Fábrica cierra

## Cierre · **VPS**
- [ ] `cierre.md`
- [ ] Entrada en `DASHBOARDS-CATALOGO.md`
