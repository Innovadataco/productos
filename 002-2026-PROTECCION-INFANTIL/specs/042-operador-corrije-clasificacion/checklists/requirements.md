# Requirements Checklist — Spec 042: Operador corrige la clasificación

## Functional Requirements

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| FR-001 | `POST /api/admin/correcciones` permite al rol OPERADOR corregir un reporte asignado. | ✅ | Código existente en `src/app/api/admin/correcciones/route.ts`. |
| FR-002 | Se crea `CorreccionAdmin` con categorías original/corregida y `adminId`. | ✅ | Código existente. |
| FR-003 | Se actualiza `ClasificacionIA.categoria` y `confianza = 1.0`. | ✅ | Código existente. |
| FR-004 | Se registra `TransicionReporte` con `responsableTipo = OPERADOR`. | ✅ | `registrarTransicion` con `responsableTipoFromRol(user.rol)`. |
| FR-005 | Se actualiza `Reporte.estado` a `CORREGIDO`. | ✅ | Código existente. |
| FR-006 | No se permiten correcciones duplicadas. | ✅ | Verificación `correccionExistente` en endpoint; test pasa. |
| FR-007 | No se permite corregir reportes dados de baja. | ✅ | Verificación `reporte.eliminado` en endpoint; test pasa. |
| FR-008 | `AdminReporteDetalle` muestra botón de corrección solo en estados corregibles. | ✅ | Tests de componente pasan. |
| FR-009 | Flujo documentado en `quickstart.md` y validado con tests. | ✅ | `quickstart.md` actualizado; tests de backend y UI pasan. |
| FR-010 | No hay cambios en el modelo de datos de Prisma. | ✅ | Sin migraciones. |

## Success Criteria

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| SC-001 | Tests de `/api/admin/correcciones` verifican estado `CORREGIDO`, transición `OPERADOR` y corrección. | ✅ | 9 tests en `route.test.ts`, todos pasan. |
| SC-002 | Test de `AdminReporteDetalle` verifica botón de corrección. | ✅ | 3 tests en `AdminReporteDetalle.test.tsx`, todos pasan. |
| SC-003 | `quickstart.md` describe flujo end-to-end reproducible. | ✅ | Artefacto creado. |
| SC-004 | `tsc`, `lint`, `test` pasan sin errores nuevos. | ✅ | `tsc` OK; `lint` OK (1 warning heredado); `test` 428/428 OK. |

## Validation Log

- `npm run test`: 80 suites, 428 tests, todos pasan.
- `npx tsc --noEmit`: OK.
- `npm run lint`: OK (1 warning heredado de `GestionPageClient.tsx`).
- `rm -rf .next && npm run build`: OK.
- `./scripts/dev-restart.sh`: OK, healthcheck OK, un solo worker.

## Sign-off

Spec 042 implementado y validado. Pendiente de aprobación del plan ya no aplica; cierre completado.
