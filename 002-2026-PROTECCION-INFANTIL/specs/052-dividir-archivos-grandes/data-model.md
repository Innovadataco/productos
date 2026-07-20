# Data Model: Dividir archivos grandes

**Date**: 2026-07-20
**Feature**: specs/052-dividir-archivos-grandes/spec.md

---

## Resumen

Este spec **no modifica el esquema de datos**. Es un refactor estructural del código fuente existente. No hay cambios en tablas, columnas, índices, enums ni relaciones de Prisma.

---

## Entidades afectadas por ubicación de código

Aunque no hay cambios en el modelo de datos, los siguientes archivos manipulan las mismas entidades que antes:

- `src/components/modules/ia/IaEvalManager.tsx` y sus sub-componentes: leen/escriben `ExperimentoIA`, `CasoEvaluacion`, `ResultadoEvaluacion`.
- `src/components/modules/AdminReporteDetalle.tsx` y sus sub-componentes: leen/escriben `Reporte`, `ClasificacionIA`, `CorreccionClasificacion`, `BajaReporte`, `EscalamientoComite`, `TransicionReporte`.
- `src/app/api/reportes/procesar/route.ts` y sus helpers: leen/escriben `Reporte`, `ClasificacionIA`, `EmbeddingReporte`, `TransicionReporte`, `IdentificadorReportado`.

---

## No hay migraciones

No se crean, eliminan ni modifican migraciones de Prisma para este spec. El refactor es puramente a nivel de código fuente TypeScript/React.

---

## Notas

- Los contratos de API permanecen inalterados.
- Los tipos Prisma (`CategoriaConducta`, `EstadoReporte`, etc.) se siguen importando desde `@prisma/client`.
- No se introduce ninguna nueva entidad ni tabla intermedia.
