# Feature Specification: Panel de Logs + Mantenimiento + Reasignar Operador

**Feature Branch**: `work/002-pi-087`  
**Created**: 2026-08-21  
**Status**: `PLANEADO`  
**Input**: BRIEF vinculante SPEC-193 (002-PI-087).

---

## Contexto y motivación

En producción conviven cuatro procesos (`pi-app`, `pi-worker`, `pi-monitor`, `pi-simulador-abuso`) que hoy solo escriben trazas a `stdout`. Cuando algo falla, el equipo de operaciones debe ingresar al servidor para leer los logs; el administrador de la plataforma no tiene visibilidad desde la interfaz. Al mismo tiempo, el botón "Reasignar" agregado en SPEC-189 (I-73) no tiene endpoint ni flujo asociado, por lo que es un callejón sin salida.

Esta feature resuelve ambos problemas: centraliza los logs de workers en una tabla consultable por ADMIN, expone una UI de monitoreo con filtros y autorefresco, permite ejecutar purga manual de logs antiguos con trazabilidad de auditoría, y cierra el flujo de reasignación de casos entre operadores.

**Impacto en arquitectura**: se agrega una nueva entidad de infraestructura (`WorkerLog`) y un helper de logging (`workerLogger`) que escribe siempre a `stdout` y opcionalmente a PostgreSQL; se añaden dos rutas administrativas bajo `/api/admin/monitoreo/logs` y `/api/admin/operadores/reasignar`; se instrumentan los cuatro workers existentes; no se modifican modelos de negocio (`Reporte` solo recibe una actualización de `operadorId`, sin nuevos campos; `Usuario` no cambia).

---

## User Stories & Testing *(mandatory)*

### User Story 1 — El ADMIN diagnostica logs de workers desde la UI (Priority: P1)

Como administrador de la plataforma quiero ver los logs emitidos por los cuatro servicios (`pi-app`, `pi-worker`, `pi-monitor`, `pi-simulador-abuso`) desde el panel de operación, para diagnosticar incidentes sin necesidad de acceso al servidor.

**Why this priority**: Es el corazón del BRIEF. Hoy la única fuente de verdad es `stdout`, lo que ralentiza la respuesta ante incidentes y depende de acceso SSH.

**Independent Test**: Un ADMIN puede abrir el sub-tab "Logs" en `/dashboard/admin/estadisticas/operacion`, aplicar filtros por servicio/nivel/rango de fechas/texto libre, ver los resultados paginados, abrir el contexto JSON de una fila y alternar el autorefresco cada 30 s.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con rol `ADMIN`, **When** accede a `GET /api/admin/monitoreo/logs` sin parámetros, **Then** el sistema retorna los últimos 100 logs de cualquier servicio y nivel, ordenados de más reciente a más antiguo, con el total de registros coincidentes.
2. **Given** un usuario autenticado con rol `ADMIN`, **When** filtra por `servicio=pi-worker&nivel=ERROR`, **Then** el sistema retorna solo logs de ese servicio con nivel `ERROR` o superior.
3. **Given** un usuario autenticado con rol `ADMIN`, **When** consulta logs con `desde` y `hasta`, **Then** el sistema respeta el rango (inclusive en fecha/hora) y rechaza rangos invertidos o futuros.
4. **Given** un usuario autenticado con rol `ADMIN`, **When** aplica `q=timeout`, **Then** el sistema retorna solo filas cuyo mensaje contenga la subcadena (case-insensitive).
5. **Given** un usuario autenticado con rol `ADMIN`, **When** usa `limit=500&offset=200`, **Then** el sistema retorna hasta 500 filas y un `total` que permite paginar.
6. **Given** un usuario con rol distinto a `ADMIN`, **When** intenta `GET /api/admin/monitoreo/logs`, **Then** el sistema deniega el acceso y registra el intento en `AuditLog`.

---

### User Story 2 — El ADMIN configura el sink de logs (Priority: P1)

Como administrador de la plataforma quiero habilitar/deshabilitar el volcado de logs a base de datos y ajustar el nivel mínimo, para balancear diagnóstico contra volumen de escrituras.

