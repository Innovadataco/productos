# SPEC-921 · El step build de CI sube el heap a 4096 MB (anti-OOM)

**Status**: IMPLEMENTADO

**Prioridad:** sin deploy (CI/tooling). Mergeado en `4acbc03f` (PR #918).
**Nota retroactiva:** esta nota se escribe en SPEC-924 — el PR #918 mergeó SIN `spec.md`, que
es justo el hueco que SPEC-924 cierra con el guardia de `verificar_base`.

## Problema

El runner de CI (Node 22.23.4) hacía `FATAL ERROR: JavaScript heap out of memory` en
`next build` (tope por defecto ~2079 MB) y bloqueaba TODO merge. Determinista (idéntico en
#916/#917): deriva del entorno de CI, no del código de los PRs.

## Cambio

`.github/workflows/ci.yml`, job `build`, `env:` del step `- run: npm run build`:

```yaml
NODE_OPTIONS: --max-old-space-size=4096
```

Mismo tope que el stage builder del Dockerfile (SPEC-856).

## Candado

`scripts/ci/build-heap-ci.candado.test.ts` (allowlist unit): aísla el bloque del step build en
`ci.yml` y exige `--max-old-space-size=N` con N ≥ 4096. Muere con el defecto por mutación:
quitar la línea → sin match → rojo; bajarla a 2048 → rojo. El step build en verde prueba que ya
no hace OOM.
