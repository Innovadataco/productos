# SPEC-771 · La rejilla no puede esconder una cita que el sistema permite crear

**Status**: DESARROLLO

**Origen:** Calidad caminando la pantalla (HALLAZGO-CITA-INVISIBLE). `RejillaCalendario` (SPEC-730) clava un riel de horas **fijo** (`H0=7`..`H1=21`) y **no filtra**: una cita fuera de ese rango se **posiciona fuera del área visible** — está en el DOM y **no se ve**. `POST /api/profesional/franjas` **no valida la hora**. Medido en prod: 1646 franjas, **1223 fuera de la ventana**, 997 con cita, **42 `CONFIRMADA` invisibles**. **Carril:** Dev 1 · Diseño (forma) · Calidad. **Radicado:** `RADICADO-SPEC-771` · forma `FORMA-SPEC771-VENTANA-ADAPTATIVA-REJILLA` (Diseño, v1.0). **Base:** `main`.

> **Compuerta §4 (DISEÑO):** este `spec.md` + `plan.md` PARAN acá — el CEO aprueba el diseño **antes** de `tasks.md` + implementación (orden del radicado). Ver «Decisiones para la compuerta §4».

## Lo medido (código, verificado en `origin/main`)

- **Geometría fija:** `estiloBloque(minInicio, minFin)` (en `calendario/fechas.ts`) calcula `top = (minInicio/60 − H0)·PXH` **relativo a `H0=7`**. Una cita a las **6am** → `top` NEGATIVO (arriba del riel); una a las **21:30** → `top` más allá de `altura = (H1−H0)·PXH`. En ambos casos **renderiza fuera del área visible**. `PXH=44` px/hora es la ESCALA.
- **Componente compartido:** `RejillaCalendario` (`calendario/Rejilla.tsx`) pinta el riel con `Array.from({length: H1−H0})` (etiquetas y filas) y `altura` fijos. Lo consumen **cuatro** superficies vía `estiloBloque` / `renderBloque`:
  - `padre/citas/RejillaMisCitas.tsx` (padre ve sus citas) — **nombrada en el radicado**.
  - `profesional/CalendarioProfesional.tsx` (profesional publica/responde) — **nombrada**. Renderiza con `RejillaCalendario` **pero** además usa `H0`/`H1` DIRECTO para el gesto de arrastrar-para-crear (mapeo puntero→minutos, popover de creación, `altura` del overlay) y una **compuerta de creación** `if (a < H0·60 || b > H1·60) return`.
  - `padre/citas/RejillaElegirFranja.tsx` (padre elige franja para reservar) — **NO nombrada, pero comparte el mismo componente**: hoy un padre **tampoco vería** una franja de 6am para elegirla. Hallazgo: la corrección del componente la cubre; el candado debe incluirla.
  - `profesional/calendario/Rejilla.tsx` (`BloqueFranja` + `OverlayDiaProfesional`): usa `estiloBloque` y `H0` (posición del muro de vigencia).
- **Por qué sobrevivió:** el profesional **tampoco ve** sus propias franjas fuera de ventana (ni al publicar ni en su agenda). Quien podría notarlo no puede verlo. Un arreglo solo del lado del padre deja la mitad.

## El arreglo — riel ADAPTATIVO (forma de Diseño, no se inventa)

La ventana del riel se ajusta a las horas **con contenido** del período visible (día/semana); **NO se acota la creación** a un horario (eso escondería citas legítimas y es política de producto — FUERA). Reglas de `FORMA-SPEC771 §1-§2`:

1. **Ventana desde el contenido:** `railInicioMin` = hora más temprana entre las citas/franjas del período, redondeada **hacia abajo** a frontera legible (hora/media) **− margen** (~30 min); `railFinMin` = fin de la última, redondeada **hacia arriba + margen**.
2. **Escala CONSISTENTE:** `PXH` (px/min) **no cambia** — un bloque de 45 min se ve **igual de alto** en cualquier ventana; lo que cambia es cuántas horas muestra el riel, no el tamaño de los bloques. (La rejilla no «salta» de escala entre períodos.)
3. **Span MÍNIMO (legibilidad):** contenido chico (una cita de 45 min) → el riel **no** se encoge a un sliver; se expande a un mínimo sensato (~4–6 h) centrado en el contenido. El mínimo **solo expande, jamás recorta** contenido.
4. **Período VACÍO:** rango por defecto legible (ver Decisión D-2 para el valor por superficie), no un riel colapsado.
5. **Outlier lejano** (una 6am + resto 2–5pm): el riel muestra **6am–5pm completo** (la de 6am **se ve**); el hueco vacío es el costo aceptable en v1 (el «tramo colapsado ⌄» es mejora futura, no v1).
6. **No cambia** el lenguaje de estado de SPEC-730 (cielo/ámbar/pino/tinta + ícono, cero rubí) ni el mínimo de 28px por bloque — **solo el rango vertical** del riel.

**Fuente única de la geometría:** un helper PURO `ventanaAdaptativa(bloques): { inicioMin, finMin }` en `fechas.ts` (testeable sin render), y `estiloBloque(minInicio, minFin, railInicioMin)` pasa a posicionar **relativo a `railInicioMin`**. `RejillaCalendario` computa la ventana una vez desde los bloques del período y la propaga (a `renderBloque`, al ghost, a las etiquetas y a `altura`). Una sola frontera, un solo dueño.

## Requisitos funcionales (FR)

- **FR-1:** el riel de `RejillaCalendario` deriva `[railInicioMin, railFinMin]` del contenido del período visible (`ventanaAdaptativa`), con `PXH` constante. **Ninguna cita/franja del período queda fuera del área visible** (`0 ≤ top` y `top+height ≤ altura`).
- **FR-2:** las **cuatro** superficies que comparten `RejillaCalendario` heredan la ventana adaptativa (padre mis-citas, padre elegir-franja, profesional agenda, y el overlay/muro del profesional). El candado corre sobre las superficies del padre **y** del profesional (mismo componente).
- **FR-3:** `estiloBloque` posiciona relativo a `railInicioMin` (no a `H0`). Todos sus llamadores (4) pasan la nueva base. El ghost de arrastre y el `muroTop` del profesional usan la misma base.
- **FR-4 (span mínimo / vacío):** contenido chico → riel ≥ mínimo legible centrado (nunca sliver, nunca recorte); período sin contenido → rango por defecto legible (D-2).
- **FR-5 (geometría de creación del profesional):** el mapeo puntero→minutos y el popover de creación usan `railInicioMin` (si no, el arrastre se desalinea con el riel adaptativo). La **compuerta de creación** (`a<H0·60 || b>H1·60`) es **política de creación** — FUERA de esta spec (ver D-1).

## Criterios de éxito (SC)

- **SC-1:** con una cita sembrada a las **5am** y otra a las **21:00**, en **ambas** superficies (padre y profesional), las dos **caen dentro del área visible** (no solo «en el DOM»). Hoy: invisibles.
- **SC-2:** un bloque de la misma duración mide **igual** en dos períodos con ventanas distintas (escala consistente).
- **SC-3:** una sola cita corta **no** deja un riel sliver; período vacío → rango por defecto legible.
- **SC-4:** en **ningún** caso se recorta contenido (el mínimo solo expande).
- **SC-5:** cero palabra/forma visible nueva (solo cambia el rango vertical); el estado SPEC-730 y el mínimo 28px intactos.

## Escenarios de aceptación (candado — control positivo por MUTACIÓN, y PLANTANDO los bordes)

> **SPEC-773 ya normalizó los sembradores** → ninguna franja sembrada cae fuera de 7am–8pm. El candado **PLANTA** sus casos de borde (no los busca en la base — no están; un candado que no encuentra el caso pasa en vacío). Los casos se construyen como props (sin BD).

