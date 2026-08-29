# Plan de implementación: SPEC-226 — Ejecución de acciones automáticas (reglas modo EJECUTA)

## 1. Resumen ejecutivo

Esta spec construye el **ejecutor de acciones** del módulo Análisis dinero-vs-valor: cuando el worker de reglas de SPEC-221 genera una `Recomendacion` desde una regla en modo `EJECUTA`, el ejecutor despacha uno de los 4 handlers (`CREAR_BONO`, `ENVIAR_NOTIFICACION`, `ASIGNAR_OPERADOR`, `CREAR_ALERTA`), aplica rate-limit por regla, persiste trazabilidad en la nueva tabla `EjecucionAccion` + `AuditLog`, y expone al admin dos endpoints (`aplicar`, `revertir`) para control manual y rollback. No crea worker ni UI nueva; se enchufa in-process al worker de SPEC-221 y al panel de SPEC-224/227.

Pilares:

1. **Ejecutor + handlers** (`src/lib/analisis/acciones/`): orquestador y registro de handlers por tipo.
2. **Trazabilidad y rollback** (`EjecucionAccion`, enums y `AccionAudit` aditivos).
3. **Endpoints admin** (`/api/admin/analisis/recomendaciones/[id]/aplicar|revertir`).
4. **Seed** (parámetros + evento/plantilla `analisis.alerta.admin` en Motor Notif).

## 2. Decisiones de arquitectura

### 2.1 Ejecutor in-process, sin worker ni cola nueva

- **Decisión**: `ejecutarAccion(recomendacionId)` es una función de librería invocada in-process por el worker de evaluación de reglas (SPEC-221) en el mismo tick que genera la recomendación.
- **Alternativas consideradas**:
  - *Encolar un job pg-boss por acción*: más resiliente a caídas a mitad de acción, pero añade una cola, un consumidor y reconciliación para 4 acciones de baja frecuencia (reglas de negocio, no ráfagas). La TX de Prisma ya hace la ejecución atómica y la recomendación queda reintentable en el siguiente tick.
  - *Worker propio con advisory lock (patrón SPEC-236)*: innecesario; el worker de reglas ya existe y es el disparador natural.
- **Justificación**: KISS. El volumen esperado es bajo (recomendaciones de reglas de negocio), la atomicidad la da la TX, y el retry lo da el tick siguiente del worker de reglas.

### 2.2 Registro de handlers por tipo (open/closed manual)

- **Ubicación**: `src/lib/analisis/acciones/handlers/` con un archivo por tipo y un `registry.ts` que exporta `Map<TipoAccionEjecutable, AccionHandler>`.
- **Contrato del handler**:

```typescript
type AccionHandler = (ctx: {
  recomendacion: Recomendacion;
  regla: ReglaRecomendacion;
  parametros: unknown; // validado con Zod por el propio handler
  tx: Prisma.TransactionClient;
}) => Promise<HandlerResult>; // { resultado: Json; notificar?: () => Promise<void> }
```

- El ejecutor valida la entrada, abre la TX, invoca el handler, persiste `EjecucionAccion` y `AuditLog`; después de la TX ejecuta `notificar()` (Motor Notif, fail-open con log). Así las llamadas al motor nunca quedan dentro de la transacción.

### 2.3 Consumo estricto de APIs existentes (candados)

- **Bonos**: solo `PagosRepository.crearBonoPromocional` (`src/lib/dal/repositories/pagos-repository.ts:325`). Cero cambios al módulo Pagos/Bonos (SPEC-216, en prod).
- **Notificaciones**: solo `programar()` / `cancelar()` de `@/lib/notificaciones` (`src/lib/notificaciones/motor.ts:79,169`). Prohibido escribir en `Notificacion` directamente (regla del propio módulo, `motor.ts:1-6`).
- **Rate-limit**: se reutiliza `checkRateLimit` de `src/lib/rate-limit.ts` con scope nuevo `analisis_accion` e `identifier = reglaId`. Los scopes se configuran por `ParametroSistema` (`ratelimit.{scope}.window_seconds|max_requests`, `rate-limit.ts:67-71`); no hay que tocar el limitador, solo sembrar parámetros.
- **IA**: `src/lib/ai/**` intocable; este módulo no usa IA (brief §2).

### 2.4 Trazabilidad en tabla propia (`EjecucionAccion`), no en `Recomendacion`

- **Decisión**: nueva tabla aditiva `EjecucionAccion` con FK a `Recomendacion`. Guarda tipo, parámetros, resultado (ids creados: `bonoId`, `notificacionId`/`programadas`, `operadorId`), estado (`EJECUTADA`/`REVERTIDA`/`FALLIDA`), origen (`AUTOMATICA`/`MANUAL_ADMIN`) y campos de reversión.
- **Alternativa considerada**: guardar `resultadoAccion Json` dentro de `Recomendacion`. Rechazada: una recomendación puede tener historial (ejecución → reversión → re-aplicación manual), y mezclar la trazabilidad con el modelo de SPEC-221 acopla dos specs que se implementan en paralelo.
- **Rollback**: cada handler expone `revertir(ejecucion, tx)` junto a su `ejecutar`. Efectos: bono → `activo = false` (sin tocar `BonoAplicado` ya usados); notificación → `cancelar()` (solo futuras; si ya se envió, se registra "no reversible"); operador → desasignar + notificar; alerta → marcar atendida.

