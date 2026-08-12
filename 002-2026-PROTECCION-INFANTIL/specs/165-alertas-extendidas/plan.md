# Implementation Plan: SPEC-165 — Alertas extendidas: matching sobre profesor/acudiente + tipo de sujeto

**Branch**: `work/002-pi-XXX` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

---

## Summary

Extender el matching de alertas del colegio para que `notificarColegioSiCorresponde` cruce el identificador reportado contra estudiantes, profesores y acudientes registrados, y marcar cada `AlertaColegio` con el tipo de sujeto (`ESTUDIANTE | PROFESOR | ACUDIENTE`). Se mantiene la privacidad (nunca contenido ni denunciante), el aislamiento por `colegioId` y el pipeline de avisos existente.

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
| **Worker** | pg-boss; post-hook en `scripts/worker-reportes.mjs` |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | Matching sobre valores de identificadores de texto |
| §1.3 Presunción de inocencia | ✅ Pass | La alerta sigue siendo descriptiva; no se afecta la consulta pública |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual |
| §2.4 Modelo SaaS | ✅ Pass | Todo colegio-scoped |
| §3.1 TypeScript strict | ✅ Pass | Sin `any`; tipos de Prisma |
| §3.5 Logs y auditoría | ✅ Pass | FR-013: audit en creación/cambio de alertas |
| §4.1 Singletons | ✅ Pass | Reusa `prisma` singleton |
| §4.2 Rutas API individuales | ✅ Pass | Un `route.ts` por endpoint |
| I-49 Migraciones aditivas | ✅ Pass | Solo ALTER COLUMN nullable + ADD COLUMN/CONSTRAINT/RELATION en `AlertaColegio`; `Curso` y `Estudiante` no se tocan |

---

## Project Structure

### Documentation (this feature)

```text
specs/165-alertas-extendidas/
├── spec.md
├── plan.md
├── data-model.md
├── tasks.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                       # + tipoSujeto, + identificadorProfesorId/AcudienteId, + relaciones/constraints
└── migrations/                         # migración aditiva: ALTER COLUMN nullable + ADD COLUMN + ADD CONSTRAINT + backfill
src/
├── lib/
│   ├── dal/
│   │   └── repositories/
│   │       ├── alerta-colegio.ts       # MOD: adaptar includes, agregaciones y dedupe para tres tipos
│   │       ├── alerta-colegio.test.ts  # MOD: tests de tipos y backfill
│   │       ├── identificador-profesor.ts      # NUEVO (o prerrequisito Fase B): búsqueda cross-tenant por valor
│   │       └── identificador-acudiente.ts     # NUEVO (o prerrequisito Fase A): búsqueda cross-tenant por valor
│   ├── colegio/
│   │   ├── alertas.ts                  # MOD: notificarColegioSiCorresponde consulta 3 repos
│   │   ├── alertas.test.ts             # MOD: tests de matching triple
│   │   └── avisos.ts                   # SIN cambios funcionales (pipeline se mantiene)
│   └── schemas/index.ts                # + schema de filtro por tipoSujeto si aplica
├── app/
│   ├── api/colegio/
│   │   └── alertas/
│   │       ├── route.ts                # MOD: listado incluye tipoSujeto y filtro
│   │       ├── route.test.ts           # MOD
│   │       └── [id]/
│   │           ├── route.ts            # MOD: detalle expone tipoSujeto
│   │           └── route.test.ts       # MOD
│   └── dashboard/colegio/
│       └── alertas/
│           └── page.tsx                # MOD: columna/filtro tipo de sujeto
└── components/modules/colegio/alertas/ # MOD: mostrar tipo de sujeto en tarjetas/filas
```

---

## Fases

1. **Schema + migración aditiva**
   - Añadir `tipoSujeto` (`String` o enum) a `AlertaColegio`.
   - Hacer `identificadorEstudianteId` nullable.
   - Añadir `identificadorProfesorId` e `identificadorAcudienteId` con relaciones opcionales.
   - Añadir unique constraints por tipo de sujeto.
   - Backfill `tipoSujeto = ESTUDIANTE` para alertas históricas.

