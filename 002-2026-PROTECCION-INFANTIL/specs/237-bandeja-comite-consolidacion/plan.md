# Implementation Plan: SPEC-237 — Bandeja comité CONSOLIDACION + vista + aprobación multi-miembro

**Branch**: `work/002-pi-padre-lote-core` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

---

## Summary

Enriquecer la bandeja existente `/dashboard/admin/comite` para que muestre tareas de tipo `REVISION_REPORTE` y `CONSOLIDACION_EXPEDIENTE`, con filtros, badges, iconos y SLA visible en zona Bogotá. Crear la vista `/dashboard/admin/comite/consolidacion/[expedienteId]` con encabezado, timeline, resumen editable, patrones N1, señal comunitaria y selector de guía de acción. Extender el repositorio `informe-consolidado-repository` con aprobación multi-miembro, corrección append-only, devolución con motivo y listado de pendientes. Respetar estrictamente los roles: `COMITE_VALIDACION` muta, `ADMIN` lee, `PARENT` no accede.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, date-fns-tz |
| **Storage** | PostgreSQL 16 — migraciones ADITIVAS (`TareaBandejaComite.tipo`, campos en `InformeConsolidado`, parámetros) |
| **Testing** | Vitest integration para endpoints/repositorios; unit para helpers de SLA/color |
| **Auth** | JWT manual + `verifyAuth` + `assertRol`/`assertModulo` |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | No se añade capacidad de subir multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | Señal comunitaria usa lenguaje descriptivo/estadístico |
| §1.5 Clasificación de conductas | ✅ Pass | La guía de acción es categoría de conducta, no score de persona |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual; sin cambios de stack |
| §3.5 Logs y auditoría | ✅ Pass | Aprobaciones/correcciones/devoluciones van a `AuditLog` |
| I-22 No secretos | ✅ Pass | Ningún valor secreto en docs ni specs |
| I-49 Migraciones aditivas | ✅ Pass | Solo ALTER ADD / CREATE TYPE ADD VALUE; cero DROP |
| Q-3 Frontera DAL | ✅ Pass | Todo acceso a `InformeConsolidado` pasa por `informe-consolidado-repository` |

---

## Estado actual (verificado en fuente)

- **Bandeja comité**: `/dashboard/admin/comite/page.tsx` renderiza `ComiteBandeja` (`src/components/modules/ComiteBandeja`), que lista solicitudes de comité (`SolicitudComite`) de tipo `REVISION_REPORTE`.
- **Subnav**: `src/app/dashboard/admin/comite/components/ComiteSubNav.tsx` ya separa vistas de gestión, apelaciones y auditoría.
- **Auth/permisos**: `src/lib/auth.ts` (`verifyToken`) y helpers de permisos por rol/módulo; el layout de admin verifica rol.
- **DAL**: `src/lib/dal/repositories/` existe; se creará/extenderá `informe-consolidado-repository.ts`.
- **Parametros**: `ParametroSistema` con prefijos categorizados; se añadirán `padre.comite.*`.
- **Audit**: `src/lib/audit.ts` con `logAudit`; se añadirán valores a `AccionAudit`.
- **Modelos padre**: `InformeConsolidado`, `PatronExpediente`, `Expediente` provendrán de SPEC-234/SPEC-236; esta spec asume su existencia.

---

## Diseño por fase

### Fase 1 — Migración, seed y repositorio base

**Migración aditiva** (nombre tentativo `20260822010000_spec_237_comite_consolidacion`):

- Añadir valor `CONSOLIDACION_EXPEDIENTE` al enum/campo `tipo` de `TareaBandejaComite`.
- Añadir/confirmar campos en `InformeConsolidado`:
  - `estadoAprobacion` (enum/string: `PENDIENTE_CONSOLIDACION`, `CORREGIDO`, `DEVUELTO`, `APROBADO`).
  - `resumenTextoGenerado` `@db.Text`.
  - `correccionesJson` `Json` default `[]`.
  - `aprobadoPorMiembrosJson` `Json` default `[]`.
  - `guiaAccionCategoriaIdPrincipal` `String?` (FK lógica a `CategoriaConducta`).
  - `motivoDevolucion` `String?` `@db.Text`.
  - Timestamps en `Timestamptz(6)`.
- Añadir valores a `AccionAudit`: `INFORME_CONSOLIDADO_APROBADO`, `INFORME_CONSOLIDADO_CORREGIDO`, `INFORME_CONSOLIDADO_DEVUELTO`.

**Seed** (`prisma/seed.ts`):

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `padre.comite.miembros_minimos_aprobacion` | INTEGER | `2` | Mínimo de miembros del comité que deben aprobar un informe consolidado |
| `padre.comite.sla_horas_consolidacion` | INTEGER | `72` | Horas desde la creación para considerar vencido el SLA de consolidación |

