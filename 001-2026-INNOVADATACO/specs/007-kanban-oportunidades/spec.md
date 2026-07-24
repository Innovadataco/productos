# Feature Specification: Kanban de Oportunidades (componente reutilizable)

**Feature Branch**: `007-kanban-oportunidades` (el trabajo se commitea en la rama de pruebas
`feature/001-scaffolding`; no se abren ramas por feature — AGENTS.md)

**Created**: 2026-07-24

**Status**: **Draft** — pendiente de aprobación por ZEUS (arquitecto) y Jelkin (CEO). Segunda
de la hoja de ruta de evolución de módulos (D-054/D-055/D-059). Se redacta en paralelo con
**SPEC-008**, que **reutilizará** el componente Kanban que esta spec define.

**Input**: El submódulo "Estado" (hoy "Estados") de Oportunidades pasa de catálogo a un
**tablero Kanban**: una columna por estado del catálogo, cada oportunidad una tarjeta;
arrastrar una tarjeta entre columnas cambia y persiste su estado con registro en auditoría.
Requisito de diseño de ZEUS: el tablero debe ser un **componente reutilizable**, separado de
la lógica específica de oportunidades, porque SPEC-008 lo usará para las fases del proyecto.

## Contexto: un tablero que sirva dos veces

Hoy el módulo de Oportunidades tiene un submódulo "Estados" que solo lista y crea estados del
catálogo `LicitacionStatus`. Cambiar el estado de una oportunidad se hace editándola en un
formulario. No hay una vista operativa donde ver todas las oportunidades por estado y moverlas.

Esta spec introduce esa vista como **Kanban**, pero con una condición de diseño que la hace más
que una pantalla: **el tablero es genérico**. SPEC-008 necesita exactamente lo mismo para las
fases de un proyecto (Inicio · Planeación · Ejecución · Cierre). Si el Kanban se escribe atado a
"oportunidades", SPEC-008 lo reescribe; si se escribe genérico, SPEC-008 lo configura. Esta spec
elige lo segundo.

### Estado verificado del código (2026-07-24)

| Pieza | Estado real |
|---|---|
| Estados de oportunidad | Catálogo `LicitacionStatus` (`key`, `nombreOficial`), configurable, sembrado (5 estados) |
| Oportunidad → estado | `Licitacion.estadoId` (FK), obligatorio; el estado se cambia hoy vía `PATCH /api/licitaciones/[id]` |
| Submódulo actual | "Estados" en `SUBMODULES.licitaciones`: lista y crea estados, sin vista de tablero |
| Auditoría | Helper `auditLog` (`src/lib/audit.ts`) ya registra acción, entidad, usuario, estado, mensaje, momento |
| Colores de estado | `estadoColores` en `LicitacionesTab.tsx` mapea `key` → color (en-proceso/abierta/cerrada/adjudicada/cancelada) |

### Decisión de diseño central (ZEUS): tablero genérico + adaptador

- **Componente `KanbanBoard` genérico** (presentación + interacción de arrastre): recibe
  **columnas** y **tarjetas** ya normalizadas y emite un evento **"tarjeta X movida a columna
  Y"**. No sabe nada de oportunidades ni de estados: habla de columnas y tarjetas.
- **Adaptador de Oportunidades** (lógica específica): carga las oportunidades y el catálogo de
  estados, los transforma en columnas/tarjetas, y al recibir el evento de movimiento llama a la
  API para persistir el nuevo estado. SPEC-008 escribirá su propio adaptador (fases) sobre el
  **mismo** `KanbanBoard`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver las oportunidades como tablero por estado (Priority: P1)

Como analista, quiero ver todas las oportunidades organizadas en columnas por su estado, para
entender de un vistazo en qué punto está cada una.

**Why this priority**: es la vista operativa que hoy no existe y la base sobre la que se mueve.

**Independent Test**: abrir el tablero y comprobar que hay una columna por cada estado del
catálogo y que cada oportunidad aparece como tarjeta en la columna de su estado.

**Acceptance Scenarios**:

1. **Given** el catálogo de estados y varias oportunidades, **When** se abre el tablero,
   **Then** hay **una columna por estado** (desde el catálogo, no cableadas) y cada oportunidad
   es una tarjeta en la columna de su estado actual.
