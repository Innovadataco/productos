# Tasks: SPEC-334 · El padre registra los datos de su perfil

**Radicado**: 002-PI-234 · **Branch**: `work/pi-SPEC-334-perfil-padre-datos`
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **PR**: #192

## Phase 1: Setup
- [x] T001 Worktree `pi-perfil-padre-datos` + `npm ci` (node_modules propio) · base `origin/main` (478cc4769)

## Phase 2: Modelo (US1 · FR-002)
- [x] T002 [US1] `prisma/schema.prisma`: 5 campos ADITIVOS y nullable en `Usuario` — `apellidos`, `fechaNacimiento`, `telefono`, `paisId` (FK `Pais`), `ciudadId` (FK `Ciudad`). "Nombres" reusa el `nombre` existente, no se agrega campo.
- [x] T003 [US1] Migración `20260831181853_spec_334_perfil_padre_datos/migration.sql` — aditiva, sin backfill, reversible (columnas nullable; nada de `NOT NULL` sobre filas existentes).
- [x] T004 `npx prisma generate` (el cliente local queda al día; sin él `tsc` reporta drift falso).

## Phase 3: DAL + endpoint (FR-007)
- [x] T005 [US1] `src/lib/dal/repositories/usuario.ts`: leer/actualizar los 6 campos del perfil. Frontera DAL — la ruta no toca Prisma directo.
- [x] T006 [US1] `src/app/api/padre/perfil/route.ts`: `GET` + `PATCH` con `verifyAuth("PARENT")` y Zod. Teléfono validado (FR-006); país/ciudad se aceptan solo como ids del catálogo (FR-004).

## Phase 4: Pantalla (FR-001/003/004/005)
- [x] T007 [US1] `src/app/dashboard/padre/perfil/page.tsx`: pantalla real, reemplaza el placeholder.
- [x] T008 [US1] `src/components/modules/padre/PerfilPadreForm.tsx`: formulario editable con los 6 campos, prellenado desde `GET`. Ciudad por `CiudadSearchSelect` con `permitirOtra=false` (sin texto libre) y dependiente del país; fecha de nacimiento con `<input type="date">` (se guarda la fecha, no la edad).

## Phase 5: Documentación y disciplina
- [x] T009 `docs/architecture/01-modelo-datos.md` regenerado (esquema tocado).
- [x] T010 `docs/architecture/02-roles-capacidades.md` regenerado (`/dashboard/padre/perfil` deja de ser placeholder + nuevo `/api/padre/perfil`).
- [x] T011 Fila 334 en `specs/README.md` · Status canónico.
- [x] T012 `specs/334-perfil-padre-datos/tasks.md` (este archivo) — lo exige `specs-discipline.test.ts`; su ausencia tumbó el job `test-unit` del PR #192.

## Phase 6: Verificación
- [x] T013 `tsc --noEmit` limpio.
- [x] T014 Suite `unit` completa local (231 archivos) verde.
- [x] T015 CI del PR #192: build · TypeScript · Unit tests · Next.js build · ratchets · bi-gate · journeys · verificaciones.
- [ ] T016 **Candado 25 — evidencia en navegador**: entrar como padre a `/dashboard/padre/perfil`, llenar los 6 campos, guardar, recargar y verificar que los 6 persisten. **No la corre Desarrollo**: la migración no está aplicada en las bases locales y el gate de migraciones/credenciales es de seguridad. La camina el CEO (o Calidad) sobre el despliegue.
- [ ] T017 Merge del PR #192 + despliegue (aplica la migración).

## Dependencias
T002 → T003 → T004 → T005 → T006 → T007/T008 · T009/T010 después del esquema y las rutas · T013-T015 al final · T016 solo después de T017 (necesita la migración aplicada).

## Notas
- Alcance cerrado por el CEO: **solo** los 6 datos del perfil. Cambio de correo (A-62 §3.4), notificaciones y el resto de A-62 quedan fuera.
- Solo-lectura absoluta respetada: `src/lib/ai/**`, `.github/workflows/**`, `deploy-prod.sh`.
