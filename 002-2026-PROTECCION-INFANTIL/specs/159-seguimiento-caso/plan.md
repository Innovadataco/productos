# Implementation Plan: SPEC-159 — Seguimiento del caso con bitácora

**Branch**: `work/002-pi-058` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

## Summary

Detalle del caso (`/dashboard/colegio/alertas/[id]`): línea de tiempo derivada de
fuentes reales (alerta + AuditLog + RegistroAvisoColegio + EventoMatch agregado),
bloque "lo que falta que haga el rector" computado server-side, y bitácora con
notas inmutables (`SeguimientoCaso` + `NotaSeguimiento`, tenant-first,
withUnitOfWork, audit `COLEGIO_CASO_NOTA_AGREGADA`).

## Technical Context

**Stack**: Next.js 16.2.10 · Prisma 5.22.0 · Zod · Tailwind tokens · Vitest.
**Storage**: 2 tablas + 1 valor enum (migración aditiva, inspección I-49).
**Constraints**: solo verdades (hitos pendientes, nunca inventados) · cero PII de
terceros en timeline · notas inmutables · tenant-first · I-29.

## Project Structure

```text
prisma/ (schema + migración aditiva)
src/
├── lib/
│   ├── dal/repositories/
│   │   ├── seguimiento-caso.ts           # NUEVO (caso + notas, tenant) + test
│   │   ├── alerta-colegio.ts             # + obtenerDetalleConCurso (include)
│   │   ├── audit-log.ts                  # + hitos por recurso (existente where)
│   │   ├── registro-aviso-colegio.ts     # + porEntidad(reporteId) (ya existe?)
│   │   └── evento-match.ts               # + porReporteId agregado
│   ├── colegio/seguimiento.ts            # NUEVO — timeline + pendientes (puro) + test
│   └── schemas/index.ts                  # + notaSeguimientoSchema
├── app/
│   ├── api/colegio/alertas/[id]/
│   │   ├── route.ts                      # GET detalle (UNA llamada) + test A/B
│   │   └── notas/route.ts                # POST (atómico) + test; PATCH/DELETE 404
│   └── dashboard/colegio/alertas/
│       ├── [id]/page.tsx                 # server + client
│       └── AlertasColegioPageClient.tsx  # + enlace al detalle (mínimo)
└── components/modules/colegio/seguimiento/
    ├── TimelineCaso.tsx · PendientesCaso.tsx · BitacoraCaso.tsx (+ tests)
```

## Fases

1. Schema + migración (I-49) + repos.
2. Timeline/pendientes (lib) + endpoints.
3. Página + componentes + enlace desde lista.
4. Arch regen (modelos 54→56, páginas 56→57) + checks + push.

## Complexity Tracking

Sin violaciones.
