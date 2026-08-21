# Tareas — SPEC-193 (002-PI-087)

**Feature Branch**: `work/002-pi-087`  
**Plan**: [plan.md](plan.md)

Lista numerada `TNNN [P]` con archivo objetivo. Ordenadas por dependencias. Las tareas de tests (TDD) se intercalan junto al código que validan.

---

## Fase 1 — Modelo de datos y semilla

### T001 [P0] Migración aditiva `WorkerLog`
**Archivo**: `prisma/migrations/20260821xx_add_worker_log/migration.sql`

Crear migración con:
- `CREATE TYPE "NivelLog" AS ENUM ('DEBUG','INFO','WARN','ERROR')`.
- `CREATE TABLE "WorkerLog"` con `id`, `servicio`, `nivel`, `mensaje` (VARCHAR 500), `contextoJson` (JSONB), `creadoEn`.
- Índices `(servicio, creadoEn DESC)`, `(nivel, creadoEn DESC)` y `creadoEn`.
- `ALTER TYPE "AccionAudit" ADD VALUE 'LOGS_MANTENIMIENTO_PURGA'`.
- `ALTER TYPE "AccionAudit" ADD VALUE 'REPORTE_REASIGNADO_MANUAL'`.

**Criterio**: cero sentencias `DROP`; no toca `Reporte`, `Usuario` ni ningún modelo existente.

### T002 [P0] Actualizar `schema.prisma`
**Archivo**: `prisma/schema.prisma`

- Agregar `enum NivelLog`.
- Agregar `model WorkerLog` con los campos e índices definidos en `data-model.md`.
- Extender `enum AccionAudit` con `LOGS_MANTENIMIENTO_PURGA` y `REPORTE_REASIGNADO_MANUAL`.

**Depende de**: T001.

### T003 [P0] Sembrar parámetros de monitoreo
**Archivo**: `prisma/seed.ts`

En el bloque `monitoreoNuevos` agregar:
- `monitoreo.logs.enabled` (BOOLEAN, `true`).
- `monitoreo.logs.nivel_minimo` (STRING, `WARN`).
- `monitoreo.logs.max_muestras_ui` (INTEGER, `500`).

Usar `upsert` con `update: { valor, descripcion }` para aplicar defaults sin pisar valores operativos del CEO.

**Depende de**: T002.

### T004 [P0] Generar cliente Prisma
**Comando**: `npx prisma generate && npx prisma migrate dev --name add_worker_log`

Verificar que `@prisma/client` expone `WorkerLog`, `NivelLog` y los nuevos valores de `AccionAudit`.

**Depende de**: T002, T003.

---

## Fase 2 — Backend

### T005 [P0] Implementar helper `workerLogger`
**Archivo**: `src/lib/monitoreo/worker-logger.ts`

- API: `debug/info/warn/error(message, contextoJson?)` y `.child({ servicio })`.
- Siempre escribe a `stdout` usando `src/lib/logger.ts` en formato `[Módulo] Acción: resultado — detalle`.
- Lee `monitoreo.logs.enabled` y `monitoreo.logs.nivel_minimo` desde `ParametroSistema`.
- Persiste en `WorkerLog` solo si está habilitado y el nivel es `>=` mínimo.
- Captura errores de BD: log en `stdout`, no propaga excepción.
- Fallback a `WARN` si `nivel_minimo` es inválido.
- No escribe PII ni texto de reporte en `mensaje`.

**Cubre**: FR-002, FR-003, FR-004, FR-005, SC-003.

### T006 [P0] Tests unitarios de `workerLogger` (TDD)
**Archivo**: `src/lib/monitoreo/worker-logger.test.ts`

Casos mínimos:
- Persiste en BD cuando `enabled=true` y nivel `>=` mínimo.
- No persiste cuando nivel es menor.
- No persiste cuando `enabled=false`.
- No lanza si la escritura a BD falla.
- `.child()` hereda el servicio y permite override.
- Nivel inválido usa `WARN` como fallback.

