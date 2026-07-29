# Tasks: SPEC-121 — Sobre de error único (R2) + timeout de Ollama

**Spec**: `specs/121-error-wrapper-ollama-timeout/spec.md` · **Plan**: `plan.md`

## Fase 1 — Pieza central R2 (commit propio, sin tocar rutas)

- [x] T001 Exportar `formatZodError` desde `src/lib/validation.ts` (aditivo).
- [x] T002 [P] Crear `src/lib/api-handler.ts`: `errorToResponse` (AppError →
  status/toJSON; ZodError → 400 VALIDATION_ERROR; resto → console.error + 500
  genérico sin filtrar `code` ni `message`) + `withErrorHandler`.
- [x] T003 [P] Crear `src/lib/api-handler.test.ts`: equivalencia con lógica
  legacy replicada (AppError 400/401/403/404/409/429/500, ValidationError,
  contrato `{ error: { message, code } }`); `Error` con `code` → 500 (no 403,
  sin fuga); no-`Error` → 500; `withErrorHandler` éxito/error.
- [x] T004 Verificar T003 verde bajo candado y commitear pieza central sola.

## Fase 2 — Timeout de Ollama (commit propio)

- [x] T005 `src/lib/ai/ollama-config.ts`: `getOllamaTimeoutMs()` (param
  `ia.ollama.timeout_ms`, entero > 0, default 120 000 ms, fallback silencioso).
- [x] T006 `src/lib/ai/ollama-client.ts`: `AbortSignal.timeout(await
  getOllamaTimeoutMs())` en los dos fetch a `/api/generate`. Sin más cambios.
- [x] T007 [P] `src/lib/ai/ollama-timeout.test.ts`: efecto del parámetro sobre
  el timeout aplicado; fetch colgado aborta; param inválido → default.
- [x] T008 `prisma/seed.ts`: upsert aditivo `ia.ollama.timeout_ms` = `"120000"`
  (INTEGER, SYSTEM, no público) con descripción.
- [x] T009 Verificar T007 verde bajo candado y commitear (config + client +
  test + seed).

## Fase 3 — Migración de rutas (commits por zona)

- [x] T010 Zona colegio/cursos (4 archivos): `colegio/cursos/route.ts`,
  `colegio/cursos/[id]/route.ts`, `colegio/cursos/[id]/estado/route.ts`,
  `colegio/cursos/[id]/alumnos/route.ts`. Tests de la zona verdes.
- [x] T011 Zona colegio/alumnos (3 archivos): `colegio/alumnos/[id]/route.ts`,
  `colegio/alumnos/[id]/estado/route.ts`,
  `colegio/alumnos/[id]/identificadores/route.ts` (preservar 404 "Alumno no
  encontrado"). Tests de la zona verdes.
- [x] T012 Zona colegio/alertas + identificadores (4 archivos):
  `colegio/alertas/route.ts`, `colegio/alertas/[id]/estado/route.ts`,
  `colegio/identificadores/[id]/route.ts`,
  `colegio/identificadores/[id]/estado/route.ts`. Tests de la zona verdes.
- [x] T013 Zona admin/colegios (2 archivos): `admin/colegios/route.ts`,
  `admin/colegios/[id]/route.ts`. Tests de la zona verdes.
- [x] T014 Zona admin/operadores (2 archivos): `admin/operadores/route.ts`,
  `admin/operadores/[id]/route.ts`. Tests de la zona verdes.
- [x] T015 Zona admin/comite/integrantes (2 archivos):
  `admin/comite/integrantes/route.ts`,
  `admin/comite/integrantes/[id]/route.ts`. Tests de la zona verdes.
- [x] T016 Zona admin/reportes-revision (1 archivo):
  `admin/reportes-revision/[id]/reasignar/route.ts`.
- [x] T017 Verificación global: 0 ocurrencias de
  `safeErrorMessage(error), code: error.code` en `src/app/api`; imports
  huérfanos (`AppError`, `safeErrorMessage`) limpiados por archivo.

## Fase 4 — Gate y cierre

- [x] T018 Gate bajo candado: `npx tsc --noEmit` + `npm run lint` + tests
  tocados + `npm run build`.
- [x] T019 Suite completa `npm run test` bajo candado (incl.
  `efecto-motor-111.test.ts` verde: ninguna decisión del motor cambió).
  1066/1067: único fallo `specs-discipline.test.ts` por índice
  `specs/README.md` (archivo prohibido en este bloque; lo cierra el
  coordinador).
- [x] T020 `cierre.md` + sección Implementación en `spec.md` + tabla de
  migración en `plan.md` actualizada + tasks marcados. Commits selectivos
  (sin push).
