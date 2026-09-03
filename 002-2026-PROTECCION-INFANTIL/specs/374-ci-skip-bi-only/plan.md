# SPEC-374 · Plan

1. Leer la fuente (15v5): job `should-skip` actual, inventario del repo raíz,
   qué archivos son "compartidos" y qué es "de otro producto".
2. Escribir `should-skip-pi.mjs` con lógica pura + CLI (stdin → true/false).
3. Escribir tests unitarios de los 9 casos del radicado, incluidos:
   007-PIWEB (caso vivo del CEO), bi.yml aislado (contrafixture), lista vacía,
   PR mixto BI+PI, prefijo similar (`002-…-DEMO/`).
4. Cambiar el `should-skip` del `ci.yml` para invocar el script (ubuntu-latest
   trae node preinstalado, no requiere setup-node).
5. Dry-run local del CLI con los mismos casos + gate completo.
6. Verificación viva (post-merge): el próximo PR sin tocar 002 debe
   quedar en checks `skipped` y mergeable. El PR de 007-PIWEB de idc-67 es el
   testigo del antes/después.
