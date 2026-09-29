# Tasks · SPEC-767 · guardián de historial ≠ esquema

> Secuencia: #760 → #766 → #767. Construir ahora todo salvo el import (1 línea) y el cableado CI.

## Ahora (no depende del import de #760)

- [x] **T1** · `scripts/verify-historial-esquema.ts`: `migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations --shadow-database-url $SHADOW --script` → `partirStatements` → `clasificarDrift` → si `drift.length > 0` imprime y sale ≠0.
- [x] **T2** · Alias npm `historial:check`.
- [x] **T3** · `scripts/verify-historial-esquema.candado.test.ts` (control positivo): planta un campo sin migración → `drift` lo contiene. Registrado en `vitest.unit.includes.ts` (carril unit lo enumera explícito). 4 tests verdes.
- [x] **T4** · Documentar los 8 renombres de índice con su razón: `RENOMBRES_INDICE_BASELINE` (constante + comentario) en el script.

## Tras #760 en `main`

- [x] **T5** · Rebase sobre `main` (`3cf041567`); `import` de `../src/lib/monitoreo/drift-clasificador` (relativo, como el sibling); `tsc`/`lint`/`test:unit` verdes; born-**ROJO** confirmado por **exit code 1** — 1 tabla (`Plan`). `worker_logs` sale benigno en esta dirección (`TIMESTAMPTZ(6)` + `gen_random_uuid()` default) porque las migraciones lo construyen consistente con el esquema; su drift es de PROD (schema↔BD viva, #760), no de historial. Reportado al CEO.

## Tras #766 en `main`

- [ ] **T6** · Rebase; confirmar born-VERDE (drift vacío) — requiere que #766 agregue la migración que RECONCILIA el historial de `Plan` (creadoEn→createdAt + `precio` nullable), no solo el dato de prod; cablear paso CI como **gate DURO** (sobre el `ci.yml` de #760) + shadow DB; confirmar born-green al CEO **antes** de duro.
