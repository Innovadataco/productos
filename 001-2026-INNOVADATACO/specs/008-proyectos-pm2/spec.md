# Feature Specification: Proyectos PM2 (edición, fases Kanban y gestión completa)

**Feature Branch**: `008-proyectos-pm2` (el trabajo se commitea en la rama de pruebas
`feature/001-scaffolding`; no se abren ramas por feature — AGENTS.md)

**Created**: 2026-07-24

**Status**: **Draft** — pendiente de aprobación por ZEUS (arquitecto) y Jelkin (CEO). Tercera de
la hoja de ruta de evolución de módulos (D-054/D-055/D-059). **Depende de SPEC-007**: reutiliza
su componente Kanban para las fases del proyecto.

**Input**: Hoy Proyectos solo crea y no edita. Se reconstruye como gestión de proyectos según la
metodología **PM2** de IDC: editar, fases en Kanban (reusando SPEC-007), entregables, cronograma,
presupuesto/recursos y lecciones aprendidas. Alcance de ZEUS; decisiones de negocio confirmadas
por el CEO vía `/speckit-clarify` (2026-07-24).

## Contexto: de "crea y olvida" a gestión PM2

El módulo Proyectos hoy es mínimo: `GET`/`POST` en `/api/projects` y una UI que crea un proyecto
y lo lista. **No se puede editar** un proyecto una vez creado —el gap más básico— ni gestionar
nada de su ciclo de vida. El modelo `Proyecto` ya tiene `currentPhase` (con default
`initiation`) pero **nada lo mueve**.

Esta spec lo reconstruye siguiendo PM2: fase actual gestionada en un **tablero Kanban** (el mismo
componente que entrega SPEC-007), entregables, cronograma, presupuesto con control de gasto y
lecciones aprendidas. El orden de prioridad lo fija el corte P1/P2/P3 de abajo.

### Estado verificado del código (2026-07-24)

| Pieza | Estado real |
|---|---|
| Modelo `Proyecto` | `codigo` (único), `nombre`, `cliente`, `estado` (default `active`), `currentPhase` (default `initiation`, `@map("current_phase")`) |
| Rutas | Solo `GET`/`POST` en `/api/projects`. **No hay `[id]`, ni PATCH, ni DELETE**: editar es imposible |
| UI | `ProyectosTab` (submódulo "listado") y `ProjectForm` (crear). Sin edición |
| Kanban | Lo entrega **SPEC-007** como componente reutilizable; aquí se **reutiliza** para fases |
| Presupuesto por partidas | Patrón ya existente en Oportunidades (`PartidaPresupuesto`): referencia para el de proyectos |

### Fases PM2 (fijas, no catálogo)

Las fases del proyecto son las de la metodología PM2 de IDC y son **cuatro, fijas**: **Inicio ·
Planeación · Ejecución · Cierre**. A diferencia de los estados de oportunidad (catálogo
configurable), las fases son parte de la metodología: no se añaden ni se quitan desde la UI. El
tablero de fases usa estas cuatro como columnas.

### Decisiones de negocio (CEO, `/speckit-clarify` 2026-07-24)

1. **Entregable**: lleva **los cuatro** campos mínimos — **nombre y descripción**, **estado/avance**,
   **fecha compromiso** y **responsable**.
2. **Presupuesto**: **partidas + planeado vs ejecutado** — como Oportunidades pero cada partida con
   monto **planeado** y monto **ejecutado** (control de gasto PM2).
3. **Recurso**: importa **todo** — **nombre y rol**, **tipo (humano/material)**, **costo/tarifa** y
   **disponibilidad/asignación**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editar un proyecto (Priority: P1) 🎯 cierra el gap base

Como gestor de proyectos, quiero editar un proyecto ya creado (nombre, cliente, estado), para
corregir y mantener su información, algo que hoy es imposible.

**Why this priority**: es el gap más básico —hoy no se puede editar— y prerequisito de todo lo
demás (mover fases, añadir entregables… es todo edición).

**Independent Test**: crear un proyecto, editar su nombre y cliente, recargar y ver los cambios.

**Acceptance Scenarios**:

1. **Given** un proyecto existente, **When** se editan sus campos (nombre, cliente, estado),
   **Then** los cambios se persisten y se ven tras recargar.
