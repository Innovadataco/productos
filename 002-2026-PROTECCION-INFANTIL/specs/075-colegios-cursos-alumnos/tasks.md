# Tasks: Colegios · Fase 2 — Cursos, Alumnos e Identificadores

## Phase 1 — Modelo y migración

- **T001** [P] `prisma/schema.prisma`: agregar modelos `Curso`, `Alumno`, `IdentificadorAlumno`, enum `EtiquetaRelacionAlumno` y relaciones.
- **T002** `prisma/migrations/20260721_add_colegio_cursos_alumnos`: crear migración aditiva.
- **T003** `prisma/migrations/20260721_add_colegio_cursos_alumnos/migration.sql`: verificar que sea aditiva y no destructiva.
- **T004** Backup de BD antes de aplicar migración.
- **T005** `npx prisma migrate deploy` aplicar migración en dev.

## Phase 2 — Schemas y validaciones

- **T006** `src/lib/schemas/index.ts`: schemas `cursoBodySchema`, `cursoUpdateBodySchema`, `alumnoBodySchema`, `alumnoUpdateBodySchema`, `identificadorAlumnoBodySchema`, `identificadorAlumnoUpdateBodySchema`, `estadoSchema`.
- **T007** `src/lib/colegio/permisos.ts`: helper `verificarPropiedadCurso`, `verificarPropiedadAlumno`, `verificarPropiedadIdentificador` (validan colegio del SCHOOL_ADMIN).
- **T008** `src/lib/colegio/normalizacion.ts`: helper `normalizarIdentificador(valor, tipo)` (trim + minúsculas).

## Phase 3 — Endpoints (Backend) [P]

- **T009** `src/app/api/colegio/cursos/route.ts`: GET y POST cursos con aislamiento y auditoría.
- **T010** `src/app/api/colegio/cursos/[id]/route.ts`: PATCH curso.
- **T011** `src/app/api/colegio/cursos/[id]/estado/route.ts`: PATCH estado curso.
- **T012** `src/app/api/colegio/cursos/[id]/alumnos/route.ts`: GET y POST alumnos.
- **T013** `src/app/api/colegio/alumnos/[id]/route.ts`: PATCH alumno.
- **T014** `src/app/api/colegio/alumnos/[id]/estado/route.ts`: PATCH estado alumno.
- **T015** `src/app/api/colegio/alumnos/[id]/identificadores/route.ts`: GET y POST identificadores.
- **T016** `src/app/api/colegio/identificadores/[id]/route.ts`: PATCH identificador.
- **T017** `src/app/api/colegio/identificadores/[id]/estado/route.ts`: PATCH estado identificador.
- **T018** `src/lib/audit.ts`: agregar acciones `COLEGIO_CURSO_CREADO`, `COLEGIO_CURSO_EDITADO`, `COLEGIO_CURSO_DESACTIVADO`, `COLEGIO_ALUMNO_CREADO`, `COLEGIO_ALUMNO_EDITADO`, `COLEGIO_ALUMNO_DESACTIVADO`, `COLEGIO_IDENTIFICADOR_CREADO`, `COLEGIO_IDENTIFICADOR_EDITADO`, `COLEGIO_IDENTIFICADOR_DESACTIVADO` si no existen.

## Phase 4 — UI (Frontend) [P]

- **T019** `src/app/dashboard/colegio/cursos/page.tsx`: listado de cursos con botón nuevo.
- **T020** `src/app/dashboard/colegio/cursos/nuevo/page.tsx`: formulario crear curso.
- **T021** `src/app/dashboard/colegio/cursos/[id]/page.tsx`: detalle de curso + listado de alumnos + botón agregar alumno.
- **T022** `src/app/dashboard/colegio/alumnos/[id]/page.tsx`: detalle de alumno + listado de identificadores + botón agregar identificador.
- **T023** `src/components/modules/colegio/ColegioNav.tsx`: navegación interna del módulo colegio (Cursos, Alertas, Estadísticas, etc.).
- **T024** `src/app/dashboard/colegio/page.tsx`: actualizar panel inicial con accesos a Cursos, etc.
- **T025** Aplicar `.theme-colegio` en todas las vistas nuevas.

## Phase 5 — Tests [P]

- **T026** `src/app/api/colegio/cursos/route.test.ts`: tests ABM cursos + aislamiento.
- **T027** `src/app/api/colegio/cursos/[id]/alumnos/route.test.ts`: tests ABM alumnos + aislamiento.
- **T028** `src/app/api/colegio/alumnos/[id]/identificadores/route.test.ts`: tests ABM identificadores + duplicados + aislamiento.
- **T029** `src/lib/colegio/permisos.test.ts`: tests de helpers de propiedad.
- **T030** Tests de permisos para roles no SCHOOL_ADMIN en `/api/colegio/*`.

## Phase 6 — Validación y cierre

- **T031** `npx tsc --noEmit`.
- **T032** `npm run lint`.
- **T033** `npx vitest run` (meta: ≥611 tests verdes).
- **T034** `npm run build`.
- **T035** `./scripts/dev-restart.sh` (deploy limpio, un worker, healthcheck).
- **T036** Probar quickstart.md (flujo de punta a punta).
- **T037** Actualizar `specs/075-colegios-cursos-alumnos/spec.md` sección Implementación.
- **T038** Crear `specs/075-colegios-cursos-alumnos/cierre.md` con evidencia.
- **T039** Commit por US + docs; push a `feature/001-scaffolding`.
- **T040** Marcar Status CERRADA en `spec.md`.
