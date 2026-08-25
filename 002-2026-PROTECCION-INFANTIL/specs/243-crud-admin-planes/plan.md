# Implementation Plan: CRUD admin de Planes + parámetros IVA/freemium desde UI + seed

**Branch**: `work/002-PI-146` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/243-crud-admin-planes/spec.md`

---

## Summary

Convertir `/dashboard/admin/pagos/planes` —hoy solo listado paginado— en un CRUD completo (`PlanesAdminCRUD`) que permita crear, editar, activar/desactivar planes y editar los parámetros globales de pagos (IVA, freemium, recompensa) sin deploy. Además, sembrar idempotentemente 4 planes por rol (PADRE y COLEGIO) más los parámetros globales del BRIEF §6.3. Todos los cambios son aditivos: se extiende el modelo `Plan` y el enum `AccionAudit`, pero no se crean tablas nuevas ni se eliminan campos.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, `zod`, `date-fns-tz`, Tailwind CSS 3.4 |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react`; Playwright E2E |
| **Target Platform** | Docker Compose en Mac Studio / VPS |
| **Project Type** | Web application (full-stack Next.js) |
| **Performance Goals** | CRUD plan < 3s; batch parámetros < 2s; seed idempotente < 10s |
| **Constraints** | Sin cambios destructivos en schema; sin tocar `src/lib/ai/**`; sin crear rutas paralelas (D-72); timezone Bogotá (D-69); reutilizar `Input`/`GlassCard`/`Button`/`Alerta` (D-72) |
| **Scale/Scope** | ~3 endpoints nuevos/modificados, ~2 componentes nuevos, 1 migración aditiva, seed idempotente |

---

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | Solo formularios de texto + números |
| §1.3 Presunción de inocencia | ✅ Pass | No hay consulta pública en este flujo |
| §1.4 Umbral parametrizable | ✅ Pass | No se modifica lógica de consulta pública |
| §2.1 Stack heredado (Next.js, Prisma, JWT manual) | ✅ Pass | Reutiliza autenticación existente |
| §2.2 Roles (ADMIN, SCHOOL_ADMIN, PARENT) | ✅ Pass | Solo rol ADMIN muta planes |
| §2.3 Multi-tenant | ✅ Pass | Planes son catálogo global; no afecta aislamiento |
| §2.4 Modelo SaaS | ✅ Pass | Extensión aditiva del catálogo de planes |
| §3.1 TypeScript strict (no `any`) | ✅ Pass | Patrones DAL existentes |
| §3.4 Códigos HTTP correctos | ✅ Pass | 400/401/403/404/409/429/500 mapeados |
| §3.5 Logs y auditoría | ✅ Pass | AuditLog en cada mutación |
| §3.6 Límites de tamaño | ✅ Pass | Validación Zod en endpoints |
| §4.1 Singletons (Prisma, pg-boss) | ✅ Pass | No se toca |
| §4.2 Rutas API individuales | ✅ Pass | Cada endpoint en su `route.ts` |
| §4.3 Paginación estándar | ✅ Pass | Listado reutiliza patrón existente |
| §6.1 JWT en cookie httpOnly | ✅ Pass | Reutiliza `verifyAuth` |
| §6.2 Validación con Zod | ✅ Pass | Schemas nuevos en `src/lib/schemas/pagos.ts` |
| §6.3 Datos sensibles encriptados | ✅ Pass | No se manejan datos sensibles nuevos |

**Additional checks**:
- ✅ No se toca `src/lib/ai/**` (candado innegociable).
- ✅ No se tocan módulos verticales `comite/**`, `bandeja/**`, `alertas/**`, `cursos/**`, `expedientes/**`.
- ✅ Migración aditiva: solo agrega campos/valores de enum; cero DROP/rename.
- ✅ Reutiliza `Input`, `GlassCard`, `Button`, `Alerta` (D-72).

---

## Project Structure

### Documentation (this feature)

