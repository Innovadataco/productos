<<<<<<<< HEAD:002-2026-PROTECCION-INFANTIL/specs/379-decisiones-colegio-medias-b/spec.md
# SPEC-379 (PR B) · Excel de CURSOS
========
# SPEC-386 · Excel de CURSOS (continúa SPEC-379 · D5a)
>>>>>>>> 4f45add68 (chore(specs): renumerar 384 → 386 (colisión con #286 Guardianes)):002-2026-PROTECCION-INFANTIL/specs/386-decisiones-colegio-medias-cursos-excel/spec.md

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 · **Origen**: D-100 (Jelkin, 31-08) · sigue el
patrón de las cargas de alumnos y profesores.

## Problema

De los tres Excel que Jelkin decidió en D-100 (profesores, cursos, alumnos),
**cursos** era el único que no existía. El rector podía crearlos uno por uno,
o meterlos junto con alumnos por el wizard unificado, pero no cargar una
lista pura de cursos al abrir un año lectivo o cuando llega una tanda.

## Requisitos

- **FR-001**: `GET /api/colegio/carga-cursos/plantilla` emite el CSV oficial
  con TODAS las columnas del validador + una fila de ejemplo válida.
- **FR-002 (CANDADO I-245)**: la plantilla se genera desde la MISMA constante
  que consume el validador (`PLANTILLA_CURSOS_CSV` en `parser.ts`); un
  test-candado `plantilla-autoconsistente.test.ts` pasa esa cadena por el
  parser + validator y afirma `{crear:1, omitidos:0, errores:0}`. Si alguien
  toca solo uno de los dos, el test falla.
- **FR-003**: `POST /api/colegio/carga-cursos/validar` parsea (CSV/XLSX),
  clasifica cada fila en `crear`/`omitido`/`error` y devuelve resumen + token
  firmado (JWT 15 min). El roster de cursos vive server-side en
  `CargaRosterSesion` (nueva variante `obtenerValidaCursos` con Zod).
- **FR-004**: `POST /api/colegio/carga-cursos/confirmar` materializa los
  cursos dentro de una `withUnitOfWork`. Idempotente contra la carrera
  validar↔confirmar (P2002 en el `@@unique(colegioId, nombre, grado,
  anioLectivo)` cuenta como duplicado, no como error).
- **FR-005 (D5a · UI)**: `/dashboard/colegio/cursos` expone el panel
  `CargaCursosExcel` (mismo shape que el de profesores del PR A).
- **FR-006 (Validaciones)**: `nombre` obligatorio (≤80); `grado` opcional
  (1..11 — misma lista que `GRADO_OPTIONS`); `anio_lectivo` opcional (4
  dígitos entre 1900 y `anioActual+2`); `profesor_titular_documento`
  opcional, resuelto contra profesores ACTIVOS del colegio (documento
  case-insensitive con trim). Cursos duplicados por (nombre, grado, año) se
  omiten con razón; el mismo curso repetido en el archivo también.

## Impacto en arquitectura:

- Nuevo módulo `src/lib/colegio/carga-cursos/` (parser, validator,
  plantilla-autoconsistente.test.ts).
- Nuevo componente `src/components/modules/colegio/CargaCursosExcel.tsx`
  (mismo shape que el de profesores de PR A).
- `CargaRosterSesionRepository` amplía a `obtenerValidaCursos` con su
  Zod schema `filaCursoJsonSchema` (aditivo).
- Tres endpoints nuevos bajo `/api/colegio/carga-cursos/`.
- Un item nuevo en `CursosPageClient` (server side no cambia).

## Fuera de alcance

- Emitir XLSX estilizado (la plantilla es CSV). Si el rector abre el CSV en
  Excel funciona igual — la carga acepta ambos formatos.
- Reasignar el profesor titular a cursos que ya existen (esta carga solo
  CREA cursos nuevos; el `PATCH` por id sigue siendo el camino para editar).
