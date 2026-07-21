# Implementation Plan: Módulo Colegios — Fase 1: Fundación (Spec 074)

**Branch**: `[feature/001-scaffolding]` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/074-colegios-fundacion/spec.md`

---

## Summary

Crear el modelo `Colegio`, asociarlo con un `Tenant` y un único usuario `SCHOOL_ADMIN`, reutilizando el patrón de creación de operadores. Implementar validación de vigencia de servicio en login y en el proxy/middleware. Aplicar identidad visual verde condicional en el panel del colegio. **Auditar y corregir los accesos heredados de SCHOOL_ADMIN** para aislarlo exclusivamente a `/dashboard/colegio/*` y `/api/me/colegio`, quitándolo de guards, endpoints y componentes de admin/operador/comité/reportes. Todo con migraciones aditivas, sin tocar el modelo de reportes ni cobro, y manteniendo los 605 tests actuales verdes.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, `jose`, `bcryptjs`, Tailwind CSS 3.4, zod |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Models affected** | `Colegio` (nuevo), `Usuario` (+ `colegioId`), `Tenant` (relación), `AuditLog` (nuevas acciones), `AccionAudit` (nuevos valores) |
| **Seed affected** | `prisma/seed.ts` (posiblemente ajustes menores, no obligatorio) |
| **Endpoints affected** | `/api/auth/login` (vigencia), `/api/admin/colegios/*` (nuevos), `/api/me/colegio` (nuevo), `/api/reportes` (restricción), `/api/admin/*` (quitar SCHOOL_ADMIN), `/reportar` (restricción proxy) |
| **Components affected** | `src/app/dashboard/colegio/**` (nuevos), `src/app/globals.css` (variante verde), `src/lib/proxy.ts` (vigencia + aislamiento), `src/lib/auth.ts` (quitar SCHOOL_ADMIN de helpers), `src/components/modules/AdminNav.tsx`, `ComiteSubNav.tsx`, `NavHeader.tsx` (quitar SCHOOL_ADMIN) |
| **Testing** | Vitest; todo endpoint nuevo con `.test.ts`; suite completo ≥ 605 tests |
| **Constraints** | Migración aditiva, backup previo, sin `migrate reset/dev`, sin tocar `Reporte` ni modelo de IA |

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | Colegio solo datos textuales |
| §1.3 Presunción de inocencia | ✅ Pass | No afecta consulta pública ni veredictos |
| §1.4 Umbral parametrizable | ✅ Pass | No se modifica el umbral |
| §2.1 Stack heredado | ✅ Pass | Prisma + Next.js + JWT manual; sin nuevas dependencias |
| §2.2 Roles | ✅ Pass | Reutiliza SCHOOL_ADMIN existente |
| §2.3 Multi-tenant | ✅ Pass | Vincula Colegio ↔ Tenant ↔ Usuario |
| §2.4 Modelo SaaS | ✅ Pass | Campos de vigencia listos para facturación futura |
| §3.1 TypeScript strict | ✅ Pass | Modelos tipados con Prisma; zod para validación |
| §3.4 Códigos HTTP correctos | ✅ Pass | Documentados en contracts |
| §3.5 Logs y auditoría | ✅ Pass | AuditLog en cada mutación de colegio |
| §4.1 Singletons | ✅ Pass | Prisma singleton sin cambios |
| §4.2 Rutas API individuales | ✅ Pass | Cada método en su `route.ts` |
| §4.3 Paginación estándar | ✅ Pass | Lista de colegios paginada |
| §6.3 Protección de datos sensibles | ✅ Pass | No se toca PII de reportes; SCHOOL_ADMIN queda aislado de reportes reales |
| §7.3 Estilos | ✅ Pass | Variante de tokens existentes; no duplica estilos |

**Re-check post-design**: All gates still pass. No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/074-colegios-fundacion/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── colegios.md
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output
```

### Source Code (affected after approval)

```text
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── schema.prisma          # + model Colegio, + Usuario.colegioId, + enum TipoPeriodoServicio, + AccionAudit
│   └── migrations/
│       └── YYYYMMDDHHMMSS_add_colegio/  # aditiva
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── admin/colegios/route.ts           # GET/POST listar/crear
│   │   │   ├── admin/colegios/[id]/route.ts        # GET/PATCH detalle/editar
│   │   │   ├── admin/colegios/[id]/activar/route.ts
│   │   │   ├── admin/colegios/[id]/desactivar/route.ts
│   │   │   ├── admin/colegios/[id]/regenerar-password/route.ts
│   │   │   ├── admin/colegios/[id]/reenviar-email/route.ts
│   │   │   ├── auth/login/route.ts                 # + vigencia SCHOOL_ADMIN
│   │   │   ├── me/colegio/route.ts                 # datos del colegio
│   │   │   └── reportes/route.ts                   # + 403 SCHOOL_ADMIN
│   │   ├── dashboard/colegio/
│   │   │   ├── layout.tsx          # tema verde + shell institucional
│   │   │   └── page.tsx            # panel de inicio del colegio
│   │   └── reportar/page.tsx       # posible bloqueo para SCHOOL_ADMIN
│   ├── components/
│   │   └── modules/colegio/
│   │       ├── ColegioForm.tsx
│   │       ├── ColegioList.tsx
│   │       └── ColegioPanel.tsx
│   ├── lib/
│   │   ├── colegio/
│   │   │   ├── vigencia.ts        # helpers de vigencia
│   │   │   └── servicio.ts        # lógica de creación/edición
│   │   └── proxy.ts               # + vigencia + restricción reportar
│   └── app/globals.css            # + variante verde
└── scripts/
```

**Structure Decision**: Los componentes del colegio van en `src/components/modules/colegio/` para aislarlos del resto. El layout del colegio aplica la clase de tema verde en un wrapper que no afecta al root.

---

## Complexity Tracking

No constitution violations. Complejidad moderada: se tocan autenticación, autorización, estilos y un nuevo modelo. El riesgo principal es la vigencia en login (que no debe romper otros roles) y la corrección de accesos heredados de SCHOOL_ADMIN, que requiere un inventario minucioso y tests de seguridad para evitar regresiones de permisos.

---

## Security Isolation — SCHOOL_ADMIN Access Audit

### Inventory required before implementation

Audit all occurrences of `SCHOOL_ADMIN` in:
- `src/lib/auth.ts` (helpers `requireAdmin`, `requireOperadorOAdmin`, `requireComiteOAdmin`, `requireAdminOComiteOOperador`).
- `src/lib/proxy.ts` (`INTERNAL_ROLES`, `ADMIN_ROLES`, `isInternalRoute`, `homeForRole`, `USER_FINAL_ROUTES`).
- `src/lib/operadores/permisos.ts`.
- `src/lib/reporte-transiciones.ts`.
- Every `verifyAuth([..., "SCHOOL_ADMIN", ...])` in `src/app/api/**/route.ts`.
- Components `AdminNav.tsx`, `ComiteSubNav.tsx`, `NavHeader.tsx`, `ReporteWizard.tsx`.
- Pages `src/app/login/page.tsx`, `src/app/dashboard/admin/layout.tsx`, `src/app/mis-reportes/page.tsx`, `src/app/dashboard/circulo-confianza/page.tsx`, `src/app/cambiar-password/page.tsx`.
- Tests that assume SCHOOL_ADMIN sees admin/operator/committee tabs (`src/lib/role-visibility.test.tsx`).

### Expected state after implementation

- SCHOOL_ADMIN is **only** allowed in:
  - `verifyAuth(["SCHOOL_ADMIN"])` or `verifyAuth("SCHOOL_ADMIN")` for its own routes.
  - `src/app/dashboard/colegio/**` and `src/app/api/me/colegio`.
  - `src/app/api/auth/login` (to check service validity and redirect to `/dashboard/colegio`).
  - `src/app/api/auth/cambiar-password` (to redirect to `/dashboard/colegio` after password change).
  - `src/lib/proxy.ts` as its own allowed route set (`/dashboard/colegio/*`, `/api/me/colegio`), separate from `INTERNAL_ROLES`.
- SCHOOL_ADMIN is **removed** from:
  - `requireAdmin`, `requireOperadorOAdmin`, `requireComiteOAdmin`, `requireAdminOComiteOOperador`.
  - `ADMIN_ROLES` in `proxy.ts`.
  - All `/api/admin/*` endpoints except `/api/admin/colegios` (which is ADMIN only anyway).
  - `AdminNav.tsx`, `ComiteSubNav.tsx`, `NavHeader.tsx` admin menus.
  - `reporte-transiciones.ts` responsibility mapping.
- `INTERNAL_ROLES` in `proxy.ts` may still include ADMIN/OPERADOR/COMITE, but SCHOOL_ADMIN must be treated separately: it is not allowed in `/dashboard/admin/*` nor `/api/admin/*`.

### Tests to add

- 403 or redirect for SCHOOL_ADMIN on: `/dashboard/admin`, `/dashboard/admin/operadores`, `/dashboard/admin/comite`, `/dashboard/admin/estadisticas`, `/dashboard/admin/ia`, `/dashboard/admin/configuracion`, `/dashboard/admin/spam`, `/dashboard/admin/apelaciones`, `/dashboard/admin/dataset-entrenamiento`, `/dashboard/admin/reportes-revision`, `/api/admin/reportes-revision`, `/api/admin/operadores`, `/api/admin/comite/pendientes`, `/api/admin/estadisticas`, `/api/admin/estadisticas/clasificacion`, `/api/admin/ia/modelos`, `/mis-reportes`, `/dashboard/circulo-confianza`.
- Confirm ADMIN/OPERADOR/COMITE/PARENT still access their allowed routes.

---

## Data Migration Strategy

1. **Backup**: `pg_dump` de la BD antes de cualquier cambio.
2. **Migración aditiva**:
   - Crear tabla `Colegio`.
   - Crear enum `TipoPeriodoServicio` (`MENSUAL`, `SEMESTRAL`, `ANUAL`).
   - Agregar `colegioId` nullable a `Usuario` con FK a `Colegio.id`.
   - Agregar valores `COLEGIO_*` al enum `AccionAudit`.
3. **No se tocan**: `Reporte`, `ClasificacionIA`, `ParametroSistema`, modelos de evaluación.
4. **Seed**: no requiere cambios obligatorios; los colegios se crean por el admin.

---

## UI/UX Design Notes (from /skill:ui-ux-pro-max)

- **Patrón**: Real-Time / Operations Landing (dashboard institucional).
- **Estilo**: Glassmorphism existente; se mantiene.
- **Color de acento**: verde institucional (ej. `emerald-600` / `#059669` en light, `emerald-400` en dark) para diferenciar el módulo colegio sin romper el sistema de tokens.
- **Implementación técnica**: agregar una clase `.theme-colegio` en el layout del colegio que sobreescriba las utilidades de acento (`text-accent`, `accent-gradient`, `ring-accent`, `text-gradient`) con variantes verdes. El resto de componentes (botones, inputs, badges) usa `text-accent` y hereda el color automáticamente.
- **Accesibilidad**: mantener contraste 4.5:1 en texto y 3:1 en elementos grandes; foco visible; sin emojis.
- **Tipografía**: se mantiene Fira Sans/Code ya en uso; no se añaden nuevas fuentes.

---

## Open Questions (0 remaining)

All NEEDS CLARIFICATION resolved. El modelo, la fuente de datos, el patrón de creación y el sistema de color están definidos.

---

## Reutilización documentada

- **Patrón de creación de operadores**: `src/app/api/admin/operadores/route.ts` se usa como base para crear SCHOOL_ADMIN con contraseña temporal y email de bienvenida.
- **Sistema de tokens de acento**: `src/app/globals.css` (`text-accent`, `accent-gradient`, `ring-accent`, `text-gradient`) se extiende con variante verde.
- **Guard proxy/middleware**: `src/lib/proxy.ts` se extiende para verificar vigencia y restringir `/reportar` a SCHOOL_ADMIN.
- **Modelos de ubicación**: `Pais`, `Departamento`, `Ciudad` de la Fase 0 se usan en el formulario de colegio.
- **AuditLog**: se reutiliza `logAudit` con nuevas acciones `COLEGIO_*`.
- **Auth helpers**: `verifyAuth`, `hashPassword`, `setSessionCookie` se reutilizan sin cambios.