2. **Given** una edición sin sesión válida, **When** se intenta, **Then** responde **401** y nada
   cambia (`verifyAuth`).
3. **Given** un `codigo` que ya usa otro proyecto, **When** se intenta asignar, **Then** se
   rechaza con **409** legible (el código es único).
4. **Given** un proyecto inexistente, **When** se intenta editar, **Then** responde **404**.
5. **Given** un intento de borrado, **When** se ejecuta con sesión, **Then** el proyecto y sus
   datos asociados (fases no, pero entregables/partidas/recursos/lecciones sí) se eliminan de
   forma consistente (CASCADE), sin huérfanos.

---

### User Story 2 - Gestionar las fases en un Kanban (Priority: P1) 🎯 reusa SPEC-007

Como gestor, quiero mover un proyecto entre las fases PM2 (Inicio · Planeación · Ejecución ·
Cierre) en un tablero, para gestionar su avance de forma visual, **reutilizando el componente
Kanban de SPEC-007**.

**Why this priority**: es el núcleo de la gestión PM2 y la prueba de que el Kanban de SPEC-007 es
de verdad reutilizable.

**Independent Test**: abrir el tablero de fases, mover un proyecto de Inicio a Planeación,
recargar y comprobar que `currentPhase` cambió.

**Acceptance Scenarios**:

1. **Given** los proyectos y las 4 fases PM2, **When** se abre el tablero, **Then** hay una
   columna por fase (Inicio · Planeación · Ejecución · Cierre) y cada proyecto es una tarjeta en
   su fase actual.
2. **Given** el componente Kanban, **When** se usa aquí, **Then** es **el mismo `KanbanBoard` de
   SPEC-007**, alimentado por un **adaptador de proyectos** (fases como columnas, proyectos como
   tarjetas): no se reescribe el tablero.
3. **Given** un proyecto en una fase, **When** se arrastra a otra, **Then** `currentPhase` cambia
   a la fase destino y **se persiste**, con **registro en auditoría** (usuario, proyecto, fase
   origen/destino, momento) y respetando `verifyAuth`.
4. **Given** un fallo de persistencia, **When** ocurre, **Then** la tarjeta revierte a su fase
   original y se informa error legible (sin `err.message`).
5. **Given** soltar en la misma fase, **When** ocurre, **Then** no hay llamada ni auditoría.

---

### User Story 3 - Entregables del proyecto (Priority: P2)

Como gestor, quiero registrar los entregables del proyecto con su información mínima, para hacer
seguimiento de lo que hay que producir.

**Why this priority**: es gestión PM2 de valor, pero depende de que el proyecto sea editable (US1).

**Independent Test**: añadir dos entregables a un proyecto y comprobar que se listan con sus datos.

**Acceptance Scenarios**:

1. **Given** un proyecto, **When** se añade un entregable con **nombre, descripción, estado/avance,
   fecha compromiso y responsable**, **Then** se persiste y aparece en la lista del proyecto.
2. **Given** un entregable, **When** se edita su estado/avance, **Then** el cambio se guarda.
3. **Given** un entregable sin nombre, **When** se intenta crear, **Then** se rechaza con error
   legible.
4. **Given** un proyecto con entregables, **When** se elimina, **Then** sus entregables se
   eliminan con él (CASCADE).

---

### User Story 4 - Cronograma del proyecto (Priority: P3)

Como gestor, quiero registrar hitos/actividades del proyecto con sus fechas, para tener el
cronograma en un solo lugar.

**Why this priority**: complementa la gestión pero no bloquea el ciclo básico.

**Independent Test**: añadir hitos con fecha y comprobar que se listan ordenados.

**Acceptance Scenarios**:

1. **Given** un proyecto, **When** se añade un hito/actividad con nombre y fecha(s), **Then** se
   persiste y se lista.
2. **Given** fechas de un hito, **When** se capturan, **Then** se validan como fechas reales; una
   inválida se rechaza.
3. **Given** los hitos, **When** se muestran, **Then** se pueden ordenar por fecha.

---

### User Story 5 - Presupuesto y recursos (Priority: P2)

Como gestor, quiero registrar el presupuesto por partidas con control de gasto (planeado vs
ejecutado) y los recursos del proyecto, para gestionar el costo.

