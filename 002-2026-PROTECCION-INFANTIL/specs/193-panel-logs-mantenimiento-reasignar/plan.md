# Plan de implementación — SPEC-193 (002-PI-087)

**Feature Branch**: `work/002-pi-087`  
**Spec**: [spec.md](spec.md) · **Data Model**: [data-model.md](data-model.md) · **Contracts**: [contracts/endpoints.md](contracts/endpoints.md) · **Research**: [research.md](research.md)  
**Status**: `PLANEADO → DESARROLLO`

---

## 1. Resumen ejecutivo

Esta feature agrega una entidad de infraestructura (`WorkerLog`), un helper de logging reutilizable (`workerLogger`), tres endpoints administrativos (`GET /api/admin/monitoreo/logs`, `DELETE /api/admin/monitoreo/logs`, `PATCH /api/admin/operadores/reasignar`) y las pantallas de administración asociadas. Cierra el flujo de reasignación dejado pendiente en SPEC-189 (I-73) sin modificar la estructura de `Reporte` ni `Usuario`.

El trabajo se divide en seis fases secuenciales: Investigación/Modelo, Backend, Workers, Frontend, Tests y Validación. Las fases Backend y Frontend pueden avanzar en paralelo una vez definido el contrato y el helper.

---

## 2. Fases del trabajo

### Fase 1 — Investigación y modelo (día 1)

- Revisar `prisma/schema.prisma`: confirmar `Reporte.operadorId`, `TransicionReporte`, `AuditLog`, `ParametroSistema`.
- Redactar migración aditiva `20260821xx_add_worker_log` con `CREATE TABLE WorkerLog`, `CREATE TYPE NivelLog`, índices y extensión de `AccionAudit`.
- Actualizar `prisma/schema.prisma` con el modelo `WorkerLog`, el enum `NivelLog` y los dos nuevos valores de `AccionAudit`.
- Sembrar en `prisma/seed.ts` (bloque `monitoreoNuevos`) los parámetros `monitoreo.logs.enabled`, `monitoreo.logs.nivel_minimo` y `monitoreo.logs.max_muestras_ui`.
- Verificar que la migración no contiene `DROP`, `ALTER TABLE ... DROP COLUMN` ni modifica `Reporte`/`Usuario`.

### Fase 2 — Backend (días 1-3)

- Implementar `src/lib/monitoreo/worker-logger.ts` con métodos `debug`, `info`, `warn`, `error` y `.child({ servicio })`.
- Implementar servicio de lectura/escritura de logs en `src/lib/monitoreo/logs-service.ts` (o similar): filtros, paginación `limit/offset`, conteo, purga, inserción.
- Implementar `src/app/api/admin/monitoreo/logs/route.ts` con `GET` (listado filtrado) y `DELETE` (purga manual).
- Implementar servicio de reasignación en `src/lib/operadores/reasignar-service.ts`: validaciones de estado, operador destino, concurrencia, transacción `UPDATE Reporte` + `INSERT TransicionReporte` + `INSERT AuditLog`.
- Implementar `src/app/api/admin/operadores/reasignar/route.ts` con `PATCH`.
- Aplicar `verifyAuth("ADMIN")`, `assertModulo` y `checkRateLimit` (`admin_read` / `admin_write`) en todos los endpoints.
- Implementar schemas Zod para query params, body de purga y body de reasignación.

### Fase 3 — Workers (día 3)

- Instrumentar `scripts/worker-reportes.mjs` con `workerLogger.child({ servicio: 'pi-worker' })` en bootstrap, inicio de job, éxito y error.
- Instrumentar `scripts/worker-supervisor.mjs` con `workerLogger.child({ servicio: 'pi-monitor' })` en arranque, heartbeat y detección de anomalías.
- Instrumentar el proceso principal de la app (`pi-app`) en el punto de bootstrap adecuado (por ejemplo, servidor iniciado o healthcheck) con `workerLogger.child({ servicio: 'pi-app' })`.
- Instrumentar `scripts/simulador-abuso.mjs` con `workerLogger.child({ servicio: 'pi-simulador-abuso' })` en inicio, iteración y finalización.
- Garantizar que todos los mensajes usen el formato `[Módulo] Acción: resultado — detalle` y no incluyan PII ni texto de reportes.

### Fase 4 — Frontend (días 3-5)

- En `/dashboard/admin/estadisticas/operacion`:
  - Agregar sub-tab "Logs".
  - Implementar `src/components/modules/monitoreo/LogsTab.tsx` con filtros (servicio, nivel, rango de fechas, búsqueda libre), tabla paginada (100 en 100), autorefresco 30 s toggle, modal de contexto JSON y colores por nivel.
- En `/dashboard/admin/configuracion`:
  - Agregar sección "Monitoreo → Logs" para editar los tres parámetros.
  - Agregar sección "Mantenimiento" con formulario de purga manual: rango `hasta`, filtros opcionales, motivo 20-500 caracteres, cuenta previa y confirmación.
