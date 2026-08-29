# Research: Kanban de Oportunidades

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Fecha**: 2026-07-24
(ampliado el 2026-07-24 con el defecto **I-014**)

Este documento recoge las decisiones que el plan da por tomadas, con las alternativas que se
descartaron y por qué. Se redacta **a posteriori** (D-066): la spec se implementó en el turno
nocturno D-060 sin él, y ZEUS lo reclamó con razón — las decisiones estaban en la cabeza de
ODIN y en los comentarios del código, no en un artefacto revisable.

---

## D1 · Librería de arrastre: ninguna

**Decisión**: HTML5 nativo (`draggable`, `onDragStart`, `onDragOver`, `onDrop`).

| Alternativa | Por qué se descartó |
|---|---|
| `@dnd-kit` | La opción "seria" hoy: accesible, con soporte táctil y de teclado. Pero son ~30 kB y una API que condiciona el componente. Esta spec **no necesita** reordenar dentro de la columna (está *Out of Scope*), que es justo donde dnd-kit gana. |
| `react-beautiful-dnd` | Sin mantenimiento activo; añadir una dependencia parada en un turno desatendido es deuda garantizada. |
| Nativo | Cero dependencias, cero superficie de fallo nueva. |

**Lo que esta decisión cuesta, dicho claro**: el arrastre nativo **no es accesible por
teclado** y en táctil es pobre. Hoy no hay requisito de accesibilidad en la constitución, así
que no bloquea; pero si aparece, la respuesta es cambiar la implementación **dentro** de
`KanbanBoard` —su contrato no menciona el arrastre— y no tocar a los dos consumidores.

## D2 · Tres capas en vez de dos

La spec pide "componente genérico + adaptador". El plan añadió una capa: la **lógica pura** en
`src/lib/kanban.ts`.

**Motivo**: la suite corre en entorno `node` y no había ni un test de componente en el
proyecto. Con la lógica dentro del `.tsx`, probar cualquier regla —el orden de las columnas,
la huérfana, el movimiento nulo— habría exigido estrenar jsdom de madrugada. Sacándola a
funciones puras, lo que decide comportamiento queda cubierto por la suite existente.

**Coste**: un archivo más y un salto de lectura entre la regla y su uso.

## D3 · Añadir "Tablero" en vez de sustituir "Estados"

FR-011 dejaba la elección al plan. Sustituir "Estados" habría dejado el catálogo **sin
pantalla de administración**: es la única vía para crear un estado. Sustituir habría cambiado
un defecto de vista por una regresión funcional.

## D4 · Persistir por el `PATCH` existente

Se reutiliza `PATCH /api/licitaciones/[id]` (US2-6) en vez de crear una ruta dedicada de
"mover tarjeta". Una ruta paralela habría podido saltarse validaciones de la oportunidad.

**Consecuencia asumida**: el `PATCH` no auditaba nada, así que la auditoría del cambio de
estado (FR-007) se añadió **dentro** de esa ruta, y beneficia también a quien edite desde el
formulario.

## D5 · Optimista con rollback, no bloqueante

FR-008 exige revertir ante fallo; el plan eligió **optimista**: la tarjeta se mueve al
instante y vuelve si la persistencia falla.

**Alternativa descartada**: bloquear la tarjeta hasta la respuesta. Es más simple de razonar,
pero en un tablero el movimiento es la interacción principal y esperar en cada arrastre lo
vuelve tosco. El rollback cubre el caso malo sin castigar el caso bueno.

**Riesgo aceptado**: dos usuarios moviendo la misma tarjeta a la vez. Gana el último que
persista y la auditoría registra ambos. Sin bloqueo optimista: fuera de alcance.

---

## D6 · Reparto del ancho (defecto **I-014**, 2026-07-24)

**Contexto**: el CEO reportó, sobre la app ya desplegada, que la última columna quedaba fuera
de pantalla en **ambos** tableros.

**Medición**, no impresión:

| Concepto | Valor |
|---|---|
| Columna fija | `w-72` = **288 px** |
| Separación | `gap-4` = **16 px** |
| Tablero de fases (4 columnas) | 4×288 + 3×16 = **1200 px** |
| Tablero de oportunidades (5 columnas) | 5×288 + 4×16 = **1504 px** |
| Área real de contenido | `max-w-7xl` (1280) − `p-12` (2×48) = **1184 px** |

Con 1184 px disponibles, **ambos** tableros desbordaban. No era un fallo de cierto ancho de
pantalla: desbordaba **siempre**, porque el contenedor está acotado y el tablero no lo miraba.

**Decisión**: las columnas **reparten** el ancho (`grid` con `repeat(N, minmax(0, 1fr))`).

| Alternativa | Por qué se descartó |
|---|---|
| Ensanchar `main` (quitar `max-w-7xl`) | Es la otra causa, sí, pero `main` envuelve **todas** las pantallas: cambiarlo por un defecto de una es una decisión de diseño global disfrazada de arreglo. Queda para ZEUS o para SPEC-012. |
| Reducir `w-72` a `w-56` | Sigue siendo un ancho fijo: aguanta hasta que el catálogo crezca una columna más y vuelve el defecto. |
| Repartir siempre, sin umbral | Con 12 estados —el catálogo es configurable (§0.7)— daría columnas de ~90 px, ilegibles. |
| **Repartir hasta 6 columnas; por encima, desplazar** | Cubre los dos tableros reales y el crecimiento razonable del catálogo, y degrada de forma explícita en vez de romperse. |

`minmax(0, 1fr)` y no `1fr`: sin el mínimo en cero, una tarjeta con una palabra larga estira
su columna y rompe el reparto.

**Umbral en 6**: es un juicio, no una medida. Con el área actual (~1184 px), 6 columnas dan
~180 px por columna, que es el límite en que una referencia y un título corto siguen
leyéndose. Queda como constante nombrada (`MAX_COLUMNAS_REPARTIDAS`) y con test, para que
cambiarlo sea una decisión y no un descubrimiento.

## D7 · Verificar en el navegador, no en el árbol

I-014 no lo habría cazado ningún test unitario: el árbol estaba bien y el defecto vivía en el
maquetado del navegador. Por eso SC-012 se acredita con `scripts/verify-tableros.mjs`, que
mide `scrollWidth` contra `clientWidth` y cuenta columnas **enteras** dentro del contenedor, a
1280/1440/1920, contra la app **desplegada**.

Es la lección de la Regla de Oro 4 aplicada al detalle: *"compila" y "se ve" son cosas
distintas*.

---

## Lo que sigue abierto

- **Accesibilidad del arrastre** (D1): sin requisito hoy; si llega, se cambia dentro del
  componente.
- **Ancho del contenedor global** (D6): `max-w-7xl` en `RootLayoutContent` deja aire muerto a
  los lados en pantallas grandes. **Deliberadamente no tocado**: afecta a todas las pantallas.
- **Reordenar dentro de la columna**: fuera de alcance; obligaría a revisar D1.
