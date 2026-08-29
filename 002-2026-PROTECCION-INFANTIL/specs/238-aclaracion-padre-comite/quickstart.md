# Quickstart: SPEC-238 — validación manual

Base: app corriendo (`./scripts/dev-restart.sh`), base de datos migrada y sembrada, `pi-expediente-motor` activo, eventos de SPEC-236 disponibles.

## Preparación

1. Crear (o usar) un expediente en estado `EN_APROBACION_PADRE` con un `informeConsolidadoId` asociado.
2. Tener a mano:
   - `EXPEDIENTE_ID` del expediente.
   - `ACLARACION_ID` (se obtiene tras el paso 1 del bloque A).
   - Sesión de `PARENT` titular.
   - Sesión de `COMITE_VALIDACION`.

## Bloque A — Pedir aclaración

1. Como `PARENT` titular, hacer `POST /api/padre/expediente/{EXPEDIENTE_ID}/pedir-aclaracion`:
   ```json
   { "solicitudTexto": "No entiendo por qué el informe menciona dos ciudades distintas." }
   ```
2. Verificar:
   - Respuesta `201`.
   - `estado` = `PENDIENTE`.
   - El expediente ahora está en `EN_ACLARACION`.
   - Existe un job/evento `expediente.aclaracion.solicitada` (revisar `pgboss.job` o logs del worker).
   - `AuditLog` con acción `ACLARACION_SOLICITADA` y metadatos (sin texto).
3. Intentar pedir otra aclaración del mismo expediente → respuesta `409`.
4. Con otro `PARENT` u otro rol → respuesta `403`.
5. Con texto vacío o >2000 caracteres → respuesta `400`.

## Bloque B — Responder aclaración

1. Como `COMITE_VALIDACION`, ir a `/dashboard/admin/comite/aclaracion/{ACLARACION_ID}`.
2. Ver el texto de la solicitud y escribir una respuesta.
3. Hacer `POST /api/admin/comite/aclaracion/{ACLARACION_ID}/responder`:
   ```json
   { "respuestaTexto": "Los reportes provienen de dos fuentes independientes en esas ciudades." }
   ```
4. Verificar:
   - Respuesta `200`.
   - `estado` = `RESPONDIDA`.
   - `respondidaPor` coincide con el usuario comité.
   - El expediente vuelve a `EN_APROBACION_PADRE`.
   - Evento `expediente.aclaracion.respondida` publicado.
   - `AuditLog` con acción `ACLARACION_RESPONDIDA`.
5. Intentar responder de nuevo → respuesta `409`.
6. Con otro rol u otro tenant → respuesta `403`/`404`.

## Bloque C — Cierre forzoso por el padre

1. Con la aclaración en `RESPONDIDA` y el expediente en `EN_APROBACION_PADRE`, como `PARENT` titular hacer:
   ```http
   POST /api/padre/expediente/{EXPEDIENTE_ID}/cerrar-forzoso
   ```
2. Verificar:
   - Respuesta `200`.
   - Aclaración en `CERRADA_FORZOSAMENTE`.
   - Expediente en `CERRADO`.
   - `AuditLog` con acción `ACLARACION_CERRADA_FORZOSAMENTE`.
3. Llamar nuevamente al endpoint → respuesta `200` sin cambios (idempotencia).

## Bloque D — Cierre forzoso por SLA vencido

1. Ajustar temporalmente `padre.comite.sla_horas_normal` a `1` hora (o insertar una aclaración con `solicitadaEn` en el pasado).
2. Crear una aclaración `PENDIENTE` cuya `solicitadaEn` supere el SLA respecto a la hora actual en Bogotá.
3. Disparar el tick del worker (o esperar a su ejecución programada).
4. Verificar:
   - Publicación del evento `expediente.comite.sla_vencido`.
   - Aclaración pasa a `CERRADA_FORZOSAMENTE`.
   - Expediente pasa a `CERRADO`.
5. Restaurar el SLA a su valor normal.

## Bloque E — Concurrencia

1. Preparar un script que dispare dos `POST /api/padre/expediente/{EXPEDIENTE_ID}/pedir-aclaracion` exactamente al mismo tiempo desde la sesión del padre.
2. Verificar:
   - Una respuesta es `201`.
   - La otra es `409`.
   - Solo existe una fila en `AclaracionExpediente` para ese `expedienteId`.

## Invariantes de privacidad y seguridad

- Ningún log de aplicación ni `AuditLog` contiene `solicitudTexto` ni `respuestaTexto` completos.
- El padre solo puede actuar sobre expedientes de los que es titular.
- El comité solo responde aclaraciones de su ámbito de acceso.
- No se genera contenido multimedia en ningún paso.
