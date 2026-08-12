# Implementation Plan: SPEC-163 — Acudiente completo: identificadores + edición post-alta + conteo

**Branch**: `work/002-pi-062` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

---

## Summary

Completar el modelo del acudiente: añadir `IdentificadorAcudiente` (N:M con `AcudienteEstudiante`), permitir alta/edición/inactivación de acudientes desde la ficha del estudiante, y contar acudientes activos en los KPIs del colegio. Esto cierra el caso `300DEMOACU005820` y prepara el matching de alertas de la Fase C. No se modifica `Curso` ni `Estudiante.cursoId`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, Tailwind CSS 3.4 |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Multi-tenant** | `colegioId` obligatorio en todas las lecturas/escrituras de `IdentificadorAcudiente` (DAL E-1 / SPEC-134); `AcudienteEstudiante` mantiene tenant vía `estudiante.colegioId` |
| **Transaction boundary** | `withUnitOfWork` para operaciones que tocan acudiente + identificadores |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | Acudientes e identificadores son texto y metadatos |
| §1.3 Presunción de inocencia | ✅ Pass | No afecta consulta pública; los datos son internos del colegio |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual |
| §2.4 Modelo SaaS | ✅ Pass | `IdentificadorAcudiente` es colegio-scoped; `AcudienteEstudiante` sigue el patrón tenant-first vía estudiante |
| §3.1 TypeScript strict | ✅ Pass | Sin `any`; tipos de Prisma |
| §3.5 Logs y auditoría | ✅ Pass | FR-013: audit en acudientes e identificadores de acudiente |
| §4.1 Singletons | ✅ Pass | Reusa `prisma` singleton |
| §4.2 Rutas API individuales | ✅ Pass | Un `route.ts` por método/endpoint |
| I-49 Migraciones aditivas | ✅ Pass | Solo añade `estado` a `AcudienteEstudiante` y crea `IdentificadorAcudiente`; `Curso` y `Estudiante.cursoId` no se tocan |

---

## Project Structure

### Documentation (this feature)

```text
specs/163-acudiente-completo/
├── spec.md
├── plan.md
├── data-model.md
└── tasks.md
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                              # + estado en AcudienteEstudiante, + model IdentificadorAcudiente
└── migrations/                                # migración aditiva
src/
├── lib/
│   ├── dal/
│   │   └── repositories/
│   │       ├── acudiente-estudiante.ts        # NUEVO: CRUD tenant-first + conteos + test
│   │       ├── acudiente-estudiante.test.ts   # NUEVO
│   │       ├── identificador-acudiente.ts     # NUEVO: CRUD + búsqueda cross-tenant + test
│   │       ├── identificador-acudiente.test.ts# NUEVO
│   │       ├── estudiante.ts                  # ACTUALIZAR: contarCobertura considera acudientes activos
│   │       └── colegio-resumen.ts             # ACTUALIZAR: KPI acudientes en home y curso
│   ├── schemas/index.ts                       # + acudienteBodySchema, acudienteUpdateSchema, identificadorAcudienteBodySchema, etc.
│   └── colegio/
│       └── permisos.ts                        # + verificarPropiedadAcudiente (helper A/B)
├── app/
│   ├── api/colegio/
│   │   ├── alumnos/
│   │   │   └── [id]/
│   │   │       └── acudientes/
│   │   │           ├── route.ts               # GET/POST
│   │   │           └── [acudienteId]/
│   │   │               ├── route.ts           # PATCH
│   │   │               └── estado/
│   │   │                   └── route.ts       # PATCH estado
│   │   ├── acudientes/
│   │   │   └── [id]/
│   │   │       └── identificadores/
│   │   │           ├── route.ts               # GET/POST
│   │   │           └── [identificadorId]/
│   │   │               ├── route.ts           # PATCH
│   │   │               └── estado/
│   │   │                   └── route.ts       # PATCH estado
│   │   └── identificadores-acudiente/
│   │       └── [id]/
│   │           ├── route.ts                   # PATCH (alias corto para edición)
│   │           └── estado/
│   │               └── route.ts               # PATCH estado
│   └── dashboard/colegio/
│       └── alumnos/[id]/
│           └── SeccionAcudientes.tsx          # NUEVO: gestión de acudientes + identificadores
└── components/modules/colegio/curso/
    └── TablaEstudiantes.tsx                   # ACTUALIZAR: mostrar conteo de acudientes activos (opcional)
```

> **Nota sobre rutas**: la edición/estado de un identificador de acudiente puede exponerse también por `/api/colegio/acudientes/[id]/identificadores/[identificadorId]` si se prefiere consistencia total. La clave es no dejar el `id` del identificador sin validación de tenant.

---

## Fases

1. **Schema + migración aditiva**
   - Añadir `estado` a `AcudienteEstudiante`.
   - Añadir `model IdentificadorAcudiente` con FKs, índices y `colegioId` denormalizado.
   - Generar migración aditiva; no tocar `Curso` ni `Estudiante`.

