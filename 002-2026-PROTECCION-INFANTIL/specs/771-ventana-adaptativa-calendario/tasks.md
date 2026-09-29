# Tasks · SPEC-771 · ventana adaptativa del riel del calendario

> **PARÁ en §4:** las tareas de implementación esperan la aprobación del CEO de `spec.md` + `plan.md`
> (y la resolución de D-1..D-4). NADA marcado hasta entonces — no se toca código en el diseño.

## §4 · Diseño (compuerta)
- [x] **T0** · `spec.md` + `plan.md`: ventana adaptativa (forma de Diseño), blast radius medido, candado, decisiones D-1..D-4. **PARÁ · el CEO aprueba.**

## Tras aprobación §4 (DIRECTO) — HECHO
- [x] **T1** · `fechas.ts`: `ventanaAdaptativa(bloques, opciones)` pura (banda mínima + default vacío, bordes en hora entera) + `estiloBloque(minInicio, minFin, railInicioMin)` relativo a `railInicioMin`.
- [x] **T2** · `calendario/Rejilla.tsx`: props `railInicioMin`/`railFinMin`; `altura`/etiquetas/filas desde el rango; ghost con `railInicioMin`.
- [x] **T3** · Consumidores pasan la ventana + `railInicioMin` a `estiloBloque`: `RejillaMisCitas`, `RejillaElegirFranja` (D-3, padre), `CalendarioProfesional` (+ `BloqueFranja`/`OverlayDiaProfesional`).
- [x] **T4** · `CalendarioProfesional`: arrastre (puntero→min, popover Y) y overlay/altura usan `railInicioMin` (D-1); guard de creación `H0/H1` **conservado** (FUERA).
- [x] **T5** · Candado UNIT (`ventana-adaptativa.candado.test.ts`, registrado en el manifiesto): bordes 5am/9pm dentro del área visible, banda del profesional (D-2), vacío por superficie, span mínimo, escala consistente, outlier, y control positivo por mutación (riel fijo → top<0). 9 tests.
- [x] **T6** · Candado RENDER dos+una superficies (`calendario-ventana-adaptativa.candado.test.tsx`, integración): PLANTA 5am/21:00 en `RejillaMisCitas`, `RejillaElegirFranja` y `CalendarioProfesional`; afirma `0 ≤ top && top+height ≤ altura` (dentro del área visible, no «en el DOM»). 3 tests.
- [x] **T7** · «No reconciliar» (D-4): `calendario-padre.candado.test.tsx` sigue VERDE (5 tests) — sin hallazgo. Mutación verificada aparte (revertir estiloBloque al riel fijo → 6 unit + 3 render en ROJO).
- [x] **T8** · Gate: `tsc` ✓ · `lint` ✓ · `test:unit` 423/3259 ✓ · render candados ✓ · `build` COMPILA (page-data no corre local por `.env` del worktree; CI con env). PR + REALIZADO.
