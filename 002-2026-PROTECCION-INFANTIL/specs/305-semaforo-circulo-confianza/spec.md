# Feature Specification: Semáforo por hijo/familiar del círculo de confianza

**Feature Branch**: `work/pi-SPEC-305-semaforo-circulo-confianza`

**Created**: 2026-08-29

**Status**: PLANEADO

**Input**: User description: "Semáforo por hijo/familiar del círculo de confianza (verde/ámbar/rojo)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver semáforo de riesgo por contacto (Priority: P1)

Como padre con contactos en mi círculo de confianza, quiero ver un indicador tipo semáforo (verde/ámbar/rojo) al lado de cada familiar, para saber de un vistazo a quién debo prestar atención primero.

**Why this priority**: Es la pieza visual central del Home Padre Proactivo; reduce la carga cognitiva y permite priorizar alertas sin leer listados largos.

**Independent Test**: Puede probarse cargando `/dashboard/padre` con un usuario PARENT que tenga contactos; el semáforo debe reflejar el estado derivado de los reportes visibles de cada contacto.

**Acceptance Scenarios**:

1. **Given** un padre con contactos en el círculo, **When** accede al home, **Then** ve una lista de contactos con un semáforo de color según su nivel de riesgo.
2. **Given** un contacto sin reportes visibles, **When** se renderiza el semáforo, **Then** muestra verde.
3. **Given** un contacto con reportes en revisión humana, **When** se renderiza el semáforo, **Then** muestra ámbar.
4. **Given** un contacto con reportes clasificados que incluyan conductas de alto impacto o múltiples reportes recientes, **When** se renderiza el semáforo, **Then** muestra rojo.
5. **Given** un contacto inhabilitado, **When** se renderiza el semáforo, **Then** aparece atenuado o sin color activo.

### User Story 2 - Exponer semáforo vía API reusable (Priority: P2)

Como frontend del área del padre, quiero consumir el cálculo del semáforo desde un endpoint propio, para poder reutilizarlo en el home y en futuras vistas.

**Why this priority**: Desacopla la lógica de la UI y facilita tests unitarios del cálculo sin renderizado.

**Independent Test**: `GET /api/padre/circulo-confianza/semaforo` debe devolver el array de contactos con su color de semáforo y metadatos.

**Acceptance Scenarios**:

1. **Given** una sesión de rol PARENT, **When** llama al endpoint, **Then** recibe solo los contactos propios con su semáforo.
2. **Given** una sesión sin rol PARENT, **When** llama al endpoint, **Then** recibe 403.
3. **Given** un contacto sin identificadores activos, **When** se calcula el semáforo, **Then** se marca como verde con total de reportes 0.

## Edge Cases

- ¿Qué pasa si un contacto tiene identificadores activos pero ninguno coincide con reportes? → Semáforo verde, total 0.
- ¿Qué pasa si un reporte está en estado `POSIBLE_SPAM` o `DUPLICADO`? → No cuenta para el semáforo (mismo predicado que `whereReportesCirculo`).
- ¿Qué pasa si hay múltiples identificadores por contacto y solo uno tiene reportes graves? → El peor color gana (rojo > ámbar > verde).
- ¿Qué pasa si el padre no tiene contactos? → Endpoint devuelve lista vacía; el componente muestra estado vacío amigable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE calcular un semáforo por cada `ContactoConfianza` activo del usuario PARENT.
- **FR-002**: El color DEBE ser `VERDE` cuando el contacto no tiene reportes visibles.
- **FR-003**: El color DEBE ser `AMBAR` cuando el contacto tiene al menos un reporte visible en estados de revisión humana (`REVISION_MANUAL`, `REQUIERE_ANONIMIZACION`).
- **FR-004**: El color DEBE ser `ROJO` cuando el contacto tiene reportes clasificados (`CLASIFICADO`, `CORREGIDO`) Y cumple al menos una de: (a) categoría en grupo de riesgo alto, (b) 3 o más reportes visibles en los últimos 30 días, (c) score de gravedad actual de algún expediente asociado en `ROJO`.
- **FR-005**: El sistema DEBE exponer `GET /api/padre/circulo-confianza/semaforo` que retorne `{ items: [...] }` con los datos del semáforo.
- **FR-006**: El componente `SemaforoCirculo` DEBE recibir los datos y renderizar tarjetas con nombre del contacto, color, conteo de reportes y categoría dominante (si aplica).
- **FR-007**: El cálculo DEBE ser determinista y basado únicamente en queries a la BD; PROHIBIDO usar LLM.

### Key Entities

- **ContactoConfianza**: contacto del círculo del padre. Atributos relevantes: `id`, `usuarioId`, `etiqueta`, `activo`.
- **IdentificadorContacto**: identificador asociado a un contacto. Atributos relevantes: `contactoId`, `valor`, `activo`.
- **Reporte**: reportes visibles filtrados por `whereReportesCirculo`. Atributos relevantes: `identificador`, `estado`, `creadoEn`, `clasificacion`.
- **Expediente**: expedientes del padre asociados a un identificador. Atributos relevantes: `padreUsuarioId`, `identificadorReportado`, `scoreGravedadActual`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El endpoint responde en < 300 ms p95 para un círculo de hasta 20 contactos (tope configurado).
- **SC-002**: 100% de los contactos activos del padre aparecen con semáforo en el home.
- **SC-003**: El color derivado coincide con la regla de negocio en todos los casos de prueba unitarios.
- **SC-004**: No se usa LLM ni servicios externos para el cálculo.

## Assumptions

- El cálculo se ejecuta en tiempo real en el servidor (Server Component / API Route); no hay cacheo inicial.
- El tope de contactos (`circulo.max_contactos`) rige la cardinalidad máxima esperada.
- Las categorías de riesgo alto se obtienen del grupo de categorías existente (`obtenerGruposCategoria`) o de un parámetro de sistema (`padre.semaforo.categorias_alto`).
- El padre ya tiene contactos creados a través del flujo de círculo de confianza existente (SPEC-135).