2. **Backend: repositorios**
   - `AcudienteEstudianteRepository`: listar por estudiante, crear, actualizar, cambiar estado, conteos (colegio/curso/estudiante).
   - `IdentificadorAcudienteRepository`: CRUD tenant-first, duplicados, normalización/inferencia de tipo, búsqueda cross-tenant `buscarActivosPorValor` (preparación Fase C).
   - Tests de ambos repositorios: A/B, duplicados, cascada de inactivación.

3. **Backend: endpoints de acudientes**
   - `GET/POST /api/colegio/alumnos/[id]/acudientes`.
   - `PATCH /api/colegio/alumnos/[id]/acudientes/[acudienteId]`.
   - `PATCH /api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado`.
   - Tests de API con A/B, máximo 2 y validaciones.

4. **Backend: endpoints de identificadores de acudiente**
   - `GET/POST /api/colegio/acudientes/[id]/identificadores`.
   - `PATCH /api/colegio/acudientes/[id]/identificadores/[identificadorId]` y `/estado`.
   - Tests de API con A/B y duplicados.

5. **Frontend y conteos**
   - Sección de acudientes en la ficha del estudiante: listado, alta, edición, inactivar, gestión de identificadores.
   - Actualizar `ColegioResumenRepository.homeRector` y `cursoDetalle` para incluir conteos de acudientes.
   - Actualizar componentes de home/curso que muestran KPIs y cobertura.

6. **Auditoría y arquitectura**
   - Añadir acciones de audit `COLEGIO_ACUDIENTE_CREADO`, `COLEGIO_ACUDIENTE_EDITADO`, `COLEGIO_ACUDIENTE_DESACTIVADO`, `COLEGIO_ACUDIENTE_REACTIVADO`, `COLEGIO_IDENTIFICADOR_ACUDIENTE_CREADO`, `COLEGIO_IDENTIFICADOR_ACUDIENTE_EDITADO`, `COLEGIO_IDENTIFICADOR_ACUDIENTE_DESACTIVADO`, `COLEGIO_IDENTIFICADOR_ACUDIENTE_REACTIVADO`.
   - Auditar mutaciones en endpoints.
   - Regenerar artefactos de arquitectura (`npm run arch:check` en verde).

7. **Integración**
   - Gate completo: `tsc --noEmit`, `lint`, `tokens:check`, `arch:check`, `test:coverage`, `build`.
   - Commit, push a `work/002-pi-062`, PR a `feature/001-scaffolding`.
   - CI-PUSH verde.

---

## Decisions & Risks

| Decision | Rationale | Risk / Mitigation |
|----------|-----------|-------------------|
| `AcudienteEstudiante` gana `estado` | Permite inactivación lógica y libera el slot de `orden` para reasignación. | Migración aditiva simple (`@default("activo")`). Los acudientes existentes quedan activos. |
| `IdentificadorAcudiente` con `colegioId` denormalizado | Facilita validaciones de tenant, queries de KPI y búsqueda cross-tenant de alertas (Fase C). | Mantener sincronizado: siempre se copia `colegioId` del estudiante del acudiente. |
| `@@unique([estudianteId, orden, estado])` | Permite un acudiente activo e inactivo con el mismo orden, bloqueando dos activos. | Revisar lógica de reactivación para no violar el máximo de 2 activos. |
| No tocar `telefono`/`email` existentes | Evita romper la UI/contactos actuales y la carga masiva. | El rector debe registrar explícitamente los identificadores de alerta; documentar en UI. |
| Búsqueda cross-tenant `buscarActivosPorValor` en repo | Replica el patrón de `IdentificadorEstudianteRepository` para la Fase C. | Documentar la excepción de A/B en la cabecera del repo. |
| No modificar `AlertaColegio` ahora | Fase C se encarga del matching extendido y de la generalización del modelo de alertas. | Esta fase solo crea datos; no genera alertas de acudiente todavía. |

---

## Acceptance Mapping

| FR | Tests principales |
|----|-------------------|
| FR-001 / FR-005 | Migración + `prisma/schema.prisma` + `AcudienteEstudianteRepository` |
| FR-002 / FR-004 | `src/lib/dal/repositories/acudiente-estudiante.test.ts`, `src/app/api/colegio/alumnos/[id]/acudientes/route.test.ts` |
| FR-003 / FR-007 / FR-008 | `src/lib/dal/repositories/identificador-acudiente.test.ts`, `src/app/api/colegio/acudientes/[id]/identificadores/route.test.ts` |
| FR-006 | Tests de cascada en `acudiente-estudiante.test.ts` |
| FR-009 / FR-010 | Tests de API correspondientes |
| FR-011 | `src/lib/dal/repositories/colegio-resumen.test.ts`, componentes `SeccionAcudientes`, `AnillosProteccion` |
| FR-012 / FR-013 | Tests de auditoría + verificación de que `Curso` y `Estudiante.cursoId` no cambian |
| FR-014 | Tests A/B de todos los endpoints y repositorios |
| FR-015 | Revisión de diff (no archivos bajo `src/lib/ai/**`) |
