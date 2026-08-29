# Feature Specification: SPEC-171 — Pilar B · Tablero Operativo

**Feature Branch**: `work/002-pi-nocturno-20260817`

**Created**: 2026-08-17

**Status**: IMPLEMENTADO

**Implementación** (2026-08-18): ver [cierre.md](./cierre.md). 6 semáforos + incidentes con re-probe + email throttled + widgets + fusión Clasificación como sub-tab + ConfigPanel Monitoreo (13 params). Smoke con modelo vigente del motor (decisión ZEUS). Migración aditiva (I-53 intacta).

Impacto en arquitectura: añade modelos `HealthProbe` e `IncidenteInfra` (migración aditiva) + valores nuevos al enum `AccionAudit`, worker nuevo `scripts/monitor-probes.mjs`, endpoints `/api/admin/monitoreo/*`, renovación de `/dashboard/admin/estadisticas/operacion` (6 semáforos + widgets + fusión de Clasificación como sub-tab), 12 parámetros `monitoreo.*` en seed y sección "Monitoreo" en ConfigPanel.

**Input**: Tarea nocturna 2026-08-17, Bloque 3 (Pilar B, ACTA_ARQ_07). Contexto: hoy `/dashboard/admin/estadisticas/operacion` muestra métricas de negocio y cola, y `/dashboard/admin/monitoreo/worker` solo ve worker+BD (I-51: el monitor es ciego a Ollama — si el cerebro de clasificación cae, nadie se entera hasta que los reportes se acumulan). Esta spec renueva el tablero con 6 semáforos vivos (app, worker, BD, Ollama-ping, Ollama-smoke, Tailscale), auto-recuperación sin acciones destructivas con email throttled, widgets de SLA/atascados/cola/errores, y fusiona la página "Clasificación" como sub-tab de Operación.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El admin ve 6 semáforos vivos de infraestructura (Priority: P1)

Como admin quiero ver de un vistazo si app, worker, BD, Ollama (ping y smoke real) y Tailscale están sanos, para enterarme de una caída antes que los usuarios.

**Why this priority**: I-51 — hoy una caída de Ollama es invisible; el pipeline de clasificación se detiene sin ninguna señal.

**Independent Test**: abrir `/dashboard/admin/estadisticas/operacion` y verificar los 6 semáforos con estado verde/amarillo/rojo, último chequeo y autorefresco.

**Acceptance Scenarios**:

1. **Given** el tablero operación, **Then** muestra exactamente 6 semáforos: App, Worker, Base de datos, Ollama (ping), Ollama (smoke), Tailscale.
2. **Given** un semáforo, **Then** muestra estado (verde/amarillo/rojo), hora del último chequeo y un hint de qué significa en criollo (ej. "Ollama smoke = el cerebro respondió una clasificación mínima real").
3. **Given** el tablero, **Then** se autorefresca cada `monitoreo.autorefresh_seg` segundos (default 30) sin recargar la página.
4. **Given** Ollama caído (o apuntando a un puerto muerto), **When** corre el probe, **Then** el semáforo Ollama-ping pasa a rojo en ≤ 2 intervalos de probe.
5. **Given** el smoke real de Ollama, **Then** ejecuta una generación mínima contra el modelo configurado cada `monitoreo.ollama.smoke.intervalo_min` minutos (default 5) — no un simple listado de modelos.

---

### User Story 2 — Rojo dispara re-probe, incidente y email throttled (Priority: P1)

Como admin quiero que un semáforo en rojo se confirme con un re-probe, quede registrado como incidente y dispare un email sin inundar la bandeja, para actuar con evidencia y sin ruido.

**Why this priority**: la auto-recuperación del CEO es explícita: SIN acciones destructivas (nada de reiniciar/matar procesos) — solo re-probe + escalado humano por email.

**Independent Test**: provocar un rojo controlado (ej. OLLAMA_BASE_URL a puerto muerto en test) y verificar: re-probe → `IncidenteInfra` abierto → 1 solo email en la ventana de throttle → al recuperarse, incidente resuelto.

**Acceptance Scenarios**:

