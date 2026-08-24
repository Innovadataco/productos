# Feature Specification: SPEC-237 — Bandeja comité CONSOLIDACION + vista + aprobación multi-miembro

**Feature Branch**: `work/002-pi-padre-lote-core`

**Created**: 2026-08-22

**Status**: `PLANEADO`

Impacto en arquitectura: enriquece `/dashboard/admin/comite` sin clonar la bandeja (D-72), añade tipo de tarea `CONSOLIDACION_EXPEDIENTE`, extiende `InformeConsolidado` con trazabilidad de aprobaciones (`aprobadoPorMiembrosJson`), correcciones append-only (`correccionesJson`) y guía de acción seleccionable (`guiaAccionCategoriaIdPrincipal`); crea vista `/dashboard/admin/comite/consolidacion/[expedienteId]` y endpoints de aprobación/corrección/devolución restringidos a `COMITE_VALIDACION`.

**Input**: ZEUS instructivo. El comité ya revisa reportes escalados (`REVISION_REPORTE`). Con SPEC-234 se generan `InformeConsolidado` y `PatronExpediente` para agrupar reportes relacionados en un expediente PADRE. El comité necesita una bandeja unificada que muestre tanto revisiones de reporte como consolidaciones de expediente, con SLA visible, y una vista de detalle donde varios miembros aprueben/corrijan/devuelvan el informe consolidado antes de que el expediente pase a `EN_APROBACION_PADRE`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Bandeja unificada con filtro por tipo de tarea (Priority: P1)

Como miembro del comité de validación quiero ver en `/dashboard/admin/comite` tanto las revisiones de reporte (`REVISION_REPORTE`) como las consolidaciones de expediente (`CONSOLIDACION_EXPEDIENTE`), filtrar por tipo, ver distintivo de icono/color y el SLA de cada tarea, para priorizar mi trabajo sin confundir casos individuales con expedientes.

**Why this priority**: sin distinción clara, el comité mezcla reportes sueltos con expedientes complejos que requieren aprobación colegiada.

**Independent Test**: abrir `/dashboard/admin/comite`, alternar el filtro de tipo y verificar que cambian los resultados, el badge y el icono de cada fila, y que el SLA se pinta verde/ámbar/rubi según la fecha límite en zona Bogotá.

**Acceptance Scenarios**:

1. **Given** la bandeja del comité, **Then** cada fila muestra su tipo (`REVISION_REPORTE` o `CONSOLIDACION_EXPEDIENTE`), icono distintivo y badge de color.
2. **Given** el selector de filtro, **When** elijo "Consolidaciones", **Then** solo se listan tareas de tipo `CONSOLIDACION_EXPEDIENTE`.
3. **Given** el selector de filtro, **When** elijo "Revisiones de reporte", **Then** solo se listan tareas de tipo `REVISION_REPORTE`.
4. **Given** una tarea con fecha límite de SLA futura lejana, **Then** el indicador es verde (pino).
5. **Given** una tarea cuya fecha límite de SLA vence en menos de 24 h, **Then** el indicador es ámbar (ambar).
6. **Given** una tarea cuya fecha límite de SLA ya pasó, **Then** el indicador es rojo (rubi).
7. **Given** cualquier tarea, **Then** la fecha/hora del SLA se muestra en zona horaria `America/Bogota` usando `date-fns-tz`.

---

### User Story 2 — Vista de consolidación con timeline y resumen editable (Priority: P1)

Como miembro del comité quiero abrir `/dashboard/admin/comite/consolidacion/[expedienteId]` para ver el encabezado del expediente, la línea de tiempo de eventos, el resumen consolidado editable, los patrones N1 verificables, la señal comunitaria y la guía de acción sugerida, para decidir si apruebo, corrijo o devuelvo el informe.

**Why this priority**: el comité necesita contexto completo en una sola pantalla; la decisión no puede basarse solo en el texto consolidado.

**Independent Test**: acceder a la vista con un expediente que tenga eventos, patrones y señal comunitaria; verificar que todos los bloques se renderizan y que el resumen consolidado es editable.

**Acceptance Scenarios**:

1. **Given** la vista de consolidación, **Then** el encabezado muestra identificador del expediente, estado, categoría dominante y fechas de creación/SLA.
2. **Given** la vista, **Then** se muestra una línea de tiempo con los eventos del expediente (creación, detección de patrones, cambios de estado, aprobaciones).
3. **Given** la vista, **Then** el resumen consolidado se presenta en un campo de texto editable por miembros del comité.
4. **Given** la vista, **Then** se listan los patrones N1 detectados (`PatronExpediente`) con check/verificación para cada uno.
5. **Given** la vista, **Then** se muestra la señal comunitaria agregada (estadísticas descriptivas, nunca veredictos).
6. **Given** la vista, **Then** hay un selector de guía de acción sugerida que por defecto trae la categoría dominante pero permite cambiarla.
7. **Given** la vista, **Then** los botones "Aprobar", "Corregir" y "Devolver" son visibles solo para usuarios con rol `COMITE_VALIDACION`.

---

### User Story 3 — Aprobación multi-miembro con umbral mínimo (Priority: P1)

Como sistema quiero que un `InformeConsolidado` requiera al menos `padre.comite.miembros_minimos_aprobacion` aprobaciones de distintos miembros del comité antes de transicionar el expediente a `EN_APROBACION_PADRE`, para garantizar decisión colegiada y evitar aprobaciones unipersonales.

**Why this priority**: la decisión sobre expedientes PADRE afecta la visibilidad de identificadores; requiere más de un par de ojos.

**Independent Test**: con `miembros_minimos_aprobacion = 2`, aprobar con un miembro → estado sigue pendiente; aprobar con segundo miembro distinto → se llama `aplicarTransicion(expedienteId, 'EN_APROBACION_PADRE')` y se publica el evento `expediente.comite.aprobo`.

**Acceptance Scenarios**:

1. **Given** un informe pendiente con umbral 2, **When** un miembro aprueba, **Then** se registra su aprobación, el contador es 1 y el expediente NO transiciona.
2. **Given** el mismo informe, **When** un segundo miembro distinto aprueba, **Then** el contador alcanza el umbral, se invoca `aplicarTransicion(expedienteId, 'EN_APROBACION_PADRE')` y se publica el evento `expediente.comite.aprobo`.
3. **Given** un informe ya aprobado por el umbral, **When** un tercer miembro intenta aprobar, **Then** se ignora el voto excedente (no se duplica aprobación ni se dispara transición de nuevo).
4. **Given** un miembro que ya aprobó, **When** intenta aprobar de nuevo, **Then** se rechaza con 409 (aprobación duplicada).
5. **Given** el umbral configurable, **When** se cambia a 3, **Then** el sistema requiere 3 aprobaciones distintas para transicionar.

---

### User Story 4 — Corrección de texto con historial append-only (Priority: P1)

Como miembro del comité quiero corregir el resumen consolidado dejando un snapshot de cada cambio, para que la evolución del texto quede trazable sin borrar versiones anteriores.

**Why this priority**: el resumen consolidado es evidencia de la deliberación; no se permite eliminar el texto anterior (I-22/constitución §1.2 no aplica, pero la trazabilidad sí).

**Independent Test**: corregir el texto dos veces con distintos miembros y verificar que `correccionesJson` contiene ambos snapshots con autor, timestamp y motivo; el estado final es `CORREGIDO`.

**Acceptance Scenarios**:

1. **Given** el resumen consolidado, **When** un miembro edita el texto y guarda con motivo, **Then** se actualiza `resumenTextoGenerado` y se añade un snapshot a `correccionesJson`.
2. **Given** una corrección previa, **When** otro miembro vuelve a corregir, **Then** se conserva el snapshot anterior y se añade el nuevo.
3. **Given** una corrección, **Then** el estado del informe pasa a `CORREGIDO` (no `APROBADO`).
4. **Given** un informe en estado `CORREGIDO`, **When** se alcanza el umbral de aprobaciones posteriormente, **Then** igual transiciona el expediente a `EN_APROBACION_PADRE`.
5. **Given** cualquier corrección, **Then** se registra en `AuditLog` sin incluir el texto completo del reporte.

