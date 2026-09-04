# SPEC-432b · Los artefactos de arquitectura dejan de ser terreno de conflicto

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-63`) · **Origen**: límite declarado en SPEC-432, aprobado por el CEO 04-09 14:48

**Impacto en arquitectura:** `arch:check (a)` deja de comparar byte a byte **dos** de sus cinco artefactos. Es un aflojamiento de una verificación, y por eso la spec se dedica sobre todo a **demostrar que sigue cazando**. Sin migración, sin código de producto.

> **Depende de SPEC-432**, que crea el `.gitattributes`. Entra después.

---

## Por qué existe

SPEC-432 arregló `specs/README.md` y `vitest.unit.includes.ts`, y **declaró explícitamente lo que dejaba fuera**: los artefactos de arquitectura son la misma clase —tablas a las que **cada ruta nueva** le agrega una fila— y el choque ya estaba en camino, porque **SPEC-447 y SPEC-437 los tocan las dos**.

La diferencia con 432 es que acá `merge=union` **no alcanzaba solo**: `arch:check (a)` comparaba byte a byte, así que una fusión perfectamente correcta con las dos filas nuevas invertidas se habría puesto **roja**. Había que aflojar la verificación — y aflojar una verificación sin demostrar qué sigue cazando es cómo se apaga un portero.

---

## Se tolera el ORDEN, nunca el contenido

El comparador **no trata el archivo como un conjunto de líneas.** Eso dejaría pasar una fila que salta de la sección de ADMIN a la de PARENT, que es un cambio de contenido disfrazado de reordenamiento.

El archivo se parte en **bloques**: cada tramo contiguo de filas, con las líneas que no son filas de separadores.

- El **armazón** (títulos, prosa, encabezados de tabla, separadores) se compara **en orden y byte a byte**.
- Las filas de **cada bloque** se comparan como multiconjunto: pueden estar en otro orden, pero tienen que ser exactamente las mismas y estar **en su bloque**.

## La matriz, demostrada sobre el artefacto real

| Situación | Resultado |
|---|---|
| Archivo intacto | verde |
| Dos filas intercambiadas **dentro de la misma tabla** | **verde** — a propósito |
| Una fila que **falta** | **rojo**, nombrándola |
| Una fila **duplicada** (el único daño de union) | **rojo** |
| Una fila **inventada** que sobra | **rojo** |
| Texto **fuera** de la tabla alterado | **rojo** |
| Una fila que **salta a otra tabla** | **rojo** |
| Borrar el **encabezado** de una tabla | **rojo** |

Ninguno de esos casos usa datos inventados: todos se construyen mutando `03-pantallas.md` de verdad.

## El merge, con dos ramas de verdad

Igual que en SPEC-432: repositorio git **real** en temporal, con los artefactos **reales**, dos ramas que agregan una ruta cada una, `git merge` de verdad. Y **contraprueba sin `.gitattributes`**, que tiene que chocar.

| Mutación | Rojos |
|---|---|
| Comentar el union de `03-pantallas.md` | **2** — el merge se detiene y la cobertura del `.gitattributes` |
| Comparar las filas como un conjunto **global**, sin bloques | **1** — «una fila que salta de tabla», que es justo lo que el diseño por bloques existe para atrapar |

Esa segunda mutación es la que importa: prueba que el diseño **carga peso**, no que el test pasa.

`tsc` limpio · lint 0 errores · `arch:check` VERDE · `tokens:check` en el piso · unit **286/286 (2391)**.

---

## Lo que queda fuera, otra vez en voz alta

**`00-INDICE.md`, `01-modelo-datos.md` y `06-stack.md` NO entran.** No son tablas de append por spec —cambian cuando cambia el modelo o el stack, no con cada ruta— y su comparación sigue siendo **byte a byte**. Hay candado que lo afirma: si alguien los agrega al `.gitattributes`, se pone rojo.

**GitHub no aplica `merge=union` en su merge del servidor.** Igual que en SPEC-432: esto elimina el dolor del **rebase local**, que es donde estuvo el costo medido.

> **Verde en CI ≠ funciona.** Cierra cuando dos PRs que agregan una ruta cada uno se mergeen sin que nadie toque un artefacto a mano.
