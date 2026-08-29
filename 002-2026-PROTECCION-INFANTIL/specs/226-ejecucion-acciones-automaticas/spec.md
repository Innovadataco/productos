# Feature Specification: SPEC-226 — Ejecución de acciones automáticas (reglas modo EJECUTA)

**Feature Branch**: `work/002-PI-mega-cola-restante`

**Created**: 2026-08-24

**Status**: IMPLEMENTADO

**Dependencias**: SPEC-221 (motor de reglas de recomendación: `ReglaRecomendacion` + `Recomendacion` + worker de evaluación) en el mismo mega-lote; SPEC-216 (Bonos, en prod) para la acción `crear_bono`; Motor Notificaciones (SPEC-201..204, en prod) para `enviar_notificacion` y `crear_alerta`. Parte del mega-lote 220-227 (Análisis dinero-vs-valor, BRIEF §8/§9).

Impacto en arquitectura: añade el ejecutor de acciones en `src/lib/analisis/acciones/` (registro de handlers por tipo), la tabla aditiva `EjecucionAccion` (trazabilidad + rollback), los enums `TipoAccionEjecutable` y `EstadoEjecucion`, valores aditivos de `AccionAudit`, parámetros `analisis.acciones.*` y `ratelimit.analisis_accion.*` en seed, y dos endpoints admin (`aplicar`, `revertir`) bajo `/api/admin/analisis/recomendaciones/[id]/`. NO crea worker nuevo: el ejecutor es invocado in-process por el worker de evaluación de reglas de SPEC-221.

**Input**: El brief Análisis dinero-vs-valor (§8.2, §9) define reglas con dos modos: `RECOMIENDA` (humano decide) y `EJECUTA` (el sistema actúa solo, "agentic"). Cuando una regla en modo `EJECUTA` genera una `Recomendacion`, el sistema debe ejecutar su `accionEjecutable` con `accionParametros` de forma automática, auditada, rate-limited por regla y reversible manualmente. Las 4 acciones v1 (aprobadas por CEO, M3): `crear_bono` (retención, vía SPEC-216), `enviar_notificacion` (vía Motor Notificaciones), `asignar_operador` (derivar el caso a un humano) y `crear_alerta` (alerta al admin). Sin IA: 100% reglas determinísticas.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El sistema ejecuta la acción de una regla en modo EJECUTA (Priority: P1)

Como sistema quiero que, cuando el worker de reglas genera una `Recomendacion` desde una regla en modo `EJECUTA`, la `accionEjecutable` se ejecute automáticamente con sus `accionParametros`, quede trazada en `EjecucionAccion` y en `AuditLog` con la regla origen, para que la plataforma actúe sola donde el admin lo autorizó.

**Why this priority**: es el núcleo de la spec; sin ejecutor no existe el nivel de autonomía 4 que el CEO aprobó (brief §1 "Sistema actúa por sí solo cuando el admin lo autorice").

**Independent Test**: crear una regla `EJECUTA` con `accionEjecutable = "crear_bono"` y parámetros válidos, generar una recomendación candidata, invocar el ejecutor y verificar que existe el `BonoPromocional` creado, la `EjecucionAccion` en estado `EJECUTADA` con el `bonoId` en su resultado, y el `AuditLog` con la regla origen.

**Acceptance Scenarios**:

1. **Given** una regla con `modo = EJECUTA` y `accionEjecutable = "crear_bono"`, **When** el worker de reglas (SPEC-221) genera una `Recomendacion`, **Then** invoca el ejecutor in-process, que crea el `BonoPromocional`, persiste `EjecucionAccion(estado = EJECUTADA)` con `resultado.bonoId`, marca la recomendación como `ejecutadaAutomatica = true` y registra `AuditLog` (`ANALISIS_ACCION_EJECUTADA`) con `reglaId` y `recomendacionId`.
2. **Given** una regla con `modo = RECOMIENDA`, **When** el worker genera una `Recomendacion`, **Then** el ejecutor NO se invoca y la recomendación queda `PENDIENTE` con `ejecutadaAutomatica = false`.
3. **Given** una regla `EJECUTA` con `accionEjecutable` nula o desconocida, **When** el worker intenta ejecutarla, **Then** la ejecución se registra como `EjecucionAccion(estado = FALLIDA)` con motivo, se registra `AuditLog` (`ANALISIS_ACCION_FALLIDA`) y la recomendación queda disponible para revisión humana (no se pierde).
4. **Given** una acción cuyo handler lanza un error de negocio (ej. suscripción inexistente), **When** el ejecutor la procesa, **Then** persiste `EjecucionAccion(estado = FALLIDA)` con el mensaje seguro del error, registra `AuditLog` y no revienta el tick del worker de reglas (el fallo de una recomendación no detiene las demás).
5. **Given** una ejecución exitosa, **Then** toda la operación (acción + `EjecucionAccion` + actualización de la recomendación + `AuditLog`) se realiza dentro de una transacción de Prisma cuando el handler lo permite; la publicación de notificaciones queda fuera de la TX con log de error si falla (fail-open hacia notificaciones, no hacia la acción).

---

### User Story 2 — Acción `crear_bono` (retención automática) (Priority: P1)

Como sistema quiero crear un `BonoPromocional` específico para el cliente candidato con los parámetros de la regla (tipo, valor, vigencia), para retener clientes en riesgo sin intervención manual.

**Why this priority**: es la acción con impacto comercial directo (dinero); debe ser exacta, auditable y reversible.

**Independent Test**: ejecutar `crear_bono` con `{tipoBono: "DESCUENTO_PCT", valor: 20, vigenciaDias: 15}` sobre una suscripción candidata y verificar el bono creado con vigencia `[hoy, hoy+15d]` en timezone Bogotá, `creadoPorAdminId = regla.creadaPorAdminId` y nombre único trazable a la regla.

**Acceptance Scenarios**:

1. **Given** parámetros `{tipoBono, valor, vigenciaDias}` válidos y un `sujetoId` de `Suscripcion` existente, **When** se ejecuta `crear_bono`, **Then** se crea un `BonoPromocional` con `nombre` único derivado de la regla y el sujeto (ej. `RET-MORA-T30-<sujeto>-20260824`), `vigenciaInicio = hoy` y `vigenciaFin = hoy + vigenciaDias` calculados en `America/Bogota`, `activo = true`, `aplicaARenovaciones = true` y `creadoPorAdminId` igual al admin creador de la regla.
2. **Given** la misma regla y el mismo sujeto, **When** la deduplicación de SPEC-221 ya evitó una segunda recomendación, **Then** no se crea un segundo bono (la dedup ocurre antes del ejecutor).
3. **Given** parámetros inválidos (ej. `valor <= 0`, `tipoBono` fuera del enum), **When** se ejecuta, **Then** la ejecución queda `FALLIDA` con motivo de validación y no se crea nada.
4. **Given** un bono creado por esta acción, **When** el admin revierte la ejecución (US-5), **Then** el bono queda `activo = false` y la `EjecucionAccion` pasa a `REVERTIDA`.

---

### User Story 3 — Acciones `enviar_notificacion` y `crear_alerta` vía Motor Notificaciones (Priority: P1)

Como sistema quiero disparar notificaciones al cliente (`enviar_notificacion`) y alertas al admin (`crear_alerta`) usando exclusivamente la API pública `programar()` del Motor Notificaciones, para no duplicar lógica de canales, plantillas ni preferencias.

**Why this priority**: el Motor Notificaciones ya resuelve canales, quiet hours, opt-out y plantillas; usarlo garantiza consistencia y cumple el candado de no modificar motores existentes.

**Independent Test**: ejecutar `enviar_notificacion` con `{evento, variables}` sobre un destinatario y verificar que `programar()` recibe el evento y que el resultado queda en `EjecucionAccion.resultado.programadas`; ejecutar `crear_alerta` con severidad `ALTA` y verificar que se programa el evento de alerta admin.