---

### User Story 5 — Devolución con motivo obligatorio (Priority: P1)

Como miembro del comité quiero devolver un expediente al operador/área de origen cuando falta información, para que se complete antes de una decisión definitiva.

**Why this priority**: no todo expediente está listo para aprobación; la devolución debe ser trazable.

**Independent Test**: pulsar "Devolver" sin motivo → validación rechaza; pulsar con motivo → estado del informe cambia a `DEVUELTO` y se registra el motivo.

**Acceptance Scenarios**:

1. **Given** la vista de consolidación, **When** un miembro pulsa "Devolver" sin motivo, **Then** se muestra error de validación y no se guarda nada.
2. **Given** la vista, **When** un miembro pulsa "Devolver" con motivo, **Then** el informe pasa a estado `DEVUELTO`, se persiste el motivo y se registra en `AuditLog`.
3. **Given** un informe devuelto, **Then** desaparece de la bandeja de pendientes de consolidación.
4. **Given** la devolución, **Then** solo `COMITE_VALIDACION` puede ejecutar la acción; `ADMIN` y `PARENT` no.

---

### User Story 6 — Control de acceso estricto por rol (Priority: P1)

Como sistema quiero que solo `COMITE_VALIDACION` apruebe, corrija o devuelva; `ADMIN` pueda leer; y `PARENT` no tenga acceso, para respetar la separación de responsabilidades del comité.

**Why this priority**: la aprobación colegiada es atribución exclusiva del comité; el admin no debe decidir por ellos.

**Independent Test**: intentar aprobar/corregir/devolver con `ADMIN` → 403; con `PARENT` → 403 o redirección; con `COMITE_VALIDACION` → éxito.

**Acceptance Scenarios**:

1. **Given** un usuario `COMITE_VALIDACION`, **Then** puede ver la bandeja, la vista de consolidación y ejecutar Aprobar/Corregir/Devolver.
2. **Given** un usuario `ADMIN`, **Then** puede ver la bandeja y la vista en modo lectura, pero los botones de acción no están disponibles.
3. **Given** un usuario `PARENT`, **Then** no puede acceder a `/dashboard/admin/comite` ni a `/dashboard/admin/comite/consolidacion/*`.
4. **Given** una API call directa, **Then** los endpoints `POST /api/admin/comite/consolidacion/[id]/aprobar`, `/corregir` y `/devolver` retornan 403 para roles no autorizados.

---

## Edge Cases

