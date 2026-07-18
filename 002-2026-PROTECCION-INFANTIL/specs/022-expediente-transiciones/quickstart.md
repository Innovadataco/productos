> # Quickstart — Expediente interno de transiciones

## Escenario A: Reporte procesado automáticamente por el worker

**Prerrequisitos**: Reporte creado en estado `PENDIENTE`; worker corriendo.

1. Crear un reporte anónimo vía `POST /api/reportes`.
2. Esperar a que el worker lo procese (`PENDIENTE` → `PROCESANDO` → `CLASIFICADO`).
3. Como admin, llamar `GET /api/admin/reportes/[id]/transiciones`.

**Validación**: La respuesta contiene al menos 3 transiciones:
- `PENDIENTE` → `PROCESANDO` con `responsableTipo: WORKER`
- `PROCESANDO` → `CLASIFICADO` con `responsableTipo: IA`

**Esperado**: `200` con array ordenado cronológicamente.

---

## Escenario B: Operador corrige un reporte

**Prerrequisitos**: Reporte en estado `REVISION_MANUAL` asignado a un operador.

1. Operador abre el detalle del caso.
2. Operador selecciona nueva categoría y confirma.
3. Sistema registra transición `REVISION_MANUAL` → `CORREGIDO` con `responsableTipo: OPERADOR` y `responsableId` del operador.
4. Admin consulta `GET /api/admin/reportes/[id]/transiciones`.

**Validación**: Última transición muestra `estadoNuevo: CORREGIDO`, `responsableTipo: OPERADOR`, `motivo` no vacío.

**Esperado**: `200`; el responsable es identificable.

---

## Escenario C: Escalamiento a comité (Spec 024)

**Prerrequisitos**: Reporte en `REVISION_MANUAL`; operador logueado.

1. Operador escala el caso al comité.
2. Sistema registra `REVISION_MANUAL` → `REVISION_MANUAL` con `responsableTipo: OPERADOR` y `motivo: "Escalamiento a comité"`.
3. Comité resuelve el caso → `CORREGIDO` con `responsableTipo: COMITE`.

**Validación**: Timeline muestra ambas transiciones con tipos distintos.

**Esperado**: `200`; se distingue operador de comité.

---

## Escenario D: Transición por sistema (duplicado detectado)

**Prerrequisitos**: Existe un reporte previo para el mismo identificador.

1. Crear segundo reporte para el mismo identificador.
2. Sistema detecta duplicado y registra `PENDIENTE` → `DUPLICADO` con `responsableTipo: SISTEMA`.
3. Consultar timeline.

**Validación**: Transición presente sin `responsableId`.

**Esperado**: `200`; `responsableTipo` = `SISTEMA`.

---

## Escenario E: Filtrar transiciones por tipo de responsable

**Prerrequisitos**: Reporte con transiciones de IA, WORKER y OPERADOR.

1. Llamar `GET /api/admin/reportes/[id]/transiciones?responsableTipo=OPERADOR`.

**Validación**: Solo se devuelven transiciones del operador.

**Esperado**: `200`; array filtrado correctamente.

---

## Escenario F: No se permite modificar ni borrar transiciones

**Prerrequisitos**: Transición existente.

1. Intentar `DELETE /api/admin/reportes/[id]/transiciones/[transicionId]` (endpoint no existe).
2. Intentar `PATCH` sobre una transición (endpoint no existe).

**Validación**: Ambos retornan `404` o `405`.

**Esperado**: La tabla es append-only.
