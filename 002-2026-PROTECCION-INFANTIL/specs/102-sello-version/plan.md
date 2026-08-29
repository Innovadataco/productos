# Implementation Plan: Spec 102 — Sello de versión (dev y prod)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

> Backfill documental (cierre cola 002-PI-014): plan reconstruido a partir del spec.md,
> el cierre.md y el commit `f0d4d934`. Documenta lo hecho.

## Summary

Sello de versión visible: pie público con `© 2026 Innovadataco … · Versión 1.0.0` +
Privacidad/Términos (sin SHA ni fecha), y badge en el panel admin con versión + SHA corto
del build expuesto SOLO por servidor (nunca `NEXT_PUBLIC_`). El SHA se inyecta en build en
los tres caminos (dev-restart, Dockerfile, deploy-prod) y su ausencia no rompe nada.

## Diseño

1. **Fuente de versión**: `package.json` → `1.0.0` (lockfile alineado). `src/lib/version.ts`:
   `APP_VERSION` (desde package.json) y `getBuildSha(): string | null` (lee
   `process.env.APP_BUILD_SHA`, solo servidor).
2. **Pie público** (`LandingFooter.tsx`, Server Component): texto exacto + enlaces
   Privacidad · Términos. Sin SHA ni fecha (la versión es dato público; el SHA no viaja).
3. **Panel admin**: `AdminVersionBadge.tsx` (Server Component) en
   `src/app/dashboard/admin/layout.tsx`: versión + SHA corto; sin SHA → solo versión.
4. **Inyección del SHA**:
   - `scripts/dev-restart.sh`: `export APP_BUILD_SHA=$(git rev-parse --short HEAD || true)`
     antes del build.
   - `Dockerfile`: `ARG/ENV APP_BUILD_SHA` en builder (horneado en el standalone) y runner.
   - `scripts/deploy-prod.sh` + `docker-compose.prod.yml`: `build.args.APP_BUILD_SHA`
     desde el tag del commit (`${APP_BUILD_SHA:-}`).
5. **Detalle del proyecto**: los headers de `next.config` se hornean en build; el SHA SOLO
   viene de la env de build, nada de leer git en runtime.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| SHA en el cliente público | Variable NO pública + badge solo en layout admin (Server Component); test del pie sin SHA |
| Build sin git/SHA falla | `getBuildSha()` → null → solo versión; verificado build con y sin la variable |
| Footer client component filtrando env | Footer como Server Component (o prop desde server) |

## Pruebas

Tests nuevos: `src/lib/version.test.ts` (APP_VERSION; getBuildSha con/sin env) y
`LandingFooter.test.tsx` (pie con "Versión 1.0.0" + enlaces, sin SHA). Gate: lint + test +
tsc + build (917/917) + build verificado con `APP_BUILD_SHA=testsha` y sin ella.
