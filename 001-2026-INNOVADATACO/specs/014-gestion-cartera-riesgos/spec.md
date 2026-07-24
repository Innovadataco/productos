# Feature Specification: Espacio de gestión — cartera, detalle y Riesgos

**Feature Branch**: `014-gestion-cartera-riesgos` (el trabajo se commitea en la rama de pruebas
`feature/001-scaffolding`; no se abren ramas por feature — AGENTS.md)

**Created**: 2026-07-24

**Status**: **Aprobada (2026-07-24, D-073)** por ZEUS, con las decisiones de negocio cerradas
por el CEO. Ratificación por la mañana. Turno nocturno desatendido (D-060): la compuerta del
plan la sustituye `/speckit-analyze`.

**Input**: La gestión PM2 de un proyecto (entregables, cronograma, presupuesto, recursos,
lecciones) vive hoy **dentro de un modal de edición**: hay que abrir un proyecto para editarlo
y desplazarse por pestañas en una ventana pequeña. No hay una vista de **cartera** que mire
todos los proyectos a la vez, ni forma de registrar **riesgos**. Esta spec saca la gestión a un
submódulo propio, añade la cartera y la colección de Riesgos.

## Contexto: de gestionar en un modal a un espacio de gestión

Lo construido en SPEC-008 es sólido y **se reutiliza entero**: `GestionPm2` (las cinco
colecciones en pestañas), `PanelColeccion` (genérico: listar/añadir/borrar por descripción de
campos) y `PanelPresupuesto` (totales y desviación). El problema no es lo que hace, es **dónde
vive**: un modal es un mal sitio para gestionar el ciclo de vida de un proyecto.

Esta spec hace tres cosas, ninguna de ellas reescribe lo anterior:

1. **Saca `GestionPm2` del modal** a un submódulo "Gestión" con espacio de sobra.
2. **Añade una vista de cartera**: todos los proyectos con sus cifras clave de un vistazo.
3. **Añade Riesgos**, la colección PM2 que faltaba, sobre el `PanelColeccion` genérico que se
   hizo justo para esto.

### Estado verificado del código (2026-07-24)

| Pieza | Estado real |
|---|---|
| Modelos | `Proyecto`, `Entregable`, `HitoProyecto`, `PartidaProyecto`, `RecursoProyecto`, `LeccionAprendida` — **no hay `RiesgoProyecto`** |
| Rutas | `/api/projects/[id]/{entregables,hitos,partidas,recursos,lecciones}` — **no hay `riesgos`** |
| `GestionPm2.tsx` | 5 colecciones en pestañas; hoy se renderiza **dentro de `ProjectForm`** (el modal) |
| `PanelColeccion.tsx` | Genérico: recibe la descripción de campos. **Reutilizable para Riesgos tal cual** |
| Submódulos de proyectos | Solo `listado` y `fases` en `SUBMODULES.proyectos` — **no hay `gestion`** |
| `GET /api/projects` | Devuelve el arreglo de proyectos **sin agregados** |

### Decisiones de negocio (CEO, D-073)

- **Riesgo**: descripción, **probabilidad** (alta/media/baja), **impacto** (alto/medio/bajo),
  **mitigación**, **estado** (abierto/mitigado/cerrado).
- **Cartera**: cada proyecto muestra **presupuesto total**, **avance agregado**, **nº de riesgos
  abiertos** y **fase actual**.
- **Riesgos abiertos** = los que **no** están en estado `cerrado` (abierto + mitigado cuentan).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver la cartera de un vistazo (Priority: P1)

Como gestor, quiero ver todos los proyectos con sus cifras clave a la vez, para saber dónde
mirar sin abrir uno por uno.

**Why this priority**: es la vista que hoy no existe y la puerta de entrada al submódulo.

**Independent Test**: abrir Proyectos › Gestión y ver la lista de proyectos, cada uno con
presupuesto, avance, riesgos abiertos y fase.

**Acceptance Scenarios**:

1. **Given** varios proyectos con entregables, partidas y riesgos, **When** se abre la cartera,
   **Then** cada proyecto muestra su **presupuesto total**, su **avance agregado**, su **nº de
   riesgos abiertos** y su **fase actual**.
