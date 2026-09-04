# Tareas · SPEC-432b — Los artefactos de arquitectura sin conflicto

- [x] T001 `lib/comparar-tolerando-orden.ts`: comparación por BLOQUES —armazón en orden y byte a byte, filas de cada tabla como multiconjunto—.
- [x] T002 Marca declarativa `toleraOrdenDeFilas` en `artefactos.ts`, solo para `02-roles-capacidades.md` y `03-pantallas.md`.
- [x] T003 `arch:check (a)` usa el comparador para esos dos y sigue byte a byte para los otros tres.
- [x] T004 `.gitattributes`: `merge=union` para los dos artefactos, con sus límites escritos.
- [x] T005 **Condición 2 del CEO — la matriz completa** sobre el artefacto real: intacto · orden intercambiado (verde) · fila faltante · duplicada · inventada · texto fuera de la tabla · fila que salta de tabla · encabezado borrado.
- [x] T006 **Condición 3 — merge de git de verdad** en repositorio temporal con los artefactos reales, más contraprueba sin `.gitattributes`.
- [x] T007 Probar muriendo: comentar el union → 2 rojos; comparar filas como conjunto global → rojo el caso de la fila que salta de tabla.
- [x] T008 Gate: `tsc`, lint, `arch:check`, `tokens:check`, unit 286/286.

## Anotado

- **Depende de SPEC-432** (crea el `.gitattributes`). Se construyó sobre esa rama; **el PR se abre cuando 432 esté en main**, para no apilar con merge por squash.
- `00-INDICE.md`, `01-modelo-datos.md` y `06-stack.md` **no** entran: no son tablas de append por spec. Hay candado que lo afirma.
- **GitHub no aplica `merge=union` en el servidor.** Esto elimina el dolor del rebase local, que es donde estuvo el costo medido.