1. **Given** un probe en rojo, **When** falla, **Then** el monitor re-prueba tras `monitoreo.reprobe.segundos` (default 60); solo abre incidente si el re-probe también falla.
2. **Given** un incidente abierto, **Then** se persiste `IncidenteInfra` (tipo, inicio, detalle, estado `ABIERTO`) y se audita en `AuditLog`.
3. **Given** un incidente abierto, **Then** se envía email a `monitoreo.email.destinatarios` con el semáforo, desde cuándo y el detalle — máximo 1 email por tipo de incidente cada `monitoreo.email.throttle_min` minutos (default 30).
4. **Given** un incidente cuyo probe vuelve a verde, **Then** el incidente pasa a `RESUELTO` con su hora de cierre (y opcional email de recuperación si `monitoreo.email.al_recuperar` está activo).
5. **Given** el monitor, **Then** NUNCA ejecuta reinicios, kills, purgas ni escrituras destructivas: su única acción automática es re-probar y notificar.

---

### User Story 3 — Widgets operativos: SLA, atascados, cola y errores (Priority: P2)

Como admin quiero en el mismo tablero los cuellos de botella operativos (SLA de gestión, reportes atascados, estado de la cola, errores recientes), para priorizar el día sin navegar a otra pantalla.

**Why this priority**: consolida lo que hoy está disperso (cola ya existe en AdminDashboard; SLA/tiempos en Clasificación).

**Independent Test**: abrir operación y verificar los 4 widgets con números consistentes con las fuentes actuales.

**Acceptance Scenarios**:

1. **Given** el widget de cola, **Then** reusa las métricas pg-boss existentes (`queue-metrics.ts`: enCola, activos, estancados, completados, fallidos, latencia, tasa de éxito).
2. **Given** el widget de atascados, **Then** muestra reportes en estados intermedios (PENDIENTE/PROCESANDO/REVISION_MANUAL/REQUIERE_ANONIMIZACION) por encima de su umbral de antigüedad configurable.
3. **Given** el widget SLA, **Then** muestra el tiempo promedio de gestión y el conteo de casos por franja (al día / por vencer / vencidos) con umbrales configurables.
4. **Given** el widget de errores, **Then** muestra los fallidos recientes de la cola y los incidentes de infra abiertos.
5. **Given** la página "Clasificación" actual, **Then** su contenido pasa a ser un sub-tab dentro de Operación (misma URL base, navegación por tabs internos) y la ruta vieja redirige.

---

### User Story 4 — ConfigPanel con sección "Monitoreo" (Priority: P2)

Como admin quiero configurar intervalos, umbrales, destinatarios y autorefresco del monitoreo desde Configuración, sin tocar código ni redesplegar.

**Why this priority**: decisión CEO (ACTA_ARQ_07): todos los parámetros configurables.

**Independent Test**: abrir Configuración → sección Monitoreo, cambiar `monitoreo.autorefresh_seg` y verificar que el tablero lo respeta tras guardar.

**Acceptance Scenarios**:

1. **Given** ConfigPanel, **Then** existe la sección "Monitoreo" con los 12 parámetros `monitoreo.*`, cada uno con label y descripción en criollo y validación por tipo.
2. **Given** el seed, **Then** crea los 12 parámetros con defaults seguros de forma idempotente.
3. **Given** un cambio de `monitoreo.ollama.ping.intervalo_seg`, **When** el monitor lee parámetros en cada ciclo, **Then** aplica el nuevo intervalo sin reiniciar el proceso.
4. **Given** `monitoreo.enabled = false`, **Then** el monitor no escribe probes nuevos y el tablero muestra "monitoreo desactivado".

---

### Edge Cases

