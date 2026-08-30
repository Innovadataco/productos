# Feature Specification: Sugerencia proactiva para el área del padre

**Feature Branch**: `work/pi-SPEC-307-sugerencia-proactiva-padre`

**Created**: 2026-08-29

**Status**: IMPLEMENTADO

**Input**: User description: "Sugerencia proactiva (reglas simples · NO LLM · basado en queries · aparenta IA sin serlo). Crea GET /api/padre/home/sugerencia que analice el estado del círculo, expedientes y notificaciones, y devuelva una sugerencia contextual. Reglas: sin contactos → invitar a agregar; todo verde → mensaje tranquilizador; ámbar → alerta en revisión; rojo → acción recomendada; sin novedades 7 días → recordatorio. Componente SugerenciaProactiva."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver sugerencia contextual en el home del padre (Priority: P1)

Como padre, quiero ver una sugerencia contextual en la parte superior de mi home, para saber qué acción tomar o sentirme tranquilo sin tener que revisar todo el panel.

**Why this priority**: Es el elemento diferenciador del Home Padre Proactivo; reduce la ansiedad, guía la siguiente acción y transmite que el sistema "entiende" la situación del círculo familiar sin usar IA generativa.

**Independent Test**: Puede probarse cargando `/dashboard/padre` con un usuario PARENT; la tarjeta de sugerencia debe reflejar el estado combinado del círculo, expedientes y notificaciones según las reglas establecidas.

**Acceptance Scenarios**:

1. **Given** un padre sin contactos en el círculo de confianza, **When** accede al home, **Then** ve una sugerencia que lo invita a agregar su primer contacto.
2. **Given** un padre con contactos y todo el semáforo en verde, **When** accede al home, **Then** ve un mensaje tranquilizador que refuerza que no hay alertas activas.
3. **Given** un padre con al menos un contacto en ámbar o un expediente/notificación en revisión, **When** accede al home, **Then** ve una alerta que indica que hay elementos en revisión y lo invita a consultarlos.
4. **Given** un padre con al menos un contacto en rojo o un expediente/notificación que requiere acción, **When** accede al home, **Then** ve una recomendación de acción concreta y un enlace a la sección correspondiente.
5. **Given** un padre sin novedades relevantes en los últimos 7 días, **When** accede al home, **Then** ve un recordatorio amigable (por ejemplo, revisar el círculo o actualizar datos).

### User Story 2 - Exponer sugerencia vía API reusable (Priority: P2)

Como frontend del área del padre, quiero consumir la sugerencia proactiva desde un endpoint propio, para poder reutilizarla en el home y en futuras vistas sin duplicar lógica.

**Why this priority**: Desacopla la lógica contextual de la UI, facilita tests unitarios del motor de reglas y permite versionar el mensaje proactivo.

**Independent Test**: `GET /api/padre/home/sugerencia` debe devolver un objeto con el tipo de sugerencia, el mensaje, la acción recomendada y metadatos de decisión.

**Acceptance Scenarios**:

1. **Given** una sesión de rol PARENT, **When** llama al endpoint, **Then** recibe la sugerencia calculada a partir de sus propios datos.
2. **Given** una sesión sin rol PARENT, **When** llama al endpoint, **Then** recibe 403.
3. **Given** un padre que califica para más de una regla (por ejemplo, rojo y sin novedades 7 días), **When** se calcula la sugerencia, **Then** se aplica la prioridad: sin contactos > rojo > ámbar > sin novedades 7 días > todo verde.

## Edge Cases

- ¿Qué pasa si el padre no tiene contactos pero sí tiene notificaciones antiguas? → Gana la regla "sin contactos"; el mensaje principal lo invita a agregar contactos.
- ¿Qué pasa si hay contactos en verde, ámbar y rojo al mismo tiempo? → Gana el peor color (rojo > ámbar > verde) y se menciona la alerta más grave.
- ¿Qué pasa si hay expedientes/notificaciones rojos pero los contactos están verdes? → Gana la regla de rojo basada en expedientes/notificaciones; el mensaje apunta a la sección de expedientes o notificaciones.
- ¿Qué pasa si la última novedad relevante tiene exactamente 7 días? → Se considera "sin novedades 7 días" si no hay reglas de mayor prioridad activas.
- ¿Qué pasa si no hay datos de expedientes ni notificaciones? → Se evalúa únicamente el estado del círculo de confianza.
- ¿Qué pasa si el semáforo del círculo aún no está disponible? → La sugerencia puede inferir el estado del círculo con una query propia mínima (contactos + reportes visibles).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer `GET /api/padre/home/sugerencia` que retorne `{ tipo, mensaje, accion, metadata }` con la sugerencia contextual.
- **FR-002**: El cálculo DEBE ser determinista, basado únicamente en queries a la BD y PROHIBIDO usar LLM o servicios externos.
- **FR-003**: El sistema DEBE evaluar las siguientes reglas en orden de prioridad: sin contactos > rojo > ámbar > sin novedades 7 días > todo verde.
- **FR-004**: El tipo DEBE ser `INVITAR_CONTACTOS` cuando el usuario PARENT no tenga contactos activos en su círculo de confianza.
- **FR-005**: El tipo DEBE ser `ROJO` cuando exista al menos un contacto en rojo, expediente con score de gravedad rojo o notificación crítica no atendida.
- **FR-006**: El tipo DEBE ser `AMBAR` cuando exista al menos un contacto en ámbar, expediente en revisión o notificación en estado de revisión, y no se cumpla la regla de rojo.
- **FR-007**: El tipo DEBE ser `SIN_NOVEDADES` cuando no se cumplan las reglas anteriores y la última novedad relevante (contacto agregado, reporte visible, expediente o notificación) tenga más de 7 días.
- **FR-008**: El tipo DEBE ser `TODO_VERDE` cuando el círculo tenga contactos activos, todos estén verdes, no haya expedientes/notificaciones relevantes y haya novedades recientes.
- **FR-009**: El componente `SugerenciaProactiva` DEBE recibir los datos del endpoint y renderizar una tarjeta con icono, mensaje y acción recomendada.
- **FR-010**: El mensaje y la acción DEBEN adaptarse al tipo de sugerencia sin mostrar texto original de reportes ni veredictos de culpabilidad.