**Depende de**: T004, T005.

### T007 [P0] Servicio de logs
**Archivo**: `src/lib/monitoreo/logs-service.ts`

Funciones:
- `listarLogs({ servicio?, nivel?, desde?, hasta?, q?, limit?, offset? })` → `{ items, total }`.
- `contarLogsParaPurgar({ hasta, servicio?, nivel? })` → `number`.
- `purgarLogs({ hasta, servicio?, nivel?, motivo, ejecutadoPorId })` → `{ filasBorradas }` + inserta `AuditLog`.

Validaciones:
- `limit` entre 1 y `min(500, max_muestras_ui)`.
- `offset >= 0`.
- `desde <= hasta`.
- `huta` anterior al día actual para purga.
- Motivo 20-500 caracteres.

**Cubre**: FR-007, FR-008, FR-009, FR-014, FR-015, FR-016, FR-017.

### T008 [P0] Endpoint `GET /api/admin/monitoreo/logs`
**Archivo**: `src/app/api/admin/monitoreo/logs/route.ts`

- `verifyAuth("ADMIN")` + `assertModulo` + `checkRateLimit(request, "admin_read")`.
- Parsear y validar query params con Zod.
- Llamar a `listarLogs`.
- Responder `{ items, total }`.
- Manejar `AppError` con `errorToResponse`.

**Cubre**: FR-007, FR-008, FR-009, FR-022, SC-006.

### T009 [P0] Tests de integración `GET /api/admin/monitoreo/logs` (TDD)
**Archivo**: `src/app/api/admin/monitoreo/logs/route.test.ts`

Casos mínimos:
- ADMIN sin filtros obtiene últimos 100 ordenados DESC.
- Filtrar por `servicio` y `nivel`.
- Rango de fechas inclusive; rango invertido retorna 400.
- Búsqueda `q` case-insensitive.
- `limit`/`offset` válidos e inválidos.
- No-ADMIN recibe 403 y genera `AuditLog`.

**Depende de**: T004, T007, T008.

### T010 [P0] Endpoint `DELETE /api/admin/monitoreo/logs`
**Archivo**: `src/app/api/admin/monitoreo/logs/route.ts`

- Mismo archivo que `GET`; implementar `DELETE`.
- Body Zod: `{ hasta, servicio?, nivel?, motivo }`.
- Rechazar `huta >= inicio del día actual`.
- Ejecutar purga a través del servicio.
- Insertar `AuditLog` con `LOGS_MANTENIMIENTO_PURGA`.
- Responder `{ filasBorradas }`.

**Cubre**: FR-016, FR-017.

### T011 [P0] Tests de integración `DELETE /api/admin/monitoreo/logs` (TDD)
**Archivo**: `src/app/api/admin/monitoreo/logs/route.test.ts`

Casos mínimos:
- Purga con `huta` ayer borra filas y genera `AuditLog`.
- Purga con filtros no coincidentes retorna `filasBorradas=0` y aun así genera `AuditLog`.
- `huta` igual a hoy retorna 400.
- Motivo corto retorna 400.
- No-ADMIN recibe 403 y no borra nada.

**Depende de**: T009, T010.

### T012 [P0] Servicio de reasignación
**Archivo**: `src/lib/operadores/reasignar-service.ts`

Función `reasignarReporte({ reporteId, operadorDestinoId, motivo, adminId })`:
- Leer reporte y validar: estado `REVISION_MANUAL`, `operadorId` no nulo.
- Validar operador destino: `rol=OPERADOR`, `estado=activo`, distinto al operador actual.
- Ejecutar transacción:
  1. `UPDATE Reporte SET operadorId = destino WHERE id = reporteId AND operadorId = actual`.
  2. Si `count == 0`, lanzar `AppError(CONFLICT, 409)`.
  3. `INSERT TransicionReporte` con `estadoAnterior == estadoNuevo`, `responsableTipo=ADMIN`, `motivo`, `metadatos`.
  4. `INSERT AuditLog` con `accion='REPORTE_REASIGNADO_MANUAL'`.