**Acceptance Scenarios**:

1. **Given** parámetros `{evento, variables}` y un destinatario resoluble (usuario con email), **When** se ejecuta `enviar_notificacion`, **Then** se llama `programar({evento, sujetoTipo, sujetoId, destinatarios})` del Motor Notificaciones y `EjecucionAccion.resultado` guarda `{programadas, canceladasPorReemplazo}`.
2. **Given** un evento sin reglas activas en Motor Notificaciones, **When** se ejecuta, **Then** el ejecutor registra la ejecución como `EJECUTADA` con `resultado.programadas = 0` y un warning en log (el motor ya loguea); no se considera fallo.
3. **Given** parámetros `{severidad, mensaje, datosContexto}`, **When** se ejecuta `crear_alerta`, **Then** se programa el evento `analisis.alerta.admin` hacia los destinatarios admin configurados, con variables `severidad`, `mensaje`, `reglaClave` y `urlPanel`.
4. **Given** una ejecución `enviar_notificacion` revertida por el admin antes de su envío, **Then** se llama `cancelar()` del Motor Notificaciones con los filtros de la ejecución original y `EjecucionAccion.resultado.revertido.canceladas` registra el conteo.
5. **Given** una alerta de severidad `ALTA`, **Then** el evento se programa para envío inmediato; severidades `MEDIA`/`BAJA` quedan a criterio de las reglas de Motor Notificaciones (que pueden agruparlas en el digest, SPEC-223).

---

### User Story 4 — Acción `asignar_operador` (derivación a humano) (Priority: P2)

Como sistema quiero asignar la recomendación/caso a un operador de plataforma determinado o al de menor carga, y notificarle, para que un humano contacte al cliente cuando la regla lo decide.

**Why this priority**: completa el cuarteto de acciones; es menos crítica que bono/notificación porque el fallback natural es que el admin atienda la recomendación desde el panel.

**Independent Test**: ejecutar `asignar_operador` con `{operadorId}` explícito y verificar que `EjecucionAccion.resultado.operadorId` queda registrado y que el operador recibe notificación; luego con `{estrategia: "menor_carga"}` y verificar la selección automática entre operadores activos.

**Acceptance Scenarios**:

1. **Given** parámetros `{operadorId}` con un operador `OPERADOR` activo, **When** se ejecuta, **Then** `EjecucionAccion.resultado` guarda `operadorId` y se programa una notificación al operador con el título y enlace de la recomendación.
2. **Given** parámetros `{estrategia: "menor_carga"}` sin `operadorId`, **When** se ejecuta, **Then** se selecciona el operador activo con menor número de recomendaciones asignadas sin resolver; si hay empate, el de asignación más antigua.
3. **Given** que no hay operadores activos disponibles, **When** se ejecuta, **Then** la ejecución queda `FALLIDA` con motivo `"sin_operadores_disponibles"` y la recomendación sigue visible para el admin.
4. **Given** una asignación revertida, **Then** se registra la reversión, se notifica al operador la desasignación y la recomendación vuelve a estado `PENDIENTE` sin operador.
5. **Given** la asignación, **Then** NO se reutiliza `asignarOperadorAReporte` (ese servicio es para `Reporte` en `REVISION_MANUAL`/`POSIBLE_SPAM`); esta acción opera sobre `Recomendacion`, un dominio distinto.

---

### User Story 5 — Rate-limit por regla y rollback manual (Priority: P1)

Como admin quiero que cada regla `EJECUTA` tenga un tope de ejecuciones por ventana (anti-spam) y poder revertir manualmente cualquier acción automática desde el panel, para mantener control humano sobre la autonomía.

**Why this priority**: es el candado de seguridad del instructivo ("Rate-limit por regla para evitar spam. Rollback manual posible en Recomendacion"); sin él el modo EJECUTA es inseguro.