2. **Given** un proyecto sin entregables, **When** se muestra, **Then** su avance es 0 (o un
   "—" claro), no un error ni un `NaN`.
3. **Given** cero proyectos, **When** se abre la cartera, **Then** aparece un estado vacío
   informativo, no un lienzo roto.
4. **Given** el avance agregado, **When** se calcula, **Then** es el **promedio del avance de
   los entregables** del proyecto (cada entregable pesa igual: no hay peso explícito en el
   modelo).

---

### User Story 2 - Entrar al detalle y gestionar (Priority: P1)

Como gestor, quiero elegir un proyecto de la cartera y gestionar su ciclo de vida con espacio,
sin el corsé de un modal.

**Why this priority**: es el motivo de sacar la gestión del modal.

**Independent Test**: elegir un proyecto en la cartera y ver las pestañas de gestión
(entregables, cronograma, presupuesto, recursos, lecciones y riesgos) con sitio de sobra.

**Acceptance Scenarios**:

1. **Given** la cartera, **When** se elige un proyecto, **Then** se abre su **detalle** con las
   pestañas de `GestionPm2` **reutilizado** (no reescrito) fuera del modal.
2. **Given** el detalle, **When** se muestra, **Then** tiene las cinco colecciones de SPEC-008
   **más Riesgos**.
3. **Given** el detalle de un proyecto, **When** se quiere volver, **Then** hay una vuelta clara
   a la cartera.

---

### User Story 3 - Registrar y seguir riesgos (Priority: P1)

Como gestor, quiero registrar los riesgos de un proyecto con su probabilidad, impacto,
mitigación y estado, para no gestionar a ciegas.

**Independent Test**: añadir un riesgo a un proyecto y verlo en la lista; borrarlo.

**Acceptance Scenarios**:

1. **Given** un proyecto, **When** se añade un riesgo (descripción, probabilidad, impacto,
   mitigación, estado), **Then** se persiste y aparece en la lista.
2. **Given** un riesgo sin descripción, **When** se intenta crear, **Then** se rechaza con error
   legible.
3. **Given** una probabilidad o un impacto fuera de sus valores, **When** se intenta, **Then**
   se rechaza.
4. **Given** un proyecto con riesgos, **When** se elimina, **Then** sus riesgos se eliminan con
   él (CASCADE).
5. **Given** un riesgo en estado `cerrado`, **When** se cuentan los riesgos abiertos de la
   cartera, **Then** **no** cuenta; `abierto` y `mitigado` **sí**.

### Edge Cases

- ¿Y un proyecto con partidas sin ejecutar? → El presupuesto total es lo planeado; el ejecutado
  y la desviación ya los da `PanelPresupuesto` en el detalle.
- ¿Y la cartera con muchos proyectos? → Es una lista; si crece sin fin, se pagina como el resto
  (§3.3). Con el volumen actual (1 proyecto) no es urgente; se deja anotado.
- ¿El modal antiguo sigue mostrando la gestión? → **No**: se retira de ahí. Dejar dos sitios que
  gestionan lo mismo es la clase de interactividad confusa que I-011 enseñó a evitar.

## Requirements *(mandatory)*

### Restricciones (no negociables)

- **RZ-1**: **cero dependencias nuevas**.
- **RZ-2**: `GestionPm2`, `PanelColeccion` y `PanelPresupuesto` **se reutilizan**, no se
  reescriben. Riesgos va sobre `PanelColeccion` (es genérico; para esto se hizo).
- **RZ-3**: migración **aditiva**, ensayada en BD desechable con cero pérdida antes de la viva;
  la desechable se elimina (D-039).
- **RZ-4**: toda ruta nueva con `verifyAuth`, `apiError` y `auditLog` en la mutación; cero `any`
  en `src/lib` y API.
- **RZ-5**: no se toca el catálogo de fases, el Kanban, Base Oficial ni otro producto.

### Functional Requirements

- **FR-001**: MUST existir un submódulo `{ id: "gestion", title: "Gestión" }` en
  `SUBMODULES.proyectos`, **junto a** `fases`, sin sustituirlo.
- **FR-002**: la **vista de cartera** (entrada del submódulo) MUST mostrar, por proyecto,
  **presupuesto total**, **avance agregado** (promedio del avance de los entregables), **nº de
  riesgos abiertos** y **fase actual**; desde ahí MUST poder entrarse al detalle.
