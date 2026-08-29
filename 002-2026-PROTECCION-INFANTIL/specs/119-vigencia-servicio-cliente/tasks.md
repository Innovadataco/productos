# Tasks — Spec 119: Vigencia del servicio por cliente

**Spec**: `specs/119-vigencia-servicio-cliente/spec.md` | **Plan**: `plan.md`

Convención: `[P]` = paralelizable. Orden por dependencias; TDD: tests antes que el arreglo.

## Fase 1 — Datos

- [x] T001 Migración aditiva `prisma/migrations/20260729150000_add_vigencia_servicio_usuario/migration.sql` + campos `inicioServicio`/`finServicio` nullable en `model Usuario` (`prisma/schema.prisma`). Aplicar con `npx prisma migrate dev`.

## Fase 2 — Tests que fallan (red)

- [x] T002 [P] `src/lib/colegio/vigencia-cliente.test.ts`: padre sin vigencia → vigente; padre `no_iniciado`/`vencido` → estado + mensaje que dice qué pasó y a quién acudir; `finServicio` hoy → vigente; solo `finServicio` → aplica el fin; colegio vencido por `verificarVigenciaCliente` (mismo mecanismo); roles internos → vigente.
- [x] T003 [P] `src/app/api/auth/login/route.test.ts`: padre sin vigencia → 200; padre vencido → 403 + mensaje; colegio vencido → 403 + mensaje (mismo mecanismo); admin extiende ventana → login 200; reportes del vencido intactos; `GET /api/consulta` anónima sigue 200.
- [x] T004 [P] `src/app/api/admin/padres/[id]/vigencia/route.test.ts`: 401 sin token, 403 PARENT, 404 id inexistente, PATCH fija/extiende/limpia ventana, fin<=inicio → 400, AuditLog con valores anterior/nuevo.
- [x] T005 [P] Extender `src/app/api/reportes/mis-reportes/route.test.ts` y `src/app/api/reportes/route.test.ts`: padre vencido → 403 con mensaje claro.

## Fase 3 — Implementación (verde)

- [x] T006 `src/lib/colegio/vigencia.ts`: `verificarVigenciaCliente` (única decisión, cubre PARENT + SCHOOL_ADMIN), `verificarVigenciaColegio` como alias delegado, `assertVigenciaCliente` (AppError 403) para APIs. Mensajes colegio intactos.
- [x] T007 `src/app/api/auth/login/route.ts`: chequeo de vigencia para PARENT + SCHOOL_ADMIN tras la guarda `inactivo` de SPEC-117.
- [x] T008 `src/lib/contexts/AuthContext.tsx` + `src/app/login/page.tsx`: `login()` devuelve `error` del servidor y la página lo muestra (fallback genérico).
- [x] T009 [P] `src/components/modules/ServicioVencidoScreen.tsx` (nuevo) + `src/app/mis-reportes/layout.tsx` (nuevo) + `src/app/dashboard/layout.tsx`: pantalla "Servicio no vigente" para PARENT vencido.
- [x] T010 APIs padre: `src/app/api/reportes/route.ts` (rama autenticada), `src/app/api/reportes/mis-reportes/route.ts`, `src/app/api/reportes/mis-reportes/[id]/route.ts` → `assertVigenciaCliente(user.id)`.
- [x] T011 Gestión admin: `src/app/api/admin/padres/[id]/vigencia/route.ts` (nuevo PATCH), ventana en select de `src/app/api/admin/padres/route.ts`, esquema Zod en `src/lib/schemas/index.ts`.
- [x] T012 `src/app/dashboard/admin/padres/PadresPageClient.tsx`: columna/estado de vigencia + editor (modal con fechas, guardar, quitar fin).

## Fase 4 — Gate y cierre

- [x] T013 Gate bajo candado `/tmp/pi-gate-lock`: `npx tsc --noEmit` + `npm run lint` + tests tocados + `npm run build`; suite completa una vez al final.
- [x] T014 Artefactos: `spec.md` (con sección Implementación), `plan.md`, `tasks.md`, `cierre.md`. Commits en español, imperativo, staging solo de archivos propios, SIN push.

## Deuda conocida

- APIs secundarias de padre (círculo de confianza, apelaciones) no cortan a nivel API; la
  pantalla de layout sí bloquea su UI. Endurecer si ZEUS lo pide.
- `src/lib/specs-discipline.test.ts` puede fallar porque `specs/119-*` no está indexada en
  `specs/README.md` (archivo reservado del coordinador; se anota y se sigue).
