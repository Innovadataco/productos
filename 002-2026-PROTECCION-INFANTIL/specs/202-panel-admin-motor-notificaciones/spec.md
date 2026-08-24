> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Feature Specification: SPEC-202 — Panel Admin del Motor de Notificaciones (002-PI-099)

**Feature Branch**: `work/002-PI-motor-notif-lote1`

**Created**: 2026-08-22

**Status**: `IMPLEMENTADO`

**Input**: 002-PI-099. Panel de administración del motor de notificaciones. Debe reutilizar módulos vivos, no crear rutas paralelas: entra como **sección de `/dashboard/admin/configuracion`** y el dashboard de salud como **tab de `/dashboard/admin/estadisticas`** o `/dashboard/admin/monitoreo` (según navegación actual). Fuente de diseño: [BRIEF-MOTOR-NOTIFICACIONES.md](../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MOTOR-NOTIFICACIONES.md) §4, §5, §7, §9.

Objetivo: dar al rol `ADMIN` herramientas para gestionar plantillas, reglas, parámetros y salud del motor; exponer endpoint de webhook Resend idempotente; permitir preview de plantilla con variables de ejemplo.

Impacto en arquitectura: nuevos endpoints bajo `src/app/api/admin/notificaciones/**`, componentes en `src/components/modules/admin/notificaciones/`, posible extensión de `AdminNav.tsx` y ajuste de rutas existentes. No se toca `src/lib/ai/**`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Bandeja de notificaciones enviadas (Priority: P1)

Como admin quiero ver todas las notificaciones del motor con filtros por estado, evento, canal y fecha, para auditar envíos y diagnóstico.

**Why this priority**: visibilidad operativa del motor.

**Independent Test**: `GET /api/admin/notificaciones` devuelve paginación con estados y proveedorId.

**Acceptance Scenarios**:

1. **Given** 50 notificaciones de distintos estados, **When** el admin abre la bandeja, **Then** ve listado paginado con estado, evento, canal, destinatario, enviarEn, sentAt.
2. **Given** filtros por estado `FALLIDA` y canal `EMAIL`, **When** se aplica, **Then** la query refleja los filtros.
3. **Given** una notificación, **When** se hace clic, **Then** se abre detalle con variables renderizadas y trazabilidad.

### User Story 2 — Editor de plantillas (Priority: P1)

Como admin quiero crear, editar y versionar plantillas del motor con preview en vivo.

**Why this priority**: permite tuning sin deploy.

**Independent Test**: CRUD de plantillas y preview con variables de ejemplo.

**Acceptance Scenarios**:

1. **Given** el editor de plantillas, **When** se crea una plantilla con `clave`, `canal`, `asunto`, `cuerpoMarkdown` y `variablesSchema`, **Then** se guarda con `version = 1`.
2. **Given** una plantilla existente, **When** se edita el cuerpo, **Then** se incrementa `version`.
3. **Given** el preview, **When** se ingresan variables de ejemplo, **Then** se renderiza asunto + cuerpo con variables sustituidas.
4. **Given** una plantilla inactiva, **When** se desactiva, **Then** el motor no la usa para nuevos envíos.

### User Story 3 — Editor de reglas con recálculo (Priority: P1)

Como admin quiero activar/desactivar reglas, cambiar offsets y canales, y recalcular notificaciones programadas con confirmación.

**Why this priority**: tuning de recordatorios y cortes sin tocar código.

**Independent Test**: cambio de offset de `suscripcion.por_vencer` y recálculo exitoso.

**Acceptance Scenarios**:

1. **Given** una regla activa, **When** se desactiva, **Then** el motor deja de programar nuevas notificaciones para esa regla.
2. **Given** una regla con offset `-5d`, **When** se cambia a `-3d`, **Then** el sistema pide confirmación de recálculo.
3. **Given** confirmación de recálculo, **When** se acepta, **Then** se llama `motor.recalcular` y se muestra conteo de notificaciones reprogramadas/canceladas.

### User Story 4 — Parámetros del motor (Priority: P1)

Como admin quiero editar parámetros `notificaciones.*` desde la UI, para ajustar intervalos, reintentos, retención y quiet hours.

**Why this priority**: evita deploys para tuning operativo.

**Independent Test**: edición de `notificaciones.horario.silencio` reflejada en BD.

**Acceptance Scenarios**:

