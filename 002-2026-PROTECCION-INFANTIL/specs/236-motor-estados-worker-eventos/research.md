# Research: SPEC-236 — Motor de estados + worker + 11 eventos Motor Notif

## 1. Contexto del problema

SPEC-234 introduce el modelo padre v2: `Expediente`, `EventoExpediente`, `InformeConsolidado`, `Aclaracion` y `ScoreGravedad`. Sin un motor de estados, el flujo dependería de que cada endpoint/UI valide manualmente las transiciones, lo que genera:

- Estados inconsistentes (ej. `PENDIENTE_COMITE` sin informe).
- Cierres no auditados o sin motivo.
- Expedientes estancados sin alertas de SLA.
- Textos sensibles conservados más allá del plazo legal.

Esta investigación justifica las decisiones de diseño de SPEC-236.

## 2. Análisis de patrones existentes en el repo

### 2.1 Workers con advisory lock

- `scripts/worker-reportes.mjs` usa `pg_try_advisory_lock(123456789)` y sale con código 2 si el lock está tomado.
- `scripts/monitor-probes.mjs` usa advisory lock propio (diferente id).
- `scripts/simulador-abuso.mjs` sigue el mismo patrón.
- **Decisión**: `worker-expediente-motor.mjs` usará un advisory lock nuevo, distinto a los anteriores, para garantizar una única instancia.

### 2.2 Parámetros de sistema

- `prisma/seed.ts` usa `upsert` por `clave` para parámetros idempotentes.
- Categorías existentes: `SYSTEM`, `VISIBILITY`, `SECURITY`.
- **Decisión**: crear parámetros bajo el namespace `padre.expediente.*` con categoría `SYSTEM`.

### 2.3 Manejo de errores y AppError

- `src/lib/errors.ts` define códigos canónicos: `400`, `401`, `403`, `404`, `409`, `413`, `429`, `500`, `502`, `503`.
- Transiciones inválidas usan `409 Conflict`; guards de hard prohibition usan `403 Forbidden`.
- **Decisión**: `aplicarTransicion` lanza `AppError` con estos códigos, sin exponer stack trace.

### 2.4 Notificaciones existentes

- El proyecto usa Resend directamente en `src/lib/email.ts` para emails transaccionales.
- SPEC-184 reutiliza `IncidenteInfra` para alertas throttled.
- PR #83 introduce Motor Notif (aún no mergeado).
- **Decisión**: no modificar el motor de notificaciones; solo añadir 11 eventos/templates al catálogo que provea PR #83.

## 3. Opciones consideradas

### 3.1 Máquina de estados: librería vs. código propio

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| XState | Potente, visualizable | Overkill, más deps, curva de aprendizaje | No |
| Própio mapa de transiciones | Simple, tipado, sin deps nuevas | Requiere mantener guards a mano | Sí |
| State machine en BD | Flexible sin deploy | Más complejo, queries adicionales | No |

**Justificación**: el dominio tiene pocos estados y transiciones bien definidas. Un mapa tipado con guards es suficiente y se alinea con el principio KISS del proyecto.

### 3.2 Worker: pg-boss vs. cron propio

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| pg-boss jobs periódicos | Reutiliza infra existente | Más complejo para tareas idempotentes de largo plazo | No |
| Worker con setInterval/sleep | Simple, control total del tick | Requiere advisory lock y manejo de señales | Sí |

**Justificación**: las tareas del motor de expediente son periódicas e idempotentes (monitoreo). No requieren cola ni retry por job; un loop simple con parámetro `tick_min` es más claro.

### 3.3 Zona horaria: UTC vs. America/Bogota

- Los reportes y operaciones del negocio ocurren en Colombia.
- El instructivo exige explícitamente `TZ=America/Bogota`.
- **Decisión**: todos los cálculos de SLA e inactividad usan `date-fns-tz`; el contenedor Docker setea `TZ=America/Bogota`.

### 3.4 Retención: DELETE vs. overwrite

- La Ley 1581 de 2012 permite supresión o anonimización.
- El instructivo dice "NO delete rows".
- **Decisión**: overwrite de campos sensibles a `[retenido]`; trazabilidad preservada.

## 4. Referencias y dependencias

- **SPEC-234**: modelo base (`Expediente`, `InformeConsolidado`, `ScoreGravedad`, `Aclaracion`).
- **SPEC-238**: flujo real de aclaraciones; el guard usa `stub=false`.
- **SPEC-239**: escalación ROJO automática; en esta spec solo se permite `CERRADO → ESCALADO` por padre.
- **PR #83**: Motor Notif; base para los 11 eventos/templates.
- **SPEC-184**: patrón de worker con advisory lock y parámetros de seed.
- **AGENTS.md**: convenciones de código, testing y migraciones.
- **.specify/memory/constitution.md**: principios de producto, seguridad y calidad.

## 5. Lecciones de specs anteriores

- SPEC-184 demostró que el advisory lock en PostgreSQL es efectivo para garantizar un único worker.
- SPEC-110 demostró que el overwrite + `AuditLog` cumple retención sin eliminar trazabilidad.
- SPEC-171 demostró que las notificaciones throttled deben ser idempotentes por ventana.

## 6. Preguntas abiertas (para clarify con ZEUS si es necesario)

1. ¿El cierre forzado `EN_APROBACION_PADRE → CERRADO` requiere exactamente 1 aclaración respondida o puede ser "al menos 1"?
2. ¿El evento `expediente.evento.agregado` se dispara al agregar cualquier `EventoExpediente` o solo en transiciones de estado?
3. ¿El endpoint `/api/interno/expediente/[id]/transicionar` también es usado por `OPERADOR`/`COMITE_VALIDACION` o solo `ADMIN`/service-account?
4. ¿El worker de expediente debe correr en `dev-restart.sh` junto al worker de reportes, o requiere arranque manual en desarrollo?
