# Feature Specification: Rediseño visual del tablero Kanban

**Feature Branch**: `012-rediseno-tablero` (el trabajo se commitea en la rama de pruebas
`feature/001-scaffolding`; no se abren ramas por feature — AGENTS.md)

**Created**: 2026-07-24

**Status**: **Aprobada con gate provisional de ZEUS (2026-07-24, D-069)** — riesgo bajo,
reversible, un solo componente, sin datos ni comportamiento. **Ratificación del CEO pendiente
por la mañana.**

**Input**: Petición literal del CEO sobre la app desplegada: *"este diseño está horrible, más
transiciones, más moderno"*. Se redacta sin `/speckit-clarify` (el CEO descansa); las
ambigüedades las cierra ZEUS en el radicado 001-IDC-014.

## Contexto: la piel, no los huesos

El tablero funciona. Desde SPEC-007 muestra las columnas del catálogo, mueve tarjetas y
persiste el cambio con auditoría; desde el arreglo de **I-014** cabe en pantalla. Lo que no
hace es **verse bien**, y eso no es un capricho: es la pantalla operativa donde el analista
mira el estado de todo lo que tiene entre manos.

Esta spec es **estrictamente visual**. La frontera con SPEC-007 es dura y conviene decirla de
entrada: allí están los huesos —qué columnas hay, qué pasa al soltar una tarjeta, qué se
persiste—; aquí solo la piel. Si al terminar hubiera cambiado un dato, una ruta o una regla,
esta spec habría fallado, por bonito que quedara.

### Estado verificado del componente (2026-07-24, tras I-014)

| Pieza | Estado real |
|---|---|
| Tarjeta | Referencia, título y etiqueta, los tres casi con el mismo peso visual |
| Columna vacía | Texto plano "SIN TARJETAS" centrado |
| Cabecera de columna | El color del estado ocupa un bloque sólido, compitiendo con el contenido |
| Arrastre | Funciona; el único aviso visual es que la tarjeta en vuelo baja de opacidad |
| Soltar | La tarjeta aparece en su columna sin transición: salta |
| Densidad | Espaciado uniforme; bajo el tablero queda una franja de aire sin uso |
| Dependencias | Cero librerías de animación. HTML5 nativo para el arrastre |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La tarjeta se lee de un vistazo (Priority: P1)

Como analista, quiero distinguir de un golpe de vista qué es cada tarjeta, para no tener que
leerla entera para identificarla.

**Why this priority**: es lo que el usuario mira el 90 % del tiempo. Si la tarjeta no se lee,
el tablero no sirve por muchas transiciones que tenga.

**Independent Test**: mirar una columna con varias tarjetas y poder decir cuál es cuál sin
detenerse a leer.

**Acceptance Scenarios**:

1. **Given** una tarjeta con referencia, título y tipo, **When** se muestra, **Then** los tres
   tienen **jerarquía distinta**: el título manda, la referencia acompaña y el tipo es
   secundario.
2. **Given** un título largo, **When** se muestra, **Then** no rompe la tarjeta ni empuja la
   columna.
3. **Given** una tarjeta sin número o sin tipo, **When** se muestra, **Then** no queda un hueco
   sospechoso: la tarjeta se ve completa igual.

---

### User Story 2 - El movimiento se ve (Priority: P1)

Como analista, quiero que arrastrar y soltar tenga respuesta visual, para saber qué está
pasando sin adivinarlo.

**Why this priority**: es la petición explícita del CEO ("más transiciones") y lo que hace que
un tablero se sienta vivo en vez de estático.

**Independent Test**: arrastrar una tarjeta despacio y ver que el tablero acompaña el gesto en
todo momento.

**Acceptance Scenarios**:

1. **Given** una tarjeta que se empieza a arrastrar, **When** se levanta, **Then** cambia de
   aspecto de forma perceptible (se eleva), no solo se atenúa.