- **FR-003**: la **vista de detalle** MUST gestionar el proyecto con las pestañas de
  `GestionPm2` **reutilizado fuera del modal**, con las cinco colecciones de SPEC-008 **más
  Riesgos**.
- **FR-004**: MUST existir el modelo **`RiesgoProyecto`** (`descripcion`, `probabilidad`,
  `impacto`, `mitigacion`, `estado`, timestamps), FK CASCADE a `Proyecto`,
  `@@map("riesgos_proyecto")`, y la ruta `/api/projects/[id]/riesgos` (+ `[itemId]`) con
  `verifyAuth` y `auditLog`. La UI MUST reutilizar `PanelColeccion`.
- **FR-005**: "riesgos abiertos" MUST contar los de estado **distinto de `cerrado`**.
- **FR-006**: el cálculo de agregados de cartera MUST vivir en una **función pura testeada**
  (`src/lib/cartera.ts`), separada de la ruta y del render.
- **FR-007**: el modal antiguo MUST dejar de mostrar la gestión (se retira o redirige); MUST NOT
  quedar interactividad muerta (I-011).
- **FR-008**: cero dependencias nuevas; cero `any` en `src/lib` y API.

### Key Entities

- **RiesgoProyecto** (nuevo): `descripcion`, `probabilidad` (alta/media/baja), `impacto`
  (alto/medio/bajo), `mitigacion`, `estado` (abierto/mitigado/cerrado). CASCADE.
- **Agregados de cartera** (derivados, no persistidos): presupuesto total, avance agregado,
  riesgos abiertos, fase. Se calculan al leer.

## Success Criteria *(mandatory)*

- **SC-001**: migración **aditiva**, ensayada en BD desechable (cero pérdida verificada, conteo
  antes/después) antes de la viva; la desechable se elimina.
- **SC-002**: la cartera calcula agregados **correctos** con datos sembrados de prueba, y con
  **0 proyectos no rompe** (probado en la función pura).
- **SC-003**: el modal antiguo **ya no** muestra la gestión; no queda interactividad muerta.
- **SC-004**: la suite pasa y **no baja de 525**, con test de la ruta `riesgos` (401, 404, 400,
  crear, aislamiento entre proyectos) y del cálculo de agregados. `eslint src` en 0; `src/lib` y
  API sin `any`.
- **SC-005**: los dos tableros y el resto del módulo siguen funcionando (regresión).

## Definición de terminado

| # | Regla de Oro | Cómo se acredita |
|---|---|---|
| 1 | Spec Kit aplicado | `specs/014-gestion-cartera-riesgos/` con spec, plan, research, quickstart, tasks, checklist |
| 2 | Código a la rama de pruebas | Commits scopeados a `001-`, push en el mismo acto |
| 3 | Pruebas escritas y pasando | SC-004 |
| 4 | Despliegue accesible y probable | El CEO abre Proyectos › Gestión **en el contenedor**, ve la cartera, entra al detalle, crea un riesgo |
| 5 | Revisión de arquitectura de ZEUS | RZ-2 (reutiliza, no reescribe) y SC-001 (migración sin pérdida) |

## Assumptions

- **Avance agregado = promedio simple del avance de los entregables.** El modelo `Entregable` no
  tiene campo de peso, así que "ponderado por entregable" se interpreta como cada entregable
  pesando igual. Si el negocio quisiera pesos (por esfuerzo, por presupuesto), es un campo nuevo
  y otra spec; se deja anotado, no se inventa.
- **Presupuesto total = total planeado.** El ejecutado y la desviación ya los muestra
  `PanelPresupuesto` en el detalle; la cartera enseña la cifra de referencia.
- La cartera se sirve con un endpoint propio (`GET /api/projects/cartera`) para no cargar de
  agregados el listado plano que consumen el tablero de fases y la página de proyectos.

## Out of Scope

- **Gantt**: es SPEC-015 (lectura) y SPEC-016 (arrastre).
- Reprogramación o dependencias entre riesgos.
- Pesos por entregable para el avance agregado.
- Paginar la cartera (se anota; con 1 proyecto no es urgente).
- Reescribir `GestionPm2`/`PanelColeccion`/`PanelPresupuesto`: se **reutilizan**.
