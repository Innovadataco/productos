# Requirements Checklist — Spec 043: UX del comité y navegación del padre

## Functional Requirements

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| FR-001 | `NavHeader` muestra enlace a `/dashboard` para `PARENT` autenticado. | ⏳ | Pendiente implementación. |
| FR-002 | Botón "Dashboard" para anónimos sigue a `/dashboard-publico`. | ⏳ | Pendiente implementación. |
| FR-003 | No se duplica vista de `/dashboard-publico`. | ⏳ | Pendiente implementación. |
| FR-004 | `ComiteBandeja` muestra una sola lista sin pestañas. | ⏳ | Pendiente implementación. |
| FR-005 | Abrir caso `PENDIENTE` auto-asigna al comité logueado. | ⏳ | Pendiente implementación. |
| FR-006 | Casos asignados a otro comité se muestran bloqueados o solo lectura. | ⏳ | Pendiente implementación. |
| FR-007 | `ComiteSolicitudDetalle` elimina radio buttons Clasificar/Corregir. | ⏳ | Pendiente implementación. |
| FR-008 | Endpoint resolver siempre deja reporte en `CORREGIDO` con `responsableTipo = COMITE`. | ⏳ | Pendiente implementación. |
| FR-009 | Endpoint resolver elimina/ignora el campo `accion`. | ⏳ | Pendiente implementación. |
| FR-010 | Endpoint resolver actualiza siempre `ClasificacionIA.categoria` y `confianza = 1.0`. | ⏳ | Pendiente implementación. |
| FR-011 | Tests de resolver actualizados para esperar `CORREGIDO`. | ⏳ | Pendiente implementación. |
| FR-012 | Copy del Círculo de Confianza reemplazado por texto claro. | ⏳ | Pendiente implementación. |
| FR-013 | No hay cambios en el modelo de datos de Prisma. | ✅ | Sin migraciones planificadas. |

## Success Criteria

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| SC-001 | `PARENT` autenticado navega a `/dashboard` desde el header. | ⏳ | Pendiente. |
| SC-002 | `ComiteBandeja` no tiene pestañas. | ⏳ | Pendiente. |
| SC-003 | Abrir caso `PENDIENTE` lo auto-asigna. | ⏳ | Pendiente. |
| SC-004 | Resolver deja reporte en `CORREGIDO` siempre. | ⏳ | Pendiente. |
| SC-005 | Tests de resolver pasan. | ⏳ | Pendiente. |
| SC-006 | Copy del Círculo de Confianza actualizado. | ⏳ | Pendiente. |
| SC-007 | `tsc`, `lint`, `test` pasan sin errores nuevos. | ⏳ | Pendiente. |

## Validation Log

*Por completar tras la implementación.*

## Sign-off

Plan pendiente de aprobación. No se implementa código hasta el visto bueno.
