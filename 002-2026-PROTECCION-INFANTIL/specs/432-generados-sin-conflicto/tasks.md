# Tareas · SPEC-432 — Los archivos generados dejan de ser terreno de conflicto

- [x] T001 Medir en git real, antes de diseñar: `merge=union` sobre una lista y sobre un bloque de contadores.
- [x] T002 Hallazgo que definió el diseño: los contadores **no chocan y quedan mal** — dos ramas escriben el mismo número sobre la misma base.
- [x] T003 `.gitattributes` con `merge=union` para `specs/README.md` y `vitest.unit.includes.ts`, con sus dos límites escritos.
- [x] T004 Sacar el bloque de contadores del README; el generador lo imprime con `--resumen`.
- [x] T005 `--check` compara el conjunto de filas y detecta duplicadas; el texto fuera de la tabla sigue byte a byte.
- [x] T006 Verificar a mano que el `--check` aflojado sigue cazando: spec faltante, fila duplicada, texto alterado. Orden intercambiado → verde, a propósito.
- [x] T007 Candado con **dos ramas de verdad** en un repositorio temporal, con los archivos reales + contraprueba sin `.gitattributes`.
- [x] T008 Probarlo muriendo: comentar el union del README → 4 rojos; devolver los contadores → 1 rojo.
- [x] T009 Gate: `tsc`, lint, `arch:check`, `tokens:check`, unit, `specs/README.md`.

- [x] T010 Documentar la trampa que apareció al rebasar esta misma spec: «regenerá en vez de resolver a mano» **devuelve en silencio** lo que el commit quitaba. Vale solo para conflictos por filas agregadas.

## Anotado

- **Los artefactos de arquitectura son la misma clase y quedan FUERA.** `02-roles-capacidades.md` y `03-pantallas.md` se regeneran enteros; **SPEC-447 y SPEC-437 los tocan las dos**, así que el próximo choque ya está en camino. Incluirlos exige tolerar el orden en `arch:check` (a), que compara byte a byte — es otra verificación y otra decisión. Reportado al CEO.
- **GitHub no aplica `merge=union` en su merge del servidor.** El costo medido hoy estaba en el rebase local, que es donde esto sí aplica.
- El cierre real: dos PRs con spec nueva mergeados el mismo día **sin que nadie toque un archivo a mano**.
