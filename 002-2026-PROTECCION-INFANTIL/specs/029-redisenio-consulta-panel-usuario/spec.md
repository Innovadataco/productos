# Feature Specification 029 · Rediseño de la consulta pública + panel del usuario autenticado

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-18

**Status**: EN DISEÑO

**Input**: Rediseñar la consulta pública y el panel de usuario autenticado para comunicar el riesgo de un vistazo, con tres niveles de visibilidad claros. Ningún nivel público muestra el texto/contenido del reporte ni la identidad del denunciante.

---

## User Scenarios & Testing

### User Story 1 - Consulta pública anónima (Priority: P1)

Un padre o cuidador, sin crear cuenta, quiere saber de un vistazo si un número, nick o usuario tiene reportes de riesgo para menores. La consulta debe comunicar el nivel de riesgo, la confianza promedio de la IA, la cantidad de reportes visibles y la fecha del último reporte. Debe invitarlo a crear una cuenta si desea ver más detalle.

**Acceptance Scenarios**:
1. **Given** un identificador con reportes clasificados, **When** un usuario anónimo lo consulta, **Then** ve un badge de nivel de riesgo (bajo/medio/alto), el % promedio de confianza de la IA, la cantidad de reportes y la fecha del último reporte.
2. **Given** un identificador con reportes en varias plataformas, **When** se muestra el resumen, **Then** aparece el texto correcto tipo "N reportes en PlataformaA, PlataformaB y PlataformaC" sin mostrar `undefined`.
3. **Given** un identificador sin reportes, **When** se consulta, **Then** se muestra un mensaje claro de "Sin reportes registrados" sin badges de riesgo.
4. **Given** un usuario anónimo en la consulta pública, **When** ve el resultado, **Then** no ve el texto de ningún reporte ni datos del denunciante, y sí ve un bloque que lo invita a crear una cuenta para más detalle.

### User Story 2 - Panel del usuario autenticado (Priority: P1)

Un usuario autenticado (rol PARENT) accede a su panel personal para ver (A) los reportes que él creó, con su estado y código de seguimiento; y (B) una consulta enriquecida de cualquier identificador, donde ve detalle agregado por reporte (plataforma, fecha, categoría, nivel de riesgo) y un mapa con ubicación aproximada a nivel ciudad.

**Acceptance Scenarios**:
1. **Given** un usuario autenticado con reportes previos, **When** entra a `/dashboard`, **Then** ve una sección "Mis reportes" con identificador, estado, código de seguimiento y fecha.
2. **Given** un usuario autenticado, **When** busca un identificador en la consulta enriquecida, **Then** ve una lista de reportes clasificados con plataforma, fecha, categoría y nivel de riesgo; no ve el texto del reporte ni quién lo reportó.
3. **Given** reportes en distintas ciudades, **When** se muestra el mapa, **Then** aparecen puntos agrupados por ciudad (sin coordenadas exactas de domicilio) y una lista de ubicaciones.
4. **Given** un identificador sin reportes, **When** el usuario autenticado lo busca, **Then** se muestra el mensaje "Sin reportes registrados".

### Edge Cases

- ¿Qué pasa si hay reportes clasificados pero ninguno tiene clasificación IA? El nivel de riesgo debe ser conservador (bajo/medio por cantidad, sin confianza).
- ¿Qué ocurre si la categoría principal es `SPAM`? El nivel de riesgo debe penalizar menos la gravedad, pero sí contar cantidad.
- ¿Cómo se comporta con 1 solo reporte? Nivel conservador: máximo MEDIO si la confianza es alta; nunca ALTO con un solo dato.
- ¿Qué pasa si el usuario autenticado consulta un identificador que él mismo reportó y está en proceso? No aparece en la consulta enriquecida hasta que esté clasificado; sí aparece en "Mis reportes" con su estado real.

---

## Requirements

### Functional Requirements

- **FR-001**: La consulta pública debe mostrar un badge de nivel de riesgo (BAJO/MEDIO/ALTO) calculado únicamente sobre reportes `CLASIFICADO` o `CORREGIDO`.
- **FR-002**: La consulta pública debe mostrar el % promedio de confianza de la IA sobre los reportes clasificados.
- **FR-003**: La consulta pública debe mostrar la cantidad de reportes visibles y la fecha del último reporte.
- **FR-004**: La consulta pública debe mostrar el resumen de plataformas usando `formatPlataforma` para evitar `undefined`.
- **FR-005**: La consulta pública debe incluir un bloque de conversión: "Crea una cuenta para ver el detalle completo".
- **FR-006**: El panel `/dashboard` del usuario autenticado debe mostrar la sección "Mis reportes" con los reportes creados por él.
- **FR-007**: El panel `/dashboard` debe incluir una consulta enriquecida que permita buscar cualquier identificador.
- **FR-008**: La consulta enriquecida debe devolver una lista de reportes con plataforma, fecha, categoría, confianza y nivel de riesgo individual; nunca el texto del reporte ni datos del denunciante.
- **FR-009**: La consulta enriquecida debe incluir un mapa con ubicaciones agrupadas por ciudad (coordenadas aproximadas de ciudad, no exactas).
- **FR-010**: Los umbrales de riesgo (`risk.umbral_medio`, `risk.umbral_alto`, `risk.min_reportes_alto`) deben ser configurables desde `ParametroSistema`.
- **FR-011**: El cálculo de riesgo debe ser conservador: con 1 solo reporte no puede dar ALTO; con varios reportes coincidentes y alta confianza puede subir a ALTO.
- **FR-012**: El cálculo de riesgo debe combinar confianza promedio, cantidad de reportes y gravedad de la categoría principal.

### Non-Functional Requirements

- **NFR-001**: No exponer PII: texto del reporte, identidad del denunciante y coordenadas exactas quedan fuera de toda vista pública/autenticada.
- **NFR-002**: Reutilizar componentes y helpers existentes (`formatPlataforma`, `MapaUbicaciones`, `Badge`, `MetricCard`, `ChartCard`).
- **NFR-003**: Tiempo de respuesta de la consulta enriquecida < 1s para identificadores con < 100 reportes.

---

## Success Criteria

- **SC-001**: Un usuario anónimo consulta un identificador con reportes y en < 1s ve nivel de riesgo, confianza, cantidad, fecha y resumen de plataformas.
- **SC-002**: El badge de riesgo usa los colores correctos (verde/ámbar/rojo) según los umbrales configurados.
- **SC-003**: La consulta pública nunca muestra "undefined" en el nombre de plataforma.
- **SC-004**: Un usuario autenticado ve sus reportes en `/dashboard` y puede buscar cualquier identificador con detalle agregado.
- **SC-005**: El mapa en la consulta enriquecida muestra ubicaciones aproximadas a nivel ciudad, nunca coordenadas exactas de un reporte individual.
- **SC-006**: 100% de tests de consulta y dashboard pasan; lint, tsc, build y smoke verdes.

---

## Assumptions

- El cálculo de riesgo actual en `src/lib/scoring.ts` sigue existiendo para admin/dashboard; el nuevo cálculo es específico para vistas públicas/autenticadas y no lo reemplaza.
- El helper `formatPlataforma` ya existe y se mantiene centralizado.
- El modelo de datos no requiere cambios de schema; solo se agregan parámetros de sistema y nuevos endpoints/componentes.
- El usuario autenticado que consulta es siempre `PARENT`; admin/operador no usan este panel para consultar (tienen sus propios dashboards).
- El círculo de confianza (spec 016) no se modifica ni integra con esta feature; solo se verifica que su enlace siga visible.