2. **Backend: repositorios de identificadores**
   - Asegurar/crear `IdentificadorProfesorRepository.buscarActivosPorValor`.
   - Asegurar/crear `IdentificadorAcudienteRepository.buscarActivosPorValor`.
   - Tests A/B y de búsqueda insensible.

3. **Backend: extender AlertaColegioRepository**
   - Adaptar `INCLUDE_LISTADO` para soportar los tres vínculos.
   - Adaptar métodos de agregación (contarVisiblesPorCursoIds, contarReportesDistintos*, topCursosPorReportes, resumenMensual, porCursoMensual) para considerar solo alertas de estudiante cuando el join va a `Alumno.cursoId`.
   - Añadir helpers para listar/filtrar por `tipoSujeto`.

4. **Backend: extender `notificarColegioSiCorresponde`**
   - Consultar los tres repositorios de identificadores.
   - Crear alerta con `tipoSujeto` y FK correcta.
   - Mantener idempotencia y cross-tenant.

5. **Frontend/API**
   - Exponer `tipoSujeto` en listado y detalle de alertas.
   - Añadir filtro por tipo de sujeto.
   - Ajustar el detalle para no mostrar curso cuando no aplica.

6. **Auditoría y arquitectura**
   - Incluir `tipoSujeto` en el `valorNuevo` de `COLEGIO_ALERTA_CREADA`.
   - Regenerar artefactos de arquitectura (`npm run arch:check` en verde).

7. **Integración**
   - Gate completo: `tsc`, `lint`, `test:coverage`, `build`, `arch:check`.
   - Commit, push a rama de trabajo, PR a `feature/001-scaffolding`.
   - CI-PUSH verde.

---

## Decisions & Risks

| Decision | Rationale | Risk / Mitigation |
|----------|-----------|-------------------|
| `identificadorEstudianteId` nullable | Necesario porque las alertas de profesor/acudiente no tienen estudiante. | Backfill obligatorio; queries SQL crudas deben manejar NULLs o filtrar por tipo. |
| Tres FKs opcionales + `tipoSujeto` | Explícito, mantiene integridad referencial y permite constraints por tipo. | Validación en creación para garantizar coherencia; tests de integridad. |
| String vs enum para `tipoSujeto` | Si el proyecto prefiere enums de Prisma, usar `enum TipoSujetoAlerta`; si prefiere strings cerrados, usar `String` con validación Zod. | Documentar la decisión en la migración; cambiar requiere migración aditiva. |
| Matching cross-tenant intencional | Igual patrón existente: cada colegio que registró el identificador debe ser avisado. | Ninguno; el repo `buscarActivosPorValor` ya documenta la excepción. |
| No tocar `Curso` ni `Estudiante.cursoId` | Candado del brief y de SPEC-162. | Cero riesgo de romper roster/materias. |
| Reusar pipeline de avisos | SPEC-149 ya es idempotente por reporte; no se necesitan eventos nuevos. | Verificar que `evaluarUmbralesPorAlerta` no asuma estudiante (usar `reporteId` genérico). |

---

## Acceptance Mapping

| FR | Tests principales |
|----|-------------------|
| FR-001 / FR-002 / FR-003 / FR-004 / FR-005 | `src/lib/colegio/alertas.test.ts`, `src/lib/dal/repositories/alerta-colegio.test.ts` |
| FR-006 | `alerta-colegio.test.ts` (dedupe por tipo) |
| FR-007 | Migración de test + test de lectura de alertas históricas |
| FR-008 | `src/app/api/colegio/alertas/route.test.ts`, `src/app/api/colegio/alertas/[id]/route.test.ts` |
| FR-009 | `src/lib/colegio/avisos.test.ts` (regresión con alerta de profesor/acudiente) |
| FR-010 | `src/lib/dal/repositories/seguimiento-caso.test.ts` |
| FR-011 | `src/lib/colegio/patrones.test.ts` (regresión) |
| FR-012 | Test de migración y regresión de `Curso`/`Estudiante` |
| FR-013 | Tests de auditoría en `alertas.test.ts` |
