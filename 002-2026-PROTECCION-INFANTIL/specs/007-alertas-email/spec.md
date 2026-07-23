# Feature Specification: Alertas por Email

**Feature Branch**: `feature/007-alertas-email`

**Created**: 2026-07-14

**Status**: IMPLEMENTADO

**Input**: User description: "Enviar notificaciones por correo a administradores en eventos clave del flujo de reportes: cuando un reporte requiere revisión manual y cuando un identificador alcanza un score crítico. Reutilizar la infraestructura Resend existente."

---

## User Scenarios & Testing

### User Story 1 — Alerta de revisión manual (Priority: P1) 🎯 MVP

Los administradores reciben un email cuando el procesamiento de un reporte falla o requiere intervención humana (estado `REVISION_MANUAL`).

**Why this priority**: Permite reaccionar rápido ante reportes que la IA no pudo clasificar o anonimizar, evitando que queden olvidados en la cola.

**Independent Test**: Procesar un reporte cuya anonimización falle; verificar que se envía un email a los administradores activos con el número de seguimiento, identificador y estado.

**Acceptance Scenarios**:

1. **Given** un reporte que genera error de procesamiento, **When** el worker lo marca como `REVISION_MANUAL`, **Then** se envía email a admins activos sin incluir texto original ni PII.
2. **Given** que no hay administradores activos, **When** ocurre un evento de revisión, **Then** no se envía email y no se produce error.
3. **Given** el parámetro `alerts.admin.enabled=false`, **When** ocurre un evento de revisión, **Then** no se envía email.

---

### User Story 2 — Alerta de score crítico (Priority: P1) 🎯 MVP

Los administradores reciben un email cuando un identificador acumula suficientes reportes visibles como para alcanzar el nivel de riesgo `CRITICO`.

**Why this priority**: Posibilita una respuesta oportuna ante identificadores con alto riesgo confirmado por múltiples reportes.

**Independent Test**: Crear varios reportes autenticados de alta severidad sobre el mismo identificador; verificar que tras alcanzar score crítico se envía email con score, nivel de riesgo y plataforma.

**Acceptance Scenarios**:

1. **Given** un identificador que alcanza score crítico tras procesar un reporte, **When** se recalcula y persiste el score, **Then** se envía email a admins activos.
2. **Given** el parámetro `alerts.critical_score.enabled=false`, **When** un identificador alcanza score crítico, **Then** no se envía email.
3. **Given** que el score del identificador ya era crítico, **When** llega un nuevo reporte, **Then** no se reenvía la alerta por cada reporte subsiguiente.

---

## Requirements

### Functional Requirements

- **FR-001**: El sistema debe exponer `enviarAlertaRevision(reporte)` en `src/lib/email.ts`.
- **FR-002**: El sistema debe exponer `enviarAlertaScoreCritico(datos)` en `src/lib/email.ts`.
- **FR-003**: Ambas funciones deben consultar administradores activos (`rol=ADMIN`, `estado=activo`) y enviar un único email en `to`.
- **FR-004**: El contenido del email solo debe incluir identificador, número de seguimiento, estado, score, nivel de riesgo y plataforma; nunca texto original ni PII.
- **FR-005**: Los parámetros `alerts.admin.enabled` y `alerts.critical_score.enabled` deben poder desactivar cada alerta.
- **FR-006**: Las alertas deben activarse desde `POST /api/reportes/procesar` sin bloquear la respuesta del worker.

### Non-Functional Requirements

- **NFR-001**: Si el envío de email falla, el procesamiento del reporte debe continuar y el error debe loggearse.
- **NFR-002**: Las alertas deben ser testeables mediante mocks de `src/lib/email.ts`.

---

## Success Criteria

- **SC-001**: 100% de reportes en `REVISION_MANUAL` generan alerta cuando hay admins activos y la alerta está habilitada.
- **SC-002**: 100% de identificadores que alcanzan `CRITICO` generan alerta cuando está habilitada.
- **SC-003**: Zero fugas de PII en los cuerpos de alerta.
- **SC-004**: Tests unitarios y E2E actuales siguen pasando tras la integración.

---

## Assumptions

- La infraestructura Resend ya está configurada (`RESEND_API_KEY`, `EMAIL_FROM`).
- El modelo `Usuario` ya tiene rol `ADMIN` y estado `activo`.
- El score crítico se determina por el umbral configurado en `scoring.threshold.high`.


---

## Implementación (documentado retroactivamente el 2026-07-18)

### Objetivo alcanzado
Notificar a administradores y a usuarios suscritos sobre eventos relevantes del ciclo de vida de un reporte, sin exponer PII.

### Decisiones de diseño derivadas del código
- **Reutilización de Resend**: las mismas utilidades de `src/lib/email.ts` sirven para alertas y para el flujo de autenticación.
- **Suscripción de usuarios**: modelo `AlertaSuscripcion` con límite de un email cada 24 horas por identificador/plataforma.
- **No bloqueo del worker**: las alertas se invocan de forma asíncrona tras procesar un reporte.
- **Privacidad**: los emails de prioridad alta no incluyen texto del reporte ni términos detectados.

### Endpoints y componentes afectados
- Utilidades: `src/lib/email.ts` (`enviarAlertasSuscriptores`, `enviarAlertaRevision`).
- Endpoints: `GET /api/alertas`, `POST /api/alertas/suscribir`, `DELETE /api/alertas/:id`.
- Invocación desde `POST /api/reportes/procesar`.

### Tests
- `src/lib/email.test.ts`

### Migraciones relevantes
- `20260715000000_alertas_suscripcion`
- `20260715000001_alertas_suscripcion_unique`
