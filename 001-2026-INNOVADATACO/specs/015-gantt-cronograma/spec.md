# Feature Specification: Gantt del cronograma (solo lectura)

**Feature Branch**: `015-gantt-cronograma` (rama de pruebas `feature/001-scaffolding`)

**Created**: 2026-07-24

**Status**: **Aprobada (2026-07-24, D-073)** por ZEUS. Turno nocturno desatendido (D-060):
`/speckit-analyze` sustituye la compuerta del plan. Ratificación por la mañana.

**Input**: El cronograma de un proyecto se gestiona hoy como una lista de hitos (SPEC-008) y de
entregables con fecha de compromiso (SPEC-008). Falta la vista que hace útil un cronograma: un
**Gantt** que dibuje esas fechas en el tiempo. Esta spec añade el Gantt **de solo lectura**; el
arrastre es SPEC-016.

## Contexto: fechas que ya existen, dibujadas en el tiempo

El módulo Proyectos ya tiene los datos: entregables con `fechaCompromiso` y su `avance`, hitos
con `fecha` y `fechaFin` opcional. Lo que no hay es una forma de **verlos en una línea de
tiempo**. Una lista dice "el entregable X vence el 30 de septiembre"; un Gantt dice, de un
vistazo, qué se solapa, qué está cerca y qué ya debería haber empezado.

Esta spec dibuja lo que hay, sin arrastre todavía, y —clave para SPEC-016— pone **la matemática
de posición en una función pura testeada**, separada del render, para que el arrastre se monte
encima sin tocar el cálculo.

### Estado verificado del código (2026-07-24)

| Pieza | Estado real |
|---|---|
| `HitoProyecto` | `fecha` (obligatoria), `fechaFin` (opcional) — un hito puntual o un periodo |
| `Entregable` | `fechaCompromiso` (opcional), `avance` (0-100) — pero **sin fecha de inicio** |
| Gantt | **no existe** |

### Decisión de datos: el entregable gana `fechaInicio`

Un Gantt necesita, por barra, un inicio y un fin. El hito ya los tiene (`fecha`/`fechaFin`).
El **entregable no tiene inicio**: solo `fechaCompromiso`. Se añade `fechaInicio` (opcional) al
entregable:

- La barra del entregable va de **`fechaInicio` a `fechaCompromiso`**, con el `avance` pintado
  dentro.
- Para los entregables **ya existentes** sin `fechaInicio`, la barra arranca en su `createdAt`
  (la fecha en que se registró): así ninguno desaparece del Gantt y no hace falta backfill.
- Es una migración **aditiva** (columna nullable). Y deja a SPEC-016 un inicio **persistible**
  que arrastrar, en vez de un `createdAt` de sistema que no se debe mover.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el cronograma como Gantt (Priority: P1)

Como gestor, quiero ver los entregables y los hitos de un proyecto en una línea de tiempo, para
entender de un vistazo cómo se distribuyen.

**Independent Test**: abrir el Gantt de un proyecto con entregables y hitos, y ver una barra por
entregable (con su avance) y un rombo por hito, cada uno en su fecha.

**Acceptance Scenarios**:

1. **Given** un proyecto con entregables con fechas, **When** se abre el Gantt, **Then** cada
   entregable es una **barra** de su inicio a su fecha de compromiso, con el **% de avance**
   pintado dentro.
2. **Given** un proyecto con hitos, **When** se abre, **Then** cada hito es un **rombo** en su
   fecha; si tiene `fechaFin`, se dibuja como un **rango**.
3. **Given** las barras y los rombos, **When** se muestran, **Then** caen en las fechas
   correctas respecto a la escala del tiempo.

---

### User Story 2 - Elegir la escala del tiempo (Priority: P1)

Como gestor, quiero conmutar la escala entre día, semana y mes, para mirar de cerca o de lejos.

**Acceptance Scenarios**:

1. **Given** el Gantt, **When** se elige día / semana / mes, **Then** la cabecera muestra las
   fechas de esa escala y las barras se reposicionan en consecuencia.
2. **Given** cualquier escala, **When** se muestra, **Then** las barras siguen cayendo en sus
   fechas reales (la escala cambia el zoom, no los datos).

---

### User Story 3 - Saber dónde está HOY (Priority: P1)

Como gestor, quiero una línea de "hoy" siempre visible, para situar de un golpe qué va tarde y
qué está por venir.

**Acceptance Scenarios**:

1. **Given** el Gantt, **When** se muestra, **Then** hay una **línea vertical de HOY**,
   etiquetada, en su posición correcta.
