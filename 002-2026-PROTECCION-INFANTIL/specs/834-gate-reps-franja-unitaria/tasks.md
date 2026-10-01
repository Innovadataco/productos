# Tasks · SPEC-834

- [x] **T1** · Medir las dos puertas contra `origin/main`: la unitaria (`franjas/route.ts`) no aplica REPS;
  el lote (`materializarFranjas`) tampoco en main (825 no está mergeada). Fuente única = `modalidadRepsRequerida`
  + `esRepsElegibleParaModalidad`/`repsAlDia` (SPEC-790 T4), alcanzable desde la unitaria.
- [x] **T2** · Verificar correctitud del gate: SIN_VERIFICAR + cutover abierto → elegible=true (no encierra al
  universo de hoy). MEDIR estado 7: el predicado colapsado muerde y el mensaje miente → escalar al CEO.
- [x] **T3** · VEREDICTO A: gate = `repsAlDia ∧ ¬esRepsElegibleParaModalidad(modalidad)` en `franjas/route.ts`.
  Las causas de vigencia quedan fuera (813/836/828).
- [x] **T4** · Cablear el mensaje de Diseño (FORMA-SPEC834 v1.0, `95a0d5a`, voz usted) verbatim, con pivote por
  DATO (atiende(otra) ∧ REPS(otra)).
- [x] **T5** · Candado de conducta en `franjas/route.test.ts` (7 casos). RED-first en dos sentidos (quitar el
  gate → caen los de rechazo; dropear `repsAlDia` → caen los de ALCANCE A).
- [x] **T6** · Gate COMPLETO por EXIT CODE: `tsc` + `lint` + `arch:check` + `test:unit` + la suite de la ruta
  (integración). Regenerado el cliente Prisma (estaba viejo vs schema con REUBICADA).
- [ ] **T7** · Push + PR (base `main`), con la cola del CEO.

## Nota
- El índice `specs/README.md` NO se edita en el PR (SPEC-487/D-109: lo regenera el barrido post-merge).
