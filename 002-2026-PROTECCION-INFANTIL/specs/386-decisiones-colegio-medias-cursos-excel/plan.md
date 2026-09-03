<<<<<<<< HEAD:002-2026-PROTECCION-INFANTIL/specs/379-decisiones-colegio-medias-b/plan.md
# SPEC-379 (PR B) · Plan
========
# SPEC-386 · Plan (continúa SPEC-379 D5a)
>>>>>>>> 4f45add68 (chore(specs): renumerar 384 → 386 (colisión con #286 Guardianes)):002-2026-PROTECCION-INFANTIL/specs/386-decisiones-colegio-medias-cursos-excel/plan.md

1. **Diagnóstico 15v5**: leer parser + validator + importer de profesores,
   y las rutas `plantilla`/`validar`/`confirmar` — el patrón se copia limpio.
   Modelo Curso + `@@unique(colegioId, nombre, grado, anioLectivo)`;
   grados válidos 1..11 desde `GRADO_OPTIONS`.
2. `src/lib/colegio/carga-cursos/parser.ts` con `PLANTILLA_CURSOS_CSV`
   (nombre + grado + anio_lectivo + profesor_titular_documento).
3. `src/lib/colegio/carga-cursos/validator.ts` con las reglas del `FR-006`.
4. `CargaRosterSesionRepository`: nueva variante `obtenerValidaCursos` con
   Zod `filaCursoJsonSchema` (aditivo — no rompe consumidores).
5. Tres endpoints bajo `/api/colegio/carga-cursos/`.
6. `CargaCursosExcel.tsx` — panel cliente (mismo shape que profesores).
7. Consumo en `CursosPageClient`.
8. **Test-candado (obligatorio, I-245)**: `plantilla-autoconsistente.test.ts`
   pasa la plantilla por su propio validador — 1 fila válida, 0 omitidas,
   0 errores.
9. Gate: `tsc --noEmit` limpio, unit verde, regen baseline arch (aparece
   la nueva ruta), specs-discipline verde.
