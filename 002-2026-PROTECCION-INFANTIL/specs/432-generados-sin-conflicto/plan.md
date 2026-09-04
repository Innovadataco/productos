# Plan · SPEC-432 — Los archivos generados dejan de ser terreno de conflicto

## Medición antes de diseñar

Dos experimentos en repositorios git temporales, antes de escribir una línea del arreglo:

| Experimento | Resultado |
|---|---|
| Dos ramas agregan una entrada a una lista, con `merge=union` | **Funden las dos**, sin conflicto, sintaxis válida. |
| Dos ramas agregan una spec y actualizan un contador | **No hay conflicto** — porque las dos escriben el MISMO número. El total queda **uno corto**, en silencio. |

El segundo es el que cambió el diseño: union no salva un contador, lo **empeora**, porque le quita el conflicto que era la única señal.

## Decisiones

- **`merge=union`** para las listas (`specs/README.md`, `vitest.unit.includes.ts`).
- **Sacar los contadores del archivo** en vez de intentar mergearlos. Lo que no se commitea no se desincroniza. Se piden con `--resumen`.
- **`--check` compara el conjunto de filas**, no los bytes: union no garantiza orden y el orden no es el invariante. Se probó a mano que sigue cazando spec faltante, fila duplicada y texto alterado fuera de la tabla.
- **El candado monta git de verdad**, con los archivos reales, y trae contraprueba sin `.gitattributes`. Un candado de formato no habría probado nada.
- **No se tocan los artefactos de arquitectura**: son la misma clase, pero incluirlos exige aflojar `arch:check`, que es otra verificación y otra decisión. Se reporta con la evidencia de que el próximo choque ya viene (447 y 437 los tocan las dos).

## Riesgo

| Riesgo | Cómo se acota |
|---|---|
| Que `--check` más laxo deje pasar un índice incompleto | Probado a mano: spec faltante → rojo con nombre; fila duplicada → rojo; texto fuera de la tabla → rojo. |
| Que union duplique una entrada | `--check` lo detecta en el README; un candado propio lo detecta en la lista de unit. |
| Que alguien devuelva los contadores al archivo | Candado que se pone rojo si reaparece el marcador de resumen. |
| Que el arreglo sea decorativo | Contraprueba: sin `.gitattributes`, el mismo escenario **debe** chocar. |
| Que GitHub no honre `merge=union` al mergear | El costo medido estaba en el **rebase local** (5 PRs, un CI cada uno). Ahí sí aplica. Anotado como límite. |
