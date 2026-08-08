# Implementation Plan: SPEC-147 — Vista de curso

**Branch**: `work/002-pi-058` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

## Summary

Reemplazar `cursos/[id]` por el escritorio del curso (§5.5): encabezado con
titular, tarjetas Reportes 30d (D2+delta) e Identificadores, anillo 88px de
cobertura del curso y tabla de estudiantes con acudiente visible y
`tel:`/`mailto:` clicables + badge ámbar "sin contactos". UNA llamada al DAL,
repos extendidos aditivamente, endpoints existentes intactos.

## Technical Context

**Stack**: Next.js 16.2.10 (server components) · Prisma 5.22.0 · Tailwind tokens ·
Vitest. **Storage**: sin cambio de schema. **Constraints**: cero N+1 · D1 acudiente
· I-29 · terminología §3 · tokens only.

## Project Structure

```text
src/
├── app/dashboard/colegio/cursos/[id]/
│   ├── page.tsx                      # server: una llamada cursoDetalle + 404
│   └── CursoEscritorioClient.tsx     # REEMPLAZA CursoDetallePageClient.tsx
├── components/modules/colegio/curso/
│   ├── CursoHeader.tsx               # nombre, titular (con estado), conteo
│   ├── TarjetasCurso.tsx             # reportes 30d + identificadores
│   ├── AnilloCurso.tsx               # Anillo size 88 + leyenda corta
│   ├── TablaEstudiantes.tsx          # ui/Tabla + buscador + badge + tel/mailto
│   ├── AcudienteContacto.tsx         # render condicional tel:/mailto: / badge
│   └── FormAgregarEstudiante.tsx     # modal con acudiente opcional
├── lib/dal/repositories/
│   ├── colegio-resumen.ts            # + cursoDetalle(colegioId, cursoId)
│   ├── estudiante.ts                 # + listarPorCursoConDetalle (include) y
│   │                                 #  contarCobertura parametrizada por curso
│   └── alerta-colegio.ts             # + conteos 30d/60d para UN curso (raw, tenant)
```

## Fases

1. **Datos**: extensiones de repos + `cursoDetalle` + tests A/B/N+1.
2. **UI**: componentes + página + tests (badge, tel:/mailto:, buscador, anillo).
3. **Cierre**: checks de día + tokens:check + arch:check.

## Complexity Tracking

Sin violaciones.
