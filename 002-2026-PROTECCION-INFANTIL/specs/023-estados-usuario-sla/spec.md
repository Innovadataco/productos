# Spec 023 — Estados de cara al usuario + SLA visible

> Estado: **EN DISEÑO**.
> Plan: [`plan.md`](plan.md).

## Alcance

Simplificar los estados que ve el usuario final a solo dos conceptos: "En proceso" y "Procesado". Ocultar reportes dados de baja en las vistas públicas/privadas del usuario final. Corregir el bug de `/seguimiento?numero=` que muestra reportes eliminados.

## Decisiones

- Estados internos se mantienen (`CLASIFICADO`, `CORREGIDO`, `REVISION_MANUAL`, etc.) para métricas y operación.
- Estados de cara al usuario:
  - **En proceso**: `PENDIENTE`, `PROCESANDO`, `REVISION_MANUAL`, `POSIBLE_SPAM`, `REQUIERE_ANONIMIZACION`.
  - **Procesado**: `CLASIFICADO`, `CORREGIDO`.
- Reportes `eliminado=true` no aparecen en:
  - `/mis-reportes`
  - `/seguimiento?numero=...`
  - `/consulta?identificador=...` (ya oculta)
- SLA visible: mensaje configurable "En proceso — puede tardar hasta XXX", donde `XXX` es parámetro `ui.sla_horas_procesamiento` en `ParametroSistema`.

## Requisitos

1. Backend: mapeo de estados internos a visuales en endpoints de seguimiento y mis-reportes.
2. Backend: filtrar `eliminado=false` en seguimiento y mis-reportes.
3. Frontend: mostrar "En proceso" / "Procesado" con variantes de badge.
4. Configuración: parámetro `ui.sla_horas_procesamiento` editable desde `/dashboard/admin/configuracion`.
5. Internamente `CLASIFICADO` vs `CORREGIDO` se mantienen separados.

## Riesgos mitigados

- Confusión del usuario: dos estados claros en vez de ocho.
- Exposición de reportes dados de baja: se ocultan en vistas de usuario final.

## R7

No aplica: no toca el pipeline de clasificación.