1. **Given** la sección de parámetros, **When** se edita `notificaciones.worker.intervalo_segundos`, **Then** se valida que sea entero positivo.
2. **Given** `notificaciones.horario.silencio`, **When** se ingresa formato inválido, **Then** se rechaza con error claro.
3. **Given** un cambio de parámetro, **When** se guarda, **Then** se registra `AuditLog`.

### User Story 5 — Salud del motor (Priority: P1)

Como admin quiero ver métricas de salud del motor (encoladas, fallidas, reintentando, enviadas, abiertas, clics) y estado del worker.

**Why this priority**: operación y alerta temprana.

**Independent Test**: endpoint `/api/admin/notificaciones/salud` devuelve métricas.

**Acceptance Scenarios**:

1. **Given** el tab de salud, **When** se carga, **Then** muestra conteos por estado y volumen en últimas 24h.
2. **Given** el worker detenido, **When** se carga el tab, **Then** muestra indicador de alerta (worker inactivo).
3. **Given** métricas de bounce, **When** hay contactos bloqueados, **Then** se listan con opción de desbloqueo manual.

### User Story 6 — Webhook Resend (Priority: P1)

Como sistema quiero recibir webhooks de Resend para actualizar estados de entrega y bounces de forma idempotente.

**Why this priority**: tracking real de entregas y reputación.

**Independent Test**: `POST /api/webhooks/resend` con evento `delivered` actualiza estado.

**Acceptance Scenarios**:

1. **Given** un evento `delivered` con `email_id` existente, **When** llega webhook, **Then** la notificación pasa a `ENVIADA`.
2. **Given** un evento `bounced`, **When** llega, **Then** se incrementa bounce y se evalúa bloqueo.
3. **Given** el mismo webhook dos veces, **When** se procesa, **Then** la segunda vez es idempotente.

---

## Functional Requirements

FR-001: Debe existir una sección "Notificaciones" accesible para `ADMIN` dentro de `/dashboard/admin/configuracion`.

FR-002: Debe existir un tab "Salud motor" accesible para `ADMIN` dentro de `/dashboard/admin/estadisticas` o `/dashboard/admin/monitoreo` (según navegación actual).

FR-003: `GET /api/admin/notificaciones` DEBE listar notificaciones paginadas con filtros por `estado`, `evento`, `canal`, rango de fechas y texto de destinatario.

FR-004: `GET /api/admin/notificaciones/plantillas` y CRUD `POST/PATCH/DELETE /api/admin/notificaciones/plantillas/:id` DEBE gestionar plantillas con validación de `variablesSchema`.

FR-005: `POST /api/admin/notificaciones/plantillas/:id/preview` DEBE renderizar asunto y cuerpo con variables de ejemplo.

FR-006: `GET /api/admin/notificaciones/reglas` y CRUD DEBE gestionar reglas. La edición de `offset`, `canal` o `activa` DEBE ofrecer recálculo con confirmación.

FR-007: `POST /api/admin/notificaciones/reglas/:id/recalcular` DEBE llamar a `motor.recalcular` y devolver conteo.

FR-008: `GET/PATCH /api/admin/notificaciones/parametros` DEBE exponer/editar parámetros con prefijo `notificaciones.*`.

FR-009: `GET /api/admin/notificaciones/salud` DEBE devolver métricas por estado, volumen temporal, bounces y estado del worker (heartbeat).

FR-010: `POST /api/webhooks/resend` DEBE actualizar estados y bounces de forma idempotente.

FR-011: Todo cambio en plantillas, reglas o parámetros DEBE registrar `AuditLog`.

FR-012: No se DEBE tocar `src/lib/ai/**`.

---

## Success Criteria

- Admin puede navegar a Configuración → Notificaciones y ver bandeja, plantillas, reglas, parámetros.
- CRUD de plantillas con preview funciona.
- Recálculo de reglas con confirmación funciona.
- Tab de salud muestra métricas reales.
- Webhook Resend actualiza estados idempotentemente.
- CI verde 6/6.

---

## Assumptions

- SPEC-201 implementada y aprobada.
- El admin actual ya tiene permisos para `/dashboard/admin/configuracion`.
- `AdminNav.tsx` permite extender la navegación sin romper la regla de pintado D-41.
- Resend webhooks pueden configurarse en producción para apuntar a `/api/webhooks/resend`.

