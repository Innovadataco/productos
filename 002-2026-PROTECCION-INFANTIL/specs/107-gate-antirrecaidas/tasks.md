# Tasks — SPEC-107: El gate que evita recaídas

> Cola 002-PI-025, B3. Diseño decidido por ZEUS, implementado tal cual. Todas completadas.

- [x] T001 a) `DEUDA_HEREDADA` (18 carpetas) en `src/lib/specs-discipline.test.ts` + test plan/tasks obligatorios fuera de la lista + test de consistencia. Aceptación rojo/verde con `tasks.md` de la 106.
- [x] T002 b) `src/lib/credenciales-literal.test.ts` (guarda repo-ancho con exclusiones explícitas). Aceptación rojo/verde con literal de prueba en `src/lib/`.
- [x] T003 c) `.github/workflows/ci.yml` (tsc+lint+test+build, Postgres pgvector, paths del 002).
- [x] T004 d) `git rm -r --cached .venv-presidio` (10 112 archivos) + `prisma/dev.db`; `.gitignore` + `.dockerignore`. Historial intacto (212 MB = deuda registrada).
- [x] T005 e) `tsx` a `dependencies` + lockfile; etapa `prod-deps` en `Dockerfile` (`npm ci --omit=dev`); build local: `tsx`/`prisma` presentes, 0 devDeps en la imagen.
- [x] T006 Reporte xlsx (versión, CVEs aplicables, opciones) en spec.md — sin acción (fuera de alcance).
- [x] T007 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build`.
- [x] T008 Artefactos de la spec + commit + push (un commit por bloque).