**Why this priority**: es control financiero PM2; alto valor, pero no bloquea el ciclo base.

**Independent Test**: añadir partidas con planeado y ejecutado y ver el total y la desviación;
añadir un recurso con sus datos.

**Acceptance Scenarios**:

1. **Given** un proyecto, **When** se añaden partidas de presupuesto (concepto, monto **planeado**,
   monto **ejecutado**, moneda), **Then** se persisten y se puede consultar el **total planeado**,
   el **total ejecutado** y la **desviación**.
2. **Given** un monto (planeado o ejecutado), **When** se captura, **Then** se valida como número
   no negativo; un valor inválido se rechaza (patrón del presupuesto de Oportunidades).
3. **Given** un proyecto, **When** se añade un recurso con **nombre y rol**, **tipo
   (humano/material)**, **costo/tarifa** y **disponibilidad/asignación**, **Then** se persiste y se
   lista.
4. **Given** partidas y recursos, **When** se elimina el proyecto, **Then** se eliminan con él
   (CASCADE), sin huérfanos.

---

### User Story 6 - Lecciones aprendidas (Priority: P3)

Como gestor, quiero registrar lecciones aprendidas del proyecto, como parte del Cierre PM2, para
capitalizar la experiencia.

**Why this priority**: es valor de cierre PM2; el último eslabón, no bloquea nada.

**Independent Test**: añadir una lección aprendida a un proyecto en Cierre y comprobar que se lista.

**Acceptance Scenarios**:

1. **Given** un proyecto, **When** se añade una lección aprendida (descripción y, opcionalmente,
   categoría/impacto), **Then** se persiste y se lista.
2. **Given** las lecciones, **When** se muestran, **Then** se asocian claramente al proyecto y a
   su fase de Cierre.

### Edge Cases

- ¿Se puede mover un proyecto directamente de Inicio a Cierre? → Sí; esta spec **no** impone reglas
  de transición entre fases (igual que SPEC-007 no las impone entre estados).
- ¿Qué pasa con los proyectos existentes al reconstruir el módulo? → Conservan sus datos y su
  `currentPhase` actual; la reconstrucción es aditiva sobre el modelo (no se recrea la tabla).
- ¿El presupuesto ejecutado puede superar al planeado? → Sí; es justo lo que el control de gasto
  debe **mostrar** (desviación), no impedir.
- ¿Un recurso material tiene "rol"? → El campo rol aplica sobre todo a humanos; para material puede
  quedar vacío. El plan define el mínimo por tipo sin bloquear.
- ¿Las fases se pueden configurar como los estados de oportunidad? → **No**: las fases PM2 son
  fijas (metodología), no un catálogo editable. Es la diferencia deliberada con SPEC-007.

## Requirements *(mandatory)*

### Restricciones de ZEUS (no negociables)

- **RZ-1**: US1 (editar) y US2 (Kanban de fases) son **P1**; el resto P2/P3 según el corte de esta
  spec.
- **RZ-2**: el Kanban de fases **reutiliza el `KanbanBoard` de SPEC-007**; no se reescribe el
  tablero. Aquí solo se escribe el **adaptador de proyectos**.
- **RZ-3**: mover una tarjeta (fase) respeta **`verifyAuth`** y registra **auditoría**.
- **RZ-4**: toda ruta API tocada lleva **test Vitest** (§0.2) y contrato **`apiError`** (§0.3);
  cero `any` nuevos, cero fugas de `err.message`.
- **RZ-5**: no se toca Base Oficial, el pipeline RAG ni otro producto.

### Functional Requirements

**Edición (US1) — P1**

- **FR-001**: MUST existir una ruta `PATCH /api/projects/[id]` (o equivalente) que edite un
  proyecto (nombre, cliente, estado), con `verifyAuth` y contrato `apiError`.
- **FR-002**: MUST existir `DELETE /api/projects/[id]` que elimine el proyecto y sus datos
  asociados (entregables, partidas, recursos, lecciones) en cascada, sin huérfanos.
- **FR-003**: editar con un `codigo` ya usado MUST responder **409**; un proyecto inexistente,
  **404**; sin sesión, **401**.
- **FR-004**: la UI MUST permitir **editar** un proyecto (hoy solo crea), reutilizando el
  formulario de creación donde tenga sentido.

