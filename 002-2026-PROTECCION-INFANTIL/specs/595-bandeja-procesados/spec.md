# SPEC-595 · Bandeja: separar pendientes (accionables) de procesados (solo visualización)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-08 · **Origen**: orden CEO (Jelkin), 06-09-2026. Rama `work/pi-SPEC-595-bandeja-procesados`.

## Impacto en arquitectura: no

No hay endpoints nuevos ni migraciones. `GET /api/admin/reportes-revision` gana un parámetro de consulta opcional (`seccion`) y devuelve además los contadores por sección. El componente de la bandeja (`AdminReportesTable`, compartido por ADMIN/OPERADOR/COMITE_VALIDACION) gana dos pestañas y un modal de detalle solo-lectura que reutiliza `ReporteDetalleInfo`.

## El problema

Pedido textual del dueño viendo `/dashboard/admin/bandeja`: «si el operador ya clasificó debe aparecer la información en una tabla pero solo modo visualizar, y diferenciar a las pendientes». Hoy la bandeja mezcla en una sola tabla los casos que exigen acción (confirmar, corregir, anonimizar) con los ya atendidos, y el detalle siempre abre en modo edición.

## Separación de estados (verificada contra `EstadoReporte` y las transiciones reales)

- **Pendientes (accionables)**: `PENDIENTE`, `PROCESANDO`, `REVISION_MANUAL`, `REQUIERE_ANONIMIZACION`, y `CLASIFICADO` **sin corrección/confirmación humana** (`clasificacion.correccion IS NULL`) — la confirmación humana se registra como `CorreccionAdmin`, por eso es el marcador de «atendido».
- **Procesados (solo visualización)**: `CORREGIDO`, `DUPLICADO`, `POSIBLE_SPAM`, y `CLASIFICADO` **con corrección/confirmación humana**. Decisión del dueño: `POSIBLE_SPAM` va en procesados; su atención ocurre en la bandeja de spam propia (`revision_spam`, SPEC-181/SPEC-452), no en esta.

## Alcance

- **API** (`reportesRevisionQuerySchema` + `GET /api/admin/reportes-revision`): parámetro `seccion=pendientes|procesados` (default `pendientes`). El filtro se aplica server-side con `AND` sobre los filtros existentes (estado, plataforma, categoría, fechas, búsqueda, operador). La respuesta incluye `secciones: { pendientes, procesados }` (totales con los mismos filtros, sin paginar).
- **Bandeja** (`AdminReportesTable`): dos pestañas con contadores («N pendientes» / «N procesados»), estado en la URL (`?seccion=`), pestaña por defecto «Pendientes». Los filtros actuales se mantienen y aplican dentro de la sección activa.
- **Tabla de procesados**: solo lectura — visualmente apagada, sin botones de clasificar/corregir; única acción «Ver detalle», que abre la vista solo-lectura.
- **Detalle solo-lectura** (`ReporteDetalleSoloLectura`): modal nuevo en `reporte-detalle/` que reutiliza `ReporteDetalleInfo` (que ya contiene exactamente la estructura pedida: número de seguimiento, estado, plataforma, identificador, ubicación, fecha del incidente, origen, recibido, clasificación IA y historial de intentos de procesamiento). NO incluye panel de revelado de original, historial de accesos ni acciones — esa lógica pertenece a SPEC-592/594 (agente paralelo) y aquí no se toca. `useReporteDetalle` y `AdminReporteDetalle` quedan sin cambios.
- **Roles**: la bandeja es un solo componente para ADMIN, OPERADOR y COMITE_VALIDACION (los tres entran por `/dashboard/admin/bandeja` con módulo `bandeja_reportes`); la separación aplica a los tres sin cambios de permisos.

## Functional Requirements

- **FR-001**: El sistema DEBE separar la bandeja en dos secciones, «Pendientes» y «Procesados», con la asignación de estados definida arriba, aplicada SIEMPRE server-side.
- **FR-002**: El sistema DEBE mostrar un contador de casos por sección y debe conservar todos los filtros existentes funcionando dentro de cada sección.
- **FR-003**: La tabla de «Procesados» DEBE ser de solo visualización: sin acciones de clasificación, corrección, anonimización ni revelado, y con la única acción «Ver detalle» abriendo el modal solo-lectura.
- **FR-004**: El detalle solo-lectura DEBE mostrar la estructura de campos pedida por el dueño (seguimiento, estado, plataforma, identificador, ubicación, fecha del incidente, origen, recibido, clasificación IA, historial de intentos) y NO DEBE ofrecer ni ejecutar mutaciones.
- **FR-005**: La sección por defecto DEBE ser «Pendientes» y la selección DEBE persistir en la URL.

## Criterios de aceptación

- [x] Tests API: cada estado cae en la sección correcta (incluido `CLASIFICADO` con/sin corrección), el default es pendientes, los filtros coexisten con `seccion`, y la respuesta trae `secciones`.
- [x] Tests componente: pestañas con contadores, tabla procesados sin botones de acción (solo «Ver detalle»), modal solo-lectura con la estructura de campos.
- [x] `tsc --noEmit`, ESLint, `npm run test` y `npm run build` en verde.

## Implementación

- `src/lib/validators.ts`: `seccion` en `reportesRevisionQuerySchema`.
- `src/app/api/admin/reportes-revision/route.ts`: filtro por sección + `secciones` en la respuesta.
- `src/lib/dal/repositories/reporte.ts`: `contarBandejaRevision(where)`.
- `src/components/modules/reporte-detalle/ReporteDetalleSoloLectura.tsx`: modal solo-lectura (fetch propio del detalle, reutiliza `ReporteDetalleInfo`).
- `src/components/modules/AdminReportesTable.tsx`: pestañas + modo solo lectura de procesados.
- Tests: `route.test.ts` (sección), `AdminReportesTable.test.tsx` (pestañas/modo lectura), `ReporteDetalleSoloLectura.test.tsx`.

## Deuda técnica / notas

- El detalle editable (`AdminReporteDetalle`) y su hook no se tocaron por coordinación con SPEC-592/594; el modal solo-lectura hace su propio fetch en lugar de reutilizar `useReporteDetalle` para no arrastrar estado de acciones que no usa.
