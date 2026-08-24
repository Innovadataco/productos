# Plan de implementación: SPEC-236 — Motor de estados + worker + 11 eventos Motor Notif

## 1. Resumen ejecutivo

Esta spec construye la máquina de estados del expediente padre, su worker de mantenimiento y la integración con Motor Notif. No implementa UI padre, aclaraciones ni escalación ROJO automática (candados explícitos). La implementación se divide en cuatro pilares:

1. **Máquina de estados** (`src/lib/expediente/estados/`): whitelist, guards y aplicador de transiciones.
2. **Worker** (`scripts/worker-expediente-motor.mjs`): tick periódico, auto-cierre, recálculo de gravedad, SLA y retención.
3. **Infraestructura**: servicio Docker, parámetros de seed y advisory lock.
4. **Integración notificaciones**: 11 eventos y templates aditivos en Motor Notif (requiere PR #83).

## 2. Decisiones de arquitectura

### 2.1 Máquina de estados centralizada

- **Ubicación**: `src/lib/expediente/estados/transiciones.ts` y `aplicar-transicion.ts`.
- **Patrón**: mapa inmutable `Map<EstadoActual, Array<{destino: EstadoDestino, guard: GuardFn, nota: string}>>`.
- **Guards**: funciones puras asíncronas que reciben contexto (expediente + dependencias) y retornan `{ok: true}` o `{ok: false, codigo, mensaje}`.
- **Transacción**: toda transición se ejecuta dentro de `prisma.$transaction` para garantizar atomicidad entre cambio de estado, `AuditLog` y publicación de evento.
- **Eventos**: la publicación a Motor Notif ocurre dentro de la TX a través de un helper que inserta en la cola/tabla de eventos de Motor Notif (según lo que defina PR #83); si Motor Notif no está disponible, la transición sigue y se loguea el error (fail-open hacia notificaciones, no hacia estado).

### 2.2 Worker de expediente

- **Modelo de ejecución**: proceso Node independiente con advisory lock de PostgreSQL, igual que `scripts/worker-reportes.mjs` y `scripts/monitor-probes.mjs`.
- **Tick**: configurable vía `padre.expediente.motor.tick_min` (default 15 min). El worker duerme entre ticks; no usa pg-boss para estos jobs (son periódicos y idempotentes).
- **Timezone**: `TZ=America/Bogota` en el proceso y en `docker-compose.prod.yml`. Los cálculos de fecha usan `date-fns-tz` (`toZonedTime`, `formatInTimeZone`).
- **Idempotencia**: cada tarea del worker debe ser reejecutable sin efectos secundarios duplicados (ej. un evento `expediente.comite.sla_vencido` solo se publica si no se publicó ya en la misma ventana; se recomienda un flag o `AuditLog` de control).

### 2.3 Retención de datos

- **Estrategia**: overwrite de campos sensibles a `[retenido]`, nunca `DELETE`.
- **Campos afectados**: `EventoExpediente.texto`, `InformeConsolidado.resumenTextoGenerado`, `InformeConsolidado.pdfUrl`.
- **Auditoría**: un `AuditLog` por expediente purgado con acción `EXPEDIENTE_RETENIDO` y metadatos de ids afectados (sin textos).

### 2.4 Motor Notif

- **Interfaz asumida** (a confirmar con PR #83):
  - Tabla `EventoNotificacion`: `clave` (única), `descripcion`, `canalesDefault`.
  - Tabla `NotificacionTemplate`: `eventoClave`, `idioma`, `asunto`, `cuerpoTexto`, `cuerpoHtml`, `variablesEsperadas`.
  - Helper `publicarEventoNotificacion(clave, payload)` que inserta un job o registro.
- **Seed idempotente**: `upsert` por `clave` en eventos y por `(eventoClave, idioma)` en templates.
- **Variables**: `{{expedienteId}}`, `{{estadoDestino}}`, `{{estadoAnterior}}`, `{{actor}}`, `{{motivo}}`, `{{scoreGravedadActual}}`, `{{fechaLimite}}`, `{{urlExpediente}}`.

## 3. Flujos detallados

### 3.1 Aplicar transición

```text
1. Validar Zod de entrada (estadoDestino, motivo opcional).
2. Buscar Expediente por id (bloquea fila con select for update si es posible).
3. Validar que estadoActual → estadoDestino esté en whitelist.
4. Ejecutar guard específico; si falla, lanzar AppError(codigo, mensaje).
5. Iniciar prisma.$transaction:
   a. Actualizar Expediente.estado, updatedAt, fechaCierre y autoCerradoPorInactividad si aplica; el motivo va en el EventoExpediente/AuditLog.
   b. Insertar EventoExpediente tipo TRANSICION_ESTADO con motivo/actor.
   c. Insertar AuditLog.
   d. Publicar evento Motor Notif según estadoDestino (o estadoAnterior/destino).
6. Retornar Expediente actualizado.
```

### 3.2 Worker tick

```text
Por cada tick:
1. Leer parámetros padre.expediente.*.
2. Auto-cierre inactividad:
   a. Seleccionar expedientes ACTIVO con ultimoEventoEn < ahora - auto_cierre_meses.
   b. Para cada uno, llamar aplicarTransicion(id, CERRADO, "AUTO_CIERRE_INACTIVIDAD", "worker").
3. Recálculo de gravedad (cada 24h):
   a. Seleccionar expedientes con actualizacion de score en últimas 24h.
   b. Comparar score anterior vs nuevo.
   c. Si sube a ROJO, publicar expediente.gravedad.subio_a_rojo.
4. SLA comité:
   a. Seleccionar PENDIENTE_COMITE.
   b. Calcular fechaLimite = createdAt + (scoreGravedadActual === ROJO ? 12h : 48h).
   c. Si ahora > fechaLimite y no se notificó ya, publicar expediente.comite.sla_vencido.
5. Retención:
   a. Seleccionar CERRADO con creadoEn < ahora - retencion_cerrados_meses y no retenido.
   b. Actualizar campos sensibles a [retenido] y auditar.
6. Dormir tick_min.
```

### 3.3 Seed

```text
prisma/seed.ts:
- Funcion seedPadreExpedienteParams() con upsert de:
  padre.expediente.consolidacion_min_reportes (int, default 3)
  padre.expediente.motor.tick_min (int, default 15)
  padre.expediente.auto_cierre_meses (int, default 6)
  padre.expediente.retencion_cerrados_meses (int, default 24)
- Funcion seedMotorNotifExpedienteEvents() con upsert de 11 eventos + templates es.
```

## 4. Estructura de archivos propuesta

```text
src/lib/expediente/
  estados/
    transiciones.ts           # whitelist + guards
    aplicar-transicion.ts     # orquestador de transición
    aplicar-transicion.test.ts
    publicar-evento-expediente.ts  # wrapper a Motor Notif
src/lib/expediente/types.ts        # EstadoExpediente, ScoreGravedad, etc. (si no viene de SPEC-234)

src/app/api/interno/expediente/[id]/
  transicionar/
    route.ts
    route.test.ts

scripts/worker-expediente-motor.mjs
scripts/worker-expediente-motor.test.ts

prisma/seed.ts                     # añadir funciones de seed

specs/236-motor-estados-worker-eventos/
  spec.md, plan.md, data-model.md, research.md, quickstart.md
  checklists/requirements.md, tasks.md
```

## 5. Interfaz pública

### 5.1 `aplicarTransicion`

```typescript
type AplicarTransicionInput = {
  expedienteId: string;
  estadoDestino: EstadoExpediente;
  motivo?: string;
  actor?: { id: string; tipo: "usuario" | "service-account" | "worker" };
};

async function aplicarTransicion(
  input: AplicarTransicionInput
): Promise<Expediente>;
```

### 5.2 Endpoint

```text
POST /api/interno/expediente/{id}/transicionar
Content-Type: application/json

Body:
{
  "estadoDestino": "CONSOLIDANDO",
  "motivo": "Suficientes eventos reportados"
}

Response 200:
{
  "expediente": { ... }
}

Response 403/409:
{
  "error": "Transición no permitida",
  "code": "TRANSICION_NO_PERMITIDA"
}
```

## 6. Fases de implementación

1. **Fase 1 — Modelo y seed**: migraciones aditivas (si aplica) + parámetros + eventos/templates.
2. **Fase 2 — Máquina de estados**: `transiciones.ts`, `aplicar-transicion.ts`, tests.
3. **Fase 3 — Endpoint interno**: `route.ts` + tests.
4. **Fase 4 — Worker**: motor tick, auto-cierre, gravedad, SLA, retención.
5. **Fase 5 — Docker e infra**: `docker-compose.prod.yml`, `dev-restart.sh` si afecta.
6. **Fase 6 — Integración Motor Notif**: publicación de eventos (requiere PR #83).
7. **Fase 7 — Validación**: gate local completo.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| PR #83 no mergeado a tiempo | Documentar dependencia; no hacer push final; mantener rama local lista. |
| Cambios en modelo de SPEC-234 | Revisar diff de SPEC-234 antes de codificar guards; ajustar nombres de campos. |
| Worker publica eventos duplicados | Idempotencia por combinación estado+timestamp o flag en AuditLog. |
| Zona horaria mal aplicada | Usar siempre `date-fns-tz`; tests con 23:59/00:01. |
| Cerrar expedientes activos por error | Guard estricto con `ultimoEventoEn`; tests de frontera. |
