# Tasks · SPEC-767 · guardián de historial ≠ esquema

> Secuencia: #760 → #766 → #767. Construir ahora todo salvo el import (1 línea) y el cableado CI.

## Ahora (no depende del import de #760)

- [ ] **T1** · `scripts/verify-historial-esquema.ts`: `migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations --shadow-database-url $SHADOW --script` → `partirStatements` → `clasificarDrift` → si `drift.length > 0` imprime y sale ≠0. Import del clasificador = ÚLTIMA línea (se agrega con #760).
- [ ] **T2** · Alias npm `historial:check`.
- [ ] **T3** · `scripts/verify-historial-esquema.candado.test.ts` (control positivo): planta un campo sin migración → `drift` lo contiene. Estructura ahora; corre tras #760.
- [ ] **T4** · Documentar los 8 renombres de índice con su razón (constante + comentario).

## Tras #760 en `main`

- [ ] **T5** · Rebase; agregar el `import`; `tsc`/`lint`/correr; confirmar born-ROJO (drift de `Plan`); reportar.

## Tras #766 en `main`

- [ ] **T6** · Rebase; confirmar born-VERDE (drift vacío); cablear paso CI como **gate DURO** (sobre el `ci.yml` de #760) + shadow DB; confirmar born-green al CEO **antes** de duro.
