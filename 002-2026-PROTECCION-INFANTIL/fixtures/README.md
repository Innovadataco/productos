# Fixtures del proyecto

## `banco-curado-v2.jsonl`

Banco de casos curados para evaluación y afinamiento del clasificador de IA.

- **Formato**: JSONL (una línea JSON por caso).
- **Campos por línea**: `id`, `texto`, `categoriaEsperada`, `secundariaEsperada`,
  `ruido`, `fuente`, `activo`, `fixtureVersion`, `creadoEn`.
- **Origen**: exportado desde la tabla `CasoEval` antes del retiro del sistema de
  Experimentos (Fase 2 de SPEC-170 / 002-PI-068).
- **Aprobación**: decisiones de frontera acordadas en D-20/D-24 (42 disputas
  humanas adjudicadas + 3 reglas de taxonomía del CEO).
- **Snapshot**: 2026-08-17.
- **Nota**: incluye casos `activo=true` y `activo=false`; la columna permite
  filtrar la memoria histórica completa.
