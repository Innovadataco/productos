# Feature Specification: SPEC-157 — Sistema de diseño de Protección Infantil: tokens, tipografía y primitivos

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-03

**Status**: PLANEADO

**Input**: Instructivo 002-PI-058 (SPEC-157, va primera y bloquea a las demás; radica
ZEUS). Fuente VINCULANTE: BRIEF-DISEÑO-UX-RECTOR v3.0 §4 (sistema de diseño de
Protección Infantil, aprobado por el CEO 2026-08-03 sobre maqueta navegable): §4.0
tres principios · §4.1 tipografía Instrument · §4.2 paleta con nombre · §4.3 anillos ·
§4.4 íconos/gráficos · §4.5 movimiento "barrido" · §4.6 vidrio · §4.7 espaciado. Este
spec NO repite esos valores: los enlaza. Verificado en fuente 2026-08-03: la capa
semántica actual (`src/app/globals.css`, 197 líneas) sostiene `glass` (109 usos),
`text-body` (457), `text-muted` (375), `text-subtle` (165) y el override
`theme-colegio`; los colores `primary`/`accent` de `tailwind.config.ts` están
semimuertos (9 usos de `primary-*`/`accent-*` fuera de las clases semánticas);
Inter se carga hoy vía `next/font/google` en `src/app/layout.tsx` (única referencia a
`--font-inter`: el config) y el repo no tiene fuentes locales; los colores crudos de
Tailwind suman ~1.119 ocurrencias en ~104 archivos (medición propia por patrón
`text|bg|border|ring|from|to|via-<color>-<escala>`). Lo que NO existe: tokens reales,
tipografía propia y los primitivos del sistema.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Tokens reales y capa semántica reescrita sin romper un solo uso (Priority: P1)

Como equipo de producto, quiero que el color, la tipografía, los radios, las sombras,
el espaciado y el movimiento vivan en variables CSS reales para los dos temas, y que
la capa semántica existente (`glass`, `text-body`, `text-muted`, `text-subtle`,
`text-accent`, `bg-page`, `ring-accent*`, `text-gradient`, `accent-gradient`,
`theme-colegio`) se REESCRIBA sobre esos tokens, de modo que cambiar la identidad
visual cueste editar un archivo y no ~130.

**Why this priority**: Es la fundación: sin tokens no hay tipografía propia ni
primitivos, y las 15 specs siguientes pintarían sobre arena movediza. La restricción
dura es la compatibilidad: los 1.165+ usos actuales no pueden romperse.

**Independent Test**: el build compila sin tocar ninguna pantalla; los conteos de usos
de las clases semánticas quedan idénticos; los dos temas renderizan el mismo HTML con
valores de token distintos; el contraste de los pares texto/fondo derivados de tokens
cumple WCAG AA (≥ 4.5:1).

**Acceptance Scenarios**:

1. **Given** el sistema instalado, **When** se inspecciona `globals.css`, **Then**
   `:root` y `.dark` definen las variables de color con nombre (`--pino`, `--cielo`,
   `--ambar`, `--rubi`, `--papel`, `--tinta` — valores §4.2 del brief), tipografía,
   radios, sombras, espaciado y la curva de movimiento única, y cada clase semántica
   existente se define en términos de esas variables (no de valores crudos).
2. **Given** cualquier pantalla actual, **When** se compila y se renderiza,
   **Then** sus clases (`glass`, `text-body`, …) resuelven a través de tokens sin
   cambiar de nombre ni de contrato — cero archivos de pantalla modificados por esta
   historia.
3. **Given** el tema claro y el oscuro, **When** se alterna (ThemeProvider ya respeta
   `prefers-color-scheme` y permite cambiar), **Then** es el MISMO HTML con distintos
   valores de token: no existe ninguna pantalla duplicada por tema.
4. **Given** los 9 usos de `primary-*`/`accent-*` del config actual, **When** el
   config pasa a tokens, **Then** esas clases siguen resolviendo (mapeadas al token
   correspondiente) o se migran en el mismo PR — nunca quedan muertas.

---

### User Story 2 — Tipografía Instrument auto-alojada (Priority: P1)

Como plataforma, quiero servir Instrument Serif (la voz) e Instrument Sans (la
interfaz) desde el propio repositorio con `next/font/local`, eliminando Inter, de
modo que la identidad tipográfica sea la del brief §4.1 sin llamadas a Google en
tiempo de ejecución (BL-1).

