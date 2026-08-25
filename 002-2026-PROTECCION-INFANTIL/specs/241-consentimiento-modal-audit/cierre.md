# Cierre: SPEC-241 — Consentimiento informado + modal legal + AuditConsentimiento

**Fecha**: 2026-08-25 | **Rama**: `work/002-PI-144`

---

## Resumen

Implementado el flujo completo de consentimiento informado: extensión aditiva del modelo `Usuario` con 4 campos de consentimiento, tabla `AuditConsentimiento` inmutable, parámetros y evento de notificación sembrados idempotentemente, endpoint `POST /api/consentimiento/aceptar` con hash SHA256 server-side + `AuditLog`, página `/consentimiento` con `ModalConsentimiento` (scroll obligatorio vía `IntersectionObserver`, checkboxes por rol y color por rol), y guardia reusable aplicada en los 4 layouts de dashboard para forzar re-aceptación cuando cambia `consentimiento.version_actual`.

---

## Archivos

### Creados

- `prisma/migrations/20260825054000_consentimiento_audit/migration.sql` (aditiva: 4 columnas en `Usuario`, tabla `audit_consentimiento`, índices, FK).
- `public/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md` — documento legal para padres y roles internos.
- `public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md` — documento legal para colegios.
- `src/lib/dal/repositories/consentimiento.ts` — repo `AuditConsentimiento` (crear, listar por usuario).
- `src/lib/dal/services/consentimiento.ts` — `versionVigente`, `versionEstaActual`, `documentoPorRol`, `obtenerDocumentoVigente`, `calcularHash`, `aceptar`.
- `src/lib/consentimiento/guard.ts` — `requiereConsentimientoActual`, fail-open.
- `src/lib/consentimiento-test-utils.ts` — helpers de test para forzar parámetros de consentimiento.
- `src/app/api/consentimiento/aceptar/route.ts` — POST con auth, validación Zod, hash, audit, notificación.
- `src/app/api/consentimiento/aceptar/route.test.ts` — 7 tests de integración.
- `src/app/consentimiento/page.tsx` — Server Component que carga documento por rol.
- `src/app/consentimiento/page.test.tsx` — 5 tests de integración.
- `src/components/modules/ModalConsentimiento.tsx` — modal con scroll, checkboxes, botón "Acepto".
- `src/components/modules/ModalConsentimiento.test.tsx` — 5 tests unitarios.
- `src/lib/consentimiento/guard.test.ts` — 4 tests de integración.
- `specs/241-consentimiento-modal-audit/data-model.md`
- `specs/241-consentimiento-modal-audit/quickstart.md`
- `specs/241-consentimiento-modal-audit/contracts/consentimiento.md`
- `specs/241-consentimiento-modal-audit/tasks.md`
- `specs/241-consentimiento-modal-audit/cierre.md` (este archivo)

### Modificados

- `prisma/schema.prisma` — campos de consentimiento en `Usuario` + modelo `AuditConsentimiento` + índices.
- `prisma/seed.ts` — parámetros `consentimiento.version_actual`, `consentimiento.padre.documento_ruta`, `consentimiento.colegio.documento_ruta`; evento/plantillas/reglas `consentimiento.aceptado` (EMAIL + IN_APP).
- `src/lib/dal/repositories/usuario.ts` — `findConConsentimiento`, `actualizarConsentimiento`.
- `src/lib/validators.ts` — `consentimientoAceptarSchema`.
- `src/app/dashboard/layout.tsx` — guardia de consentimiento.
- `src/app/dashboard/padre/layout.tsx` — guardia de consentimiento.
- `src/app/dashboard/colegio/layout.tsx` — guardia de consentimiento.
- `src/app/dashboard/admin/layout.tsx` — guardia de consentimiento.
- `vitest.unit.includes.ts` — registro del test unitario de `ModalConsentimiento`.
- `specs/241-consentimiento-modal-audit/spec.md` — status `IMPLEMENTADO` + sección Implementación.
- `specs/README.md` — índice de la spec 241.
- `docs/architecture/01-modelo-datos.md` — regenerado.
- `docs/architecture/02-roles-capacidades.md` — regenerado.
- `docs/architecture/03-pantallas.md` — regenerado.

---

## Gate local

- `npx prisma@5.22.0 generate` — OK.
- `npx tsc --noEmit` — OK.
- `npm run lint` — OK (0 errores; solo warnings preexistentes).
- `npm run test:unit` — OK: 206 files, 1516 tests passed.
- Tests de integración scope 241 — OK: 16 tests passed (`route.test.ts` 7, `guard.test.ts` 4, `page.test.tsx` 5).
- `npm run build` — OK; warnings preexistentes de Turbopack por uso dinámico de `path.resolve(process.cwd(), ...)` en servicios de documentos (no bloqueantes).
- `npm run arch:check` — VERDE (5 artefactos alineados, puerta ≡ predicado, menú honesto).
- `./scripts/dev-restart.sh` — OK: healthcheck `{"status":"ok","workerAlive":true,"dbOk":true}`.

---

## Decisiones

1. **Sin `middleware.ts` global**: las guardias se implementan en layouts Server Components (`cookies()` + `verifyToken()`), consistente con el patrón existente del proyecto.
2. **Fail-open en la guardia**: si falla la lectura de `consentimiento.version_actual`, la guardia no bloquea al usuario; solo loguea el error.
3. **Hash SHA256 server-side**: el endpoint calcula el hash del archivo leído desde la ruta parametrizada; no confía en valores enviados por el cliente.
4. **Idempotencia**: si el usuario ya aceptó la versión vigente, el endpoint retorna `200` sin duplicar registros en `AuditConsentimiento`.
5. **Documentos por rol**: `ADMIN`, `OPERADOR` y `COMITE_VALIDACION` aceptan `POLITICA_DATOS`; `SCHOOL_ADMIN` y `COMITE_CONVIVENCIA` aceptan `CONVENIO_INSTITUCIONAL`; `PARENT` acepta `POLITICA_DATOS`.
6. **Timestamps**: UTC en base de datos; `date-fns-tz` con `America/Bogota` solo para la fecha mostrada en la notificación.
7. **Inmutabilidad**: no existe endpoint ni servicio que edite o borre filas de `AuditConsentimiento`.

---

## Hallazgos / desviaciones de la spec

1. **Tests de layouts**: no se crearon tests que rendericen los layouts con `cookies()`/componentes anidados; el comportamiento se cubre indirectamente mediante `page.test.tsx` y `guard.test.ts`.
2. **Turbopack warnings**: el servicio de consentimiento reutiliza `path.resolve(process.cwd(), ruta)` para leer documentos legales, lo que genera warnings de patrón amplio. Son preexistentes en otros módulos de documentos y no bloquean el build.

---

## Deuda técnica

- Revisión legal de los documentos en `public/legal/` por abogado y aprobación ante la SIC; el sistema solo los carga y traza.
- Si el CEO cambia `consentimiento.version_actual`, todos los usuarios existentes serán redirigidos a `/consentimiento` en su próximo request; esto debe comunicarse con operaciones.
- Canal adicional (SMS) para confirmación de aceptación queda fuera de scope; la notificación se programa por EMAIL + IN_APP.

---

## Verificación de invariantes

- Migración 100% aditiva (solo `ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX`, `ADD CONSTRAINT`).
- `AuditLog` sin texto completo de reportes ni teléfonos (solo metadatos).
- Código del Motor Notif intacto; solo catálogo aditivo vía `prisma/seed.ts`.
- `src/lib/ai/**` intacto.
- No se introdujeron secretos en código ni documentación.
