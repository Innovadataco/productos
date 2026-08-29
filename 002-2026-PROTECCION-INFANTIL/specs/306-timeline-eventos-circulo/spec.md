# Feature Specification: Timeline de eventos del círculo de confianza

**Feature Branch**: `work/pi-SPEC-306-timeline-eventos-circulo`

**Created**: 2026-08-29

**Status**: IMPLEMENTADO

**Input**: User description: "Timeline eventos círculo (últimos 30d · con severity y botón 'abrir expediente'). Crea GET /api/padre/circulo-confianza/timeline que devuelva eventos de los últimos 30 días relacionados con identificadores del círculo (reportes visibles + eventos de expediente). Componente TimelineEventosCirculo con severity, fecha, categoría y botón 'abrir expediente'. Sin LLM."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver timeline de eventos del círculo (Priority: P1)

Como padre con contactos en mi círculo de confianza, quiero ver una línea de tiempo con los eventos de los últimos 30 días relacionados con los identificadores de mi círculo, para entender la actividad reciente y decidir si abro un expediente.

**Why this priority**: Es la pieza central del Home Padre Proactivo; convierte datos dispersos (reportes + eventos de expediente) en una narrativa cronológica accionable.

**Independent Test**: Puede probarse cargando `/dashboard/padre` con un usuario PARENT que tenga contactos con identificadores reportados o con expedientes; el timeline debe mostrar eventos de los últimos 30 días ordenados de más reciente a más antiguo.

**Acceptance Scenarios**:

1. **Given** un padre con contactos activos en el círculo, **When** accede al home, **Then** ve una línea de tiempo con eventos de los últimos 30 días.
2. **Given** un evento de reporte visible de un identificador del círculo, **When** se renderiza, **Then** muestra fecha, categoría, severity y un botón para abrir expediente si el reporte ya tiene expediente asociado.
3. **Given** un evento de expediente cuyo identificador reportado está en el círculo, **When** se renderiza, **Then** muestra fecha, estado/severity y el botón "abrir expediente".
4. **Given** un evento con severity ROJO, **When** se renderiza, **Then** usa el color de alerta crítica y aparece primero si hay empate de fecha.
5. **Given** un padre sin contactos o sin eventos en la ventana, **When** accede al timeline, **Then** se muestra un estado vacío amigable.

### User Story 2 - Exponer timeline vía API reusable (Priority: P2)

Como frontend del área del padre, quiero consumir el timeline desde un endpoint propio, para poder reutilizarlo en el home y en futuras vistas del círculo.

**Why this priority**: Desacopla la consulta de la UI, facilita tests unitarios del ensamblado de eventos sin renderizado y asegura consistencia entre vistas.

**Independent Test**: `GET /api/padre/circulo-confianza/timeline` debe devolver el array de eventos de los últimos 30 días con tipo, fecha, severity, categoría, título, descripción y `expedienteId`.

**Acceptance Scenarios**:

1. **Given** una sesión de rol PARENT, **When** llama al endpoint, **Then** recibe solo eventos asociados a identificadores activos de sus contactos.
2. **Given** una sesión sin rol PARENT, **When** llama al endpoint, **Then** recibe 403.
3. **Given** un contacto con múltiples identificadores activos, **When** se arma el timeline, **Then** se incluyen eventos de todos ellos sin duplicados.
4. **Given** un evento con fecha mayor a 30 días, **When** se arma el timeline, **Then** se excluye.

## Edge Cases

- ¿Qué pasa si un reporte visible no tiene clasificación? → Se muestra con severity `VERDE` y categoría `null`; el título describe que es un reporte recibido.
- ¿Qué pasa si un reporte tiene expediente abierto? → El evento incluye `expedienteId` y el botón "abrir expediente" apunta a `/dashboard/padre/expedientes/[id]`.
- ¿Qué pasa si un evento de expediente no tiene `categoriaDetectada`? → Se muestra con severity derivado del `scoreGravedadActual` del expediente y categoría `null`.
- ¿Qué pasa si hay dos eventos exactamente a la misma fecha? → Se ordenan por severity descendente (`ROJO > AMARILLO > VERDE`) y luego por tipo (`EXPEDIENTE` antes que `REPORTE`) para que lo más crítico destaque.
- ¿Qué pasa si un identificador pertenece a dos contactos? → El evento se asocia al primer contacto activo encontrado; no se duplica.
- ¿Qué pasa si el padre desactiva un contacto? → Los identificadores inactivos no generan eventos; el timeline refleja solo contactos activos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer `GET /api/padre/circulo-confianza/timeline` que retorne `{ items: [...] }` con los eventos de los últimos 30 días.
- **FR-002**: El endpoint DEBE requerir sesión con rol `PARENT` y devolver 403 en cualquier otro caso.
- **FR-003**: El sistema DEBE considerar únicamente los identificadores activos (`activo: true`) de los contactos activos del usuario autenticado.
- **FR-004**: El timeline DEBE incluir dos tipos de eventos:
  - `REPORTE`: reportes visibles según `whereReportesCirculo` cuyo `identificador` esté en el círculo.
  - `EXPEDIENTE`: eventos de `EventoExpediente` cuyo expediente tenga `identificadorReportado` en el círculo.
