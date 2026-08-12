# Cierre: SPEC-163 — Acudiente completo: identificadores + edición post-alta

**Fecha**: 2026-08-12 · **Radicado**: 002-PI-062 · **Spec**: [spec.md](./spec.md)

## Evidencia

- **Rama de trabajo**: `work/002-pi-062`.
- **Commits en `work/002-pi-062`**: `45804760` implementación de Fase A · `aeb1fe8e` ajustes de disciplina Spec-Kit en fases B-G.
- **PR a `feature/001-scaffolding`**: pendiente.
- **Gate local** (verificado previo al push):
  - `npx tsc --noEmit` ✅
  - `npm run lint` ✅ (0 errores, warnings preexistentes)
  - `npm run tokens:check` ✅
  - `npm run arch:check` ✅
  - `npm run test` ✅ (2002 passed, 1 skipped)
  - `npm run build` ✅

## Qué se entregó (FR → evidencia)

- **FR-001/FR-002**: `AcudienteEstudianteRepository` en `src/lib/dal/repositories/acudiente-estudiante.ts` con CRUD, límite de 2 acudientes activos por estudiante, validación de orden único activo y cascada de estado; tests en `acudiente-estudiante.test.ts`.
- **FR-003**: `IdentificadorAcudienteRepository` en `src/lib/dal/repositories/identificador-acudiente.ts` con CRUD, normalización/inferencia de tipo y detección de duplicados; tests en `identificador-acudiente.test.ts`.
- **FR-004**: validación en `AcudienteEstudianteRepository.crear` que rechaza un tercer acudiente activo.
- **FR-005**: migración aditiva `20260812051055_spec_163_acudiente_completo` añade columna `estado` a `AcudienteEstudiante`.
- **FR-006**: `cambiarEstado` del acudiente inactiva en cascada los identificadores activos.
- **FR-007**: `@@unique([acudienteId, tipo, valor, plataformaId])` en `IdentificadorAcudiente`.
- **FR-008**: normalización e inferencia de tipo reutilizando helpers de `IdentificadorEstudiante`.
- **FR-009**: endpoints en `src/app/api/colegio/alumnos/[id]/acudientes/**` con tests.
- **FR-010**: endpoints en `src/app/api/colegio/acudientes/[id]/identificadores/**` con tests.
- **FR-011**: sección `SeccionAcudientes` en `/dashboard/colegio/alumnos/[id]`; integración en `AlumnoDetallePageClient.tsx`.
- **FR-012**: conteos de acudientes activos en `HomeRectorPage`, `CursoEscritorioClient`, `TarjetasCurso` y agregados `colegio-resumen.ts` / `estudiante.ts`.
- **FR-013**: auditoría con acciones `COLEGIO_ACUDIENTE_*` e `COLEGIO_IDENTIFICADOR_ACUDIENTE_*`.
- **FR-014**: `Curso` y `Estudiante.cursoId` no se tocan.
- **FR-015**: sin cambios en `src/lib/ai/**`.

## Migración y modelo

- Migración aditiva: `prisma/migrations/20260812051055_spec_163_acudiente_completo/`.
- Schema: `AcudienteEstudiante` + `estado`; tabla nueva `IdentificadorAcudiente`.
- Oráculo de modelos actualizado a **61** (`scripts/arch/schema-prisma.test.ts`).

## Infraestructura de tests

- `src/lib/test-utils.ts`: orden de limpieza corregido (`identificadorAcudiente` antes de `acudienteEstudiante`; `perfilOperador` antes de `usuario`; módulos hijos antes que padres).
- `vitest.config.ts`: `sequence: { concurrent: false }` para evitar race conditions dentro de cada archivo sobre la BD compartida.
- `src/lib/dal/repositories/acudiente-estudiante.test.ts`: test de reactivación ajustado a 409 cuando el acudiente ya está activo.

## Deuda técnica

- Ninguna desviación funcional. El motor (`src/lib/ai/**`) no se tocó.
- `dev-restart.sh` pendiente de ejecución por el CEO/ops al desplegar.