**Why this priority**: "Prohibido Inter" es candado explícito y la tipografía es la
mitad de la identidad; bloquea a toda pantalla nueva.

**Independent Test**: el HTML servido referencia únicamente fuentes auto-alojadas
(`/_next/static/media/...`); no aparece `fonts.googleapis.com` ni `fonts.gstatic.com`
en runtime; `Inter` no existe en `src/`; la escala del brief §4.1 está disponible
como utilidades del sistema.

**Acceptance Scenarios**:

1. **Given** el layout raíz, **When** carga cualquier página, **Then** las familias
   son Instrument Sans (cuerpo/UI), Instrument Serif (titulares de estado y sección,
   regular + cursiva) y DM Mono (códigos, se conserva), todas auto-alojadas; los
   archivos de fuente viven en el repo con su licencia SIL OFL.
2. **Given** la cursiva del sistema, **When** un titular de estado usa la palabra de
   énfasis (*tranquilos* / *algo* / *necesita que actúes hoy*), **Then** existe la
   utilidad para cursiva serif en el color del estado (tokens), lista para SPEC-143.
3. **Given** cualquier cifra del sistema, **When** se pinta con las utilidades de
   datos, **Then** lleva `font-variant-numeric: tabular-nums`.
4. **Given** la escala tipográfica §4.1, **When** se inspeccionan las utilidades,
   **Then** existen: titular de estado (`clamp(38px, 6.4vw, 70px)` serif,
   `letter-spacing:-.022em`, `line-height:1.02`), H1 46px serif, título de sección
   21-22px serif, cuerpo 16.5px sans `line-height:1.65`, microetiqueta 11px sans
   versalita `letter-spacing:.14em` en color terciario.

---

### User Story 3 — Primitivos del sistema con test (Priority: P2)

Como equipo de producto, quiero los cuatro primitivos nuevos en
`src/components/ui/` — `Anillo`, `PanelVidrio`, `LuzAmbiental`, `Declaracion` — cada
uno con su test, de modo que las specs de pantalla (143, 158, 159…) los compongan sin
reinventarlos.

**Why this priority**: Son la forma firma (§4.3) y los materiales (§4.6), pero no
tienen valor sin una pantalla que los use: por eso van después de tokens y tipografía,
y se entregan listos para que SPEC-143 los monte.

**Independent Test**: cada primitivo renderiza con datos de prueba, usa solo tokens
de color, anima con la curva única, y queda mudo con `prefers-reduced-motion`;
cobertura de test por primitivo (render, props, accesibilidad).

**Acceptance Scenarios**:

1. **Given** `Anillo`, **When** recibe `% vigilancia` (identificadores registrados) y
   `% reacción` (acudiente a quien llamar), **Then** dibuja dos anillos concéntricos
   SVG (trazo 17, extremos redondeados, exterior=vigilancia, interior=reacción) con
   centro escudo+número, leyenda en personas ("38 estudiantes sin redes registradas")
   y soporta la escala pequeña (88px) de curso. Ningún anillo es decorativo: cada arco
   codifica un número real (§4.0.2).
2. **Given** `PanelVidrio` + `LuzAmbiental`, **When** el estado cambia
   (pino→ámbar→rubí), **Then** el campo de luz ambiental detrás del vidrio cambia de
   color con el estado y el panel mantiene `backdrop-filter: saturate(185%)
   blur(22px)`; en oscuro el panel usa luz interior (`inset 0 1px 0
   rgba(255,255,255,.05)`) en vez de sombras pesadas.
3. **Given** `Declaracion`, **When** recibe el titular y la palabra de estado,
   **Then** la palabra va en cursiva serif y en el color del estado (token), con el
   resto del titular en serif regular.
4. **Given** `prefers-reduced-motion`, **When** cualquier primitivo entra en
   pantalla, **Then** toda animación está apagada, sin excepción (§4.5).

---

### Edge Cases

- **Alpha sobre tokens**: las utilidades que necesitan transparencia (`glass`,
  anillos con trazo atenuado) se definen con variables de canal/color-mix — no con
  colores crudos adicionales.
