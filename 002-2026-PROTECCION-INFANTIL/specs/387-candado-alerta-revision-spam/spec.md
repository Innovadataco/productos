# SPEC-387 · I-280 · Candado de repetición en el correo de SLA de spam

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1) · **Origen**: I-280 (CEO, medido en prod: 1.894 correos / 135 casos = 14× por caso en 24 h)

## Para qué

El job `revisarSlaSpam` (`src/lib/spam/sla.ts`) corre desde el vigilante de monitoreo cada 15 min, toma hasta 100 reportes en `POSIBLE_SPAM` que superaron el SLA (`spam.sla_horas`, 48 por defecto) y llama a `enviarAlertaRevision` **siempre**, sin recordar si ya avisó. Cada vuelta manda un correo por reporte vencido. Con 183 reportes en `POSIBLE_SPAM` en prod, el evento `reporte.revision.requerida` sube a **1.894 correos en 24 h sobre 135 casos** — 14× por caso, cuando el resto de eventos del sistema están en 1-2×.

El «hermano» del motor de expediente tiene exactamente el candado que falta acá: `tareas-motor.ts:117-118` consulta `ExpedienteMotorRepository.obtenerUltimoAvisoSla(exp.id)` y salta si `ultimoAviso.creadoEn ≥ exp.updatedAt`. Este SPEC copia el patrón, palabra por palabra.

## Qué cambia

**Enum al día**: nuevo valor `SPAM_ALERTA_REVISION_ENVIADA` en `AccionAudit`, con migración `ADD VALUE IF NOT EXISTS` (idempotente).

**Repositorio**: nuevo método `SpamReporteRepository.obtenerUltimoAvisoSlaSpam(reporteId)` — consulta `AuditLog` con esa acción y devuelve `{creadoEn}` del más reciente, o `null`. Además `findSpamVencidos` ahora `select` también `actualizadoEn`, para poder comparar.

**Job `revisarSlaSpam`**:

- Antes de enviar cada correo, consulta el último audit. Si `ultimoAviso.creadoEn ≥ reporte.actualizadoEn`, salta (ya avisado sin cambios).
- Si envía, escribe `AuditLog { accion: "SPAM_ALERTA_REVISION_ENVIADA", recursoId: reporte.id }`.
- **El audit se registra SOLO tras enviar bien**. Si el correo trueca (SMTP caído, etc.), no queda como enviado y la siguiente vuelta reintenta.
- Log final muestra `enviados` vs `saltados` para poder auditar el efecto del candado.

Cuando el reporte cambia de estado (o cualquier cosa que mueva `actualizadoEn`), el aviso previo queda «viejo» y la próxima vez que el reporte vence, se vuelve a avisar — que era el comportamiento deseado.

## Candados

- **Candado 22 v5**: se enumeraron los callers de `enviarAlertaRevision` en `src/`:
  1. `src/lib/spam/sla.ts:22` — job periódico, **el que rompía**, arreglado.
  2. `src/lib/dal/services/reporte-processing/finalizacion.ts:128` — one-shot dentro del pipeline de procesar reporte; no repite.
  3. `src/lib/dal/services/reporte-processing/finalizacion.ts:220` (`enviarAlertaRevisionManual`) — one-shot invocado por acción de admin; no repite.
  4. Tests: `procesar/route.test.ts`, `email.test.ts` — mock/test, sin impacto en prod.
- **Audit sólo tras éxito**: si el envío del correo lanza, no se marca «avisado». Un test lo afirma explícitamente.
- **La ventana se reabre por `actualizadoEn`**, no por un TTL: si el operador toca el reporte, la próxima vez que vence se vuelve a alertar. Un test cambia `actualizadoEn` a futuro y confirma que la segunda corrida SÍ manda.
- **Migración idempotente** (`ADD VALUE IF NOT EXISTS`): no rompe si alguien la corrió a mano.

## Impacto en arquitectura: sí (mínimo)

Migración nueva en `prisma/migrations/`. Sin cambios en modelo, sin nuevas tablas, sin cambio de contrato HTTP.

## Cómo se probó

- **Integration** (`src/lib/spam/sla.test.ts`, 3 tests nuevos):
  1. Dos corridas seguidas → **1 correo** + 1 fila `AuditLog`.
  2. Cambio de `actualizadoEn` entre corridas → **2 correos** (la ventana se reabre).
  3. SMTP falla en la primera corrida → **0 filas de audit** (no se marca como enviado); reintento en la segunda corrida → 1 fila.
- **Local**: `tsc --noEmit` limpio, migración aplicada a la BD de test (`prisma migrate deploy` = *Database schema is up to date*).

## Pendiente

- Verificación en vivo del CEO: en prod, correr el job manualmente y confirmar que solo emite un correo por reporte hasta que el reporte cambie.
