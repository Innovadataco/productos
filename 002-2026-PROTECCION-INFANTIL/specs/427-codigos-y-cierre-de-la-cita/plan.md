# Plan · SPEC-427 — Los dos códigos y el cierre de la cita

## Análisis en fuente, antes de codificar (candado 15 v5)

| Archivo | Qué se sacó |
|---|---|
| `prisma/schema.prisma:3548` | `SolicitudCita` ya tiene `expedienteCompartidoId` y el índice `[estado, venceEn]` con el comentario «L6: worker que autocierra a los 5 días». La casa estaba preparada. |
| `cita.service.ts:108` | El estado inicial es `SIN_CONFIRMAR` cuando no hay pago aprobado → **origen de I-300**. |
| `verificador-repository.ts:110` | La cola 2 filtraba solo por estado → **I-300 confirmado**. |
| `verificador/service.ts:362,379` | `trazaCodigos: null` con el comentario de SPEC-408: «llegan en un spec futuro». Este es ese spec. |
| `dal/services/autenticacion.ts:252-295` | El mecanismo probado de código: bcrypt, `expiraEn`, `intentosFallidos`, tope de reemisiones. **Se reusa el criterio.** |
| `notificaciones/motor.ts:182` | `programar` acepta `enviarEn` y `{ tx }` → el recordatorio de 10 minutos no necesita reloj nuevo. |
| `cita/worker.ts` | Dos barredores… **sin llamadores** → **I-301**. |
| `scripts/worker-tasas.mjs` | El molde de worker con advisory lock. |
| `scripts/ADVISORY-LOCKS.md` | Siguiente ID libre: `123456800`. |
| `monitoreo/probes.ts:23` | La lista del monitor está **quemada**: un worker que no se agregue queda sin vigilancia. |
| `panel.candado.test.ts` | El candado de SPEC-425 que iba a caer con esta spec, por diseño. |

## Decisiones

| Decisión | Por qué |
|---|---|
| Un modelo con `tipo` en columna | Dos códigos que van a divergir. Inferir del contenido es I-278. |
| La traza son las filas | El brief pide «cuántas veces se pidió»: contar filas no puede desincronizarse. |
| `notificacionId` en vez de `enviadoEn` | El estado del envío vive en el motor. Copiarlo es inventar un dato que miente cuando el correo falla. |
| Emitir cerca de la cita, no al confirmar | Un código que existe días antes es un código expuesto días antes. |
| Código y aviso en la misma transacción | Sin eso, un código sin correo deja la cita imposible de cerrar y fuera del barrido. |
| `autocerradaEn` (columna) | Separar las dos intenciones de `SIN_CONFIRMAR` sin inferir. Veredicto del CEO. |
| Un worker para los CUATRO barredores | Los dos huérfanos de 395 también necesitaban casa. |
| Candado de «barredor sin llamador» | El arreglo tiene que avisar la próxima vez. |

## Riesgos

| Riesgo | Cómo se acota |
|---|---|
| El código en claro en la fila de notificación | Ya es el patrón del producto (`auth.codigo_verificacion` en el motor). Se acota con 30 min de vigencia, un solo uso, y no auditarlo nunca. |
| Fuerza bruta sobre 6 dígitos | Tope de 5 intentos por código, igual que el registro. |
| El padre como máquina de correos | Tope de reemisiones por ventana, generoso (el brief dice «las veces que haga falta»). |
| Dos cierres simultáneos | `updateMany` con el estado esperado en el WHERE; gana uno. |
| El worker nuevo sin vigilancia | Se suma a `SENALES_TICK_VIDA` y al compose, y el candado lo exige. |
