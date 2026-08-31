# Implementation Plan: Carga masiva de profesores por Excel

**Branch**: `work/pi-SPEC-335-carga-profesores` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Prioridad CEO directa. Base `origin/main` (478cc4769).

## Summary
Tres endpoints nuevos (`plantilla` · `validar` · `confirmar`) bajo `/api/colegio/carga-profesores/`, reusando el patrón probado de la carga de alumnos: parser CSV/XLSX, **sesión-roster server-side + token firmado single-use** (sin PII en el JWT), validación por fila y confirmación transaccional. Dedup por `(colegioId, tipoDocumento, numeroDocumento)` — ya único en BD. Los duplicados se **reportan** en el resumen. UI de carga en la pantalla de Profesores.

## Technical Context
- **Stack**: Next.js 15 / Prisma 5.22 / exceljs (ya usado por el parser) / Zod / Vitest.
- **Storage**: **sin migración** — `Profesor` ya tiene `@@unique([colegioId, tipoDocumento, numeroDocumento])`.
- **Seguridad/aislamiento**: `verifyAuth("SCHOOL_ADMIN")` + `assertModulo` + `verificarVigenciaColegio` + rate limit, igual que el flujo de alumnos. Token de carga firmado que referencia una **sesión server-side** (nunca el roster en el JWT).
- **DAL frontier (Q-3)**: creación por repositorio de profesores dentro de `withUnitOfWork`.
- **Validación por fila**: tipoDocumento existente y **activo** (catálogo), sexo ∈ (M|F|OTRO), email válido, anioNacimiento válido, obligatorios presentes.

## Constitution Check
Spec Kit ✅ · DAL frontier ✅ · sin migración ✅ · reuso del flujo existente (no paralelo) ✅ · arch:check regenera `02-roles-capacidades.md` por las 3 rutas nuevas ✅ esperado. Sin violaciones.

## Estructura
```text
src/lib/colegio/carga-profesores/
├── parser.ts        # columnas + parseo de filas de profesor (reusa lectura CSV/XLSX)
├── validator.ts     # valida fila a fila; clasifica crear | omitido(motivo) | error(motivo)
└── (reusa) ../carga/token.ts + sesión server-side análoga
src/app/api/colegio/carga-profesores/
├── plantilla/route.ts   # GET: CSV/XLSX con columnas + fila ejemplo
├── validar/route.ts     # POST archivo → resumen por fila + token de confirmación
└── confirmar/route.ts   # POST token → crea en lote (skip duplicados) → resumen final
src/components/modules/colegio/profesores/ImportProfesores.tsx  # UI subir + resumen + confirmar
src/app/dashboard/colegio/profesores/ProfesoresPageClient.tsx    # engancha la UI de carga
```

## Columnas de la plantilla
`nombre`, `apellidos`, `tipo_documento`, `numero_documento`, `anio_nacimiento`, `sexo`, `email`, `telefono`.

## Clasificación por fila (lo que ve el rector)
- **crear** — válida y no existe.
- **omitido: ya existe por documento** — identidad ya en BD (FR-004).
- **omitido: repetido en el archivo** — segunda aparición de la misma identidad (FR-005).
- **error: \<motivo\>** — tipo de documento inválido/inactivo, sexo, email, año, obligatorio faltante.

## Fases
1. `parser.ts` + `validator.ts` de profesores (+ tests unitarios de clasificación).
2. Endpoints `plantilla` / `validar` / `confirmar` (+ tests de ruta: duplicado BD, duplicado archivo, error de fila, idempotencia).
3. UI en Profesores (descargar plantilla → subir → resumen → confirmar).
4. arch regen + tsc + lint + specs-discipline + **evidencia en navegador** (Excel con repetidos → resumen → confirmar → sin duplicados) en el PR.

Un solo PR. Antes de REALIZADO: `specs-discipline.test.ts` local + hora con `TZ`.