**Why this priority**: Sin configuración, el comportamiento del helper `workerLogger` no es predecible ni ajustable por entorno (por ejemplo, en desarrollo se prefiere menos ruido; en producción, más trazabilidad).

**Independent Test**: Un ADMIN puede navegar a `/dashboard/admin/configuracion`, abrir la sección "Monitoreo → Logs", cambiar `monitoreo.logs.enabled` y `monitoreo.logs.nivel_minimo`, guardar y ver reflejado el cambio en los workers sin reiniciar.

**Acceptance Scenarios**:

1. **Given** `monitoreo.logs.enabled=true` y `monitoreo.logs.nivel_minimo=WARN`, **When** un worker emite un log `INFO`, **Then** el mensaje aparece en `stdout` pero no se persiste en `WorkerLog`.
2. **Given** `monitoreo.logs.enabled=false`, **When** un worker emite un log `ERROR`, **Then** el mensaje aparece en `stdout` y no se intenta escritura en base de datos.
3. **Given** un usuario con rol `ADMIN`, **When** modifica cualquiera de los tres parámetros de monitoreo, **Then** el sistema persiste el cambio y genera `AuditLog` con valor anterior y nuevo.
4. **Given** un usuario sin rol `ADMIN`, **When** intenta acceder a la sección o llamar a la API de configuración, **Then** el sistema deniega la operación.

---

### User Story 3 — El ADMIN ejecuta mantenimiento manual de logs antiguos (Priority: P2)

Como administrador de la plataforma quiero borrar logs de workers anteriores a una fecha límite, indicando el motivo, para cumplir políticas internas de retención y mantener el tamaño de la base bajo control.

**Why this priority**: No existe requisito legal ni de negocio de purga automática (decisión CEO), pero se necesita una herramienta manual segura con trazabilidad de auditoría para ejecutar limpiezas puntuales.

**Independent Test**: Un ADMIN puede ir a `/dashboard/admin/configuracion`, sección "Mantenimiento", seleccionar un rango de fechas con límite máximo "ayer", opcionalmente filtrar por servicio/nivel, ingresar un motivo de al menos 20 caracteres, obtener una cuenta previa, confirmar y verificar que los logs fueron eliminados y que existe un `AuditLog` de la acción.

**Acceptance Scenarios**:

1. **Given** un usuario `ADMIN`, **When** solicita borrar logs con `hasta` igual a hoy, **Then** el sistema rechaza la petición porque la fecha límite debe ser anterior al día actual.
2. **Given** un usuario `ADMIN`, **When** ingresa un motivo de menos de 20 caracteres, **Then** el sistema rechaza la petición con error de validación.
3. **Given** un usuario `ADMIN`, **When** confirma el borrado de 1.240 logs, **Then** el sistema elimina exactamente esas filas e inserta un `AuditLog` con `accion='LOGS_MANTENIMIENTO_PURGA'` y metadata `{filtros, motivo, filas_borradas, ejecutado_por}`.
4. **Given** un usuario sin rol `ADMIN`, **When** intenta borrar logs, **Then** el sistema deniega la acción y no realiza ningún `DELETE`.
5. **Given** un usuario `ADMIN`, **When** aplica filtros de servicio y/o nivel antes de borrar, **Then** la purga afecta solo a los logs que coincidan con todos los criterios.

---

### User Story 4 — El ADMIN reasigna un reporte a otro operador (Priority: P1)

Como administrador de la plataforma quiero mover un caso de un operador a otro, indicando el motivo, para corregir asignaciones erróneas o balancear carga sin perder la trazabilidad.

**Why this priority**: Cierra el dead-end I-73 dejado por SPEC-189. El botón "Reasignar" ya existe en la ficha y en el listado, pero no tenía endpoint ni persistencia.

**Independent Test**: Un ADMIN puede abrir el modal `ReasignarModal` desde la ficha de un operador o desde el listado de casos, seleccionar un operador destino activo con rol `OPERADOR`, ingresar un motivo de 20 a 500 caracteres, confirmar y ver reflejado el nuevo `operadorId` en el reporte junto con una nueva entrada en el timeline.

