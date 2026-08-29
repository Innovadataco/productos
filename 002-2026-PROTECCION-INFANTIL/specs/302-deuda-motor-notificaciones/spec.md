# Feature Specification: Deuda motor notificaciones (métrica + ratchet + logger)

**Feature Branch**: `work/pi-SPEC-302-deuda-motor-notif`

**Created**: 2026-08-29

**Status**: IMPLEMENTADO

**Input**: User description: "Deuda motor notificaciones (SPEC-302 · 002-PI-208). Cierra 3 puntos vivos de R-022 §1.3: (a) métrica notif.pendientes_vencidas sin monitoreo de worker atascado, (b) sin ratchet CI que proteja contra la regresión de I-147 (.unref() olvidado), (c) 5 console.warn en el motor sin logger estructurado ni nivel configurable."

**Impacto en arquitectura:** No introduce entidades nuevas. Agrega un método de solo-lectura a `NotificacionRepository` (frontera DAL intacta), un endpoint GET sin auth en la misma familia que `/api/health`, una señal nueva al vigilante de infraestructura (`scripts/monitor-probes.mjs`), y un ratchet de CI nuevo (`scripts/lint/no-unref-timer-nuevo.ts` + manifiesto) que se integra al `ratchets:check` ya existente sin tocar `.github/workflows/ci.yml`. Cero cambios en el motor de clasificación IA ni en el schema de Prisma.

## Nota de proceso (transparencia con Fábrica)

Este spec.md se escribió **retroactivamente**: por error de proceso propio, tras el HALLAZGO en el punto (b) continué directo con la implementación de (a) y (c) sin parar en la compuerta §4 (spec+plan → PARA → APROBADO). El código de los 3 puntos ya está implementado, verificado (`tsc`, lint, `arch:check`, `ratchets:check`, tests) y listo para push, pero **no se ha hecho push ni abierto PR** — este documento y el `plan.md`/`tasks.md` que lo acompañan se entregan a Fábrica para su revisión antes de continuar, junto con la señal `spec+plan LISTO · PARA` fuera de secuencia.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - ADMIN detecta un worker de notificaciones atascado antes de que un padre reporte "no me llegó el email" (Priority: P1)

Hoy, si el worker de notificaciones se atasca (patrón I-147), nadie se entera hasta que un usuario reporta que no recibió un email. Un ADMIN necesita una señal temprana: cuántas notificaciones `ENCOLADA` llevan más de 15 minutos sin enviarse.

**Why this priority**: Es la protección directa contra la recaída de I-147 — sin esto, el mismo bug puede volver a pasar desapercibido días.

**Independent Test**: Insertar en BD 3 notificaciones `ENCOLADA` con `enviarEn` vencido hace más de 15 minutos y verificar que `contarPendientesVencidas()` devuelve 3; llamar `GET /api/monitor/notif` y verificar que la respuesta refleja ese conteo con `estado: "🔴..."`.

**Acceptance Scenarios**:

1. **Given** 3 notificaciones `ENCOLADA` con `enviarEn` hace más de 15 minutos, **When** se consulta la métrica, **Then** devuelve 3.
2. **Given** una notificación `ENCOLADA` con `enviarEn` hace menos de 15 minutos, **When** se consulta la métrica, **Then** esa notificación NO cuenta.
3. **Given** notificaciones en estado `ENVIADA` (ya procesadas), **When** se consulta la métrica, **Then** esas notificaciones NUNCA cuentan, sin importar su antigüedad.
4. **Given** el endpoint `GET /api/monitor/notif` sin autenticación (igual que `/api/health`), **When** se consulta, **Then** responde 200 con `{ notif_pendientes_vencidas, umbral_minutos: 15, estado }`.
5. **Given** el vigilante de infraestructura (`monitor-probes.mjs`) corriendo, **When** completa un ciclo, **Then** la señal `notif_pendientes_vencidas` aparece registrada junto a las demás señales existentes.

---

### User Story 2 - Un futuro cambio de código no puede reintroducir I-147 sin que alguien lo revise a propósito (Priority: P1)

I-147 fue causado por un `setInterval` que perdió su intención original (`.unref()` vs no `.unref()`) sin que nadie lo notara en revisión. Se necesita un ratchet de CI que bloquee cualquier timer NUEVO en `scripts/worker-*.mjs` que no haya sido revisado y justificado explícitamente — sin exigir ciegamente `.unref()` en todos los casos, porque **el fix real de I-147 fue justamente quitarlo** de un timer específico.

**Why this priority**: Sin este candado, la próxima persona (humana o agente) que toque un worker puede repetir exactamente el mismo error, con el mismo costo de días de emails atascados sin que nadie lo note.

