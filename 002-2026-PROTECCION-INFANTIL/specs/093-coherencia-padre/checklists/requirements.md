# Checklist de requisitos — Spec 093

**Spec**: `specs/093-coherencia-padre/spec.md` · **Verificado**: 2026-07-24

- [x] US1: círculo usa predicado (aprobados) + en-revisión-humana; SPAM/OTRO no cuenta (test).
- [x] US2: Mis reportes filtra SPAM/OTRO → "No se identifica riesgo".
- [x] US3: tipos muertos con score/nivelRiesgo eliminados (verificado no renderizados).
- [x] US4: navegación del padre sin RPT en URL (sessionStorage); guard del área en gate.
- [x] US5: dashboard con 2 estados, conductas por nombre, sin score ni "verificado".
- [x] No rompe 089/090/091; esReporteAprobado fuente única.
- [x] Staging explícito solo del 002.
- [ ] ACTA-VALIDACION de ZEUS — PENDIENTE.
