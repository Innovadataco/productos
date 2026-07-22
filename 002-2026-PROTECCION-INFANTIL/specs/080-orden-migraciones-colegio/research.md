# Research — Spec 080 (I-04)

**Fecha**: 2026-07-22 · **Autor**: ODIN

## Pregunta

¿Por qué falla `prisma migrate deploy` desde cero y cuál es la corrección mínima?

## Hallazgos (verificados en el repo)

1. **Causa raíz**: `prisma/migrations/20260720214140_add_colegio/migration.sql:49` crea
   `FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id")`, pero la tabla
   `Departamento` se crea en `20260721001700_add_departamento`, posterior en orden
   lexicográfico. PostgreSQL rechaza la FK → error P3018 → la cadena se detiene.
2. **Dependencias de `add_departamento`** (revisado el SQL completo, 28 líneas):
   - Crea tabla `Departamento` con FK a `Pais`.
   - `ALTER TABLE "Ciudad" ADD COLUMN "departamentoId"` + índice + FK a `Departamento`.
   - Solo necesita `Pais` y `Ciudad`, creadas en `20260714105800_add_pais_ciudad`.
   - No referencia `Colegio` ni nada creado entre `20260714111300` y `20260720214140`.
3. **Semántica de Prisma**: las migraciones aplican por orden lexicográfico del nombre
   de carpeta `<timestamp>_<nombre>`; el nombre se registra en `_prisma_migrations`
   junto con un checksum del SQL. Renombrar la carpeta sin tocar el SQL reordena la
   aplicación y conserva el checksum.
4. **Hueco de timestamp elegido**: `20260720210000` — posterior a
   `20260720174150_add_simulacion_tables` y anterior a `20260720214140_add_colegio`.
5. **Esquema final invariable**: mismo conjunto de sentencias SQL, distinto orden →
   la BD resultante es idéntica; `migrate dev` no debe proponer drift (SC-003).

## Decisión

`git mv prisma/migrations/20260721001700_add_departamento prisma/migrations/20260720210000_add_departamento`
sin editar `migration.sql`. Alternativas y descartes documentados en `plan.md`.

## Riesgo residual

BD de desarrollo ya migradas registran el nombre antiguo → recuperación vía
`prisma migrate reset --force` (dataset vacío, fase DESARROLLO) documentada en
`quickstart.md`.
