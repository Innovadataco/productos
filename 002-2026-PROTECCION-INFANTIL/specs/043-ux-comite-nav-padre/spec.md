# Feature Specification: UX del comité y navegación del padre

**Feature Branch**: `[043-ux-comite-nav-padre]`

**Created**: 2026-07-20

**Status**: IMPLEMENTADO

**Input**: Cuatro problemas de UX verificados: (1) el padre autenticado no tiene acceso al panel `/dashboard` desde la navegación; (2) la bandeja del comité tiene pestañas Pendientes/Mías y un paso explícito de "Asignarme"; (3) el resolver del comité ofrece dos acciones confusas (Clasificar/Corregir); (4) el copy del Círculo de Confianza usa jerga técnica.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Acceso del padre a la consulta enriquecida (Priority: P1)

El padre autenticado debe tener una entrada clara a `/dashboard` desde la navegación, sin duplicar vistas. La página `/dashboard` ya existe y contiene "Mis reportes" + "Consulta enriquecida".

**Why this priority**: Sin acceso visible, la consulta enriquecida y el panel personal están ocultos para el usuario que más los necesita.

**Independent Test**: Iniciar sesión como `PARENT` y verificar que el header o el menú desplegable ofrece un enlace que lleva a `/dashboard`.

**Acceptance Scenarios**:

1. **Given** un usuario `PARENT` autenticado, **When** mira el header, **Then** el botón "Dashboard" o el menú desplegable lo lleva a `/dashboard` (no a `/dashboard-publico`).
2. **Given** un usuario anónimo, **When** hace clic en "Dashboard", **Then** sigue yendo a `/dashboard-publico`.
3. **Given** un usuario `PARENT` en móvil, **When** abre el menú hamburguesa, **Then** ve el enlace a su panel (`/dashboard`).
4. **Given** la implementación, **When** se accede a `/dashboard`, **Then** no se duplica la vista de `/dashboard-publico` ni se rompe la navegación de anónimos.

### User Story 2 — Bandeja del comité en un solo submódulo (Priority: P1)

Eliminar las pestañas Pendientes/Mías y el paso "Asignarme". La bandeja del comité debe mostrar una sola lista de casos escalados; al abrir un caso pendiente, se auto-asigna al comité logueado, siguiendo el patrón de la bandeja de operadores.

**Why this priority**: Reduce fricción, evita confusiones entre pendientes/asignados y previene colisiones de asignación.

**Independent Test**: Test del componente `ComiteBandeja` que verifique que no hay pestañas y que al abrir un caso pendiente se dispara la asignación automática.

**Acceptance Scenarios**:

1. **Given** un comité logueado, **When** entra a su bandeja, **Then** ve una sola lista con todos los casos escalados (sin pestañas).
2. **Given** un caso en estado `PENDIENTE`, **When** el comité hace clic en "Ver detalle", **Then** el caso se auto-asigna a ese comité y pasa a `ASIGNADA` antes de mostrar el resolver.
3. **Given** un caso ya `ASIGNADO` a otro comité, **When** un comité distinto intenta abrirlo, **Then** no puede asignárselo y se muestra un estado de solo lectura o bloqueado.
4. **Given** un caso `RESUELTO`, **When** el comité lo abre, **Then** se ve en modo solo lectura.

### User Story 3 — Resolver simplificado con un solo botón (Priority: P1)

Reemplazar "Clasificar/Corregir" por un único flujo "Resolver". El comité elige la categoría final, escribe un motivo opcional y resuelve. El reporte siempre queda en `CORREGIDO` (acción humana), registrando `responsableTipo = COMITE`.

**Why this priority**: La distinción Clasificar/Corregir es confusa. Toda resolución del comité es una decisión humana sobre la clasificación final; `CORREGIDO` refleja eso correctamente.

**Independent Test**: Tests del endpoint `POST /api/admin/comite/[id]/resolver` que verifiquen que siempre devuelve `CORREGIDO` y que los tests antiguos se actualizan.

**Acceptance Scenarios**:

1. **Given** un caso asignado a un comité, **When** el comité selecciona categoría y resuelve, **Then** el reporte pasa a `CORREGIDO` y la clasificación se actualiza con la categoría elegida.
2. **Given** un caso resuelto, **When** se consulta la transición, **Then** tiene `responsableTipo = COMITE` y `estadoNuevo = CORREGIDO`.
3. **Given** el endpoint de resolver, **When** se envía `accion` (heredada), **Then** se ignora o se rechaza; el resultado es siempre `CORREGIDO`.
4. **Given** los tests existentes, **When** se ejecutan, **Then** se actualizan para esperar `CORREGIDO` en lugar de `CLASIFICADO`.