- **Aprobación simultánea por dos miembros**: la transición se ejecuta una sola vez; el segundo voto se registra pero no dispara doble publicación de `expediente.comite.aprobo`.
- **Corrección justo antes del último voto de aprobación**: el snapshot de corrección queda registrado; el voto posterior sigue siendo válido y transiciona.
- **Cambio del parámetro `miembros_minimos_aprobacion` a 1**: a la primera aprobación se transiciona (caso válido pero no default).
- **Cambio del parámetro a un valor mayor que los miembros activos**: el sistema no bloquea, pero queda documentado como riesgo operativo; no es responsabilidad de esta spec.
- **Miembro inactivo**: solo integrantes del comité con estado `ACTIVO` pueden aprobar; la verificación queda en el servicio de permisos.
- **Guía de acción cambiada por comité**: `guiaAccionCategoriaIdPrincipal` se actualiza; si luego se corrige el texto, ambos cambios quedan trazables.
- **Expediente en estado no consolidable**: si el expediente no está en estado `PENDIENTE_CONSOLIDACION`, la vista muestra los botones deshabilitados con tooltip explicativo.
- **Zona horaria del servidor distinta a Bogotá**: `date-fns-tz` convierte siempre a `America/Bogota` para el SLA visible.
- **Texto de corrección vacío**: validación Zod rechaza con 400 antes de tocar Prisma.
- **Snapshot de corrección excede tamaño máximo**: se valida que `resumenTextoGenerado` no supere el límite del modelo (`@db.Text`); el snapshot se comprime si es necesario.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE extender `/dashboard/admin/comite` para listar tareas de tipo `REVISION_REPORTE` (existente) y `CONSOLIDACION_EXPEDIENTE` (nuevo), sin clonar la bandeja existente (D-72).
- **FR-002**: El sistema DEBE permitir filtrar la bandeja por tipo de tarea (`REVISION_REPORTE`, `CONSOLIDACION_EXPEDIENTE`, `TODOS`).
- **FR-003**: El sistema DEBE mostrar un badge distintivo con icono para cada tipo de tarea en la bandeja.
- **FR-004**: El sistema DEBE calcular y mostrar el SLA de cada tarea en zona horaria `America/Bogota`, pintando el indicador de verde (dentro), ámbar (próximo a vencer, < 24 h) o rojo (vencido).
- **FR-005**: El sistema DEBE crear la vista `/dashboard/admin/comite/consolidacion/[expedienteId]` con: encabezado del expediente, timeline de eventos, resumen consolidado editable, patrones N1 verificables, señal comunitaria y selector de guía de acción sugerida.
- **FR-006**: El sistema DEBE extender `informe-consolidado-repository` con los métodos: `aprobarPorMiembro`, `corregirTexto`, `devolverConMotivo`, `listarPendientesConsolidacion`.
- **FR-007**: El sistema DEBE permitir a `COMITE_VALIDACION` aprobar un informe consolidado, registrando el miembro, timestamp y sin permitir aprobaciones duplicadas del mismo miembro.
- **FR-008**: El sistema DEBE, al alcanzar `padre.comite.miembros_minimos_aprobacion` aprobaciones de distintos miembros, invocar `aplicarTransicion(expedienteId, 'EN_APROBACION_PADRE')` (SPEC-236) y publicar automáticamente el evento `expediente.comite.aprobo`.
- **FR-009**: El sistema DEBE permitir a `COMITE_VALIDACION` corregir el texto consolidado, añadiendo un snapshot append-only a `correccionesJson` y dejando el estado del informe como `CORREGIDO`.
- **FR-010**: El sistema DEBE permitir a `COMITE_VALIDACION` devolver un informe con un motivo obligatorio, cambiando su estado a `DEVUELTO`.
- **FR-011**: El sistema DEBE establecer como guía de acción sugerida por defecto la categoría dominante del expediente, permitiendo al comité cambiarla y persistirla en `InformeConsolidado.guiaAccionCategoriaIdPrincipal`.
- **FR-012**: El sistema DEBE restringir las acciones Aprobar/Corregir/Devolver al rol `COMITE_VALIDACION`; `ADMIN` solo lee; `PARENT` no accede.
- **FR-013**: El sistema DEBE usar el sistema visual del admin: fondo/acentos ámbar para el módulo comité, y semáforo de scores `VERDE=pino`, `AMARILLO=ambar`, `ROJO=rubi`.
- **FR-014**: El sistema DEBE auditar en `AuditLog` cada aprobación, corrección y devolución sin incluir textos completos de reportes.
- **FR-015**: El sistema DEBE extender `TareaBandejaComite` (o tabla equivalente) con el tipo `CONSOLIDACION_EXPEDIENTE` mediante migración aditiva.
- **FR-016**: El sistema DEBE usar `Timestamptz(6)` para todos los campos de fecha/hora nuevos o modificados.

### Key Entities

