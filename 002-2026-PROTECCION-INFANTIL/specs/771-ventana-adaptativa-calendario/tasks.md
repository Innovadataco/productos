# Tasks · SPEC-771 · ventana adaptativa del riel del calendario

> **PARÁ en §4:** las tareas de implementación esperan la aprobación del CEO de `spec.md` + `plan.md`
> (y la resolución de D-1..D-4). NADA marcado hasta entonces — no se toca código en el diseño.

## §4 · Diseño (compuerta)
- [x] **T0** · `spec.md` + `plan.md`: ventana adaptativa (forma de Diseño), blast radius medido, candado, decisiones D-1..D-4. **PARÁ · el CEO aprueba.**

## Tras aprobación §4 (DIRECTO)
- [ ] **T1** · `fechas.ts`: `ventanaAdaptativa(bloques, defaultVacio)` pura + `estiloBloque(minInicio, minFin, railInicioMin)` relativo a `railInicioMin`. `H0/H1` pasan a default de período vacío.
- [ ] **T2** · `calendario/Rejilla.tsx`: computa la ventana del período visible; `altura`/etiquetas/filas desde `[railInicioMin, railFinMin]`; propaga `railInicioMin` a `renderBloque` y al ghost.
- [ ] **T3** · Consumidores de `renderBloque` pasan `railInicioMin` a `estiloBloque`: `RejillaMisCitas`, `RejillaElegirFranja` (D-3), `CalendarioProfesional` (+ `BloqueFranja`/`OverlayDiaProfesional` en `profesional/calendario/Rejilla.tsx`).
- [ ] **T4** · `CalendarioProfesional`: geometría de arrastre (puntero→min, popover Y) usa `railInicioMin` (D-1); el guard de creación `H0/H1` se **conserva** (FUERA).
- [ ] **T5** · Candado UNIT (`ventanaAdaptativa`): bordes/margen/redondeo/mínimo/vacío/outlier/escala (A-3..A-6). Sin BD.
- [ ] **T6** · Candado RENDER dos superficies: PLANTA 5am/21:00 en `RejillaMisCitas` + `CalendarioProfesional` (+ `RejillaElegirFranja`); afirma `0 ≤ top && top+height ≤ altura` (dentro del área visible, no «en el DOM»); mutación de control (riel fijo → rojo). Registrar en el manifiesto de la lane que corresponda.
- [ ] **T7** · «No reconciliar» (D-4): correr `calendario-padre.candado.test.tsx`; si se pone rojo por la ventana, es **hallazgo** → reportar, no ajustar en silencio.
- [ ] **T8** · Gate: `tsc` + `lint` + `test:unit` COMPLETO + render candados (integración) + `build`. Verificar por exit code. PR + REALIZADO.