**Independent Test**: configurar `ratelimit.analisis_accion.max_requests = 2`, disparar 3 ejecuciones de la misma regla en la ventana y verificar que la tercera queda `FALLIDA` con motivo `rate_limit_regla`; luego revertir la primera y verificar `REVERTIDA` + `AuditLog`.

**Acceptance Scenarios**:

1. **Given** el scope `analisis_accion` con `max_requests = N` por ventana, **When** la regla `R` ya ejecutó N acciones en la ventana, **Then** la ejecución N+1 se rechaza con `EjecucionAccion(estado = FALLIDA, motivo = "rate_limit_regla")`, `AuditLog` y sin efectos colaterales (no se crea bono ni se envía notificación).
2. **Given** el rate-limit, **Then** el identificador de la ventana es la `reglaId` (cada regla tiene su propio contador).
3. **Given** una `EjecucionAccion` en estado `EJECUTADA`, **When** el admin llama `POST /api/admin/analisis/recomendaciones/[id]/revertir`, **Then** el sistema ejecuta el rollback específico del tipo (desactivar bono, cancelar notificación, desasignar operador, marcar alerta atendida), marca la ejecución `REVERTIDA` con `revertidaPorAdminId` y `motivoReversion`, y registra `AuditLog` (`ANALISIS_ACCION_REVERTIDA`).
4. **Given** una `EjecucionAccion` ya `REVERTIDA` o `FALLIDA`, **When** se intenta revertir de nuevo, **Then** el endpoint responde `409` y no cambia nada.
5. **Given** una recomendación `PENDIENTE` con `accionSugerida`, **When** el admin llama `POST /api/admin/analisis/recomendaciones/[id]/aplicar`, **Then** el sistema ejecuta la acción por el mismo ejecutor (misma trazabilidad y rate-limit) y marca la recomendación `APLICADA` con `resueltaPorAdminId`.

---

## Edge Cases

