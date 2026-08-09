# Tasks: SPEC-151 — Informe PDF mensual determinístico

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

- [ ] T001 Schema: valor `COLEGIO_INFORME_MENSUAL_PDF_DESCARGADO` en `AccionAudit` + migración aditiva.
- [ ] T002 Instalar `@react-pdf/renderer` y verificar build en Node runtime.
- [ ] T003 DTO + cálculo mensual en `src/lib/colegio/informe-mensual.ts` (reportes distintos, alertas, cursos, categorías) + tests determinismo.
- [ ] T004 [P] Repo `AlertaColegioRepository`: agregados por mes (`contarReportesDistintosPorMes`, `contarPorCursoMes`, `contarPorCategoriaMes`).
- [ ] T005 Componente `@react-pdf/renderer` en `src/lib/colegio/pdf-informe-mensual.tsx` (sin PII, estilo institucional).
- [ ] T006 Endpoint `GET /api/colegio/reportes/pdf` (Zod `mes`, tenant-first, audit) + `route.test.ts` (200, 400, A/B, determinismo).
- [ ] T007 UI: botón de descarga en `/dashboard/colegio/estadisticas` o `/dashboard/colegio/tablero`.
- [ ] T008 README spec 151 + arch:check verde + checks de día + push + PR.

## Analyze

- Cobertura: US1→T006-T007; US2→T003-T006; US3→T006-T007; FR-011→T008.
- Determinismo: datos fijados por rango `[inicioMes, inicioMesSiguiente)` sobre `AlertaColegio.creadoEn`.
- React-PDF en servidor: import dinámico o archivo `.tsx` con `"use server"` + `renderToStream`/`renderToBuffer`; se confirma en build.
