# Cierre: SPEC-145 — Modelo `Profesor` mínimo

**Fecha**: 2026-08-03 · **Radicado**: 002-PI-058 · **Spec**: [spec.md](./spec.md)

## Evidencia

- Compuerta §4: spec+plan `acb02777` → ZEUS REVISO → **CUMPLE** (D1=A + COND-1 +
  COND-2 + cuidado ADD VALUE).
- PR #21 (docs): `f5dee755` · PR #22 (implementación + decisiones D1): `7a698e6c`.
  Ambos squash-mergeados con `gate` verde.
- Gate local completo verde antes de push: `tsc` 0 · `lint` 0 · `tokens:check` 0
  (1166 = piso) · `test:coverage` 0 · `build` 0 · `arch:check` VERDE (52 modelos,
  puerta≡predicado 1224 combinaciones) · `./scripts/dev-restart.sh` OK.
- Migración `20260803191936_modelo_profesor`: solo `ALTER TYPE … ADD VALUE` (×3),
  `ALTER TABLE "Curso" ADD COLUMN "profesorTitularId"`, `CREATE TABLE "Profesor"`,
  índice y FKs (SET NULL en titular). Cero `DROP`/`RENAME` en statements (las
  menciones a DROP/RENAME en el archivo son el comentario de cabecera I-49).
- `migrate reset --force && migrate deploy && db seed` verificado contra la BD de
  TEST.

## I-49 — la mina del drift se materializó (hallazgo principal)

El diff crudo de `migrate diff` (shadow DB → schema) **SÍ traía la mina**:

- `DROP INDEX "AlertaColegio_patronInstitucionalId_idx";`
- `DROP INDEX "Ciudad_nombreNormalizado_trgm_idx";` (trigram)
- `DROP INDEX "EmbeddingDataset_vector_idx";` y `"EmbeddingReporte_vector_idx";`
- `ALTER INDEX "patrones_institucionales_…__key" RENAME TO "…";`

**Ninguna se aplicó**: la migración se escribió a mano solo con lo aditivo y se
verificó post-deploy con `pg_indexes` que los 4 índices siguen presentes. En
SPEC-144 el diff salió limpio; con el schema actual **ya no sale limpio — la mina
está ACTIVA para toda migración futura**. Candidato a radicación: declarar los
índices en el schema (con `@@index`/sql crudo documentado) o fijar excepción formal,
para que el diff vuelva a ser limpio por construcción.

## Qué se entregó (FR → evidencia)

- FR-001/002/004: `Profesor` + `Curso.profesorTitularId` + `AccionAudit` ×3 (schema +
  migración arriba).
- FR-003 (I-49): arriba — SQL inspeccionado línea a línea, cero destructivo aplicado.
- FR-005/006/007/008: CRUD `/api/colegio/profesores` (+`/[id]`) tenant-first,
  paginación + filtro estado, 400 humano sin apellidos, 400 email, 409 duplicado,
  audit con acciones nuevas. Tests A/B en los 4 verbos.
- FR-009 (D1=A, COND-1): cursos aceptan `profesorTitularId?` con validación
  same-tenant; **test negativo explícito**: profesor de B a curso de A falla en POST
  y PATCH (nunca éxito, fila intacta).
- FR-014 (COND-2): baja suave del titular **conserva** `profesorTitularId` (test con
  verificación en BD) — trazabilidad forense.
- FR-010 (O-2): `LuzAmbiental.test.tsx` — los 4 primitivos tienen test (cierra
  SC-004 de SPEC-157 al pie de la letra).
- FR-011 (O-1): fixture `rubrica:M1+M2` + `not.toContain("M1")/("M2")` amplio
  restaurado — determinista (cuids en minúscula).
- FR-012: `01-modelo-datos.md` regenerado, oráculo 51→52, `arch:check` VERDE.

## Desviaciones y hallazgos de proceso

1. **Conflicto add/add por squash**: PR #21 mergeó antes de que el commit de
   decisiones (D1+tasks) se empujara; la rama remota se borró y al recrearla, el
   squash y los commits originales colisionaron (CONFLICTING + CI sin disparar). Se
   resolvió con rebase sobre la base (git saltó el commit ya aplicado) +
   force-with-lease. Lección: empujar los ajustes de compuerta apenas se escriben,
   no junto con el arranque de la implementación.
2. `CursoPropiedad` (`src/lib/colegio/permisos.ts`) ganó `profesorTitularId:
   string | null` (tipo aditivo que tsc exigió para el PATCH de curso).
3. Utilidades de test tocadas aditivamente: `test-utils.ts` (reset incluye Profesor)
   y `reporte-test-utils.ts` (helper `crearProfesor`, `crearCurso` acepta
   `profesorTitularId`). Ningún test existente modificado ni debilitado.
4. `PanelVidrio.test.tsx` ya traía un `describe("LuzAmbiental")` básico (de
   SPEC-157); O-2 se cumple con el archivo dedicado nuevo — el describe previo se
   conserva intacto.

## Deuda técnica generada

- **Drift de índices activo** (ver I-49 arriba): requiere radicación propia.
- Pantalla de profesores = SPEC-148; asignación en wizard = SPEC-146 (la API ya está).
- Los selectores de titular deberán ofrecer solo profesores activos (nota para 146).
