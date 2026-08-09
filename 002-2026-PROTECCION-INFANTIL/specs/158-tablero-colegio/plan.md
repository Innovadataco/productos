# Implementation Plan: SPEC-158 — Tablero de control del colegio

**Branch**: `work/002-pi-058` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

## Summary

Nueva página `/dashboard/colegio/tablero/` con cuatro bloques — embudo de estado
(reportes distintos por bucket de estado más pendiente, sin solapes), reloj de
actividad 24 h en SVG propio (hora Bogotá), ritmo mensual (reuso) y barras por
curso (reuso) — servida por UNA llamada `tableroColegio(colegioId)` con cero N+1.

## Technical Context

**Stack**: Next.js 16.2.10 (server components) · Prisma 5.22.0 (raw SQL tenant) ·
Recharts 3.10.1 (ritmo/barras) · SVG propio (reloj) · Tailwind tokens · Vitest.
**Storage**: sin cambio de schema (todo sobre `AlertaColegio` + joins físicos).
**Constraints**: cero N+1 · embudo sin solapes · hora Bogotá (UTC-5, sin DST) ·
I-29 · terminología §3 · tokens only.

## Project Structure

```text
src/
├── app/dashboard/colegio/tablero/
│   ├── page.tsx                      # server: acceso + tableroColegio
│   └── TableroClient.tsx             # composición (client solo lo necesario)
├── components/modules/colegio/tablero/
│   ├── EmbudoEstado.tsx              # 4 cifras + CTA "te esperan a ti"
│   ├── RelojActividad.tsx            # SVG propio 24 sectores (server-safe)
│   ├── RitmoMensual.tsx              # "use client" — patrón TendenciaReportes
│   └── BarrasPorCurso.tsx            # "use client" — BarChart + enlaces
├── lib/dal/repositories/
│   ├── colegio-resumen.ts            # + tableroColegio(colegioId) (o repo nuevo)
│   └── alerta-colegio.ts             # + embudoPorReporte (raw), + reloj24h (raw,
│                                   #   AT TIME ZONE 'America/Bogota' con fallback)
└── lib/nav-items.ts                  # + "Tablero"
```

## Fases

1. **Datos**: embudo + reloj + `tableroColegio` + tests (fixture mixto, Bogotá, A/B).
2. **UI**: 4 componentes + página + nav + tests.
3. **Cierre**: checks de día + tokens:check + arch:check.

## Complexity Tracking

Sin violaciones.