### Impacto en arquitectura:

- **Nueva API Route**: `GET /api/padre/home/sugerencia` en la capa de API del rol PARENT.
- **Nueva lógica de dominio**: `src/lib/padre/sugerencia-proactiva.ts` orquesta reglas deterministas reutilizando `listarSemaforosPorPadre` (SPEC-305) y un repositorio DAL de expedientes; sin LLM ni servicios externos.
- **Nuevo componente UI**: `SugerenciaProactiva` bajo `src/components/modules/padre/`, consumido desde el home padre (SPEC-309).
- **Datos**: solo lectura sobre `ContactoConfianza`, `IdentificadorContacto`, `Reporte` y `Expediente`; sin migraciones destructivas.

### Key Entities

- **Usuario** (`PARENT`): usuario final del área del padre. Atributos relevantes: `id`, `rol`.
- **ContactoConfianza**: contactos del círculo del padre. Atributos relevantes: `id`, `usuarioId`, `activo`, `creadoEn`.
- **IdentificadorContacto**: identificadores asociados a un contacto. Atributos relevantes: `contactoId`, `valor`, `activo`.
- **Reporte**: reportes visibles filtrados por `whereReportesCirculo`. Atributos relevantes: `identificador`, `estado`, `creadoEn`, `clasificacion`.
- **Expediente**: expedientes del padre asociados a un identificador. Atributos relevantes: `padreUsuarioId`, `identificadorReportado`, `scoreGravedadActual`, `estado`, `creadoEn`, `actualizadoEn`.
- **NotificacionPadre**: notificaciones del área del padre. Atributos relevantes: `usuarioId`, `tipo`, `estado`, `creadoEn`, `leidaEn`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El endpoint responde en < 200 ms p95 para un padre con hasta 20 contactos.
- **SC-002**: 100% de los casos de prueba unitarios coinciden con la regla de prioridad esperada.
- **SC-003**: El componente `SugerenciaProactiva` renderiza correctamente los 5 tipos de sugerencia en tests unitarios.
- **SC-004**: No se usa LLM ni servicios externos para el cálculo.
- **SC-005**: El endpoint protege correctamente el acceso: solo rol PARENT accede a su propia sugerencia.

## Assumptions

- El cálculo se ejecuta en tiempo real en el servidor (API Route); no hay cacheo inicial.
- El estado del círculo (verde/ámbar/rojo) puede obtenerse reutilizando la lógica de `src/lib/padre/semaforo.ts` (SPEC-305) o con una query propia mínima si aún no está disponible.
- Las notificaciones relevantes son aquellas no leídas o no atendidas; las notificaciones críticas se identifican por `tipo` o por un parámetro de sistema (`padre.sugerencia.tipos_criticos`).
- La "última novedad relevante" incluye: creación de contacto, reporte visible, creación/actualización de expediente y creación de notificación no leída.
- El tope de contactos (`circulo.max_contactos`) rige la cardinalidad máxima esperada.
- El padre ya tiene acceso al home del área del padre (SPEC-303 o equivalente).

## Implementation *(added at close)*

### Decisiones técnicas

- **Capa DAL**: se creó `src/lib/dal/repositories/sugerencia-proactiva-repository.ts` para contar contactos activos y listar expedientes del padre.
- **Lógica pura**: `src/lib/padre/sugerencia-proactiva.ts` aplica reglas de prioridad deterministas: sin contactos > rojo > ámbar > sin novedades 7 días > todo verde. Reutiliza `listarSemaforosPorPadre` de SPEC-305 para los colores del círculo.
- **API**: `GET /api/padre/home/sugerencia` responde `{ tipo, titulo, mensaje, accion, metadata }` con rol PARENT exclusivamente.
- **UI**: `SugerenciaProactiva` renderiza tarjeta con icono, mensaje y acción recomendada usando tokens de color del proyecto.

### Archivos creados/modificados

- `src/lib/dal/repositories/sugerencia-proactiva-repository.ts`
- `src/lib/padre/sugerencia-proactiva.ts`
- `src/lib/padre/sugerencia-proactiva.test.ts`
- `src/app/api/padre/home/sugerencia/route.ts`
- `src/app/api/padre/home/sugerencia/route.test.ts`
- `src/components/modules/padre/SugerenciaProactiva.tsx`
- `src/components/modules/padre/SugerenciaProactiva.test.tsx`
- `docs/architecture/02-roles-capacidades.md` (regenerado)
- `specs/307-sugerencia-proactiva-padre/{spec,plan,tasks}.md`

### Deuda técnica / notas

- La integración en el home padre se deja para SPEC-309.
- No se consumen notificaciones in-app porque el modelo actual (`NotificacionInApp`) está orientado a `SCHOOL_ADMIN` y requiere `colegioId`. Si en el futuro hay notificaciones del área padre, se puede extender el repositorio sin cambiar la API pública.
