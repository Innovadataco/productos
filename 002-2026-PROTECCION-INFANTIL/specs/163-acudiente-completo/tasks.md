# Tasks: SPEC-163 — Acudiente completo: identificadores + edición post-alta + conteo

**Orden**: por dependencias. TDD donde aplica.

## T001 — Schema y migración aditiva
- [ ] Añadir `estado` al modelo `AcudienteEstudiante` en `prisma/schema.prisma`.
- [ ] Añadir `model IdentificadorAcudiente` con FKs a `AcudienteEstudiante`, `Colegio` y `Plataforma`, `colegioId` denormalizado, unique e índices.
- [ ] Asegurar que `Curso` y `Estudiante` NO se modifican.
- [ ] Generar migración aditiva que añada `estado` y cree `IdentificadorAcudiente`.
- [ ] Ejecutar `npx prisma migrate dev` y `npx prisma generate`.

**Archivos objetivo**: `prisma/schema.prisma`, `prisma/migrations/`

## T002 — Repositorio AcudienteEstudiante
- [ ] Crear `src/lib/dal/repositories/acudiente-estudiante.ts`.
- [ ] Implementar: listar por estudiante, crear, actualizar, cambiar estado, contar por colegio/curso/estudiante.
- [ ] Validar máximo 2 acudientes activos y orden 1|2.
- [ ] Inactivar en cascada los `IdentificadorAcudiente` al inactivar un acudiente.
- [ ] Test `src/lib/dal/repositories/acudiente-estudiante.test.ts`: CRUD + A/B + máximo 2 + cascada.

**Archivos objetivo**: `src/lib/dal/repositories/acudiente-estudiante.ts`, `src/lib/dal/repositories/acudiente-estudiante.test.ts`

## T003 — Repositorio IdentificadorAcudiente
- [ ] Crear `src/lib/dal/repositories/identificador-acudiente.ts`.
- [ ] Implementar: listar por acudiente, crear, actualizar, cambiar estado, buscar duplicados.
- [ ] Implementar `buscarActivosPorValor(valor)` (cross-tenant) para la Fase C.
- [ ] Reutilizar `normalizarIdentificador` e `inferirTipoIdentificador`.
- [ ] Test `src/lib/dal/repositories/identificador-acudiente.test.ts`: CRUD + A/B + duplicados + búsqueda cross-tenant.

**Archivos objetivo**: `src/lib/dal/repositories/identificador-acudiente.ts`, `src/lib/dal/repositories/identificador-acudiente.test.ts`

## T004 — Endpoints de acudientes
- [ ] `GET /api/colegio/alumnos/[id]/acudientes`.
- [ ] `POST /api/colegio/alumnos/[id]/acudientes`.
- [ ] `PATCH /api/colegio/alumnos/[id]/acudientes/[acudienteId]`.
- [ ] `PATCH /api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado`.
- [ ] Tests de API con A/B, máximo 2 y validaciones.

**Archivos objetivo**: `src/app/api/colegio/alumnos/[id]/acudientes/route.ts`, `src/app/api/colegio/alumnos/[id]/acudientes/[acudienteId]/route.ts`, `src/app/api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado/route.ts`, y sus `.test.ts`.

## T005 — Endpoints de identificadores de acudiente
- [ ] `GET /api/colegio/acudientes/[id]/identificadores`.
- [ ] `POST /api/colegio/acudientes/[id]/identificadores`.
- [ ] `PATCH /api/colegio/acudientes/[id]/identificadores/[identificadorId]`.
- [ ] `PATCH /api/colegio/acudientes/[id]/identificadores/[identificadorId]/estado`.
- [ ] Tests de API con A/B y duplicados.

**Archivos objetivo**: `src/app/api/colegio/acudientes/[id]/identificadores/route.ts`, `src/app/api/colegio/acudientes/[id]/identificadores/[identificadorId]/route.ts`, `src/app/api/colegio/acudientes/[id]/identificadores/[identificadorId]/estado/route.ts`, y sus `.test.ts`.

## T006 — Frontend de acudientes en ficha del estudiante
- [ ] Crear `src/app/dashboard/colegio/alumnos/[id]/SeccionAcudientes.tsx` para listar, agregar, editar e inactivar acudientes.
- [ ] Integrar gestión de identificadores dentro de cada acudiente (alta, edición, inactivar).
- [ ] Usar `router.refresh()` tras mutaciones.
- [ ] Tests de componente si aplica.

**Archivos objetivo**: `src/app/dashboard/colegio/alumnos/[id]/SeccionAcudientes.tsx`, `src/app/dashboard/colegio/alumnos/[id]/AlumnoDetallePageClient.tsx`

## T007 — Conteos de acudientes en KPIs
- [ ] Actualizar `src/lib/dal/repositories/estudiante.ts` (`contarCobertura`) para contar solo acudientes activos.
- [ ] Actualizar `src/lib/dal/repositories/colegio-resumen.ts` para incluir total de acudientes activos en `homeRector` y `cursoDetalle`.
- [ ] Actualizar UI de home y escritorio de curso para mostrar el nuevo KPI.
- [ ] Tests de regresión y de conteos.

**Archivos objetivo**: `src/lib/dal/repositories/estudiante.ts`, `src/lib/dal/repositories/colegio-resumen.ts`, `src/app/dashboard/colegio/page.tsx`, `src/app/dashboard/colegio/cursos/[id]/CursoEscritorioClient.tsx`

## T008 — Auditoría y arquitectura
- [ ] Añadir acciones de audit para `AcudienteEstudiante` e `IdentificadorAcudiente` en `prisma/schema.prisma`.
- [ ] Emitir `AuditLog` en todos los endpoints de mutación.
- [ ] Regenerar artefactos de arquitectura y dejar `npm run arch:check` verde.

**Archivos objetivo**: `prisma/schema.prisma`, endpoints de T004/T005, `docs/architecture/`

## T009 — Gate y cierre
- [ ] `tsc --noEmit`, `lint`, `tokens:check`, `arch:check`, `test:coverage`, `build` verdes.
- [ ] Verificar que `src/lib/ai/**` no fue modificado.
- [ ] Commit, push a `work/002-pi-062`, PR a `feature/001-scaffolding`.
- [ ] CI-PUSH verde.

**Archivos objetivo**: todo el diff de la feature
