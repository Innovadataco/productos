# Cierre: SPEC-144 — Modelo `Estudiante` expandido (rename desde `Alumno`)

**Fecha**: 2026-08-03 · **Radicado**: 002-PI-058 · **Spec**: [spec.md](./spec.md)

## Evidencia

- Compuerta §4: spec+plan `683494cb` → ZEUS REVISO → **CUMPLE** con D1–D4.
- PR #15 (docs + fix flake): `32d35abd` · PR #16 (implementación): `4d12b179`.
  Ambos squash-mergeados a `feature/001-scaffolding` con `gate` verde.
- Gate local completo verde antes de push: `tsc` 0 · `lint` 0 · `test:coverage`
  (256 archivos, 1518 passed / 1 skipped preexistente) · `build` 0 · `arch:check`
  VERDE · `./scripts/dev-restart.sh` OK (healthcheck ok, UN worker).
- Migración `20260803070000_modelo_estudiante_rename_y_acudientes`: solo
  `ADD COLUMN` (`apellidos`, `documentoTipo`, `documentoNumero`) +
  `CREATE TABLE "AcudienteEstudiante"` + índices/FK. Cero `DROP`/`RENAME`/
  `ALTER TYPE` — el rename es físicamente invisible (`@@map`/`@map`).
- `migrate reset --force && migrate deploy && db seed` verificado sobre la BD de
  TEST; backfill idempotente (0 filas con `apellidos IS NULL`; re-deploy = no-op).
- `grep "\bAlumno\b" src/`: solo strings de mapeo/auditoría histórica, SQL crudo con
  nombres físicos, datos de test y UI legada (la reemplazan SPEC-146/147).

## Qué se entregó (FR → evidencia)

- FR-001…004 (rename con físico intacto): `prisma/schema.prisma` + migración arriba.
- FR-005/007 (campos + acudientes): `Estudiante.apellidos/documentoTipo/
  documentoNumero`; `AcudienteEstudiante` con `@@unique([estudianteId, orden])`,
  acceso solo vía estudiante acotado por `colegioId` (D1, sin endpoints propios).
- FR-006 (backfill idempotente/reversible): ver evidencia de migración.
- FR-008 (cascada): repos `estudiante.ts`/`identificador-estudiante.ts`, lib colegio,
  rutas, componentes, `scripts/arch/generar-modelo-datos.ts`, tests.
- FR-009 (tenant A/B): tests de dos colegios en cada verbo tocado, fortalecidos.
- FR-010 (alta exige apellidos): `estudianteBodySchema` (Zod; `documentoTipo` ∈
  RC|TI|CC|CE|PASAPORTE|OTRO — D3), 400 humano, 409 por nombre+apellidos; carga
  masiva D4: columna `apellidos_alumno` en plantilla, fila sin apellidos marcada
  como problema, archivo nunca rechazado.
- FR-011 (arch): `docs/architecture/01-modelo-datos.md` regenerado; oráculo de
  modelos 50→51.
- FR-012 (sin UI nueva / I-29): pantallas intactas; única excepción mínima: el modal
  de alta del curso gana el campo `apellidos` para cumplir el contrato nuevo.

## Hallazgos reportables

1. **Flake preexistente `mis-reportes/[id]`**: el oráculo antitrace assertaba
   `not.toContain("m2")` sobre el JSON de respuesta; los cuids aleatorios podían
   contener "m2" → falso positivo probabilístico (tumbó el gate de #15). Fix:
   marcadores exactos (`modeloUsado`, `rubrica:`, `"m1"`/`"m2"` citados) — misma
   garantía de privacidad, determinista. No se debilitó nada.
2. **Drift migrations↔schema preexistente** (ajeno a esta SPEC): `migrate diff`
   muestra índices creados por SQL crudo en migraciones viejas que el schema no
   declara (`AlertaColegio_patronInstitucionalId_idx`,
   `Ciudad_nombreNormalizado_trgm_idx`, `Embedding*_vector_idx`) y un rename por
   nombre truncado en `patrones_institucionales`. Se excluyó de la migración de
   144. **Candidato a radicación aparte** (declarar índices en schema o dejar
   excepción documentada).
3. **Código de error**: el contract decía `BAD_REQUEST` literal; no existe en
   `errors.ts` — se usó el canónico `VALIDATION_ERROR` con el mensaje humano.

## Deuda técnica generada

- UI legada sigue diciendo "alumno" en pantallas de colegio (paths y copy los
  reemplazan SPEC-146/147, decidido en D2).
- `apellidos = ""` en históricos: la completitud se trabaja con banner en specs de
  UI (146/147).
