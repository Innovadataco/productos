# Tasks: Consentimiento informado + modal legal + AuditConsentimiento (SPEC-241)

**Input**: `specs/241-consentimiento-modal-audit/spec.md`, `plan.md`, `data-model.md`, `contracts/consentimiento.md`

**Branch**: `work/002-PI-144`

**Tests**: Unitarios + integración (Vitest + jsdom + PostgreSQL)

---

## Phase 1 — Schema, migración y seed

- [x] T001 Extender `prisma/schema.prisma`: `Usuario` +4 campos de consentimiento; nuevo modelo `AuditConsentimiento` + índices + FK.
- [x] T002 Crear migración aditiva `prisma/migrations/20260825054000_consentimiento_audit/migration.sql` (solo ADD COLUMN / CREATE TABLE / CREATE INDEX / ADD FK).
- [x] T003 Aplicar migración en BD dev y test (`npx prisma@5.22.0 migrate dev`).
- [x] T004 Copiar documentos legales a `public/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md` y `public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md`.
- [x] T005 Extender `prisma/seed.ts` con parámetros `consentimiento.version_actual`, `consentimiento.padre.documento_ruta`, `consentimiento.colegio.documento_ruta` (idempotente).
- [x] T006 Extender `prisma/seed.ts` con evento `consentimiento.aceptado`, plantillas EMAIL/IN_APP y reglas por rol (idempotente).
- [x] T007 Verificar idempotencia del seed ejecutándolo dos veces.

---

## Phase 2 — DAL y servicio

- [x] T010 Crear `src/lib/dal/repositories/consentimiento.ts` (crear registro, listar por usuario).
- [x] T011 Extender `src/lib/dal/repositories/usuario.ts` con `findConConsentimiento` y `actualizarConsentimiento`.
- [x] T012 Crear `src/lib/dal/services/consentimiento.ts`: `versionVigente`, `versionEstaActual`, `documentoPorRol`, `obtenerDocumentoVigente`, `calcularHash`, `aceptar`.
- [x] T013 Usar `withUnitOfWork` para transaccionar aceptación.

---

## Phase 3 — API

- [x] T020 Agregar `consentimientoAceptarSchema` en `src/lib/validators.ts`.
- [x] T021 Crear `src/app/api/consentimiento/aceptar/route.ts` con auth, validación, hash SHA256, `AuditConsentimiento`, `AuditLog`, notificación y respuestas 201/200/400/401/500.
- [x] T022 Crear test de integración `src/app/api/consentimiento/aceptar/route.test.ts`:
  - éxito crea audit + actualiza usuario + notifica
  - hash SHA256 correcto
  - 401 sin sesión
  - idempotencia (200 sin duplicar)
  - re-aceptación al cambiar versión
  - 400 con `documentoTipo` inválido
  - SCHOOL_ADMIN acepta convenio institucional

---

## Phase 4 — UI/UX

- [x] T030 Crear `src/components/modules/ModalConsentimiento.tsx` con `IntersectionObserver`, checkboxes, botón deshabilitado, color por rol y POST a `/api/consentimiento/aceptar`.
- [x] T031 Crear test unitario `src/components/modules/ModalConsentimiento.test.tsx` y registrarlo en `vitest.unit.includes.ts`.
- [x] T032 Crear `src/app/consentimiento/page.tsx` (Server Component) con carga de documento por rol y redirecciones.
- [x] T033 Crear test de integración `src/app/consentimiento/page.test.tsx`:
  - redirige a `/login` sin token / token inválido
  - redirige al dashboard si ya aceptó
  - renderiza modal con `POLITICA_DATOS` para PARENT
  - renderiza modal con `CONVENIO_INSTITUCIONAL` para SCHOOL_ADMIN

---

## Phase 5 — Guardia de consentimiento en layouts

- [x] T040 Crear helper reusable `src/lib/consentimiento/guard.ts` (`requiereConsentimientoActual`), fail-open.
- [x] T041 Aplicar guardia en `src/app/dashboard/layout.tsx`.
- [x] T042 Aplicar guardia en `src/app/dashboard/padre/layout.tsx`.
- [x] T043 Aplicar guardia en `src/app/dashboard/colegio/layout.tsx`.
- [x] T044 Aplicar guardia en `src/app/dashboard/admin/layout.tsx`.
- [x] T045 Crear helpers de test `src/lib/consentimiento-test-utils.ts`.
- [x] T046 Crear test `src/lib/consentimiento/guard.test.ts`:
  - true cuando no ha aceptado
  - false cuando aceptó versión vigente
  - true cuando cambió la versión vigente
  - false (fail-open) si no hay parámetro

---

## Phase 6 — Validación y cierre

- [x] T050 `npx prisma@5.22.0 generate`
- [x] T051 `npx tsc --noEmit`
- [x] T052 `npm run lint`
- [x] T053 `npm run test:unit`
- [x] T054 `npm run test:integration` (scope 241)
- [x] T055 `npm run build`
- [x] T056 `npm run arch:check`
- [x] T057 `./scripts/dev-restart.sh`
- [x] T058 Actualizar `spec.md` (status + sección Implementación)
- [x] T059 Crear/actualizar `cierre.md`
- [ ] T060 Commits por user story + docs

---

## Notas

- No se introdujo `middleware.ts` global; las guardias viven en layouts Server Components.
- ADMIN, OPERADOR y COMITE_VALIDACION usan `POLITICA_DATOS`; SCHOOL_ADMIN y COMITE_CONVIVENCIA usan `CONVENIO_INSTITUCIONAL`.
- Timestamps en BD son UTC; `date-fns-tz` solo se usa para presentación en la notificación.
- AuditConsentimiento es inmutable: no hay endpoints de edición/eliminación.
