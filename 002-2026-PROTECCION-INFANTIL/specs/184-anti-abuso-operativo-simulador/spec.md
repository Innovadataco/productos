# Feature Specification: SPEC-184 — Anti-abuso operativo + simulador de abusos

**Feature Branch**: `work/002-pi-079`

**Created**: 2026-08-19

**Status**: PLANEADO

**Input**: El actual `/dashboard/admin/anti-abuso` es solo un simulador de scoring que compara score actual vs. ajustado por fuente. El CEO probó y no cubre la necesidad operativa de "ver quién está atacando y actuar". Esta spec reemplaza la vista por un tablero operativo real anti-abuso, añade una blocklist persistente, alertas por email throttled cuando hay picos de bloqueos, y un simulador de abusos que inyecta reportes reales por IPs de test (RFC 5737) para validar las defensas.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El admin ve quién está atacando y actúa (Priority: P1)

Como administrador quiero un tablero operativo que me muestre las IPs bloqueadas por rate-limit, los identificadores más reportados, los fingerprints repetidores y las alertas activas, para detectar abuso y tomar decisiones sin adivinar.

**Why this priority**: el simulador de scoring actual no ayuda a operar; el CEO necesita ver ataques reales y actuar (bloquear/desbloquear IPs) desde la misma pantalla.

**Independent Test**: abrir `/dashboard/admin/anti-abuso`, seleccionar ventana 24h/7d/30d y verificar que los tops y alertas cuadran con los datos de `RateLimit`, `Reporte` y `FuenteReporte`.

**Acceptance Scenarios**:

1. **Given** el tablero operativo, **Then** muestra top IPs bloqueadas por rate-limit en la ventana seleccionada, sin exponer la IP en claro (solo `ipHash`).
2. **Given** el tablero, **Then** muestra top identificadores más reportados en la ventana.
3. **Given** el tablero, **Then** muestra top fingerprints repetidores (más reportes asociados) en la ventana.
4. **Given** una IP o fingerprint sospechoso, **When** el admin hace clic en "Bloquear IP", **Then** aparece un modal que exige motivo y permite elegir duración (24h, 7d o permanente); al confirmar, la IP pasa a `BlockList` y se registra en `AuditLog`.
5. **Given** una IP en `BlockList`, **When** el admin hace clic en "Desbloquear", **Then** la entrada se elimina (o marca con `expiraEn` anterior) y se registra en `AuditLog`.
6. **Given** el tablero, **Then** la sección "Alertas activas" lista blocklists vigentes y spikes recientes de rate-limit, con link a detalle.

---

### User Story 2 — Blocklist persistente frena IPs antes de gastar cuota (Priority: P1)

Como sistema quiero consultar una blocklist persistente antes de contar rate-limit, para que una IP baneada reciba 429 inmediatamente sin consumir su ventana ni pasar al pipeline de reportes.

**Why this priority**: sin blocklist persistente, un atacante puede seguir generando reportes hasta llenar el pipeline; la blocklist debe cortar antes del contador.

**Independent Test**: banear una IP de test (RFC 5737) desde el tablero y luego intentar crear un reporte desde esa IP; debe responder 429 inmediatamente y el contador de `RateLimit` no debe incrementarse para esa IP.

**Acceptance Scenarios**:

1. **Given** una IP cuyo `ipHash` existe en `BlockList` y aún no expira, **When** llega cualquier request sujeta a rate-limit, **Then** `checkRateLimit` devuelve 429 antes de tocar `RateLimit` y sin incrementar contadores.
2. **Given** una IP baneada, **When** el admin desbloquea la IP, **Then** las siguientes requests pasan al rate-limit normal.
3. **Given** un bloqueo con `expiraEn` futuro, **When** se supera esa fecha, **Then** la IP ya no está bloqueada (el repositorio filtra vigentes).
4. **Given** un fallo al consultar `BlockList`, **Then** el sistema falla abierto (permite la request) y loguea el error, para no bloquear todo el tráfico por latencia de BD.

---

### User Story 3 — Alerta email throttled ante pico de bloqueos (Priority: P2)

Como administrador quiero recibir un email cuando una IP concreta acumula muchos bloqueos por rate-limit en una hora, pero no uno por cada request, para enterarme sin spam.

**Why this priority**: un ataque real genera cientos de 429; sin throttle, la bandeja se inunda y deja de ser útil.

**Independent Test**: simular 25 bloqueos desde una misma IP en menos de una hora y verificar que llega solo 1 email (respetando `alerts.ratelimit.throttle_min`) y que se abre un `IncidenteInfra` asociado.

**Acceptance Scenarios**:

1. **Given** una IP que supera `alerts.ratelimit.umbral_bloqueos_hora` bloqueos en una hora, **When** se confirma el pico, **Then** se envía un email a `alerts.ratelimit.destinatarios` con el `ipHash`, la cantidad de bloqueos y la ventana.
2. **Given** un email ya enviado por el mismo pico, **When** siguen llegando bloqueos dentro de `alerts.ratelimit.throttle_min`, **Then** no se envía otro email.
3. **Given** `alerts.ratelimit.enabled = false`, **Then** no se envían emails, pero sí se registran en `AuditLog`.
4. **Given** el pico, **Then** se abre/actualiza un `IncidenteInfra` con señal `rate_limit:<scope>:<ipHash>` para seguimiento.

---

### User Story 4 — Simulador de abusos con reportes reales (Priority: P1)

Como administrador quiero lanzar escenarios predefinidos de ataque (robot, ataque coordinado, IPs rotativas, denunciante spam, personalizado) para ver cómo responden rate-limit, scoring y detección de spam, usando reportes que entran al pipeline real.

**Why this priority**: estamos en pruebas, el CEO es el único usuario y la BD se limpia al final; necesita validar las defensas con tráfico real sin marcar los reportes como simulación.

**Independent Test**: lanzar el escenario "Robot inundando" desde la UI, ver que los reportes se crean con estado normal (PENDIENTE/CLASIFICADO/POSIBLE_SPAM), que algunos son bloqueados por rate-limit, y que el progreso se actualiza en vivo.

**Acceptance Scenarios**:

