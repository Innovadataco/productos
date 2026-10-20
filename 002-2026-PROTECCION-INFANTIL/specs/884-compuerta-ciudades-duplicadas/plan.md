# Plan · SPEC-884

Diseño, grano medido y caveat en [`spec.md`](./spec.md). Mapa de cambios + verificación.

## Cambios

1. `prisma/migrations/20261020161100_spec884_ciudad_unique_parcial_pais_depto_norm/migration.sql` — índice
   UNIQUE parcial raw `(paisId, departamentoId, nombreNormalizado) WHERE "esActivo"` NULLS NOT DISTINCT.
   Aditiva, no destructiva. No toca schema.prisma.
2. `scripts/geo/normalizar-y-dedup-ciudades.ts` — corrector (re-normaliza + llena vacíos + dedup soft
   país-aware reusando `calcularDesactivaciones` de 580). dry-run/`--confirm`, atómico por fila.
3. `scripts/geo/detectar-ciudades-duplicadas.ts` — detector/guardián B blando (preflight): dups por
   `(paisId, departamentoId, norm)`, stale, vacíos, `nullDeptoDup`. exit 0/1/2.
4. `scripts/verify-hnsw-indexes.ts` — `REQUIRED` + campo `predicado` (substrings del indexdef) para vigilar
   el índice (existe + unique + NULLS NOT DISTINCT + esActivo). Misma lista que ya cubre trigram/HNSW.
5. `src/lib/geo/compuerta-ciudades-duplicadas.candado.test.ts` — candado (integración DB + lógica pura).
6. `package.json` — scripts `geo:detectar-duplicados` y `geo:normalizar-dedup`.

## Verificación (gate local)

- `npx tsc --noEmit` · `npm run lint` · `npm run arch:check` · el candado corre en el job `test-integration`
  (BD por worktree, que aplica la migración vía `prisma migrate deploy`) · `npm run indices:check` VERDE
  contra la BD migrada (confirma que el guardián reconoce el índice nuevo con su predicado). Node 22 en CI =
  fuente de verdad (SPEC-800).

> No despliego ni corro contra prod. El DEPLOY del índice y las CORRIDAS (preflight del detector + corrector
> si hay sucio) van APARTE del PR, por el responsable. El `CREATE UNIQUE INDEX` es la red: falla si el
> catálogo activo no quedó limpio. Verde en CI ≠ corrido en prod: el candado prueba la conducta con BD real.
