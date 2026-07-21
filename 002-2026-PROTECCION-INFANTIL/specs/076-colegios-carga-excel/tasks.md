# Tasks: Colegios · Fase 3 — Carga masiva por Excel/CSV

## Phase 1 — Dependencias y librería

- **T001** `package.json`: agregar `xlsx` a dependencies.
- **T002** `npm install xlsx`.
- **T003** Backup de BD antes de tocar cualquier dato (si aplica). Fase 3 no requiere migración, pero se hace por seguridad.

## Phase 2 — Parser, validador, token e importer

- **T004** `src/lib/colegio/carga/parser.ts`: parse CSV/XLSX a `FilaCargaAlumno[]` usando `xlsx`. Detectar encabezados faltantes.
- **T005** `src/lib/colegio/carga/validator.ts`: validar filas contra schemas de Fase 2; normalizar identificadores; resolver plataforma por nombre; detectar duplicados internos; devolver errores con número de fila.
- **T006** `src/lib/colegio/carga/token.ts`: generar y verificar token JWT con filas válidas; duración 15 min.
- **T007** `src/lib/colegio/carga/importer.ts`: transacción Prisma que hace upsert de curso, alumno e identificadores; devuelve resumen.
- **T008** Tests unitarios para parser, validator, token e importer.

## Phase 3 — Endpoints

- **T009** `src/app/api/colegio/carga/plantilla/route.ts`: GET plantilla CSV.
- **T010** `src/app/api/colegio/carga/validar/route.ts`: POST FormData → parser + validator → token.
- **T011** `src/app/api/colegio/carga/confirmar/route.ts`: POST token → importer + auditoría.
- **T012** Agregar acción `COLEGIO_CARGA_MASIVA` a `AuditLog` si no existe.

## Phase 4 — UI

- **T013** `src/app/dashboard/colegio/cursos/carga/page.tsx`: vista de carga masiva.
- **T014** Descargar plantilla desde la UI.
- **T015** Input de archivo (drag & drop simple o input file nativo).
- **T016** Mostrar resumen de validación y errores.
- **T017** Botón confirmar carga.
- **T018** Actualizar `ColegioNav` y panel para acceder a Carga Masiva.

## Phase 5 — Tests de integración

- **T019** `src/app/api/colegio/carga/route.test.ts` (o varios): tests de validar/confirmar con CSV/XLSX, idempotencia, aislamiento, permisos, tope de filas, token inválido.
- **T020** `src/lib/colegio/carga/parser.test.ts`.
- **T021** `src/lib/colegio/carga/validator.test.ts`.
- **T022** `src/lib/colegio/carga/importer.test.ts`.

## Phase 6 — Validación y cierre

- **T023** `npx tsc --noEmit`.
- **T024** `npm run lint`.
- **T025** `npx vitest run` (meta: ≥643 tests verdes).
- **T026** `npm run build`.
- **T027** `./scripts/dev-restart.sh` (deploy limpio, un worker, healthcheck).
- **T028** Probar quickstart.md.
- **T029** Actualizar `specs/076-colegios-carga-excel/spec.md` sección Implementación.
- **T030** Crear `specs/076-colegios-carga-excel/cierre.md` con evidencia.
- **T031** Commit por US + docs; push a `feature/001-scaffolding`.
- **T032** Marcar Status CERRADA en `spec.md`.
