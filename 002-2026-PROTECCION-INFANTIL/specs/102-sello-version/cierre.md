# Cierre — Spec 102: Sello de versión (dev y prod)

**Fecha**: 2026-07-27 · **Rama**: `feature/001-scaffolding`

## Lo hecho

- **Versión**: `package.json` → `1.0.0`. Nuevo `src/lib/version.ts`: `APP_VERSION` (desde
  package.json) y `getBuildSha()` (lee `APP_BUILD_SHA`, SOLO servidor; null si falta).
- **Pie público** (`LandingFooter.tsx`, Server Component): `© 2026 Innovadataco. Todos los
  derechos reservados. · Versión 1.0.0` + enlaces Privacidad · Términos. SIN SHA ni fecha.
- **Panel admin**: `AdminVersionBadge.tsx` (Server Component) en el layout admin: versión +
  SHA corto del build; si no hay SHA, solo versión (no rompe).
- **Inyección del SHA**: `dev-restart.sh` exporta `APP_BUILD_SHA=$(git rev-parse --short HEAD)`
  antes del build (tolerante a fallo); `Dockerfile` con `ARG/ENV APP_BUILD_SHA` en el builder
  (horneado en el standalone); `deploy-prod.sh` + `docker-compose.prod.yml` pasan el arg
  (`${APP_BUILD_SHA:-}`). Nunca `NEXT_PUBLIC_`: el SHA no viaja al cliente público.

## Gate

tsc ✅ · lint ✅ (0 errores, 1 warning preexistente) · **917 tests** (los 2 fallos de
`auth/verificar/solicitar` vistos bajo carga son flakes de timing: pasan aislados; el fallo
de specs-discipline era la fila 102 del README, ya agregada) ✅ · build con
`APP_BUILD_SHA=testsha` ✅ · build sin la variable ✅.

## Tests nuevos

`src/lib/version.test.ts`, `src/components/modules/LandingFooter.test.tsx` (pie sin SHA,
con versión y enlaces).