**Acceptance Scenarios**:

1. **Given** un reporte en estado `REVISION_MANUAL` con un operador asignado, **When** un `ADMIN` reasigna el caso a otro `OPERADOR` activo, **Then** el sistema actualiza `Reporte.operadorId`, inserta una entrada en `TransicionReporte` (o su equivalente timeline) con tipo `REPORTE_REASIGNADO_MANUAL` y genera un `AuditLog` con `REPORTE_REASIGNADO_MANUAL`.
2. **Given** un reporte en estado `PROCESADO` con operador asignado, **When** un `ADMIN` reasigna el caso, **Then** el sistema acepta la operación y registra la trazabilidad.
3. **Given** un reporte en estado `PENDIENTE` (sin operador asignado), **When** un `ADMIN` intenta reasignar, **Then** el sistema rechaza la operación con error de validación.
4. **Given** un reporte en `REVISION_MANUAL`, **When** el operador destino está inactivo o no tiene rol `OPERADOR`, **Then** el sistema rechaza la operación.
5. **Given** un usuario sin rol `ADMIN`, **When** intenta llamar `PATCH /api/admin/operadores/reasignar`, **Then** el sistema deniega el acceso.
6. **Given** un `ADMIN` que reasigna un caso, **When** deja el motivo vacío o con menos de 20 caracteres, **Then** el sistema rechaza la petición.

---

## Edge Cases