2. **Given** que hoy cae fuera del rango dibujado, **When** ocurre, **Then** la línea no se
   pinta fuera del lienzo (se omite o se ancla al borde, definido por el plan).

### Edge Cases

- ¿Un proyecto sin fechas? → Estado vacío claro ("sin cronograma que dibujar"), no un lienzo
  roto (SC-002).
- ¿Un hito sin `fechaFin`? → Rombo puntual, no una barra de ancho cero.
- ¿Un entregable sin `fechaCompromiso`? → No se puede situar en el tiempo; se excluye del Gantt
  y se avisa (queda en la lista del cronograma, que sí lo muestra).
- ¿Todas las fechas el mismo día? → El rango no puede ser de ancho cero; el plan fija un mínimo.

## Requirements *(mandatory)*

### Restricciones (no negociables)

- **RZ-1**: **cero dependencias nuevas** en `package.json`. SVG/CSS propio, mismo criterio que
  el Kanban (arrastre nativo, cero libs). Si parece necesaria una librería: **detenerse y dejar
  nota**, no instalarla.
- **RZ-2**: la **matemática de posición/escala** vive en una **función pura testeada**
  (`src/lib/gantt.ts`), separada del render, para que SPEC-016 monte el arrastre encima sin
  tocarla.
- **RZ-3**: migración de `fechaInicio` **aditiva**, ensayada en BD desechable, cero pérdida.
- **RZ-4**: sin arrastre (es SPEC-016); solo lectura.
- **RZ-5**: no se toca el Kanban, Base Oficial ni otro producto.

### Functional Requirements

- **FR-001**: MUST existir un componente `GanttProyecto` que dibuje, por proyecto, una **barra
  por entregable** (de su inicio a `fechaCompromiso`, con el `avance` pintado dentro) y un
  **rombo por hito** (`fecha`, con rango si hay `fechaFin`).
- **FR-002**: la **escala** MUST ser conmutable **día / semana / mes**, con la cabecera de
  fechas correspondiente.
- **FR-003**: MUST haber una **línea vertical de HOY**, siempre visible cuando hoy cae en el
  rango, y etiquetada.
- **FR-004**: **cero dependencias nuevas**; SVG/CSS propio.
- **FR-005**: el Gantt MUST ser accesible desde el detalle del proyecto (submódulo Gestión) como
  una vista más.
- **FR-006**: el entregable MUST ganar `fechaInicio` (opcional); la barra va de
  `fechaInicio ?? createdAt` a `fechaCompromiso`.

### Key Entities

- **ItemGantt** (derivado, en la función pura): `{ id, tipo: barra|hito, inicio, fin, avance?,
  label }`. El adaptador traduce entregables e hitos a esto; la matemática no conoce el dominio.

## Success Criteria *(mandatory)*

- **SC-001**: con hitos y entregables sembrados, las barras caen en las fechas correctas a las
  **tres escalas**, y la línea de HOY en su sitio (verificado sobre la **función pura**).
- **SC-002**: un proyecto sin fechas muestra un **estado vacío** claro, no un lienzo roto.
- **SC-003**: la **lógica de posición/escala** está en `src/lib/gantt.ts` con test, separada del
  render — de modo que SPEC-016 construya el arrastre encima sin tocar la matemática.
- **SC-004**: la suite pasa y **no baja de 564**; `tsc` limpio; `eslint src` en 0; **0
  dependencias nuevas**.
- **SC-005**: migración de `fechaInicio` aditiva, ensayada, sin pérdida.

## Definición de terminado

| # | Regla de Oro | Cómo se acredita |
|---|---|---|
| 1 | Spec Kit | `specs/015-gantt-cronograma/` con spec, plan, research, quickstart, tasks, checklist |
| 2 | GitHub | Commit+push scopeado a `001-` |
| 3 | Pruebas | SC-001, SC-003 (función pura) |
| 4 | Despliegue | El CEO abre el Gantt de un proyecto **en el contenedor**, ve barras/hitos/avance/HOY a las 3 escalas |
| 5 | Revisión ZEUS | RZ-2 (matemática pura) y SC-005 (migración) |

## Assumptions

- El Gantt es de solo lectura; el arrastre es SPEC-016, que se apoya en la misma función pura.
- `fechaInicio` del entregable es opcional; los existentes usan `createdAt` como inicio.
- "Hoy" entra como parámetro a la función pura (determinista para los tests); el componente pasa
  la fecha real.

## Out of Scope

- **Arrastre / edición** de fechas: es SPEC-016.
- Dependencias entre tareas: SPEC-016 las señala; ninguna reprogramación automática.
- Exportar el Gantt (PDF/imagen).
- Zoom continuo: solo las tres escalas fijas.
