# Feature Specification: Gantt interactivo (arrastre)

**Feature Branch**: `016-gantt-interactivo` (rama de pruebas `feature/001-scaffolding`)

**Created**: 2026-07-24

**Status**: **Aprobada (2026-07-24, D-073)** por ZEUS. Turno nocturno desatendido (D-060):
`/speckit-analyze` sustituye la compuerta del plan. Ratificación por la mañana.

**Input**: El Gantt de SPEC-015 es de solo lectura. Esta spec lo hace **interactivo**: arrastrar
una barra mueve sus fechas, arrastrar un borde la redimensiona, y el cambio se **persiste** con
rollback ante fallo, como el Kanban. Añade además el **señalado** de conflictos de dependencia
(sin reprogramar).

## Contexto: mover fechas donde ya se ven

SPEC-015 dejó la matemática de posición en una **función pura** (`src/lib/gantt.ts`)
precisamente para esto: el arrastre se monta encima sin tocar el cálculo. SPEC-016 añade la
función **inversa** —de una posición a una fecha, ajustada a la escala— y el estado de
interacción del arrastre. La persistencia reutiliza el patrón optimista-con-rollback del Kanban
(SPEC-007) y las rutas de entregables e hitos, que ya aceptan sus fechas.

### Estado verificado (2026-07-24, tras SPEC-015)

| Pieza | Estado real |
|---|---|
| `src/lib/gantt.ts` | Matemática pura de posición (fracción→píxel). **Falta la inversa** (fracción→fecha) |
| `PATCH /api/projects/[id]/entregables/[itemId]` | Acepta `fechaInicio`/`fechaCompromiso` |
| `PATCH /api/projects/[id]/hitos/[itemId]` | Acepta `fecha`/`fechaFin` |
| Dependencias entre tareas | **No existen** en el modelo |

### Decisión: dependencias como referencia polimórfica opcional

Para señalar conflictos hace falta saber qué tarea precede a cuál. El Gantt ya identifica sus
items con ids prefijados (`entregable:e1`, `hito:h1`). Se añade un campo **`dependeDe`**
(opcional, texto) a entregables e hitos que guarda **ese id** —el de la tarea de la que
depende—. Así una dependencia puede ser **entre tipos** (un hito que depende de un entregable)
sin una FK polimórfica imposible; una referencia colgada (la tarea de la que dependía se borró)
simplemente **no genera conflicto**. Es aditiva, opcional y no reprograma nada: solo **señala**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mover una barra cambia sus fechas (Priority: P1)

Como gestor, quiero arrastrar una barra del Gantt para cambiar las fechas de la tarea sin abrir
un formulario, y que el cambio quede guardado.

**Independent Test**: arrastrar una barra a otra posición, recargar y ver que la tarea quedó en
las fechas nuevas.

**Acceptance Scenarios**:

1. **Given** una barra, **When** se arrastra su cuerpo, **Then** **inicio y fin se mueven
   juntos** (la duración no cambia) y el cambio se **persiste**.
2. **Given** una barra, **When** se arrastra su **borde**, **Then** cambia **solo** inicio o
   solo fin (se redimensiona), y se persiste.
3. **Given** un movimiento, **When** se persiste, **Then** queda **auditado** (`auditLog`): qué
   tarea, de qué fechas a cuáles.
4. **Given** un `PATCH` que falla, **When** ocurre, **Then** la barra **vuelve** a su posición
   previa y se avisa (sin `err.message`): la vista no miente un cambio que no se guardó.
5. **Given** un hito puntual, **When** se arrastra, **Then** se mueve su fecha (no se
   redimensiona: no tiene ancho).

---

### User Story 2 - Las fechas encajan en la escala (Priority: P1)

Como gestor, quiero que al soltar, la fecha se ajuste a la unidad de la escala activa, para no
tener que afinar al píxel.

**Acceptance Scenarios**:

1. **Given** la escala **día**, **When** se suelta, **Then** la fecha se ajusta al **día**.
2. **Given** la escala **semana**, **When** se suelta, **Then** se ajusta al **lunes** de la
   semana.
3. **Given** la escala **mes**, **When** se suelta, **Then** se ajusta al **día 1** del mes.

---

### User Story 3 - Los conflictos de dependencia se ven (Priority: P2)

Como gestor, quiero que si una tarea depende de otra y sus fechas se solapan mal, se **marque**
el conflicto, para verlo sin que el sistema reprograme por su cuenta.

**Acceptance Scenarios**:

1. **Given** que B depende de A (fin→inicio), **When** A termina **después** de que empieza B,
   **Then** el conflicto se **marca visualmente** en B.