- **InformeConsolidado** (existente de SPEC-234, extendido): entidad central. Atributos relevantes: `id`, `expedienteId`, `estadoAprobacion`, `resumenTextoGenerado`, `correccionesJson`, `aprobadoPorMiembrosJson`, `guiaAccionCategoriaIdPrincipal`, `motivoDevolucion`, `createdAt`, `updatedAt`.
- **PatronExpediente** (existente de SPEC-234): patrones N1 detectados para el expediente; se muestran verificables en la vista.
- **Expediente** (existente de SPEC-234): agrupa reportes relacionados; provee estado, eventos y timeline.
- **TareaBandejaComite** (existente, extendida): representa una fila de la bandeja; ahora soporta `tipo` = `REVISION_REPORTE` | `CONSOLIDACION_EXPEDIENTE`.
- **ParametroSistema**: nuevo parámetro `padre.comite.miembros_minimos_aprobacion` (INTEGER, default 2) y `padre.comite.sla_horas_consolidacion` (INTEGER, default 72).
- **AuditLog**: registra acciones `INFORME_CONSOLIDADO_APROBADO`, `INFORME_CONSOLIDADO_CORREGIDO`, `INFORME_CONSOLIDADO_DEVUELTO`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El filtro por tipo de tarea en `/dashboard/admin/comite` devuelve resultados correctos en < 1 s y muestra badge/icono distintivo.
- **SC-002**: El indicador de SLA usa `date-fns-tz` para `America/Bogota` y cambia a ámbar a < 24 h de vencerse y a rojo al vencerse.
- **SC-003**: Con `miembros_minimos_aprobacion = 2`, la primera aprobación no transiciona; la segunda dispara `aplicarTransicion(expedienteId, 'EN_APROBACION_PADRE')` y publica `expediente.comite.aprobo` exactamente una vez.
- **SC-004**: Una tercera aprobación sobre el mismo informe es ignorada (no duplica evento ni transición).
- **SC-005**: Una corrección de texto añade un snapshot a `correccionesJson` sin eliminar anteriores y deja el estado `CORREGIDO`.
- **SC-006**: Una devolución sin motivo es rechazada por Zod con 400; con motivo cambia el estado a `DEVUELTO` y se audita.
- **SC-007**: `ADMIN` obtiene 403 al llamar `POST /api/admin/comite/consolidacion/[id]/aprobar`; `PARENT` no accede a la ruta; `COMITE_VALIDACION` ejecuta con éxito.
- **SC-008**: La guía de acción sugerida por defecto coincide con la categoría dominante y puede cambiarse por el comité, persistiendo en `guiaAccionCategoriaIdPrincipal`.
- **SC-009**: Gate local completo (`tsc`, `lint`, `test`, `build`, `dev-restart`) queda verde.

---

## Assumptions

- `InformeConsolidado`, `PatronExpediente`, `Expediente` y `aplicarTransicion` son entregados por SPEC-234/SPEC-236; esta spec solo los consume y extiende.
- El tipo de tarea de bandeja se representa en una tabla/enum existente (`TareaBandejaComite` o equivalente); se añade `CONSOLIDACION_EXPEDIENTE` sin modificar `REVISION_REPORTE`.
- El comité es una única cuenta con rol `COMITE_VALIDACION`; sus integrantes reales se administran en `IntegranteComite` (Spec 024). La aprobación se registra por `usuarioId` de la sesión.
- La guía de acción es una `CategoriaConducta` existente; `guiaAccionCategoriaIdPrincipal` almacena su `id`.
- El color ámbar (`ambar`) y el rojo (`rubi`) son tokens del sistema de diseño heredado; no se introducen nuevas escalas de color.
- El SLA se calcula como `createdAt + sla_horas_consolidacion horas` en zona Bogotá.
- La publicación del evento `expediente.comite.aprobo` se hace mediante el bus de eventos interno de SPEC-236 (pg-boss o mecanismo equivalente).
- No se implementa en esta spec la aclaración padre-comité (SPEC-238), la escalación ROJO (SPEC-239) ni la UI padre (SPEC-232).

---

## Implementación *(por completar al cerrar)*

### Resumen de cambios

*(Se llenará tras la fase de implementación)*

### Decisiones ejecutadas

*(Se llenará tras compuerta §4 si aplica)*

### Gate local

- `npx tsc --noEmit`
- `npm run lint -- --no-cache`
- `npm run test`
- `npm run build`
- `./scripts/dev-restart.sh`

### Deuda técnica / notas

- El candado "NO clone bandeja" implica enriquecer los filtros y el DTO de la bandeja existente; si el componente actual no soporta extensión limpia, evaluar refactor menor previo.
- La aprobación multi-miembro introduce contador en `aprobadoPorMiembrosJson`; si el volumen de miembros crece, evaluar índice o tabla normalizada en spec posterior.
