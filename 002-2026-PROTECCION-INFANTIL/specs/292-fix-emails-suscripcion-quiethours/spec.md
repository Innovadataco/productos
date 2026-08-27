# Feature Specification: Fix worker de notificaciones — polling silenciado (cierra I-147)

**Feature Branch**: `work/002-PI-192` (SPEC-292)
**SPEC**: 292
**Created**: 2026-08-27
**Status**: PLANEADO
**Input**: INSTRUCTIVO-002-PI-192-FIX-EMAILS-SUSCRIPCION-QUIETHOURS · BRIEF-A-34 · I-147

Impacto en arquitectura: **fix quirúrgico de 1 línea + observabilidad + test regresión**. Se elimina el `.unref()` del `setInterval` de polling en `scripts/worker-notificaciones.mjs` — la única causa real por la que las 8 `Notificacion` `ENCOLADA` no se procesan tras cumplirse su `enviarEn`. Se agrega log al final de cada poll (aunque el lote sea 0) para observabilidad post-fix. Se agrega test integración que reproduce el bug con reloj falseado. Cero rediseño del motor, cero cambios a `quietHours`, cero migraciones.

## Diagnóstico verificado en vivo (2026-08-27)

- **BD prod (7:40 UTC)** confirma 8 `Notificacion` `estado=ENCOLADA`, `intentos=0`, `ultimoError=NULL` con `enviarEn=12:00 UTC (07:00 COT)`. Ver §Puntos de compuerta 1.
- **`pgboss.job` prod**: 12 jobs `notificacion-envio` en `state=created` con `start_after=12:00 UTC`. Los 12 históricos previos aparecen `state=completed` — la vía pg-boss SÍ funcionó hasta ayer.
- **Reproducción en vivo**: encolé una `Notificacion` sintética con `enviarEn=NOW()-5min` en prod. Tras 25s (2+ ciclos de 10s del polling declarado), el estado sigue `ENCOLADA, intentos=0, ultimoError=NULL`. Los logs del worker (up 2h) muestran SOLO el arranque — nunca "Procesando lote". Cleanup ejecutado (`estado=CANCELADA, motivoCancelacion="SPEC-292 diagnostico test"`).
- **Comparativa**: los otros 4 workers (`worker-vigencia-pagos`, `worker-analisis-score`, `worker-anomalias`, `worker-analisis-reglas`) usan `boss.schedule` + `boss.work` en modo cron. NINGUNO usa `setInterval(...).unref()`. `worker-notificaciones.mjs` es el único con este patrón.

## Hipótesis rechazadas (con evidencia)

- **H2 (mismatch enum estado)** — DESCARTADO. `listarPendientesParaEnvio` filtra `estado in ["ENCOLADA","REINTENTANDO"]` (línea `src/lib/dal/repositories/notificacion.ts:135`); las notif en BD son `estado=ENCOLADA` — match.
- **H3 (comparador `>` vs `<=`)** — DESCARTADO. La query usa `enviarEn: { lte: ahora }` (línea 136) — comparador correcto.
- **H4 (advisory lock)** — DESCARTADO. El proceso worker es único; su lock se mantiene mientras el proceso vive (verificado por `docker ps` + logs de arranque). Cero contención.

## Hipótesis confirmada (H1 · refinada)

**El `setInterval` de polling en `worker-notificaciones.mjs:263-268` tiene `.unref()`. Con esa marca, el timer NO cuenta contra el keep-alive de libuv. Cuando `boss.work` de pg-boss queda en espera silenciosa (LISTEN/NOTIFY sin jobs `active`), el timer no dispara** — y `procesarLote` NUNCA corre. Único mecanismo alterno: `boss.work` cuando pg-boss activa un job (a partir de `start_after`). Si pg-boss no activa (por race con reinicio del contenedor o config de retry), la cola `Notificacion` en BD queda huérfana.

**Fix mínimo**: quitar `pollInterval.unref()`. El timer sí cuenta contra keep-alive y garantiza tick cada 10s. Log de tick agregado para observabilidad.

---

## Puntos de compuerta (para audit Fábrica)

