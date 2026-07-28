# Implementation Plan: SPEC-109 — Eliminar el módulo de apelación actual (D-34)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/109-eliminar-modulo-apelacion/spec.md`

## Summary

Eliminación COMPLETA del módulo de apelación de la spec 015 (D-34 lo rediseña desde cero,
no se reutiliza nada): página pública, APIs públicas y admin, lib de dominio, job de
vencimiento, componente y entrada de menú admin, modelo Prisma + enum + relaciones (DROP
seguro: tabla verificada vacía en producción), parámetros del seed, y todas las referencias
huérfanas (proxy, rate-limit, catálogo de permisos, asignador, helpers de tests).
`actualizarVisibilidadPublica` queda intacto como dueño único del flag de visibilidad.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: Prisma 5.22 (migración DROP), Next.js 16 App Router, Vitest

**Storage**: PostgreSQL 16 — tabla `ApelacionIdentificador` con **0 filas en producción**
(PASO 0 verificado 2026-07-28)

**Testing**: Vitest (suite existente tras retirar los tests del módulo)

**Constraints**: migración destructiva SOLO sobre la tabla/enum del módulo (vacía);
`actualizarVisibilidadPublica` NO se toca; NO desplegar (lote del CEO).

**Scale/Scope**: ~15 archivos eliminados + ~10 archivos con referencias a retirar + 1
migración.

## Constitution Check

*GATE: verificado antes de Fase 0 y tras el diseño (2026-07-28).*

- **Migraciones aditivas, nunca destructivas (regla de oro)**: EXCEPCIÓN deliberada y
  justificada — el instructivo ordena eliminar el modelo con migración y la tabla está
  verificada VACÍA en producción (PASO 0). Es destructiva solo en forma, no en datos.
- **Disputas (Ley 1581 de 2012)**: el derecho de disputa NO se elimina como principio; el
  módulo que lo implementaba mal se retira para rediseñarse (D-34). La vía vigente mientras
  tanto es el canal manual existente (contacto administrativo).
- **Presunción de inocencia**: retirar el flujo que ocultaba identificadores sin revisión
  humana REFUERZA el principio (el ocultamiento era inmediato y sin decisión). CUMPLE.

Violación formal (migración DROP) justificada y registrada arriba.

## Inventario de huérfanos (respuesta obligatoria del plan)

Lo que quedaría huérfano al eliminar y su destino (verificado en fuente 2026-07-28):

| Referencia | Ubicación | Destino |
|------------|-----------|---------|
| Ruta pública en `PUBLIC_ROUTES` | `src/lib/proxy.ts:27` (`/api/apelaciones`) | Retirar la entrada |
| Scopes de rate-limit | `src/lib/rate-limit.ts:40-41` (`apelacion`, `apelacion_sms`) | Retirar ambos scopes |
| Módulo del catálogo | `src/lib/permisos-catalogo.ts:36` (`apelaciones`) + backfill del seed (deriva del catálogo) | Retirar del catálogo; el backfill deja de crearlo |
| Entrada de menú admin | `src/lib/nav-items.ts:21` y `src/components/modules/AdminNav.tsx:18` (ScaleIcon) | Retirar ambas |
| Componente admin | `src/components/modules/AdminApelaciones.tsx` + página `dashboard/admin/apelaciones/page.tsx` | Eliminar |
| Asignación de apelaciones | `src/lib/operadores/asignador.ts:169-230` (rama `apelacionId`) | Retirar la rama; la de reportes queda intacta |
| Permiso de gestión | `src/lib/operadores/permisos.ts:41-46` (`puedeGestionarApelacion`) | Retirar función + sus tests (`operadores/integracion.test.ts` si cubre apelación) |
| Helper `puedeGestionarApelacion` en tests | `src/lib/operadores/integracion.test.ts` | Ajustar/eliminar casos de apelación |
| Cleanup en tests | `src/lib/test-utils.ts:52` (`apelacionIdentificador.deleteMany`) | Retirar la línea |
| Parámetros de test | `src/lib/reporte-test-utils.ts:206-208` (`anti_abuso.apelacion_pausa_dias`, `ratelimit.apelacion.*`) | Retirar |
| Smoke script | `scripts/smoke-apelaciones.ts` | Eliminar |
| Job de vencimiento | `scripts/job-apelaciones-vencimiento.ts` | Eliminar (además: nunca estuvo programado) |
| `src/lib/sms.ts` | usado SOLO por `api/apelaciones/verificar/route.test.ts` | Eliminar junto con el test (verificado: nada más lo usa) |
| Tests del módulo | `api/apelaciones/**/route.test.ts`, `api/admin/apelaciones/route.test.ts` | Eliminar con las rutas |
| Relaciones Prisma | `Usuario.apelaciones`, `Usuario.apelacionesAsignadas`, `IdentificadorReportado.apelaciones` (schema ~224,227,533,776) y campos SMS del modelo (797-799) | Migración DROP + retirar relaciones |