- **BD de logs no disponible**: `workerLogger` debe seguir escribiendo a `stdout` sin bloquear el worker ni lanzar excepción no controlada. El error se registra en `stdout`, no en `WorkerLog`.
- **Nivel desconocido en config**: si `monitoreo.logs.nivel_minimo` contiene un valor inválido, el helper usa `WARN` como fallback y emite una advertencia en `stdout`.
- **Rango de fechas invertido**: `desde` posterior a `hasta` en `GET /api/admin/monitoreo/logs` retorna `400` con mensaje claro.
- **`hasta` igual a hoy en purga**: rechazo inmediato; la fecha límite debe ser como máximo ayer para evitar borrar logs del día en curso.
- **Purga con filtros que no coinciden con ninguna fila**: la operación es idempotente, no falla; el `AuditLog` registra `filas_borradas=0`.
- **Reasignar al mismo operador**: se rechaza porque no hay cambio real.
- **Reporte con `operadorId=null`**: aunque el estado sea `REVISION_MANUAL` o `PROCESADO`, se rechaza si no hay operador asignado.
- **Operador destino es el admin mismo u otro rol**: se valida estrictamente que el usuario destino tenga rol `OPERADOR` y estado activo.
- **Reasignación concurrente**: si dos admins reasignan el mismo reporte simultáneamente, el segundo update debe detectar la inconsistencia (validación previa del operador actual) y retornar `409`.
- **Mensaje de log con PII**: `workerLogger` debe recibir `contextoJson` estructurado; el mensaje principal no debe incluir datos personales, textos de reportes ni identificadores sensibles.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE crear la tabla `WorkerLog` con los campos `id`, `servicio`, `nivel`, `mensaje`, `contextoJson` y `creadoEn`, e índices `(servicio, creadoEn DESC)` y `(nivel, creadoEn DESC)`.
- **FR-002**: El sistema DEBE implementar el helper `workerLogger` en `src/lib/monitoreo/worker-logger.ts` con métodos `debug`, `info`, `warn`, `error`, y soporte para `.child({ servicio: '...' })`.
- **FR-003**: El helper `workerLogger` DEBE escribir siempre a `stdout` en el formato `[Módulo] Acción: resultado — detalle`.
- **FR-004**: El helper `workerLogger` DEBE persistir en `WorkerLog` solo si `monitoreo.logs.enabled=true` y el nivel del mensaje es mayor o igual a `monitoreo.logs.nivel_minimo` (default `WARN`).
- **FR-005**: El helper `workerLogger` NO DEBE bloquear el worker ni propagar errores si la escritura a base de datos falla; DEBE registrar el fallo en `stdout`.
- **FR-006**: El sistema DEBE sembrar en `prisma/seed.ts` (sección `monitoreoNuevos`) los parámetros `monitoreo.logs.enabled`, `monitoreo.logs.nivel_minimo` y `monitoreo.logs.max_muestras_ui` con sus valores por defecto.
- **FR-007**: El sistema DEBE exponer `GET /api/admin/monitoreo/logs` restringido a rol `ADMIN` y con rate-limit `admin_read`.
- **FR-008**: El endpoint `GET /api/admin/monitoreo/logs` DEBE aceptar query params `servicio`, `nivel`, `desde`, `hasta`, `q`, `limit` (1-500, default 100) y `offset` (mínimo 0), y DEBE retornar `{ items, total }`.
- **FR-009**: El endpoint `GET /api/admin/monitoreo/logs` DEBE ordenar los resultados por `creadoEn DESC`.
- **FR-010**: El sistema DEBE agregar un sub-tab "Logs" en `/dashboard/admin/estadisticas/operacion` con filtros, tabla paginada, modal de contexto JSON, paginación Next/Prev de 100 en 100, autorefresco 30 s toggle y colores por nivel usando tokens de diseño.
- **FR-011**: El sistema DEBE agregar la sección "Monitoreo → Logs" en `/dashboard/admin/configuracion` para editar los parámetros `monitoreo.logs.enabled`, `monitoreo.logs.nivel_minimo` y `monitoreo.logs.max_muestras_ui`.
- **FR-012**: El sistema DEBE instrumentar los cuatro workers (`pi-app`, `pi-worker`, `pi-monitor`, `pi-simulador-abuso`) con `workerLogger.child({ servicio: '...' })` en su bootstrap y en los puntos mínimos de logging definidos en el BRIEF.
- **FR-013**: El sistema DEBE agregar la sección "Mantenimiento" en `/dashboard/admin/configuracion` con formulario "Borrar logs de workers".
- **FR-014**: El formulario de purga DEBE exigir un rango de fechas con `hasta` anterior al día actual, filtros opcionales por servicio/nivel, y un motivo obligatorio de 20 a 500 caracteres.
- **FR-015**: El formulario de purga DEBE mostrar una cuenta previa de filas afectadas antes de la confirmación.
- **FR-016**: El sistema DEBE exponer `DELETE /api/admin/monitoreo/logs` restringido a `ADMIN`, con rate-limit `admin_write`, que ejecute la purga y retorne las filas borradas.
- **FR-017**: Tras una purga, el sistema DEBE insertar un `AuditLog` con `accion='LOGS_MANTENIMIENTO_PURGA'` y `metadataJson` que incluya `{filtros, motivo, filas_borradas, ejecutado_por}`.
- **FR-018**: El sistema DEBE exponer `PATCH /api/admin/operadores/reasignar` restringido a `ADMIN` y con rate-limit `admin_write`.
- **FR-019**: El endpoint `PATCH /api/admin/operadores/reasignar` DEBE recibir `{ reporteId, operadorDestinoId, motivo }`, validar que el operador destino sea un `Usuario` activo con rol `OPERADOR`, y que el reporte esté en `REVISION_MANUAL` o `PROCESADO` con `operadorId` no nulo.
- **FR-020**: El endpoint `PATCH /api/admin/operadores/reasignar` DEBE actualizar `Reporte.operadorId`, insertar una entrada en la tabla de timeline con tipo `REPORTE_REASIGNADO_MANUAL` y metadata `{operador_anterior, operador_nuevo, motivo, admin_id}`, y generar un `AuditLog` con `accion='REPORTE_REASIGNADO_MANUAL'`.
- **FR-021**: El sistema DEBE implementar el componente `ReasignarModal` reusable desde la ficha del operador y desde el listado de casos.
- **FR-022**: El sistema DEBE rechazar cualquier intento de acceder a `WorkerLog` por usuarios que no tengan rol `ADMIN`.
- **FR-023**: El sistema NO DEBE modificar la estructura de `Reporte` ni de `Usuario` más allá de la actualización puntual de `Reporte.operadorId`.
- **FR-024**: El sistema NO DEBE tocar el código de `src/lib/ai/**`.