- **A-1 (borde bajo · las dos superficies):** cita a las **5am** → en `RejillaMisCitas` **y** en `CalendarioProfesional`, su bloque tiene `top ≥ 0` y `top+height ≤ altura`. **Mutación:** con el riel fijo (`H0=7`) el `top` es negativo → ROJO. (Afirma «dentro del área visible», NO «existe en el DOM».)
- **A-2 (borde alto):** cita a las **21:00** → `top+height ≤ altura` en ambas. Mutación: riel fijo la deja debajo → ROJO.
- **A-3 (no se estira sin motivo):** todas las citas dentro de 7am–8pm → la ventana **no** se expande más allá del contenido+margen (control del otro lado).
- **A-4 (escala consistente):** bloque de 45 min en dos períodos con ventanas distintas → **misma** `height`.
- **A-5 (span mínimo / vacío):** una sola cita de 45 min → riel ≥ mínimo (no sliver); período vacío → rango por defecto legible.
- **A-6 (ventanaAdaptativa pura):** unit del helper — bordes, margen, redondeo, mínimo, vacío, outlier — sin render.

## Impacto en arquitectura

**Impacto en arquitectura:** cambia SOLO la geometría del riel compartido (`calendario/fechas.ts` + `calendario/Rejilla.tsx`) de un rango FIJO a uno DERIVADO del contenido, con `PXH` constante; `estiloBloque` gana el parámetro `railInicioMin` y sus 4 llamadores lo propagan. Sin esquema, sin ruta nueva, sin cambio de datos ni de estado (SPEC-730 intacto), sin tocar la política de creación de franjas. Es defensa contra un riel que esconde lo que el sistema permite crear: la verdad temporal de una cita deja de depender de un rango cableado. Una sola fuente de ventana (`ventanaAdaptativa`) para las cuatro superficies.

## Decisiones para la compuerta §4 (el CEO aprueba)

- **D-1 · La compuerta de creación (`H0/H1`) se QUEDA (FUERA de scope).** El riel adaptativo muestra lo que exista; qué horas se pueden PUBLICAR es otra decisión (FORMA §3, gate del endpoint). El profesional podrá VER una franja de 6am pero seguir creando solo dentro de la banda actual. **Recomendado: sí, dejar el guard; solo threadear `railInicioMin` en el mapeo puntero→min para que el arrastre no se desalinee.** ¿Confirmás?
- **D-2 · Default de período VACÍO, por superficie.** Padre (ve): rango legible ~8am–6pm (FORMA §2). Profesional (crea): ¿default = banda creable **7am–9pm** (para poder arrastrar en toda ella), o el mismo ~8am–6pm? **Recomendado: profesional vacío → 7am–9pm (su banda de creación); padre → 8am–6pm.** ¿Cuál preferís?
- **D-3 · `RejillaElegirFranja` (3ª superficie, no nombrada).** La corrección del componente compartido la cubre y **debe** cubrirla (un padre no puede elegir lo que no ve). **Recomendado: incluirla en FR-2 y en el candado.** ¿De acuerdo?
- **D-4 · «No reconciliar».** Si al adaptar la ventana el layout test existente (`calendario-padre.candado.test.tsx`) se pone rojo, es **hallazgo** — se reporta, no se «arregla» en silencio.

## Fuera

Acotar la creación de franjas a un horario · borrar/mover franjas de producción (**el arreglo es de la pantalla, no del dato**) · la cita `CONFIRMADA`-pasada en verde (**749 FR-2**, defecto distinto de la misma pantalla) · el sembrador demo que crea franjas a las 2am (Datos, aparte) · el «tramo colapsado ⌄» del outlier (mejora futura, no v1) · validar la hora en `POST /api/profesional/franjas` (política de creación, D-1).
