# SPEC-037 · tasks.md

## Tras REVISO (implementación)
- [ ] `src/lib/bi/operacion.ts`: agrega `PruebaJelkin`, `PruebasJelkin`, campo `pruebasJelkin?` en `Operacion` (aditivo).
- [ ] `src/components/bi/operacion/TablaPruebasJelkin.tsx` (calcado de TablaRecorridos, retorna null si vacío/ausente).
- [ ] `src/app/operacion/page.tsx`: `<TablaPruebasJelkin p={r.data.pruebasJelkin} />` debajo de `<TablaRecorridos>`.
- [ ] `tests/fixtures/operacion.sample.json`: agrega bloque `pruebasJelkin` con J-01/J-02.
- [ ] `tests/unit/bi-pruebas-jelkin-render.test.tsx`:
  - [ ] renderiza J-01/J-02 en orden del array.
  - [ ] array ausente (`undefined`) → componente no pinta (retorna null).
  - [ ] filas `[]` → no pinta.
  - [ ] estado Cumple→tag ok · Parcial→mid · Bloqueado→bad · desconocido→neutro texto crudo · null→dash.
  - [ ] fecha null → dash · hallazgos verbatim.
- [ ] Gate LOCAL verde (avisar a Fábrica antes de `next build` · turno RAM con BI-2).
- [ ] 2 capturas §6 (con datos / sin pruebasJelkin).
- [ ] Push + PR base main.
- [ ] Señal REALIZADO.