## Diseño (por FR)

1. **FR-001/002/003**: borrado de `src/app/apelar/`, `src/app/api/apelaciones/`,
   `src/app/api/admin/apelaciones/`, `src/app/dashboard/admin/apelaciones/`,
   `src/lib/apelaciones.ts`, `scripts/job-apelaciones-vencimiento.ts`,
   `scripts/smoke-apelaciones.ts`, `src/components/modules/AdminApelaciones.tsx` y
   `src/lib/sms.ts`.
2. **FR-004**: migración `DROP TABLE "ApelacionIdentificador"` + `DROP TYPE
   "EstadoApelacion"` (vacía: 0 filas en prod, verificado); schema sin el modelo, el enum
   y las relaciones de la tabla de huérfanos.
3. **FR-005/006**: seed sin `anti_abuso.apelacion_pausa_dias` ni `ratelimit.apelacion.*`;
   proxy sin la ruta; rate-limit sin los dos scopes; catálogo sin el módulo; nav-items y
   AdminNav sin la entrada; asignador sin la rama; permisos sin la función; helpers de
   tests sin las líneas del módulo.
4. **FR-007**: `src/lib/sms.ts` eliminado (verificado: solo lo usa el test de apelaciones).
5. **FR-008**: `actualizarVisibilidadPublica` y `src/lib/visibility.ts` intactos (diff cero).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Fila aparece en prod entre PASO 0 y la migración | Antes de aplicar en prod (lote), re-verificar `COUNT(*)`; si > 0, PARAR y reportar a ZEUS |
| Import muerto rompe el build | El inventario de huérfanos de arriba + gate completo |
| El módulo de permisos queda en la BD de prod (PermisoModulo) | Se documenta en el cierre: limpieza del registro en prod va en el lote (o queda inerte sin catálogo) |

## Project Structure

### Documentation (this feature)

```text
specs/109-eliminar-modulo-apelacion/
├── plan.md              # Este archivo
├── research.md          # Fase 0 (incluye PASO 0)
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── checklists/
│   └── requirements.md  # Validación de la spec
└── cierre.md            # Al cerrar (pendiente)
```

### Source Code (repository root)

```text
ELIMINADOS: src/app/apelar/ · src/app/api/apelaciones/ · src/app/api/admin/apelaciones/ ·
  src/app/dashboard/admin/apelaciones/ · src/lib/apelaciones.ts · src/lib/sms.ts ·
  src/components/modules/AdminApelaciones.tsx · scripts/job-apelaciones-vencimiento.ts ·
  scripts/smoke-apelaciones.ts
EDITADOS: prisma/schema.prisma (+ migración DROP) · prisma/seed.ts · src/lib/proxy.ts ·
  src/lib/rate-limit.ts · src/lib/permisos-catalogo.ts · src/lib/nav-items.ts ·
  src/components/modules/AdminNav.tsx · src/lib/operadores/{asignador,permisos}.ts ·
  src/lib/operadores/integracion.test.ts · src/lib/test-utils.ts · src/lib/reporte-test-utils.ts
```

**Structure Decision**: eliminación pura; sin contratos nuevos (no aplica `contracts/`).
