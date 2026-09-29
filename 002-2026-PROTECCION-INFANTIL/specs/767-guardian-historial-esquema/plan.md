# Plan · SPEC-767 · guardián de historial ≠ esquema

## Secuencia (orden del CEO): #760 → #766 → #767

- **#760 en main** → importar `drift-clasificador.ts` (regla «no copia»). Hoy vive en la rama de Datos.
- **#766 en main** → el drift de `Plan` desaparece → el guardián nace VERDE → gate DURO.
- **NO apilar** sobre la rama de Datos (#760): junta dos riesgos de la noche (PR-hijo huérfano al borrar base + dos manos en rama ajena). Se espera #760 en `main`.

## Construir AHORA (no depende del import)

1. **Script** `scripts/verify-historial-esquema.ts`: invoca `migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations --shadow-database-url $SHADOW --script`, captura stdout, `partirStatements` → `clasificarDrift`; si `drift.length > 0`, imprime las sentencias y sale ≠0. **El `import` de `@/lib/monitoreo/drift-clasificador` es la ÚLTIMA línea** (se agrega con #760).
2. **Alias** npm `historial:check`.
3. **Candado / control positivo** (`scripts/verify-historial-esquema.candado.test.ts`): planta un campo en un modelo sin migración → `clasificarDrift` lo pone en `drift`. Estructura ahora; corre y se verifica tras #760.
4. **Documentar los 8 renombres** de índice con su razón (constante + comentario).

## Tras #760 en `main`

- Rebase sobre `main`; agregar el `import`; `tsc` + `lint` + correr; confirmar born-**ROJO** (drift de `Plan`). Reportar.

## Tras #766 en `main`

- Rebase; confirmar born-**VERDE** (drift vacío); cablear el paso CI como **gate DURO** sobre el `ci.yml` que ya trae el paso de #760 (evita conflicto). Confirmar born-green al CEO **antes** de ponerlo duro.

## Shadow DB en CI

El paso corre en un job con servicio postgres (como `indices:check`): crea un shadow (`CREATE DATABASE proteccion_shadow`), pasa `SHADOW_DATABASE_URL`, corre `historial:check`, dropea el shadow. `migrate diff --to-migrations` resetea el shadow (replaya migraciones ahí).

## Distinción (va explícita en el PR)

- **#760** = esquema vs BD viva de prod (drift de DATO).
- **I-420** = scan estático de archivos de migración por patrones destructivos.
- **767** = migraciones vs esquema declarado (drift de HISTORIAL, dinámico).
Ninguno ve lo del otro. Reusa el clasificador de #760 (una fuente, tres consumidores).