### User Story 4 — Copy del Círculo de Confianza (Priority: P2)

Cambiar el texto de la línea 364 de `src/app/dashboard/circulo-confianza/page.tsx` para que sea claro y no use jerga técnica.

**Why this priority**: El usuario final no entiende "emails ciegos"; un copy claro reduce confusión y errores de configuración.

**Independent Test**: Verificación visual o test de componente que el texto nuevo aparezca.

**Acceptance Scenarios**:

1. **Given** un usuario en `/dashboard/circulo-confianza`, **When** ve la opción de notificaciones, **Then** el texto dice: "Recibir un aviso por email cuando alguno de los contactos de mi Círculo de Confianza aparezca en un reporte."
2. **Given** la página en modo oscuro, **When** se renderiza el checkbox, **Then** el texto mantiene buen contraste y legibilidad.

---

## Edge Cases

- **US1**: Usuario `PARENT` que también es `OPERADOR` o `COMITE_VALIDACION` no existe por exclusividad de roles; no aplica.
- **US2**: Caso `PENDIENTE` que otro comité asignó justo antes de que el primero lo abra → backend debe retornar 409/403; UI debe manejarlo sin crash.
- **US2**: Lista vacía → mostrar estado vacío con mensaje claro.
- **US3**: Categoría no seleccionada → mostrar error de validación antes de llamar al endpoint.
- **US3**: Resolución del comité con categoría igual a la IA → igual se registra como `CORREGIDO` (decisión humana).
- **US4**: El texto nuevo debe ser igual en mobile y desktop.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El `NavHeader` DEBE mostrar un enlace a `/dashboard` para usuarios autenticados con rol `PARENT` (en header y menú móvil).
- **FR-002**: El botón "Dashboard" del header para usuarios anónimos DEBE seguir apuntando a `/dashboard-publico`.
- **FR-003**: No se DEBE duplicar la vista de `/dashboard-publico`; `/dashboard` es la vista del usuario autenticado.
- **FR-004**: `ComiteBandeja` DEBE mostrar una sola lista de solicitudes; las pestañas Pendientes/Mías DEBEN eliminarse.
- **FR-005**: Al abrir un caso `PENDIENTE`, el sistema DEBE auto-asignarlo al comité logueado (llamada a `/api/admin/comite/${id}/asignar` antes de mostrar el detalle) y refrescar la lista.
- **FR-006**: Los casos `ASIGNADOS` a otro comité DEBEN mostrarse bloqueados o en solo lectura para un comité diferente.
- **FR-007**: `ComiteSolicitudDetalle` DEBE eliminar los radio buttons "Clasificar/Corregir" y mostrar un solo flujo "Resolver".
- **FR-008**: El endpoint `POST /api/admin/comite/[id]/resolver` DEBE dejar el reporte siempre en `CORREGIDO`, actualizar `ClasificacionIA.categoria` con la categoría elegida y registrar `responsableTipo = COMITE`.
- **FR-009**: El endpoint `resolver` DEBE eliminar el campo `accion` del schema o ignorarlo; el resultado ya no depende de `accion`.
- **FR-010**: El endpoint `resolver` DEBE actualizar la clasificación incluso si la categoría elegida es igual a la actual (confianza = 1.0, indicando decisión humana).
- **FR-011**: Los tests de `resolver` DEBEN actualizarse para esperar `CORREGIDO` en lugar de `CLASIFICADO`.
- **FR-012**: El copy de `circulo-confianza/page.tsx` línea 364 DEBE reemplazarse por: "Recibir un aviso por email cuando alguno de los contactos de mi Círculo de Confianza aparezca en un reporte."
- **FR-013**: No se requieren cambios en el modelo de datos de Prisma.

### Key Entities

- **NavHeader**: componente de navegación global.
- **DashboardUsuarioClient**: panel del usuario autenticado.
- **ComiteBandeja**: lista de casos escalados al comité.
- **ComiteSolicitudDetalle**: modal de resolución de un caso.
- **Endpoint resolver**: `POST /api/admin/comite/[id]/resolver`.
- **Círculo de Confianza**: página de preferencias de notificación.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario `PARENT` autenticado puede navegar a `/dashboard` desde el header o menú desplegable.
- **SC-002**: `ComiteBandeja` no tiene pestañas y muestra una sola lista.
- **SC-003**: Al abrir un caso `PENDIENTE`, el sistema lo auto-asigna al comité logueado.
- **SC-004**: El resolver del comité tiene un solo botón "Resolver" y el reporte siempre queda en `CORREGIDO`.
- **SC-005**: Los tests de `resolver` pasan con el nuevo comportamiento.
- **SC-006**: El copy del Círculo de Confianza usa el texto propuesto.
- **SC-007**: `npx tsc --noEmit`, `npm run lint` y `npm run test` pasan sin errores nuevos.