- **Regla promovida a EJECUTA a mitad de ventana**: las ejecuciones anteriores en la ventana cuentan para el rate-limit aunque hayan sido aplicaciones manuales; el contador es por regla, no por origen.
- **Rollback de bono ya aplicado a un pago**: si el `BonoPromocional` ya tiene `BonoAplicado` asociados, el rollback desactiva el bono pero NO toca los `BonoAplicado` ni pagos existentes; se registra en el motivo de reversión ("bono con usos: solo desactivado").
- **Rollback de notificación ya enviada**: `cancelar()` solo cancela programaciones futuras; si ya se envió, la reversión queda registrada como "no reversible (ya enviada)" y la `EjecucionAccion` pasa a `REVERTIDA` con esa nota en el motivo.
- **Suscripción cancelada entre generación y ejecución**: el handler `crear_bono`/`enviar_notificacion` valida el estado del sujeto al ejecutar; si la suscripción está `CANCELADA`, la ejecución queda `FALLIDA` con motivo `sujeto_no_valido`.
- **Worker de reglas caído a mitad de ejecución**: la acción + trazabilidad van en una TX; si el proceso muere, la TX se revierte y la recomendación sigue `PENDIENTE`/`ejecutadaAutomatica = false`, reintentable en el siguiente tick.
- **Doble ejecución concurrente**: la deduplicación por `(reglaId, sujetoId)` de SPEC-221 impide dos recomendaciones vivas del mismo sujeto; además el ejecutor toma la recomendación con bloqueo de fila antes de actuar.
- **Fecha de vigencia en frontera de día**: `vigenciaInicio`/`vigenciaFin` del bono se calculan con `date-fns-tz` en `America/Bogota`; un bono creado a las 23:59 Bogotá vence a las 23:59 del día `hoy + vigenciaDias` Bogotá.
- **Motor Notificaciones sin plantilla o sin reglas para el evento**: `programar()` retorna `programadas = 0` con warning; el ejecutor lo registra como ejecución exitosa con cero envíos (no es error del ejecutor).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer `src/lib/analisis/acciones/ejecutor.ts` con firma `ejecutarAccion(recomendacionId)` que resuelva la recomendación y su regla, valide que `modo = EJECUTA` (o que la invocación sea manual por admin), aplique el rate-limit por regla, despache al handler del tipo de acción y persista la trazabilidad completa.
- **FR-002**: El sistema DEBE implementar un registro de handlers `Map<TipoAccionEjecutable, AccionHandler>` en `src/lib/analisis/acciones/handlers/` con los 4 tipos v1: `CREAR_BONO`, `ENVIAR_NOTIFICACION`, `ASIGNAR_OPERADOR`, `CREAR_ALERTA`. Tipos desconocidos DEBEN producir `EjecucionAccion(estado = FALLIDA)`.
- **FR-003**: El handler `CREAR_BONO` DEBE crear un `BonoPromocional` vía el repositorio de pagos existente (`PagosRepository.crearBonoPromocional`), con `nombre` único trazable (`<prefijoRegla>-<sujetoCorto>-<yyyyMMdd>`), vigencia calculada en `America/Bogota`, `aplicaARenovaciones = true` y `creadoPorAdminId = regla.creadaPorAdminId`. DEBE validar parámetros con Zod (`tipoBono` en enum `TipoBono`, `valor > 0`, `vigenciaDias` entre 1 y 365).
- **FR-004**: El handler `ENVIAR_NOTIFICACION` DEBE llamar exclusivamente `programar()` de `@/lib/notificaciones` (API pública del motor); PROHIBIDO escribir en `Notificacion` directamente.
- **FR-005**: El handler `CREAR_ALERTA` DEBE programar el evento `analisis.alerta.admin` hacia los admins destinatarios configurados en `analisis.acciones.alertas_destinatarios` (lista de usuarioIds admin; si vacío, todos los `ADMIN` activos), con variables `severidad`, `mensaje`, `reglaClave`, `urlPanel`.
- **FR-006**: El handler `ASIGNAR_OPERADOR` DEBE aceptar `operadorId` explícito o `estrategia: "menor_carga"`, validar que el operador esté activo con rol `OPERADOR`, registrar la asignación en `EjecucionAccion.resultado` y notificar al operador vía Motor Notificaciones. NO DEBE reutilizar `asignarOperadorAReporte` (dominio `Reporte`).
- **FR-007**: El sistema DEBE crear la tabla `EjecucionAccion` (aditiva) con: `id`, `recomendacionId` (FK), `reglaId`, `tipoAccion`, `parametros Json`, `estado` (`EJECUTADA`/`REVERTIDA`/`FALLIDA`), `resultado Json?`, `motivoFallo String?`, `origenEjecucion` (`AUTOMATICA`/`MANUAL_ADMIN`), `ejecutadaEn`, `revertidaEn?`, `revertidaPorAdminId String?`, `motivoReversion String?`, `createdAt`. Índices: `[recomendacionId]`, `[reglaId, ejecutadaEn]`, `[estado, ejecutadaEn]`.
- **FR-008**: Cada ejecución (éxito o fallo) DEBE registrar `AuditLog` con la regla origen (`reglaId`, `reglaClave`), la recomendación, el tipo de acción y el resultado, usando los valores aditivos de `AccionAudit`: `ANALISIS_ACCION_EJECUTADA`, `ANALISIS_ACCION_FALLIDA`, `ANALISIS_ACCION_REVERTIDA`. NUNCA incluir PII de reportes ni textos sensibles en los metadatos.
- **FR-009**: El sistema DEBE aplicar rate-limit por regla usando el limitador existente (`src/lib/rate-limit.ts`) con scope `analisis_accion` e `identifier = reglaId`, configurable por `ratelimit.analisis_accion.window_seconds` (default 3600) y `ratelimit.analisis_accion.max_requests` (default 20) en `ParametroSistema`. El rechazo por límite DEBE registrarse como `FALLIDA` con motivo `rate_limit_regla`.
- **FR-010**: El sistema DEBE exponer `POST /api/admin/analisis/recomendaciones/[id]/aplicar` (rol `ADMIN`, módulo admin de análisis) que ejecute la acción sugerida de una recomendación `PENDIENTE` por el mismo ejecutor y la marque `APLICADA`.
- **FR-011**: El sistema DEBE exponer `POST /api/admin/analisis/recomendaciones/[id]/revertir` (rol `ADMIN`) que ejecute el rollback del tipo de acción sobre la `EjecucionAccion` `EJECUTADA` asociada: `CREAR_BONO` → `BonoPromocional.activo = false`; `ENVIAR_NOTIFICACION` → `cancelar()` del motor; `ASIGNAR_OPERADOR` → desasignar + notificar; `CREAR_ALERTA` → marcar atendida (registro; las alertas ya enviadas no se des-envían).
- **FR-012**: Los endpoints DEBEN validar entrada con Zod, autenticar con `verifyAuth("ADMIN")`, aplicar rate-limit de admin y devolver códigos canónicos (`400`/`401`/`403`/`404`/`409`/`429`) vía `AppError`/`errorToResponse`.
- **FR-013**: El worker de evaluación de reglas (SPEC-221) DEBE invocar `ejecutarAccion` in-process tras generar cada recomendación de una regla `EJECUTA`; un fallo de ejecución NO DEBE detener el procesamiento de las demás recomendaciones del tick.
- **FR-014**: El sistema DEBE sembrar de forma idempotente: parámetros `ratelimit.analisis_accion.*` y `analisis.acciones.alertas_destinatarios`, y el evento `analisis.alerta.admin` + plantilla(s) `es` en el catálogo del Motor Notificaciones (upsert, sin tocar eventos existentes).
- **FR-015**: Toda ejecución y reversión DEBE ejecutarse en transacción de Prisma en lo que abarque la mutación de dominio + `EjecucionAccion` + `AuditLog`; las llamadas a Motor Notificaciones quedan fuera de la TX (fail-open con log).
- **FR-016**: El sistema DEBE implementar tests unitarios/integración: 4 handlers (éxito + parámetros inválidos), rate-limit por regla, rollback de cada tipo, idempotencia de seed, endpoints `aplicar`/`revertir` (200/403/404/409), fallo aislado que no detiene el tick, y cálculo de vigencia de bono en frontera horaria Bogotá.
- **FR-017**: PROHIBIDO modificar `src/lib/ai/**`, el rate-limit del reporte público, el código del Motor Notificaciones (solo se consumen su API pública y su catálogo con upserts aditivos) ni el servicio de bonos de SPEC-216 (solo se consume su repositorio).

