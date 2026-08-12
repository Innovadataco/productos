# Tasks: SPEC-165 — Alertas extendidas: matching sobre profesor/acudiente + tipo de sujeto

**Orden**: por dependencias. TDD donde aplica.

## T001 — Schema y migración aditiva
- [ ] Añadir `tipoSujeto` a `AlertaColegio` en `prisma/schema.prisma` (String o enum).
- [ ] Hacer `identificadorEstudianteId` nullable en `AlertaColegio`.
- [ ] Añadir `identificadorProfesorId` e `identificadorAcudienteId` con relaciones opcionales.
- [ ] Añadir unique constraints por tipo de sujeto.
- [ ] Generar migración aditiva con backfill `tipoSujeto = 'ESTUDIANTE'` para alertas históricas.
- [ ] Ejecutar `npx prisma migrate dev` y `npx prisma generate`.
- [ ] Verificar que `Curso` y `Estudiante` NO se modifican.

**Archivos objetivo**: `prisma/schema.prisma`, `prisma/migrations/`

## T002 — Repositorios de identificadores de profesor y acudiente
- [ ] Asegurar/crear `src/lib/dal/repositories/identificador-profesor.ts` con `buscarActivosPorValor` (cross-tenant por valor, insensible).
- [ ] Asegurar/crear `src/lib/dal/repositories/identificador-acudiente.ts` con `buscarActivosPorValor` (cross-tenant por valor, insensible).
- [ ] Tests: búsqueda por valor, A/B de colegio, solo activos.

**Archivos objetivo**: `src/lib/dal/repositories/identificador-profesor.ts`, `src/lib/dal/repositories/identificador-acudiente.ts`, `.test.ts`

## T003 — Extender AlertaColegioRepository
- [ ] Adaptar `INCLUDE_LISTADO` para incluir los tres vínculos opcionales.
- [ ] Añadir métodos de creación por tipo (`crearEstudiante`, `crearProfesor`, `crearAcudiente` o factory con validación).
- [ ] Adaptar agregaciones que join a `Alumno`/`Curso` para filtrar por `tipoSujeto = ESTUDIANTE` cuando el join depende de curso.
- [ ] Añadir soporte de filtro por `tipoSujeto` en `listarPorColegio`.
- [ ] Tests: dedupe por tipo, backfill histórico, agregaciones con mix de sujetos.

**Archivos objetivo**: `src/lib/dal/repositories/alerta-colegio.ts`, `src/lib/dal/repositories/alerta-colegio.test.ts`

## T004 — Extender `notificarColegioSiCorresponde`
- [ ] Modificar `src/lib/colegio/alertas.ts` para consultar los tres repos de identificadores.
- [ ] Crear alerta con `tipoSujeto` y FK correcta para cada coincidencia.
- [ ] Mantener validación de vigencia del colegio y idempotencia.
- [ ] Incluir `tipoSujeto` en el `AuditLog` de `COLEGIO_ALERTA_CREADA`.
- [ ] Tests: matching triple, idempotencia, cross-tenant, estados no visibles.

**Archivos objetivo**: `src/lib/colegio/alertas.ts`, `src/lib/colegio/alertas.test.ts`

## T005 — Regresión del pipeline de avisos y patrones
- [ ] Verificar que `registrarEventoAviso` y `evaluarUmbralesPorAlerta` funcionan con alertas de profesor/acudiente.
- [ ] Verificar que `agregarPatronPorReporte` no depende de que la alerta sea de estudiante.
- [ ] Tests de regresión.

**Archivos objetivo**: `src/lib/colegio/avisos.test.ts`, `src/lib/colegio/patrones.test.ts`

## T006 — API y frontend de alertas
- [ ] Exponer `tipoSujeto` en `GET /api/colegio/alertas` y `GET /api/colegio/alertas/[id]`.
- [ ] Añadir query param `tipoSujeto` al listado.
- [ ] Ajustar el detalle para mostrar curso solo cuando aplica.
- [ ] Actualizar la página `/dashboard/colegio/alertas` para mostrar tipo de sujeto y filtro.
- [ ] Tests de API y componente.

**Archivos objetivo**: `src/app/api/colegio/alertas/route.ts`, `src/app/api/colegio/alertas/[id]/route.ts`, `.test.ts`, `src/app/dashboard/colegio/alertas/page.tsx`

## T007 — Auditoría y arquitectura
- [ ] Asegurar que `COLEGIO_ALERTA_CREADA` y `COLEGIO_ALERTA_ESTADO` incluyan `tipoSujeto` en metadatos.
- [ ] Regenerar artefactos de arquitectura (`npm run arch:check` en verde).

**Archivos objetivo**: `src/lib/audit.ts` (si aplica), `docs/architecture/`

## T008 — Gate y cierre
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, `npm run arch:check` verdes.
- [ ] Actualizar `spec.md` con sección Implementación y hash de merge.
- [ ] Commit, push a rama de trabajo, PR a `feature/001-scaffolding`.
- [ ] CI-PUSH verde.

**Archivos objetivo**: todo el árbol tocado
