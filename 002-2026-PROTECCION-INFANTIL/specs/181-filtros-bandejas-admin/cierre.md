# Cierre: SPEC-181 — Filtros, búsqueda y orden en las bandejas del admin

**Fecha**: 2026-08-19 · **Rama**: `work/002-pi-078` · **Modo**: autónomo (aprobado por CEO tras revisión de prod).

## Qué se implementó

1. **Bandeja principal** (`/dashboard/admin`): ganó "Ordenar por" (Prioridad / Más recientes / Más antiguos). El orden antes era fijo; ahora `reportesRevisionQuerySchema` acepta `orden` y `findBandejaRevision` usa el mapa cerrado `ORDENES_BANDEJA` (cero interpolación).
2. **Spam** (`/dashboard/admin/spam`): de cero filtros a barra completa — búsqueda (identificador/número de seguimiento), filtro por estado (POSIBLE_SPAM/REVISION_MANUAL), orden, paginación visible con URL como fuente de verdad. Endpoint con Zod (`spamPendientesQuerySchema`, 400 claro ante inválidos) y respuesta alineada a la convención `{ reportes, pagination }` con `pageSize` (antes `paginacion`/`limit`).
3. **Anti-abuso** (`/dashboard/admin/anti-abuso`): barra con búsqueda por identificador + filtro por nivel de riesgo + plataforma + orden; paginación convencional; y el loading dejó de ser el skeleton ad-hoc que "parpadea" — ahora `Cargando` estándar (el contenido previo permanece durante refetch). Colores crudos migrados a tokens (badges de nivel: pino/ambar/rubi).

## Decisiones documentadas

- `nivel` filtra sobre la columna persistida `nivelRiesgo` (score actual), no sobre el nivel simulado en vuelo — lo único filtrable a nivel BD.
- `asignadoAMi` quedó `z.coerce.boolean().default(false)` (patrón del archivo).
- ALTO/CRITICO comparten familia `rubi` (diferenciados por intensidad/ring): la paleta no tiene naranja.
- No se creó componente `BarraFiltros` compartido (3 implementaciones similares > abstracción prematura; se extrae si crece).

## Evidencia

- Integration: spam 8/8 (400 inválido, q, estado, orden real por ids, paginación convencional) · bandeja 5/5 (órdenes reordenan) · anti-abuso 8/8 (400s, q/nivel/plataforma/orden/paginación).
- Unit: SpamRevisionPanel 2/2 · AdminAntiAbusoSimulacion 4/4 (incl. `Cargando` sin `animate-pulse`).
- Gate: tsc · eslint --no-cache · arch:check · tokens · unit 852/852 · integration full · journeys · build · arranque — anexo en PR.

## Nota

- Sin migraciones, sin cambios de modelo/permisos/motor. `validators.ts` quedó con un solo dueño por cambio (regla del swarm); el schema de anti-abuso vive en `schemas/index.ts` documentado.
