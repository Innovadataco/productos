<<<<<<<< HEAD:002-2026-PROTECCION-INFANTIL/specs/379-decisiones-colegio-medias-b/tasks.md
# SPEC-379 (PR B) · Tasks
========
# SPEC-386 · Tasks (continúa SPEC-379 D5a)
>>>>>>>> 4f45add68 (chore(specs): renumerar 384 → 386 (colisión con #286 Guardianes)):002-2026-PROTECCION-INFANTIL/specs/386-decisiones-colegio-medias-cursos-excel/tasks.md

- [X] T001 Diagnóstico 15v5: patrón de carga-profesores + modelo Curso + grados.
- [X] T002 `src/lib/colegio/carga-cursos/parser.ts` con `PLANTILLA_CURSOS_CSV`.
- [X] T003 `src/lib/colegio/carga-cursos/validator.ts` con `CursoNormalizado` + reglas.
- [X] T004 `CargaRosterSesionRepository.obtenerValidaCursos` + Zod schema.
- [X] T005 `GET /api/colegio/carga-cursos/plantilla` (fuente única del CSV).
- [X] T006 `POST /api/colegio/carga-cursos/validar` (dry-run + token).
- [X] T007 `POST /api/colegio/carga-cursos/confirmar` (import idempotente).
- [X] T008 `CargaCursosExcel.tsx` panel cliente.
- [X] T009 Consumir el panel en `CursosPageClient`.
- [X] T010 Test-candado `plantilla-autoconsistente.test.ts` (I-245).
- [X] T011 Registrar el test en `vitest.unit.includes.ts`.
- [X] T012 Gate: tsc, unit verde.
- [X] T013 Regenerar línea base de arquitectura (aparece la nueva ruta).
- [ ] T014 [Post-merge] verificación en vivo del CEO: descargar la plantilla, llenarla, subirla, comprobar `crear`/`omitidos`/`errores` en la UI, confirmar y ver los cursos en la lista.
