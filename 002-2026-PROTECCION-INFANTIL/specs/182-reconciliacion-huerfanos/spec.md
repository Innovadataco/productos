# Feature Specification: SPEC-182 — Reconciliación de reportes huérfanos (I-60)

**Feature Branch**: `work/002-pi-077`

**Created**: 2026-08-19

**Status**: PLANEADO

**Input**: Instructivo 002-PI-077 (I-60). Contexto: en producción existen 26 reportes con `estado='REVISION_MANUAL'`, `operadorId=NULL` y `tenantId=NULL` (fechas feb→jul 2026, el más reciente hace 3 semanas). Los logs no muestran errores de asignación recientes, por lo que los 26 son legacy, no un bug activo.

**Causa arquitectónica verificada en fuente**: `src/lib/dal/services/reporte-processing/finalizacion.ts:88-91` invoca `asignarOperadorAReporte(reporteId).catch(console.error)` en modo fire-and-forget cuando el estado final es `REVISION_MANUAL` o `POSIBLE_SPAM`. Si el asignador falla en ese instante (operadores al cupo, transitorio de BD, etc.), el reporte queda sin operador y nadie reintenta.

**Nota sobre cola existente**: el worker actual ya tiene una cola `reportes-reconciliacion` (SPEC-137, E-5) que re-encola reportes `PENDIENTE` sin job. Esa cola NO resuelve operadores huérfanos; SPEC-182 crea una cola/work separado para asignación de operadores.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Worker reasigna operadores a huérfanos periódicamente (Priority: P1)

Como plataforma quiero que los reportes en revisión manual sin operador sean reintentados automáticamente, para que no queden atascados en la bandeja invisible.

**Why this priority**: bug arquitectónico que genera reportes huérfanos; sin reintento, la carga de operadores nunca los ve.

**Independent Test**: crear un reporte `REVISION_MANUAL` con `operadorId=NULL`, ejecutar el job de reconciliación y verificar que recibe un operador activo.

**Acceptance Scenarios**:

1. **Given** el worker de reconciliación ejecutándose, **When** transcurre el intervalo configurado, **Then** busca reportes `WHERE estado='REVISION_MANUAL' AND operadorId IS NULL AND eliminado=false` e intenta asignar operador a cada uno.
2. **Given** un reporte huérfano con operadores disponibles, **When** corre el job, **Then** el reporte queda con `operadorId` no nulo y se registra `AuditLog` agregado.
3. **Given** un reporte huérfano pero todos los operadores al cupo máximo, **When** corre el job, **Then** el reporte sigue sin operador y el worker registra la razón (`todos los operadores activos están al cupo máximo`).
4. **Given** un reporte huérfano de un tenant sin operadores activos, **When** corre el job, **Then** registra la razón (`no hay operadores activos disponibles`) sin lanzar excepción no controlada.

---

### User Story 2 — Limpieza one-shot de los 26 huérfanos legacy (Priority: P1)

Como administrador quiero ejecutar un script puntual para limpiar los huérfanos acumulados antes de que el worker periódico los alcance, para reducir la deuda operativa inmediata.

**Why this priority**: los 26 reportes ya existen en prod; el script permite diagnosticar y resolver el lote actual en el próximo deploy.

**Independent Test**: ejecutar `scripts/reasignar-huerfanos-legacy.mjs` en un entorno con huérfanos de prueba y verificar que reasigna los asignables y reporta los no asignables.

**Acceptance Scenarios**:

1. **Given** una BD con reportes huérfanos, **When** se ejecuta el script one-shot, **Then** intenta asignar a cada uno y emite un resumen con `asignados`, `fallidos` y razón de cada fallo.
2. **Given** el script en producción, **When** termina, **Then** no deja transacciones abiertas ni duplica asignaciones (idempotente: un reporte con operador no se reasigna).

---

### User Story 3 — Observabilidad de la reconciliación (Priority: P2)

Como operador/admin quiero saber cuántos huérfanos se reasignaron por ciclo, para detectar picos o fallos persistentes.

**Why this priority**: sin métrica no se puede saber si la reconciliación está funcionando o si hay una nueva fuga.