**Repositorio** `src/lib/dal/repositories/informe-consolidado.ts` (o extensión del existente):

- `obtenerPorExpedienteId(expedienteId, opciones?)` — incluye patrones y señal comunitaria.
- `listarPendientesConsolidacion({ page, pageSize, tipo, comiteId? })` — solo `PENDIENTE_CONSOLIDACION` y `CORREGIDO`.
- `aprobarPorMiembro(informeId, miembroId)` — idempotente por miembro; retorna `{ informe, aprobo, transicion? }`.
- `corregirTexto(informeId, miembroId, textoNuevo, motivo)` — append a `correccionesJson`; estado `CORREGIDO`.
- `devolverConMotivo(informeId, miembroId, motivo)` — estado `DEVUELTO`; guarda motivo.

**Servicio** `src/lib/comite/consolidacion.ts`:

- `calcularSlaEnBogota(createdAt, horas)` usando `date-fns-tz`.
- `colorIndicadorSla(fechaLimite)` → `pino` / `ambar` / `rubi`.
- `puedeActuar(informe, usuario)` — `COMITE_VALIDACION` y estado permitido.

**Tests**: `src/lib/dal/repositories/informe-consolidado.test.ts`, `src/lib/comite/consolidacion.test.ts`.

---

### Fase 2 — Backend: endpoints de consolidación

Todos bajo `src/app/api/admin/comite/consolidacion/`:

- `GET /api/admin/comite/consolidacion/route.ts` — lista de informes pendientes de consolidación (paginada, filtrable).
- `GET /api/admin/comite/consolidacion/[expedienteId]/route.ts` — detalle de un informe: header, timeline, texto, patrones, señal comunitaria, guía de acción, aprobaciones actuales.
- `POST /api/admin/comite/consolidacion/[expedienteId]/aprobar/route.ts` — valida rol `COMITE_VALIDACION`, llama `aprobarPorMiembro`; si alcanza umbral, invoca `aplicarTransicion(expedienteId, 'EN_APROBACION_PADRE')` y publica `expediente.comite.aprobo`.
- `POST /api/admin/comite/consolidacion/[expedienteId]/corregir/route.ts` — body `{ resumenTextoGenerado, motivo, guiaAccionCategoriaIdPrincipal? }`.
- `POST /api/admin/comite/consolidacion/[expedienteId]/devolver/route.ts` — body `{ motivo }`, motivo obligatorio.

Validación Zod en `src/lib/schemas/index.ts`:

```ts
export const aprobarInformeBodySchema = z.object({});
export const corregirInformeBodySchema = z.object({
  resumenTextoGenerado: z.string().min(1).max(20000),
  motivo: z.string().min(1).max(500),
  guiaAccionCategoriaIdPrincipal: cuidIdSchema.optional(),
});
export const devolverInformeBodySchema = z.object({
  motivo: z.string().min(1).max(1000),
});
```

**Tests**: un `route.test.ts` por endpoint.

---

### Fase 3 — Bandeja enriquecida (UI)

Modificar `src/components/modules/ComiteBandeja.tsx` (o contenedor equivalente):

- Añadir selector de tipo (`TODOS`, `REVISION_REPORTE`, `CONSOLIDACION_EXPEDIENTE`).
- Añadir badge/icono por tipo.
- Añadir columna SLA con indicador de color (`pino`/`ambar`/`rubi`) calculado en Bogotá.
- Las filas de consolidación linkean a `/dashboard/admin/comite/consolidacion/[expedienteId]`.
- No se clona el componente; se enriquece con props/variantes.

**Tests de componente**: `src/components/modules/ComiteBandeja.test.tsx` (o nuevo) para filtro y SLA.

---

### Fase 4 — Vista de consolidación (UI)

Crear `src/app/dashboard/admin/comite/consolidacion/[expedienteId]/page.tsx` (Server Component):

- Lee `expedienteId` de params.
- Verifica `verifyAuth` + rol (`COMITE_VALIDACION` o `ADMIN` para lectura).
- Renderiza componentes cliente bajo `src/components/modules/comite/consolidacion/`:
  - `ConsolidacionHeader`: identificador, estado, categoría dominante, SLA.
  - `ConsolidacionTimeline`: eventos del expediente.
  - `ConsolidacionResumenEditor`: textarea editable + botón Corregir (solo `COMITE_VALIDACION`).
  - `ConsolidacionPatronesN1`: lista de patrones verificables.
  - `ConsolidacionSenalComunitaria`: estadísticas agregadas.
  - `ConsolidacionGuiaAccion`: selector de categoría.
  - `ConsolidacionAcciones`: botones Aprobar/Corregir/Devolver (solo `COMITE_VALIDACION`).

