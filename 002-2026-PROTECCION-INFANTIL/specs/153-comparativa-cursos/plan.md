# Plan: SPEC-153 — Comparativa entre cursos

## Enfoque

Reutilizar la fuente de datos agregados del colegio (`calcularEstadisticasColegio`) para construir una comparativa agrupada por grado o año lectivo. Agregar un endpoint de exportación Excel con `exceljs`. La UI es una página nueva bajo `/dashboard/colegio/analisis/comparativa` con selector de criterio y tabla.

## Fases

1. **Backend — comparativa JSON**: servicio `src/lib/colegio/comparativa.ts` y endpoint `GET /api/colegio/analisis/comparativa`.
2. **Backend — export Excel**: endpoint `GET /api/colegio/analisis/comparativa/excel` y utilidad `src/lib/colegio/export-comparativa-excel.ts`.
3. **Tests backend**: `.test.ts` para ambos endpoints (JSON + Excel).
4. **UI**: página `/dashboard/colegio/analisis/comparativa` con selector, tabla, botón exportar.
5. **Arquitectura**: regenerar `docs/architecture/02-roles-capacidades.md`.
6. **Documentación y registro**: README.md, feature.json, cierre.md.

## Decisiones clave

- **Agrupación en memoria**: se agrupan los resultados de `calcularEstadisticasColegio` para no introducir SQL ad hoc y mantener tenant-first.
- **Sin migraciones**: no se modifica el modelo de datos.
- **Excel determinista**: columnas fijas, sin fórmulas, sin macros.
- **No auditoría**: la descarga de Excel no requiere audit log (es agregado, no sensible); se puede añadir si ZEUS lo pide, pero no está en el brief.

## Riesgos y mitigaciones

- **Riesgo**: `calcularEstadisticasColegio` podría volverse lento con muchos cursos. **Mitigación**: los repos ya usan queries agregadas; si hay problema, se optimizará en deuda técnica.
- **Riesgo**: Excel con `exceljs` en runtime Node puede ser pesado. **Mitigación**: solo genera una hoja pequeña (máximo decenas de grupos).

## Definición de terminado

- Gate completo verde: `tsc`, `lint`, `tokens:check`, `arch:check`, `test:coverage`, `build`.
- PR mergeado a `feature/001-scaffolding` con CI push verde.
- Spec-Kit completo y registrado en README.md.
