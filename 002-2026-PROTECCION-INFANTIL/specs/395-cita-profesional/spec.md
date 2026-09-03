# SPEC-395 · Red de Profesionales · L4 — la cita (agendar, pagar, confirmar, reprogramar)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1) · **Origen**: brief A-75 §4 (radicado del CEO, aprobado por Jelkin 03-09-2026); adenda del CEO 03-09 09:50 (candado I-280 en workers, candado del contacto escrito en código, plazo del padre libera franja).

## Para qué

L4 conecta al padre con el profesional: **el padre elige franja, paga, el profesional confirma dentro de 48h, la cita se agenda**. Sin L4, L1–L3 sirven un directorio de fotos y nada más.

Sobre L1a (modelo · #294), L1b (registro · #299 en cola de merge) y L2 (verificación · Dev Infra en L2 branch), este PR trae la lógica de negocio, los workers y las 9 rutas de API que hacen viable la primera cita.

## Qué trae

### 1) Migración aditiva

- `SolicitudCita.pagoAprobadoEn TIMESTAMPTZ NULL` (aditivo).
- `SolicitudCita.estado` default cambia a `SIN_CONFIRMAR` (la aprobación de pago es **manual** por ADMIN; el brief §4 v1.3 lo hizo explícito).
- 10 valores nuevos en `AccionAudit` con `ADD VALUE IF NOT EXISTS`: `CITA_PROFESIONAL_PAGO_APROBADO`, `_PAGO_EXPIRADA`, `_AVISO_48H_ENVIADO`, `_CONFIRMADA`, `_RECHAZADA_PROFESIONAL`, `_REPROGRAMADA`, `_REASIGNADA`, `_VENCIDA_PROFESIONAL`, `_ALARMA_TASA_VENCIMIENTOS`, `_SUSPENDIDO_POR_VENCIMIENTOS`.

Lección I-277 aplicada: cada valor de enum viaja en la MISMA migración que el código que lo emite.

### 2) DTO con **candado del contacto escrito en código** (aviso CEO 09:50)

`src/lib/profesional/cita/dto.ts` · `debeExponerContacto(solicitud, now)`:

- `CONFIRMADA` → sí (padre ↔ profesional se contactan por su cuenta).
- `VENCIDA_SIN_RESPUESTA` con `pagoAprobadoEn + 48h ≥ now` → sí (excepción: pagó, el profesional no respondió, se libera el contacto).
- Cualquier otro estado → **no**.

`toCitaParaPadre` NO adjunta `contactoProfesional` fuera de esos casos, con o sin `now` explícito. Simétrico: `toCitaParaProfesional` solo entrega el email del padre cuando el estado es `CONFIRMADA`. **La excepción está en el código, no solo en el test.**

### 3) Servicio único de mutación

`cita.service.ts` centraliza cada transición:

- `crearSolicitudCita` — valida franja libre + profesional ACTIVO, marca franja tomada, calcula montos y `venceEn` (72 h default para el pago del padre); si hereda pago arranca `PAGADA_PENDIENTE` con `pagoAprobadoEn=now`.
- `aprobarPago(id, adminId)` — SIN_CONFIRMAR → PAGADA_PENDIENTE + `pagoAprobadoEn=now`, arranca el reloj de 48h del profesional.
- `confirmarPorProfesional` / `rechazarPorProfesional` — CONFIRMADA / VENCIDA_SIN_RESPUESTA (+libera franja).
- `reprogramarPorPadre` — fila nueva con `solicitudPreviaId` + `pagoHeredadoDeId`. **Una gratis por dupla padre × profesional** (contador vía consulta a `pagoHeredadoDeId != null`).
- `reasignarPorPadre` — traslado a otro profesional, hereda pago. Solo desde `VENCIDA_SIN_RESPUESTA` o `NO_ASISTIO_PROFESIONAL`.
- `evaluarSuspensionYAlarma` — **3 consecutivas vencidas → `EstadoPerfilProfesional.SUSPENDIDO`**; tasa `vencidas / total > 1/3` (con ≥3) → audit `CITA_PROFESIONAL_ALARMA_TASA_VENCIMIENTOS` para el tablero de IDC.

### 4) Workers con **candado I-280 desde el día 1**

`worker.ts` · dos barredores:

- `barrerAvisoVencimiento48h(now)` — para cada `PAGADA_PENDIENTE` con `pagoAprobadoEn + 48h` pasado: consulta `AuditLog.CITA_PROFESIONAL_AVISO_48H_ENVIADO.creadoEn` y **salta** si es `≥ solicitud.actualizadoEn`. Si no, transiciona a VENCIDA_SIN_RESPUESTA + libera franja + audit + evalúa suspensión/alarma.
- `barrerPlazoPagoDelPadre(now)` — para cada `SIN_CONFIRMAR` con `venceEn` pasado: transiciona + **libera franja** + audit `CITA_PROFESIONAL_PAGO_EXPIRADA`. Regla del CEO 09:50: si el padre no paga, la franja tiene que volver al mercado.

### 5) 9 endpoints REST

- **Profesional:** `GET/POST /api/profesional/franjas`, `DELETE /api/profesional/franjas/[id]`, `GET /api/profesional/solicitudes`, `PATCH /api/profesional/solicitudes/[id]/{confirmar,rechazar}`.
- **Padre:** `GET/POST /api/padre/citas`, `POST /api/padre/citas/[id]/{reprogramar,reasignar}`, `GET /api/publico/profesionales/[id]/franjas`.
- **Admin:** `GET /api/admin/pagos/cita/pendientes`, `POST /api/admin/pagos/cita/[id]/activar`.

Todas las rutas son capas finas de auth + validación Zod que llaman al service. El DTO se aplica al serializar.

## Candados

- **I-280 en workers** — mismo mecanismo del `spam/sla.ts` que evitó los 1.894 correos de SPEC-387. El aviso 48h se registra **una vez por vencimiento**; si el email trueca, la vuelta siguiente reintenta.
- **Contacto del profesional en código, no solo en test** — `debeExponerContacto` es una función pura auditable, con tabla de verdad en `dto.test.ts` (10 casos, incluyendo el borde 47h / 48h / sin pagoAprobadoEn).
- **Migración aditiva + enums en la misma migración** (lección I-277).
- **`aprobarPago` NO hace `updateMany`**: cambia estado atómicamente y falla si la solicitud desapareció (el service usa `update` de Prisma).
- **Franja liberada al vencer plazo del padre** — sin esto un padre bloquea la agenda del profesional gratis. Aviso CEO 09:50.
- **Suspensión automática por 3 consecutivas** — protege al padre y disciplina al profesional sin ceremonia manual.

## Fuera de alcance

- Notificaciones por email (el disparo de correo se hace desde `logAudit` o desde un dispatcher externo; el worker garantiza el audit).
- UI: pantallas del padre/profesional/admin son piezas separadas (L5).
- L2 (verificación IDC): ya la avanza Dev Infra en su branch; este PR no toca `VerificacionProfesional` fuera del reuso del repo.

## Verificación

- 10 tests unit (`dto.test.ts`): tabla de verdad del candado del contacto en todos los estados y el borde 48h.
- 4 tests integration (`worker.test.ts`): dos corridas → un audit, candado I-280 defensa en profundidad, < 48h no avisa, plazo pago vencido libera franja.

## Referencias

- Brief A-75 §4 v1.3 · adenda 03-09 09:50 (candados)
- L1a: [SPEC-388a](../388a-red-profesionales-modelo/spec.md) · L1b: SPEC-391 (en cola de merge) · L2: en desarrollo por Dev Infra
- Patrón I-280: [SPEC-387](../387-candado-alerta-revision-spam/spec.md)
- Lección I-277: [SPEC-383](../383-i277-enum-accion-audit-alertas/spec.md)

## Impacto en arquitectura:

- **Nuevo dominio** `src/lib/profesional/cita/` (service + DTO + worker).
- **Nuevos repos** `src/lib/dal/repositories/{solicitud-cita,franja-disponible}.ts` + método `ultimoPorAccionYRecurso` en `audit-log.ts`.
- **9 endpoints nuevos** bajo `/api/profesional`, `/api/padre/citas`, `/api/admin/pagos/cita`, `/api/publico/profesionales`.
- **Migración aditiva** — `pagoAprobadoEn` + 10 enums.
- **No renombra ni borra** nada existente. No cambia superficie pública ya publicada.
