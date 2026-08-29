# Implementation Plan: SPEC-164 — Identificadores de profesor + profesores en estadísticas

**Branch**: `work/002-pi-0XX` (por definir en radicación) | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

---

## Summary

Añadir la entidad `IdentificadorProfesor` (tabla hija de `Profesor`) con CRUD completo en la ficha del profesor, e incluir el conteo de profesores activos en la home operativa y en la pantalla de estadísticas del colegio. Prepara el terreno para el matching de alertas sobre profesores (Fase C) sin modificar `Curso`, `Estudiante` ni `Profesor`.

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
| §1.2 Solo texto | ✅ Pass | Identificadores son texto + claves foráneas |
| §1.3 Presunción de inocencia | ✅ Pass | No afecta consulta pública; solo registra identificadores para alertas futuras |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual |
| §2.4 Modelo SaaS | ✅ Pass | `IdentificadorProfesor` hereda tenant vía `Profesor.colegioId` |
| §3.1 TypeScript strict | ✅ Pass | Sin `any`; tipos de Prisma |
| §3.5 Logs y auditoría | ✅ Pass | FR-012: audit en identificadores de profesor |
| §4.1 Singletons | ✅ Pass | Reusa `prisma` singleton |
| §4.2 Rutas API individuales | ✅ Pass | Un `route.ts` por método/endpoint |
| I-49 Migraciones aditivas | ✅ Pass | Solo crea tabla `IdentificadorProfesor`; `Curso`/`Estudiante`/`Profesor` no se tocan |

---

## Project Structure

### Documentation (this feature)

```text
specs/164-identificadores-profesor/
├── spec.md
├── plan.md
├── data-model.md
└── tasks.md
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                       # + model IdentificadorProfesor
└── migrations/                         # migración aditiva
src/
├── lib/
│   ├── dal/
│   │   └── repositories/
│   │       ├── identificador-profesor.ts           # NUEVO: CRUD tenant-first + test
│   │       ├── identificador-profesor.test.ts      # NUEVO
│   │       └── profesor.ts                         # + contarActivos (si aún no existe)
│   ├── schemas/index.ts              # + identificadorProfesorBodySchema, identificadorProfesorUpdateBodySchema, identificadorProfesorIdParamsSchema
│   └── colegio/
│       └── permisos.ts               # + verificarPropiedadIdentificadorProfesor
├── app/
│   ├── api/colegio/
│   │   ├── profesores/
│   │   │   └── [id]/
│   │   │       └── identificadores/
│   │   │           └── route.ts      # GET/POST identificadores de un profesor
│   │   └── identificadores-profesor/
│   │       └── [id]/
│   │           ├── route.ts          # PATCH identificador
│   │           └── estado/
│   │               └── route.ts      # PATCH estado
│   └── dashboard/colegio/
│       └── profesores/
│           └── [id]/
│               ├── page.tsx          # NUEVA: ficha del profesor
│               └── ProfesorDetallePageClient.tsx   # NUEVO: gestión de identificadores
└── components/modules/colegio/profesores/
    └── (reutilizar componentes existentes si aplica)
```

---

## Fases

1. **Schema + migración aditiva**
   - Añadir `model IdentificadorProfesor` con FK a `Profesor` y `Plataforma`.
   - Migración aditiva: crear tabla; no modificar `Curso`, `Estudiante` ni `Profesor`.
   - Añadir acciones de audit en `AccionAudit`.

2. **Backend: repositorio y endpoints de identificadores de profesor**
   - `IdentificadorProfesorRepository` con A/B, duplicados, normalización y soft delete.
   - `GET/POST /api/colegio/profesores/[id]/identificadores`.
   - `PATCH /api/colegio/identificadores-profesor/[id]`.
   - `PATCH /api/colegio/identificadores-profesor/[id]/estado`.
   - Tests de API con A/B, duplicados y validaciones.

3. **Backend: conteo de profesores en home y estadísticas**
   - Confirmar que `ProfesorRepository.contar(colegioId)` alimenta la home (ya existe en SPEC-143).
   - Añadir conteo de profesores activos en `calcularEstadisticasColegio`.
   - Actualizar DTO y cliente de estadísticas para mostrar tarjeta.

4. **Frontend: ficha del profesor**
   - Crear `/dashboard/colegio/profesores/[id]` con datos del profesor y listado de identificadores.
   - Modal/formulario para agregar/editar identificadores.
   - Botones de desactivar/reactivar con feedback.
   - Añadir enlace a la ficha desde la lista de profesores (`ProfesoresPageClient`).

5. **Auditoría y arquitectura**
   - Añadir acciones de audit `COLEGIO_IDENTIFICADOR_PROFESOR_CREADO`, `COLEGIO_IDENTIFICADOR_PROFESOR_EDITADO`, `COLEGIO_IDENTIFICADOR_PROFESOR_DESACTIVADO`.
   - Auditar mutaciones en endpoints.
   - Regenerar artefactos de arquitectura (`npm run arch:check` en verde).

6. **Integración**
   - Gate completo: `tsc --noEmit`, `lint`, `tokens:check`, `arch:check`, `test:coverage`, `build`.
   - Commit, push a rama de trabajo, PR a `feature/001-scaffolding`.
   - CI-PUSH verde.

---

## Decisions & Risks

| Decision | Rationale | Risk / Mitigation |
|----------|-----------|-------------------|
| `IdentificadorProfesor` como tabla hija de `Profesor` (1:N) | Mismo patrón que `IdentificadorEstudiante`; coherencia de arquitectura. | Ninguno; el patrón está probado. |
| Sin columna `colegioId` en `IdentificadorProfesor` | El tenant viaja por `profesor.colegioId`, consistente con `IdentificadorEstudiante`. | Para búsquedas cross-tenant de Fase C se incluirá `colegioId` vía el include de Prisma. |
| Soft delete por `estado` | Consistencia con todos los modelos del módulo colegio. | Ninguno; el patrón ya está establecido. |
| Ficha del profesor como página nueva | Hoy la lista edita inline; la ficha necesita espacio para identificadores y futuras secciones. | Reutilizar layout y estilos existentes; añadir un solo enlace en la lista. |
| Reutilizar `normalizarIdentificador`/`inferirTipoIdentificador` | Evita duplicar lógica y mantiene coherencia con identificadores de estudiante. | Verificar que la normalización aplica igual a identificadores de adultos. |
| Conteo de profesores en estadísticas como tarjeta adicional | Mínima intrusión en la UI existente; satisface el brief §6. | Asegurar que no desplaza el diseño responsive; usar grid de 5 columnas en desktop o 2+3 en móvil. |

---

## Acceptance Mapping

| FR | Tests principales |
|----|-------------------|
| FR-001 / FR-002 / FR-003 | `src/lib/dal/repositories/identificador-profesor.test.ts`, `src/app/api/colegio/profesores/[id]/identificadores/route.test.ts` |
| FR-004 / FR-005 | `src/app/api/colegio/identificadores-profesor/[id]/route.test.ts`, `[id]/estado/route.test.ts` |
| FR-006 / FR-007 / FR-008 | Tests de duplicados, tipo inferido y cross-tenant en repositorio y API |
| FR-009 | Tests de regresión de `Curso` y `Estudiante` (no deben cambiar) |
| FR-010 | Tests de `ColegioResumenRepository.homeRector` / snapshot de home |
| FR-011 | `src/lib/colegio/estadisticas.test.ts`, `src/app/api/colegio/estadisticas/route.test.ts` |
| FR-012 | Tests de auditoría en endpoints |
| FR-013 | Tests de componente `ProfesorDetallePageClient` |
