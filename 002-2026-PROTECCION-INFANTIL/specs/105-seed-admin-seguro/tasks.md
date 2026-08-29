# Tasks — SPEC-105: Seed del admin inicial sin credencial literal (I-31)

**Input**: plan.md, spec.md, research.md, data-model.md, quickstart.md de
`/specs/105-seed-admin-seguro/` | **Branch**: `feature/001-scaffolding`

Nota de alcance (ZEUS, 002-PI-019): el seed crea UN solo usuario (el admin) — verificado en
fuente. El barrido (US2) NO asume otros usuarios; si cierra en cero hallazgos, se reporta así.

## Fase 1: Setup

- [x] T001 Confirmar en `prisma/seed.ts` el estado actual del bloque admin (líneas ~9-29) y que `bcrypt.hash` solo se usa para ese usuario en `prisma/` y `scripts/`.

## Fase 2: US1 (P1) — Admin inicial sembrado sin secreto en el repo

**Goal**: admin solo-desde-env, create puro, `debeCambiarPassword:true`, omisión segura sin la variable.
**Independent Test**: quickstart pasos 1–4.

- [x] T002 [US1] Reescribir el bloque del admin en `prisma/seed.ts`: leer `SEED_ADMIN_EMAIL` (default `soporte@innovadataco.com`) y `SEED_ADMIN_PASSWORD` (SIN default); ausente/vacía/débil (< `security.password_min_length`, fallback 12) → log `[SEED] Admin omitido: SEED_ADMIN_PASSWORD no definida o débil` y continuar; existente → log `existente, sin cambios` y NO tocarlo; si no existe → `create` con bcrypt(12) y `debeCambiarPassword: true`. Eliminar el literal y el bloque `update:`.
- [x] T003 [P] [US1] Documentar `SEED_ADMIN_PASSWORD` (y `SEED_ADMIN_EMAIL`) en `.env.example` y `.env.production.example`: nombre + comentario, SIN valor.
- [x] T004 [US1] Validar quickstart pasos 1–4 en vivo contra la BD dev (crea con flag; no pisa rotada; omite sin variable; omite si débil) y dejar evidencia para el cierre.

## Fase 3: US2 (P2) — Barrido de credenciales literales del repo

**Goal**: reporte archivo:línea + tipo, NUNCA valores, con clasificación real vs placeholder.
**Independent Test**: `npx tsx scripts/barrido-credenciales.ts` produce el reporte.

- [x] T005 [US2] Crear `scripts/barrido-credenciales.ts`: recorre el repo (excluye `node_modules`, `.next`, `.git`, `.venv*`) buscando patrones de credencial literal (`password|passwd|secret|token|_key` con string literal no-placeholder); clasifica placeholder aceptable (`*_example`, `*.test.*`, docs con valores evidentemente ficticios, `cambiar-en-*`, `build-placeholder`); imprime archivo:línea + tipo, NUNCA el valor; exit 1 si hay hallazgos "real".
- [x] T006 [US2] Ejecutar el barrido y registrar el resultado (hallazgos o cero) para el cierre.

## Fase 4: US3 (P3) — Guarda de regresión anti-literal

**Goal**: test que falla si una contraseña literal vuelve al seed.
**Independent Test**: `npm run test -- prisma` verde con el seed corregido; roja con literal reintroducido.

- [x] T007 [P] [US3] Crear `prisma/seed-security.test.ts`: (a) escanea `prisma/seed.ts` y falla si una variable `*password*`/`adminPassword` recibe un string literal que no provenga de `process.env`; (b) falla si el bloque del admin contiene `update:` (anti-pisado); (c) falla si el create del admin no lleva `debeCambiarPassword: true`.

## Fase 5: FR-007 + cierre

- [x] T008 Documentar el procedimiento de rotación para el CEO en `docs/runbook.md` (sección nueva: fijar `SEED_ADMIN_PASSWORD` en el entorno del VPS antes de cualquier seed futuro; rotación de la credencial viva por el CEO). Sin valores.
- [x] T009 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build` (todo verde).
- [x] T010 `cierre.md` en la carpeta de la spec (con el resultado del barrido US2) + actualizar `specs/README.md` (105 → Finalizada, SIN desplegar) + commits convencionales + push. **NO desplegar** (lo autoriza el CEO en el próximo lote).

## Dependencias

- T001 → T002 → T004 · T002 → T005/T006 (el barrido corre sobre el seed ya corregido) · T003 y T007 en paralelo · T008–T010 al final.
