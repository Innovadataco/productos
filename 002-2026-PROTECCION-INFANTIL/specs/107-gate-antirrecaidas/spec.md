# Feature Specification: SPEC-107 — El gate que evita recaídas

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-28 (cola nocturna 002-PI-025, B3 — diseño decidido por ZEUS)

**Status**: FINALIZADO

**Input**: "a) specs-discipline exige plan.md y tasks.md con lista DEUDA_HEREDADA que solo
encoge; b) guarda anti-literal a todo el repo; c) CI mínimo (tsc+lint+test+build) como
compuerta real; d) artefactos pesados fuera del índice (.venv-presidio, dev.db), no del
historial; e) imagen de producción sin devDependencies. Fuera de alcance: CVE de xlsx
(solo reporte)."

## Requisitos (diseño obligatorio, ya implementado tal cual)

- **FR-107a**: `specs-discipline.test.ts` exige `plan.md` y `tasks.md` en toda spec, con
  constante `DEUDA_HEREDADA` (18 carpetas históricas) que **solo puede encoger, nunca
  crecer**. Aceptación: borrar `tasks.md` de una spec reciente → rojo; restaurar → verde
  (verificado).
- **FR-107b**: guarda anti-literal a todo el repo (`src/lib/credenciales-literal.test.ts`)
  con lista de exclusión explícita para fixtures y plantillas. Aceptación: literal de
  prueba fuera del seed → rojo (verificado).
- **FR-107c**: CI mínimo (`.github/workflows/ci.yml`) con `tsc` + `lint` + `test` + `build`
  y servicio Postgres pgvector, acotado a rutas del producto 002.
- **FR-107d**: `git rm -r --cached .venv-presidio` (10 112 archivos) y `prisma/dev.db`, más
  `.gitignore` y `.dockerignore`. Los 212 MB quedan en el historial como deuda registrada
  (reescribir historia en rama compartida es peor — regla dura 1).
- **FR-107e**: imagen de producción sin devDependencies: `tsx` movido a `dependencies`
  (worker/migrate/seed lo usan en runtime) y etapa `prod-deps` con `npm ci --omit=dev` en
  el Dockerfile. Verificado con build local: `tsx` y `prisma` presentes, 0 devDeps.

## Fuera de alcance (reporte, no acción)

- **xlsx `^0.18.5`** (en uso en `src/lib/colegio/carga/parser.ts`, carga masiva de alumnos):
  CVE-2023-30533 / GHSA-5pgg-2g4v-p4rj (ReDoS con archivo manipulado) y CVE-2024-22363 /
  GHSA-4r6h-8v6p-xvw6 (contaminación de prototipos). El fix (0.20.2) NO está en el registry
  npm (SheetJS CE se distribuye por su CDN desde 0.19.x). Opciones para ZEUS: cambiar la
  fuente del paquete al CDN de SheetJS, migrar el parser a otra librería, o endurecer la
  entrada (solo CSV, límites de tamaño/filas). Cambiar fuente o migrar toca una función
  viva: lo decide ZEUS.

## Success Criteria

- **SC-001**: gate bloquea specs nuevas sin plan/tasks y credenciales literales en cualquier
  archivo (ambos verificados rojo/verde).
- **SC-002**: `.venv-presidio` y `dev.db` fuera del índice en un solo commit; historia intacta.
- **SC-003**: imagen construye y su `node_modules` de runtime tiene 0 devDependencies.