- **FR-005**: Cada evento DEBE tener: `id`, `tipo`, `fecha` (ISO 8601), `severity` (`VERDE` | `AMARILLO` | `ROJO`), `categoria`, `titulo`, `descripcion`, `expedienteId` (opcional), `contactoEtiqueta` (opcional), `identificador`.
- **FR-006**: La severity de un evento `REPORTE` DEBE derivarse de la categoría detectada usando los grupos de categoría existentes: alto riesgo → `ROJO`, medio → `AMARILLO`, bajo/ninguno → `VERDE`.
- **FR-007**: La severity de un evento `EXPEDIENTE` DEBE ser el `scoreGravedadActual` del expediente (`VERDE`, `AMARILLO`, `ROJO`).
- **FR-008**: El sistema DEBE ordenar los eventos por fecha descendente; en empate, por severity descendente (`ROJO > AMARILLO > VERDE`).
- **FR-009**: El componente `TimelineEventosCirculo` DEBE recibir los datos y renderizar una lista cronológica con fecha, categoría, severity y botón "abrir expediente" cuando `expedienteId` esté presente.
- **FR-010**: El botón "abrir expediente" DEBE navegar a `/dashboard/padre/expedientes/[expedienteId]`.
- **FR-011**: El cálculo DEBE ser determinista y basado únicamente en queries a la BD; PROHIBIDO usar LLM.

### Key Entities

- **ContactoConfianza**: contacto del círculo del padre. Atributos relevantes: `id`, `usuarioId`, `etiqueta`, `activo`.
- **IdentificadorContacto**: identificador asociado a un contacto. Atributos relevantes: `contactoId`, `valor`, `activo`.
- **Reporte**: reportes visibles filtrados por `whereReportesCirculo`. Atributos relevantes: `id`, `identificador`, `creadoEn`, `estado`, `clasificacion`.
- **Expediente**: expedientes del padre asociados a un identificador. Atributos relevantes: `padreUsuarioId`, `identificadorReportado`, `scoreGravedadActual`.
- **EventoExpediente**: eventos internos de un expediente. Atributos relevantes: `id`, `expedienteId`, `fechaEvento`, `texto`, `categoriaDetectada`, `reporteId`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El endpoint responde en < 300 ms p95 para un círculo de hasta 20 contactos y 200 eventos en la ventana de 30 días.
- **SC-002**: 100% de los eventos de los últimos 30 días asociados a identificadores activos del círculo aparecen en el timeline.
- **SC-003**: El orden y la severity coinciden con la regla de negocio en todos los casos de prueba unitarios.
- **SC-004**: No se usa LLM ni servicios externos para el ensamblado.
- **SC-005**: El componente renderiza correctamente en todos los estados: con eventos, vacío, y con severity de cada nivel.

## Assumptions

- El ensamblado se ejecuta en tiempo real en el servidor (Server Component / API Route); no hay cacheo inicial.
- El tope de contactos (`circulo.max_contactos`) rige la cardinalidad máxima esperada.
- Los grupos de categoría de riesgo se obtienen de la utilidad existente (`obtenerGruposCategoria`).
- El padre ya tiene contactos creados a través del flujo de círculo de confianza existente (SPEC-135).
- Los expedientes del padre ya existen y se identifican por `padreUsuarioId` + `identificadorReportado` (SPEC-230 / SPEC-232).

## Implementation *(added at close)*

### Decisiones técnicas

- **Capa DAL**: se reutilizó `src/lib/dal/repositories/timeline-circulo-repository.ts` para centralizar las tres queries necesarias (contactos + identificadores, reportes visibles recientes, eventos de expediente recientes) y se agregó `buscarExpedientesPorIdentificadores` para ligar reportes con sus expedientes sin N+1.
- **Lógica pura**: `src/lib/padre/timeline-circulo.ts` ensambla los eventos de forma determinista, sin LLM. La severity de reportes se deriva del grupo de categoría (`contacto_sexual`/`amenazas_extorsion` → ROJO, `manipulacion_engano` → AMARILLO, resto → VERDE); la de eventos de expediente se toma directamente del `scoreGravedadActual`.
- **API**: `GET /api/padre/circulo-confianza/timeline` responde `{ items: [...] }` con rol PARENT exclusivamente.
- **UI**: `TimelineEventosCirculo` + `TimelineEventoItem` reutilizan `GlassCard` y los tokens de color del proyecto (`pino`, `ambar`, `rubi`). El botón "Abrir expediente" navega a `/dashboard/padre/expedientes/[expedienteId]` solo cuando el evento tiene `expedienteId`.

### Archivos creados/modificados

- `src/lib/dal/repositories/timeline-circulo-repository.ts` (modificado)
- `src/lib/padre/timeline-circulo.ts`
- `src/lib/padre/timeline-circulo.test.ts`
- `src/app/api/padre/circulo-confianza/timeline/route.ts`
- `src/app/api/padre/circulo-confianza/timeline/route.test.ts`
- `src/components/modules/padre/TimelineEventoItem.tsx`
- `src/components/modules/padre/TimelineEventoItem.test.tsx`
- `src/components/modules/padre/TimelineEventosCirculo.tsx`
- `src/components/modules/padre/TimelineEventosCirculo.test.tsx`
- `specs/306-timeline-eventos-circulo/{spec,plan,tasks}.md`

### Deuda técnica / notas

- La integración en `src/app/dashboard/padre/page.tsx` se deja para SPEC-304 (home dashboard proactivo) para no bloquear el componente reusable.
- El mapeo de severity por categoría es estático en `timeline-circulo.ts`; si el comité cambia la gravedad de los grupos, debería parametrizarse vía `ParametroSistema`.
