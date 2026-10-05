# Tasks · SPEC-863

Diseño en [`spec.md`](./spec.md); mapa de cambios en [`plan.md`](./plan.md). Todas completadas.

- [x] **T1 · Predicado canónico** en `src/lib/dal/demo-exclusion.ts`: `marcarReporteSimulacro`,
  `esReporteNoReal`, `whereExcluirReportesNoReales`, `idsReportesNoReales` (demo_marcado ∪ simulacion_reportes).
- [x] **T2 · Marca atómica** en `crear-reporte-con-texto.ts` (misma tx que el reporte) + forward desde
  `reporte-creation.ts` + la ruta `reportes/route.ts` (bandera desde `x-simulacion-secret`).
- [x] **T3 · Write-side público**: `reporte-creation.ts` no incrementa `IdentificadorReportado` para
  simulacro; `scoring.ts` excluye simulacro en `calcularScore` + wrapper
  `recalcularYGuardarScoreSiReporteReal` cableado en sus 8 llamadores.
- [x] **T4 · Guards por consumidor**: avisos (hijos/colegio/círculo), `agregarPatronPorReporte`,
  `detectarYRegistrarMatch` (vía `ReporteRepository.esNoReal`).
- [x] **T5 · Lecturas de usuario real**: consulta pública (resumen/detalle), estadísticas públicas,
  seguimiento (`otrosReportesDe` compone `id` not+notIn), apelaciones, panel admin.
- [x] **T6 · Candado** `simulacro-exclusion.candado.test.ts` (A–D, control positivo; incl. «un
  simulacro no mueve el agregado público de un id real»). 4/4 contra BD real.
- [x] **T7 · Docs**: `spec.md` (+ Impacto en arquitectura, D-121, exentos, diferidos, hermano 006), `plan.md`.

**Fuera de alcance (declarado):** hermano a 006 (flip de las 5 MV contar→excluir) PARQUEADO; cola
interna de bajo daño EXENTA por decisión del CEO (anti-abuso/diagnósticas/correcciones RAW).