**Independent Test**: Agregar temporalmente un `setInterval` nuevo no manifestado a un worker, correr el ratchet, verificar que falla (exit 1) señalando exactamente esa línea; revertir el cambio.

**Acceptance Scenarios**:

1. **Given** el código actual de `scripts/worker-*.mjs` (8 ocurrencias de timers, cada una ya manifestada con su justificación), **When** corre el ratchet, **Then** pasa en verde sin falsos positivos.
2. **Given** un timer nuevo agregado a cualquier `worker-*.mjs` sin actualizar el manifiesto, **When** corre el ratchet, **Then** falla señalando archivo y línea exactos.
3. **Given** el timer de `worker-notificaciones.mjs` que a propósito NO lleva `.unref()` (el fix real de I-147), **When** corre el ratchet, **Then** NO lo marca como infractor (está manifestado con su justificación).
4. **Given** un timer cuyo `.unref()` se llama varias líneas después de la declaración (patrón `worker-supervisor.mjs`), **When** corre el ratchet, **Then** NO lo marca como infractor (la ratchet no exige `.unref()` en la misma línea, compara contra el manifiesto).

---

### User Story 3 - Un operador de infraestructura distingue ruido esperado de fallos reales en los logs del motor de notificaciones (Priority: P2)

Los logs del motor mezclaban situaciones esperadas (sin reglas activas para un evento, un destinatario que optó por no recibir notificaciones) con fallos reales (plantilla faltante, error al encolar el envío) usando el mismo `console.warn` sin distinción de nivel.

**Why this priority**: Menor urgencia que (a)/(b) porque no hay incidente activo, pero reduce ruido operativo y prepara terreno para alertas automáticas futuras basadas en nivel de log.

**Independent Test**: Mock del logger, ejercitar las 5 situaciones del motor (sin reglas, sin email, opt-out, plantilla faltante, fallo al encolar) y verificar que cada una llama al nivel correcto (`info` para las 2 esperadas, `warn` para las 3 de fallo recuperable).

**Acceptance Scenarios**:

1. **Given** un evento sin reglas activas, **When** se llama `programar()`, **Then** se registra en nivel `info` (situación esperada, no error).
2. **Given** un destinatario sin email resoluble, **When** se llama `programar()`, **Then** se registra en nivel `warn`.
3. **Given** un destinatario que deshabilitó la preferencia para ese evento/canal, **When** se llama `programar()`, **Then** se registra en nivel `info` (decisión válida del usuario, no un fallo).
4. **Given** una regla que referencia una plantilla inexistente, **When** se llama `programar()`, **Then** se registra en nivel `warn` (problema de configuración).
5. **Given** un fallo al disparar el envío inmediato tras crear la notificación, **When** ocurre el error, **Then** se registra en nivel `warn` (fallo recuperable: la notificación queda `ENCOLADA` y el poll de respaldo la recogerá).
6. **Given** la variable de entorno `LOG_LEVEL_NOTIFICACIONES=error`, **When** ocurre cualquiera de las 5 situaciones anteriores, **Then** ningún `info`/`warn` se emite (nivel respetado).

---

### Edge Cases

