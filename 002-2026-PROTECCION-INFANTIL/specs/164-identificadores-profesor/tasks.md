# Tasks: SPEC-164 — Identificadores de profesor + profesores en estadísticas

**Orden**: por dependencias. TDD donde aplica.

## T001 — Schema y migración aditiva
- [ ] Añadir `model IdentificadorProfesor` en `prisma/schema.prisma`.
- [ ] Definir FKs a `Profesor` y `Plataforma`, unique `(profesorId, valor, tipo, plataformaId)` e índices.
- [ ] Añadir acciones de audit `COLEGIO_IDENTIFICADOR_PROFESOR_CREADO`, `COLEGIO_IDENTIFICADOR_PROFESOR_EDITADO`, `COLEGIO_IDENTIFICADOR_PROFESOR_DESACTIVADO` a `AccionAudit`.
- [ ] Asegurar que `Profesor`, `Curso` y `Estudiante` NO se modifican.
- [ ] Generar migración aditiva.
- [ ] Ejecutar `npx prisma migrate dev` y `npx prisma generate`.

## T002 — Repositorio IdentificadorProfesor
- [ ] Crear `src/lib/dal/repositories/identificador-profesor.ts` (listarPorProfesor, crear, actualizar, cambiarEstado, obtenerPorId, buscarDuplicado, buscarActivosPorValor).
- [ ] Aislamiento por `colegioId` vía `profesor.colegioId` en todas las operaciones.
- [ ] Reutilizar `normalizarIdentificador` e `inferirTipoIdentificador`.
- [ ] Test `src/lib/dal/repositories/identificador-profesor.test.ts`: CRUD + A/B + duplicados + validación de profesor inactivo.

## T003 — Endpoints de identificadores de profesor
- [ ] `GET /api/colegio/profesores/[id]/identificadores`.
- [ ] `POST /api/colegio/profesores/[id]/identificadores`.
- [ ] `PATCH /api/colegio/identificadores-profesor/[id]`.
- [ ] `PATCH /api/colegio/identificadores-profesor/[id]/estado`.
- [ ] Añadir schemas en `src/lib/schemas/index.ts`.
- [ ] Añadir `verificarPropiedadIdentificadorProfesor` en `src/lib/colegio/permisos.ts`.
- [ ] Tests de API con A/B, duplicados y validaciones.

## T004 — Ficha del profesor (frontend)
- [ ] Crear `src/app/dashboard/colegio/profesores/[id]/page.tsx`.
- [ ] Crear `src/app/dashboard/colegio/profesores/[id]/ProfesorDetallePageClient.tsx` con datos del profesor y CRUD de identificadores.
- [ ] Añadir enlace a la ficha desde `src/app/dashboard/colegio/profesores/ProfesoresPageClient.tsx`.
- [ ] Tests de componente.

## T005 — Conteo de profesores en home
- [ ] Verificar que `ColegioResumenRepository.homeRector` usa `ProfesorRepository.contar(colegioId)` para el KPI `profesores`.
- [ ] Añadir/actualizar test de regresión que valide el KPI.

## T006 — Conteo de profesores en estadísticas
- [ ] Añadir conteo de profesores activos en `calcularEstadisticasColegio` (`src/lib/colegio/estadisticas.ts`).
- [ ] Actualizar DTO `EstadisticasColegio` para incluir `profesores` en `totales`.
- [ ] Actualizar `ColegioEstadisticasPageClient` para mostrar tarjeta de profesores.
- [ ] Tests de API y unitarios.

## T007 — Auditoría y arquitectura
- [ ] Auditar mutaciones en endpoints de identificadores de profesor.
- [ ] Regenerar artefactos de arquitectura y dejar `npm run arch:check` verde.

## T008 — Gate y cierre
- [ ] `tsc --noEmit`, `lint`, `tokens:check`, `arch:check`, `test:coverage`, `build` verdes.
- [ ] Commit, push a rama de trabajo, PR a `feature/001-scaffolding`.
- [ ] CI-PUSH verde.
