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

- [x] **T6** · Rebase sobre `main` (`66bf7d0f0`, con #735 y #742). Born-**VERDE** confirmado por **exit code 0** (`drift 0`, baseline benigno 90) — #735 (`20260929200000_spec766_plan_reconciliar_drift`) reconcilia el historial de `Plan`. Gate **DURO** cableado en `ci.yml` (sin `continue-on-error`) con shadow DB (`CREATE DATABASE proteccion_shadow`); es determinista (insumos solo del repo). Conteo de **LIMITES_CLASIFICADOR** (#742) importado y visible en cada corrida (1: `set-default-gen-random-uuid-aislado`). Candado ampliado (superficie de límites). born-VERDE confirmado al CEO ANTES de poner el gate duro.
  - **Nota de prod (no afecta a 767):** la migración de #735 **no está aplicada en prod** (una publicación de replicación a BI depende de `Plan.creadoEn` — dependencia del catálogo de Postgres, invisible a `git grep`). 767 mide **historial↔esquema** (repo), no BD-viva↔historial (eso es #760): «767 verde» NO significa «prod sana». Sin deploys hasta recuperar el estado del historial.