- ¿Qué pasa si `LOG_LEVEL_NOTIFICACIONES` tiene un valor inválido (typo)? → Cae al default (`warn` en producción, `info` en desarrollo), sin lanzar error.
- ¿Qué pasa si el endpoint `/api/monitor/notif` falla al consultar la BD? → Responde 500 con un error genérico (sin stack trace al cliente), y registra el detalle en logs de servidor.
- ¿Qué pasa si dos ocurrencias de timers en el mismo archivo tienen exactamente el mismo texto de línea? → El ratchet las trata como un multiconjunto: cada ocurrencia real necesita su propia entrada en el manifiesto (o una entrada duplicada), no basta con una sola.
- ¿Qué pasa con timers fuera de `scripts/worker-*.mjs` (por ejemplo en `scripts/monitor-probes.mjs` o en `src/`)? → Quedan fuera del alcance de este ratchet a propósito; el riesgo de I-147 es específico a los workers de larga vida.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer una función que cuente las notificaciones en estado `ENCOLADA` cuyo `enviarEn` sea anterior a "ahora menos un umbral en minutos" (default 15).
- **FR-002**: El acceso a esa métrica DEBE pasar por `NotificacionRepository` (frontera DAL, Q-3), nunca importar `prisma` directo desde el módulo de métricas.
- **FR-003**: El sistema DEBE exponer un endpoint HTTP `GET /api/monitor/notif` sin autenticación (mismo trato que `/api/health`) que devuelva `{ notif_pendientes_vencidas, umbral_minutos, estado }`.
- **FR-004**: La ruta `/api/monitor/notif` DEBE estar declarada como pública en el guardián de acceso (`GUARDIAS_ACCESO.publicas`), o el proxy la bloqueará con 401 para tráfico anónimo.
- **FR-005**: El vigilante de infraestructura (`scripts/monitor-probes.mjs`) DEBE incluir esta métrica como una señal más de su ciclo, con la misma cadencia base que las demás señales sin cadencia dedicada.
- **FR-006**: El sistema DEBE proteger contra la reintroducción de I-147 con un ratchet de CI que detecte timers NUEVOS en `scripts/worker-*.mjs` no revisados, sin asumir que todo timer debe llevar `.unref()`.
- **FR-007**: El ratchet DEBE comparar cada ocurrencia contra un manifiesto explícito (archivo + texto de línea + justificación), no contra una regla genérica de sintaxis.
- **FR-008**: El manifiesto DEBE documentar explícitamente por qué el timer de `worker-notificaciones.mjs` (el poll de respaldo del motor) NO debe llevar `.unref()` — es el fix real de I-147, no una excepción arbitraria.
- **FR-009**: Los 5 puntos de log del motor de notificaciones (`src/lib/notificaciones/motor.ts`) DEBEN usar el logger estructurado existente (`src/lib/logger.ts`), no `console.warn` directo.
- **FR-010**: El nivel de log del motor DEBE ser configurable vía la variable de entorno `LOG_LEVEL_NOTIFICACIONES`, independiente del `LOG_LEVEL` global, con default `warn` en producción e `info` en desarrollo.
- **FR-011**: Los módulos alcanzables desde `scripts/*.mjs` (motor, métricas, probes) DEBEN usar imports relativos, nunca alias `@/lib/` (ratchet existente `no-worker-alias`, SPEC-197 · I-88).
- **FR-012**: El sistema NO DEBE modificar `src/lib/ai/**`, `prisma/schema.prisma`, `deploy-prod.sh` ni `verificar-base-pr.yml`.
- **FR-013**: El sistema NO DEBE modificar el endpoint `resolver-spam` ni la heurística de clasificación existente (fuera de alcance de este SPEC).

### Key Entities *(include if feature involves data)*

- **Notificacion** (existente, solo lectura del campo `estado`/`enviarEn`): ya tiene índice `@@index([estado, enviarEn])`, usado por la nueva query de métrica sin necesidad de migración.
- **Manifiesto de timers** (`scripts/lint/timers-worker-manifest.json`, nuevo): lista de todas las ocurrencias conocidas de `setInterval`/`setTimeout` en workers, cada una con su justificación (`sleep-en-promise`, `spec-292-sin-unref-a-proposito`, `unref-misma-linea`, `unref-linea-posterior`, `setTimeout-transitorio`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un ADMIN o script externo puede saber en una sola consulta HTTP si el worker de notificaciones está atascado, sin necesidad de acceso a la BD.
- **SC-002**: Un timer nuevo sin revisar agregado a cualquier `worker-*.mjs` hace fallar el CI antes de llegar a producción, con el archivo y línea exactos señalados.
- **SC-003**: El timer que resolvió I-147 (sin `.unref()`) nunca vuelve a marcarse como falso positivo por este ratchet.
- **SC-004**: Los logs del motor de notificaciones distinguen situaciones esperadas de fallos reales sin cambiar el comportamiento funcional del motor (cero regresión en `programar()`/`cancelar()`/`recalcular()`).
- **SC-005**: Cero regresión: todos los tests existentes de `motor.test.ts` y `procesar-lote.test.ts` siguen en verde.

## Assumptions

- El manifiesto de timers (Camino A, autorizado por Fábrica PI-1 2026-08-29 11:54 COT tras HALLAZGO documentado en el canal inter-sesión) reemplaza la "opción simple grep-based en ci.yml" original del brief/instructivo, por ser la única opción que no reintroduce I-147 ni requiere migrar a AST. Integrado a `npm run ratchets:check` (ya wireado en `ci.yml`), sin tocar el workflow.
- El endpoint `/api/monitor/notif` sigue exactamente el patrón de `/api/health`: sin auth, consumido tanto por curl externo (tabla §6b) como potencialmente por herramientas de monitoreo futuras; no se valida el `Origin` ni se aplica rate limit (mismo nivel de exposición que `/api/health`, que ya no lo tiene).
- El campo real del modelo `Notificacion` para la fecha de envío programada es `enviarEn` (el brief/instructivo original decía `programadaPara`, nombre incorrecto — corregido en la implementación, confirmado por Fábrica en fuente).
- No se migra el ratchet a AST (candado explícito del instructivo); el manifiesto es deliberadamente basado en texto de línea, no en parseo estructural.
