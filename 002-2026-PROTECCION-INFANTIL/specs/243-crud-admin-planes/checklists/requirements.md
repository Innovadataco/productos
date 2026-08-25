# Checklist de requisitos — SPEC-243

## Functional Requirements

- [x] FR-001: Modelo `Plan` extendido con `precioBaseCOP`, `esFreemium`, `usosMaximosPorCliente`.
- [x] FR-002: Enum `AccionAudit` extendido con `PLAN_CREATE`, `PLAN_UPDATE`, `PLAN_TOGGLE`.
- [x] FR-003: `GET /api/admin/pagos/planes` paginado con filtros `tipoTitular` y `anio`.
- [x] FR-004: `POST /api/admin/pagos/planes` con validación Zod y `AuditLog` (`PLAN_CREATE`).
- [x] FR-005: `PATCH /api/admin/pagos/planes/:id` con `AuditLog` (`PLAN_UPDATE`) y `valorAnterior`/`valorNuevo`.
- [x] FR-006: `DELETE /api/admin/pagos/planes/:id` lógico (`activo=false`), `409` si hay suscripciones activas, `AuditLog` (`PLAN_TOGGLE`).
- [x] FR-007: `PATCH /api/admin/pagos/parametros` batch de 7 parámetros globales con `AuditLog` (`PARAM_UPDATE`).
- [x] FR-008: Endpoints protegidos con `verifyAuth("ADMIN")` + módulo `pagos_admin`.
- [x] FR-009: Seed idempotente de 8 planes (4 PADRE + 4 COLEGIO) con `upsert({ create, update: {} })`.
- [x] FR-010: Seed idempotente de 7 parámetros globales de §6.3.
- [x] FR-011: UI `PlanesAdminCRUD` en `/dashboard/admin/pagos/planes` reutilizando `GlassCard`, `Input`, `Button`, `Alerta`.
- [x] FR-012: Formulario de plan con nombre, precio COP, duración, rol destino, descripción, activo y `usosMaximosPorCliente`.
- [x] FR-013: Formulario de configuración global editable para IVA, freemium y recompensa.
- [x] FR-014: Timezone `America/Bogota` usado en aritmética de fechas del seed.

## Non-Functional Requirements

- [x] NFR-001: Gate local completo ejecutado (`tsc`, `lint`, `arch:check`, `test:unit`, tests de integración focalizados, `build`).
- [x] NFR-002: Paginación server-side estándar `{ items, pagination }`.
- [x] NFR-003: UI responsiva y accesible (WCAG AA), reutilizando componentes vivos.
- [x] NFR-004: `arch:check` verde tras regenerar artefactos.

## Success Criteria

- [x] SC-001: Admin crea, edita y desactiva plan desde UI y cada acción queda en `AuditLog`.
- [x] SC-002: Seed ejecutado dos veces produce 8 planes y 7 parámetros, sin duplicados ni sobreescrituras.
- [x] SC-003: Plan freemium sembrado tiene `esFreemium=true` y `usosMaximosPorCliente=1`.
- [x] SC-004: Endpoint de parámetros rechaza valores inválidos con `400`.
- [x] SC-005: Plan con suscripción activa no puede desactivarse; API retorna `409`.
- [x] SC-006: Listado de planes paginado y filtrable por rol.
- [x] SC-007: Solo `ADMIN` con módulo `pagos_admin` puede mutar planes o parámetros.
- [x] SC-008: CRUD reutiliza componentes existentes sin clones del design system.

## Candados

- [x] Migración 100% aditiva (solo `ADD COLUMN IF NOT EXISTS` y `ALTER TYPE ... ADD VALUE IF NOT EXISTS`).
- [x] No se toca `src/lib/ai/**`.
- [x] No se modifican textos originales de reportes.
- [x] Secrets solo por variables de entorno (`.env` fuera de git).
- [x] `arch:check` verde.
- [x] `npx tsc --noEmit` sin errores.
- [x] `npm run lint` sin errores del spec.
- [x] Tests de integración del área de pagos pasan.
