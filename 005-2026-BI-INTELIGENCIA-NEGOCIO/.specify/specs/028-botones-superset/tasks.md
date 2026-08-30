# SPEC-028 · tasks.md

## Tras REVISO (implementación)
- [ ] `src/components/bi/dashboards/SupersetLink.tsx` con 5 botones link + prop `baseUrl?`.
- [ ] `tests/unit/bi-superset-link.test.tsx`:
  - [ ] Renderiza 5 botones en orden Ejecutivo → Salud.
  - [ ] Cada `<a>` tiene `href` correcto (`{base}/superset/dashboard/{slug}/`).
  - [ ] Cada `<a>` tiene `target=_blank` + `rel="noopener noreferrer"`.
  - [ ] Prop `baseUrl` override funciona (test con base custom).
- [ ] Gate LOCAL verde.
- [ ] Push · PR draft base `main`.
- [ ] Ready-for-review al implementar completo.
- [ ] Señal REALIZADO a Fábrica BI-2.