### Key Entities

- **ReglaRecomendacion** (SPEC-221): `id`, `clave`, `modo` (`RECOMIENDA`/`EJECUTA`), `accionEjecutable`, `accionParametros Json`, `creadaPorAdminId`, `activa`.
- **Recomendacion** (SPEC-221): `id`, `reglaId`, `sujetoTipo`, `sujetoId`, `estado`, `ejecutadaAutomatica`, `datosContexto Json`, `accionSugerida`, `accionParametros`.
- **EjecucionAccion** (nueva, esta spec): trazabilidad y rollback de cada acción. Ver `data-model.md`.
- **BonoPromocional** (existente, `prisma/schema.prisma:794`): destino de `CREAR_BONO`.
- **Notificacion / NotificacionRegla / NotificacionPlantilla** (existentes, Motor Notif): destino de `ENVIAR_NOTIFICACION` y `CREAR_ALERTA`, solo vía `programar()`/`cancelar()`.
- **Usuario** (rol `OPERADOR`/`ADMIN`): destinatario de `ASIGNAR_OPERADOR` y `CREAR_ALERTA`.
- **ParametroSistema**: `ratelimit.analisis_accion.*`, `analisis.acciones.alertas_destinatarios`.
- **AuditLog**: trazabilidad con regla origen.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `ejecutarAccion` completa cada tipo de acción en menos de 500 ms (99p local, excluyendo envío SMTP) y deja `EjecucionAccion` + `AuditLog` consistentes en una sola TX.
- **SC-002**: El rate-limit por regla rechaza el 100% de las ejecuciones que exceden `max_requests` en la ventana, sin efectos colaterales (cero bonos/notificaciones creados en los rechazos).
- **SC-003**: El rollback de cada tipo revierte su efecto en el primer intento (bono desactivado, notificación futura cancelada, operador desasignado) y una segunda reversión responde `409`.
- **SC-004**: Un fallo en una ejecución no detiene el tick del worker de reglas: las demás recomendaciones del mismo tick se procesan (verificable en test con 1 handler que lanza + 2 que no).
- **SC-005**: El 100% de las ejecuciones automáticas quedan en `AuditLog` con `reglaId` y `recomendacionId` (consulta de verificación en test de integración).
- **SC-006**: La vigencia de un bono creado a las 23:59 Bogotá se calcula correctamente en `America/Bogota` (test de frontera 23:59/00:01).
- **SC-007**: Seed idempotente: dos corridas consecutivas no duplican parámetros ni el evento/plantilla `analisis.alerta.admin`.
- **SC-008**: Gate local verde: `npx tsc --noEmit && npm run lint --no-cache && npm run test:unit -- <paths SPEC-226> && npm run build`.

