# Implementation Plan: SPEC-162 — Materia configurable en cursos

**Branch**: `work/002-pi-061` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

---

## Summary

Introducir el catálogo colegio-scoped `Materia` y una nueva entidad `CursoMateria` que vincula `Curso` × `Materia` × `Profesor` sin modificar `Curso` ni `Estudiante.cursoId`. Esto resuelve la asignatura configurable y, de paso, el profesor multi-curso (§4.4) mediante múltiples filas de `CursoMateria`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, Tailwind CSS 3.4 |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Multi-tenant** | `colegioId` obligatorio en todas las lecturas/escrituras (DAL E-1 / SPEC-134) |
| **Transaction boundary** | `withUnitOfWork` para operaciones que tocan múltiples entidades |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | Catálogo y relaciones son texto |
| §1.3 Presunción de inocencia | ✅ Pass | No afecta consulta pública |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual |
| §2.4 Modelo SaaS | ✅ Pass | `Materia` y `CursoMateria` son colegio-scoped |
| §3.1 TypeScript strict | ✅ Pass | Sin `any`; tipos de Prisma |
| §3.5 Logs y auditoría | ✅ Pass | FR-011: audit en materias y curso-materia |
| §4.1 Singletons | ✅ Pass | Reusa `prisma` singleton |
| §4.2 Rutas API individuales | ✅ Pass | Un `route.ts` por método/endpoint |
| I-49 Migraciones aditivas | ✅ Pass | Solo crea tablas; `Curso` y `Estudiante` no se tocan |

---

## Project Structure

### Documentation (this feature)

```text
specs/162-materia-configurable/
├── spec.md
├── plan.md
├── data-model.md
├── tasks.md
├── research.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                       # + model Materia, + model CursoMateria
└── migrations/                         # migración aditiva + seed de materias
src/
├── lib/
│   ├── dal/
│   │   └── repositories/
│   │       ├── materia.ts              # NUEVO: CRUD tenant-first + test
│   │       ├── materia.test.ts         # NUEVO
│   │       ├── curso-materia.ts        # NUEVO: CRUD tenant-first + test
│   │       └── curso-materia.test.ts   # NUEVO
│   ├── schemas/index.ts                # + materiaBodySchema, cursoMateriaBodySchema
│   └── colegio/
│       └── materias-seed.ts            # NUEVO: catálogo por defecto por colegio
├── app/
│   ├── api/colegio/
│   │   ├── materias/
│   │   │   ├── route.ts                # GET/POST
│   │   │   └── [id]/
│   │   │       ├── route.ts            # PATCH
│   │   │       └── estado/
│   │   │           └── route.ts        # PATCH estado
│   │   └── cursos/
│   │       └── [cursoId]/
│   │           └── materias/
│   │               ├── route.ts        # GET/POST
│   │               └── [id]/
│   │                   ├── route.ts    # PATCH
│   │                   └── estado/
│   │                       └── route.ts # PATCH estado
│   └── dashboard/colegio/
│       ├── materias/                   # NUEVA página: catálogo
│       │   └── page.tsx
│       └── cursos/
│           └── [id]/
│               └── MateriasCursoClient.tsx  # NUEVO: gestión materias del curso
└── components/modules/colegio/curso/
    └── CursoHeader.tsx                 # + conteo de materias del curso (opcional)
```

---

## Fases

1. **Schema + migración + seed**
   - Añadir `model Materia` y `model CursoMateria`.
   - Migración aditiva: crear ambas tablas; no modificar `Curso` ni `Estudiante`.
   - Seed inicial de materias al crear colegio (`src/app/api/admin/colegios/route.ts`).

2. **Backend: repositorio y endpoints de materias**
   - `MateriaRepository` con A/B y soft delete.
   - `GET /api/colegio/materias`, `POST /api/colegio/materias`, `PATCH /api/colegio/materias/[id]`, `PATCH /api/colegio/materias/[id]/estado`.
   - Tests A/B y de estado.

3. **Backend: repositorio y endpoints de CursoMateria**
   - `CursoMateriaRepository` con validaciones de same-tenant, materia activa, profesor activo.
   - `GET /api/colegio/cursos/[cursoId]/materias`, `POST ...`, `PATCH .../[id]`, `PATCH .../[id]/estado`.
   - Tests A/B, duplicados, validaciones de profesor/materia.

4. **Frontend**
   - Página `/dashboard/colegio/materias` para gestionar catálogo.
   - Sección en la ficha del curso para listar/asignar/editar/inactivar materias con profesor.

5. **Auditoría y arquitectura**
   - Añadir acciones de audit `COLEGIO_MATERIA_CREADA`, `COLEGIO_MATERIA_ACTUALIZADA`, `COLEGIO_MATERIA_ESTADO_CAMBIADO`, `COLEGIO_CURSO_MATERIA_CREADA`, `COLEGIO_CURSO_MATERIA_ACTUALIZADA`, `COLEGIO_CURSO_MATERIA_ESTADO_CAMBIADO`.
   - Regenerar artefactos de arquitectura (`npm run arch:check` en verde).

6. **Integración**
   - Gate completo: `tsc`, `lint`, `tokens:check`, `arch:check`, `test:coverage`, `build`.
   - Commit, push a `work/002-pi-061`, PR a `feature/001-scaffolding`.
   - CI-PUSH verde.

---

## Decisions & Risks

| Decision | Rationale | Risk / Mitigation |
|----------|-----------|-------------------|
| `Curso` no se toca; `CursoMateria` es entidad de vínculo | Preserva roster, estudiantes, unique constraint y toda la lógica existente. | Cero riesgo de romper cursos/estudiantes/alertas. |
| `profesorId` opcional en `CursoMateria` | Permite asignar materia sin definir profesor todavía. | Validar que, si se envía, el profesor sea del mismo colegio y esté activo. |
| `colegioId` denormalizado en `CursoMateria` | Facilita validaciones de tenant y queries sin joins innecesarios. | Mantener sincronizado: siempre se copia `colegioId` del `Curso`. |
| Soft delete por `estado` | Consistencia con `Profesor`, `Curso`, `Estudiante` y requisito de historial. | Ninguno; el patrón ya está establecido. |
| Seed inicial al crear colegio | El rector ya tiene catálogo funcional sin pasos extra. | Lista fija; se permite editar/inactivar. |

---

## Acceptance Mapping

| FR | Tests principales |
|----|-------------------|
| FR-001 / FR-002 | `src/lib/dal/repositories/materia.test.ts`, `src/app/api/colegio/materias/route.test.ts` |
| FR-003 | Tests de regresión de `Curso` y `Estudiante` (no deben cambiar) |
| FR-004 / FR-005 / FR-006 / FR-007 | `src/lib/dal/repositories/curso-materia.test.ts`, `src/app/api/colegio/cursos/[cursoId]/materias/route.test.ts` |
| FR-008 | `src/app/api/colegio/materias/route.test.ts` |
| FR-009 | `src/app/api/colegio/cursos/[cursoId]/materias/route.test.ts` |
| FR-010 | Tests de componente `MateriasCursoClient` |
| FR-011 | Tests de auditoría en repositorios y APIs |