2. **Given** una tarjeta sobre una columna, **When** la sobrevuela, **Then** **esa columna**
   responde y se distingue de las demás.
3. **Given** una tarjeta soltada en otra columna, **When** aparece en su destino, **Then**
   **entra con transición**, no de golpe.
4. **Given** una tarjeta cuyo movimiento se está guardando, **When** está en vuelo, **Then** se
   ve que está ocurriendo algo y **no** parece que se pueda volver a arrastrar.
5. **Given** cualquier transición, **When** ocurre, **Then** es breve: acompaña el gesto, no lo
   hace esperar.

---

### User Story 3 - Una columna vacía dice algo (Priority: P2)

Como analista, quiero que una columna sin tarjetas se vea deliberada, para no confundirla con
algo que no cargó.

**Acceptance Scenarios**:

1. **Given** una columna sin tarjetas, **When** se muestra, **Then** su vacío está **compuesto**
   (no un texto plano suelto) y se entiende que está vacía a propósito.
2. **Given** una columna vacía, **When** se arrastra una tarjeta encima, **Then** responde igual
   que una con contenido: es una zona de destino válida.

---

### User Story 4 - El tablero respira (Priority: P2)

Como analista, quiero que el tablero aproveche el espacio con criterio, para que no se vea ni
apretado ni desangelado.

**Acceptance Scenarios**:

1. **Given** el tablero completo, **When** se muestra, **Then** el aire entre columnas y dentro
   de las tarjetas es coherente, no arbitrario.
2. **Given** columnas con muy distinto número de tarjetas, **When** se muestran, **Then** el
   conjunto no queda descuadrado.
3. **Given** el pie del tablero, **When** se mira, **Then** no hay una franja muerta sin función.

---

### User Story 5 - La cabecera acentúa, no grita (Priority: P2)

Como analista, quiero que el color del estado me oriente sin robarme la atención del contenido.

**Acceptance Scenarios**:

1. **Given** la cabecera de una columna, **When** se muestra, **Then** el color del estado
   funciona como **acento** y no como bloque plano dominante.
2. **Given** un estado nuevo del catálogo sin color asignado, **When** se muestra, **Then** su
   cabecera se ve igual de acabada, con el acento neutro (RZ-2 de SPEC-007 intacta).
3. **Given** la cuenta de tarjetas de la columna, **When** se muestra, **Then** se lee sin
   competir con el nombre del estado.

### Edge Cases

- ¿Y con muchas tarjetas en una columna? → La columna se desplaza por dentro; el tablero no
  crece sin fin.
- ¿Y si el usuario tiene el movimiento reducido activado en su sistema? → Las transiciones
  deben poder no ejecutarse. Animar a quien pidió que no se anime es un defecto de
  accesibilidad, no una floritura.
- ¿Y en el tablero de fases (SPEC-008)? → Hereda **todo** sin tocar su adaptador: el componente
  es el mismo. Si hiciera falta cambiar el adaptador, el rediseño estaría mal hecho.
- ¿Y si el rediseño no gusta? → Es reversible: un solo componente, sin datos ni contratos.

## Requirements *(mandatory)*

### Restricciones (no negociables)

- **RZ-1**: **cero dependencias nuevas**. Ni librerías de animación, ni de UI, ni de iconos
  adicionales.
- **RZ-2**: **es piel, no huesos**. Ni datos, ni rutas, ni contratos, ni comportamiento.
- **RZ-3**: la condición de diseño de SPEC-007 sigue intacta: `KanbanBoard` **no** importa
  dominio, y los **dos** tableros (oportunidades y fases) heredan el rediseño sin tocar sus
  adaptadores.
- **RZ-4**: no se toca el sistema de diseño global ni ninguna otra pantalla.
- **RZ-5**: I-014 no se reabre: el tablero sigue cabiendo a 1280, 1440 y 1920.

### Functional Requirements