- BD caída: el monitor no puede escribir el probe → registra el fallo en log y reintenta; no tumba el worker principal (proceso separado).
- Ollama smoke con modelo grande lento: timeout propio del smoke (parámetro) → rojo por timeout, no cuelga el ciclo.
- Tailscale no aplica en dev (Ollama localhost): el semáforo muestra "no aplica" si `monitoreo.tailscale.url` está vacía.
- Email caído (Resend error): se loguea y el incidente queda abierto; no se reintenta en loop.
- Dos monitores corriendo: advisory lock de PostgreSQL (patrón del worker actual) garantiza uno solo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE ejecutar probes periódicos de 6 señales: app (HTTP al health de la app), worker (frescura del heartbeat), BD (query trivial), Ollama-ping (`/api/tags`), Ollama-smoke (`/api/generate` mínima con timeout), Tailscale (reachability de la URL configurada).
- **FR-002**: Cada probe DEBE persistirse en `HealthProbe` (señal, resultado, latencia, detalle, timestamp) con retención configurable.
- **FR-003**: Un rojo DEBE confirmarse con re-probe antes de abrir `IncidenteInfra`; al volver a verde, el incidente se resuelve solo.
- **FR-004**: El sistema DEBE enviar email de incidente con throttle por tipo (1 por `throttle_min`), sin acciones destructivas jamás.
- **FR-005**: El tablero DEBE mostrar los 6 semáforos con estado, último chequeo y autorefresco configurable.
- **FR-006**: El tablero DEBE incluir widgets de cola (reusa `queue-metrics`), atascados, SLA y errores.
- **FR-007**: La página Clasificación DEBE fusionarse como sub-tab de Operación; la ruta anterior redirige (sin 404 para bookmarks).
- **FR-008**: El sistema DEBE declarar 12 parámetros `monitoreo.*` en seed (idempotente) y mostrarlos en ConfigPanel bajo la sección "Monitoreo" con labels en criollo y validación.
- **FR-009**: El monitor DEBE correr como proceso separado (`scripts/monitor-probes.mjs`) con advisory lock (exactamente uno) y leer parámetros en cada ciclo (cambios sin reinicio).
- **FR-010**: Todo cambio de estado de incidente DEBE registrarse en `AuditLog` (valores nuevos del enum `AccionAudit`, aditivos).
- **FR-011**: El tablero DEBE respetar el módulo de permisos existente (`estadisticas`) — sin claves nuevas.

### Key Entities

- **HealthProbe**: resultado de un chequeo (señal, ok, latenciaMs, detalle, creadoEn). Append-only, retención configurable.
- **IncidenteInfra**: incidente por señal en rojo confirmado (tipo, inicio, fin?, estado ABIERTO/RESUELTO, detalle, ultimoEmailEn para throttle).
- **Parámetros monitoreo.***: 12 claves de configuración del monitor y del tablero.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con Ollama apagado, el semáforo correspondiente está en rojo y hay email enviado en ≤ 3 minutos (ping 60 s + re-probe 60 s + envío).
- **SC-002**: Con todo sano, los 6 semáforos aparecen verdes y el tablero se autorefresca en el intervalo configurado (default 30 s).
- **SC-003**: Una ráfaga de 60 minutos en rojo genera como máximo ⌈60/throttle_min⌉ = 2 emails por tipo de incidente (default).
- **SC-004**: Los 12 parámetros son editables desde ConfigPanel y el monitor aplica cambios de intervalo sin reinicio en ≤ 1 ciclo.
- **SC-005**: La ruta `/dashboard/admin/estadisticas/clasificacion` redirige (no 404) y el contenido vive como sub-tab.
- **SC-006**: Gate local completo verde y CI del PR consolidado verde.

## Assumptions

- El monitor es un proceso separado (como el worker de reportes) arrancado por el supervisor/dev-restart; no un endpoint llamado por cron externo.
- "Auto-recuperación" = re-probe + resolución automática del incidente al volver el verde + notificación. Jamás reiniciar procesos (decisión CEO).
- El smoke de Ollama usa un modelo configurable (`monitoreo.ollama.smoke.modelo`); el default se valida con el CEO en compuerta (los modelos activos de prod son grandes; un smoke debe ser barato).
- Tailscale no aplica cuando Ollama es localhost (dev): semáforo en estado "no aplica" si no hay URL configurada.
- La fusión de Clasificación conserva todas sus métricas actuales (sin pérdida de funcionalidad); solo cambia su ubicación en la navegación.
- Email de infra usa Resend como el resto del sistema; destinatarios por parámetro (default: el email de soporte de la plataforma).
