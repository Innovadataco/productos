# Plan · SPEC-859

PR nuevo desde `origin/main` (= `6e187e8de`, con 857+858). Cambio de DATA mínimo (3 encabezados + mover 1 nodo) + candado de membresía.

## Pasos
1. `nav-items.ts`: intercalar 3 encabezados (Moderación, Motor y pagos, Sistema) y mover el nodo Soporte a «Moderación» (tras Comité de Convivencia); quitarlo de la cola.
2. `para-rol.test.ts`: candado de membresía sección→ítems (control positivo del esquema, 5 encabezados no-navegables); actualizar el test de orphan-header (ahora «Moderación» aparece con `bandeja_reportes`).
3. Verificar que NO cambia: gates, labels de módulos, orden interno, barra móvil.

## Gate
`tsc` · `lint` · `test:unit` (job completo) · candados de render (integración) · `build` · `arch:check`.

## Riesgo
Un encabezado sangra hasta el próximo; colocar un módulo en la sección equivocada lo dejaría bajo el rótulo errado. El candado de membresía lo cubre (muere por mutación).
