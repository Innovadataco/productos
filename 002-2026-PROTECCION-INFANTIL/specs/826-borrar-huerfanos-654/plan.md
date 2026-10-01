# Plan · SPEC-826

## Enfoque
1. Verificar (contra `origin/main`, no el checkout — I-440): los 10 son huérfanos (0 importadores de
   producción) y los «superseded» lo están de verdad (leyendo el reemplazo, no el comentario). HECHO.
2. Borrar los 10 módulos + sus 2 tests propios (`SemaforoItem.test.tsx`, `lectura-capa1.test.ts`).
3. Barrido de las TRES clases por módulo: import (0), lector de FUENTE por ruta (4 candados podados),
   meta/doc (1 comentario actualizado). Limpiar imports que queden sin uso al podar.
4. Allowlist: quitar las 10 entradas; re-clasificar 11 (`fuente-de-invariante`); actualizar nota de 13.
5. Gate COMPLETO por EXIT CODE: tsc + lint + arch:check + test:unit.

## Riesgos atendidos
- Un borrado barre más de lo que parece: por eso las 3 clases, no solo el import.
- `forms-publicos`: `expect(archivos.length).toBeGreaterThan(8)` — quitar 2 forms no debe cruzarlo (verificar
  en el gate). `CLAVE` sí debe soltar los 2 (si no, falla el anti-falso-verde).
- `colegio-inicio-color`: al quitar la contraprueba de SemaforoItem quedaron sin uso `fs`/`path`/`SRC` → removidos.
- BD: ninguno toca un objeto de base → sin radio de catálogo, sin CASCADE.

## No tocar / coordinación
- Ninguno de los 10 está en `scripts/demo-prod/` → no choca con #809/#812 en vuelo.
- Rama off `origin/main` (7aea8d429); push con luz verde del CEO (cola drenada).