---

## Assumptions

- SPEC-221 entrega en la misma rama `ReglaRecomendacion`, `Recomendacion` (con `ejecutadaAutomatica`, `accionParametros`, deduplicación por `(reglaId, sujetoId)`) y el worker de evaluación que invoca el ejecutor. Esta spec consume ese modelo; si los nombres de campo difieren, se ajustan en implementación.
- SPEC-216 (Bonos) está en prod: existe `BonoPromocional` y `PagosRepository.crearBonoPromocional` (`src/lib/dal/repositories/pagos-repository.ts:325`). Esta spec no crea endpoints de bonos ni modifica su lógica de aplicación a pagos.
- Motor Notificaciones (SPEC-201..204) está en prod: `programar()` y `cancelar()` son API pública estable (`src/lib/notificaciones/motor.ts:79,169`); se añade solo el evento `analisis.alerta.admin` + plantilla vía seed aditivo.
- `asignar_operador` asigna la recomendación (no un `Reporte`); el operador la atiende desde el panel de análisis. La UI que muestra "mis recomendaciones asignadas" al operador es deuda visible para SPEC-227 o posterior (v1 se notifica por Motor Notif).
- La promoción de una regla `RECOMIENDA → EJECUTA` con confirmación fuerte y su `AuditLog` se implementa en SPEC-224 (panel de reglas); esta spec asume que el flag `modo` ya viene gobernado.
- El historial completo de recomendaciones con métricas de tuning es SPEC-227; esta spec solo expone `aplicar`/`revertir`.
- Sin IA: las acciones son 100% determinísticas (brief §2, D-67 por analogía).
- Los `accionParametros` se validan con esquemas Zod por tipo de acción; una regla con parámetros inválidos falla en ejecución (registrado) y la corrección se hace editando la regla (SPEC-224).
- Timezone de negocio: `America/Bogota` (D-69) para vigencias y ventanas de fecha calendario.

---

## Implementación *(por completar al cerrar)*

### Resumen de cambios

Implementado 2026-08-24 (rama `work/002-PI-mega-cola-restante`):