```text
specs/243-crud-admin-planes/
├── spec.md              # Feature specification
├── plan.md              # This file
├── data-model.md        # Detalle de migración aditiva
├── quickstart.md        # Pasos de prueba manual
├── contracts/           # Contratos de API
│   ├── planes.md
│   └── parametros.md
└── tasks.md             # Tareas speckit (TDD ordenado)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── schema.prisma                                    # + campos en Plan, + valores enum AccionAudit
│   ├── migrations/YYYYMMDDHHMMSS_crud_admin_planes/     # migración aditiva SQL
│   │   └── migration.sql
│   └── seed.ts                                          # + seed planes + parámetros globales §6.3
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── admin/pagos/
│   │   │       ├── planes/
│   │   │       │   ├── route.ts                         # GET/POST (modificado)
│   │   │       │   └── [id]/
│   │   │       │       └── route.ts                     # PATCH/DELETE (toggle)
│   │   │       └── parametros/
│   │   │           └── route.ts                         # PATCH batch parámetros globales
│   │   └── dashboard/admin/pagos/planes/
│   │       └── page.tsx                                 # Server Component con CRUD + tabs
│   ├── components/
│   │   └── modules/
│   │       ├── PlanesAdminCRUD.tsx                      # Tabla + form crear/editar plan
│   │       └── ParametrosPagosForm.tsx                  # Form configuración global
│   └── lib/
│       ├── schemas/pagos.ts                             # + pagosPlanCreateSchema, pagosPlanUpdateSchema, pagosParametrosUpdateSchema
│       └── dal/repositories/
│           └── pagos-repository.ts                      # + crearPlan, actualizarPlan, desactivarPlan, existeSuscripcionActivaPorPlan
└── src/app/api/admin/pagos/planes/route.test.ts         # Tests CRUD + guard ADMIN + seed idempotente
```

**Structure Decision**: Se reutilizan `GlassCard`, `Input`, `Button` y `Alerta` (D-72). No se crean rutas paralelas ni clones del layout de admin. El CRUD se implementa como una sola página server con dos tabs (catálogo y configuración global), delegando la mutación a los API routes. El `DELETE` es lógico (`activo=false`) para respetar el principio de no borrar datos referenciados por `Suscripcion`.

---

## Complexity Tracking

No se identifican violaciones a la constitución ni complejidad que requiera justificación adicional. El diff se limita a:

- 1 migración aditiva (`Plan`: 3 campos; `AccionAudit`: 3 valores).
- 1 endpoint extendido (`GET /api/admin/pagos/planes`) + 1 endpoint modificado (`PATCH /api/admin/pagos/planes/:id`) + 1 endpoint nuevo (`POST /api/admin/pagos/planes`) + 1 endpoint nuevo (`DELETE /api/admin/pagos/planes/:id`) + 1 endpoint nuevo (`PATCH /api/admin/pagos/parametros`).
- 1 página admin enriquecida con 2 componentes nuevos.
- 1 repositorio extendido con métodos CRUD.
- Seed idempotente de 8 planes + 7 parámetros globales.

**Decisiones técnicas documentadas**:

1. **Extensión del modelo `Plan`**: se agregan `precioBaseCOP Float?`, `esFreemium Boolean @default(false)` y `usosMaximosPorCliente Int?`. `precioBaseUSD` se conserva para compatibilidad con SPEC-210; la UI de SPEC-243 opera en COP porque el BRIEF §4 y el instructivo hablan de precios COP y Colombia por default.
2. **Identificación del plan Freemium**: se usa el campo `esFreemium` en lugar de inferir por precio 0, evitando ambigüedad si algún día existe un plan promocional gratuito.
3. **Seed idempotente**: se usa `prisma.plan.upsert({ where: { tipoTitular_duracion_anio: {...} }, create: {...}, update: {} })`. Si el admin editó el nombre o precio, el seed no lo sobreescribe.
4. **`DELETE` lógico**: el endpoint desactiva el plan (`activo=false`) si no tiene suscripciones activas; retorna `409` en caso contrario. No se implementa borrado físico.
5. **`PATCH /api/admin/pagos/parametros`**: actualiza en batch las 7 claves de §6.3 y registra un único `AuditLog` (`PARAM_UPDATE`) con el snapshot completo antes/después.
6. **Auditoría**: se extiende `AccionAudit` con `PLAN_CREATE`, `PLAN_UPDATE` y `PLAN_TOGGLE`; los parámetros globales usan el valor existente `PARAM_UPDATE`.
