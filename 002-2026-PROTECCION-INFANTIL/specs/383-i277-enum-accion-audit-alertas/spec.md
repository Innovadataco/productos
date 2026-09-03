# SPEC-383 · I-277 · enum AccionAudit con COLEGIO_ALERTA_ASIGNADA + quitar los `as AccionAudit` que silenciaban al compilador

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1) · **Origen**: I-277 (CEO tras hallazgo Dev-Guardianes en SPEC-373)

## Para qué

Hoy `POST /api/colegio/alertas/[id]/asignar` responde **500 siempre**: `asignarAlerta` llama a `logAudit` con `accion: "COLEGIO_ALERTA_ASIGNADA" as AccionAudit`, valor que **no existía en el enum**. El cast `as AccionAudit` silenciaba al compilador, ningún test cubría la ruta, y Prisma tronaba con *"Invalid value for argument accion. Expected AccionAudit"* la primera vez que un admin apretaba «Asignar» en prod. Jelkin acaba de crear la cuenta del comité y va a probar ese flujo en vivo.

La causa de fondo es más grande que un valor faltante: el patrón `"..." as AccionAudit` en 7 sitios diseminados dejaba pasar cualquier string. Este SPEC arregla el bug puntual y **desactiva la vía** que lo permitió.

## Qué cambia

**Enum al día.** Se agregan al enum `AccionAudit` los dos valores prometidos por el código y ausentes en el schema:

- `COLEGIO_ALERTA_ASIGNADA` (bug real: causa el 500 al asignar).
- `COLEGIO_ALERTA_ESCALADA` (existía en código muerto — ver abajo — pero el catálogo queda completo para futuros usos).

Migración: `20260903020000_i277_accion_audit_alerta_asignada_escalada` con `ADD VALUE IF NOT EXISTS`, idempotente y segura (agrega valores, no borra ni renombra).

**Fuera los 7 `as AccionAudit` con string literal.** Se quitan los casts en:

- `src/lib/colegio/alertas.ts` — 4 usos (creada, estado, asignada, escalada).
- `src/lib/dal/services/circulo-confianza/contactos-mutaciones.ts` — 2 (create, disable).
- `src/app/api/colegio/estadisticas/pdf/route.ts` — 1.

Los 6 casts que quedan (`audit-logs/route.ts`, `colegio/auditoria/route.ts`, `AuditLogViewer.tsx`) son sobre strings **dinámicos** que vienen de query-params o UI y necesitan un narrowing explícito — se mantienen.

Los imports `import type { AccionAudit }` que quedaban huérfanos tras quitar los casts (dos archivos) se eliminan también.

**Función muerta borrada.** `escalarAlerta` de `src/lib/colegio/alertas.ts:398` (SPEC-166) no tenía callers — el escalado real vive en `ComiteConvivenciaBandejaService.escalarAlerta` (`src/lib/dal/services/comite-convivencia-bandeja.ts:185`) y audita `COLEGIO_CASO_ESCALADO_A_COMITE` (valor que sí existía). Se elimina la función y se deja un comentario que explica dónde vive el patrón real y por qué se fue. El enum sigue con `COLEGIO_ALERTA_ESCALADA` por si un futuro caller lo usa.

## Candados

- **Cast literal ya no compila.** Sin `as AccionAudit`, el compilador rechaza cualquier string que no esté en el enum. La firma de `logAudit` (`accion: AccionAudit`) ya era estricta; el cast lo bypasseaba. Ahora protege como debe.
- **Migración idempotente.** `ADD VALUE IF NOT EXISTS` no rompe si alguien ya la corrió a mano. No hay `DROP` ni `RENAME`.
- **Test que faltaba y cazaba el bug.** `asignar/route.test.ts` — dos tests que hoy hubieran fallado con 500, y ahora dan 200 con la fila `AuditLog` correcta.
- **Cero callers antes de borrar la función muerta.** Verificado con `grep -rn "escalarAlerta" src/` (candado 22v5, excluyendo `ComiteConvivencia*` y `escalarAlertaSchema`) — ningún import, ningún llamado dinámico.

## Impacto en arquitectura: sí (mínimo)

Migration nueva en `prisma/migrations/`. Sin cambios en modelo, sin nuevas tablas ni relaciones, sin cambio de contrato HTTP.

## Cómo se probó

- **Integration** (`asignar/route.test.ts`, 2 tests nuevos): asignar al admin → 200 con `AuditLog.accion = COLEGIO_ALERTA_ASIGNADA`; desasignar (`asignadoAId: ""`) → 200 con segundo audit `valorNuevo = {asignadoAId: null}`.
- **Regresión completa**: 76/76 en `src/app/api/colegio/alertas`, `casos/[id]/informes`, `lib/dal/services/circulo-confianza`.
- **Local**: `tsc --noEmit` limpio, `arch/tokens/locks/ratchets` verdes, `specs-discipline` 8/8. La migración se aplicó a la BD de test (`prisma migrate deploy` = *Database schema is up to date*).

## Nota sobre precisión del hallazgo

I-277 se abrió (correctamente) al reportar los dos casts. Al implementar se confirmó — leyendo callers, candado 22v5 — que:

- **`asignarAlerta` sí estaba roto en prod**: el route `[id]/asignar/route.ts` lo llama y todo POST devolvía 500.
- **`escalarAlerta` de la lib NO estaba roto en prod**: es código muerto; el route `[id]/escalar/route.ts` va por `ComiteConvivenciaBandejaService.escalarAlerta`, que audita un valor que sí existía. La función muerta se elimina.

## Pendiente

- Verificación en vivo del CEO: `POST /api/colegio/alertas/<id>/asignar` con el rector real de Jelkin → 200 y la alerta queda con `asignadoAId` puesto.
