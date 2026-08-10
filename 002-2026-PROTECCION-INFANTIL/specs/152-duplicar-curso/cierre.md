# Cierre: SPEC-152 — Duplicar curso al año siguiente

## Estado

🟢 Implementada (integrada en `feature/001-scaffolding`).

## Resumen

Se implementó la duplicación atómica de un curso propio al periodo siguiente. El endpoint `POST /api/colegio/cursos/[id]/duplicar` permite a un `SCHOOL_ADMIN` clonar el curso con sus estudiantes e identificadores activos, dejando el curso origen intacto y sin copiar el profesor titular. Todo ocurre dentro de `withUnitOfWork` (SPEC-137) y respeta el tenant (SPEC-134).

## Cambios entregados

- **Migración aditiva**: `prisma/migrations/20260809193218_add_duplicar_curso_audit/migration.sql` añade `COLEGIO_CURSO_DUPLICADO` a `AccionAudit`.
- **Servicio**: `src/lib/colegio/duplicar-curso.ts` — clonación atómica de curso, estudiantes, acudientes e identificadores; cálculo del nuevo `anioLectivo`; validación de duplicados; auditoría.
- **Endpoint**: `src/app/api/colegio/cursos/[id]/duplicar/route.ts` — auth `SCHOOL_ADMIN`, vigencia, rate limit, respuestas 201/404/409.
- **Tests**: `src/app/api/colegio/cursos/[id]/duplicar/route.test.ts` — 5 tests de integración (201 completo, 404 ajeno, 409 destino existe, filtro de activos, origen intacto).
- **UI**: `src/app/dashboard/colegio/cursos/[id]/CursoEscritorioClient.tsx` + `src/components/modules/colegio/curso/CursoHeader.tsx` — botón "Duplicar al año siguiente" con confirmación y navegación al nuevo curso.
- **Arquitectura**: regenerado `docs/architecture/02-roles-capacidades.md` para reflejar el nuevo endpoint.

## Gate de calidad

- `npx tsc --noEmit` ✅
- `npm run lint` ✅ (solo warnings preexistentes)
- `npm run tokens:check` ✅
- `npm run arch:check` ✅
- `npm run test:coverage` ✅
- `npm run build` ✅

## Evidencia de integración

- Rama: `work/002-pi-058`
- PR a `feature/001-scaffolding`: #32
- Hash de merge en `feature/001-scaffolding`: #TODO (actualizar tras merge)
- CI-PUSH verde: #TODO (actualizar tras merge)

## Notas

- No se modificó `src/lib/ai/**` (I-29 intacto).
- El profesor titular no se copia; el curso destino nace sin titular para evitar asignaciones erróneas entre periodos.
- La auditoría se persiste en la misma transacción que la clonación.
