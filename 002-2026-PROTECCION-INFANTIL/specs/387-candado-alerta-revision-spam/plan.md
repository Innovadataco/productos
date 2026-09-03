# Plan · SPEC-387 · I-280 · candado de repetición en el correo de SLA de spam

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1)

## Decisiones

**Se copia el patrón hermano, no se inventa.** `tareas-motor.ts:117-118` ya resolvió el mismo problema para el motor de expediente. Ese patrón usa `AuditLog` como memoria del último aviso y compara con la `updatedAt` del recurso. Es el candado que el CEO pidió replicar, y evita agregar otra tabla o un cache extra en memoria (que no aguantaría un restart del worker).

**`actualizadoEn` como llave de reapertura, no un TTL.** Un TTL (por ejemplo «no volver a avisar en 24 h») dejaría fuera el caso donde el reporte cambia dos veces en una hora — y avisaríamos igual pese al cambio. Comparar con `actualizadoEn` refleja el modelo real: cambió → puede haber contexto nuevo → sí vale la pena avisar de nuevo.

**Audit solo tras éxito.** El primer instinto es «marca como enviado y despacha el correo»; ese orden pierde correos silenciosamente si el envío truena. El orden inverso (envía → si no lanza, audita) reintenta la próxima vuelta. El test lo afirma en un caso dedicado.

**Un solo enum nuevo, no una tabla.** Podría tenerse una tabla `AvisoSlaSpam` propia, pero `AuditLog` ya cumple: se filtra por `accion` + `recursoId`, ya existe, ya está indexado, y es lo que usa el hermano.

**Migración idempotente.** `ADD VALUE IF NOT EXISTS` no depende del estado previo; no hay renombres. El deploy es una operación segura.

**Alcance cerrado a los emisores periódicos.** El CEO pidió verificar otros emisores. Se enumeraron: solo `spam/sla.ts` es un loop periódico. Los otros (`finalizacion.ts:128` y `enviarAlertaRevisionManual`) son one-shot en el pipeline de procesar reporte; no acumulan. No se tocan.

## Archivos

- `prisma/schema.prisma` — valor `SPAM_ALERTA_REVISION_ENVIADA` agregado al enum `AccionAudit`.
- `prisma/migrations/20260903030000_i280_.../migration.sql` — migración.
- `src/lib/dal/repositories/spam-reporte.ts` — nuevo `obtenerUltimoAvisoSlaSpam` + `actualizadoEn` en el `select` de `findSpamVencidos`.
- `src/lib/spam/sla.ts` — chequeo del último aviso antes de enviar, audit tras éxito, log final con `enviados`/`saltados`.
- `src/lib/spam/sla.test.ts` — 3 tests nuevos.
