# Reporte de cierre — Spec 020: Reorganización de módulos + Tablero de monitoreo

> Fecha de cierre: 2026-07-18.
> Rama: `feature/001-scaffolding`.

## Alcance cumplido

1. **Reorganización del módulo Operadores** en tres submódulos:
   - `Asignar`: estado en vivo de la cola y carga de operadores.
   - `Gestión`: CRUD de operadores (movido desde la página raíz).
   - `Modelo de asignación`: configuración de cupo default y estrategia.
2. **Reorganización del módulo Dashboard** en dos submódulos:
   - `Operación`: dashboard existente movido.
   - `Clasificación`: nuevo tablero de monitoreo operativo.
3. **Asignador configurable** desde `ParametroSistema`, sin cambiar el comportamiento por defecto.
4. **Tablero de monitoreo operativo** con indicadores, gráficas, tabla operativa con filtros y métricas por operador.

## Archivos creados

- `src/app/api/admin/operadores/asignacion/route.ts` + `route.test.ts`
- `src/app/api/admin/operadores/modelo/route.ts` + `route.test.ts`
- `src/app/api/admin/estadisticas/clasificacion/route.ts` + `route.test.ts`
- `src/app/dashboard/admin/operadores/asignar/page.tsx`
- `src/app/dashboard/admin/operadores/gestion/page.tsx`
- `src/app/dashboard/admin/operadores/modelo/page.tsx`
- `src/app/dashboard/admin/operadores/components/OperadoresSubNav.tsx`
- `src/app/dashboard/admin/estadisticas/operacion/page.tsx`
- `src/app/dashboard/admin/estadisticas/clasificacion/page.tsx`
- `src/app/dashboard/admin/estadisticas/components/DashboardSubNav.tsx`
- `prisma/migrations/20260718160000_cupo_operador_nullable/`
- `prisma/migrations/20260718170000_add_config_asignacion_audit/`

## Archivos modificados

- `prisma/schema.prisma`: `PerfilOperador.cupoMaximo` nullable; `CONFIGURACION_ASIGNACION_ACTUALIZADA` en `AccionAudit`.
- `src/lib/operadores/asignador.ts`: lee params `operadores.cupo_maximo_default` y `operadores.estrategia_asignacion`; soporta `aleatorio_puro`.
- `src/lib/operadores/asignador.test.ts`: tests de default configurable y estrategia aleatoria.
- `src/lib/reporte-test-utils.ts`: incluye params nuevos.
- `src/app/dashboard/admin/operadores/page.tsx`: redirección a `/dashboard/admin/operadores/asignar`.
- `src/app/dashboard/admin/estadisticas/page.tsx`: redirección a `/dashboard/admin/estadisticas/operacion`.
- `src/app/api/admin/reportes-revision/[id]/reasignar/route.ts`: usa cupo explícito o default configurable.

## Reutilización vs. creación

**Reutilizado:**
- Componentes de gráficos: `BarChart`, `DonutChart` (`src/components/modules/`).
- Estilo glassmorphism (`GlassCard`, tokens de tema).
- Autenticación y rate-limit existentes (`verifyAuth`, `checkRateLimit`).
- `AuditLog` para trazabilidad de asignaciones y cierres de casos.
- `ParametroSistema` para configuración sin deploy.

**Creado:**
- Submódulos UI y APIs específicas de asignación/modelo/monitoreo.
- Migraciones de schema.

## R7

No aplica: no toca el pipeline de clasificación. Solo reorganiza UI/configuración y agrega métricas sobre datos existentes.

## Verificaciones

- `npm run lint`: ✅ (1 warning preexistente en `src/lib/sms.ts`).
- `npx tsc --noEmit`: ✅
- `npm run build`: ✅
- `npm test -- --run`: ✅ 255 tests pasaron.
- `npx tsx scripts/smoke-e2e.ts`: ✅

## Decisiones registradas

- El default del asignador sigue siendo `ponderado_carga_inversa` con cupo 10; ahora ambos son configurables.
- El cupo explícito en `PerfilOperador` tiene prioridad sobre el default.
- El tablero de monitoreo es solo para admin; operadores no lo ven.
- `CASO_ESCALADO` existe en `AccionAudit` y se muestra en el tablero (0 si aún no hay registros).

## Estado final

Spec 020 cerrada y lista para despliegue según `docs/despliegue.md` v2.1.
