# PLAN-022 · Dashboard OPERATIVO

## Fases

### F1 · Datasets (heredados de SPEC-019)
`Reporte` · `SolicitudComite` · `TransicionReporte` · `Subscription` · `Colegio` · `mv_fact_operativo`.

### F2 · Verificación vocabulario real
```sql
SELECT DISTINCT estado, count(*) FROM "Reporte" WHERE "eliminado" = false GROUP BY estado ORDER BY 2 DESC;
SELECT DISTINCT estado, count(*) FROM "SolicitudComite" GROUP BY estado;
SELECT DISTINCT "responsableTipo"::text, count(*) FROM "TransicionReporte" GROUP BY "responsableTipo";
```
Anotar en research.md. Confirmar que los enums coinciden con los declarados en schema.prisma.

### F3 · Confirmación definición "no cerrado" (bloqueador D-022.1)
Fábrica BI-2 pregunta a Jelkin (por su canal directo):
> Para el KPI 1 del dashboard OPERATIVO, ¿un reporte "en flujo" es todo aquel cuyo estado no es CLASIFICADO ni CORREGIDO, siempre que no esté eliminado? ¿Contamos POSIBLE_SPAM y DUPLICADO como abiertos o cerrados?

Si Jelkin no responde en 24 h → PARA (regla dura del INSTRUCTIVO-010).

### F4 · Charts OPERATIVO (7 KPIs)
1. `op_reportes_en_flujo_v1` · Big Number
2. `op_comite_pendientes_v1` · Big Number
3. `op_comite_horas_promedio_v1` · Big Number horas
4. `op_distribucion_estado_reporte_v1` · Pie chart
5. `op_revision_manual_gt_7d_v1` · Tabla ordenada por antigüedad
6. `op_transiciones_por_responsable_v1` · Bar chart
7. `op_vencimientos_suscripciones_30d_v1` · Tabla + Big Number (dos charts)

Dashboard `Operativo` · export `superset/dashboards/operativo.yaml`.

### F5 · Gate local
- Cruce KPI 1 (reportes en flujo) master vs Superset · mismo N.
- Cruce KPI 2 (SolicitudComite PENDIENTE) master vs Superset · mismo N.
- Cada chart < 3 s.

### F6 · Ratchets CI verdes.

---

## Dependencias

- SPEC-019 F1 completado.
- Respuesta de Jelkin al D-022.1 antes de acusar CUMPLE (implementación puede avanzar con la interpretación por defecto documentada).

---

## Artefactos producidos

- `superset/dashboards/operativo.yaml`
- `superset/charts/op_*.yaml`
- Entrada en `DASHBOARDS-CATALOGO.md`

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