### 2.5 `asignar_operador` sobre Recomendacion, no sobre Reporte

- El servicio existente `asignarOperadorAReporte` (`src/lib/operadores/asignador.ts:88`) opera sobre `Reporte` en estados `REVISION_MANUAL`/`POSIBLE_SPAM` con cupo por tenant: dominio distinto. **No se reutiliza**.
- La asignación se persiste en `EjecucionAccion.resultado.operadorId` (la recomendación en sí no se modifica salvo `estado`/`ejecutadaAutomatica`) y se notifica al operador vía Motor Notif. La bandeja del operador queda como integración posterior (SPEC-227 muestra el historial al admin; la vista del operador es deuda documentada).
- Estrategia `menor_carga`: cuenta `EjecucionAccion` de tipo `ASIGNAR_OPERADOR` en estado `EJECUTADA` por operador cuya recomendación siga sin resolver.

### 2.6 Nomenclatura de acciones

- BD/código: enum `TipoAccionEjecutable` (`CREAR_BONO`, `ENVIAR_NOTIFICACION`, `ASIGNAR_OPERADOR`, `CREAR_ALERTA`).
- `ReglaRecomendacion.accionEjecutable` (string, SPEC-221) usa las claves del brief en criollo: `crear_bono`, `enviar_notificacion`, `asignar_operador`, `crear_alerta`. El registry mapea clave → handler; el enum es la representación persistida en `EjecucionAccion.tipoAccion`.

## 3. Flujos detallados

### 3.1 Ejecución automática (worker SPEC-221)

```text
1. Worker de reglas genera Recomendacion (regla modo EJECUTA, dedup aplicada).
2. Llama ejecutarAccion(recomendacionId):
   a. Carga recomendacion + regla (bloqueo de fila).
   b. Si regla.modo != EJECUTA y origen != MANUAL_ADMIN → FALLIDA("modo_no_ejecuta").
   c. Rate-limit scope analisis_accion, identifier=reglaId. Si excede → FALLIDA("rate_limit_regla") + AuditLog. Fin.
   d. Resuelve handler por regla.accionEjecutable. Si no existe → FALLIDA("accion_desconocida").
   e. TX: handler.ejecutar → insert EjecucionAccion(EJECUTADA, resultado) →
      update Recomendacion(ejecutadaAutomatica=true, estado=APLICADA) → AuditLog(ANALISIS_ACCION_EJECUTADA con reglaId/reglaClave).
   f. Post-TX: handler.notificar (Motor Notif) con try/catch + console.error.
3. Un throw del handler → rollback TX, insert EjecucionAccion(FALLIDA, motivoFallo seguro) fuera de la TX fallida + AuditLog(ANALISIS_ACCION_FALLIDA); el worker continúa con la siguiente recomendación.
```

### 3.2 Aplicación manual (admin)

```text
POST /api/admin/analisis/recomendaciones/[id]/aplicar
1. verifyAuth("ADMIN") + assertModulo + rate-limit admin.
2. Recomendacion debe existir y estar PENDIENTE (si no → 409).
3. Si tiene accionSugerida/accionEjecutable → ejecutarAccion(id, origen=MANUAL_ADMIN)
   (mismo rate-limit por regla y misma trazabilidad).
4. Marca APLICADA con resueltaPorAdminId; responde 200 con la EjecucionAccion.
```

### 3.3 Reversión (admin)

```text
POST /api/admin/analisis/recomendaciones/[id]/revertir  { motivo }
1. verifyAuth("ADMIN") + validación Zod (motivo requerido).
2. Busca la EjecucionAccion EJECUTADA más reciente de la recomendación (si no → 409).
3. TX: handler.revertir (efecto por tipo) → EjecucionAccion(REVERTIDA, revertidaPorAdminId, motivoReversion) →
   AuditLog(ANALISIS_ACCION_REVERTIDA).
4. Post-TX: notificaciones de reversión si aplica (desasignación).
5. Casos límite: bono con usos → solo desactiva (nota en motivo); notificación ya enviada → registra "no reversible (ya enviada)".
```

### 3.4 Seed

```text
prisma/seed.ts (funciones upsert idempotentes):
- ratelimit.analisis_accion.window_seconds (int, 3600)
- ratelimit.analisis_accion.max_requests (int, 20)
- analisis.acciones.alertas_destinatarios (json/string, default "[]" → todos los ADMIN)
- Evento Motor Notif: analisis.alerta.admin + NotificacionRegla(rol ADMIN, canal EMAIL) +
  NotificacionPlantilla es (asunto + cuerpoMarkdown con {{severidad}} {{mensaje}} {{reglaClave}} {{urlPanel}})
- Evento Motor Notif: analisis.operador.asignacion (notificación al operador) + plantilla es.
```