**Cubre**: FR-019, FR-020.

### T013 [P0] Endpoint `PATCH /api/admin/operadores/reasignar`
**Archivo**: `src/app/api/admin/operadores/reasignar/route.ts`

- `verifyAuth("ADMIN")` + `assertModulo` + `checkRateLimit(request, "admin_write")`.
- Body Zod: `{ reporteId, operadorDestinoId, motivo }`.
- Llamar a `reasignarReporte`.
- Responder `{ id, operadorId, estado, actualizadoEn }`.

**Cubre**: FR-018, FR-019, FR-020, SC-006.

### T014 [P0] Tests de integración `PATCH /api/admin/operadores/reasignar` (TDD)
**Archivo**: `src/app/api/admin/operadores/reasignar/route.test.ts`

Casos mínimos:
- Reasignación exitosa actualiza `operadorId`, crea `TransicionReporte` y `AuditLog`.
- Rechaza reporte `PENDIENTE` (400).
- Rechaza reporte sin `operadorId` (400).
- Rechaza destino inactivo o no `OPERADOR` (400/404).
- Rechaza destino igual al operador actual (400).
- Detecta concurrencia y retorna 409.
- Motivo vacío o corto retorna 400.
- No-ADMIN recibe 403.

**Depende de**: T004, T012, T013.

---

## Fase 3 — Workers

### T015 [P1] Instrumentar `pi-app`
**Archivo**: punto de bootstrap de la app (por determinar: `src/lib/infra/startup.ts` o similar)

- Crear `workerLogger.child({ servicio: 'pi-app' })`.
- Emitir log `INFO` al iniciar servidor y `WARN`/`ERROR` en healthcheck fallido o error no controlado.
- No modificar lógica de negocio.

**Cubre**: FR-012, SC-008.

### T016 [P1] Instrumentar `pi-worker`
**Archivo**: `scripts/worker-reportes.mjs`

- Crear `workerLogger.child({ servicio: 'pi-worker' })`.
- Emitir logs en: bootstrap, inicio de procesamiento de job, éxito, error/timeout, reintento.
- No modificar lógica de clasificación ni tocar `src/lib/ai/**`.

**Cubre**: FR-012, SC-008.

### T017 [P1] Instrumentar `pi-monitor`
**Archivo**: `scripts/worker-supervisor.mjs`

- Crear `workerLogger.child({ servicio: 'pi-monitor' })`.
- Emitir logs en: arranque, heartbeat detectado/faltante, apertura/resolución de incidente.

**Cubre**: FR-012, SC-008.

### T018 [P1] Instrumentar `pi-simulador-abuso`
**Archivo**: `scripts/simulador-abuso.mjs`

- Crear `workerLogger.child({ servicio: 'pi-simulador-abuso' })`.
- Emitir logs en: inicio de simulación, iteración, finalización, error.

**Cubre**: FR-012, SC-008.

---

## Fase 4 — Frontend

### T019 [P1] Componente `LogsTab`
**Archivo**: `src/components/modules/monitoreo/LogsTab.tsx`

- Consumir `GET /api/admin/monitoreo/logs` con `useSWR` o fetch propio.
- Estado local: filtros (`servicio`, `nivel`, `desde`, `hasta`, `q`), `limit`, `offset`, `autorefresco`.
- Autorefresco cada 30 s toggleable.
- Mostrar tabla, total y paginación Next/Prev de 100 en 100.

**Depende de**: T008, T009.

### T020 [P1] Tests de `LogsTab`
**Archivo**: `src/components/modules/monitoreo/LogsTab.test.tsx`

