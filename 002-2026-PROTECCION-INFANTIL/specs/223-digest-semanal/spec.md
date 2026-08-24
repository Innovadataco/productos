# Feature Specification: SPEC-223 — Digest semanal al CEO (Análisis dinero-vs-valor)

**Feature Branch**: `work/002-PI-mega-cola-restante`

**Created**: 2026-08-24

**Status**: PLANEADO

**Dependencias**: SPEC-220 (modelos Análisis §5.1–5.7 del brief, incluido `DigestSemanal`) y SPEC-221 (motor de reglas → `Recomendacion`), ambas del mismo mega-lote; Motor Notificaciones SPEC-201..204 (ya en prod, PR #83). SPEC-225 (`Anomalia`) es dependencia OPCIONAL: si no está implementada, la sección de anomalías sale vacía sin romper el digest.

Impacto en arquitectura: añade un schedule pg-boss `analisis-digest-semanal` (lunes 8am America/Bogota, parametrizable), el módulo de negocio `src/lib/analisis/digest-semanal.ts`, un evento nuevo del catálogo de Motor Notif (`analisis.digest.semanal`) con sus reglas y plantillas sembradas, parámetros `analisis.digest.*` en seed y valores aditivos del enum `AccionAudit`. Sin endpoints nuevos; la configuración vive en `ParametroSistema` (editable desde `/dashboard/admin/configuracion`, D-72).

**Input**: El módulo Análisis dinero-vs-valor (BRIEF-ANALISIS-DINERO-VS-VALOR §8.4 acción D, decisión D-78) exige un resumen semanal proactivo al CEO: el sistema debe entregar cada lunes a las 8am (hora Bogotá) un digest con las top 5 decisiones, KPIs vs semana anterior, anomalías, ganadores/perdedores y recomendaciones del sistema, enviado por email e in-app a través del Motor de Notificaciones (`motor.programar`), con destinatarios configurables y auditoría SYSTEM (`usuarioId = null`).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El sistema genera el digest de la semana cada lunes 8am Bogotá (Priority: P1)

Como sistema quiero ejecutar un job semanal que calcule la ventana de la semana operativa anterior (lunes-domingo, America/Bogota), persista un `DigestSemanal` por destinatario de forma idempotente y registre auditoría SYSTEM, para que el CEO reciba siempre un único resumen correcto por semana.

**Why this priority**: sin el job y su idempotencia no hay feature; un digest duplicado o con la semana mal cortada destruye la confianza del CEO en el módulo.

**Independent Test**: sembrar datos de una semana cerrada, ejecutar `ejecutarDigestSemanal()` dos veces seguidas y verificar que solo existe una fila `DigestSemanal` por (periodo, destinatario) y que la segunda corrida es no-op.

**Acceptance Scenarios**:

1. **Given** el schedule `analisis-digest-semanal` registrado en pg-boss con cron derivado de `analisis.digest.dia_semana` (default 1 = lunes) y `analisis.digest.hora_bogota` (default 8), **When** llega el lunes 08:00 America/Bogota, **Then** el worker ejecuta la generación del digest de la semana anterior.
2. **Given** una ejecución, **When** se calcula la ventana, **Then** `desde` es el lunes 00:00 Bogotá de la semana anterior y `hasta` es el lunes 00:00 Bogotá de la semana actual (ventana `[desde, hasta)`), y el `periodo` se expresa como semana ISO Bogotá (`"2026-W34"`).
3. **Given** una corrida exitosa para un destinatario, **When** el job se reejecuta la misma semana (retry de pg-boss o ejecución manual), **Then** no se crea una segunda fila `DigestSemanal` para el mismo (periodo, destinatario) ni se reenvía la notificación si el estado ya es `ENVIADO`.
4. **Given** una corrida que quedó en estado `FALLIDO`, **When** el job se reejecuta, **Then** reintenta la generación/envío para ese destinatario.
5. **Given** una corrida completada, **Then** se registra `AuditLog` con acción `ANALISIS_DIGEST_GENERADO` (y `ANALISIS_DIGEST_ENVIADO` o `ANALISIS_DIGEST_FALLIDO` según resultado), `usuarioId = null`, `ipAddress = "worker"` y solo metadatos agregados (periodo, conteos), nunca textos de reportes.

---

### User Story 2 — El digest contiene las 6 secciones decididas en D-78 (Priority: P1)

Como CEO quiero que el resumen semanal incluya top 5 decisiones, KPIs vs semana anterior, anomalías, ganadores y perdedores, recomendaciones del sistema y enlace directo al panel, para saber qué debo hacer HOY sin abrir el sistema.

**Why this priority**: el contenido es el valor del digest; un email vacío o genérico no cumple la filosofía "no dashboards — decisiones".

**Independent Test**: sembrar 7 `Recomendacion` PENDIENTE con prioridades distintas, pagos autorizados en la semana actual y la previa, y `ScoreCliente` del período; generar el digest y verificar que el contenido renderizado incluye las 6 secciones con los valores correctos.

**Acceptance Scenarios**:

1. **Given** 7 recomendaciones PENDIENTE, **When** se genera el digest, **Then** `top5Decisiones` contiene las 5 de mayor prioridad (título + descripción + acción sugerida) y ninguna en estado APLICADA/IGNORADA/EXPIRADA.
2. **Given** pagos `AUTORIZADO` en la semana actual y la anterior, **When** se calculan los KPIs, **Then** `kpisSemana` incluye recaudo, nuevas suscripciones, canceladas, churn rate y score promedio, y `kpisVsPrevia` incluye el delta de cada métrica vs la semana previa.
3. **Given** anomalías registradas en la semana (modelo `Anomalia` de SPEC-225 disponible), **When** se genera el digest, **Then** se listan con severidad y enlace; **Given** que SPEC-225 aún no está implementado, **Then** la sección se renderiza vacía ("Sin anomalías esta semana") sin error.
4. **Given** snapshots `ScoreCliente` del período, **When** se genera el digest, **Then** se incluyen top 3 y bottom 3 por `scoreTotal` con nombre del cliente (colegio/padre titular de la suscripción).
5. **Given** el contenido, **Then** incluye `enlacePanel` apuntando a `/dashboard/admin/estadisticas/dinero-vs-valor` y recomendaciones del sistema derivadas de reglas (ej. crecimiento/caída por ciudad sobre el umbral parametrizado).
6. **Given** cualquier digest, **Then** su contenido es 100% datos agregados de negocio (suscripciones, pagos, scores): nunca incluye textos de reportes, identificadores reportados ni datos personales de menores.

---

### User Story 3 — El envío se hace por Motor Notificaciones (email + in-app) (Priority: P1)

Como sistema quiero publicar el digest a través de `motor.programar()` con el evento `analisis.digest.semanal`, para que el envío herede canales, preferencias de opt-out, quiet hours, reintentos y trazabilidad del Motor de Notificaciones ya en producción.

**Why this priority**: el instructivo manda usar `motor.programar`; enviar por fuera duplicaría infraestructura y rompería las preferencias del usuario (D-70).

**Independent Test**: ejecutar la generación con un destinatario ADMIN y verificar que `Notificacion` queda encolada con evento `analisis.digest.semanal` en canales EMAIL e IN_APP; deshabilitar la preferencia `analisis.digest.semanal.email` del usuario y verificar que el canal email se omite.

**Acceptance Scenarios**:

1. **Given** el seed, **Then** existen el evento/regla `analisis.digest.semanal` para canales EMAIL e IN_APP (opt-out permitido, `obligatoria = false`) y sus plantillas en español con variables `{{...}}`, sembrados de forma idempotente.
2. **Given** un digest generado, **When** se invoca `motor.programar`, **Then** se crean notificaciones por destinatario y canal con las variables del digest (`periodo`, `fechaInicio`, `fechaFin`, `top5`, `kpis`, `anomalias`, `ganadores`, `perdedores`, `recomendaciones`, `enlacePanel`).
3. **Given** un destinatario con opt-out del canal email, **When** se programa, **Then** el motor omite ese canal y el digest NO se marca como fallido (el envío por los canales habilitados basta).
4. **Given** que no existen reglas activas para el evento (motor sin catálogo), **When** `programar` retorna 0 programadas, **Then** el digest queda en estado `FALLIDO` con motivo documentado y `AuditLog` `ANALISIS_DIGEST_FALLIDO`.
5. **Given** el motor en producción, **Then** el email sale en texto plano (limitación actual de `enviarEmailNotificacion`, ver research.md §4); la plantilla se redacta en Markdown legible como texto y la versión HTML con branding queda diferida a que el motor soporte HTML.

---

### User Story 4 — Destinatarios configurables sin deploy (Priority: P2)

Como admin quiero configurar los destinatarios del digest desde parámetros del sistema, para incluir al equipo directo sin tocar código.

**Why this priority**: el brief deja abierto si el digest va solo al CEO o también a su equipo (§17.2); parametrizarlo resuelve la pregunta sin bloquear la feature.

**Independent Test**: configurar `analisis.digest.destinatarios_emails` con dos correos, ejecutar el job y verificar que se genera digest para ambos; dejar el parámetro vacío y verificar que el digest va a todos los usuarios ADMIN activos.

**Acceptance Scenarios**:

1. **Given** `analisis.digest.destinatarios_emails` con correos separados por coma, **When** corre el job, **Then** los destinatarios son exactamente esos correos (resueltos a `usuarioId` cuando el correo pertenece a un usuario; si no, envío por email registrado en metadatos de auditoría).
2. **Given** el parámetro vacío o ausente, **When** corre el job, **Then** los destinatarios son todos los usuarios con rol `ADMIN` y estado activo.
3. **Given** un correo mal formado en el parámetro, **When** corre el job, **Then** se omite con `console.warn` y no rompe el envío a los demás.
4. **Given** ningún destinatario resoluble, **When** corre el job, **Then** no se envía nada, queda `AuditLog` `ANALISIS_DIGEST_FALLIDO` con motivo `sin_destinatarios` y el job termina sin excepción.

---

### User Story 5 — Parámetros `analisis.digest.*` sembrados y editables (Priority: P2)

Como admin quiero cambiar el día, la hora y los destinatarios del digest desde `/dashboard/admin/configuracion`, para tunear la operación sin deploy.

**Why this priority**: filosofía del módulo (D-75): todo peso, umbral y frecuencia es parametrizable.

**Independent Test**: verificar en Prisma Studio que existen `analisis.digest.dia_semana`, `analisis.digest.hora_bogota`, `analisis.digest.destinatarios_emails` y `analisis.digest.enabled`; cambiar `enabled` a `false`, correr el job y verificar que se omite con log.

**Acceptance Scenarios**:

1. **Given** el seed ejecutado dos veces, **Then** los parámetros `analisis.digest.*` existen una sola vez con sus valores por defecto (upsert idempotente).
2. **Given** `analisis.digest.enabled = false`, **When** dispara el schedule, **Then** el job se omite con log informativo y no genera ni envía nada.
3. **Given** un cambio de `dia_semana` u `hora_bogota`, **When** el worker reinicia, **Then** el cron de pg-boss se registra con el nuevo valor (el schedule se deriva de los parámetros al arranque).

---

## Edge Cases

- **Semana sin actividad**: sin pagos, sin recomendaciones y sin scores, el digest se genera igual con las secciones en cero/"sin datos"; nunca se aborta por contenido vacío.
- **Frontera de año ISO**: la semana `W01`/`W52`-`W53` se calcula con la semana ISO sobre la fecha en America/Bogota (no UTC), evitando cortes erróneos el 31 de diciembre / 1 de enero.
- **Frontera 23:59/00:01 Bogotá**: la ventana `[desde, hasta)` se calcula con `date-fns-tz`; un pago autorizado el domingo 23:59 Bogotá cuenta en la semana que cierra, no en la siguiente.
- **Retry de pg-boss tras caída del worker**: la unicidad `(periodo, destinatarioId)` y el guard por estado `ENVIADO` hacen la reejecución no-op; un `FALLIDO` sí se reintenta.
- **Fallo parcial de un destinatario**: un error con un destinatario no detiene a los demás (molde `enviarResumenesSemanales`); cada digest registra su propio estado.
- **Motor Notif sin reglas activas**: `programar` retorna `{ programadas: 0 }` → digest `FALLIDO` con motivo, sin lanzar excepción al worker.
- **Todos los destinatarios con opt-out**: las notificaciones se omiten por preferencia; el digest queda `ENVIADO` con `programadas = 0` documentado en metadatos (la preferencia del usuario manda, D-70).
- **Score sin snapshots**: si SPEC-220 aún no calculó `ScoreCliente` del período, ganadores/perdedores sale vacío y el score promedio es `null` (renderizado como "—").
- **Anomalías sin SPEC-225**: la sección se renderiza "Sin anomalías esta semana"; no se importa código de SPEC-225 de forma acoplada.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE registrar en pg-boss el schedule `analisis-digest-semanal` con cron derivado de `analisis.digest.dia_semana` y `analisis.digest.hora_bogota`, con `{ tz: "America/Bogota" }`, siguiendo el molde de `motor-deriva-semanal` en `scripts/worker-reportes.mjs`.
- **FR-002**: El sistema DEBE implementar la lógica en `src/lib/analisis/digest-semanal.ts` exportando `ejecutarDigestSemanal(ahora?: Date)` (handler del schedule) y `generarDigestSemanal(destinatario, ventana)` (un digest), de modo que `worker-reportes.mjs` quede delgado y la lógica sea testeable.
- **FR-003**: La ventana DEBE ser la semana operativa anterior lunes-domingo en America/Bogota (`[desde, hasta)`), calculada con `date-fns-tz`; el `periodo` DEBE ser la semana ISO Bogotá en formato `"YYYY-Wnn"`.
- **FR-004**: El sistema DEBE persistir un `DigestSemanal` por destinatario con upsert por `(periodo, destinatarioId)` y estados `GENERADO | ENVIADO | FALLIDO`; una corrida sobre un digest ya `ENVIADO` es no-op.
- **FR-005**: El digest DEBE incluir: (1) top 5 `Recomendacion` PENDIENTE por prioridad, (2) KPIs de la semana (recaudo, nuevas suscripciones, canceladas, churn rate, score promedio) con delta vs semana anterior, (3) anomalías de la semana (vacío si SPEC-225 no está), (4) top 3 y bottom 3 de `ScoreCliente`, (5) recomendaciones del sistema, (6) `enlacePanel` a `/dashboard/admin/estadisticas/dinero-vs-valor`.
- **FR-006**: El recaudo DEBE calcularse sobre `Pago` con estado `AUTORIZADO` y `fechaAutorizacion` en la ventana; las nuevas/canceladas sobre `Suscripcion.createdAt` / `canceladaEn` en la ventana; el churn rate y score promedio según las definiciones documentadas en `data-model.md`.
- **FR-007**: El contenido del digest DEBE ser exclusivamente datos agregados de negocio; PROHIBIDO incluir textos de reportes, identificadores reportados, ni datos personales de menores.
- **FR-008**: El sistema DEBE sembrar de forma idempotente el evento `analisis.digest.semanal` en Motor Notif con reglas para canales `EMAIL` e `IN_APP` (`obligatoria = false`) y sus plantillas en español con variables `{{...}}`.
- **FR-009**: El envío DEBE hacerse exclusivamente vía `motor.programar()` de `src/lib/notificaciones/motor.ts`; prohibido enviar el digest por Resend directo o escribir `Notificacion` desde este módulo.
- **FR-010**: Los destinatarios DEBEN resolverse desde `analisis.digest.destinatarios_emails` (lista separada por comas) y, si está vacío, desde los usuarios `ADMIN` activos; correos mal formados se omiten con warn.
- **FR-011**: El sistema DEBE registrar `AuditLog` SYSTEM (`usuarioId = null`, `ipAddress = "worker"`) con acciones `ANALISIS_DIGEST_GENERADO`, `ANALISIS_DIGEST_ENVIADO` y `ANALISIS_DIGEST_FALLIDO` (valores aditivos del enum `AccionAudit`), solo con metadatos agregados.
- **FR-012**: El sistema DEBE sembrar los parámetros `analisis.digest.enabled` (BOOLEAN, default `true`), `analisis.digest.dia_semana` (INTEGER, default `1`), `analisis.digest.hora_bogota` (INTEGER, default `8`) y `analisis.digest.destinatarios_emails` (STRING, default `""`) con upsert idempotente.
- **FR-013**: Si `analisis.digest.enabled = false`, el handler DEBE omitir la ejecución con log informativo.
- **FR-014**: Un fallo con un destinatario NO DEBE detener el procesamiento de los demás; cada digest registra su propio estado y error (máx 500 chars).
- **FR-015**: Si `motor.programar` retorna 0 notificaciones programadas por ausencia de reglas activas, el digest DEBE quedar `FALLIDO` con motivo documentado; si se omiten por preferencia del usuario, el digest queda `ENVIADO` con el detalle en metadatos.
- **FR-016**: El sistema DEBE incluir tests unitarios/integración de: cálculo de ventana y periodo ISO en fronteras (23:59/00:01, cambio de año), idempotencia de generación y reintento de FALLIDO, cálculo de KPIs con datos sembrados, resolución de destinatarios (param / default ADMIN / correo inválido / sin destinatarios), opt-out respetado, motor sin reglas → FALLIDO, y seed idempotente.
- **FR-017**: La especificación NO introduce endpoints HTTP nuevos; la configuración se hace por `ParametroSistema` ya editable en `/dashboard/admin/configuracion` (D-72).

### Key Entities

- **DigestSemanal** (definida en brief §5.5; la crea SPEC-220 — ver `data-model.md`): `id`, `periodo` (`"2026-W34"`), `destinatarioId` (admin), `generadoEn`, `enviadoEn`, `top5Decisiones` (Json), `kpisSemana` (Json), `kpisVsPrevia` (Json), `enlacePanel`, `estado` (`GENERADO | ENVIADO | FALLIDO`), único por `(periodo, destinatarioId)`.
- **Recomendacion** (SPEC-221): fuente del top 5 (`estado = PENDIENTE`, orden `prioridad DESC`).
- **ScoreCliente** (SPEC-220): fuente de ganadores/perdedores y score promedio.
- **Anomalia** (SPEC-225, opcional): fuente de la sección de anomalías.
- **Suscripcion / Pago** (existentes): fuente de recaudo, nuevas, canceladas y churn.
- **Notificacion / NotificacionRegla / NotificacionPlantilla** (SPEC-201): catálogo y cola del Motor Notif; esta spec solo añade registros sembrados.
- **ParametroSistema**: parámetros `analisis.digest.*`.
- **AuditLog**: trazabilidad SYSTEM de generación/envío/fallo.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En la primera corrida del schedule tras el lunes 08:00 Bogotá, el digest de la semana anterior queda generado y programado en Motor Notif para todos los destinatarios resueltos, sin intervención manual.
- **SC-002**: Una reejecución del job en la misma semana no crea filas `DigestSemanal` duplicadas ni reenvía notificaciones (0 duplicados en 2 corridas consecutivas).
- **SC-003**: Los cortes de semana en frontera 23:59/00:01 America/Bogota y en cambio de año ISO asignan cada dato a la semana correcta en los tests.
- **SC-004**: Con `analisis.digest.destinatarios_emails` vacío, el digest llega a todos los ADMIN activos; con correos configurados, llega exactamente a esos correos.
- **SC-005**: Un destinatario con opt-out del canal email deja de recibir el digest por email sin marcar el digest como fallido.
- **SC-006**: Cada corrida deja `AuditLog` SYSTEM (`usuarioId = null`) con resultado y metadatos agregados, sin textos de reportes.
- **SC-007**: El gate local completo (`npx tsc --noEmit`, `npm run lint --no-cache`, `npm run test:unit`, `npm run build`) queda verde.

---

## Assumptions

- SPEC-220 crea los modelos del módulo Análisis (brief §5.1–5.7, incluido `DigestSemanal` y `ScoreCliente`) y el seed de parámetros `analisis.*` base en la misma rama del mega-lote, antes o junto con esta spec. Si `DigestSemanal` aún no existe al implementar, esta spec lo añade con migración ADITIVA siguiendo §5.5 del brief (ver `data-model.md`).
- SPEC-221 entrega `Recomendacion` con `estado`, `prioridad`, `titulo`, `descripcion` y `accionSugerida`; esta spec solo las LEE.
- SPEC-225 (`Anomalia`) corre en paralelo; el digest degrada graceful si el modelo no existe (sección vacía).
- Motor Notificaciones (SPEC-201..204) ya está en producción y expone `motor.programar()`; esta spec no modifica el motor, solo siembra evento/reglas/plantillas.
- El envío de email del Motor Notif es hoy texto plano (`src/lib/email.ts` `enviarEmailNotificacion` usa solo `text:`); la plantilla se redacta en Markdown legible como texto y el HTML con branding del brief §11 queda diferido a que el motor soporte HTML (no se toca el motor en esta spec).
- La pregunta del brief §17.2 (¿solo CEO o también equipo directo?) se resuelve por parámetro: default = todos los usuarios ADMIN activos; configurable vía `analisis.digest.destinatarios_emails`.
- El schedule se registra en `scripts/worker-reportes.mjs` (molde `motor-deriva-semanal`); no se crea un worker nuevo para el digest.
- Todos los cálculos de semana usan `America/Bogota` con `date-fns-tz` (D-69); la BD permanece en UTC.
- Terminología criolla: estados y acciones nuevas en español (`GENERADO`, `ENVIADO`, `FALLIDO`, `ANALISIS_DIGEST_*`).

---

## Implementación *(por completar al cerrar)*

### Resumen de cambios

*(Se completará tras la implementación con la lista exacta de archivos, migraciones, eventos sembrados y tests.)*

### Decisiones ejecutadas

*(Se completará tras compuertas de revisión.)*

### Gate local

*(Se completará tras validación.)*

### Deuda técnica / notas

*(Se completará al cerrar.)*