2. **Given** una oportunidad sin coincidencia de estado (dato inconsistente), **When** se
   renderiza, **Then** no rompe el tablero (se ubica de forma definida por el plan, p. ej. sin
   columna, y se registra el caso).
3. **Given** un estado del catálogo sin oportunidades, **When** se abre el tablero, **Then** su
   columna aparece vacía, no se omite.
4. **Given** el orden de las columnas, **When** se muestran, **Then** siguen el orden del
   catálogo (configurable), no un orden cableado.
5. **Given** cada tarjeta, **When** se muestra, **Then** presenta lo esencial de la oportunidad
   (título, número si lo tiene, tipo) para identificarla sin abrirla.

---

### User Story 2 - Mover una tarjeta cambia y persiste el estado (Priority: P1)

Como analista, quiero arrastrar una oportunidad de una columna a otra para cambiar su estado sin
abrir un formulario, y que ese cambio quede guardado.

**Why this priority**: es el valor operativo del Kanban; sin persistencia es solo decoración.

**Independent Test**: arrastrar una tarjeta a otra columna, recargar y comprobar que la
oportunidad quedó en el nuevo estado.

**Acceptance Scenarios**:

1. **Given** una oportunidad en una columna, **When** se arrastra a otra columna, **Then** su
   estado cambia al de la columna destino y **se persiste** (sobrevive a una recarga).
2. **Given** un movimiento de tarjeta, **When** se persiste, **Then** queda **registrado en
   auditoría**: quién lo hizo, qué oportunidad, de qué estado a cuál y cuándo.
3. **Given** un movimiento sin sesión válida, **When** se intenta persistir, **Then** se rechaza
   con **401** y el estado **no** cambia (`verifyAuth`).
4. **Given** un fallo al persistir (red/servidor), **When** ocurre, **Then** la tarjeta **vuelve
   visualmente** a su columna original y se informa el error legible (sin `err.message`): la UI
   no queda mintiendo un estado que no se guardó.
5. **Given** una tarjeta soltada en su **misma** columna, **When** ocurre, **Then** no se hace
   ninguna llamada ni se registra auditoría (no hubo cambio).
6. **Given** el estado destino, **When** se persiste, **Then** se usa el mecanismo de cambio de
   estado existente (no se inventa una ruta paralela que se salte validaciones).

---

### User Story 3 - El tablero es un componente reutilizable (Priority: P1)

Como equipo, quiero que el tablero sea genérico y desacoplado de oportunidades, para que
SPEC-008 lo reutilice con las fases del proyecto sin reescribirlo.

**Why this priority**: es la condición de diseño que ZEUS fijó y la razón de que esta spec
exista antes que SPEC-008. Si se incumple, SPEC-008 duplica el tablero.

**Independent Test**: revisar que el componente de tablero no importa nada de oportunidades y que
se puede alimentar con columnas/tarjetas arbitrarias.

**Acceptance Scenarios**:

1. **Given** el componente de tablero, **When** se inspecciona, **Then** **no** referencia
   `Licitacion`, estados ni rutas de oportunidades: recibe columnas y tarjetas ya normalizadas.
2. **Given** el componente, **When** una tarjeta se mueve, **Then** **emite un evento** con la
   tarjeta y la columna destino, y **no** decide él cómo persistir: eso lo hace quien lo usa.
3. **Given** dos usos distintos (oportunidades y, en el futuro, fases), **When** ambos alimentan
   el mismo componente, **Then** el tablero funciona igual sin cambios en su código.
4. **Given** la lógica específica de oportunidades (carga, transformación, persistencia),
   **When** se ubica, **Then** vive en un **adaptador aparte**, no dentro del tablero.

---

### User Story 4 - Las columnas salen del catálogo configurable (Priority: P2)

Como administrador, quiero que las columnas del tablero reflejen el catálogo de estados que
administro, para que añadir o renombrar un estado se refleje en el tablero sin tocar código.

**Why this priority**: es §0.7 aplicado al tablero; refuerza que las columnas no están cableadas.

**Independent Test**: añadir un estado al catálogo y comprobar que aparece como columna nueva.

**Acceptance Scenarios**:

