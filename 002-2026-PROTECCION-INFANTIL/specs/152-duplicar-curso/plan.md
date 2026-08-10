# Plan: SPEC-152 — Duplicar curso al año siguiente

## Alcance cerrado

Implementar `POST /api/colegio/cursos/[id]/duplicar` para `SCHOOL_ADMIN`, que clona un curso propio al periodo siguiente de forma atómica (`withUnitOfWork`), copiando estudiantes activos (con acudientes) e identificadores activos. Si el curso destino ya existe, devuelve 409. Se audita con `COLEGIO_CURSO_DUPLICADO`. Se agrega un botón en la ficha del curso.

## Tareas

| ID | Tarea | Archivos clave | Depende de |
|----|-------|----------------|------------|
| T001 | Añadir valor enum `COLEGIO_CURSO_DUPLICADO` a `AccionAudit` con migración aditiva. | `prisma/schema.prisma`, `prisma/migrations/20260810000000_duplicar_curso_audit/` | — |
| T002 | Extender `CursoRepository` con `duplicar`: leer origen, verificar destino, crear curso nuevo dentro de tx. | `src/lib/dal/repositories/curso.ts` | T001 |
| T003 | Implementar servicio `duplicarCurso` con `withUnitOfWork`: clonar estudiantes, acudientes e identificadores activos; calcular nuevo `anioLectivo`; audit. | `src/lib/colegio/duplicar-curso.ts` | T002 |
| T004 | Endpoint `POST /api/colegio/cursos/[id]/duplicar`: auth, vigencia, rate limit, validación params, llamada al servicio, respuesta 201/404/409. | `src/app/api/colegio/cursos/[id]/duplicar/route.ts` | T003 |
| T005 | Tests de integración del endpoint: 201 completo, 404 ajeno, 409 destino existe, atomicidad con fallo provocado. | `src/app/api/colegio/cursos/[id]/duplicar/route.test.ts` | T004 |
| T006 | UI: botón "Duplicar al año siguiente" en `/dashboard/colegio/cursos/[id]` con confirmación y navegación al nuevo curso. | `src/app/dashboard/colegio/cursos/[id]/page.tsx` o componente cliente | T004 |
| T007 | Actualizar `specs/README.md` (ambas tablas) con SPEC-152 como Implementada. | `specs/README.md` | T006 |
| T008 | Gate de calidad: `tsc`, `lint`, `tokens:check`, `arch:check`, `test:coverage`, `build`. | — | T007 |

## Decisiones técnicas

1. **Profesor titular**: no se copia. El curso destino nace sin titular para evitar asignaciones erróneas entre periodos.
2. **Nuevo `anioLectivo`**: si el valor actual es numérico, se incrementa en 1; de lo contrario se usa el año actual del servidor + 1.
3. **Atomicidad**: todo ocurre dentro de `withUnitOfWork` (una sola transacción Prisma). Si cualquier clonación falla, no persiste nada.
4. **Duplicado de estudiante**: al clonar se valida que no exista otro estudiante con el mismo nombre+apellidos en el curso destino (mismo criterio del endpoint unificado).
5. **Acudientes**: se copian exactamente (orden 1 y 2) en la misma creación anidada del estudiante.
6. **Identificadores**: solo activos; se conservan tipo, valor normalizado, plataforma y etiqueta.

## Riesgos

- **Timeout en CI por llamadas Resend**: este fix ya se aplica en PR separado; la 152 no debe reintroducir llamadas de email.
- **Regresión en `arch:check`**: el nuevo endpoint debe quedar cubierto por el proxy (ruta bajo `/dashboard/colegio/**` y `/api/colegio/**`).