**Tests de componente**: al menos render condicional por rol y validación de motivo obligatorio en devolución.

---

### Fase 5 — Integración, eventos y rol estricto

- Integrar `aplicarTransicion` de SPEC-236 en el servicio de aprobación.
- Publicar evento `expediente.comite.aprobo` vía bus interno (pg-boss o helper de SPEC-236).
- Asegurar que `ADMIN` reciba 403 en endpoints de mutación y vea UI en modo lectura.
- Asegurar que `PARENT` no acceda a rutas de admin (redirección/403).

**Tests**: tests de integración de roles y transición.

---

### Fase 6 — Cierre

- Regenerar docs de arquitectura si el cambio toca schema/proxy/navegación (`npm run arch:generate` y `npm run arch:check`).
- Gate local completo.

---

## Project Structure

```text
prisma/migrations/20260822010000_spec_237_comite_consolidacion/migration.sql  # NUEVO
prisma/schema.prisma                                                            # MOD: +tipo consolidacion, +campos InformeConsolidado, +AccionAudit
prisma/seed.ts                                                                  # MOD: +2 params padre.comite.*
src/lib/dal/repositories/informe-consolidado.ts                                 # NUEVO/extendido
src/lib/comite/consolidacion.ts                                                 # NUEVO
src/lib/comite/sla.ts                                                           # NUEVO
src/lib/schemas/index.ts                                                        # MOD: +schemas aprobar/corregir/devolver
src/app/api/admin/comite/consolidacion/route.ts                                 # NUEVO
src/app/api/admin/comite/consolidacion/[expedienteId]/route.ts                  # NUEVO
src/app/api/admin/comite/consolidacion/[expedienteId]/aprobar/route.ts          # NUEVO
src/app/api/admin/comite/consolidacion/[expedienteId]/corregir/route.ts         # NUEVO
src/app/api/admin/comite/consolidacion/[expedienteId]/devolver/route.ts         # NUEVO
src/app/dashboard/admin/comite/consolidacion/[expedienteId]/page.tsx            # NUEVO
src/components/modules/ComiteBandeja.tsx                                        # MOD: enriquecer
src/components/modules/comite/consolidacion/*                                   # NUEVO
tests: repositorios, endpoints, componentes, helpers SLA/color
docs/architecture/                                                              # REGENERAR si aplica
```

---

## Orden de implementación (tasks.md tras compuerta)

1. Migración aditiva + seed + enum audit.
2. `InformeConsolidadoRepository` con 4 métodos nuevos + tests.
3. Helpers SLA/color + tests unitarios.
4. Endpoints GET lista/detalle + tests.
5. Endpoints POST aprobar/corregir/devolver + tests.
6. Enriquecer `ComiteBandeja` con filtro/badge/SLA + tests componente.
7. Crear vista de consolidación y componentes + tests.
8. Integrar `aplicarTransicion` y publicación de evento + tests de transición.
9. Regenerar docs/architecture + gate local completo.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Componente de bandeja no extensible sin clonar | Evaluar refactor menor previo; priorizar composición sobre duplicación (D-72) |
| `aplicarTransicion` de SPEC-236 no está listo | Dejar la integración en una función `intentarTransicionAprobacionPadre` con fallback a log + estado manual |
| Concurrencia en aprobaciones simultáneas | Usar transacción Prisma o advisory lock ligero; publicar evento solo cuando el contador pasa de umbral-1 a umbral |
| Snapshots `correccionesJson` crecen indefinidamente | Limitar tamaño de texto consolidado; en futura spec evaluar tabla normalizada |
| Zona horaria del cliente vs servidor | SLA siempre calculado y mostrado en `America/Bogota` con `date-fns-tz` |

---

## Decisiones para compuerta §4

1. **Enriquecer vs clonar bandeja**: propuesta enriquecer `ComiteBandeja` con filtro de tipo y variantes de fila; no crear bandeja paralela (respeta D-72).
2. **Contador de aprobaciones**: campo JSON `aprobadoPorMiembrosJson` en `InformeConsolidado` (array de `{miembroId, nombre, aprobadoEn}`); suficiente para umbral pequeño (default 2). Si ZEUS prefiere tabla normalizada, se evalúa en implementación.
3. **Estado tras corrección**: `CORREGIDO`, no `APROBADO`; la transición solo ocurre por umbral de aprobaciones.
4. **Guía de acción por defecto**: categoría dominante del expediente; editable por comité.
5. **Color ámbar para admin**: se mantiene el sistema visual existente del módulo comité; semáforo `pino`/`ambar`/`rubi` para SLA y scores.
