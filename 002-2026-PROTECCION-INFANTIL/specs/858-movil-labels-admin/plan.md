# Plan · SPEC-858

Follow-up de 857 (PR nuevo desde `origin/main`, que ya tiene 857). Cambio de DATA mínimo + candado.

## Pasos
1. `nav-items.ts`: `labelCorto: "Comité"` en el hijo `/dashboard/admin/comite`; `labelCorto: "Cifras"` en `/dashboard/admin/estadisticas/operacion`.
2. `para-rol.test.ts`: candado de etiquetas móviles distinguibles por rol (control positivo ADMIN; muere por mutación); actualizar la aserción del principal de Estadísticas (ahora «Cifras»).
3. Verificar que el ESCRITORIO no cambia (nav-lateral/role-visibility siguen viendo «Bandeja»/«Operación» por `label`).

## Gate
`tsc` · `lint` · `test:unit` (job completo) · candados nav de render (integración) · `build` · `arch:check`.

## Riesgo
`labelCorto` es presentación de la barra móvil; el escritorio usa `label`. Riesgo acotado; los candados de render lo cubren.
