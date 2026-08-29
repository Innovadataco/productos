# Checklist de requisitos — Spec 095

**Spec**: `specs/095-default-seguro-jwt-banco/spec.md` · **Verificado**: 2026-07-24

- [x] US1: seed y loader por defecto enrutan a legacy; rúbrica y config conservadas (tests 3/3).
- [x] US2: JWT desde parámetro con fallback 24h (tests 3/3); 4 muertos resueltos (2 cableados, 3 retirados) y documentado.
- [x] US3a: `CasoEval` con 200 casos fixtureVersion=2 (verificado en BD: 110 v1 + 200 v2); export reproducible.
- [x] US3b: hoja de adjudicación con votos reales por modelo, columnas vacías (42/42).
- [x] US3c: runner dual produce comparación por caso (submuestra 4/4 ambos motores).
- [x] No se decidieron etiquetas; migraciones aditivas; no rompe 089-094.
- [x] Staging explícito solo del 002.
- [ ] ACTA-VALIDACION de ZEUS — PENDIENTE.
