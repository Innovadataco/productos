# Requirements Checklist — Spec 043: UX del comité y navegación del padre

## Functional Requirements

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| FR-001 | `NavHeader` muestra enlace a `/dashboard` para `PARENT` autenticado. | ✅ | `src/components/modules/NavHeader.tsx`: href condicional y enlace "Mi panel" en menú desplegable y móvil. |
| FR-002 | Botón "Dashboard" para anónimos sigue a `/dashboard-publico`. | ✅ | `NavHeader.tsx`: href `/dashboard-publico` cuando `user` es null o no es `PARENT`. |
| FR-003 | No se duplica vista de `/dashboard-publico`. | ✅ | `/dashboard` sigue usando `DashboardUsuarioClient`; `/dashboard-publico` no se modifica. |
| FR-004 | `ComiteBandeja` muestra una sola lista sin pestañas. | ✅ | `src/components/modules/ComiteBandeja.tsx`: estado `tab` y botones eliminados; un solo listado. |
| FR-005 | Abrir caso `PENDIENTE` auto-asigna al comité logueado. | ✅ | `ComiteBandeja.tsx`: `handleVer` llama `/api/admin/comite/${id}/asignar` antes de abrir el detalle. |
| FR-006 | Casos asignados a otro comité se muestran bloqueados o solo lectura. | ✅ | `ComiteBandeja.tsx`: función `isReadOnly` deshabilita acción para `RESUELTA` o `ASIGNADA` a otro. |
| FR-007 | `ComiteSolicitudDetalle` elimina radio buttons Clasificar/Corregir. | ✅ | `src/components/modules/ComiteSolicitudDetalle.tsx`: solo select de categoría + textarea + botón Resolver. |
| FR-008 | Endpoint resolver siempre deja reporte en `CORREGIDO` con `responsableTipo = COMITE`. | ✅ | `src/app/api/admin/comite/[id]/resolver/route.ts`: `estadoNuevo = "CORREGIDO"`; transición con `responsableTipoFromRol`. |
| FR-009 | Endpoint resolver elimina/ignora el campo `accion`. | ✅ | `resolver/route.ts`: schema sin campo `accion`; body solo con `categoria` y `resolucion`. |
| FR-010 | Endpoint resolver actualiza siempre `ClasificacionIA.categoria` y `confianza = 1.0`. | ✅ | `resolver/route.ts`: `tx.clasificacionIA.update` con `categoria` y `confianza: 1.0` incondicional. |
| FR-011 | Tests de resolver actualizados para esperar `CORREGIDO`. | ✅ | `src/app/api/admin/comite/pendientes/route.test.ts` y `src/app/api/admin/comite/[id]/resolver/route.test.ts` verifican `CORREGIDO`. |
| FR-012 | Copy del Círculo de Confianza reemplazado por texto claro. | ✅ | `src/app/dashboard/circulo-confianza/page.tsx` línea actualizada. |
| FR-013 | No hay cambios en el modelo de datos de Prisma. | ✅ | Sin migraciones. |

## Success Criteria

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| SC-001 | `PARENT` autenticado navega a `/dashboard` desde el header. | ✅ | Test `NavHeader.test.tsx` y verificación manual. |
| SC-002 | `ComiteBandeja` no tiene pestañas. | ✅ | Test `ComiteBandeja.test.tsx` y verificación manual. |
| SC-003 | Abrir caso `PENDIENTE` lo auto-asigna. | ✅ | Test `ComiteBandeja.test.tsx` y verificación manual. |
| SC-004 | Resolver deja reporte en `CORREGIDO` siempre. | ✅ | Test `resolver/route.test.ts` y verificación manual. |
| SC-005 | Tests de resolver pasan. | ✅ | `npm run test` completo: 439 tests pasan. |
| SC-006 | Copy del Círculo de Confianza actualizado. | ✅ | Verificación visual de la página. |
| SC-007 | `tsc`, `lint`, `test` pasan sin errores nuevos. | ✅ | `tsc --noEmit` OK; lint 1 warning heredado; `test` 439/439 OK. |

## Validation Log

- 2026-07-20: Implementados los 4 cambios de UI/UX y endpoints.
- 2026-07-20: Tests específicos de componentes y endpoints pasan.
- 2026-07-20: Full suite: 439 tests pasan, 0 fallos.
- 2026-07-20: Build exitoso (`rm -rf .next && npm run build`).
- 2026-07-20: Deploy limpio con `./scripts/dev-restart.sh`; healthcheck OK; un solo worker.

## Sign-off

Implementado y validado. Listo para merge tras revisión.