2. **Given** un conflicto marcado, **When** se corrige (moviendo A o B), **Then** la marca
   desaparece.
3. **Given** una dependencia, **When** se produce un conflicto, **Then** el sistema **no
   reprograma** nada automáticamente: solo señala (la reprogramación en cascada sería otra spec).
4. **Given** que la tarea de la que se depende ya no existe, **When** se evalúa, **Then** no hay
   conflicto (referencia colgada = sin dependencia).

### Edge Cases

- ¿Arrastrar más allá del borde del lienzo? → La fecha se acota al rango; no se sale.
- ¿Redimensionar un fin por delante del inicio? → Se impide (una barra no puede terminar antes
  de empezar); mismo criterio que la validación del entregable.
- ¿Dependencia circular (A depende de B y B de A)? → Se detecta y no se cuelga; se marca, no se
  reprograma.
- ¿Arrastrar en un dispositivo táctil? → El arrastre nativo cubre ratón; el táctil queda como en
  el Kanban (mejora futura si se pide).

## Requirements *(mandatory)*

### Restricciones (no negociables)

- **RZ-1**: **cero dependencias nuevas**. Arrastre nativo (puntero), como el Kanban.
- **RZ-2**: la **función pura de SPEC-015 no se rompe**; el arrastre añade la **inversa**
  (fracción→fecha con snap) y estado de interacción, en funciones puras testeadas.
- **RZ-3**: persistencia **optimista con rollback**, patrón del Kanban (SPEC-007); cambio de
  fechas **auditado**.
- **RZ-4**: las pruebas que mutan datos van contra BD desechable o con rollback, **nunca** contra
  datos que el CEO deba conservar (D-039).
- **RZ-5**: **no** hay reprogramación automática; los conflictos solo se **señalan**.

### Functional Requirements

- **FR-001**: arrastrar el **cuerpo** de una barra MUST mover inicio y fin juntos; arrastrar un
  **borde** MUST cambiar solo inicio o solo fin; al soltar MUST **persistir** con `PATCH`.
- **FR-002**: la persistencia MUST ser **optimista con rollback** (la barra vuelve si el `PATCH`
  falla) y el cambio de fechas MUST quedar **auditado**.
- **FR-003**: MUST poder declararse una **dependencia fin→inicio** opcional entre tareas
  (`dependeDe`), y un conflicto (la precedente termina después de que empieza la dependiente)
  MUST **marcarse visualmente**; MUST NOT reprogramarse automáticamente.
- **FR-004**: al soltar, la fecha MUST hacer **snap** a la unidad de la escala activa
  (día/semana/mes).
- **FR-005**: **cero dependencias nuevas**.
- **FR-006**: la **matemática inversa** (fracción→fecha, snap, mover, redimensionar, detectar
  conflictos) MUST vivir en una **función pura testeada**, separada del arrastre.

## Success Criteria *(mandatory)*

- **SC-001**: arrastrar y soltar **persiste** la fecha nueva (verificado en BD viva con un dato
  **desechable**, nunca contra datos del CEO — D-039).
- **SC-002**: un `PATCH` que falla **revierte** la barra a su posición previa.
- **SC-003**: la función pura de SPEC-015 **no se rompe**; el arrastre solo añade estado de
  interacción y la inversa.
- **SC-004**: la suite pasa y **no baja de 589**, con tests del cálculo de nueva fecha por
  posición (incluido el snap por escala), del rollback y de la detección de conflictos.
- **SC-005**: `tsc` limpio; `eslint src` en 0; **0 dependencias nuevas**; migración de
  `dependeDe` aditiva y ensayada.

## Definición de terminado

| # | Regla de Oro | Cómo se acredita |
|---|---|---|
| 1 | Spec Kit | `specs/016-gantt-interactivo/` con spec, plan, research, quickstart, tasks, checklist |
| 2 | GitHub | Commit+push scopeado a `001-` |
| 3 | Pruebas | SC-004 (snap, rollback, conflictos) |
| 4 | Despliegue | El CEO arrastra una barra **en el contenedor**, la fecha cambia y persiste |
| 5 | Revisión ZEUS | RZ-2/SC-003 (la math pura de 015 intacta) y RZ-5 (solo señala) |

## Assumptions

- El arrastre es de puntero (ratón); el táctil queda como en el Kanban.
- Las dependencias son **opcionales** y **polimórficas** (un id de item del Gantt); una
  referencia colgada no genera conflicto.
- La reprogramación en cascada está **fuera**: aquí solo se señala.

## Out of Scope

- **Reprogramación automática** en cascada al mover una tarea con dependientes.
- Dependencias que no sean fin→inicio (inicio→inicio, fin→fin).
- Arrastre táctil.
- Deshacer/rehacer.
