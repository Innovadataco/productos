# Implementation Plan: Registro público de colegio + /activar por token + rediseño admin pre-registro

**Branch**: `work/002-PI-143` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/240-registro-colegio-activar/spec.md`

---

## Summary

Implementar el ingreso institucional al sistema: registro público de colegio (`/registro-colegio`), activación por token de invitación admin (`/activar?token=XYZ`), y simplificación del pre-registro admin (`/dashboard/admin/colegios/nuevo` de 14 a 3 campos) eliminando la contraseña temporal (fix BUG-01). Todo el flujo converge en redirección a `/consentimiento` (SPEC-241). Los cambios son aditivos: nuevo enum/fields en `Usuario`, nuevos métodos de DAL, reutilización de componentes y servicios existentes, y un evento nuevo en el Motor Notif.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, `jose`, `bcryptjs`, `date-fns-tz`, Tailwind CSS 3.4 |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react`; Playwright E2E |
| **Target Platform** | Docker Compose en Mac Studio / VPS |
| **Project Type** | Web application (full-stack Next.js) |
| **Performance Goals** | Registro < 60s; activación < 5s; invitación admin < 5s |
| **Constraints** | Sin cambios destructivos en schema; sin tocar `src/lib/ai/**`; sin crear rutas paralelas (D-72); timezone Bogotá (D-69) |
| **Scale/Scope** | ~6 endpoints/rutas, ~4 componentes, 1 migración aditiva, seed idempotente |

---

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | Solo formularios de texto + email |
| §1.3 Presunción de inocencia | ✅ Pass | No hay consulta pública en este flujo |
| §1.4 Umbral parametrizable | ✅ Pass | No se modifica lógica de consulta pública |
| §2.1 Stack heredado (Next.js, Prisma, JWT manual) | ✅ Pass | Reutiliza autenticación existente |
| §2.2 Roles (ADMIN, SCHOOL_ADMIN, PARENT, Anónimo) | ✅ Pass | FR-003/FR-004 asignan SCHOOL_ADMIN correctamente |
| §2.3 Multi-tenant | ✅ Pass | Colegio + Tenant creados y vinculados |
| §2.4 Modelo SaaS | ✅ Pass | No altera modelo de suscripción |
| §3.1 TypeScript strict (no `any`) | ✅ Pass | Patrones DAL existentes |
| §3.4 Códigos HTTP correctos | ✅ Pass | 400/401/403/404/409/429/500 mapeados |
| §3.5 Logs y auditoría | ✅ Pass | AuditLog en creación e invitación |
| §3.6 Límites de tamaño | ✅ Pass | Validación Zod en endpoints |
| §4.1 Singletons (Prisma, pg-boss) | ✅ Pass | No se toca |
| §4.2 Rutas API individuales | ✅ Pass | Cada endpoint en su `route.ts` |
| §4.3 Paginación estándar | ✅ Pass | No aplica a este flujo |
| §6.1 JWT en cookie httpOnly | ✅ Pass | Reutiliza `createToken`/`setSessionCookie` |
| §6.2 Validación con Zod | ✅ Pass | Existente en `/api/auth/verificar/*` |
| §6.3 Datos sensibles encriptados | ✅ Pass | Contraseñas hasheadas con bcrypt; token opaco no es PII |

**Additional checks**:
- ✅ No se toca `src/lib/ai/**` (candado innegociable).
- ✅ No se tocan módulos verticales `comite/**`, `bandeja/**`, `alertas/**`, `cursos/**`, `expedientes/**`.
- ✅ Migración aditiva: solo agrega enum/fields; cero DROP/rename.

---

## Project Structure

### Documentation (this feature)

```text
specs/240-registro-colegio-activar/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output (si aplica)
├── data-model.md        # Phase 1 output (detalle de migración)
├── quickstart.md        # Phase 1 output (pasos de prueba)
├── contracts/           # Phase 1 output (contratos de API)
│   ├── auth-verificar.md
│   └── admin-colegios.md
└── tasks.md             # Phase 2 output (speckit-tasks)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── schema.prisma                        # + enum EstadoActivacion, + campos en Usuario
│   ├── migrations/YYYYMMDDHHMMSS_estado_activacion_invitacion/migration.sql
│   └── seed.ts                              # + param token_vigencia_horas, evento colegio.invitacion.enviada
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── verificar/
│   │   │   │   │   ├── solicitar/route.ts   # sin cambios funcionales
│   │   │   │   │   ├── validar/route.ts     # sin cambios funcionales
│   │   │   │   │   └── completar/route.ts   # extender: opcional nombreColegio + rol
│   │   │   │   └── activar/
│   │   │   │       └── route.ts             # POST: consumir token + definir password
│   │   │   └── admin/colegios/
│   │   │       └── route.ts                 # POST simplificado (3 campos, sin password temp)
│   │   ├── registro-colegio/
│   │   │   └── page.tsx                     # flujo 2 pasos espejo del padre
│   │   ├── activar/
│   │   │   └── page.tsx                     # valida token + renderiza formulario
│   │   └── dashboard/admin/colegios/nuevo/
│   │       ├── page.tsx                     # sin cambios estructurales
│   │       └── NuevoColegioPageClient.tsx   # 3 campos + modal (fix BUG-01)
│   ├── components/
│   │   └── modules/
│   │       ├── RegistroColegioForm.tsx      # email + nombreColegio + nombreRector
│   │       ├── ActivarForm.tsx              # password + confirmación
│   │       └── InvitacionEnviadaModal.tsx   # modal ✓ (reemplaza banner ámbar)
│   └── lib/
│       ├── dal/
│       │   ├── repositories/
│       │   │   ├── usuario.ts               # + findByTokenInvitacion, crearRectorConToken, consumirTokenInvitacion
│       │   │   └── colegio.ts               # + crearColegioMinimo (helpers para registro/invitación)
│       │   └── services/
│       │       └── registro-colegio.ts      # orquesta Colegio + Usuario + token + notif
│       ├── validators.ts                    # + schemas registro-colegio, activar, admin-colegio-nuevo
│       └── audit.ts                         # sin cambios; se usa desde rutas
├── tests/
│   └── e2e/
│       └── registro-colegio.spec.ts         # registro público + activación + BUG-01
└── vitest.config.ts                         # sin cambios
```

**Structure Decision**: Se reutilizan `RegistroForm`, `VerificacionForm`, `GlassCard`, `Input`, `Button`, `Alerta` (D-72). No se crean rutas paralelas ni clones del layout de admin. El check de token de invitación se implementa en la página `/activar` como guardia server-side, dado que el proyecto no usa `middleware.ts` global y su proxy actúa por rol; esto evita introducir un middleware global solo para una ruta y se alinea con el patrón existente.

---

## Complexity Tracking

No se identifican violaciones a la constitución ni complejidad que requiera justificación adicional. El flujo reutiliza servicios y componentes vivos, limitando el diff a:

- 1 migración aditiva (enum + 3 columnas).
- 1 endpoint extendido + 1 endpoint nuevo + 1 endpoint modificado.
- 2 páginas nuevas + 1 página admin modificada.
- 3 componentes nuevos (reutilizando primitivas).
- Métodos nuevos en 2 repositorios existentes.
- 1 evento + 1 parámetro en seed.