- **`theme-colegio`**: el override institucional existente se conserva como capa de
  compatibilidad re-mapeada a tokens (cero roturas en las pantallas de colegio
  actuales); no se introduce un segundo sistema.
- **Fuentes**: si un peso/estilo falta en los archivos vendoreados, NO se sintetiza
  (nada de `font-weight` simulado): se declara solo lo que el archivo trae.
- **themeColor del viewport** (`#0ea5e9` en `layout.tsx`): pasa al token `pino`.
- **Sin pantallas migradas**: esta SPEC no re-pinta las ~104 pantallas con colores
  crudos; migran por desgaste cuando otra spec las toque.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE definir variables CSS reales en `:root` y `.dark` para
  color (paleta §4.2: `pino`, `cielo`, `ambar`, `rubi`, `papel`, `tinta`), tipografía,
  radios, sombras, espaciado y movimiento, y `tailwind.config.ts` DEBE exponerlos
  (familias, colores por variable, curva única).
- **FR-002**: La capa semántica existente (`glass`, `glass-strong`, `glass-dark`,
  `glass-input`, `text-body`, `text-muted`, `text-subtle`, `text-accent`,
  `text-gradient`, `accent-gradient`, `bg-page`, `ring-accent`, `ring-accent-input`,
  scrollbars, fallback de focus) DEBE reescribirse sobre tokens SIN cambiar nombres ni
  romper usos; `theme-colegio` se conserva re-mapeado a tokens.
- **FR-003**: Inter DEBE desaparecer de `src/` y del config; Instrument Serif
  (regular + cursiva) e Instrument Sans (variable 400-700) y DM Mono DEBEN servirse
  con `next/font/local` desde archivos woff2 del repo (latin + latin-ext, SIL OFL,
  licencia incluida) — D1/D3: un solo mecanismo, builds deterministas, ninguna fuente
  se resuelve contra Google ni en runtime ni en build.
- **FR-004**: La escala tipográfica §4.1 DEBE existir como utilidades del sistema
  (titular de estado, H1, título de sección, cuerpo, microetiqueta) y TODA utilidad
  de cifra DEBE aplicar `tabular-nums`.
- **FR-005**: Los primitivos `Anillo`, `PanelVidrio`, `LuzAmbiental` y `Declaracion`
  DEBEN existir en `src/components/ui/`, cada uno con test (render + props +
  accesibilidad/reduced-motion), reusando los primitivos existentes cuando aplique
  (D-46: no duplicar variantes).
- **FR-006**: El movimiento DEBE usar una sola curva `cubic-bezier(.16,1,.3,1)` como
  token; el único bucle permitido es el pulso de estado (3,4 s); las entradas son
  escalonadas (translateY 16px + opacidad, retardo 60-80 ms);
  `prefers-reduced-motion` DEBE apagar TODA animación del sistema.
- **FR-007**: En código nuevo queda PROHIBIDO el color crudo de Tailwind: solo tokens
  (candado del radicado). Enforcement OBLIGATORIO (D2): script `tokens:check` en el
  gate de CI que falla si el conteo de color crudo en `src/**` productivo (sin
  tests) SUBE del piso sembrado (medición ODIN 2026-08-03, número con comentario de
  fecha y spec en el config del script).
- **FR-008**: Los dos temas DEBEN ser el mismo HTML con distintos valores de token;
  `prefers-color-scheme` se respeta y el cambio manual se permite (ThemeProvider
  existente).
- **FR-009**: Esta SPEC NO migra pantallas existentes (migran por desgaste) y NO toca
  `src/lib/ai/**` ni el motor. I-29 intacto: ningún score se muestra.
- **FR-010**: Cero tests debilitados; si un test existente requiere cambio, PARA y se
  reporta a ZEUS antes de tocarlo.

### Key Entities

- **Token**: variable CSS con nombre semántico (color, tipo, radio, sombra,
  espaciado, curva) con dos valores (claro/oscuro). Vive en `globals.css` + config.
- **Primitivo del sistema**: componente `ui/` tokenizado (`Anillo`, `PanelVidrio`,
  `LuzAmbiental`, `Declaracion`) que codifica datos reales, nunca decora (§4.0.2).

## Decisiones de ZEUS (compuerta §4, 2026-08-03 — REVISO `e6c10fab` → CUMPLE)

