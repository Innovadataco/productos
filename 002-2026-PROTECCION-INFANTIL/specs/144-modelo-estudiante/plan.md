# Implementation Plan: SPEC-144 — Modelo `Estudiante` expandido (rename desde `Alumno`)

**Branch**: `work/002-pi-058-spec-144` (PR a `feature/001-scaffolding`) | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/144-modelo-estudiante/spec.md`

## Summary

Renombrar el modelo `Alumno → Estudiante` (con cascada a `IdentificadorEstudiante`,
enum `EtiquetaRelacionEstudiante` y todas las relaciones) usando `@@map`/`@map` para
conservar intactos los nombres físicos de tablas, columnas y enum — migración 100%
aditiva, cero pérdida de datos. Encima, expandir la ficha con `apellidos` (default
`""`), `documentoTipo?`, `documentoNumero?` y soporte de hasta 2 acudientes (decisión
D1), con backfill idempotente por construcción (DEFAULT + NULLs en la propia
migración). La cascada de código cubre DAL, rutas, lib y tests (29 archivos en `src/`
+ `scripts/arch/`). Sin cambios visibles de UI: los campos nuevos los consumen specs
posteriores.

## Technical Context

**Language/Version**: TypeScript 5 (strict) · Node.js >= 22
**Primary Dependencies**: Next.js 16.2.10 · Prisma 5.22.0 · PostgreSQL 16 (pgvector)
**Storage**: PostgreSQL — tablas físicas `"Alumno"`, `"IdentificadorAlumno"`, enum
físico `"EtiquetaRelacionAlumno"` (migración `20260721060000_add_colegio_cursos_alumnos`)
**Testing**: Vitest (integración secuencial sobre `proteccion_infantil_test`,
`.env.test`) — patrón: importar handler + `Request` nativo
**Target Platform**: App Next.js puerto 5005 + worker pg-boss
**Project Type**: Web (App Router + API Routes)
**Performance Goals**: migración metadata-only (ADD COLUMN con DEFAULT constante =
sin reescritura de tabla en PG ≥ 11)
**Constraints**: migraciones ADITIVAS y REVERSIBLES · multi-tenant §2.3 en cada verbo
(E-1/SPEC-134) · cero tests debilitados · `arch:check` verde en el mismo PR
**Scale/Scope**: 3 modelos + 1 enum renombrados · 29 archivos `src/` + 1 script arch ·
~10 archivos de test ajustados · 1 migración nueva

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **§1.2 Solo texto**: N/A (no se añade multimedia). ✓
- **§1.3 Presunción de inocencia**: N/A (sin UI pública). ✓
- **§2.3 Multi-tenant**: toda query nueva/renombrada mantiene `colegioId` de sesión;
  test A/B dos colegios por verbo tocado (FR-009). ✓
- **§3.1/§3.2 Tipado estricto**: filtros `Prisma.EstudianteWhereInput`, cero `any`. ✓
- **§3.3 Nombres**: el rename ALINEA el código con la terminología mandada (brief §3). ✓
- **§3.4 Errores**: 400/404 canónicos con `AppError`; mensajes humanos en validación. ✓
- **§3.5 Auditoría**: no se añaden mutaciones nuevas de negocio; las existentes
  conservan su `AuditLog`. ✓
- **§3.6 Validación**: Zod en altas; `apellidos` requerido, resto opcional. ✓
- **§4.5 Prisma**: `@@map`/`@map` para conservar físico; `@@index`/`@@unique`
  intactos; FK con índice. ✓
- **§5 Testing**: tests actualizados FORTALECIENDO contrato (envían `apellidos`);
  A/B tenant en cada verbo. ✓
- **Candados del brief §6/§7.4**: migración aditiva+reversible, backfill idempotente,
  no tocar motor IA, reusar patrones SPEC-134/137, I-29 intacto (sin scores en
  ninguna salida). ✓

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/144-modelo-estudiante/
├── spec.md              # Este feature (User Stories, FRs, D1-D4)
├── plan.md              # Este archivo
├── research.md          # Phase 0: decisiones técnicas del rename/migración
├── data-model.md        # Phase 1: schema antes/después
├── quickstart.md        # Phase 1: verificación manual
├── contracts/           # Phase 1: contratos de endpoints de alta (cambian validación)
│   └── altas-estudiante.md
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec
└── tasks.md             # Stub — se detalla en /speckit.tasks tras aprobación de ZEUS
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                          # rename + campos nuevos + @@map/@map
└── migrations/YYYYMMDDHHMMSS_estudiante_expande/  # NUEVA, aditiva
    └── migration.sql                      # ADD COLUMN solamente

src/
├── lib/dal/repositories/
│   ├── estudiante.ts                      # rename de alumno.ts
│   ├── identificador-estudiante.ts        # rename de identificador-alumno.ts
│   ├── alerta-colegio.ts                  # relaciones renombradas
│   └── *.test.ts                          # tests de repos (A/B tenant)
├── lib/colegio/
│   ├── alertas.ts                         # resolución identificador→estudiante→colegio
│   ├── patrones.ts                        # relaciones renombradas (sin cambio de lógica)
│   └── carga/                             # parser/validator/importer/sesion-roster
│       # + columna apellidos en plantilla (según D4)
├── app/api/colegio/
│   ├── alumnos/[id]/*.ts                  # código interno renombrado (paths según D2)
│   ├── cursos/[id]/alumnos/route.ts       # validación: apellidos obligatorio
│   ├── identificadores/[id]/*.ts          # enum nuevo
│   └── carga/confirmar/route.ts           # alta con apellidos
├── app/api/admin/colegios/[id]/cursos/**  # tests A/B actualizados
└── app/dashboard/colegio/**               # componentes: tipos/props renombrados
                                           # (rename de archivos de página NO: los
                                           # reemplaza SPEC-146)

scripts/arch/generar-modelo-datos.ts       # comentario/referencia al modelo
docs/architecture/01-modelo-datos.md       # REGENERADO (nunca a mano)
```

**Structure Decision**: rename en el sitio (mismos directorios, mismos patrones DAL de
SPEC-134). Los paths de URL se conservan (D2 recomendación). Los componentes de página
que SPEC-146 reemplazará (`AlumnoDetallePageClient.tsx` etc.) solo actualizan
tipos/props — NO se renombran archivos destinados a desaparecer.

## Fase 0 — Research (ver research.md)

Decisiones tomadas:
1. **Rename sin tocar físico** vía `@@map` (modelo/enum) + `@map` (campo/valor) —
   soportado por Prisma 5.22; el diff SQL resultante es solo los `ADD COLUMN` nuevos.
2. **Backfill = la propia migración**: `apellidos String @default("")` materializa el
   backfill de forma idempotente (metadata-only en PG16, sin rewrite); no hace falta
   script aparte.
3. **`documentoTipo` como `String?` + set cerrado en Zod** (incluye `TI`, ausente del
   enum de comité) — pendiente de D3.
4. **Acudientes**: modelo hijo `AcudienteEstudiante` recomendado — pendiente de D1.

## Fase 1 — Diseño (ver data-model.md, contracts/, quickstart.md)

- Schema antes/después completo en `data-model.md`.
- Contratos de los endpoints de alta (cambio de validación) en `contracts/`.
- Verificación manual en `quickstart.md`.

## Fase 2 — Tasks

`/speckit.tasks` tras la aprobación de ZEUS (compuerta §4). Stub en `tasks.md`.

## Complexity Tracking

Sin violaciones de constitución que justificar.