- Implementar `src/components/modules/operadores/ReasignarModal.tsx` reusable desde la ficha del operador (`/dashboard/admin/operadores/[id]`) y el listado de casos (`/dashboard/admin/operadores/asignar`).
- Integrar mutaciones con `fetch`, manejo de errores y notificaciones.

### Fase 5 — Tests (días 4-6)

- Tests unitarios del helper: `src/lib/monitoreo/worker-logger.test.ts`.
- Tests de integración de API:
  - `src/app/api/admin/monitoreo/logs/route.test.ts` (GET filtrado, permisos, validaciones, DELETE con purga y `AuditLog`).
  - `src/app/api/admin/operadores/reasignar/route.test.ts` (casos válidos, estados inválidos, destino inválido, concurrencia, permisos).
- Tests de componentes:
  - `src/components/modules/monitoreo/LogsTab.test.tsx`.
  - `src/components/modules/operadores/ReasignarModal.test.tsx`.
- Tests E2E con Playwright:
  - `tests/e2e/admin-monitoreo-logs.spec.ts`.
  - `tests/e2e/admin-reasignar-operador.spec.ts`.

### Fase 6 — Validación y cierre (día 6)

- Ejecutar gate de calidad: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, `./scripts/dev-restart.sh`.
- Verificar migración aditiva contra una copia de la BD de staging.
- Completar `quickstart.md` con comandos y verificaciones.
- Actualizar `spec.md` sección "Implementación" y crear `cierre.md`.

---

## 3. Decisiones de diseño

### 3.1 Reutilizar `TransicionReporte` como timeline de reasignación

El BRIEF menciona `ReporteTimeline`, pero el esquema actual usa `TransicionReporte`. Se inserta una fila con `estadoAnterior == estadoNuevo`, `responsableTipo = ADMIN`, `motivo` y `metadatos` con `{ tipo: 'REPORTE_REASIGNADO_MANUAL', operador_anterior, operador_nuevo, admin_id }`. **No se crea una tabla nueva.** Esto respeta FR-020 y FR-023.

### 3.2 Extender `AccionAudit`

Se agregan dos valores al enum existente:

- `LOGS_MANTENIMIENTO_PURGA` para toda purga manual de `WorkerLog`.
- `REPORTE_REASIGNADO_MANUAL` para toda reasignación de operador.

La migración Prisma usará `ALTER TYPE ... ADD VALUE` en SQL nativo (aditivo, cero `DROP`).

### 3.3 `limit/offset` en lugar de `page/pageSize` para logs

Los logs son un stream temporal append-only donde el admin suele querer "los últimos N" o "las siguientes N desde un punto en el tiempo". `limit/offset` es más natural para autorefresco y scroll paginado; además permite al frontend controlar exactamente cuántas filas nuevas traer en cada refresco. El máximo se limita a `min(500, monitoreo.logs.max_muestras_ui)`.

### 3.4 `WorkerLog` sin relaciones foráneas

`WorkerLog` es una entidad de infraestructura aislada: no tiene FK a `Reporte`, `Usuario` ni ninguna tabla de negocio. Esto evita bloqueos en escritura, permite truncados seguros y mantiene la tabla independiente del resto del modelo.

### 3.5 `workerLogger` siempre a `stdout`, opcional a BD

El helper siempre emite al logger existente (`src/lib/logger.ts`) y, si `monitoreo.logs.enabled=true` y el nivel del mensaje es `>= monitoreo.logs.nivel_minimo`, persiste en `WorkerLog` de forma asíncrona. Cualquier fallo de BD se absorbe: se loguea en `stdout` y no se propaga. Esto cumple FR-003, FR-004 y FR-005.

### 3.6 Nivel mínimo por defecto `WARN`

El default reduce el volumen de escrituras en producción (objetivo SC-002: < 5 % de persistencia cuando el tráfico es mayoritariamente `INFO`). El admin puede bajarlo a `INFO` o `DEBUG` desde configuración sin deploy.

### 3.7 Purga manual con motivo obligatorio

No hay purga automática por decisión del CEO. Toda eliminación requiere:

- `huta` anterior al día actual (máximo "ayer").
- Motivo de 20 a 500 caracteres.
- Filtros opcionales por servicio/nivel.
- Conteo previo en UI antes de confirmar.
- `AuditLog` inmutable con `{ filtros, motivo, filas_borradas, ejecutado_por }`.

### 3.8 Reasignación con control de concurrencia

El endpoint `PATCH` lee el `operadorId` actual, valida precondiciones y ejecuta `UPDATE` condicional (`operadorId` debe coincidir). Si otro admin modificó el caso entre la lectura y la escritura, se retorna `409 CONFLICT`.

### 3.9 `ReasignarModal` reusable

Un único componente `ReasignarModal` se usa desde la ficha del operador y desde el listado de casos. Recibe `reporteId`, `operadorActualId` y un callback `onReasignado`. Esto minimiza duplicación de validaciones y tests.

### 3.10 Parámetros de configuración

Los tres parámetros de monitoreo viven en `ParametroSistema`:

- `monitoreo.logs.enabled` (BOOLEAN, default `true`).
- `monitoreo.logs.nivel_minimo` (STRING, default `WARN`).
- `monitoreo.logs.max_muestras_ui` (INTEGER, default `500`).