1. **Reproducción en vivo confirmada** (§Diagnóstico verificado). Cero especulación.
2. **Diagnóstico afinado sobre el brief**: brief §3 nombraba H1 como "rearme post-quietHours no re-consulta". El diagnóstico verificado es más preciso: **el polling está SIEMPRE silenciado desde el arranque del worker**, no solo post-quietHours. Este bug afectó también `consentimiento.aceptado` — 12/12 sí salieron porque pg-boss activó los jobs `notificacion-envio` a tiempo (vía `boss.work`), no porque el polling funcionara. Con `enviarEn=07:00 COT`, si pg-boss falla al activar (race con reinicio), las notif quedan huérfanas.
3. **Alcance mínimo**: solo `scripts/worker-notificaciones.mjs` (1 línea removida + 1 log) + test integración nuevo. Cero cambios en `quiet-hours.ts`, `motor.ts`, schemas, o Prisma.
4. **Reintento manual post-deploy**: no requiere script one-shot. Las 8 ENCOLADAs ya tienen `enviarEn <= NOW()` (a las 12:00 UTC/07:00 COT) — cuando el worker con fix reinicie, `procesarLote` las tomará en el primer poll de 10s. Las 4 CANCELADAs conservan su estado (no se reactivan).
5. **Métrica pi-monitor (brief §5-2)**: **DIFERIDA a brief A-35** — agregar señal `notif.pendientes_vencidas` requiere tocar `probes.ts`, `MonitoreoRepository`, seed de parámetros. Excede el "fix mínimo urgente" de 1-2h. Se anota como TODO en `cierre.md`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El rector recibe el email tras solicitar/activar suscripción (Priority: P1)

Un rector solicita un plan (`suscripcion.solicitada`) o el admin autoriza el pago (`suscripcion.activada`). El motor de notificaciones encola una `Notificacion` con `estado=ENCOLADA` y `enviarEn` (fuera de quietHours). Tras el fix, el worker `pi-notificaciones` procesa esa notificación en < 15s (dentro del intervalo de polling de 10s) y el rector recibe el email de confirmación.

**Why this priority**: Bloquea la comunicación del flujo del dinero. Sin este fix, cada solicitud + activación queda muda; el cliente no sabe si su acción llegó al sistema.

**Independent Test**: Test integración (Vitest, BD real) — encolar 1 `Notificacion` con `enviarEn = NOW() - 1min`, arrancar la lógica de `procesarLote()` una vez, verificar que el estado pasa a `ENVIADA` (con mock de `enviarEmailNotificacion` que devuelve `{id: "test-proveedor"}`).

**Acceptance Scenarios**:

1. **Given** `Notificacion` `estado=ENCOLADA`, `enviarEn=NOW()-1min`, canal `EMAIL`, plantilla existente, **When** `procesarLote()` corre, **Then** el estado pasa a `ENVIADA` con `proveedorId` no nulo.
2. **Given** 8 `Notificacion` `ENCOLADA` con `enviarEn=NOW()-30min`, **When** el worker arranca con el fix aplicado, **Then** el primer poll (dentro de 10s) procesa el lote entero.
3. **Given** `Notificacion` `estado=CANCELADA`, **When** el worker corre `procesarLote()`, **Then** NO se reactiva — el filtro `estado in ["ENCOLADA","REINTENTANDO"]` la excluye.

### User Story 2 — El polling deja rastro observable (Priority: P2)

Un operador consulta logs del worker `pi-notificaciones` para diagnosticar por qué una notificación no salió. Con el fix, cada ciclo de polling (10s) genera al menos un log — sea "Lote procesado" con `procesadas=N>0` o "poll vacío" con `pendientes=0`. Sin este rastro, el bug original quedó invisible por 24h.

**Why this priority**: Observabilidad — evita que este bug renazca en otro worker.

**Independent Test**: Arrancar `worker-notificaciones.mjs` con `NOTIFICACIONES_LOG_POLL_VACIO=true` (opt-in). Verificar en stdout el mensaje "poll vacío" cada intervalo.

**Acceptance Scenarios**:

