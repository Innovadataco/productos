# SPEC-487 · Plan

## Enfoque

Cambiar el invariante del PR (representabilidad) + mover la regeneración de los generados a un barrido post-merge (flujo B). Todo en el mismo PR para que los checks no se contradigan.

1. **Verificar en fuente** (candado 15 v5): cómo checa hoy cada gate (`generar-readme --check`, `arch:check (a)`, `specs-discipline`), qué artefactos son append-por-spec (`toleraOrdenDeFilas`) vs byte-exactos, y cómo se escriben a disco los generados (cada `generar-*.ts` con su `main()`).
2. **Modo representabilidad:** `generar-readme.ts --check-representable` (fuente sana, no committed==regen); `arch:check (a)` representabilidad para las 2 tablas union; `specs-discipline` aserción de carpeta-sana. El gate de CI (`verificaciones`) pasa a `--check-representable`.
3. **Barrido:** workflow `generados-post-merge.yml` — push a main + path-filter + cancel-in-progress:true + workflow_dispatch; regenera los 3; si drift, bot pushea rama, operador abre PR (flujo B). Idempotente/auto-terminante.
4. **Candado estilo 432:** merge real (no tocar índice → sin conflicto) + contraprueba (modelo viejo choca) + representabilidad (carpeta a medio crear → roja) + determinismo.
5. **Preflight completo** + verificar que un par de PR reales dejan de tocar los generados (lo certifica el CEO).

## Riesgos y mitigación

- **Perder validación de contenido de las 2 tablas** — mitigado: las aserciones B/B-bis (menú honesto) y rutas-app.test siguen vigilando rutas/roles; el barrido mantiene el committed al día.
- **Anti-recursión / permiso de crear PR** — resuelto por flujo B (operador abre el PR), ya validado en #406.
- **Loop del barrido** — auto-terminante: tras mergear el PR del barrido, regen==committed → sin drift → no abre otro.
- **Re-acoplar el índice al PR sin querer** — el candado NO asserta committed==regen (eso volvería a obligar al PR a editar el índice); solo representabilidad.

## Alcance

Los 3 append-por-spec (README, 02-roles, 03-pantallas) + los 3 gates + el workflow + el candado. Fuera: byte-exactos, unit-includes (union), retirar union.