- Renderiza con datos mock.
- Aplicar filtros actualiza la query.
- Autorefresco toggle funciona.
- Abrir modal de contexto JSON al hacer clic en fila.

**Depende de**: T019.

### T021 [P1] Tabla y filtros de logs
**Archivo**: `src/components/modules/monitoreo/LogsTable.tsx` y `LogsFilters.tsx`

- Filtros: select de servicio, select de nivel, inputs de fecha/hora, input de búsqueda libre.
- Tabla con columnas: `creadoEn`, `servicio`, `nivel`, `mensaje`, acción "Ver contexto".
- Colores por nivel usando tokens de diseño ( Tailwind ).

**Depende de**: T019.

### T022 [P1] Modal de contexto JSON
**Archivo**: `src/components/modules/monitoreo/LogContextoModal.tsx`

- Recibe `contextoJson`.
- Renderiza JSON formateado, scrollable, con botón cerrar.
- No muestra datos personales (responsabilidad del backend, pero la UI no intenta renderizar más allá del campo).

**Depende de**: T019.

### T023 [P1] Sección "Monitoreo → Logs" en configuración
**Archivo**: `src/components/modules/config-panel/MonitoreoLogsConfig.tsx`

- Formulario para editar:
  - `monitoreo.logs.enabled` (toggle).
  - `monitoreo.logs.nivel_minimo` (select DEBUG/INFO/WARN/ERROR).
  - `monitoreo.logs.max_muestras_ui` (number 1-500).
- Guardar contra endpoint de parámetros existente (reutilizar servicio de configuración).
- Mostrar confirmación y errores.

**Cubre**: FR-011.

### T024 [P1] Sección "Mantenimiento" / purga de logs
**Archivo**: `src/components/modules/config-panel/MantenimientoLogsPanel.tsx`

- Formulario:
  - `hasta` (datetime-local, máximo ayer).
  - `servicio` opcional.
  - `nivel` opcional.
  - `motivo` textarea 20-500 caracteres.
- Botón "Contar filas afectadas" que llama a conteo previo (puede reutilizar `GET /api/admin/monitoreo/logs?limit=0` u operación dedicada).
- Botón "Confirmar purga" con modal de confirmación.
- Llamar `DELETE /api/admin/monitoreo/logs`.

**Cubre**: FR-013, FR-014, FR-015.

### T025 [P1] Componente `ReasignarModal`
**Archivo**: `src/components/modules/operadores/ReasignarModal.tsx`

Props: `reporteId`, `operadorActualId`, `operadorActualNombre?`, `onReasignado`.
- Fetch lista de operadores activos (`rol=OPERADOR`).
- Select de operador destino.
- Textarea motivo 20-500 caracteres.
- Botón confirmar → `PATCH /api/admin/operadores/reasignar`.
- Manejo de errores y cierre.

**Cubre**: FR-021.

### T026 [P1] Tests de `ReasignarModal`
**Archivo**: `src/components/modules/operadores/ReasignarModal.test.tsx`

- Renderiza con operadores mock.
- Rechaza motivo corto.
- Rechaza operador destino igual al actual.
- Llama al endpoint y ejecuta `onReasignado`.

**Depende de**: T025.

### T027 [P1] Integrar `ReasignarModal` en ficha y listado
**Archivos**:
- `src/app/dashboard/admin/operadores/[id]/page.tsx`
- componente de listado de casos asignados (a determinar en implementación)

Agregar botón "Reasignar" que abra el modal en ambos puntos de entrada.

**Depende de**: T025, T026.

### T028 [P1] Integrar `LogsTab` en tablero operativo
**Archivo**: `src/app/dashboard/admin/estadisticas/operacion/OperacionTableroClient.tsx`

- Agregar tab "Logs" al sub-nav interno.
- Renderizar `<LogsTab />` cuando esté activo.

**Cubre**: FR-010.
**Depende de**: T019, T020.

---