1. **Given** el worker con el fix aplicado y `pendientes=0`, **When** transcurre un tick de polling, **Then** el stdout muestra `[PI-NOTIFICACIONES] poll: 0 pendientes` (o equivalente).
2. **Given** el worker con `pendientes.length > 0`, **When** transcurre un poll, **Then** el log ya existente "Procesando lote" continúa funcionando (no se rompe).

### User Story 3 — Test regresión bloquea el merge si el polling se re-silencia (Priority: P1)

Un desarrollador reintroduce `.unref()` (o cualquier patrón que impida el timer). El nuevo test integración falla porque su `Notificacion` de prueba no pasa a `ENVIADA` tras el tiempo esperado. El CI bloquea el merge.

**Why this priority**: Sin este test, el fix es un parche que puede desaparecer.

**Independent Test**: El test corre en el shard `test-integration` del CI.

**Acceptance Scenarios**:

1. **Given** el fix aplicado, **When** corre el test integración, **Then** verde.
2. **Given** un fix reintroduce `.unref()` a mano, **When** corre el test, **Then** rojo con mensaje "notificación no procesada tras el tiempo esperado".

---

## Edge Cases

- **`Notificacion` con `enviarEn` en el futuro**: `listarPendientesParaEnvio(ahora, limite)` la excluye por el filtro `enviarEn: { lte: ahora }`. El poll no la toma. Correcto por diseño.
- **`Notificacion` `estado=CANCELADA` (dedup)**: la query filtra por `estado in ["ENCOLADA","REINTENTANDO"]`. Excluida. Las 4 CANCELADAs en prod hoy siguen igual (candado brief §4).
- **quietHours activa (20:00-07:00 COT)**: `procesarLote` toma la notif pero `procesarNotificacion` línea 144 la difiere con `aplicarQuietHours`. El motor ya la programó fuera de la ventana al crearla — este chequeo es defensa contra cambios en caliente del parámetro. Cero cambio en `quiet-hours.ts`.
- **Doble arranque del worker**: `pg_try_advisory_lock` en `id=987654321` (SPEC-284 · `scripts/ADVISORY-LOCKS.md`) mantiene única instancia. Sin cambio.
- **pg-boss activa el job antes que el polling lo tome**: race benigno — el `boss.work` handler también llama `procesarLote()`. Si ya está corriendo desde el `setInterval`, tomar el lote 2 veces es idempotente (el segundo call no encuentra pendientes porque el primero los movió a `ENVIANDO`).
- **`boss.work` en pg-boss falla silencioso**: si pg-boss deja de disparar, el polling (ahora sin `.unref()`) sigue vivo y garantiza el procesamiento cada 10s. Es exactamente la vía de garantía diseñada para este caso.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `scripts/worker-notificaciones.mjs:268` DEBE eliminar `pollInterval.unref();`. El `setInterval` conserva su ref y garantiza tick cada `config.intervaloSegundos` segundos mientras el proceso viva.
- **FR-002**: `scripts/worker-notificaciones.mjs:procesarLote()` DEBE agregar un log observable cuando `pendientes.length === 0` (patrón: `console.log("[PI-NOTIFICACIONES] poll: 0 pendientes")` o vía `workerLogger.debug`). Este log sale por STDOUT — Loki/journalctl lo captura.
- **FR-003**: El shutdown limpio (`SIGTERM`/`SIGINT` en líneas 87-88) DEBE seguir cerrando el proceso al liberar el advisory lock. Como el `pollInterval` ya no tiene `.unref()`, el shutdown DEBE llamar explícitamente `clearInterval(pollInterval)` antes de `releaseAdvisoryLock()` para que node no quede colgado.
- **FR-004**: Nuevo test integración `src/lib/notificaciones/procesar-lote.test.ts` DEBE:
  - Sembrar una `Notificacion` `estado=ENCOLADA`, `enviarEn=NOW()-1min`, canal `EMAIL`, plantilla registrada.
  - Mockear `enviarEmailNotificacion` para devolver `{id: "test-proveedor-id"}`.
  - Importar `procesarLote` (o la función interna) y ejecutarla una vez.
  - Verificar `estado=ENVIADA`, `proveedorId="test-proveedor-id"`, `intentos=1`.
