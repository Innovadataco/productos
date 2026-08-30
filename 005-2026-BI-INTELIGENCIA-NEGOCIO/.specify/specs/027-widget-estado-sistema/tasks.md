# SPEC-027 · tasks.md

## Tras REVISO (implementación)
- [ ] `src/app/api/bi/estado-sistema/route.ts` GET · `Promise.allSettled` de 4 chequeos · timeout 3s c/u.
- [ ] `src/components/bi/estado/EstadoSistemaWidget.tsx` (Client) · consume el endpoint, renderiza 3 pastillas + card reporte, skeleton loading.
- [ ] `tests/unit/bi-estado-sistema-route.test.ts`:
  - [ ] vanna 200 + superset ECONNREFUSED + pi 200 → `superset.ok=false error≠null`, otros ok.
  - [ ] Prisma throws → `ultimoReporte=null`, `ultimoReporteError≠null`, servicios sin afectar.
  - [ ] Los 3 servicios 200 + prisma OK → `ok=true` en todos + `ultimoReporte` no null.
- [ ] `tests/unit/bi-estado-sistema-widget.test.tsx`:
  - [ ] mount → skeleton → data → 3 pastillas + 1 card.
  - [ ] superset down → pastilla roja "no disponible", otras 2 verdes.
- [ ] Gate LOCAL verde.
- [ ] Push + PR.
- [ ] Señal REALIZADO.