**Kanban de fases (US2) — P1, reusa SPEC-007**

- **FR-005**: MUST existir un **tablero de fases** que use el **`KanbanBoard` de SPEC-007** con las
  4 fases PM2 (Inicio · Planeación · Ejecución · Cierre) como columnas y los proyectos como
  tarjetas. Las fases son **fijas** (no catálogo).
- **FR-006**: mover un proyecto a otra fase MUST cambiar `currentPhase` y **persistirlo**, con
  `verifyAuth` y **auditoría** (usuario, proyecto, fase origen/destino, momento).
- **FR-007**: un fallo de persistencia MUST revertir la tarjeta; soltar en la misma fase MUST NOT
  disparar llamada ni auditoría (mismo contrato que SPEC-007).
- **FR-008**: el **adaptador de proyectos** MUST vivir aparte del componente `KanbanBoard` (que no
  se modifica): traduce fases↔columnas, proyectos↔tarjetas y persiste el cambio de fase.

**Entregables (US3) — P2**

- **FR-009**: MUST existir una entidad **Entregable** asociada al proyecto (CASCADE) con **nombre,
  descripción, estado/avance, fecha compromiso y responsable**, y rutas para crearlos, listarlos y
  editarlos, con `verifyAuth` y `apiError`.
- **FR-010**: crear un entregable sin nombre MUST rechazarse con error legible.

**Cronograma (US4) — P3**

- **FR-011**: MUST existir una entidad **Hito/Actividad** asociada al proyecto (CASCADE) con nombre
  y fecha(s) validadas, y rutas para gestionarla; MUST poder ordenarse por fecha.

**Presupuesto y recursos (US5) — P2**

- **FR-012**: MUST existir un **presupuesto por partidas** del proyecto con, por partida, concepto,
  **monto planeado**, **monto ejecutado** y moneda (montos validados como número no negativo). MUST
  poder consultarse total planeado, total ejecutado y **desviación**. Reutiliza el patrón de
  `PartidaPresupuesto` de Oportunidades, extendido con planeado/ejecutado.
- **FR-013**: MUST existir una entidad **Recurso** asociada al proyecto (CASCADE) con **nombre,
  rol, tipo (humano/material), costo/tarifa y disponibilidad/asignación**, y rutas para gestionarla.

**Lecciones aprendidas (US6) — P3**

- **FR-014**: MUST existir una entidad **Lección aprendida** asociada al proyecto (CASCADE) con al
  menos una descripción (y opcionalmente categoría/impacto), y rutas para gestionarla; se asocia a
  la fase de Cierre.

**Transversales**

- **FR-015**: toda ruta API nueva o modificada MUST llevar test Vitest, exigir `verifyAuth` y usar
  el contrato `apiError`; MUST NOT filtrar `err.message`.
- **FR-016**: cero `any` nuevos en `src/lib` y rutas API.
- **FR-017**: las migraciones MUST ser **aditivas** sobre `proyectos` y **no perder** los proyectos
  existentes ni su `currentPhase`.
- **FR-018**: ningún cambio MUST tocar Base Oficial, el RAG, ni archivos/puertos de
  `002-2026-PROTECCION-INFANTIL` ni `003-2026-SICOV-OTPC` (ADR_002).

### Key Entities

- **Proyecto** (evoluciona): gana relaciones con entregables, hitos, partidas, recursos y
  lecciones; su `currentPhase` pasa a gestionarse por el Kanban de fases.
- **Fase PM2**: Inicio · Planeación · Ejecución · Cierre. **Fijas** (metodología), no catálogo.
- **Entregable**: nombre, descripción, estado/avance, fecha compromiso, responsable. CASCADE.
- **Hito/Actividad** (cronograma): nombre, fecha(s). CASCADE.
- **Partida de presupuesto de proyecto**: concepto, monto planeado, monto ejecutado, moneda.
  CASCADE.
- **Recurso**: nombre, rol, tipo (humano/material), costo/tarifa, disponibilidad/asignación.
  CASCADE.
- **Lección aprendida**: descripción (+ categoría/impacto opcional). CASCADE.
- **Adaptador de proyectos (Kanban)**: traduce fases↔columnas, proyectos↔tarjetas; persiste el
  cambio de fase sobre el `KanbanBoard` de SPEC-007.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: editar el nombre y el cliente de un proyecto persiste (baseline: editar es imposible
  hoy).
