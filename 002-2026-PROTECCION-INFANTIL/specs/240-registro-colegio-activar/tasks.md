# Tasks — SPEC-240 · Registro público de colegio + /activar + fix BUG-01

**Branch**: `work/002-PI-143`  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Schema y seed

- **T001** [P] Migración aditiva: agregar enum `EstadoActivacion` y campos `estadoActivacion`, `tokenInvitacion`, `tokenInvitacionExpiraEn` en `Usuario`.
  - Archivo: `prisma/schema.prisma`
  - Salida: migración SQL aditiva en `prisma/migrations/`
- **T002** [P] Seed idempotente: parámetro `pagos.invitacion.token_vigencia_horas` (default 48h), regla y plantilla del evento `colegio.invitacion.enviada` con `upsert`.
  - Archivo: `prisma/seed.ts`

## Fase 2 — DAL y servicio

- **T003** [P] Extender `UsuarioRepository` con métodos de invitación.
  - Archivo: `src/lib/dal/repositories/usuario.ts`
  - Métodos: `findByTokenInvitacion(token)`, `crearRectorConToken(...)`, `consumirTokenInvitacion(token, passwordHash)`
- **T004** [P] Extender `ColegioRepository` con helper de creación mínima.
  - Archivo: `src/lib/dal/repositories/colegio.ts`
  - Método: `crearColegioMinimo(data)` (o adaptar `crear` existente)
- **T005** [P] Crear `RegistroColegioService`.
  - Archivo: `src/lib/dal/services/registro-colegio.ts`
  - Métodos: `registrarPublico(...)`, `preRegistrarPorAdmin(...)`, `activarPorToken(...)`

## Fase 3 — API Routes

- **T006** [P] Extender `POST /api/auth/verificar/completar` para crear colegio cuando venga `nombreColegio` + `rol=SCHOOL_ADMIN`.
  - Archivo: `src/app/api/auth/verificar/completar/route.ts`
- **T007** [P] Crear `POST /api/auth/activar` para consumir token de invitación.
  - Archivo: `src/app/api/auth/activar/route.ts`
- **T008** [P] Simplificar `POST /api/admin/colegios`: 3 campos, token INVITADO, evento, modal.
  - Archivo: `src/app/api/admin/colegios/route.ts`
- **T009** [P] Agregar schemas Zod en `src/lib/validators.ts` para registro colegio, activar y admin-colegio-nuevo.

## Fase 4 — UI

- **T010** [P] Crear `/registro-colegio/page.tsx` y `RegistroColegioForm`.
  - Archivos: `src/app/registro-colegio/page.tsx`, `src/components/modules/RegistroColegioForm.tsx`
- **T011** [P] Reutilizar `VerificacionForm` con `nombre` opcional para el paso 2 del colegio.
  - Archivo: `src/components/modules/VerificacionForm.tsx`
- **T012** [P] Crear `/activar/page.tsx` y `ActivarForm` con guarda server-side de token.
  - Archivos: `src/app/activar/page.tsx`, `src/components/modules/ActivarForm.tsx`
- **T013** [P] Rediseñar `/dashboard/admin/colegios/nuevo/NuevoColegioPageClient.tsx`: 3 campos + modal (fix BUG-01).
  - Archivo: `src/app/dashboard/admin/colegios/nuevo/NuevoColegioPageClient.tsx`
- **T014** [P] Crear `InvitacionEnviadaModal` si no existe un modal genérico reusable.
  - Archivo: `src/components/modules/InvitacionEnviadaModal.tsx`

## Fase 5 — Tests

- **T015** [P] Tests de integración para consumo de token válido, expirado y usado.
  - Archivos: `src/app/api/auth/activar/route.test.ts`, `src/lib/dal/services/registro-colegio.test.ts`
- **T016** [P] Test de idempotencia del seed de `colegio.invitacion.enviada`.
  - Archivo: `prisma/seed.test.ts` o test de integración correspondiente
- **T017** [P] E2E del registro público de colegio y fix BUG-01.
  - Archivo: `tests/e2e/registro-colegio.spec.ts`

## Fase 6 — Cierre

- **T018** [P] Regenerar línea base de arquitectura: `npm run arch:check` en verde.
- **T019** [P] Gate local: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`.
- **T020** [P] Gate pre-push: `git fetch && git rebase origin/feature/001-scaffolding && git diff --name-status origin/feature/001-scaffolding..HEAD`.
- **T021** [P] Actualizar `spec.md` sección Implementación y crear `cierre.md`.

---

## Notas de coordinación

- Merge del Lote 1 en orden: **240 → 241 → 242 → 243** (evita 404 en `/consentimiento` entre deploys).
- No introducir `middleware.ts` global en esta SPEC; la guarda `/activar` es server-side en la página.
- Vigencia real del servicio se gestiona desde `Suscripcion` (SPEC-244/SPEC-213); `Colegio.inicioServicio` solo es fallback legacy.
