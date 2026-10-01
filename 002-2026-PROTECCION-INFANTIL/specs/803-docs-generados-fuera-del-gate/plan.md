# Plan · SPEC-803 · 00/01/06 fuera del gate byte-exacto

## Pasos
1. `artefactos.ts`: nuevo flag `fueraDelGatePorPR` (distinto de `toleraOrdenDeFilas`, por otra razón); marcar 00-INDICE, 01-modelo-datos, 06-stack.
2. `arch-check.ts` (`verificarDrift`): saltar la comparación byte-exacta cuando `toleraOrdenDeFilas || fueraDelGatePorPR` — el generador YA corrió antes (representabilidad). Actualizar comentario + log de (a).
3. `generados-post-merge.yml`: regenerar también `generar-indice/modelo-datos/stack` e incluir 00/01/06 en los ARCHIVOS que detecta/commitea.
4. Candado `docs-globales-fuera-del-gate.candado.test.ts` + registro en `vitest.unit.includes.ts`.

## Verificación
- Candado 3/3 · arch:check VERDE.
- Control positivo operacional: `01` drifteado → arch:check VERDE (representabilidad) + regen lo arregla (post-merge detecta).
- Gates: tsc · eslint · test:unit completo (specs-discipline + 432b de 02/03 + 487 del README siguen verdes).

## Fuera de alcance
`modulos-huerfanos-allowlist.json` (unión, no regeneración) · editar el contenido de 00/01/06.