**Independent Test**: verificar que cada ejecución del worker deja un log estructurado y un `AuditLog` agregado con el conteo.

**Acceptance Scenarios**:

1. **Given** un ciclo de reconciliación, **When** termina, **Then** escribe log `[RECONCILIACION-HUERFANOS] Ciclo: N encontrados, M asignados, F fallidos`.
2. **Given** un ciclo con al menos un reasignado, **When** termina, **Then** crea un `AuditLog` con `accion='RECONCILIACION_HUERFANOS'` y `valorNuevo` conteniendo el resumen agregado (sin texto de reportes).

---

### Edge Cases

- **Idempotencia**: un reporte que ya tiene `operadorId` no se toca; `asignarOperadorAReporte` ya devuelve `asignado:false` en ese caso.
- **Sin huérfanos**: el ciclo termina en orden de milisegundos y no genera ruido de log innecesario (solo log de inicio/término).
- **Fallo transitorio de un reporte**: el error se captura por reporte; los demás siguen procesándose. El job completo no falla por un solo caso.
- **Concurrencia**: con un solo worker activo (advisory lock), no hay condiciones de carrera entre instancias.
- **Parámetros dinámicos**: cambiar `operadores.reconciliacion_intervalo_min` o `operadores.reconciliacion_enabled` no requiere reiniciar el worker (se leen del parámetro en cada ciclo, o se usa schedule de pg-boss si se prefiere fijo).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBE existir una cola/job `operadores-reconciliacion-huerfanos` en `scripts/worker-reportes.mjs` (patrón `ensureQueue` + `boss.schedule` + `boss.work`). Al arrancar, el worker DEBE leer `operadores.reconciliacion_intervalo_min` y construir la expresión cron `*/X * * * *` (default 15 min); un restart aplica cambios del parámetro.
- **FR-002**: El worker DEBE buscar reportes `WHERE estado='REVISION_MANUAL' AND operadorId IS NULL AND eliminado=false` (sin límite arbitrario o con límite alto documentado).
- **FR-003**: Por cada huérfano DEBE llamar `asignarOperadorAReporte(reporteId)` y manejar su resultado; NO DEBE modificar la lógica interna del asignador.
- **FR-004**: El worker DEBE registrar en log el resumen del ciclo (`encontrados`, `asignados`, `fallidos`) y crear un `AuditLog` agregado cuando `asignados > 0`.
- **FR-005**: DEBE existir el parámetro `operadores.reconciliacion_intervalo_min` (default 15) y `operadores.reconciliacion_enabled` (default true), sembrado por migración/seed idempotente.
- **FR-006**: DEBE existir el script `scripts/reasignar-huerfanos-legacy.mjs` que ejecute la misma lógica de reconciliación una sola vez y emita resumen.
- **FR-007**: DEBE existir un test de integración que cree un reporte huérfano, ejecute la función de reconciliación y verifique que recibe operador.

### Key Entities

- **Reporte**: entidad principal; campos relevantes `estado`, `operadorId`, `tenantId`, `eliminado`.
- **AuditLog**: traza de la acción agregada (`RECONCILIACION_HUERFANOS`).
- **ParametroSistema**: `operadores.reconciliacion_intervalo_min`, `operadores.reconciliacion_enabled`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras el deploy, el worker reconcilia huérfanos cada 15 minutos sin intervención manual.
- **SC-002**: El script one-shot en prod reporta cuántos de los 26 legacy pudo asignar y por qué fallaron los demás.
- **SC-003**: El test de integración pasa y el gate local completo está verde.
- **SC-004**: CI del PR verde.

## Assumptions

- `asignarOperadorAReporte` sigue siendo la fuente única de asignación y no se modifica.
- El worker de reportes ya maneja advisory lock (una sola instancia activa), por lo que no se requiere mecanismo adicional de exclusión mutua.
- Los 26 reportes legacy con `tenantId=NULL` son asignables si existen operadores de plataforma (rol `OPERADOR`) o el asignador puede operar con tenant nulo; si no lo son, el script reportará la causa.
- La frecuencia de 15 minutos es suficiente para operación; el parámetro permite ajustarla sin redeploy.
