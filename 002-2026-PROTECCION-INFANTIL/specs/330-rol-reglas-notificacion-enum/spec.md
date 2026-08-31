# SPEC-330 · Rol de reglas de notificación = enum RolUsuario (padre) · 002-PI-230

**Status**: IMPLEMENTADO
**Radicado**: 002-PI-230 · cierra I-221 (parte padre) · Prioridad 🟠
**Impacto en arquitectura:** ninguno — sólo alinea el vocabulario del campo `String rol` de las reglas de notificación al enum `RolUsuario`; no cambia esquema, motor, plantillas ni la identidad de la regla.

## Problema

`enum RolUsuario` es `{ ADMIN, SCHOOL_ADMIN, PARENT, OPERADOR, COMITE_VALIDACION, COMITE_CONVIVENCIA }` (schema.prisma). El seed de `notificacionRegla` siembra reglas del padre con `rol: "PADRE"` — vocabulario de dominio que **no existe** en el enum. Como `notificacionRegla.rol` es `String`, el seed no falla, pero:

- La pantalla de preferencias filtra las reglas por el rol **enum** del usuario: `preferencias.ts:37` `reglas.filter((r) => r.rol === rol)` con `rol = user.rol` (`"PARENT"`).
- Las filas con `rol: "PADRE"` nunca matchean `"PARENT"` → **el padre ve menos toggles de los que existen** (I-221; Dev PI-2 lo cazó al mapear §3.1 de A-62: 1 toggle en vez de 2).
- El mismo mismatch rompe el guardado del toggle: `actualizarPreferencia` busca la regla con `findByEventoRolCanal(evento, user.rol, canal)` (`preferencias.ts:104`) → `"regla_inexistente"`.

El motor **no** filtra por rol (dispara por evento), así que el envío no se ve afectado — sólo la visibilidad y el guardado de la preferencia.

## Alcance

**DENTRO (esta spec):** alinear al enum el rol de las reglas **del padre** (`"PADRE"` → `"PARENT"`) en el seed + una migración de datos idempotente para las filas ya existentes en prod.

**FUERA (hallazgo diferido, radicado aparte del CEO):** la colisión multi-rol. La identidad de la regla es `@@unique([evento, canal, plantillaClave])` con `plantillaClave = evento.canal` (dedup SPEC-247) — **sin rol**. Por eso todas las filas de un mismo `(evento, canal)` colapsan en una sola (gana la última sembrada): `RECTOR_COLEGIO` lo pisa `PADRE`; `caso.asignado` colapsa COMITE_CONVIVENCIA/OPERADOR a COMITE_VALIDACION; `referido.tope_anual` EMAIL lo pisa `ADMIN`. Arreglar esto exige meter `rol` en la identidad de la regla y en las plantillas — cambio de arquitectura que el instructivo dejó fuera. **No se toca aquí.** `"RECTOR_COLEGIO"` se deja como está.

## Requisitos funcionales

- **FR-001** El seed siembra las reglas del padre con `rol: "PARENT"` (valor del enum `RolUsuario`), no `"PADRE"`, en TODAS las filas del padre (verificadas por grep).
- **FR-002** Una migración de datos idempotente actualiza las filas existentes: `UPDATE "notificacion_reglas" SET rol='PARENT' WHERE rol='PADRE'`. Aditiva, sin borrar; 2ª corrida = 0 filas.
- **FR-003** Tras el fix, `obtenerPreferenciasUsuario(id, "PARENT")` devuelve los toggles de `reporte.resuelto`, `reporte.circulo_confianza.aparece_menor`, `suscripcion.por_vencer`, `suscripcion.en_gracia`, `suscripcion.cortada`, `referido.registrado`, `referido.recompensa.otorgada` (todos los eventos donde la fila del padre sobrevive la colisión).
- **FR-004** `actualizarPreferencia(id, "PARENT", "reporte.resuelto.email", false)` encuentra la regla y guarda (deja de dar `regla_inexistente`).
- **FR-005** El envío por el motor no cambia (dispara por evento); no se toca `motor.ts`, `plantillas`, ni la identidad de la regla.

## Escenarios (User Stories)

- **US1 (P1) — El padre ve y controla sus preferencias.** Como padre (`PARENT`), en la pantalla de preferencias veo los toggles de reportes y suscripción, y puedo activarlos/desactivarlos. **Contraprueba:** antes del fix, esos toggles no aparecen (o no guardan).

## Success Criteria

- **SC-001** `preferencias.ts` con un usuario `PARENT` lista ≥ 2 grupos de eventos (reportes + suscripción) — verificado en test, no supuesto (candado 26).
- **SC-002** La migración corre idempotente: 2ª corrida = 0 filas cambiadas.
- **SC-003** El job `verificaciones` completo (tsc·lint·tokens·arch·locks·ratchets) + `specs-discipline` verdes; el CI valida el set combinado de migraciones.

## Notas / hallazgo diferido

- `referido.tope_anual` EMAIL termina con `rol: "ADMIN"` (la fila ADMIN se siembra después de la del padre, misma `plantillaClave`) → el padre **no** verá ese toggle. Es consecuencia de la colisión multi-rol; queda documentado como parte del hallazgo diferido, no se arregla aquí.
- La §6b en vivo (padre ve los 2 toggles; §3.1 de A-62 se auto-completa) la cierra el CEO al desplegar.