1. **Given** un estado nuevo en el catálogo, **When** se abre el tablero, **Then** aparece una
   columna nueva para él, sin cambios de código.
2. **Given** un estado renombrado, **When** se abre el tablero, **Then** la columna muestra el
   nombre nuevo.

### Edge Cases

- ¿Qué pasa si dos usuarios mueven la misma tarjeta casi a la vez? → El último cambio persistido
  gana; el plan define si se relee para no pisar en silencio. La auditoría registra ambos.
- ¿Y si el catálogo no tiene estados? → El tablero muestra un estado vacío informativo, no un
  error.
- ¿Una tarjeta se puede mover a cualquier columna? → Sí; esta spec **no** impone reglas de
  transición entre estados (qué estado puede seguir a cuál). Si el negocio las quisiera, es otro
  frente.
- ¿El movimiento bloquea la interfaz hasta guardar? → El plan define optimista-con-rollback (US2-4)
  o bloqueante; en ambos casos, un fallo revierte la vista.
- ¿El tablero depende de una librería de arrastre concreta? → El plan la elige; el contrato del
  componente (columnas + tarjetas + evento de movimiento) no depende de ella.

## Requirements *(mandatory)*

### Restricciones de ZEUS (no negociables)

- **RZ-1**: el tablero es un **componente reutilizable**, separado de la lógica de oportunidades.
  SPEC-008 lo reutiliza para fases.
- **RZ-2**: las columnas salen del **catálogo configurable**, no cableadas (§0.7).
- **RZ-3**: mover una tarjeta respeta **`verifyAuth`** y registra **auditoría**.
- **RZ-4**: toda ruta API tocada lleva **test Vitest** (§0.2) y contrato **`apiError`** (§0.3);
  cero `any` nuevos.
- **RZ-5**: no se toca Base Oficial, el pipeline RAG ni otro producto.

### Functional Requirements

- **FR-001**: MUST existir un **componente `KanbanBoard` genérico** que reciba una lista de
  **columnas** y una lista de **tarjetas** (cada tarjeta asociada a una columna) ya normalizadas,
  y **emita un evento** al soltar una tarjeta en otra columna (tarjeta + columna destino). MUST
  NOT contener lógica de oportunidades, estados ni llamadas a API.
- **FR-002**: MUST existir un **adaptador de Oportunidades** que cargue las oportunidades y el
  catálogo de estados, los transforme en columnas/tarjetas y, al recibir el evento de movimiento,
  **persista** el nuevo estado.
- **FR-003**: las **columnas** MUST derivarse del catálogo `LicitacionStatus` (configurable) y
  respetar su orden; MUST NOT estar cableadas en el código.
- **FR-004**: cada oportunidad MUST aparecer como **tarjeta** en la columna de su estado actual,
  mostrando lo esencial para identificarla (título, número si existe, tipo).
- **FR-005**: mover una tarjeta a otra columna MUST cambiar el estado de la oportunidad al de la
  columna destino y **persistirlo**, usando el mecanismo de cambio de estado existente
  (`PATCH /api/licitaciones/[id]` o una ruta equivalente que respete las mismas validaciones).
- **FR-006**: la persistencia del movimiento MUST exigir `verifyAuth` y responder **401** sin
  sesión, sin cambiar el estado.
- **FR-007**: cada movimiento persistido MUST registrarse en **auditoría** (`auditLog`): usuario,
  oportunidad, estado origen, estado destino y momento.
- **FR-008**: si la persistencia falla, la UI MUST **revertir** la tarjeta a su columna original
  y mostrar un error legible; MUST NOT dejar la tarjeta en una columna cuyo cambio no se guardó.
- **FR-009**: soltar una tarjeta en su **misma** columna MUST NOT disparar llamada ni auditoría.
- **FR-010**: la ruta de persistencia (si es nueva o modificada) MUST llevar test Vitest y usar
  el contrato `apiError`; MUST NOT filtrar `err.message`.
- **FR-011**: la vista de tablero MUST sustituir o complementar el submódulo de estado de
  Oportunidades (el plan decide si reemplaza "Estados" o añade un submódulo "Tablero"); el
  catálogo de estados MUST seguir administrándose.