## 4. Estructura de archivos propuesta

```text
src/lib/analisis/
  acciones/
    ejecutor.ts                    # orquestador (FR-001)
    ejecutor.test.ts
    registry.ts                    # Map clave → handler
    types.ts                       # AccionHandler, HandlerResult, contexto
    schemas.ts                     # Zod por tipo de accionParametros
    rollback.ts                    # dispatcher de reversión por tipo
    handlers/
      crear-bono.ts                # FR-003
      crear-bono.test.ts
      enviar-notificacion.ts       # FR-004
      enviar-notificacion.test.ts
      asignar-operador.ts          # FR-006
      asignar-operador.test.ts
      crear-alerta.ts              # FR-005
      crear-alerta.test.ts
    rate-limit-regla.ts            # wrapper checkRateLimit scope analisis_accion

src/lib/dal/repositories/
  ejecucion-accion.ts              # repo tipado (DAL) + test

src/app/api/admin/analisis/recomendaciones/[id]/
  aplicar/
    route.ts                       # POST (FR-010)
    route.test.ts
  revertir/
    route.ts                       # POST (FR-011)
    route.test.ts

prisma/
  schema.prisma                    # EjecucionAccion + enums + AccionAudit aditivos + relación inversa
  migrations/NNNN_ejecucion_acciones/  # aditiva
  seed.ts                          # funciones de seed (FR-014)

specs/226-ejecucion-acciones-automaticas/
  spec.md, plan.md, research.md, data-model.md, quickstart.md
  contracts/226-acciones-automaticas.md
  checklists/requirements.md
```

## 5. Interfaz pública

### 5.1 Ejecutor

```typescript
type OrigenEjecucion = "AUTOMATICA" | "MANUAL_ADMIN";

async function ejecutarAccion(input: {
  recomendacionId: string;
  origen: OrigenEjecucion;
  adminId?: string; // requerido si origen = MANUAL_ADMIN
}): Promise<EjecucionAccion>;
```

### 5.2 Endpoints

Ver `contracts/226-acciones-automaticas.md`.

```text
POST /api/admin/analisis/recomendaciones/{id}/aplicar   → 200 | 401 | 403 | 404 | 409 | 429
POST /api/admin/analisis/recomendaciones/{id}/revertir  → 200 | 400 | 401 | 403 | 404 | 409 | 429
```

## 6. Fases de implementación

1. **Fase 1 — Modelo y migración**: enums + `EjecucionAccion` + relación inversa aditiva en `Recomendacion` + `AccionAudit` values; migración aditiva.
2. **Fase 2 — Seed**: parámetros + eventos/plantillas Motor Notif (idempotente).
3. **Fase 3 — Handlers + registry**: 4 handlers con Zod, tests por handler.
4. **Fase 4 — Ejecutor**: rate-limit, TX, AuditLog, fallo aislado; tests de integración.
5. **Fase 5 — Endpoints**: `aplicar`/`revertir` + tests (200/403/404/409/429).
6. **Fase 6 — Integración SPEC-221**: hook en el worker de reglas (ajuste de 1 llamada; si SPEC-221 aún no mergea, dejar el punto de invocación documentado).
7. **Fase 7 — Gate local**: `npx tsc --noEmit && npm run lint --no-cache && npm run test:unit -- src/lib/analisis src/app/api/admin/analisis && npm run build` + `git diff --name-status origin/feature/001-scaffolding..HEAD` limpio.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| SPEC-221 cambia nombres de campos de `Recomendacion`/`ReglaRecomendacion` | Revisar el diff de SPEC-221 antes de codificar; el ejecutor referencia campos por el modelo Prisma generado (error de tipos en `tsc` si difieren). |
| Ejecución duplicada por doble tick del worker | Dedup `(reglaId, sujetoId)` de SPEC-221 + bloqueo de fila en el ejecutor + recomendación ya `APLICADA` no se re-ejecuta. |
| Bono creado automáticamente aplicado a un pago antes del rollback | El rollback solo desactiva; se registra la nota. El admin ve el bono en el panel de pagos existente. |
| Motor Notif caído durante ejecución | Llamadas post-TX con try/catch; la acción queda `EJECUTADA` y el error en log (`console.error`). |
| Regla mal configurada dispara acciones en masa | Rate-limit por regla (FR-009) + todas las reglas nacen en `RECOMIENDA` (brief §2) + promoción a `EJECUTA` requiere confirmación del admin (SPEC-224). |
| Conflicto de migraciones con otras specs del mega-lote que tocan `schema.prisma` | Migración pequeña y autocontenida; rebase sobre la rama del lote antes del commit; verificación del diff acumulado (I-101). |
