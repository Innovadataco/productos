# Implementation Plan: SPEC-321 · pulido profesores (SPEC-B)

**Branch**: `work/pi-SPEC-321-profesores-pulido` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)

## Summary

Tres ajustes de UI en `ProfesoresPageClient` (botón único, copy del toggle, columna de conteo) + un `_count` filtrado en el listado (repo + API). Sin esquema.

## Cambios por archivo

- `src/lib/dal/repositories/profesor.ts` · `listarPaginados`: `findMany` con `include: { _count: { select: { identificadoresProf: { where: { estado: "activo" } } } } }`. (Prisma 5 soporta count de relación filtrado.)
- `src/app/api/colegio/profesores/route.ts` · GET: mapear `items` a `{ ...p, identificadoresActivos: p._count.identificadoresProf }` (o exponer `_count`); contrato claro para el cliente.
- `src/app/dashboard/colegio/profesores/ProfesoresPageClient.tsx`:
  - Quitar el botón "Agregar profesor" del `EmptyState` (`:321`), conservar el del header (`:273`).
  - `:384` label del toggle → `activo ? "Inactivar" : "Activar"`. (El mensaje de éxito se ajusta al mismo vocabulario.)
  - `type Profesor` += `identificadoresActivos: number`; header `<th>Identificadores</th>` + celda con el conteo.

## Tests (candado 24 v2)

- `ProfesoresPageClient.test.tsx`: un solo botón "Agregar profesor" en estado vacío; el toggle dice "Inactivar"/"Activar" y hace PATCH del estado; la fila muestra el conteo (fixture con `identificadoresActivos`).
- Repo/route: el listado incluye el conteo de activos (test con BD si aplica; valida en CI).

## Verificación

`tsc·lint·tokens·arch·locks·ratchets` + `specs-discipline` + verificación en navegador como rector (candado 25, evidencia en PR).
