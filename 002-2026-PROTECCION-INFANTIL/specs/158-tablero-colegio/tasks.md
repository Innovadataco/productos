# Tasks: SPEC-158 — Tablero de control del colegio

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

- [x] T001 `alerta-colegio.embudoPorReporte(colegioId)`: raw — por reporte, bucket de
      estado más pendiente (nueva>vista>gestionada), COUNT por bucket, sin solapes
      + test con fixture mixto (5 reportes: cerrados 2, revisión 1, esperan 2)
- [x] T002 [P] `alerta-colegio.reloj24h(colegioId)`: raw — EXTRACT(HOUR … AT TIME
      ZONE 'America/Bogota') con fallback UTC-5, COUNT DISTINCT reporteId, relleno
      0-23 + test (02:00 UTC → hora 21 Bogotá; ceros)
- [x] T003 `colegio-resumen.tableroColegio(colegioId)` (Promise.all: embudo, reloj,
      ritmo mensual reusado, barras por curso reusado) + test A/B + conteo de
      queries
- [x] T004 [P] `EmbudoEstado` (4 cifras, destacado "te esperan a ti" + enlace a
      alertas, copy positivo en cero) + test por estado
- [x] T005 [P] `RelojActividad` (SVG propio 24 sectores, curva única, sr-only con
      rango pico, reduced-motion, estado vacío honesto) + test
- [x] T006 [P] `RitmoMensual` + `BarrasPorCurso` (patrón TendenciaReportes;
      enlaces a cursos) + tests
- [x] T007 `page.tsx` + `TableroClient` + nav "Tablero" en `COLEGIO_NAV_ITEMS` (+
      actualizar `nav-items.test.ts` si fija la lista) + aserción B verde
- [x] T008 Checks de día: tsc + lint + tokens:check (≤1122) + arch:check + tests
      del área (nuevos + existentes verdes)

## Analyze (2026-08-03)

- Cobertura: US1→T001,T003,T004 · US2→T002,T003,T005 · US3→T003,T006,T007 ·
  FR-006→T001-T008. Toda FR tiene tarea; FR-007 invariante en T008.
- Consistencia: embudo por reporte (no por fila) coherente con D2; reloj SVG propio
  coherente con brief §4.4 (Recharts solo series temporales); página vieja de
  estadísticas intacta (Assumption documentada).
