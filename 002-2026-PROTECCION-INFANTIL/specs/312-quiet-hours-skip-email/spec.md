# Feature Specification: Quiet hours no aplica a EMAIL ni IN_APP

**Feature Branch**: `work/pi-SPEC-312-quiet-hours-skip-email`

**Created**: 2026-08-29

**Status**: IMPLEMENTADO

**Input**: User description: "I-165 crítica: el Motor de Notificaciones aplica quiet hours (ventana de silencio 20:00-07:00) al canal EMAIL, difiriendo códigos de verificación / reset de password / pagos / alertas de seguridad hasta 11h (07:00 COT). El emisor (motor.ts:157) llama aplicarQuietHours sin ventana ni canal, usando el default hardcodeado e ignorando el parámetro de BD — por eso el workaround de Jelkin (UPDATE ParametroSistema) nunca surtió efecto. Decisión CEO arquitectónica: quiet hours NO aplica a EMAIL ni IN_APP (los únicos 2 canales del enum hoy). Fix: skip categórico por canal. Alcance recortado MVP (CEO IDC): pasar el canal en ambos callsites y saltar la ventana para EMAIL/IN_APP; leer el parámetro de BD en el emisor queda diferido a SPEC de seguimiento."

**Impacto en arquitectura:** Fix quirúrgico backend en el módulo de notificaciones. Agrega un parámetro opcional `canal` a `aplicarQuietHours` (retro-compatible, 3er arg) y una constante de dominio (`CANALES_SIN_QUIET_HOURS`). Los 2 callsites existentes (`motor.ts:157` emisor, `procesar-lote.ts:89` worker) pasan el canal. Cero migración, cero enum nuevo, cero UI, cero librería. La lectura del parámetro de ventana desde BD en el emisor queda como deuda diferida (documentada en tasks.md) — irrelevante para EMAIL/IN_APP que se saltan categóricamente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un código de verificación / reset de password por email llega de inmediato, sin importar la hora (Priority: P1)

Un usuario solicita un reset de password (o registro, o un pago) a las 23:30 COT. El email con el código debe salir de inmediato, no diferirse 11 horas hasta las 07:00. Hoy el motor lo programa ya diferido al crearlo.

**Why this priority**: Bloquea funcionalidad crítica de autenticación y pagos para todos los usuarios durante la ventana nocturna — Jelkin quedó bloqueado 3 veces intentando resetear su password.

**Independent Test**: Llamar `aplicarQuietHours(fechaDentroDeVentana, ventana, "EMAIL")` y verificar que devuelve la fecha sin modificar; idem `"IN_APP"`. Verificar que el emisor (`motor.ts`) y el worker (`procesar-lote.ts`) pasan el canal correctamente.

**Acceptance Scenarios**:

1. **Given** una notificación de canal `EMAIL` con `enviarEn` dentro de la ventana de silencio, **When** el motor la programa, **Then** el `enviarEn` no se difiere (se mantiene el momento original).
2. **Given** una notificación de canal `IN_APP` dentro de la ventana, **When** el motor la programa, **Then** tampoco se difiere.
3. **Given** una notificación `EMAIL` o `IN_APP` que ya llegó a su momento de envío dentro de la ventana, **When** el worker la procesa, **Then** no la marca como `diferida_quiet_hours` — la envía.

### Edge Cases

- Un canal hipotético futuro (`PUSH`/`SMS`, no existentes hoy en el enum) SÍ debe seguir aplicando la ventana — el skip es categórico solo para `EMAIL`/`IN_APP`.
- Una llamada sin canal (`undefined`, retro-compat con tests y callers viejos) DEBE aplicar la ventana igual que hoy — cero regresión.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `aplicarQuietHours` DEBE aceptar un parámetro opcional `canal` (3er argumento) y, cuando el canal sea `EMAIL` o `IN_APP`, devolver `enviarEn` sin modificar (skip categórico).
- **FR-002**: Los 2 callsites de `aplicarQuietHours` (emisor `motor.ts` y worker `procesar-lote.ts`) DEBEN pasar el canal de la notificación/regla.
- **FR-003**: El comportamiento para cualquier otro canal, o para una llamada sin canal, DEBE ser idéntico al actual (aplicar la ventana) — cero regresión.

### Key Entities *(include if feature involves data)*

- **CanalNotificacion** (enum existente, solo lectura): `EMAIL` e `IN_APP` son los 2 únicos valores hoy; ambos entran en `CANALES_SIN_QUIET_HOURS`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las notificaciones de canal `EMAIL`/`IN_APP` creadas dentro de la ventana de silencio salen sin diferirse (verificable en el momento de creación por el emisor y de procesamiento por el worker).
- **SC-002**: Cero regresión: los casos existentes de `quiet-hours.test.ts` (sin canal) siguen verdes con el mismo resultado.

## Assumptions

- **Alcance recortado (CEO IDC 2026-08-29 23:32 COT)**: en `motor.ts:157` se pasa `undefined` como ventana (se mantiene el default hardcodeado) + `regla.canal`. Como `EMAIL`/`IN_APP` se saltan categóricamente por canal, el valor concreto de la ventana es irrelevante para ellos. Leer el parámetro de BD (`notificaciones.horario.silencio`) en el emisor — para que también aplique a canales futuros — queda como deuda diferida a un SPEC de seguimiento (documentada en tasks.md).
- No se toca el campo `NOTIFICACIONES_QUIET_HOURS` / `notificaciones.horario.silencio`: sigue siendo el valor de ventana para canales que sí la aplican (futuros PUSH/SMS); solo EMAIL/IN_APP la ignoran ahora.
- No se agrega el bypass por `prioridad=CRITICA` (Fase 2, fuera de alcance).
