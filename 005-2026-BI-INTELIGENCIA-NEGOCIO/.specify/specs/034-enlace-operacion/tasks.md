# TASKS-034 · Enlace a `/operacion` en la sidebar

## F1 · Insertar entrada
- [ ] `BiSideNav.tsx` · `{ label:"Operación", href:"/operacion", emoji:"🧭" }` PRIMERO en SECTIONS
- [ ] Las otras 4 entradas NO se tocan (404 congelados intactos)

## F2 · Test
- [ ] `bi-sidenav-operacion.test.tsx` · entrada /operacion primera · aria-current cuando pathname=/operacion · destino `src/app/operacion/page.tsx` existe
- [ ] NO agregar aserción "todos los ítems resuelven" (defecto congelado)

## F3 · Gate local
- [ ] `rm -rf .next && npm run build` verde
- [ ] `npm run typecheck` verde
- [ ] `npx vitest run` verde
- [ ] Ratchets 4/5 verdes

## F4 · Evidencia §6 (candado 25 · sin esto NO hay CUMPLE)
- [ ] (a) captura sidebar con "Operación" visible y primera
- [ ] (b) click → aterriza en /operacion con el tablero renderizado

## F5 · Push + PR
- [ ] commit + push + `gh pr create --base main`
- [ ] Señal: `desarrollo-bi-2: BI-SPEC-034 · REALIZADO · <hash> · gh pr checks OK + capturas §6`

## Reglas duras
- [ ] Solo la entrada Operación · las otras NO se tocan
- [ ] Solo BiSideNav.tsx + tests/ + carpeta del spec
- [ ] Sin capturas §5 → no CUMPLE