### Key Entities

- **WorkerLog**: Entidad de infraestructura. Atributos: identificador CUID, nombre del servicio, nivel (`DEBUG`, `INFO`, `WARN`, `ERROR`), mensaje corto, contexto estructurado JSON, timestamp de creación.
- **ParametroSistema** (existente): clave-valor tipado. Se agregan tres claves nuevas bajo categoría `SYSTEM` para controlar el sink de logs.
- **Reporte** (existente): sufre únicamente `UPDATE` de `operadorId`; no se agregan campos.
- **TransicionReporte** (existente): recibe una nueva entrada conceptual de tipo `REPORTE_REASIGNADO_MANUAL` con metadatos de reasignación.
- **AuditLog** (existente): recibe acciones `LOGS_MANTENIMIENTO_PURGA` y `REPORTE_REASIGNADO_MANUAL`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un `ADMIN` puede consultar logs de workers a través de la UI con latencia inferior a 1 s para 100 registros en condiciones normales.
- **SC-002**: El helper `workerLogger` persiste en base de datos menos del 5 % de los mensajes cuando `nivel_minimo=WARN` y el tráfico es mayoritariamente `INFO`.
- **SC-003**: El 100 % de los errores de escritura a `WorkerLog` son absorbidos sin interrumpir el worker y quedan visibles en `stdout`.
- **SC-004**: El 100 % de las purgas de logs generan un `AuditLog` inmutable con motivo, filtros y cantidad de filas borradas.
- **SC-005**: El 100 % de las reasignaciones exitosas generan traza en timeline y `AuditLog`, y rechazan operadores destino inválidos.
- **SC-006**: Todos los endpoints nuevos (`GET`, `DELETE /api/admin/monitoreo/logs`, `PATCH /api/admin/operadores/reasignar`) retornan `403` para usuarios no `ADMIN`.
- **SC-007**: La migración de `WorkerLog` es aditiva y no destruye datos existentes.
- **SC-008**: Los cuatro workers emiten al menos un log en cada punto mínimo definido en el BRIEF al arrancar y al procesar un trabajo representativo.

---

## Assumptions

- Los cuatro workers ya existen y escriben a `stdout`; se les agrega el helper sin cambiar su lógica de negocio.
- El rol `ADMIN` es el único autorizado a consultar logs, purgar logs y reasignar operadores.
- No existe obligación legal ni de negocio de purga automática; la limpieza es manual bajo responsabilidad del CEO/decisión documentada.
- `monitoreo.logs.nivel_minimo` default `WARN` es suficiente para producción sin saturar la base.
- El modelo de timeline de reportes ya existe (`TransicionReporte`) y se usa para registrar la reasignación; no se crea una tabla nueva.
- `Reporte.operadorId` es la única fuente de verdad de la asignación actual; no hay caché de asignación que invalidar.
- Los workers pueden leer los parámetros de `ParametroSistema` al iniciar o a través de un helper de configuración ya existente.
- No se procesan imágenes, videos, audios ni otro multimedia en logs: los mensajes son texto plano + contexto JSON.

---

## Implementación *(se completará en fase de implementación)*

Esta sección se llenará al cerrar la feature con:

- Hash del commit de cierre.
- Endpoints y componentes afectados.
- Tests agregados.
- Migraciones relevantes.
- Deuda técnica identificada.

---

## Deuda técnica

- **Purga automática**: La decisión actual es manual; en el futuro podría agregarse una política de retención programada con parámetro `monitoreo.logs.retencion_dias`, siempre que se mantenga `AuditLog` por cada ejecución.
- **Agregaciones/alertas**: Ahora los logs son consulta directa. Podría agregarse un job periódico que cuente errores por servicio y abra incidentes automáticamente.
- **Expiración de contexto JSON**: El campo es ilimitado en tamaño en BD; se recomienda validar máximo de profundidad/cantidad de claves en `workerLogger` para evitar ingestas abusivas.
- **Reasignación masiva**: El modal actual es unitario. Si el volumen de reasignaciones crece, se necesitará un endpoint batch con validaciones idénticas.