- **SC-002**: editar con un `codigo` en uso → 409; proyecto inexistente → 404; sin sesión → 401.
- **SC-003**: el tablero de fases muestra 4 columnas (Inicio · Planeación · Ejecución · Cierre) y
  cada proyecto como tarjeta en su fase.
- **SC-004**: mover un proyecto de fase cambia `currentPhase`, persiste y deja auditoría (usuario,
  proyecto, origen, destino, momento).
- **SC-005**: el Kanban de fases usa **el mismo componente** que SPEC-007 (verificable: no hay un
  segundo tablero; el adaptador de proyectos es lo único nuevo de UI del tablero).
- **SC-006**: un proyecto admite ≥ 2 entregables con sus 5 campos y se listan.
- **SC-007**: un proyecto admite partidas con planeado y ejecutado, y el sistema reporta total
  planeado, total ejecutado y desviación.
- **SC-008**: un proyecto admite recursos con sus 4 datos y se listan.
- **SC-009**: un proyecto admite hitos de cronograma con fecha y se ordenan.
- **SC-010**: un proyecto admite lecciones aprendidas y se listan.
- **SC-011**: borrar un proyecto elimina entregables, partidas, recursos y lecciones (0 huérfanos).
- **SC-012**: `npx vitest run` pasa sin BD ni Ollama, no baja de la línea base, con cobertura de
  las rutas nuevas (edición, fase, entregables, presupuesto/recursos).
- **SC-013**: `npx tsc --noEmit` limpio y `npx eslint src/lib src/app/api` con **0**
  `no-explicit-any`; ninguna ruta filtra `err.message`.
- **SC-014**: los proyectos existentes conservan sus datos y su `currentPhase` tras la migración.
- **SC-015**: los puertos 5005/5433/5010/5434 y el RAG permanecen sin cambios.

## Definición de terminado

| # | Regla de Oro | Cómo se acredita |
|---|---|---|
| 1 | Spec Kit aplicado | `specs/008-proyectos-pm2/` con spec, plan, tasks y checklist |
| 2 | Código a la rama de pruebas | Commits scopeados a `001-2026-INNOVADATACO/`, push en el mismo acto |
| 3 | Pruebas escritas y pasando | SC-012: suite verde con cobertura de las rutas nuevas |
| 4 | Despliegue accesible y probable | SC-001…SC-010: el CEO edita proyectos, mueve fases y gestiona su ciclo |
| 5 | Revisión de arquitectura de ZEUS | RZ-2 (reutiliza el Kanban de SPEC-007) verificada; migración sin pérdida |

## Assumptions

- **Depende de SPEC-007**: el Kanban de fases reutiliza su `KanbanBoard`. Si SPEC-007 no está
  implementada al arrancar SPEC-008, US2 se bloquea hasta que lo esté; US1 y el resto no.
- Las **fases PM2 son fijas** (Inicio · Planeación · Ejecución · Cierre), a diferencia de los
  estados de oportunidad (catálogo). El `currentPhase` existente mapea a estas cuatro.
- El **presupuesto de proyecto** extiende el patrón de Oportunidades con planeado/ejecutado; no se
  reutiliza la misma tabla (son dominios distintos), se replica el patrón.
- El corte de prioridades (US1/US2 P1; entregables y presupuesto/recursos P2; cronograma y
  lecciones P3) es una **propuesta de esta spec**; ZEUS puede ajustarlo al aprobar.
- La suite sigue el patrón de mocks (spec 002): sin BD ni red.
- Esta spec **no se implementa** hasta ser aprobada por ZEUS y Jelkin (§0.1).

## Out of Scope

- **Reglas de transición entre fases** (qué fase puede seguir a cuál).
- **Configurar las fases** como catálogo: son fijas por metodología.
- Reescribir el componente Kanban: se **reutiliza** el de SPEC-007 (RZ-2).
- Reportes/gráficas de avance PM2 (Gantt, curva S): un frente propio si el negocio lo pide.
- Integración con herramientas externas de gestión de proyectos.
- Base Oficial, pipeline RAG, 002-Protección Infantil, 003-SICOV.
