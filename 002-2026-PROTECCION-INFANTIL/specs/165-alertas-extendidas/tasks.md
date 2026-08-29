# Tasks: SPEC-165 — Alertas extendidas: matching sobre profesor/acudiente + tipo de sujeto

**Orden**: por dependencias. TDD donde aplica.

## T001 — Schema y migración aditiva
- [x] Añadir `tipoSujeto` a `AlertaColegio` en `prisma/schema.prisma` (String).
- [x] Hacer `identificadorEstudianteId` nullable en `AlertaColegio`.
- [x] Añadir `identificadorProfesorId` e `identificadorAcudienteId` con relaciones opcionales.
- [x] Añadir unique constraints por tipo de sujeto.
- [x] Generar migración aditiva con backfill `tipoSujeto = 'ESTUDIANTE'` para alertas históricas.
- [x] Ejecutar `npx prisma migrate deploy` y `npx prisma generate` (en dev y test).
- [x] Verificar que `Curso` y `Estudiante` NO se modifican.

**Archivos objetivo**: `prisma/schema.prisma`, `prisma/migrations/`

## T002 — Repositorios de identificadores de profesor y acudiente
- [x] Asegurar `src/lib/dal/repositories/identificador-profesor.ts` con `buscarActivosPorValor` (cross-tenant por valor, insensible).
- [x] Asegurar `src/lib/dal/repositories/identificador-acudiente.ts` con `buscarActivosPorValor` (cross-tenant por valor, insensible).
- [x] Tests existentes cubren búsqueda por valor, A/B de colegio, solo activos.

**Archivos objetivo**: `src/lib/dal/repositories/identificador-profesor.ts`, `src/lib/dal/repositories/identificador-acudiente.ts`

## T003 — Extender AlertaColegioRepository
- [x] Adaptar `INCLUDE_LISTADO` para incluir los tres vínculos opcionales.
- [x] Añadir `CrearAlertaInput` discriminado y adaptar `crear`/`buscarExistente`.
- [x] Adaptar agregaciones que join a `Alumno`/`Curso` para filtrar por `tipoSujeto = ESTUDIANTE` cuando el join depende de curso.
- [x] Añadir soporte de filtro por `tipoSujeto` en `listarPorColegio`.
- [x] Extraer agregaciones mensuales a `AlertaColegioMensualRepository` (límite de líneas).
- [x] Tests: dedupe por tipo, backfill histórico, agregaciones con mix de sujetos.

**Archivos objetivo**: `src/lib/dal/repositories/alerta-colegio.ts`, `src/lib/dal/repositories/alerta-colegio.test.ts`, `src/lib/dal/repositories/alerta-colegio-mensual.ts`

## T004 — Extender `notificarColegioSiCorresponde`
- [x] Modificar `src/lib/colegio/alertas.ts` para consultar los tres repos de identificadores.
- [x] Crear alerta con `tipoSujeto` y FK correcta para cada coincidencia.
- [x] Mantener validación de vigencia del colegio e idempotencia.
- [x] Incluir `tipoSujeto` en el `AuditLog` de `COLEGIO_ALERTA_CREADA`.
- [x] Tests: matching triple, idempotencia, cross-tenant, estados no visibles.

**Archivos objetivo**: `src/lib/colegio/alertas.ts`, `src/lib/colegio/alertas.test.ts`

## T005 — Regresión del pipeline de avisos y patrones
- [x] `evaluarUmbralesPorAlerta` retorna temprano para alertas no estudiante.
- [x] `agregarPatronPorReporte` usa optional chaining en el vínculo estudiante.
- [x] Tests de regresión pasan.

**Archivos objetivo**: `src/lib/colegio/avisos.ts`, `src/lib/colegio/patrones.ts`

## T006 — API y frontend de alertas
- [x] Exponer `tipoSujeto` en `GET /api/colegio/alertas` y `GET /api/colegio/alertas/[id]`.
- [x] Añadir query param `tipoSujeto` al listado (`alertaQuerySchema`).
- [x] Ajustar el detalle para mostrar curso solo cuando aplica.
- [x] Actualizar la página `/dashboard/colegio/alertas` para mostrar tipo de sujeto y filtro.
- [x] Tests de API y regresión del DTO de detalle.

**Archivos objetivo**: `src/app/api/colegio/alertas/route.ts`, `src/app/api/colegio/alertas/[id]/route.ts`, `.test.ts`, `src/app/dashboard/colegio/alertas/AlertasColegioPageClient.tsx`, `src/app/dashboard/colegio/alertas/[id]/CasoDetalleClient.tsx`, `src/lib/colegio/seguimiento.ts`

## T007 — Auditoría y arquitectura
- [x] `COLEGIO_ALERTA_CREADA` y `COLEGIO_ALERTA_ESTADO` incluyen `tipoSujeto` en metadatos.
- [x] Regenerar artefactos de arquitectura (`npm run arch:check` en verde).

**Archivos objetivo**: `src/lib/colegio/alertas.ts`, `docs/architecture/`

## T008 — Gate y cierre
- [x] `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, `npm run arch:check`, `npm run tokens:check` verdes.
- [x] Actualizar `spec.md` con sección Implementación.
- [x] Crear `cierre.md` y actualizar `specs/README.md`.
- [ ] Commit, push a rama de trabajo, PR a `feature/001-scaffolding`.
- [ ] CI-PUSH verde.

**Archivos objetivo**: todo el árbol tocado
