# Registro de pendientes de afinamiento — Spec-050

> Tipo: documento de gestión/seguimiento (numeración 050+, sin código).
> Fecha de creación: 2026-07-18.
> Estado: **ACTIVO** — registro vivo.

## Principio rector

Estos pendientes **NO se tocan durante la fase de desarrollo**. Se resuelven todos juntos en la fase de **AFINAMIENTO**, una vez cerrado el desarrollo de módulos. Se agregan nuevos ítems a esta tabla cuando aparece un ajuste de modelo, datos o configuración que no bloquea el desarrollo actual.

## Registro

| id | Título | Qué resolver | Estado | Disparador | Fuente |
|----|--------|--------------|--------|------------|--------|
| A1 | Curaduría de los 14 casos dudosos del fixture | Re-etiquetar los 14 casos de `fixtureVersion=11` con el criterio del owner y generar una nueva baseline (v3). | PENDIENTE | Sesión de curaduría con el owner. | [`docs/deuda-tecnica.md`](../../docs/deuda-tecnica.md) N7 |
| A2 | Umbral de revisión `reportes.classification.umbral_revision` | Hoy `1.0` envía casi todo a `REVISION_MANUAL`. Ajustar con datos reales para balancear cautela vs operabilidad. | PENDIENTE | Simulación post-despliegue sobre reportes reales, aprobación del owner. | [`docs/deuda-tecnica.md`](../../docs/deuda-tecnica.md) A4 |
| A3 | Peso de fuente (`scoring.source_weight.enabled`) | Flag apagado. Activar y recalcular scores históricos tras simulación en seco sobre datos reales. | PENDIENTE | Simulación post-despliegue que apruebe el owner. | [`docs/deuda-tecnica.md`](../../docs/deuda-tecnica.md) N3 |
| A4 | Modelo de desempate (`reportes.classification.modelo_desempate`) | Hoy vacío. Reactivar si el Laboratorio IA encuentra una configuración que mejore la baseline. | PENDIENTE | Evaluación en laboratorio que supere la baseline actual. | [`docs/deuda-tecnica.md`](../../docs/deuda-tecnica.md) N2 |
| A5 | Reducir error silencioso al KPI <5% | Baseline actual: 16,7% de error silencioso. Mejorar con correcciones reales alimentando el RAG (operación, no código). | PENDIENTE | Nuevas correcciones de operadores alimentando `DatasetEntrenamiento` + re-evaluación. | [`docs/deuda-tecnica.md`](../../docs/deuda-tecnica.md) A4 |

## Notas

- Los ítems `NECESITA SPEC` de [`docs/deuda-tecnica.md`](../../docs/deuda-tecnica.md) que son **features nuevos** (proveedor SMS real, hard-delete, jobs automáticos, notificaciones, HTTPS, etc.) no entran en este registro; cada uno requiere su propia spec cuando se priorice.
- La fase de afinamiento se inicia cuando el owner declare cerrado el desarrollo de módulos y autorice ajustes sobre el modelo con datos reales.
