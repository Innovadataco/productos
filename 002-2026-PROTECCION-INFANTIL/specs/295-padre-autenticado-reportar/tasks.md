# Tasks — SPEC-295 · Padre autenticado puede reportar (I-146)

**Branch**: `work/002-PI-196`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Schema Prisma aditivo (FR-003)

- **T001** [✓] `prisma/schema.prisma` — agregar `origenRol String?` en `model Reporte` tras `usuarioId`.
- **T002** [✓] `prisma migrate dev --name spec_295_reporte_origen_rol --create-only` — verificar SQL puro `ALTER TABLE reportes ADD COLUMN "origenRol" TEXT;`.
- **T003** [✓] `prisma generate` — regenerar tipos.

## Fase 2 — API + Service (FR-004, FR-005)

- **T004** [✓] `src/lib/dal/services/reporte-creation-service.ts` — agregar `origenRol?: string | null` a `CrearInput` + persistir en `prisma.reporte.create`.
- **T005** [✓] `src/app/api/reportes/route.ts` — setear `origenRol: user?.rol === "PARENT" ? "PARENT" : null` en la llamada al service.
- **T006** [✓] Test integración `/api/reportes`: 3 casos (PARENT → `origenRol="PARENT"`; anónimo → `NULL`; interno → 403).

## Fase 3 — ReporteWizard con modoAutenticado (FR-002)

- **T007** [✓] `src/components/modules/ReporteWizard.tsx` — prop `modoAutenticado?: boolean`.
- **T008** [✓] Cuando `modoAutenticado`: init `esAnonimo=false`, banner "Reportando como {nombre}", checkbox "reportar anónimo", redirect a `/dashboard/padre/mis-reportes` en handleSubmit OK.
- **T009** [✓] `src/components/modules/ReporteWizard.test.tsx` — +2 casos con `modoAutenticado` (banner visible + redirect).

## Fase 4 — Página padre (FR-001)

- **T010** [✓] `src/app/dashboard/padre/reportar/page.tsx` — reemplazar stub por `<ReporteWizard modoAutenticado />` con h1 + intro.

## Fase 5 — E2E Playwright (FR-012)

- **T011** [✓] `tests/e2e/padre-reporta-autenticado.spec.ts` — login PARENT → `/dashboard/padre/reportar` → llenar wizard → assert redirect `/mis-reportes` + BD `origenRol="PARENT"`.

## Fase 6 — Gate LOCAL

- **T012** [✓] `tsc --noEmit`
- **T013** [✓] `lint` 0 err
- **T014** [✓] `tokens:check` · `arch:check` · `locks:check` · `ratchets:check`
- **T015** [✓] `test:unit` incluye ReporteWizard tests actualizados
- **T016** [✓] `test:integration -- reportes` verde
- **T017** [✓] `specs/README.md` — entrada SPEC-295

## Fase 7 — Pre-push (I-101/I-104)

- **T018** [✓] `git fetch && rebase && diff --name-status` — solo archivos SPEC-295

## Fase 8 — Push

- **T019** [✓] `git push origin work/002-PI-196` — Fábrica abre PR + mergea

## Fase 9 — Verificación en vivo (SC-008)

- **T020** [✓] Login `.env.e2e` PARENT → `/dashboard/padre/reportar` → enviar reporte → verificar redirect + BD `origenRol=PARENT`
- **T021** [✓] Cleanup notif prueba (soft delete)
- **T022** [✓] `cierre.md`: ruta canónica del wizard + decisión `String?` + redirect a `/mis-reportes` + regresión anónimo OK

---

## Restricciones activas

- 🔒 CERO cambios en motor IA (`src/lib/ai/**`).
- 🔒 CERO cambios en flujo anónimo público (`/reportar`).
- 🔒 CERO cambio a `PadreSideNav.tsx` (link ya OK).
- 🔒 Migración aditiva pura (`ALTER TABLE ADD COLUMN` nullable, sin default rompedor).
- 🔒 CERO auto-creación de Expediente al reportar (fuera de alcance).
- 🔒 CERO cambio a los tipos `RolUsuario` enum (solo campo string aditivo).
