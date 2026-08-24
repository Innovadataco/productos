# SPEC-232 · Vista padre expedientes (lista + detalle + agregar evento) (002-PI-132)

> Status: `PLANEADO`
> PI: 002-PI-132
> Responsable: ODIN
> Rama: `work/002-PI-132`
> Base: `feature/001-scaffolding`

## Contexto

Segunda etapa de la cadena UI Padre v2 (231 → 232 → 233). Implementa la lista de expedientes del padre en `/dashboard/padre/expedientes`, la vista detalle con cronología de eventos, y el botón "Agregar nueva situación" que crea un `EventoExpediente` (y un `Reporte` asociado por §7.2). Incluye AutoSuggest N3 al regresar de crear un evento. Depende de SPEC-230 (modelos y repository, en prod) y SPEC-231 (sidebar padre, en prod tras merge PR #92).

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como padre, quiero ver todos mis expedientes en una lista clara, para saber el estado de cada situación que reporté. | Must |
| US-002 | Como padre, quiero filtrar mis expedientes por estado (activos, en revisión, cerrados), para encontrar rápido lo que me interesa. | Must |
| US-003 | Como padre, quiero ver el detalle de un expediente con su cronología, para entender la evolución de la situación. | Must |
| US-004 | Como padre, quiero agregar una nueva situación a un expediente activo, para documentar que el problema continúa. | Must |
| US-005 | Como padre, quiero que el sistema me sugiera actualizar mi expediente activo cuando vuelvo, para no olvidar documentar. | Should |
| US-006 | Como sistema, quiero que agregar evento cree también un reporte comunitario, para alimentar la señal agregada. | Must |

## Acceptance Scenarios

### AS-001 · Lista de expedientes
**Given** un padre autenticado con 3 expedientes propios  
**When** entra a `/dashboard/padre/expedientes`  
**Then** ve 3 cards ordenadas por última actualización, cada una con identificador, estado, score de gravedad, fecha de apertura y días desde última actividad.

### AS-002 · Filtros por estado
**Given** un padre en la lista de expedientes  
**When** selecciona filtro "Activos"  
**Then** solo ve expedientes en estado `ACTIVO`.  
**When** selecciona "En revisión"  
**Then** ve `CONSOLIDANDO`, `PENDIENTE_COMITE`, `EN_APROBACION_PADRE`, `EN_ACLARACION`.  
**When** selecciona "Cerrados"  
**Then** ve `CERRADO` y `ESCALADO`.

### AS-003 · Detalle de expediente
**Given** un padre en la lista  
**When** hace clic en un expediente  
**Then** entra a `/dashboard/padre/expedientes/[id]` y ve cabecera con identificador, estado, score, fecha de apertura, y cronología de eventos ordenada por `ordenSecuencial`.

### AS-004 · Agregar nueva situación
**Given** un padre en el detalle de un expediente `ACTIVO`  
**When** hace clic en "Agregar nueva situación" y envía texto válido  
**Then** se crea un `EventoExpediente` con `ordenSecuencial` siguiente y un `Reporte` asociado, y el expediente actualiza `numEventos` y `ultimoEventoEn`.

### AS-005 · AutoSuggest N3
**Given** un padre con un expediente `ACTIVO` sin eventos nuevos en 3+ días  
**When** entra a `/dashboard/padre` o `/dashboard/padre/expedientes`  
**Then** ve una card destacada: "Tienes 1 expediente activo sobre {identificador} · última actualización hace {X} días · ¿la situación continúa?" con botones "Agregar nueva situación" y "Ya se resolvió".

### AS-006 · Expediente cerrado no editable
**Given** un padre en el detalle de un expediente `CERRADO`  
**When** intenta agregar una nueva situación  
**Then** el botón está deshabilitado o la API devuelve 409 con mensaje claro.

## Functional Requirements

- **FR-001**: El sistema DEBE reemplazar el placeholder de `/dashboard/padre/expedientes/page.tsx` por una vista de lista de expedientes del padre autenticado.
- **FR-002**: La lista DEBE usar `ExpedienteRepository.listarExpedientesDePadre` y mostrar cards con: identificador reportado, estado, score de gravedad, fecha de apertura, días desde última actividad y número de eventos.
- **FR-003**: La vista DEBE incluir filtros por estado: "Todos", "Activos", "En revisión", "Cerrados".
- **FR-004**: El sistema DEBE crear `/dashboard/padre/expedientes/[id]/page.tsx` con vista detalle del expediente.
- **FR-005**: El detalle DEBE usar `ExpedienteRepository.obtenerExpedientePorId` filtrando por `padreUsuarioId` del usuario autenticado; si no pertenece, devuelve 404.
- **FR-006**: El detalle DEBE mostrar cronología de eventos con fecha, texto y clasificación detectada (si existe).
- **FR-007**: El detalle DEBE incluir botón "Agregar nueva situación" que abra un formulario/modal con campo texto (máx 2000 chars).
- **FR-008**: Al enviar el formulario, el sistema DEBE llamar a un endpoint `POST /api/padre/expedientes/[id]/eventos` que use `ExpedienteRepository.agregarEvento`.
- **FR-009**: El endpoint DEBE crear automáticamente un `Reporte` asociado al evento usando los datos del expediente (identificador, plataforma) y el texto del evento.
- **FR-010**: El sistema DEBE implementar AutoSuggest N3 en `/dashboard/padre` o `/dashboard/padre/expedientes`: card destacada si existe expediente `ACTIVO` con `ultimoEventoEn` > 3 días atrás.
- **FR-011**: El AutoSuggest DEBE tener botones "Agregar nueva situación" (lleva al detalle) y "Ya se resolvió" (placeholder para consolidación futura).
- **FR-012**: El sistema DEBE usar `date-fns-tz` con `America/Bogota` para calcular días desde última actividad y fechas mostradas.
- **FR-013**: El sistema DEBE usar color `cielo` (tema padre) y componentes vidrio heredados.
- **FR-014**: El sistema DEBE registrar `AuditLog` al agregar un evento a un expediente.
- **FR-015**: El sistema NO DEBE modificar `src/lib/ai/**`, el schema Prisma, ni crear migraciones.
- **FR-016**: Todo acceso a datos DEBE pasar por `ExpedienteRepository` y `UsuarioRepository` (DAL).

## Non-Functional Requirements

- **NFR-001**: Gate local completo: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test`, `build`.
- **NFR-002**: Tests de integración para el endpoint `POST /api/padre/expedientes/[id]/eventos` (éxito, expediente ajeno 404, cerrado 409, texto largo 400).
- **NFR-003**: Tests de componente para la lista y el detalle.
- **NFR-004**: Responsive: lista 1 columna mobile, 2-3 desktop.

## Success Criteria

- **SC-001**: `/dashboard/padre/expedientes` muestra solo expedientes del padre autenticado.
- **SC-002**: Filtros cambian correctamente el conjunto mostrado.
- **SC-003**: `/dashboard/padre/expedientes/[id]` muestra cronología ordenada.
- **SC-004**: Agregar evento crea `EventoExpediente` + `Reporte` y actualiza contadores.
- **SC-005**: AutoSuggest aparece cuando hay expediente activo con 3+ días sin eventos.
- **SC-006**: Padre no puede ver ni editar expedientes de otro padre (404).
- **SC-007**: CI 6/6 verde.

## Assumptions

- SPEC-230 dejó `ExpedienteRepository` con `listarExpedientesDePadre`, `obtenerExpedientePorId` y `agregarEvento` (crea Reporte automáticamente).
- SPEC-231 dejó el sidebar y layout de `/dashboard/padre/*`.
- El estado `CERRADO` es final: no se pueden agregar eventos (rechazo 409).
- La consolidación del expediente (botón "Ya se resolvió") se implementa en SPEC-234/236; aquí solo es placeholder.
- No se requieren cambios de schema ni nuevos modelos.

## Decisiones propuestas / Deuda

1. **AutoSuggest en lista**: se propone mostrarlo en `/dashboard/padre/expedientes` (y opcionalmente en `/dashboard/padre`), no como modal invasivo.
2. **Botón "Ya se resolvió"**: placeholder visual sin acción; la consolidación real se implementa en SPEC-234/236.
3. **Deuda técnica**: la vista de búsqueda por identificador (`/dashboard/padre/identificador/[nick]`) queda para SPEC-233.
