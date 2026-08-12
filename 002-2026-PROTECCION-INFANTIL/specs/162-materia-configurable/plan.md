# Implementation Plan: SPEC-162 — Materia configurable en cursos

**Branch**: `work/002-pi-061` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

---

## Summary

Introducir el catálogo colegio-scoped `Materia`, hacer que `Curso` referencie una materia y que `Curso.nombre` represente el grupo. La migración es aditiva: `materiaId` nullable, backfill con una materia por defecto por colegio, y actualización progresiva de la UI/API sin romper cursos existentes.

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
| §2.4 Modelo SaaS | ✅ Pass | Tabla `Materia` es colegio-scoped |
| §3.1 TypeScript strict | ✅ Pass | Sin `any`; tipos de Prisma |
| §3.5 Logs y auditoría | ✅ Pass | FR-010: audit en materias y cambios de materia en curso |
| §4.1 Singletons | ✅ Pass | Reusa `prisma` singleton |
| §4.2 Rutas API individuales | ✅ Pass | Un `route.ts` por método/endpoint |
| I-49 Migraciones aditivas | ✅ Pass | `materiaId` nullable + backfill, sin DROP destructivo |

---

## Project Structure

### Documentation (this feature)

```text
specs/162-materia-configurable/
├── spec.md
├── plan.md
├── data-model.md
├── tasks.md
├── research.md          # (breve) decisiones del brief y análisis de impacto
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                       # + model Materia, + Curso.materiaId
└── migrations/                         # migración aditiva + backfill
src/
├── lib/
│   ├── dal/
│   │   └── repositories/
│   │       ├── materia.ts              # NUEVO: CRUD tenant-first + test
│   │       ├── materia.test.ts         # NUEVO
│   │       └── curso.ts                # + materiaId, + joins, actualizar tests
│   ├── schemas/index.ts                # + materiaBodySchema, cursoBodySchema v2
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
│   │   ├── cursos/
│   │   │   ├── route.ts                # + materiaId en POST
│   │   │   └── [id]/
│   │   │       └── route.ts            # + materiaId en PATCH
│   │   └── cursos/unificado/
│   │       └── route.ts                # + materiaId en curso
│   └── dashboard/colegio/
│       ├── materias/                   # NUEVA página: catálogo
│       │   └── page.tsx
│       ├── cursos/
│       │   ├── CursosPageClient.tsx    # + columna materia, editar materia/grupo
│       │   ├── [id]/CursoEscritorioClient.tsx  # + materia en header
│       │   ├── nuevo/page.tsx          # + selector de materia
│       │   └── unificado/page.tsx      # wizard + materia
│       └── components/modules/colegio/unificado/
│           └── SeccionCurso.tsx        # + selector materia + label "Grupo"
└── components/modules/colegio/curso/
    └── CursoHeader.tsx                 # + materia
```

---

## Fases

1. **Schema + migración + seed**
   - Añadir `Materia`, `Curso.materiaId`, reemplazar unique constraint.
   - Backfill materia por defecto por colegio.
   - Seed inicial en alta de colegio (`src/app/api/admin/colegios/route.ts`).

2. **Backend: repositorio y endpoints de materias**
   - `MateriaRepository` con A/B y soft delete.
   - `GET /api/colegio/materias`, `POST /api/colegio/materias`, `PATCH /api/colegio/materias/[id]`, `PATCH /api/colegio/materias/[id]/estado`.
   - Tests A/B y de estado.

3. **Backend: cursos con materia**
   - Actualizar `CursoRepository` para incluir `materiaId` y validar materia same-tenant/activa.
   - Actualizar `POST /api/colegio/cursos`, `PATCH /api/colegio/cursos/[id]`, `POST /api/colegio/cursos/unificado`.
   - Actualizar schemas Zod (`cursoBodySchema`, `cursoUpdateBodySchema`, `payloadUnificadoSchema`).
   - Actualizar tests existentes de cursos.

4. **Frontend**
   - Página `/dashboard/colegio/materias` para gestionar catálogo.
   - Actualizar listado, edición, alta y wizard de cursos para materia + grupo.
   - Ajustar componentes que muestran `curso.nombre` a mostrar `materia + grupo`.

5. **Integración + arquitectura**
   - Regenerar artefactos de arquitectura (`npm run arch:check` en verde).
   - Gate completo: `tsc`, `lint`, `tokens:check`, `arch:check`, `test:coverage`, `build`.
   - Commit, push a `work/002-pi-061`, PR a `feature/001-scaffolding`.

---

## Decisions & Risks

| Decision | Rationale | Risk / Mitigation |
|----------|-----------|-------------------|
| Grupo = atributo string de `Curso`, no entidad aparte | Mínima complejidad; compatible con datos actuales; suficiente para materia × grupo × grado × año. | Si el CEO define profesor multi-curso N:M, el grupo ya existe como dimensión; solo faltaría la relación. |
| `Curso.nombre` se reinterpreta como grupo, no se renombra columna | Evita migración destructiva y reescritura de queries existentes. | Deuda semántica menor; se documenta en spec y se migra en fase futura si se decide. |
| `materiaId` nullable | Permite cursos existentes sin materia real; el backfill las apunta a "Otra". | Los cursos nuevos exigen materia en API/UI; se degrada a nullable solo en BD. |
| Materia por defecto "Otra" | Garantiza que el backfill no falle y que todos los cursos existentes tengan una materia válida. | El rector debe reclasificar manualmente; se muestra "Otra" en UI para incentivar la edición. |
| Seed inicial al crear colegio | El rector ya tiene catálogo funcional sin pasos extra. | Lista fija; se permite editar/inactivar. |

---

## Acceptance Mapping

| FR | Tests principales |
|----|-------------------|
| FR-001 / FR-002 | `src/lib/dal/repositories/materia.test.ts`, `src/app/api/colegio/materias/route.test.ts` |
| FR-003 / FR-004 / FR-005 | `src/lib/dal/repositories/curso.test.ts`, `src/app/api/colegio/cursos/route.test.ts` |
| FR-006 / FR-008 | `src/app/api/colegio/cursos/route.test.ts`, `src/app/api/colegio/cursos/unificado/route.test.ts` |
| FR-007 | `src/app/api/colegio/materias/route.test.ts` |
| FR-009 | Tests de componente de `CursosPageClient`, `CursoEscritorioClient`, `SeccionCurso` |
| FR-010 | Tests de auditoría en repositorio y API |
