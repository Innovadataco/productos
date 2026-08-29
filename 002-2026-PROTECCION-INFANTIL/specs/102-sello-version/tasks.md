# Tasks — Spec 102: Sello de versión (dev y prod)

> Backfill documental (cierre cola 002-PI-014): tareas ejecutadas, reconstruidas del
> cierre.md y el commit `f0d4d934`. Todas completadas.

- [x] T001 FR-003: `version` → `1.0.0` en `package.json` (+ lockfile); `src/lib/version.ts` (`APP_VERSION`, `getBuildSha()` solo servidor).
- [x] T002 FR-001: pie público en `src/components/modules/LandingFooter.tsx` — `© 2026 Innovadataco. Todos los derechos reservados. · Versión 1.0.0` + Privacidad · Términos, sin SHA ni fecha.
- [x] T003 FR-002: `src/components/modules/AdminVersionBadge.tsx` (Server Component) montado en `src/app/dashboard/admin/layout.tsx` — versión + SHA corto; sin SHA → solo versión.
- [x] T004 FR-003: inyección en dev — `export APP_BUILD_SHA` en `scripts/dev-restart.sh` (tolerante a fallo).
- [x] T005 FR-003: inyección en prod — `ARG/ENV APP_BUILD_SHA` en `Dockerfile` (builder + runner), `build.args` en `docker-compose.prod.yml`, export en `scripts/deploy-prod.sh`.
- [x] T006 [P] Tests: `src/lib/version.test.ts` y `src/components/modules/LandingFooter.test.tsx`.
- [x] T007 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` (917/917) + `npm run build` con `APP_BUILD_SHA=testsha` y sin la variable (ambos verdes).
- [x] T008 `cierre.md` + fila en `specs/README.md` + commit `f0d4d934` + push.
