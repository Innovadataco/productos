# Implementation Plan: Autenticación Multi-Rol y Parámetros de Configuración

**Branch**: `[001-multi-role-auth-config]` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-multi-role-auth-config/spec.md`

---

## Summary

Implementar la fase fundacional del sistema de protección infantil: autenticación multi-rol (ADMIN, SCHOOL_ADMIN, PARENT) con JWT manual en cookie httpOnly, sistema de parámetros de configuración tipados con auditoría inmutable, y estructura base del proyecto replicando los patrones validados del proyecto 001. Todo sobre Next.js App Router + Prisma + PostgreSQL en Docker Compose.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, `jose`, `bcryptjs`, Tailwind CSS 3.4 |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Target Platform** | Docker Compose en Mac Studio / VPS |
| **Project Type** | Web application (full-stack Next.js) |
| **Performance Goals** | Login < 2s; cambio de parámetro visible < 1s; 100 sesiones concurrentes |
| **Constraints** | Sin Redis, sin servicios cloud, sin multimedia, JWT en cookie httpOnly |
| **Scale/Scope** | Fase fundacional: 3 roles, ~7 endpoints, ~5 tablas activas |

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | Esta fase no maneja reportes |
| §1.3 Presunción de inocencia | ✅ Pass | No hay consulta pública en esta fase |
| §1.4 Umbral parametrizable en BD | ✅ Pass | FR-005, FR-009 implementan esto |
| §2.1 Stack heredado (Next.js, Prisma, JWT manual, no NextAuth) | ✅ Pass | research.md D1 confirma |
| §2.2 Roles (ADMIN, SCHOOL_ADMIN, PARENT, Anónimo) | ✅ Pass | FR-001, FR-012, FR-013 |
| §2.3 Multi-tenant (tablas base) | ✅ Pass | D4: tablas vacías creadas |
| §2.4 Modelo SaaS (tablas base) | ✅ Pass | D4: Plan, Subscription, BillingCycle |
| §3.1 TypeScript strict (no `any`) | ✅ Pass | Patrones del proyecto 001 heredados |
| §3.4 Códigos HTTP correctos | ✅ Pass | Documentados en contracts |
| §3.5 Logs y auditoría | ✅ Pass | FR-008, FR-014 |
| §3.6 Límites de tamaño | ✅ Pass | Validación manual en endpoints |
| §4.1 Singletons (Prisma, pg-boss) | ✅ Pass | Prisma singleton; pg-boss no activo |
| §4.2 Rutas API individuales | ✅ Pass | Cada método en su `route.ts` |
| §4.3 Paginación estándar | ✅ Pass | Reutilizado patrón del proyecto 001 |
| §6.1 JWT en cookie httpOnly | ✅ Pass | Diseñado con `jose` + cookie |
| §6.2 Validación manual explícita | ✅ Pass | D6: manual ahora, Zod futuro |
| §6.3 Datos sensibles encriptados | ✅ Pass | FR-010: parámetros secretos cifrados |

**Re-check post-design**: All gates still pass. No violations.

**Additional checks post-spec-update**:
- ✅ §1.2 Solo texto: Códigos de verificación son texto (6 dígitos), no multimedia.
- ✅ §2.1 JWT manual + bcryptjs: Flujo de código usa bcrypt para hash del código, JWT para token temporal.
- ✅ §6.2 Validación manual: Cada endpoint del flujo de código valida explícitamente su input.
- ✅ §6.3 Datos sensibles: Códigos hasheados con bcrypt, nunca almacenados en texto plano.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-multi-role-auth-config/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── auth.md
│   └── config.md
└── tasks.md             # Phase 2 output (speckit-tasks)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── register/route.ts
│   │   │   ├── config/
│   │   │   │   └── parametros/route.ts
│   │   │   └── me/
│   │   │       └── route.ts
│   │   ├── login/page.tsx
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   └── modules/
│   │       ├── LoginForm.tsx
│   │       └── ConfigPanel.tsx
│   └── lib/
│       ├── auth.ts          # verifyAuth, createToken, hashPassword
│       ├── config-cache.ts  # Caché en memoria de parámetros
│       ├── prisma.ts        # Singleton PrismaClient
│       └── errors.ts        # AppError, error codes
├── prisma/
│   └── schema.prisma
├── scripts/
│   └── worker.mjs           # Vacío en esta fase (placeholder pg-boss)
├── docker-compose.yml
├── package.json
└── vitest.config.ts
```

**Structure Decision**: Single Next.js project (Option 1), full-stack App Router. Replicando patrón del proyecto 001: `src/app/api/**/route.ts` para endpoints, `src/lib/` para utilidades compartidas, `prisma/` para schema.

---

## Complexity Tracking

No constitution violations. No complexity justification needed.