---

## Assumptions

- El endpoint `/api/admin/comite/${id}/asignar` ya existe y funciona.
- El endpoint `/api/admin/comite/[id]/resolver` ya existe; solo se simplifica su lógica.
- No se rediseña la estructura visual de `ComiteSolicitudDetalle`; solo se eliminan los radio buttons y se ajusta el copy.
- No se requiere cambiar la autenticación ni los permisos de roles.
- Las recomendaciones de UI/UX Pro Max (glassmorphism, colores rojo/alerta + azul/seguridad, Fira Sans, focus/hover/reduced-motion) se respetan al implementar.

---

## Implementación

### Objetivo alcanzado

Se implementaron las 4 User Stories del spec 043: navegación del padre autenticado a `/dashboard`, bandeja unificada del comité con auto-asignación, resolver simplificado siempre en `CORREGIDO` y copy claro del Círculo de Confianza.

### Decisiones de diseño

- **Navegación del padre**: se optó por mantener un único botón "Dashboard" en el header cuyo `href` depende del rol (`PARENT` → `/dashboard`; cualquier otro/anónimo → `/dashboard-publico`), más un ítem "Mi panel" en el menú desplegable y móvil. Esto evita duplicar vistas y no afecta a usuarios anónimos.
- **Bandeja unificada**: se eliminaron las pestañas y se creó un nuevo endpoint `GET /api/admin/comite/solicitudes` que devuelve todas las solicitudes visibles para el rol (admin/tenant o comité). Al abrir un caso `PENDIENTE`, el frontend lo auto-asigna vía `POST /api/admin/comite/[id]/asignar` antes de mostrar el detalle, siguiendo el patrón de la bandeja de operadores.
- **Resolver simplificado**: se eliminó el enum `accion` del schema y de la UI. El endpoint siempre crea una `correccionAdmin`, actualiza `ClasificacionIA.categoria` y `confianza = 1.0`, y registra la transición con `estadoNuevo = CORREGIDO` y `responsableTipo = COMITE`.
- **Copy**: se reemplazó "emails ciegos" por una frase explícita y cercana al usuario final.

### Archivos y endpoints afectados

- `src/components/modules/NavHeader.tsx` (US1)
- `src/components/modules/NavHeader.test.tsx` (US1)
- `src/app/api/admin/comite/solicitudes/route.ts` (US2)
- `src/components/modules/ComiteBandeja.tsx` (US2)
- `src/components/modules/ComiteBandeja.test.tsx` (US2)
- `src/app/api/admin/comite/[id]/resolver/route.ts` (US3)
- `src/app/api/admin/comite/[id]/resolver/route.test.ts` (US3)
- `src/app/api/admin/comite/pendientes/route.test.ts` (US3 - ajustado a `CORREGIDO`)
- `src/components/modules/ComiteSolicitudDetalle.tsx` (US3)
- `src/components/modules/ComiteSolicitudDetalle.test.tsx` (US3)
- `src/app/dashboard/circulo-confianza/page.tsx` (US4)
- `specs/043-ux-comite-nav-padre/checklists/requirements.md`
- `specs/043-ux-comite-nav-padre/quickstart.md` (checklist)
- `docs/cierre-043.md`

### Tests

- Tests de componente: `NavHeader`, `ComiteBandeja`, `ComiteSolicitudDetalle`.
- Tests de endpoint: `POST /api/admin/comite/[id]/resolver` (nuevo) y ajuste en `pendientes/route.test.ts`.
- Full suite: 439 tests pasan, 0 fallos.

### Migraciones

Ninguna. No se modificó el modelo de datos de Prisma.

### Deuda técnica

- Los warnings de `act(...)` en los tests de `ComiteBandeja` y `ComiteSolicitudDetalle` son ruido de testing-library; no afectan el comportamiento ni el resultado, pero se pueden silenciar envolviendo los eventos en `act()` o usando `@testing-library/user-event` en una futura ronda de pulido de tests.
- No se rediseñó la estructura visual del detalle; solo se simplificó el flujo.
