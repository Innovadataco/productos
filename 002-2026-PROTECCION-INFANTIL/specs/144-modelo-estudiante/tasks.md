# Tasks: SPEC-144 — Modelo `Estudiante` expandido (rename desde `Alumno`)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data model**:
[data-model.md](./data-model.md) · **Contracts**: [contracts/altas-estudiante.md](./contracts/altas-estudiante.md)

Compuerta §4 superada (ZEUS 2026-08-03, CUMPLE): D1=tabla hija con acceso solo vía
estudiante acotado · D2=paths conservados · D3=set Zod RC|TI|CC|CE|PASAPORTE|OTRO ·
D4=fila marcada, archivo nunca rechazado.

Reglas: TDD donde aplique (test primero en repos y validación) · un cambio lógico =
un commit (mensajes en español, imperativo) · cero tests debilitados · gate completo
antes de push.

## Fase 1 — Schema y migración (US1, US2)

- [x] T001 Renombrar en `prisma/schema.prisma`: `model Alumno → Estudiante` con
  `@@map("Alumno")`; enum `EtiquetaRelacionAlumno → EtiquetaRelacionEstudiante` con
  `@@map("EtiquetaRelacionAlumno")` y valor `ESTUDIANTE @map("ALUMNO")`
- [x] T002 `model IdentificadorAlumno → IdentificadorEstudiante` con
  `@@map("IdentificadorAlumno")`, campo `estudianteId String @map("alumnoId")`;
  relaciones: `Colegio.estudiantes`, `Curso.estudiantes`,
  `AlertaColegio.identificadorEstudianteId @map("identificadorAlumnoId")` +
  `identificadorEstudiante`, `Plataforma.identificadoresEstudiante`
- [x] T003 Campos nuevos en `Estudiante`: `apellidos String @default("")`,
  `documentoTipo String?`, `documentoNumero String?`; modelo nuevo
  `AcudienteEstudiante` (orden 1|2, `@@unique([estudianteId, orden])`,
  `@@index([estudianteId])`)
- [x] T004 Generar migración aditiva (`prisma migrate dev`) y VERIFICAR el SQL: solo
  `ADD COLUMN` + `CREATE TABLE "AcudienteEstudiante"` + índices; cero
  `DROP`/`RENAME`/`ALTER TYPE`. Aplicar a BD test y comprobar `migrate reset &&
  migrate deploy && db seed` (quickstart §1)
- [x] T005 Test de humo del backfill: existentes con `apellidos = ''`, resto NULL;
  re-deploy = no-op (quickstart §3)

## Fase 2 — Cascada DAL y lib (US1)

- [x] T006 [P] Renombrar `src/lib/dal/repositories/alumno.ts → estudiante.ts`
  (`EstudianteRepository`): tipos `Prisma.Estudiante*`, `prisma.estudiante`; método
  `crear` acepta `apellidos` + `acudientes` anidados (create atómico; máx 2 por
  Zod, nunca por id suelto — D1)
- [x] T007 [P] Renombrar `identificador-alumno.ts → identificador-estudiante.ts` +
  `alerta-colegio.ts` (relaciones nuevas); actualizar
  `src/lib/dal/repositories/{alumno,identificador-alumno,alerta-colegio}.test.ts`
  (renombrar a estudiante/identificador-estudiante, assertions intactas o
  fortalecidas)
- [x] T008 [P] `src/lib/colegio/alertas.ts`, `src/lib/colegio/patrones.ts`,
  `src/lib/colegio/permisos.ts`: relaciones/tipos renombrados, cero cambio de lógica
- [x] T009 [P] Test utils: `src/lib/reporte-test-utils.ts`, `src/lib/test-utils.ts`,
  `src/lib/e2e/journeys/*` (factories crean con `apellidos`)

## Fase 3 — Validación de alta y carga (US3)

- [x] T010 `src/lib/schemas`: `alumnoBodySchema → estudianteBodySchema` con
  `apellidos` requerido, `documentoTipo` enum Zod `RC|TI|CC|CE|PASAPORTE|OTRO`,
  `documentoNumero` opcional, `acudientes` array máx 2 (`nombre`, `relacion`,
  `telefono?`, `email?`) — con tests de schema primero
- [x] T011 `POST /api/colegio/cursos/[id]/alumnos`: exige `apellidos` (400 humano),
  persiste acudientes anidados, duplicado por `nombre + apellidos` en curso (409);
  conserva acción de auditoría `COLEGIO_ALUMNO_CREADO` y `tipoRecurso "Alumno"`
  (histórico inmutable, contracts)
- [x] T012 Carga masiva (`src/lib/colegio/carga/{parser,validator,importer,
  sesion-roster}.ts`): columna `apellidos_alumno` en parser y plantilla descargable
  (`src/app/api/colegio/carga/plantilla/route.ts`); fila sin apellidos → "fila con
  problema" (D4: archivo nunca rechazado; esas filas no se crean al confirmar)
- [x] T013 Tests A/B tenant (dos colegios) en cada verbo tocado: GET/POST
  `cursos/[id]/alumnos`, `alumnos/[id]` (GET/PATCH), `alumnos/[id]/estado`,
  `alumnos/[id]/identificadores`, `identificadores/[id]( /estado)`, carga
  (validar/confirmar), admin `colegios/[id]/cursos/**`

## Fase 4 — Rutas, componentes, arch y cierre

- [x] T014 [P] Rutas API colegio restantes (`alumnos/[id]/*`,
  `identificadores/[id]/*`): código interno renombrado (paths intactos, D2)
- [x] T015 [P] Componentes: `AlumnoDetallePageClient.tsx`,
  `CursoDetallePageClient.tsx`, `EstructuraColegioClient.tsx` — solo tipos/props
  (SPEC-146 reemplaza los archivos)
- [x] T016 `scripts/arch/generar-modelo-datos.ts` (referencia al modelo) + regenerar
  `docs/architecture/01-modelo-datos.md`; `npm run arch:check` VERDE
- [x] T017 Verificación global: `grep -rn "Alumno" src/` = solo strings de mapeo y
  docstrings (SC-003); suite completa verde con tests ≥ antes (SC-002)
- [x] T018 Quickstart completo (`quickstart.md`) + gate (tsc && lint &&
  test:coverage && build && arch:check) + `./scripts/dev-restart.sh` + PR con
  auto-merge + CI del HEAD post-merge success

## Analyze (speckit.analyze, 2026-08-03)

- Cobertura: US1→T001-T009+T014-T017 · US2→T003-T006,T011 · US3→T010-T013. Toda FR
  tiene tarea (FR-001/002/003/004→T001/T002 · FR-005/007→T003/T006 · FR-006→T004/T005
  · FR-008→T006-T015,T017 · FR-009→T013 · FR-010→T010-T012 · FR-011→T016 ·
  FR-012→sin tarea: invariante verificado en T017/gate).
- Consistencia: D1-D4 reflejadas en spec/plan/research/data-model/contracts/tasks.
  Sin ambigüedades abiertas. Sin duplicados.
