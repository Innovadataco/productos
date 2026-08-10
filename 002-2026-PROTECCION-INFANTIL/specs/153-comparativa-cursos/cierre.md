# Cierre: SPEC-153 — Comparativa entre cursos

## Estado

🟢 Implementada (integrada en `feature/001-scaffolding`).

## Resumen

Se implementó la comparativa agregada de cursos para el rol SCHOOL_ADMIN, con agrupación por grado o año lectivo y exportación a Excel. No expone PII.

## Cambios entregados

- `prisma/schema.prisma` + `prisma/migrations/20260809220835_add_comparativa_excel_audit/`: añade `COLEGIO_COMPARATIVA_EXCEL_DESCARGADO` a `AccionAudit`.
- `src/lib/colegio/comparativa.ts`: servicio de agrupación tenant-first.
- `src/lib/colegio/export-comparativa-excel.ts`: generador determinista del archivo Excel.
- `src/lib/schemas/comparativa.ts`: schema Zod del criterio de agrupación.
- `src/app/api/colegio/analisis/comparativa/route.ts`: endpoint JSON.
- `src/app/api/colegio/analisis/comparativa/route.test.ts`: tests de integración del JSON.
- `src/app/api/colegio/analisis/comparativa/excel/route.ts`: endpoint de descarga Excel.
- `src/app/api/colegio/analisis/comparativa/excel/route.test.ts`: tests de integración del Excel.
- `src/app/dashboard/colegio/analisis/comparativa/page.tsx`: página de la UI.
- `docs/architecture/02-roles-capacidades.md` y `docs/architecture/03-pantallas.md`: regenerados para reflejar la nueva ruta.

## Gate de calidad

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run tokens:check` ✅
- `npm run arch:check` ✅
- `npm run test:coverage` ✅
- `npm run build` ✅

## Evidencia de integración

- Rama: `work/002-pi-058`
- PR a `feature/001-scaffolding`: #TODO
- Hash de merge en `feature/001-scaffolding`: #TODO
- CI-PUSH verde: #TODO

## Notas

- No se modificó `src/lib/ai/**` (I-29 intacto).
- No se realizaron migraciones de datos.
