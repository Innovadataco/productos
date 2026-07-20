# Feature Specification: Operador corrige la clasificación

**Feature Branch**: `[042-operador-corrije-clasificacion]`

**Created**: 2026-07-20

**Status**: PLANEADO (espera aprobación)

**Input**: El operador necesita poder recategorizar la clasificación de la IA cuando no coincide con la realidad. El flujo debe quedar registrado en `TransicionReporte` con responsable `OPERADOR` y el reporte debe terminar en estado `CORREGIDO`. La investigación previa indica que el endpoint y la UI ya existen, pero faltan tests de flujo y documentación.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Verificar corrección por operador y estado CORREGIDO (Priority: P1)

El operador, al revisar un caso asignado, puede cambiar la categoría asignada por la IA. El sistema debe persistir la corrección, registrar la transición con responsable `OPERADOR` y dejar el reporte en `CORREGIDO`.

**Why this priority**: Es el objetivo central del spec. Si la corrección no persiste o no cambia el estado, el flujo de resolución del operador queda roto.

**Independent Test**: Test unitario del endpoint `/api/admin/correcciones` que verifique: estado final `CORREGIDO`, transición creada con `responsableTipo = OPERADOR`, `CorreccionAdmin` creada con categorías original/corregida.

**Acceptance Scenarios**:

1. **Given** un reporte en `REVISION_MANUAL` asignado a un operador, **When** el operador envía una corrección de categoría, **Then** el reporte pasa a `CORREGIDO`, se crea `TransicionReporte` con `responsableTipo = OPERADOR` y se crea `CorreccionAdmin`.
2. **Given** un reporte en `CLASIFICADO` asignado a un operador, **When** el operador corrige la categoría, **Then** el reporte pasa a `CORREGIDO` y se registra la corrección.
3. **Given** un operador que no tiene el caso asignado, **When** intenta corregir, **Then** recibe 403.
4. **Given** un reporte que ya tiene una corrección, **When** el operador intenta corregir de nuevo, **Then** recibe 409 y no se modifica la corrección anterior.

### User Story 2 — UI del operador habilita la corrección (Priority: P1)

El componente `AdminReporteDetalle` debe mostrar la acción de "Corregir clasificación" al operador cuando el caso tiene clasificación y aún no ha sido corregido.

**Why this priority**: El operador necesita descubrir la acción sin rediseñar la vista. El componente ya tiene el botón; se debe verificar que se muestra en los estados correctos.

**Independent Test**: Test del componente `AdminReporteDetalle` que renderice un reporte asignado en `REVISION_MANUAL` y verifique que existe el select de categoría y el botón "Corregir clasificación".

**Acceptance Scenarios**:

1. **Given** un reporte en `REVISION_MANUAL` con clasificación, **When** el operador abre el detalle, **Then** ve el select de categoría y el botón "Corregir clasificación".
2. **Given** un reporte en `CORREGIDO`, **When** el operador abre el detalle, **Then** no ve el botón de corrección (ya corregido).
3. **Given** un reporte sin clasificación, **When** el operador abre el detalle, **Then** no ve el botón de corrección.

### User Story 3 — Documentar y probar el flujo end-to-end (Priority: P2)

Crear quickstart.md con pasos para reproducir: crear reporte, asignar a operador, operador corrige, verificar estado CORREGIDO, transición y dataset.

**Why this priority**: La documentación asegura que el flujo sea reproducible por QA y por el equipo de operaciones.

**Acceptance Scenarios**:

1. **Given** el quickstart.md, **When** se siguen los pasos, **Then** el reporte queda en `CORREGIDO` y se visualiza en la bandeja con el estado correspondiente.
2. **Given** un reporte corregido, **When** se consulta `/api/admin/reportes/${id}/transiciones`, **Then** aparece la transición con responsable `OPERADOR` y estado nuevo `CORREGIDO`.

---

## Edge Cases

- **US1**: Operador intenta corregir un reporte dado de baja → debe recibir 409.
- **US1**: El endpoint recibe una categoría inválida → 400 con código de error de validación.
- **US1**: Falla anonimización/embedding → el reporte igual debe quedar en `CORREGIDO` y el dataset se encola para backfill (comportamiento actual).
- **US2**: Reporte corregido por admin → el operador ve la corrección reflejada en el detalle.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El endpoint `POST /api/admin/correcciones` DEBE permitir al rol `OPERADOR` corregir la categoría de un reporte asignado a él.
- **FR-002**: El endpoint DEBE crear un registro en `CorreccionAdmin` con `categoriaOriginal`, `categoriaCorregida`, `adminId` (operador) y `motivo` opcional.
- **FR-003**: El endpoint DEBE actualizar `ClasificacionIA.categoria` y poner `confianza = 1.0`.
- **FR-004**: El endpoint DEBE registrar una `TransicionReporte` con `responsableTipo = OPERADOR` cuando el usuario es operador.
- **FR-005**: El endpoint DEBE actualizar `Reporte.estado` a `CORREGIDO`.
- **FR-006**: El endpoint NO DEBE permitir correcciones duplicadas (409 si ya existe `CorreccionAdmin` para la clasificación).
- **FR-007**: El endpoint NO DEBE permitir corregir un reporte dado de baja.
- **FR-008**: `AdminReporteDetalle` DEBE mostrar el botón de corrección solo cuando el reporte tenga clasificación, no esté en `CORREGIDO` y no tenga corrección previa.
- **FR-009**: El flujo completo DEBE estar documentado en `quickstart.md` y validado con tests.
- **FR-010**: No se requieren cambios en el modelo de datos de Prisma.

### Key Entities

- **Reporte**: modelo central; estado objetivo `CORREGIDO`.
- **ClasificacionIA**: contiene `categoria` original y `correccion` (relación 1:1 con `CorreccionAdmin`).
- **CorreccionAdmin**: registro histórico de corrección.
- **TransicionReporte**: trazabilidad del cambio de estado con `responsableTipo`.
- **DatasetEntrenamiento / EmbeddingDataset**: backfill de entrenamiento.
- **Endpoints**: `POST /api/admin/correcciones`, `GET /api/admin/reportes-revision/${id}`, `GET /api/admin/reportes/${id}/transiciones`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tests de `/api/admin/correcciones` verifican estado `CORREGIDO`, transición `OPERADOR` y corrección creada.
- **SC-002**: Test de `AdminReporteDetalle` verifica que el botón de corrección se muestra para un reporte corregible.
- **SC-003**: `quickstart.md` describe el flujo end-to-end y es reproducible.
- **SC-004**: `npx tsc --noEmit`, `npm run lint` y `npm run test` pasan sin errores introducidos.

---

## Assumptions

- El endpoint `/api/admin/correcciones` ya existe y cumple la lógica de negocio; el spec se enfoca en verificar, documentar y robustecer tests.
- No se requiere rediseño de UI.
- El rol OPERADOR es mutuamente excluyente con COMITE_VALIDACION (ya garantizado por validaciones existentes).
- El asignador de reportes (`lib/operadores/asignador.ts`) ya asigna reportes `REVISION_MANUAL` a operadores activos.

---

## Implementación

*Sección por completar tras la aprobación del plan y la implementación.*