- **FR-005**: NO se toca `src/lib/notificaciones/quiet-hours.ts` (candado brief §4).
- **FR-006**: NO se reactivan las 4 `CANCELADA` de dedup (candado brief §4).
- **FR-007**: NO se rediseña `motor.ts` ni `bounces.ts` (fuera de alcance).
- **FR-008**: NO se cambia el default `quietHours=20:00-07:00` (candado brief §4).
- **FR-009**: NO se toca `src/lib/ai/**` ni migraciones Prisma (candados globales).
- **FR-010**: `pi-monitor` metric `notif.pendientes_vencidas` (brief §5-2) DIFERIDA a brief A-35. Anotada en `cierre.md`.

### Key Entities

- **`pollInterval`** (línea 263 de `worker-notificaciones.mjs`): timer de respaldo del polling. Antes: `.unref()` lo silenciaba. Después: sin `.unref()`, dispara garantizado.
- **`procesarLote()`**: función de cierre pura (con Prisma via `NotificacionRepository`) que consulta pendientes y las procesa. Sin cambio funcional; solo se le agrega log de observabilidad.
- **Test integración `procesar-lote.test.ts`**: nuevo. Aisla la lógica del worker sin arrancar `pg-boss`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Post-fix local: encolar `Notificacion` con `enviarEn=NOW()-5s`, arrancar worker → dentro de 15s el estado pasa a `ENVIADA` (o `REINTENTANDO` si mock del email falla — clave: `intentos>0`, `ultimoError` no NULL).
- **SC-002**: Post-fix local: encolar `Notificacion` con `estado=CANCELADA` → tras 15s sigue `CANCELADA` (dedup respetado).
- **SC-003**: Test integración `procesar-lote.test.ts` verde en `test:unit` (o `test:integration`).
- **SC-004**: Gate LOCAL verde: `tsc --noEmit`, `lint 0 err`, `tokens:check`, `arch:check`, `locks:check`, `ratchets:check`, `test:unit`.
- **SC-005**: **Verificación en vivo obligatoria post-deploy**: consulta BD prod vía SSH+psql:
  - Las 8 `ENCOLADA` de `suscripcion.solicitada`/`suscripcion.activada` con `enviarEn <= NOW()` pasan a `ENVIADA` (o `REINTENTANDO` si el proveedor falla temporalmente — clave: `intentos>0`).
  - Las 4 `CANCELADA` no se reactivan (siguen `CANCELADA`).
  - Encolar 1 `Notificacion` nueva de prueba con `enviarEn=NOW()-1min` → dentro de 15s pasa a `ENVIADA` o `REINTENTANDO`.
  - Cleanup: borrar/cancelar la notif de prueba tras verificar.
- **SC-006**: Logs post-deploy muestran `[PI-NOTIFICACIONES] poll: N pendientes` con cadencia de 10s.

---

## Assumptions

- El worktree parte de `origin/feature/001-scaffolding` HEAD (`96dba1d0`) — post-merge SPEC-289 y SPEC-290 (worker-sesiones).
- El worker `pi-notificaciones` en prod usa `advisory_lock_id=987654321` (SPEC-284 confirmado en `scripts/ADVISORY-LOCKS.md`).
- pg-boss `boss.work` sigue funcionando como vía primaria; el polling es la vía de garantía. Cero cambio en pg-boss.
- El motor de notificaciones (`src/lib/notificaciones/motor.ts`) sigue creando `Notificacion` con `estado=ENCOLADA` y llamando `sendNotificacionEnvio` (`src/lib/queue.ts:253`). Sin cambio.
- La plantilla `consentimiento.aceptado.email` funcionó (12/12 en prod) — descarta problemas de Resend, credenciales, o formato.
- Cleanup de las 4 `CANCELADA` no aplica (dedup correcto).
- Verificación en vivo por Desarrollo obligatoria antes de REALIZADO (D-004 + brief §6-5).
