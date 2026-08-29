# Investigación: SPEC-190 — Deploy ejecuta seed idempotente

## Contexto

- `scripts/deploy-prod.sh` ya ejecuta `prisma migrate deploy`, `scripts/sync-modulos-grants.ts` y `scripts/geo-import-si-falta.ts`.
- `prisma/seed.ts` no estaba en el deploy, lo que dejó huérfanos los parámetros de SPEC-171 hasta intervención manual (I-67).
- SPEC-187 corrigió el seed para no pisar valores custom (`update: {}` en parámetros viejos).

## Lecciones aplicadas

- Fail-loud: si el seed falla, el deploy debe detenerse (`set -e` ya está activo).
- Idempotencia: el seed debe poder correr N veces sin cambiar valores ajustados manualmente.
- Documentación: cada excepción que pisa un valor debe estar justificada con un comentario.
