# Implementation Plan: Middleware consentimiento + modal legal + AuditConsentimiento

**Branch**: `work/002-PI-144` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/241-consentimiento-modal-audit/spec.md`

---

## Summary

Implementar el blindaje SIC de consentimiento informado antes de cualquier operación en el dashboard. Incluye: (a) extensión aditiva del modelo `Usuario` y nueva tabla `AuditConsentimiento`; (b) parámetros globales y evento de notificación en seed; (c) endpoint `POST /api/consentimiento/aceptar` que calcula hash SHA256 del documento, persiste traza inmutable y actualiza el usuario; (d) página `/consentimiento` con `ModalConsentimiento` que obliga a scroll completo y checkboxes según rol; (e) guardia en layouts autenticados que redirige a `/consentimiento` cuando la versión aceptada no coincide con la versión vigente. Todo es aditivo, sin tocar módulos verticales ni `src/lib/ai/**`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, `jose`, `bcryptjs`, `date-fns-tz`, Tailwind CSS 3.4, `crypto` (SHA256) |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react`; Playwright E2E |
| **Target Platform** | Docker Compose en Mac Studio / VPS |
| **Project Type** | Web application (full-stack Next.js) |
| **Performance Goals** | Carga modal < 1s; aceptación < 500ms; redirección guardia < 200ms |
| **Constraints** | Sin cambios destructivos en schema; sin tocar `src/lib/ai/**`; sin tocar módulos verticales; guardias en layouts (no middleware.ts global); timezone Bogotá (D-69) |
| **Scale/Scope** | ~1 migración aditiva, ~1 endpoint, ~1 página, ~1 componente nuevo, ~1 servicio/repository, ~1 evento notif, guardias en 4 layouts |

---

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | Solo carga de archivos Markdown de texto |
| §1.3 Presunción de inocencia | ✅ Pass | No afecta consulta pública ni reportes |
| §1.4 Umbral parametrizable | ✅ Pass | No se modifica lógica de consulta pública |
| §2.1 Stack heredado (Next.js, Prisma, JWT manual) | ✅ Pass | Reutiliza `verifyAuth`, `verifyToken`, layouts Server Components |
| §2.2 Roles (ADMIN, SCHOOL_ADMIN, PARENT, etc.) | ✅ Pass | Modal y documentos se adaptan por rol |
| §2.3 Multi-tenant | ✅ Pass | No se altera aislamiento; AuditConsentimiento vive a nivel usuario |
| §2.4 Modelo SaaS | ✅ Pass | No altera modelo de suscripción |
| §3.1 TypeScript strict (no `any`) | ✅ Pass | Filtros Prisma tipados; errores con `AppError` |
| §3.4 Códigos HTTP correctos | ✅ Pass | 400/401/403/404/409/429/500/502/503 mapeados |
| §3.5 Logs y auditoría | ✅ Pass | AuditConsentimiento + AuditLog en aceptación |
| §3.6 Límites de tamaño | ✅ Pass | Validación Zod en endpoint |
| §4.1 Singletons (Prisma, pg-boss) | ✅ Pass | No se toca |
| §4.2 Rutas API individuales | ✅ Pass | Nuevo `route.ts` propio |
| §4.3 Paginación estándar | ✅ Pass | No aplica |
| §6.1 JWT en cookie httpOnly | ✅ Pass | Reutiliza `verifyAuth` |
| §6.2 Validación con Zod | ✅ Pass | Schema en `src/lib/validators.ts` |
| §6.3 Protección de datos sensibles | ✅ Pass | No se almacena texto de reporte; hash del doc legal sí es necesario para traza |

**Additional checks**:
- ✅ No se toca `src/lib/ai/**` (candado innegociable).
- ✅ No se tocan módulos verticales `comite/**`, `bandeja/**`, `alertas/**`, `cursos/**`, `expedientes/**`.
- ✅ Migración aditiva: solo agrega campos y tabla nueva; cero DROP/rename.
- ✅ Documentos legales se cargan, no se redactan (ODIN no actúa como abogado).

---

## Project Structure

### Documentation (this feature)

```text
specs/241-consentimiento-modal-audit/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output (si aplica)
├── data-model.md        # Phase 1 output (detalle de migración)
├── quickstart.md        # Phase 1 output (pasos de prueba)
├── contracts/           # Phase 1 output (contratos de API)
│   └── consentimiento.md
└── tasks.md             # Phase 2 output (speckit-tasks)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── schema.prisma                        # + campos consentimiento en Usuario, + model AuditConsentimiento
│   ├── migrations/YYYYMMDDHHMMSS_consentimiento_audit/migration.sql
│   └── seed.ts                              # + params consentimiento.*, evento/plantilla consentimiento.aceptado
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── consentimiento/
│   │   │       └── aceptar/
│   │   │           └── route.ts             # POST: aceptar consentimiento
│   │   ├── consentimiento/
│   │   │   └── page.tsx                     # Server Component: carga doc + pasa a ModalConsentimiento
│   │   └── dashboard/
│   │       ├── layout.tsx                   # + guardia consentimiento (PARENT)
│   │       ├── padre/
│   │       │   └── layout.tsx               # + guardia consentimiento
│   │       ├── colegio/
│   │       │   └── layout.tsx               # + guardia consentimiento
│   │       └── admin/
│   │           └── layout.tsx               # + guardia consentimiento
│   ├── components/
│   │   └── modules/
│   │       └── ModalConsentimiento.tsx      # scroll + checks + botón + color por rol
│   └── lib/
│       ├── dal/
│       │   ├── repositories/
│       │   │   ├── usuario.ts               # + findConConsentimiento, actualizarConsentimiento
│       │   │   └── consentimiento.ts        # NUEVO: crear registro de auditoría
│       │   └── services/
│       │       └── consentimiento.ts        # NUEVO: aceptar(), verificarVersion(), obtenerDocumento()
│       ├── validators.ts                    # + consentimientoAceptarSchema
│       └── audit.ts                         # helpers AuditLog (sin cambios)
├── tests/
│   └── e2e/
│       └── consentimiento.spec.ts           # flujo E2E scroll + checks + aceptar
└── vitest.config.ts                         # sin cambios
```

**Structure Decision**: Se reutilizan `GlassCard`, `Input`, `Button`, `Alerta` y el patrón de layouts Server Components con `cookies()` + `verifyToken()`. No se introduce un `middleware.ts` global porque el proyecto usa proxy por rol y guardias en layouts; esto mantiene consistencia con `PadreLayout`, `ColegioLayout` y `AdminLayout`.

---

## Implementation Phases

### Phase 0 — Preparación (sin cambios de producción)

- **T001 [P0]**: Leer en fuente `src/lib/auth.ts`, `src/lib/notificaciones/index.ts`, `src/lib/notificaciones/motor.ts`, layouts de dashboard, `src/lib/dal/repositories/usuario.ts`, `src/lib/dal/unit-of-work.ts`, `src/lib/validators.ts` y `prisma/seed.ts`.
- **T002 [P0]**: Verificar ubicación de los documentos legales (`POLITICA-TRATAMIENTO-DATOS-v0.4.md`, `CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md`) y decidir si se copian a `public/legal/` o se leen desde ruta parametrizada en filesystem.
- **T003 [P0]**: Ejecutar `npm run lint`, `npx tsc --noEmit` y `npm run test` para conocer estado base.

### Phase 1 — Schema, migración y seed

- **T010 [P1]**: Editar `prisma/schema.prisma`: agregar campos de consentimiento a `Usuario` y crear modelo `AuditConsentimiento` con índices y FK.
- **T011 [P1]**: Generar migración aditiva SQL manual en `prisma/migrations/YYYYMMDDHHMMSS_consentimiento_audit/migration.sql` (solo `ALTER TABLE ... ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX`; cero DROP).
- **T012 [P1]**: Ejecutar `npx prisma migrate dev` o `npx prisma migrate deploy` localmente para validar la migración.
- **T013 [P1]**: Extender `prisma/seed.ts` con `upsert` idempotente de:
  - `consentimiento.version_actual = "v0.4"`
  - `consentimiento.padre.documento_ruta`
  - `consentimiento.colegio.documento_ruta`
  - reglas y plantillas del evento `consentimiento.aceptado` (EMAIL + IN_APP).
- **T014 [P1]**: Verificar idempotencia del seed ejecutándolo al menos dos veces.

### Phase 2 — DAL y servicio de consentimiento

- **T020 [P2]**: Crear `src/lib/dal/repositories/consentimiento.ts` con método `crear(data)` tipado con `Prisma.AuditConsentimientoUncheckedCreateInput`.
- **T021 [P2]**: Extender `src/lib/dal/repositories/usuario.ts` con:
  - `findConConsentimiento(id)` (retorna campos de consentimiento + rol + email)
  - `actualizarConsentimiento(id, { version, documentoHash, ip, tx })`
- **T022 [P2]**: Crear `src/lib/dal/services/consentimiento.ts` con métodos:
  - `obtenerDocumentoVigente(rol)` → lee archivo según parámetro global y rol.
  - `calcularHash(contenido)` → SHA256.
  - `aceptar({ usuarioId, rol, ip, userAgent, tx })` → crea `AuditConsentimiento`, actualiza `Usuario`, programa `consentimiento.aceptado`.
  - `versionEstaActual(usuario)` → compara `consentimientoVersion` con parámetro global.
- **T023 [P2]**: Usar `withUnitOfWork` para transacción en `aceptar`.

### Phase 3 — API

- **T030 [P3]**: Agregar en `src/lib/validators.ts` el schema `consentimientoAceptarSchema` con Zod (valida `documentoTipo` enum, `esRepresentanteLegal` boolean; rechaza versión enviada por cliente).
- **T031 [P3]**: Crear `src/app/api/consentimiento/aceptar/route.ts`:
  - `verifyAuth()`.
  - Lee documento vigente según rol.
  - Calcula hash server-side.
  - Llama a `ConsentimientoService.aceptar()`.
  - Retorna 201 con usuario actualizado; maneja `AppError` con códigos canónicos.
- **T032 [P3]**: Crear test de integración `src/app/api/consentimiento/aceptar/route.test.ts`:
  - éxito crea `AuditConsentimiento` + actualiza usuario + programa evento
  - hash SHA256 correcto
  - 401 sin sesión
  - idempotencia (segunda aceptación no duplica)
  - re-aceptación al cambiar versión.

### Phase 4 — UI/UX

- **T040 [P4]**: Copiar/leer documentos legales al bundle (por ejemplo `public/legal/`) y actualizar parámetros de ruta si aplica.
- **T041 [P4]**: Crear `src/components/modules/ModalConsentimiento.tsx`:
  - Recibe `rol`, `documentoTipo`, `documentoContenido`, `onAceptar`.
  - Renderiza bloque(s) de scroll con `IntersectionObserver` en el último elemento.
  - Checkboxes según rol.
  - Botón deshabilitado hasta scroll + checks.
  - Color por rol usando clases `theme-padre`/`theme-colegio`/`theme-admin` o clases Tailwind directas.
- **T042 [P4]**: Crear `src/app/consentimiento/page.tsx` (Server Component):
  - Verifica sesión con `cookies()` + `verifyToken()`.
  - Si no hay sesión → redirect `/login`.
  - Si versión ya está actual → redirect al dashboard según rol.
  - Carga documento según rol y renderiza `ModalConsentimiento`.
- **T043 [P4]**: Crear test de componente `src/components/modules/ModalConsentimiento.test.tsx`:
  - botón deshabilitado inicialmente
  - habilita solo tras scroll + checks
  - POST a `/api/consentimiento/aceptar` al hacer clic
  - redirección al dashboard en éxito.

### Phase 5 — Middleware/guardia de consentimiento en layouts

- **T050 [P5]**: Crear helper reusable `src/lib/consentimiento/guard.ts` con función `async function requiereConsentimientoActual(usuarioId)` que compara versión y retorna `{ requiere: boolean }`.
- **T051 [P5]**: Agregar guardia en `src/app/dashboard/layout.tsx` (PARENT) antes de la guardia de vigencia existente.
- **T052 [P5]**: Agregar guardia en `src/app/dashboard/padre/layout.tsx`.
- **T053 [P5]**: Agregar guardia en `src/app/dashboard/colegio/layout.tsx`.
- **T054 [P5]**: Agregar guardia en `src/app/dashboard/admin/layout.tsx`.
- **T055 [P5]**: Excluir explícitamente `/api/consentimiento/aceptar` y `/logout`; los endpoints públicos no pasan por estos layouts.
- **T056 [P5]**: Crear tests de integración para layouts/guardia:
  - usuario con versión desactualizada redirige a `/consentimiento`
  - usuario con versión actual no redirige
  - re-aceptación forzada al cambiar parámetro global.

### Phase 6 — Validación y cierre

- **T060 [P6]**: Ejecutar `npx tsc --noEmit`.
- **T061 [P6]**: Ejecutar `npm run lint`.
- **T062 [P6]**: Ejecutar `npm run test`.
- **T063 [P6]**: Ejecutar `npm run build`.
- **T064 [P6]**: Ejecutar `./scripts/dev-restart.sh`.
- **T065 [P6]**: Probar flujo con `quickstart.md`.
- **T066 [P6]**: Regenerar `docs/architecture/` si el cambio altera schema o navegación (SPEC-126), dejando `npm run arch:check` en verde.
- **T067 [P6]**: Actualizar `tasks.md` con estado de tareas y evidencia.

---

## Complexity Tracking

No se identifican violaciones a la constitución ni complejidad que requiera justificación adicional. El flujo reutiliza mecanismos vivos (`verifyAuth`, layouts Server Components, Motor Notif, primitivas UI), limitando el diff a:

- 1 migración aditiva (tabla nueva + 4 columnas en `Usuario`).
- 1 endpoint nuevo.
- 1 página nueva + 1 componente nuevo.
- 1 servicio + 1 repository nuevo; extensión mínima de `UsuarioRepository`.
- 1 evento + 3 parámetros en seed.
- Guardias en 4 layouts usando helper compartido.
