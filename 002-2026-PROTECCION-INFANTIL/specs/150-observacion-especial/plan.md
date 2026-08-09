# Implementation Plan: SPEC-150 — Observación especial

**Branch**: `work/002-pi-058` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

## Summary

Marca auditable de observación especial: modelo `EstudianteObservacion` (soft
delete con histórico), endpoints marcar/desmarcar tenant-first con audit,
sensibilidad elevada en el pipeline de avisos (umbral efectivo 1 para observados)
y toggle `Star` en la tabla del curso y la ficha del estudiante.

## Project Structure

```text
prisma/ (schema + migración aditiva I-49: 1 tabla + 2 ADD VALUE)
src/
├── lib/
│   ├── dal/repositories/estudiante-observacion.ts   # NUEVO + test A/B
│   ├── dal/repositories/colegio-resumen.ts          # + flag observado en cursoDetalle
│   ├── colegio/avisos.ts                            # umbral efectivo 1 si observado
│   └── schemas/index.ts                             # + observacionBodySchema (motivo?)
├── app/api/colegio/alumnos/[id]/observacion/
│   └── route.ts                                     # POST + DELETE + test A/B
├── components/modules/colegio/curso/TablaEstudiantes.tsx  # + Star toggle
└── app/dashboard/colegio/alumnos/[id]/AlumnoDetallePageClient.tsx  # + estado/historial
```

## Fases

1. Schema + migración (I-49) + repo.
2. Endpoints + sensibilidad en avisos + tests.
3. UI (tabla + ficha) + arch regen (modelos 56→57) + checks + push.

## Complexity Tracking

Sin violaciones.
