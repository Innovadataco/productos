# Tasks: Colegios · Fase 5 — Estadísticas e informe PDF institucional

## Phase 1 — Preparación e investigación

- **T001 [P]** Instalar `pdfmake` (`npm install pdfmake` + `@types/pdfmake`). `package.json`
- **T002** Verificar que `pdfmake` genera buffers correctamente en un route handler de Node runtime. `src/app/api/colegio/estadisticas/pdf/route.ts` (prototipo)
- **T003** Revisar si el enum `AccionAudit` necesita `COLEGIO_ESTADISTICAS_PDF_DESCARGADO`; agregarlo si no existe. `prisma/schema.prisma`, `prisma/migrations/20260721_add_accion_estadisticas_pdf`
- **T004** Backup de la BD antes de aplicar cualquier cambio (si aplica migración). `scripts/`
- **T005** Aplicar migración aditiva si es necesaria. `npx prisma migrate deploy`

## Phase 2 — Servicio de estadísticas

- **T006** Crear `src/lib/colegio/estadisticas.ts` con función `calcularEstadisticasColegio(colegioId)` que devuelva totales y desglose por curso. `src/lib/colegio/estadisticas.ts`
- **T007** Decidir estrategia de conteo: `prisma.$queryRaw` o combinación de `count`/`groupBy`. Documentar en `research.md`.
- **T008** Excluir alertas de reportes dados de baja en el conteo. `src/lib/colegio/estadisticas.ts`

## Phase 3 — Endpoints

- **T009** Crear `GET /api/colegio/estadisticas/route.ts` con `verifyAuth("SCHOOL_ADMIN")`, rate-limit, y llamada al servicio. `src/app/api/colegio/estadisticas/route.ts`
- **T010** Crear `GET /api/colegio/estadisticas/pdf/route.ts` con `verifyAuth("SCHOOL_ADMIN")`, generación de PDF con `pdfmake`, registro de auditoría, y `Content-Disposition`. `src/app/api/colegio/estadisticas/pdf/route.ts`
- **T011** Declarar `export const runtime = "nodejs"` en el endpoint de PDF. `src/app/api/colegio/estadisticas/pdf/route.ts`

## Phase 4 — PDF helper

- **T012** Crear `src/lib/colegio/pdf-estadisticas.ts` con función `generarPdfEstadisticas(datos)` que reciba el resumen y devuelva un `Buffer`. Usar estilos verdes. `src/lib/colegio/pdf-estadisticas.ts`
- **T013** Definir tipos TypeScript para los datos de entrada del PDF. `src/lib/colegio/pdf-estadisticas.ts`

## Phase 5 — UI

- **T014** Reemplazar `src/app/dashboard/colegio/estadisticas/page.tsx` por la vista real con tarjetas, tabla y botón de descarga. `src/app/dashboard/colegio/estadisticas/page.tsx`
- **T015** Actualizar `src/app/dashboard/colegio/page.tsx` para que el link de "Estadísticas" esté activo y diga "Estadísticas". `src/app/dashboard/colegio/page.tsx`
- **T016** Usar componentes existentes (Card, Button, Table, Spinner, ErrorState si existe). `src/components/ui/`
- **T017** Aplicar tema verde (`accent-gradient`, `text-accent`, `bg-emerald-50/60`, etc.). `src/app/dashboard/colegio/estadisticas/page.tsx`

## Phase 6 — Tests

- **T018** Crear `src/app/api/colegio/estadisticas/route.test.ts` con tests: éxito, aislamiento (no ve otro colegio), alertas excluyen reportes dados de baja, estado vacío. `src/app/api/colegio/estadisticas/route.test.ts`
- **T019** Crear test del PDF: status 200, content-type `application/pdf`, body no vacío, 403 para otros roles. `src/app/api/colegio/estadisticas/pdf/route.test.ts`
- **T020** Test unitario de `calcularEstadisticasColegio` si es exportable. `src/lib/colegio/estadisticas.test.ts` (opcional)

## Phase 7 — Validación y cierre

- **T021** `npx tsc --noEmit`.
- **T022** `npm run lint`.
- **T023** `npx vitest run` (meta: ≥704 tests verdes).
- **T024** `npm run build`.
- **T025** `./scripts/dev-restart.sh` (deploy limpio, un worker, healthcheck).
- **T026** Ejecutar `quickstart.md` y verificar manualmente.
- **T027** Actualizar sección "Implementación" en `specs/078-colegios-estadisticas-pdf/spec.md`.
- **T028** Crear `specs/078-colegios-estadisticas-pdf/cierre.md` con evidencia.
- **T029** Commit por US + docs; push a `feature/001-scaffolding`.
- **T030** Marcar Status `CERRADA` en `spec.md`.

## Phase 8 — Ciclo de deuda (opcional, máx 3 rondas)

- **T031** Revisar deudas de bajo riesgo dentro del alcance y corregir.
- **T032** Documentar deudas que no se auto-corrijan.
- **T033** Volver a correr tests/deploy si se hicieron correcciones.
