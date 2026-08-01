# Implementation Plan: SPEC-134 — DAL del módulo colegio con tenant obligatorio (E-1)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/134-dal-colegio-tenant-obligatorio/spec.md` (002-PI-056, E-1)

## Summary

Crear los repositorios DAL del dominio colegio (hoy inexistentes) con una regla de
hierro: `colegioId` requerido en TODA firma y presente en TODO `where` (lecturas y
escrituras; escrituras por id = `where: { id, colegioId }`). Migrar los 20 archivos
verificados (14 rutas + 6 módulos) sin cambiar comportamiento, sacándolos de la
allowlist Q-3 en cada commit. La red ya existe: route tests por endpoint + journey
colegio (SPEC-133) + negativos multi-tenant A/B.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: Prisma 5.22 (singleton), patrón DAL SPEC-053 (D1 repo+DTO,
D2 `tx?: Prisma.TransactionClient`, D5 sin schema). Ninguna dependencia nueva.

**Storage**: PostgreSQL 16 — sin cambios de schema (migración de capa, no de datos)

**Testing**: Vitest — route tests y journeys existentes (red, intocados) + tests
unitarios nuevos por repo (tenant en where, update por id ajeno no toca fila)

**Target Platform**: Next.js standalone; mismos handlers, distinto import

**Project Type**: refactor de capa de acceso a datos (comportamiento preservado)

**Performance Goals**: mismas queries (mismos select/include/where); cero N+1 nuevo

**Constraints**: FR-006 — no tocar lógica, proxy, componentes ni schema; hueco real →
PARAR y reportar (protocolo O-1); allowlist Q-3 se actualiza EN EL MISMO commit (E-8)

**Scale/Scope**: 20 archivos (~1.5k líneas de superficie), 5-6 repos nuevos + tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **§6.3 Protección de datos sensibles**: REFUERZO — la PII de menores queda detrás de
  una frontera de tipos (tenant obligatorio), no de disciplina manual.
- **Multi-tenant**: ES la spec — el filtro de tenant se vuelve estructural.
- **Migraciones aditivas**: N/A — sin schema.
- **No debilitar tests**: OK — red intacta; solo se añaden tests.
- **Metodología Spec-Kit**: OK — compuerta §4: spec+plan y PARA.

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/134-dal-colegio-tenant-obligatorio/
├── spec.md
├── plan.md              # este archivo
├── research.md          # inventario verificado de los 20 archivos y sus queries
├── quickstart.md        # cómo añadir un repo tenant-first + regla para futuros
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/lib/dal/repositories/
├── curso.ts                      # NUEVO (+ test)
├── alumno.ts                     # NUEVO (+ test)
├── identificador-alumno.ts       # NUEVO (+ test)
├── alerta-colegio.ts             # NUEVO (+ test)
├── colegio.ts                    # NUEVO (+ test)
└── carga-roster-sesion.ts        # NUEVO (+ test) — mueve sesion-roster.ts al DAL

src/lib/colegio/                  # alertas, estadisticas, permisos, vigencia,
                                  # carga/importer, carga/sesion-roster → consumen repos
src/app/api/colegio/** (13 rutas) + src/app/api/me/colegio/route.ts
                                  # → consumen repos (mismo comportamiento)
scripts/arch/prisma-directo-allowlist.json   # 70 → 50 en los mismos commits
```

## Data Model

N/A — no cambia schema ni entidades; es un cambio de capa de acceso (misma BD, mismos
modelos). Sin migración.

## Contracts

N/A — los endpoints conservan request/response exactos; la red de route tests lo afirma.

## Diseño: tenant obligatorio por construcción

1. **Firma tenant-first**: toda función del repo empieza `colegioId: string` (o lo
   recibe en un objeto requerido). Sin sobrecarga sin tenant.
2. **Escrituras por id compuestas**: `update`/`delete` por PK van como
   `updateMany({ where: { id, colegioId } })` con `count` verificado (0 →
   `AppError 404`), o `update({ where: { id_colegioId: { id, colegioId } } })` cuando
   exista índice único compuesto. Nunca `update({ where: { id } })` desnuda.
3. **Lecturas**: `where: { colegioId, ...filtros }` construido dentro del repo; el
   llamador pasa filtros tipados, no un `Prisma.CursoWhereInput` libre que pueda pisar
   el tenant.
4. **Excepción documentada**: funciones que operan sobre `Colegio` mismo (p.ej.
   `obtenerColegio(colegioId)`) usan el id como propio tenant — misma regla.

## Fases de implementación (resumen para tasks)

1. **Repos base + tests**: `colegio`, `curso`, `alumno`, `identificador-alumno`,
   `alerta-colegio`, `carga-roster-sesion` con sus tests unitarios (FR-001/FR-002).
2. **Migrar `src/lib/colegio/`** (6 módulos) a los repos — commit con su salida de la
   allowlist.
3. **Migrar rutas** `api/colegio/**` + `api/me/colegio` — commit(s) con salida de la
   allowlist por grupo (cursos/alumnos/identificadores · alertas/auditoría/stats ·
   carga).
4. **Gates + cierre**: suite completa, tsc, lint, build, arch:check, allowlist en 50,
   cierre documental.

Cada fase: suite de los tests afectados + ratchet Q-3 en verde antes de seguir. Si en
cualquier punto aparece una query que hoy NO filtra por tenant donde debería → PARAR y
reportar (FR-006).
