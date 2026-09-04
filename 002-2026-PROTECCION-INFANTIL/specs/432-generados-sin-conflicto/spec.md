# SPEC-432 · Los archivos generados dejan de ser terreno de conflicto

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-63`) · **Origen**: encargo del CEO 04-09 14:42 tras cinco choques en un día

**Impacto en arquitectura:** un `.gitattributes` nuevo y un `--check` más preciso. Sin migración, sin código de producto tocado. Cambia **cómo se funden dos ramas**, no qué hace la aplicación.

---

## El costo medido

El 04-09-2026, **cinco PRs abiertos a la vez chocaron en los mismos dos archivos**: `specs/README.md` y `vitest.unit.includes.ts`. No es mala suerte — son listas a las que **toda** spec nueva le agrega una línea en el mismo sitio. Cada choque costó un rebase **más un CI completo de 20-35 minutos**, y obligó al CEO a serializar los merges en olas.

SPEC-413 ya había abaratado el problema con un generador. Lo bajó; no lo eliminó.

---

## Lo que se midió antes de diseñar

No se supuso: se probó en git de verdad, en repositorios temporales.

**1 · `merge=union` resuelve el choque de las listas.** Dos ramas que agregan una entrada cada una funden **las dos**, sin intervención y con el resultado sintácticamente válido.

**2 · El bloque de contadores NO se puede mergear, y falla en silencio.** Este es el hallazgo que definió el diseño. Dos ramas que agregan una spec cada una escriben **el mismo número** (353 → 354 las dos, cada una sobre la misma base). Git ve dos cambios **idénticos**, los funde **sin conflicto**, y el archivo queda diciendo **354 donde debía decir 355**.

No es un choque ruidoso que alguien resuelve: es un número callado y falso. Union no lo arregla — **lo empeora**, porque quita el conflicto que era la única señal.

---

## El arreglo

1. **`.gitattributes` con `merge=union`** sobre `specs/README.md` y `vitest.unit.includes.ts`.
2. **El bloque de contadores sale del archivo commiteado.** Se pide cuando se quiere: `npx tsx scripts/specs/generar-readme.ts --resumen`. **Lo que no se commitea no se puede desincronizar.**
3. **`--check` pasa a comparar el CONJUNTO de filas, no los bytes.** Union puede dejar dos filas en otro orden, y eso **no es un defecto**: el invariante que importa es *«el índice lista exactamente las specs que existen»*. La siguiente regeneración normaliza sola.

**Aflojar la verificación obliga a probar que sigue cazando lo que importa.** Verificado a mano:

| Situación | `--check` |
|---|---|
| Spec nueva sin fila en el índice | **rojo**, nombrando la spec |
| Fila duplicada (el único daño que union puede hacer) | **rojo**, nombrando la fila |
| Texto fuera de la tabla alterado | **rojo** |
| Dos filas intercambiadas de orden | **verde** — tolerado a propósito |

---

## Candado · con dos ramas de verdad

Orden del CEO, textual: *«el candado tiene que **demostrar** que dos ramas que agregan una spec cada una mergean sin tocarse a mano. Probalo con dos ramas de verdad, no con un test que afirme el formato»*.

`scripts/specs/merge-sin-conflicto.candado.test.ts` **no mira el texto del `.gitattributes`**: monta un repositorio git real en un directorio temporal, **con los archivos reales del proyecto**, abre dos ramas que agregan una spec cada una y **mergea de verdad**. Afirma que el merge no se detiene, que no quedan marcadores, que **sobreviven las dos** specs y que la lista sigue siendo TypeScript válido (un solo `];`).

**Y trae contraprueba: el mismo escenario sin `.gitattributes` tiene que chocar.** Sin ella, el verde no probaría que union hace algo — probaría que tuvimos suerte con el diff.

| Mutación | Rojos |
|---|---|
| Comentar `specs/README.md merge=union` | **4** — el merge se detiene, faltan specs, la sintaxis se rompe y la cobertura del `.gitattributes` |
| Devolver el bloque de contadores al archivo | **1** — el que vigila que no vuelva |

`tsc` limpio · lint 0 errores · `arch:check` VERDE · `tokens:check` en el piso · unit **285/285 (2379)**.

---

## La trampa que apareció al rebasar esta misma spec

Vale escribirla porque **es el defecto de esta spec escondido dentro de su propio arreglo**, y va a volver.

Al rebasar esta rama sobre un `main` que ya se había movido, el único conflicto fue `specs/README.md`. La resolución que veníamos usando todo el día —y que esta spec recomienda— es **«no lo toques a mano: regenerá»**. Acá esa receta **estaba mal**.

Este commit **quita** el bloque de contadores del README. El `main` de enfrente todavía lo tiene. Regenerar a secas sobre la versión de `main` produce un archivo **sin conflicto, que pasa el `--check` y que trae los contadores de vuelta**: el arreglo se deshace solo, en silencio, en el mismo rebase que lo transporta.

**La regla que queda:** «regenerá en vez de resolver a mano» vale cuando el conflicto es **solo por filas agregadas**. Cuando el commit que estás rebasando **quita o mueve** algo del archivo generado, regenerar reconstruye el estado viejo. Ahí hay que partir de **tu** versión (`git checkout --theirs` durante un rebase — invertido respecto de un merge) y regenerar encima, y después **verificar explícitamente que lo que se quitó siga quitado**.

Es la misma familia de todo lo que cazó esta spec: un cambio que **no choca** y por eso nadie mira, y que deja el archivo callado y equivocado.

## Lo que NO cubre, dicho en voz alta

**Los artefactos de arquitectura son la misma clase y quedan fuera.** `docs/architecture/02-roles-capacidades.md` y `03-pantallas.md` se regeneran enteros y una ruta nueva les agrega una fila: **SPEC-447 y SPEC-437 los tocan las dos**, así que el próximo choque ya está en camino. No se incluyeron porque `arch:check` (a) los compara **byte a byte**, y tolerar el orden ahí es una decisión sobre una verificación que no es de esta spec. **Reportado al CEO con la evidencia.**

**Union no ordena y puede duplicar.** Los dos límites están escritos en el `.gitattributes`, vigilados por `--check` y por un candado de entradas duplicadas en la lista de unit.

> **Verde en CI ≠ funciona.** Cierra de verdad cuando dos PRs con spec nueva se mergeen el mismo día **sin que nadie toque un archivo a mano**.
