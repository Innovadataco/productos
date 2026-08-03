# Implementation Plan: SPEC-145 — Modelo `Profesor` mínimo

**Branch**: `work/002-pi-058-spec-145` (PR a `feature/001-scaffolding`) | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/145-modelo-profesor/spec.md`

## Summary

Crear el modelo `Profesor` mínimo (brief §7.2) con relación aditiva
`Curso.profesorTitularId` y CRUD `/api/colegio/profesores` tenant-first con baja
suave — sin UI (SPEC-148) y sin retro-asignación. Primera migración tras SPEC-144:
verificación explícita de que el SQL no contiene `DROP INDEX` (I-49, mina del drift
de índices). Cargas: test de `LuzAmbiental` (O-2) y oráculo antitrace con fixture
`M1`/`M2` mayúscula (O-1).

## Technical Context

**Language/Version**: TypeScript 5 (strict) · Node.js >= 22
**Primary Dependencies**: Next.js 16.2.10 · Prisma 5.22.0 · PostgreSQL 16 · Zod
**Storage**: PostgreSQL — tabla nueva `"Profesor"` + columna en `"Curso"` + enum
`AccionAudit` (ADD VALUE)
**Testing**: Vitest (integración secuencial, `.env.test`) — patrón handler + Request;
tests A/B tenant por verbo
**Target Platform**: App Next.js puerto 5005
**Project Type**: Web (App Router + API Routes)
**Constraints**: migración 100% aditiva, cero `DROP INDEX` · tenant-first E-1 en cada
verbo · soft delete · cero tests debilitados · sin UI
**Scale/Scope**: 1 modelo + 1 columna + 3 valores enum · 2 archivos de ruta nuevos +
repo DAL + schemas · ~6 archivos de test nuevos/tocados · 2 cargas de test (O-1/O-2)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **§2.3 Multi-tenant**: `colegioId` en el modelo; repo tenant-first; test A/B por
  verbo (FR-006). ✓
- **§3.1/§3.2 Tipado**: filtros `Prisma.ProfesorWhereInput`; Zod en entrada. ✓
- **§3.3 Nombres**: `Profesor`, `profesorTitularId`, rutas `/profesores` — alineado
  con la terminología §3 del brief. ✓
- **§3.4 Errores**: 400/404/409 canónicos; mensajes humanos. ✓
- **§3.5 Auditoría**: enum `AccionAudit` + 3 valores; `logAudit` en cada mutación. ✓
- **§4.5 Prisma**: FK con índice; migración aditiva y reversible. ✓
- **§5 Testing**: tests A/B nuevos; O-1/O-2 fortalecen/restauran, nada se debilita. ✓
- **Candados brief §6/§7.4**: no tocar motor IA · migración aditiva · tenant-first ·
  I-29 intacto · sin overdiseño (§7.2: nada de materias/contrato/salario). ✓

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/145-modelo-profesor/
├── spec.md              # User Stories, FRs, D1
├── plan.md              # Este archivo
├── research.md          # I-49 (drift), enum ADD VALUE, patrón CRUD
├── data-model.md        # Schema antes/después
├── quickstart.md        # Verificación manual
├── contracts/
│   └── profesores.md    # Contratos de los 4 verbos
├── checklists/
│   └── requirements.md
└── tasks.md             # Stub — /speckit.tasks tras aprobación
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                          # + Profesor, + Curso.profesorTitularId,
│                                          # + AccionAudit COLEGIO_PROFESOR_*
└── migrations/YYYYMMDDHHMMSS_modelo_profesor/
    └── migration.sql                      # ADITIVA — SQL inspeccionado (I-49)

src/
├── lib/
│   ├── dal/repositories/
│   │   ├── profesor.ts                    # NUEVO — tenant-first (SPEC-134)
│   │   ├── profesor.test.ts               # NUEVO — A/B
│   │   └── curso.ts                       # + profesorTitularId (si D1=a)
│   ├── schemas/index.ts                   # + profesorBodySchema
│   └── colegio/permisos.ts                # + verificarPropiedadProfesor (si aplica patrón)
├── app/api/colegio/
│   ├── profesores/route.ts                # GET lista, POST
│   ├── profesores/route.test.ts           # A/B
│   ├── profesores/[id]/route.ts           # GET, PATCH (baja suave)
│   └── profesores/[id]/route.test.ts      # A/B
├── components/ui/
│   └── LuzAmbiental.test.tsx              # O-2
└── app/api/reportes/mis-reportes/[id]/route.test.ts  # O-1 (fixture M1/M2)

docs/architecture/01-modelo-datos.md       # REGENERADO (52 modelos)
scripts/arch/                              # oráculo 51→52 si aplica
```

**Structure Decision**: mismo patrón que `Estudiante` (SPEC-144): repo DAL propio,
rutas bajo `/api/colegio/`, Zod en `src/lib/schemas`, tests junto a cada archivo.

## Fase 0 — Research (ver research.md)

1. I-49: por qué el drift NO debería generar DROP INDEX (diff migrations↔schema, no
   DB real) y cómo verificarlo antes de aplicar.
2. Enum `AccionAudit`: ADD VALUE aditivo en PG16 (precedente reciente).
3. CRUD: patrón exacto de `cursos/[id]/alumnos` (assertModulo, vigencia, rate limit,
   Zod, repo tenant-first, audit).

## Fase 1 — Diseño

- Schema antes/después en `data-model.md`.
- Contratos de los 4 verbos en `contracts/profesores.md`.
- Verificación en `quickstart.md`.

## Fase 2 — Tasks

`/speckit.tasks` tras la aprobación de ZEUS (compuerta §4). Stub en `tasks.md`.

## Complexity Tracking

Sin violaciones de constitución que justificar.
