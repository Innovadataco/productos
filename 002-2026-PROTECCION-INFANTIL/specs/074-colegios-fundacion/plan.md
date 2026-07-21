# Implementation Plan: Módulo Colegios — Fase 1: Fundación (Spec 074)

**Branch**: `[feature/001-scaffolding]` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/074-colegios-fundacion/spec.md`

---

## Summary

Crear el modelo `Colegio`, asociarlo con un `Tenant` y un único usuario `SCHOOL_ADMIN`, reutilizando el patrón de creación de operadores. Implementar validación de vigencia de servicio en login y en el proxy/middleware. Aplicar identidad visual verde condicional en el panel del colegio reutilizando los tokens de acento existentes. Restringir a SCHOOL_ADMIN el acceso a reportar. Todo con migraciones aditivas, sin tocar el modelo de reportes ni cobro, y manteniendo los 605 tests actuales verdes.

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
| **Endpoints affected** | `/api/auth/login` (vigencia), `/api/admin/colegios/*` (nuevos), `/api/me/colegio` (nuevo), `/api/reportes` (restricción), `/reportar` (restricción proxy) |
| **Components affected** | `src/app/dashboard/colegio/**` (nuevos), `src/app/globals.css` (variante verde), `src/lib/proxy.ts` (vigencia + restricción reportar) |
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
| §6.3 Protección de datos sensibles | ✅ Pass | No se toca PII de reportes |
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

No constitution violations. Complejidad moderada: se tocan autenticación, autorización, estilos y un nuevo modelo. No se requiere justificación adicional. El riesgo principal es la vigencia en login, que debe no romper otros roles.

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
