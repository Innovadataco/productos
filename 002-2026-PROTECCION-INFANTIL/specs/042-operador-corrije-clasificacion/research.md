# Research — Spec 042: Operador corrige la clasificación

## Hallazgos

### Flujo actual de resolución del operador

1. **Acceso**: El operador inicia sesión y entra a `/dashboard/admin` (layout `/dashboard/admin/layout.tsx` permite ADMIN, SCHOOL_ADMIN, OPERADOR y COMITE_VALIDACION). La página raíz muestra `AdminReportesTable`.
2. **Bandeja**: `AdminReportesTable` consume `/api/admin/reportes-revision`. El endpoint filtra para OPERADOR por `operadorId = user.id`.
3. **Detalle**: Al hacer clic en "Ver detalle", se abre `AdminReporteDetalle` con `reporteId`. El detalle se carga desde `/api/admin/reportes-revision/${reporteId}`.
4. **Acciones disponibles en el detalle**:
   - **Confirmar clasificación**: visible si `estado === REVISION_MANUAL`, hay clasificación y no hay corrección. Llama a `/api/admin/reportes-revision/${id}/confirmar`.
   - **Corregir clasificación**: visible si `estado !== CORREGIDO`, hay clasificación y no hay corrección. Llama a `/api/admin/correcciones`.
5. **Endpoint de corrección**: `/api/admin/correcciones` (POST):
   - Verifica autenticación y rol OPERADOR o admin.
   - Verifica `puedeGestionarReporte` (OPERADOR solo si `operadorId === user.id`).
   - Crea registro en `CorreccionAdmin` con `categoriaOriginal` y `categoriaCorregida`.
   - Actualiza `ClasificacionIA.categoria` y `confianza = 1.0`.
   - Registra transición `estadoAnterior → CORREGIDO` con `responsableTipo` obtenido vía `responsableTipoFromRol(user.rol)` (OPERADOR para rol OPERADOR).
   - Actualiza `Reporte.estado = CORREGIDO`.
   - Crea entrada en `DatasetEntrenamiento` y genera embedding.
   - Escribe auditoría `CASO_CORREGIDO`.

### Estado actual vs. requisito del spec

| Requisito | Estado actual | Observación |
|-----------|---------------|-------------|
| Operador puede recategorizar la clasificación de la IA | ✅ | Botón y endpoint existen. |
| Registra corrección en `TransicionReporte` con responsable OPERADOR | ✅ | `registrarTransicion` usa `responsableTipoFromRol(user.rol)`. |
| Deja el reporte en `CORREGIDO` | ✅ | `Reporte.estado` se actualiza a CORREGIDO. |
| No permite corregir si ya fue corregido | ✅ | `puedeCorregir` y el endpoint verifican `correccionExistente`. |
| Permite corregir estando en CLASIFICADO | ✅ | `puedeCorregir` no requiere REVISION_MANUAL. |

### Gaps identificados

1. **Tests de flujo**: los tests existentes de `/api/admin/correcciones` cubren anonimización, dataset y embedding, pero no verifican:
   - Estado final del reporte (`CORREGIDO`).
   - Transición registrada con `responsableTipo = OPERADOR`.
   - Permiso de OPERADOR vs. otro operador no asignado.
   - Comportamiento cuando el reporte ya tiene corrección.
2. **Quickstart**: no existe una guía paso a paso para probar que un operador corrige una clasificación y que el resultado se refleja en la bandeja y el dataset.
3. **Documentación del flujo**: no hay un artefacto Spec-Kit que describa el flujo de corrección del operador como feature aislada.

### Riesgos

- El endpoint permite corregir un reporte en cualquier estado distinto de `CORREGIDO` (ej. `CLASIFICADO`). Esto es intencional según el diseño actual, pero debe quedar documentado.
- Si el operador corregir un reporte `CLASIFICADO`, la transición será `CLASIFICADO → CORREGIDO`, lo cual es válido.
- El cambio de estado a `CORREGIDO` no dispara `actualizarVisibilidadPublica` ni `recalcularYGuardarScore` (a diferencia de la confirmación). Esto puede ser un gap si se espera que un caso corregido se muestre públicamente.

### Referencias

- `src/components/modules/AdminReporteDetalle.tsx`
- `src/components/modules/AdminReportesTable.tsx`
- `src/app/api/admin/correcciones/route.ts`
- `src/app/api/admin/correcciones/route.test.ts`
- `src/app/api/admin/reportes-revision/[id]/confirmar/route.ts`
- `src/app/api/admin/reportes-revision/[id]/route.ts`
- `src/app/api/admin/reportes-revision/route.ts`
- `src/lib/reporte-transiciones.ts`
- `src/lib/operadores/permisos.ts`
- `prisma/schema.prisma` (enum `EstadoReporte`, modelos `Reporte`, `ClasificacionIA`, `CorreccionAdmin`, `TransicionReporte`, `DatasetEntrenamiento`, `EmbeddingDataset`)
