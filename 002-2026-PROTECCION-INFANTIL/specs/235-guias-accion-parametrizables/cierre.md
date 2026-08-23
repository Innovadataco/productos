# Cierre SPEC-235 — Guías de acción parametrizables (002-PI-135)

## Alcance cerrado

Guías de acción parametrizables por categoría de riesgo, con flujo de estados `BORRADOR → PENDIENTE_APROBACION_COMITE → ACTIVA → REEMPLAZADA`, aprobación por comité de validación y endpoint público de consulta.

## Archivos tocados

- `prisma/schema.prisma` — modelo `GuiaAccionCategoria`, enum `EstadoGuiaAccion`, relación `Usuario.guiasAccionCreadas`.
- `prisma/migrations/20260823120000_spec_235_guia_accion_categoria/migration.sql`
- `prisma/migrations/20260823130000_spec_235_accion_audit_guia_accion/migration.sql`
- `prisma/seed.ts` — `seedGuiasAccion(adminEmail)` con 8 guías ACTIVA v1, idempotente.
- `prisma/seed-modulos-grants.ts` — grants para módulos `guias_accion` y `comite_guias_accion`.
- `src/lib/dal/repositories/guia-accion-repository.ts`
- `src/lib/dal/services/guia-accion.ts`
- `src/lib/dal/services/guia-accion.test.ts`
- `src/lib/schemas/guia-accion.ts`
- `src/lib/guias-accion/estado.ts`
- `src/lib/rate-limit.ts` — scope `publico:guia-accion`.
- `src/lib/nav-items.ts`, `src/lib/permisos-catalogo.ts`, `src/components/modules/ConfiguracionTabs.tsx`
- `src/app/api/admin/guias-accion/**/route.ts` + `.test.ts`
- `src/app/api/admin/comite/guias-accion/**/route.ts` + `.test.ts`
- `src/app/api/publico/guia-accion/categoria/[cat]/route.ts` + `.test.ts`
- `src/app/dashboard/admin/configuracion/guias-accion/**`
- `src/app/dashboard/admin/comite/guias-pendientes/**`
- `src/components/modules/guias-accion/**`
- `src/lib/seed-guia-accion.test.ts`
- `docs/architecture/01-modelo-datos.md`, `02-roles-capacidades.md`, `03-pantallas.md`
- `specs/README.md`, `specs/235-guias-accion-parametrizables/spec.md`

## Gate local

- `npx tsc --noEmit` ✓
- `npm run lint -- --no-cache` ✓ (0 errores, warnings preexistentes)
- `npm run arch:check` ✓
- `npm run test` ✓ — 287 test files passed, 1608 tests passed, 1 skipped
- `npm run build` ✓ — Next.js 16.2.10/Turbopack, 197 páginas estáticas, 1 warning preexistente de confianza-documentos

## PR / CI

- PR: #91 a `feature/001-scaffolding`
- CI run: en curso
- Commit HEAD: `e17c72d2`

## Notas / deuda técnica

- El contenido de las 8 guías del seed está marcado como **preliminar · pendiente revisión psicólogo+jurídico**; se itera post-deploy vía el panel admin.
- No se implementa la vista padre consumidora (SPEC-232), notificaciones al comité (SPEC-236) ni diff visual entre versiones (v2).
- Migraciones aditivas; cero DROP.

## Post-deploy

1. Verificar que el seed creó las 8 guías en estado `ACTIVA` o, si ya existían guías personalizadas, que estas no se pisaron.
2. Revisar que `padre.comite.miembros_minimos_aprobacion` tenga el valor deseado (default `2`).