- **FR-001**: la tarjeta MUST presentar **jerarquía visual** entre referencia, título y tipo;
  MUST NOT darles el mismo peso.
- **FR-002**: MUST haber respuesta visual al **arrastrar**, al **sobrevolar** una columna y al
  **soltar**; la tarjeta que se persiste MUST verse como tal.
- **FR-003**: la columna vacía MUST tener un estado vacío **compuesto**, y MUST seguir siendo
  zona de destino válida.
- **FR-004**: el espaciado MUST ser coherente entre columnas y dentro de la tarjeta; MUST NOT
  quedar franja muerta bajo el tablero.
- **FR-005**: el color del estado MUST usarse como **acento** en la cabecera, no como bloque
  plano; un estado sin color MUST verse igual de acabado.
- **FR-006**: las transiciones MUST respetar `prefers-reduced-motion`.
- **FR-007**: una columna con muchas tarjetas MUST desplazarse por dentro sin estirar el tablero.
- **FR-008**: `package.json` MUST NOT ganar ninguna dependencia.
- **FR-009**: ninguna ruta API, modelo o contrato MUST cambiar.

## Success Criteria *(mandatory)*

- **SC-001**: `git diff` de esta spec **no toca** `package.json` ni `package-lock.json`.
- **SC-002**: `git diff` de esta spec **no toca** `src/app/api/`, `prisma/` ni ningún
  `src/lib/tablero*.ts` (los adaptadores): **es piel, no huesos**.
- **SC-003**: la suite pasa y **no baja** de la línea base (506); `tsc` limpio; `eslint src`
  en 0.
- **SC-004**: `KanbanBoard.tsx` sigue importando solo React y `@/lib/kanban` (RZ-3).
- **SC-005**: los **dos** tableros se ven rediseñados **sin** que sus adaptadores cambien.
- **SC-006**: `scripts/verify-tableros.mjs` sigue en verde: 5/5 y 4/4 columnas a 1280, 1440 y
  1920 sin desplazamiento horizontal (RZ-5, I-014 no se reabre).
- **SC-007**: con `prefers-reduced-motion: reduce`, el tablero **no anima**.

## Definición de terminado

| # | Regla de Oro | Cómo se acredita |
|---|---|---|
| 1 | Spec Kit aplicado | `specs/012-rediseno-tablero/` con spec, plan, tasks y checklist |
| 2 | Código a la rama de pruebas | Commits scopeados a `001-2026-INNOVADATACO/`, push en el mismo acto |
| 3 | Pruebas escritas y pasando | SC-003 y SC-006 (el verificador de tableros, en el contenedor) |
| 4 | Despliegue accesible y probable | El CEO abre los dos tableros **en el contenedor** y los ve |
| 5 | Revisión de arquitectura de ZEUS | SC-001, SC-002 y SC-004: que sea piel y no huesos es comprobable con `git diff` |

## Assumptions

- El juicio estético lo cierra ZEUS (D-069) y lo ratifica el CEO por la mañana. Esta spec fija
  **qué debe ocurrir**, no un tono de gris concreto.
- El vocabulario visual del producto ya existe (`glass-panel`, `neonCyan`, tipografía en
  mayúsculas con seguimiento amplio): el rediseño **se apoya en él**, no lo sustituye.
- Tailwind basta para todo lo que pide esta spec.

## Out of Scope

- **Sistema de diseño global** y cualquier **otra pantalla**: solo el tablero.
- Librerías de animación o de UI.
- Reordenar tarjetas dentro de la columna, filtros o búsqueda en el tablero (son huesos).
- Cambiar qué se muestra en la tarjeta: se cambia **cómo** se muestra lo que ya hay.
- Accesibilidad del arrastre por teclado: sigue abierta desde SPEC-007 (research D1) y no se
  cierra aquí.

> **Si dudas de si algo entra: no entra.** Es la instrucción literal de ZEUS y aquí se aplica
> como criterio de corte.
