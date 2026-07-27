# Implementation Plan: SPEC-107 — El gate que evita recaídas

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

## Summary

Cinco endurecimientos del gate y del repo, con el diseño ya decidido por ZEUS (cola 025,
B3): disciplina de artefactos Spec-Kit con deuda heredada acotada, guarda anti-literal
repo-ancho, CI mínimo, índice sin artefactos pesados (sin tocar el historial) e imagen de
producción sin devDependencies.

## Diseño (implementado tal cual)

1. **a) Disciplina**: `DEUDA_HEREDADA` (18 carpetas) en `specs-discipline.test.ts` con
   comentario "solo puede encoger, nunca crecer"; nuevo test que exige plan.md + tasks.md
   fuera de la lista, y test de consistencia de la lista (no crece con carpetas fantasmas).
2. **b) Anti-literal**: `src/lib/credenciales-literal.test.ts` recorre el repo (excluye
   node_modules/.next/.git/.venv) con patrón de asignación credencial→literal ≥8 chars;
   exclusiones: tests/fixtures, test-setup/utils, `.env*example`, el propio test, el
   barrido CLI, verify-encryption; placeholders de contenido ignorados en cualquier archivo.
3. **c) CI**: `.github/workflows/ci.yml` — paths solo del 002, Postgres pgvector:pg16 como
   servicio en 5433, migrate deploy, tsc → lint → test → build (Node 22, cache npm).
4. **d) Índice**: `git rm -r --cached` de `.venv-presidio` (10 112 archivos) y
   `prisma/dev.db`; `.gitignore` y `.dockerignore` actualizados. Historial intacto (deuda
   aceptada por ZEUS, registrada).
5. **e) Imagen**: `tsx` a `dependencies` (runtime: worker `--import tsx`, `prisma db seed`
   via tsx; `prisma` CLI ya era dependency); etapa `prod-deps` (`npm ci --omit=dev` +
   `prisma generate`) y el runner copia ese `node_modules` (no el del builder completo).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Autobloqueo por specs históricas incompletas | Lista heredada explícita y acotada (solo encoge) — diseño obligatorio |
| Runner sin tsx/prisma al quitar devDeps | Ambos movidos/confirmados en `dependencies`; build local de verificación |
| CI sin Ollama (tests que llaman modelos) | Tests con mocks; si alguno lo requiriese, se documenta (regla 8) |
