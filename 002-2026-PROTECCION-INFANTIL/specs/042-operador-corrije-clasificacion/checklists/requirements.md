# Requirements Checklist — Spec 042: Operador corrige la clasificación

## Functional Requirements

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| FR-001 | `POST /api/admin/correcciones` permite al rol OPERADOR corregir un reporte asignado. | ✅ | Código existente en `src/app/api/admin/correcciones/route.ts`. |
| FR-002 | Se crea `CorreccionAdmin` con categorías original/corregida y `adminId`. | ✅ | Código existente. |
| FR-003 | Se actualiza `ClasificacionIA.categoria` y `confianza = 1.0`. | ✅ | Código existente. |
| FR-004 | Se registra `TransicionReporte` con `responsableTipo = OPERADOR`. | ✅ | `registrarTransicion` con `responsableTipoFromRol(user.rol)`. |
| FR-005 | Se actualiza `Reporte.estado` a `CORREGIDO`. | ✅ | Código existente. |
| FR-006 | No se permiten correcciones duplicadas. | ✅ | Verificación `correccionExistente` en endpoint. |
| FR-007 | No se permite corregir reportes dados de baja. | ⚠️ | Pendiente de verificar en implementación. |
| FR-008 | `AdminReporteDetalle` muestra botón de corrección solo en estados corregibles. | ✅ | Condición `puedeCorregir` en componente. |
| FR-009 | Flujo documentado en `quickstart.md` y validado con tests. | ⏳ | Pendiente de implementación del plan. |
| FR-010 | No hay cambios en el modelo de datos de Prisma. | ✅ | Sin migraciones. |

## Success Criteria

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| SC-001 | Tests de `/api/admin/correcciones` verifican estado `CORREGIDO`, transición `OPERADOR` y corrección. | ⏳ | Pendiente de agregar tests. |
| SC-002 | Test de `AdminReporteDetalle` verifica botón de corrección. | ⏳ | Pendiente (o prueba manual documentada). |
| SC-003 | `quickstart.md` describe flujo end-to-end reproducible. | ✅ | Artefacto creado. |
| SC-004 | `tsc`, `lint`, `test` pasan sin errores nuevos. | ⏳ | Pendiente implementación. |

## Validation Log

*Por completar tras la implementación.*

## Sign-off

*Pendiente de aprobación del plan.*