- **FR-012**: cero `any` nuevos en `src/lib` y rutas API; ningún cambio MUST tocar Base Oficial,
  el RAG, ni archivos/puertos de `002-2026-PROTECCION-INFANTIL` ni `003-2026-SICOV-OTPC` (ADR_002).

### Key Entities

- **KanbanBoard (componente)**: presentación genérica de columnas y tarjetas con arrastre; su
  contrato es `{ columnas, tarjetas, onMover(tarjetaId, columnaDestino) }`. No conoce el dominio.
- **Columna**: unidad del tablero derivada de un elemento de catálogo (aquí, un `LicitacionStatus`).
- **Tarjeta**: unidad movible derivada de una entidad de negocio (aquí, una oportunidad).
- **Adaptador de Oportunidades**: traduce entre el dominio (oportunidades/estados) y el contrato
  genérico del tablero, y persiste los movimientos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: el tablero muestra una columna por estado del catálogo (verificable añadiendo un
  estado: aparece una columna nueva sin tocar código).
- **SC-002**: cada oportunidad aparece como tarjeta en la columna de su estado actual.
- **SC-003**: arrastrar una tarjeta a otra columna cambia su estado y **persiste** (sobrevive a
  una recarga).
- **SC-004**: cada movimiento deja un registro de auditoría con usuario, oportunidad, origen,
  destino y momento.
- **SC-005**: un movimiento sin sesión responde **401** y no cambia el estado.
- **SC-006**: un fallo de persistencia revierte la tarjeta y muestra error legible (sin
  `err.message`).
- **SC-007**: soltar en la misma columna no genera llamada ni auditoría.
- **SC-008**: el componente `KanbanBoard` **no** importa nada de oportunidades (verificable con
  una revisión de imports); se puede alimentar con columnas/tarjetas arbitrarias.
- **SC-009**: `npx vitest run` pasa **sin BD ni Ollama**, no baja de la línea base vigente, e
  incluye cobertura de la ruta de persistencia del movimiento.
- **SC-010**: `npx tsc --noEmit` limpio y `npx eslint src/lib src/app/api` con **0** errores
  `no-explicit-any`.
- **SC-011**: los puertos 5005/5433/5010/5434 y el RAG permanecen sin cambios.

## Definición de terminado

| # | Regla de Oro | Cómo se acredita |
|---|---|---|
| 1 | Spec Kit aplicado | `specs/007-kanban-oportunidades/` con spec, plan, tasks y checklist |
| 2 | Código a la rama de pruebas | Commits scopeados a `001-2026-INNOVADATACO/`, push en el mismo acto |
| 3 | Pruebas escritas y pasando | SC-009: suite verde con cobertura del movimiento |
| 4 | Despliegue accesible y probable | SC-001…SC-007: el CEO ve el tablero y mueve tarjetas que persisten |
| 5 | Revisión de arquitectura de ZEUS | RZ-1 (reutilizable) y RZ-2 (columnas del catálogo) verificadas |

## Assumptions

- El componente `KanbanBoard` se diseña para que **SPEC-008 lo reutilice** con fases de proyecto;
  su contrato (columnas + tarjetas + evento de movimiento) es agnóstico del dominio.
- El cambio de estado se persiste con el mecanismo existente (PATCH de la oportunidad) para no
  saltarse validaciones; el plan confirma si basta o hace falta una ruta dedicada.
- No hay reglas de transición entre estados en esta spec (cualquier columna a cualquier columna).
- La suite sigue el patrón de mocks (spec 002): sin BD ni red. El tablero (UI) se verifica sobre
  todo por su contrato y manualmente; la lógica de persistencia, por prueba de la ruta.
- Esta spec **no se implementa** hasta ser aprobada por ZEUS y Jelkin (§0.1).

## Out of Scope

- **Reglas de transición entre estados** (qué estado puede seguir a cuál).
- **Reordenar tarjetas dentro de una columna** o prioridad manual: aquí solo importa la columna
  (estado), no la posición dentro de ella.
- El **Kanban de fases de proyecto**: es **SPEC-008**, que reutiliza este componente.
- Cambiar el catálogo de estados o su administración (sigue como está).
- Base Oficial, pipeline RAG, 002-Protección Infantil, 003-SICOV.