- **D1 — DM Mono: VENDORÍZALA TAMBIÉN, local.** Razón de ZEUS: `next/font/google`
  descarga en tiempo de BUILD — insumo no determinista y dependencia externa; este
  proyecto exige builds reproducibles byte a byte (D-33). Un solo mecanismo para
  todas las fuentes: `next/font/local`.
- **D2 — Ratchet `tokens:check`: SÍ, y en el gate de CI** (no solo local), mismo
  patrón que el ratchet del DAL. Requisitos vinculantes: falla si el conteo de color
  crudo SUBE (el piso solo baja) · cuenta solo `src/**` productivo (EXCLUYE tests) ·
  se siembra con el número medido por ODIN (manda la medición propia; el comando
  exacto se declara en `cierre.md`) · el número vive en el config del script con
  comentario de fecha y spec (patrón `vitest.config.ts`).
- **D3 — WOFF2 descargado directo de `fonts.gstatic.com`** (Google ya sirve woff2;
  nada que convertir ni tooling). Los DOS subconjuntos (latin + latin-ext) de cada
  familia + `OFL.txt`. Referencia medida por ZEUS en la maqueta: Instrument Sans
  latin 29,9 KB + latin-ext 11,1 KB · Instrument Serif latin 15,0 KB + latin-ext
  7,8 KB (~64 KB las dos familias). DM Mono igual: woff2 local (D1).
- **Candado de auditoría (nuevo)**: SC-001 se audita con `git diff --stat` — ninguna
  pantalla existente modificada salvo `src/app/layout.tsx`. Una pantalla tocada =
  NO CUMPLE aunque se vea bien.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los conteos de la capa semántica no bajan tras la reescritura
  (`glass` ≥ 109, `text-body` ≥ 457, `text-muted` ≥ 375, `text-subtle` ≥ 165) y
  **ninguna pantalla existente se modifica en el PR salvo `src/app/layout.tsx`**
  (candado de auditoría ZEUS: se verifica con `git diff --stat`; una pantalla tocada
  = NO CUMPLE).
- **SC-002**: `grep -ri "inter" src/ tailwind.config.ts` = 0 referencias a la fuente
  Inter; el HTML servido no contiene `fonts.googleapis.com` ni `fonts.gstatic.com`;
  las tres familias se sirven desde la propia app (woff2 local, latin + latin-ext).
- **SC-003**: Los pares texto/fondo derivados de tokens (body, muted, subtle sobre
  papel; pino/ambar/rubí como texto de estado sobre fondos del sistema) cumplen
  contraste ≥ 4.5:1 en ambos temas, verificado con script (`npm run a11y:contrast` o
  añadido al ratchet).
- **SC-004**: 4 primitivos nuevos con tests verdes que cubren render, props de estado
  y `prefers-reduced-motion`.
- **SC-005**: `grep` de curvas de animación en el sistema nuevo: una sola
  (`cubic-bezier(.16,1,.3,1)`); con `prefers-reduced-motion` el CSS del sistema no
  ejecuta ninguna animación (media query global verificable).
- **SC-006**: Gate completo local verde (tsc && lint && test:coverage && build &&
  arch:check) y CI del HEAD post-merge = success.

## Assumptions

- La referencia visual (maqueta navegable aprobada por el CEO) es la guía de detalle
  para valores no listados en §4; en caso de duda mandan los tres principios §4.0.
- ThemeProvider (class-based, `prefers-color-scheme` + persistencia) se conserva tal
  cual: los temas ya existen como mecanismo; lo nuevo son los valores de token.
- Las fuentes se descargan de la fuente oficial (repo `google/fonts`, SIL OFL) en la
  implementación; no se añaden dependencias npm de fuentes.
- Los íconos hero SVG (§8 del brief) NO se construyen aquí: llegan con SPEC-143/146.
- Los lucide-react y recharts del brief §4.4 ya están o se añaden en las specs de
  pantalla que los usen; esta SPEC no pinta pantallas.

## Impacto en arquitectura

Impacto en arquitectura: **ninguno estructural** — no modifica modelo de datos,
proxy, navegación ni stack. Añade tokens CSS en `globals.css` + `tailwind.config.ts`,
fuentes locales vendoreadas y 4 primitivos en `src/components/ui/` (con tests). No
obliga a regenerar línea base más allá de lo que `arch:check` verifique.
