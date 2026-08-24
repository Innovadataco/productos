# Quickstart: SPEC-239 — validación manual

Base: app corriendo (`./scripts/dev-restart.sh`), padre y usuario de comité logueados, Motor Notif configurado, worker `pi-expediente-motor` activo.

## Bloque A — CRUD de contactos de emergencia (rol PARENT)

1. Iniciar sesión como padre de prueba.
2. Crear contacto:
   ```bash
   curl -X POST http://localhost:5005/api/padre/contacto-emergencia \
     -H "Content-Type: application/json" \
     -b "token=<cookie>" \
     -d '{"nombre":"María García","relacion":"MADRE","telefono":"+573001234567","email":"maria@example.com","prioridad":1}'
   ```
   → Debe responder 201.
3. Probar teléfono inválido (`3001234567` sin `+`) → 400.
4. Listar contactos:
   ```bash
   curl http://localhost:5005/api/padre/contacto-emergencia -b "token=<cookie>"
   ```
   → Debe mostrar el contacto ordenado por prioridad.
5. Editar prioridad:
   ```bash
   curl -X PATCH http://localhost:5005/api/padre/contacto-emergencia/<id> \
     -H "Content-Type: application/json" \
     -b "token=<cookie>" \
     -d '{"prioridad":2}'
   ```
   → 200.
6. Desactivar contacto (`PATCH` con `{"activo":false}`) → desaparece del listado de activos.
7. Verificar que otro padre autenticado no puede leer/ editar/ eliminar el contacto → 404.

## Bloque B — Escalamiento a ROJO y SLA 12h

1. Tener un expediente en gravedad menor a ROJO (preparado por SPEC-236).
2. Simular/ ejecutar la transición que publica `expediente.gravedad.subio_a_rojo`.
3. Verificar en BD que el expediente tiene:
   - `scoreGravedadActual = ROJO`
   - `slaEfectivoHoras = 12`
   - `fechaEscaladoRojoEn` actualizado.
4. Verificar que se programó una notificación usando la plantilla existente `expediente.gravedad.subio_a_rojo` del Motor Notif (sembrada por SPEC-236).
5. Verificar en `AuditLog` una fila con `accion = EXPEDIENTE_ESCALADO_A_ROJO` y `nivel = CRITICAL`.

## Bloque C — Activación de emergencia

1. Iniciar sesión como usuario `COMITE_VALIDACION`.
2. Abrir el expediente ROJO en `/admin/comite/consolidacion/<id>`.
3. Verificar que aparece el botón "Activar emergencia" en color ruby.
4. Pulsar el botón → modal de confirmación.
5. Confirmar.
6. Verificar que:
   - El endpoint responde 200.
   - Se seleccionó el contacto de prioridad 1.
   - Se programó notificación `expediente.emergencia.activada` por SMS (y email si aplica).
   - Se publicó el evento `expediente.emergencia.activada`.
   - Existe `AuditLog` `EXPEDIENTE_EMERGENCIA_ACTIVADA`.
7. Probar fallback: desactivar el contacto de prioridad 1 y repetir → debe usar prioridad 2 y auditar `CONTACTO_EMERGENCIA_FALLBACK_USADO`.
8. Probar sin contactos activos → 409 con código `SIN_CONTACTOS_EMERGENCIA`.
9. Probar con expediente no ROJO → 409 con código `GRAVEDAD_NO_ROJO`.

## Bloque D — Worker y SLA vencido

1. Crear/ actualizar un expediente ROJO con `fechaEscaladoRojoEn` hace más de 12h y estado `PENDIENTE_COMITE`.
2. Forzar la ejecución del tick del worker `pi-expediente-motor` (o esperar al cron).
3. Verificar que se publicó el evento `expediente.comite.sla_vencido`.
4. Verificar notificación CRITICAL a admin/CEO.
5. Verificar `AuditLog` `EXPEDIENTE_COMITE_SLA_VENCIDO`.
6. Verificar que un expediente ROJO con menos de 12h no dispara el evento.

## Bloque E — Idempotencia de seed

1. Ejecutar `npx prisma db seed` dos veces.
2. Verificar que no hay duplicados de:
   - Parámetro `padre.comite.sla_horas_gravedad_roja`.
   - Catálogo `expediente.emergencia.activada`.
   - La plantilla `expediente.gravedad.subio_a_rojo` ya existe por SPEC-236 y no se duplica.

## Invariantes de privacidad y seguridad

- Un padre no puede ver ni modificar contactos de otro padre.
- El comité no puede crear/ editar/ eliminar contactos; solo lee los activos para disparar la notificación.
- El `AuditLog` nunca incluye texto del reporte.
- No se exponen valores secretos ni claves de Motor Notif en respuestas ni logs.