1. **Given** el simulador, **Then** el admin elige uno de 5 escenarios: robot inundando, ataque coordinado, IPs rotativas + mismo fingerprint, denunciante spam, personalizado.
2. **Given** un escenario, **When** se lanza, **Then** el sistema realiza POST HTTP reales a `/api/reportes` inyectando `x-forwarded-for` dentro de los rangos RFC 5737 (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`).
3. **Given** una IP inyectable fuera de RFC 5737 (ej. `8.8.8.8`), **When** se lanza el simulador, **Then** devuelve 400 con mensaje claro antes de crear reportes.
4. **Given** el simulador en curso, **Then** la UI muestra en vivo: reportes exitosos (201), bloqueados por rate-limit (429), reportes marcados como `POSIBLE_SPAM`, latencia por reporte y link al tablero anti-abuso.
5. **Given** el simulador en curso, **When** el admin pulsa "Cancelar", **Then** el ciclo se detiene (no se envían más reportes), los ya creados siguen su curso normal y se registra en `AuditLog`.
6. **Given** una simulación finalizada, **Then** queda registrada quién la lanzó, qué escenario, cuándo y los resultados agregados, sin texto de reportes.

---

### Edge Cases

- **IP baneada pero con usuario autenticado**: la blocklist actúa por IP, no por identidad; el request sigue siendo 429.
- **Desbloqueo durante una ventana de rate-limit activa**: la IP vuelve a contar desde cero en la siguiente ventana.
- **Simulación personalizado con N=0 o IP inválida**: validación Zod rechaza antes de tocar la BD o el worker.
- **Worker del simulador caído mientras hay una corrida `EN_PROGRESO`**: el admin puede cancelarla manualmente; no se reinicia automáticamente para evitar sorpresas.
- **Ollama lento**: cada reporte real tarda ~1.5 min en la Mac del CEO; el simulador procesa secuencialmente y la UI muestra progreso y latencia por reporte.
- **Deduplicación de reportes**: el pipeline real puede marcar reportes del simulador como `DUPLICADO`; eso se cuenta como resultado válido en la UI.
- **Blocklist con expiraEn en el pasado**: el repositorio la filtra como no vigente; un desbloqueo explícito borra la fila.
- **Rate-limit desactivado (`DISABLE_RATE_LIMIT=true`)**: la blocklist sigue funcionando; el simulador puede crear más reportes antes de ser bloqueado.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar en `/dashboard/admin/anti-abuso` un tablero operativo con: top IPs bloqueadas por rate-limit, top identificadores más reportados, top fingerprints repetidores y alertas activas, filtrables por 24h/7d/30d.
- **FR-002**: El tablero DEBE mostrar `ipHash` (no IP en claro) para todas las IPs.
- **FR-003**: El sistema DEBE permitir a un ADMIN bloquear una IP por 24h, 7d o permanentemente, exigiendo motivo y registrando en `AuditLog`.
- **FR-004**: El sistema DEBE permitir a un ADMIN desbloquear una IP, registrando en `AuditLog`.
- **FR-005**: El sistema DEBE consultar `BlockList` antes de contar rate-limit; si el `ipHash` de la request está bloqueado, devolver 429 inmediato sin incrementar `RateLimit`.
- **FR-006**: `checkRateLimit` DEBE soportar la consulta de `BlockList` de forma best-effort; si falla, fallar abierto y loguear.
- **FR-007**: El sistema DEBE enviar un email throttled a los destinatarios configurados cuando una IP supere el umbral de bloqueos por hora, abriendo o actualizando un `IncidenteInfra` asociado.
- **FR-008**: El sistema DEBE exponer el endpoint `/api/admin/anti-abuso/simular` para lanzar escenarios de abuso con reportes reales, validando que las IPs inyectables estén en rangos RFC 5737.
- **FR-009**: El simulador DEBE soportar 5 escenarios predefinidos: robot inundando, ataque coordinado, IPs rotativas + mismo fingerprint, denunciante spam, personalizado.
- **FR-010**: El simulador DEBE realizar POST HTTP reales a `/api/reportes` con `x-forwarded-for` inyectable; los reportes DEBEN entrar al pipeline real sin flag de simulación.
- **FR-011**: El sistema DEBE permitir cancelar una simulación en curso desde la UI, deteniendo nuevos reportes sin afectar los ya creados.
- **FR-012**: El sistema DEBE persistir el estado y resultados de cada simulación (pendiente/en progreso/completada/cancelada/fallida), quién la lanzó, escenario y conteos.
- **FR-013**: El sistema DEBE auditar cada simulación (inicio, cancelación, finalización) en `AuditLog` sin incluir textos de reportes.
- **FR-014**: El sistema DEBE conservar el simulador de scoring actual como tab secundario ("Scoring por fuente") o retirarlo si ZEUS/CEO deciden que no aporta.
- **FR-015**: El sistema DEBE sembrar los parámetros `alerts.ratelimit.*` en `prisma/seed.ts` de forma idempotente.
- **FR-016**: El sistema DEBE añadir `BlockList` y los valores de `AccionAudit` necesarios mediante migración aditiva, sin DROP.

### Key Entities

- **BlockList**: bloqueo persistente por `ipHash`. Atributos: `ipHash` (único), `motivo`, `expiraEn` (nullable), `creadoPorId`, `creadoEn`, `actualizadoEn`.
- **SimulacionAbusoRun**: corrida del simulador. Atributos: `escenario`, `totalReportes`, `progreso`, `estado`, `configJson`, `resultadosJson`, `creadoPorId`, timestamps.
- **RateLimit**: existente; fuente de los tops de IPs bloqueadas y de las alertas de pico.
- **FuenteReporte**: existente; fuente de los tops de fingerprints repetidores.
- **Reporte / IdentificadorReportado**: existentes; fuente de los tops de identificadores más reportados.
- **IncidenteInfra**: existente; usado para el seguimiento de picos de rate-limit.
- **AuditLog**: existente; registra bloqueos, desbloqueos, inicio/cancelación/fin de simulaciones.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un admin puede bloquear una IP y, en menos de 1 segundo, un reporte desde esa IP recibe 429 sin incrementar su contador de `RateLimit`.
- **SC-002**: El tablero operativo carga en menos de 3 segundos con ventana de 24h y muestra al menos los 3 tops solicitados.
- **SC-003**: Una IP que genera 25 bloqueos en una hora dispara exactamente 1 email dentro de la ventana de throttle configurada.
- **SC-004**: El simulador rechaza una IP como `8.8.8.8` con 400 antes de crear ningún reporte.
- **SC-005**: El simulador con escenario "robot inundando" crea reportes reales, algunos pasan al pipeline y otros son bloqueados por rate-limit; la UI refleja progreso y latencia.
- **SC-006**: El gate local completo (`tsc`, `lint`, `test`, `build`, `dev-restart`) queda verde.

---

## Assumptions

- Las IPs del simulador están restringidas a los rangos de test RFC 5737; cualquier otra IP es rechazada para evitar reportes reales contra terceros.
- Los reportes generados por el simulador NO llevan flag de simulación (decisión CEO explícita) y entran al pipeline real, incluyendo Ollama, scoring y posible duplicación.
- El simulador corre como proceso separado (`scripts/simulador-abuso.mjs`) con advisory lock de PostgreSQL, igual que el worker de reportes y el monitor de probes.
- La blocklist actúa por `ipHash` (SHA-256 con `ANTI_ABUSO_SALT`), nunca por IP en claro, preservando la frontera de privacidad existente.
- El simulador de scoring actual se conserva como tab secundario a menos que ZEUS decida retirarlo en la compuerta §4.
- El costo de Ollama (~1.5 min/reporte) es aceptado por el CEO para las pruebas; el simulador procesa secuencialmente y muestra latencia real.
- La blocklist es global (sin tenant) porque los ataques pueden cruzar identidades y el anti-abuso opera sobre fuentes, no sobre instituciones.
- El escenario "denunciante spam" requiere un usuario PARENT de prueba existente (a seleccionar en la UI o por variable de entorno); si no existe, ese escenario falla con 400.