Se siembran con `ON CONFLICT DO UPDATE` en `prisma/seed.ts` para que el default llegue a todos los entornos sin pisar valores operativos del CEO.

---

## 4. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `WorkerLog` crece sin control y satura la BD | Alto | Mensaje limitado a 500 chars; índices por `creadoEn`; purga manual con motivo; `nivel_minimo=WARN` por defecto. |
| Escritura a BD ralentiza o cae un worker | Medio | `workerLogger` es asíncrono y fail-open: fallo se loguea en `stdout`, no se propaga. |
| PII o texto de reporte en logs | Alto | Validación de mensajes sin datos personales; contexto JSON estructurado; acceso solo `ADMIN`. |
| Reasignación concurrente produce inconsistencia | Medio | `UPDATE` condicional por `operadorId`; respuesta `409` si cambió. |
| Confusión entre `TransicionReporte` y `ReporteTimeline` | Bajo | Se usa `TransicionReporte` existente; no se crea tabla nueva. |
| Extensión de enum `AccionAudit` requiere regenerar cliente | Bajo | Ejecutar `npx prisma generate` tras migración; incluir en instrucciones de deploy. |
| Cambios en `ParametroSistema` no se reflejan en workers en caliente | Bajo | Los workers leen el parámetro al emitir cada log (lectura barata) o lo cachean con TTL corto; la app lee siempre. |

---

## 5. Dependencias entre tareas

```text
Fase 1 ─┬─► Fase 2 (Backend) ─┬─► Fase 3 (Workers)
        │                      │
        │                      └─► Fase 4 (Frontend)
        │
        └─► Fase 5 (Tests) ──► Fase 6 (Validación/Cierre)
```

- **Migración y seed** bloquean todo lo demás.
- **`workerLogger`** debe existir antes de instrumentar workers y antes de los tests del helper.
- **Endpoints de monitoreo** deben existir antes de los componentes de logs.
- **Endpoint de reasignación** debe existir antes de `ReasignarModal`.
- **Frontend** puede desarrollarse en paralelo al backend usando mocks, pero la integración requiere endpoints funcionales.
- **Tests E2E** requieren app + worker levantados con seed aplicado.

---

## 6. Criterios de hecho por fase

### Fase 1 — Investigación y modelo

- [ ] Migración aditiva aplicada sin errores en entorno local.
- [ ] `npx prisma generate` genera el cliente con `WorkerLog` y `NivelLog`.
- [ ] `npx prisma db seed` crea/actualiza los tres parámetros de monitoreo.
- [ ] No hay `DROP`, `ALTER TABLE ... DROP COLUMN` ni cambios en `Reporte`/`Usuario`.

### Fase 2 — Backend

- [ ] `workerLogger` persiste condicionalmente según `enabled` y `nivel_minimo`.
- [ ] `workerLogger` no lanza excepciones si la BD falla.
- [ ] `GET /api/admin/monitoreo/logs` retorna `{ items, total }` con filtros y orden `creadoEn DESC`.
- [ ] `DELETE /api/admin/monitoreo/logs` borra filas, rechaza `hasta >= hoy` y genera `AuditLog`.
- [ ] `PATCH /api/admin/operadores/reasignar` actualiza `operadorId`, inserta `TransicionReporte` y `AuditLog`.
- [ ] Todos los endpoints retornan `403` para usuarios no `ADMIN`.
- [ ] Todos los endpoints aplican rate-limit `admin_read`/`admin_write`.

### Fase 3 — Workers

- [ ] Los cuatro workers usan `workerLogger.child({ servicio: '...' })`.
- [ ] Cada worker emite al menos un log al arrancar y otro al procesar un trabajo representativo.
- [ ] Los mensajes no contienen PII ni texto de reportes.

### Fase 4 — Frontend

- [ ] Sub-tab "Logs" visible en `/dashboard/admin/estadisticas/operacion`.
- [ ] Filtros, tabla paginada, modal de contexto JSON y autorefresco funcionan.
- [ ] Sección "Monitoreo → Logs" en configuración permite editar parámetros.
- [ ] Sección "Mantenimiento" permite purgar logs con cuenta previa y motivo.
- [ ] `ReasignarModal` funciona desde ficha de operador y listado de casos.

### Fase 5 — Tests

- [ ] Cobertura de `workerLogger` (condiciones de persistencia, fallo de BD, child).
- [ ] Tests de integración de los tres endpoints con permisos y edge cases.
- [ ] Tests de componentes de logs y reasignación.
- [ ] Tests E2E de flujo completo de logs y reasignación.

### Fase 6 — Validación y cierre

- [ ] `npx tsc --noEmit` sin errores.
- [ ] `npm run lint` sin errores.
- [ ] `npm run test` pasa.
- [ ] `npm run build` pasa.
- [ ] `./scripts/dev-restart.sh` levanta app y un worker sin errores.
- [ ] `quickstart.md` actualizado y ejecutado manualmente.
- [ ] `spec.md` sección "Implementación" y `cierre.md` completados.
