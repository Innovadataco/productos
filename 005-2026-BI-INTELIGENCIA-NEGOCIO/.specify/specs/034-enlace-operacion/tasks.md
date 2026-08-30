# TASKS-034 · Enlace a `/operacion` en la sidebar

## F1 · Insertar entrada
- [x] `BiSideNav.tsx` · `{ label:"Operación", href:"/operacion", emoji:"🧭" }` PRIMERO en SECTIONS
- [x] Las otras 4 entradas NO se tocan (404 congelados intactos)

## F2 · Test
- [x] `bi-sidenav-operacion.test.tsx` · entrada /operacion primera · aria-current cuando pathname=/operacion · destino `src/app/operacion/page.tsx` existe
- [x] NO agregar aserción "todos los ítems resuelven" (defecto congelado)

## F3 · Gate local
- [x] `rm -rf .next && npm run build` verde
- [x] `npm run typecheck` verde
- [x] `npx vitest run` verde
- [x] Ratchets 4/5 verdes

## F4 · Evidencia §6 (candado 25 · sin esto NO hay CUMPLE)
- [x] (a) captura sidebar con "Operación" visible y primera
- [x] (b) click → aterriza en /operacion con el tablero renderizado

## F5 · Push + PR
- [x] commit + push (PR #174 ya abierto en spec+plan · se actualiza con el código)
- [ ] Señal: `desarrollo-bi-2: BI-SPEC-034 · REALIZADO · <hash> · gh pr checks OK + capturas §6`

## Reglas duras
- [x] Solo la entrada Operación · las otras NO se tocan
- [x] Solo BiSideNav.tsx + tests/ + carpeta del spec
- [x] Sin capturas §5 → no CUMPLE
