# Implementation Plan: SPEC-151 — Informe PDF mensual determinístico

**Branch**: `work/002-pi-058` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

## Summary

Endpoint `GET /api/colegio/reportes/pdf?mes=YYYY-MM` que genera y descarga un informe mensual determinístico del colegio usando `@react-pdf/renderer` en runtime Node. Incluye agregados por curso y categoría de conducta, sin PII, con auditoría.

## Project Structure

```text
prisma/schema.prisma                         # + COLEGIO_INFORME_MENSUAL_PDF_DESCARGADO
prisma/migrations/20260809160000_informe_mensual_pdf_audit/migration.sql
src/
├── lib/
│   ├── colegio/
│   │   ├── informe-mensual.ts              # DTO y cálculo de agregados mensuales
│   │   ├── informe-mensual.test.ts         # tests de determinismo y datos
│   │   └── pdf-informe-mensual.tsx         # componente @react-pdf/renderer
│   ├── dal/repositories/alerta-colegio.ts   # + contarReportesDistintosPorMes, contarPorCategoriaMes
│   └── schemas/index.ts                     # + informeMensualQuerySchema
├── app/api/colegio/reportes/pdf/
│   └── route.ts                             # GET + test
└── app/dashboard/colegio/estadisticas/
    └── (botón de descarga en page client)   # o en tablero; TBD
```

## Fases

1. Schema + dependencia (`@react-pdf/renderer`) + DTO/cálculo mensual.
2. Repositorio: agregados por mes (reportes distintos, por curso, por categoría).
3. Componente React-PDF + render a buffer.
4. Endpoint + test + UI de descarga + auditoría.
5. Checks de día + README + PR.

## Complexity Tracking

Sin violaciones.