---

## Implementación

### Cambios realizados

- **Repositorios**:
  - `src/lib/dal/repositories/notificacion.ts`: `findPaginadas`, conteos de salud (`contarEncoladasListas`, `contarAtrasadas`, `contarEnviadasEnRango`, `contarAbiertasEnRango`, `contarFallidasEnRango`, `latenciaPromedioEnRango`, `contarProgramadasPorEvento`), idempotencia de timestamps (`marcarAbierta`, `marcarClicada`, `marcarDelivered`, `marcarBounce` vía `COALESCE`).
  - `src/lib/dal/repositories/notificacion-plantilla.ts`: `listarTodas`.
  - `src/lib/dal/repositories/notificacion-regla.ts`: `listarTodas`.
- **Servicios**:
  - `src/lib/notificaciones/admin-service.ts`: bandeja, reenvío, CRUD plantillas, CRUD reglas con recálculo, parámetros y salud (`colaActual`, `tasaEntrega7d`, `tasaApertura7d`, `atrasadas`, `latenciaPromedioMs`, `errores24h`, `intervaloSegundos`).
  - `src/lib/dal/services/notificacion-admin.ts`: CRUD/reglas/recálculo y preview para endpoints específicos.
  - `src/lib/notificaciones/webhook-resend.ts`: verificación HMAC Svix, validación de ventana temporal, aplicación idempotente de eventos.
- **API Routes**:
  - Bandeja: `GET/POST /api/admin/notificaciones/bandeja`, `POST /api/admin/notificaciones/bandeja/[id]/reenviar`.
  - Plantillas: `src/app/api/admin/notificaciones/plantillas/**`.
  - Reglas: `src/app/api/admin/notificaciones/reglas/**` incluyendo recalcular y recalcular-preview.
  - Parámetros: `src/app/api/admin/notificaciones/parametros/**`.
  - Salud: `GET /api/admin/notificaciones/salud`.
  - Webhook: `POST /api/webhooks/resend`.
- **UI**:
  - `src/components/modules/notificaciones/*.tsx`: `BandejaTab`, `PlantillasTab`, `ReglasTab`, `ParametrosNotificacionesTab`, `SaludMotorBloque`.
  - `src/app/dashboard/admin/estadisticas/salud-motor/page.tsx`.
  - Navegación: `ConfiguracionTabs.tsx`, `EstadisticasSubNav.tsx`.
- **Seguridad / permisos**:
  - `src/lib/permisos-catalogo.ts`: `configuracion_notificaciones`, `estadisticas_salud_motor`.
  - `src/lib/schemas/index.ts`: schemas Zod para todos los endpoints.
  - `src/lib/test-setup.ts`: `RESEND_WEBHOOK_SECRET` para tests.
  - `.env.example`: `RESEND_WEBHOOK_SECRET`.
- **Migración**:
  - `prisma/migrations/20260822030000_spec_202_notificaciones_admin_audit/`: valores `AccionAudit` para notificaciones.
- **Tests**:
  - `src/app/api/webhooks/resend/route.test.ts` (6 tests).
  - `src/app/api/admin/notificaciones/bandeja/route.test.ts` (7 tests: GET paginado/filtros + POST reenvío).
  - `src/app/api/admin/notificaciones/salud/route.test.ts` (2 tests).
  - `src/app/api/admin/notificaciones/plantillas/route.test.ts` (3 tests).
  - `src/app/api/admin/notificaciones/reglas/route.test.ts` (2 tests).
  - `src/app/api/admin/notificaciones/reglas/[id]/route.test.ts` (6 tests: PATCH + confirmación de recálculo).
  - `src/app/api/admin/notificaciones/parametros/route.test.ts` (3 tests).
  - `src/app/api/admin/notificaciones/parametros/[clave]/route.test.ts` (4 tests).

### Deuda técnica / riesgos

- Existen dos servicios admin (`src/lib/notificaciones/admin-service.ts` y `src/lib/dal/services/notificacion-admin.ts`) por evolución del código; ambos funcionan pero sería deseable unificar en refactor posterior.
- Fix menor aplicado: el regex literal para `offset` en `src/app/api/admin/notificaciones/reglas/[id]/route.ts` se reemplazó por `new RegExp(...)` para evitar un falso negativo de validación bajo Vitest.