- **Modelo**: enums `TipoAccionEjecutable`, `EstadoEjecucion`, `OrigenEjecucion`, modelo `EjecucionAccion` (tabla `ejecuciones_accion`), relación inversa `Recomendacion.ejecuciones`, 3 valores `AccionAudit` (`ANALISIS_ACCION_EJECUTADA|FALLIDA|REVERTIDA`). Migración aditiva `prisma/migrations/20260824160000_spec_226_ejecucion_acciones/`.
- **Ejecutor** (`src/lib/analisis/acciones/`): `ejecutor.ts` (orquestador: precondiciones, rate-limit por regla, TX única, AuditLog, notificar post-TX fail-open), `registry.ts`, `types.ts`, `schemas.ts` (Zod por tipo), `rate-limit-regla.ts`, `rollback.ts`, `aplicar.ts`, handlers `crear-bono.ts`, `enviar-notificacion.ts`, `asignar-operador.ts`, `crear-alerta.ts`.
- **DAL**: `src/lib/dal/repositories/ejecucion-accion.ts` (frontera Q-3; incluye runner de TX y bloqueo `SELECT ... FOR UPDATE`).
- **Hook SPEC-221** (FR-013): `src/lib/analisis/reglas/motor.ts` invoca `ejecutarAccion` por recomendación viva de reglas EJECUTA; contadores `ejecutadas`/`fallidasEjecucion` en `ResultadoEvaluacion`; log del worker actualizado.
- **Endpoints**: `POST /api/admin/analisis/recomendaciones/[id]/aplicar` y `[id]/revertir` (ADMIN + módulo `analisis_recomendaciones` + rate-limit `admin_write`).
- **Seed**: `seedEjecucionAcciones()` — parámetros `ratelimit.analisis_accion.*` + `analisis.acciones.alertas_destinatarios`, eventos `analisis.alerta.admin` (EMAIL, ADMIN) y `analisis.operador.asignacion` (EMAIL+IN_APP, OPERADOR) con plantillas `es`.
- **Tests**: 4 unitarios (24 tests, verdes) + 3 de integración escritos (ejecutor, aplicar, revertir; los corre el coordinador).

### Decisiones ejecutadas

- `EjecucionAccion.tipoAccion` es NOT NULL (data-model §3.4): ante clave desconocida se persiste placeholder `CREAR_ALERTA` y el motivo real queda en `motivoFallo` (`accion_desconocida: <clave>`). El placeholder nunca se usa para rollback (una FALLIDA no es revertible).
- `enviar_notificacion`/`crear_alerta` resuelven destinatarios dentro de la TX pero llaman `programar()` post-TX; el conteo `programadas` se fusiona en `resultado` tras la TX (FR-015 + contrato US-3).
- Rollback de `ENVIAR_NOTIFICACION`: `cancelar()` post-TX; `canceladas = 0` → detalle "no reversible (ya enviada)" y `resultado.revertido.canceladas`.
- Sin worker nuevo ni advisory lock: el ejecutor corre in-process en el worker de reglas de SPEC-221.
- Test de SPEC-221 "EJECUTA diferida" actualizado al nuevo contrato (FR-013): ahora verifica la `EjecucionAccion(FALLIDA)` por clave desconocida.

### Gate local

- `npx prisma generate` ✔ · `npx prisma validate` ✔
- `npx tsc --noEmit` ✔ limpio en archivos propios (el único error restante, `src/app/dashboard/admin/analisis/reglas/page.tsx` → `@/components/modules/analisis/ReglasPanel`, es de SPEC-224 en progreso — otro agente).
- Tests unitarios: 24/24 verdes (`schemas`, `crear-bono` frontera Bogotá, `crear-alerta`, `asignar-operador`).
- Sin UI → `tokens:check` no aplica.

### Deuda técnica / notas

- La bandeja del operador para recomendaciones asignadas queda como deuda (v1 notifica por Motor Notif; ver Assumptions y research §6.1).
- Reintentos de ejecuciones FALLIDA ocurren en ticks siguientes del worker (la recomendación queda PENDIENTE); cada intento consume rate-limit de la regla y genera su fila FALLIDA + AuditLog (trazabilidad deliberada).
- Tests de integración escritos pero no corridos en el subagente (BD compartida): los corre el coordinador.