## Fase 5 — Tests E2E y validación cruzada

### T029 [P1] Tests de integración adicionales de permisos
**Archivos**: `src/app/api/admin/monitoreo/logs/route.test.ts`, `src/app/api/admin/operadores/reasignar/route.test.ts`

- Verificar rate-limit (`admin_read`/`admin_write`) cuando no está deshabilitado.
- Verificar que `AuditLog` registra intentos fallidos de acceso no-ADMIN.

**Cubre**: SC-006.

### T030 [P2] Test E2E de logs
**Archivo**: `tests/e2e/admin-monitoreo-logs.spec.ts`

Flujo:
1. Login como ADMIN.
2. Navegar a `/dashboard/admin/estadisticas/operacion` → tab "Logs".
3. Aplicar filtros y verificar resultados.
4. Abrir contexto JSON.
5. Ir a `/dashboard/admin/configuracion` → "Mantenimiento", purgar logs de ayer con motivo.
6. Verificar que desaparecen y existe `AuditLog`.

**Depende de**: T019-T024.

### T031 [P2] Test E2E de reasignación
**Archivo**: `tests/e2e/admin-reasignar-operador.spec.ts`

Flujo:
1. Login como ADMIN.
2. Crear/identificar reporte en `REVISION_MANUAL` con operador asignado.
3. Abrir ficha del operador, clic "Reasignar".
4. Seleccionar destino, ingresar motivo, confirmar.
5. Verificar nuevo operador en reporte, `TransicionReporte` y `AuditLog`.

**Depende de**: T025-T027.

---

## Fase 6 — Documentación y gate

### T032 [P2] Actualizar `quickstart.md`
**Archivo**: `specs/193-panel-logs-mantenimiento-reasignar/quickstart.md`

Añadir secciones con comandos reales para:
- Verificar parámetros sembrados.
- Generar logs de prueba.
- Probar endpoints con `curl`.
- Probar purga y reasignación.
- Gate local.

### T033 [P2] Documentar implementación en `spec.md`
**Archivo**: `specs/193-panel-logs-mantenimiento-reasignar/spec.md`

Completar sección "Implementación" con:
- Hash del commit de cierre.
- Endpoints y componentes afectados.
- Tests agregados.
- Migraciones relevantes.
- Deuda técnica identificada.

### T034 [P2] Crear `cierre.md`
**Archivo**: `specs/193-panel-logs-mantenimiento-reasignar/cierre.md`

Seguir formato de cierre del proyecto: resumen, commits, archivos tocados, evidencia de tests, deuda técnica.

### T035 [P2] Gate de calidad final
**Comandos**:
```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
./scripts/dev-restart.sh
```

Verificar que todos pasan. Si `dev-restart.sh` levanta app + un worker, ejecutar `quickstart.md` manualmente.

---

## Traceability rápida FR → Tareas

| FR | Tareas |
|---|---|
| FR-001 | T001, T002 |
| FR-002 | T005 |
| FR-003 | T005 |
| FR-004 | T005, T006 |
| FR-005 | T005, T006 |
| FR-006 | T003 |
| FR-007 | T008 |
| FR-008 | T007, T008, T009 |
| FR-009 | T008 |
| FR-010 | T019, T020, T021, T022, T028 |
| FR-011 | T023 |
| FR-012 | T015, T016, T017, T018 |
| FR-013 | T024 |
| FR-014 | T024 |
| FR-015 | T024 |
| FR-016 | T010 |
| FR-017 | T010, T011 |
| FR-018 | T013 |
| FR-019 | T012, T013, T014 |
| FR-020 | T012, T013, T014 |
| FR-021 | T025, T026, T027 |
| FR-022 | T008, T009, T010, T011, T013, T014, T029 |
| FR-023 | Restricción transversal (no agregar campos a `Reporte`/`Usuario`) |
| FR-024 | Restricción transversal (no tocar `src/lib/ai/**`) |
