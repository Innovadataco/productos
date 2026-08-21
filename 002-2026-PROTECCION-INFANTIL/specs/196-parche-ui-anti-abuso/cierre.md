# Cierre SPEC-196 — Parche UI Anti-abuso (002-PI-090)

## Resumen

Cuatro fixes UI/UX del módulo anti-abuso (I-83..I-86) implementados en un único commit.

## Estado

- Spec: `IMPLEMENTADO`
- Rama: `work/002-pi-090`
- Base: `feature/001-scaffolding @79bc4206`

## Archivos tocados

- `prisma/schema.prisma` — extensión aditiva del enum `AccionAudit` con `IP_DESBLOQUEADA_MANUAL`.
- `prisma/migrations/20260821070000_spec_196_desbloqueo_manual_audit/migration.sql` — migración aditiva del enum.
- `src/lib/schemas/index.ts` — `bloquearIpBodySchema` ahora valida `ip` en claro; `desbloquearIpBodySchema` requiere `motivo` de ≥20 caracteres.
- `src/lib/schemas/index.test.ts` — tests unitarios de los schemas de bloqueo/desbloqueo.
- `src/app/api/admin/anti-abuso/bloquear/route.ts` — calcula SHA-256 de la IP en backend.
- `src/app/api/admin/anti-abuso/bloquear/route.test.ts` — tests F4a.
- `src/app/api/admin/anti-abuso/desbloquear/route.ts` — envía `motivo` al servicio.
- `src/app/api/admin/anti-abuso/desbloquear/route.test.ts` — tests F4b.
- `src/lib/anti-abuso/block-list.ts` — `desbloquearIp` registra `IP_DESBLOQUEADA_MANUAL` con metadatos.
- `src/lib/anti-abuso/block-list.test.ts` — test de desbloqueo manual con motivo.
- `src/components/modules/AdminAntiAbusoOperativo.tsx` — formulario de bloqueo con IP en claro; modal de motivo para desbloqueo.
- `src/components/modules/AdminAntiAbusoSimulador.tsx` — limpia nota al cambiar escenario.
- `src/components/modules/AdminAntiAbusoSimulador.test.tsx` — test unitario F3.
- `src/components/modules/AdminAntiAbusoSimuladorHistorial.tsx` — columna ID truncado con botón copiar.
- `src/components/ui/Textarea.tsx` — componente reutilizable (nuevo).
- `src/components/ui/Textarea.test.tsx` — test unitario del componente.
- `vitest.unit.includes.ts` — incluye tests del simulador, Textarea y schemas.
- `specs/README.md` — registra SPEC-196 en ambas tablas.

## Gate local

- `npx tsc --noEmit` ✅
- `npm run lint` ✅ (0 errores, warnings preexistentes)
- Unit tests (`vitest.unit.config.ts`) ✅ 130 archivos, 862 tests
- Integration tests (`npm run test`) ✅ (ver resultado final)
- `npm run arch:check` ✅
- `npm run build` ✅

## Deuda técnica

Ninguna identificada.

## Notas

- Migración aditiva aplicada manualmente en BD local y registrada en `_prisma_migrations` para mantener `prisma migrate deploy` consistente.
- No se tocó motor de IA, rate-limit, ráfagas ni duplicados.
