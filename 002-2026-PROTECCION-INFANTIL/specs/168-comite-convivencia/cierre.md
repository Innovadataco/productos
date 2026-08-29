# Cierre: SPEC-168 — Comité de Convivencia por colegio

**Estado**: IMPLEMENTADO  
**Fecha de cierre**: 2026-08-12  
**Rama de trabajo**: `work/002-pi-068`  
**PR**: pendiente → `feature/001-scaffolding`  

---

## Resumen

Se entregó el módulo de Comité de Convivencia por colegio: cuenta compartida de login (`COMITE_CONVIVENCIA`), padrón documentado de integrantes, escalamiento de alertas, bandeja de casos, detalle con bitácora y cierre con resolución documentada. Todo está acotado al `colegioId` del rector y al comité autenticado; el número de identificación de los integrantes se cifra en reposo y se detectan duplicados mediante un hash determinístico.

---

## Cambios integrados

### Modelo de datos

- `prisma/schema.prisma`:
  - `RolUsuario` añade `COMITE_CONVIVENCIA`.
  - `Usuario` añade `comiteColegioId` (FK única a `Colegio.id`).
  - `IntegranteComite` añade `cargo` y `hashIdentificacion`; `@@unique([comiteId, hashIdentificacion])`.
  - `SolicitudComite` añade `colegioId` y `alertaColegioId` (`@unique`).
  - `AccionAudit` añade acciones `COLEGIO_COMITE_*` y `COLEGIO_CASO_*`.
- `prisma/migrations/20260812211500_add_comite_convivencia_fase_f/migration.sql`: migración aditiva con columnas, enums, relaciones e índices.
- `prisma/migrations/20260812171022_add_hash_identificacion_integrante_comite/migration.sql`: añade `hashIdentificacion` NOT NULL con default transitorio para filas existentes.

### Backend

- `src/lib/dal/services/comite-convivencia.ts`: cuenta compartida (crear, obtener, regenerar password), con validación de duplicados por colegio y por email.
- `src/lib/dal/services/comite-convivencia-integrantes.ts`: CRUD de integrantes, cambio de estado, auditoría.
- `src/lib/dal/services/comite-convivencia-bandeja.ts`: escalamiento, listado, detalle, resolución y notas colegio-scoped.
- `src/lib/dal/repositories/comite-convivencia.ts`, `comite-convivencia-integrantes.ts`, `comite-convivencia-solicitudes.ts`.
- `src/lib/dal/services/comite-integrantes.ts`: ajustado para mantener `hashIdentificacion` en altas/ediciones del comité de validación.
- `src/lib/hash-identificacion.ts`: HMAC-SHA256 determinístico con `PARAM_ENCRYPTION_KEY`.
- `src/lib/colegio/vigencia.ts`, `src/lib/proxy.ts`, `src/lib/nav-items.ts`, `src/components/modules/NavHeader.tsx`, `src/app/dashboard/colegio/layout.tsx`: soporte de rol, home y vigencia.
- `src/lib/permisos-catalogo.ts` y `prisma/seed-modulos-grants.ts`: módulos `colegios_comite` y `colegios_comite_bandeja`.

### API

- `src/app/api/colegio/comite/cuenta/route.ts`
- `src/app/api/colegio/comite/cuenta/regenerar-password/route.ts`
- `src/app/api/colegio/comite/integrantes/route.ts`
- `src/app/api/colegio/comite/integrantes/[id]/route.ts`
- `src/app/api/colegio/comite/integrantes/[id]/estado/route.ts`
- `src/app/api/colegio/alertas/[id]/escalar/route.ts`
- `src/app/api/colegio/comite/solicitudes/route.ts`
- `src/app/api/colegio/comite/solicitudes/[id]/route.ts`
- `src/app/api/colegio/comite/solicitudes/[id]/resolver/route.ts`
- `src/app/api/colegio/comite/solicitudes/[id]/notas/route.ts`

### Frontend

- `src/app/dashboard/colegio/comite/page.tsx`
- `src/app/dashboard/colegio/comite/casos/page.tsx`
- `src/app/dashboard/colegio/comite/casos/[id]/page.tsx`
- `src/components/modules/colegio/comite/ComiteCuentaCard.tsx`
- `src/components/modules/colegio/comite/IntegrantesList.tsx`
- `src/components/modules/colegio/comite/SolicitudesBandeja.tsx`
- `src/components/modules/colegio/comite/CasoDetalle.tsx`

### Tests

- `src/app/api/colegio/comite/cuenta/route.test.ts`
- `src/app/api/colegio/comite/cuenta/regenerar-password/route.test.ts`
- `src/app/api/colegio/comite/integrantes/route.test.ts`
- `src/app/api/colegio/comite/solicitudes/route.test.ts`
- `src/app/api/colegio/comite/solicitudes/[id]/route.test.ts`
- `src/app/api/colegio/comite/solicitudes/[id]/resolver/route.test.ts`
- `src/app/api/colegio/comite/solicitudes/[id]/notas/route.test.ts`
- `src/app/api/colegio/alertas/[id]/escalar/route.test.ts`
- `src/app/api/admin/comite/integrantes/route.test.ts` ajustado al campo `hashIdentificacion`.
- `src/lib/comite-test-utils.ts` (helpers de test).

### Arquitectura

- `docs/architecture/01-modelo-datos.md`, `02-roles-capacidades.md` y `03-pantallas.md` regenerados (`npm run arch:check` verde).

---

## Gate de calidad

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ (0 errores, 45 warnings preexistentes) |
| `npm run test` | ✅ (2052 passed, 1 skipped) |
| `npm run tokens:check` | ✅ |
| `npm run arch:check` | ✅ |
| `npm run build` | ✅ |

---

## Notas

- No se tocó `src/lib/ai/**`.
- No se modificó `Curso` ni `Estudiante.cursoId`.
- Las migraciones son aditivas.
- `hashIdentificacion` usa un default transitorio (`gen_random_uuid()::text`) para filas preexistentes de `IntegranteComite`; en ambientes limpios no hay impacto.
- `SolicitudComite.reporteId` conserva `@unique`; el escalamiento colegio-scoped se acota por `alertaColegioId`, pero una futura evolución podría relajar la unicidad global de `reporteId` si el comité de validación y el comité de convivencia necesitan coexistir sobre el mismo reporte.
