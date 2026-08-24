> DEPENDE DE: SPEC-200 (timezone Bogotá).

# Quickstart: SPEC-201 — Motor de Notificaciones · Núcleo (002-PI-098)

## Verificación local

1. Aplicar migración y seed:
   ```bash
   npx prisma migrate dev --name add_motor_notificaciones
   npx prisma db seed
   ```

2. Verificar reglas semilla:
   ```bash
   npx prisma studio
   # O query SQL:
   # SELECT evento, rol, offset, canal, obligatoria FROM "NotificacionRegla";
   ```
   Deben existir 6 reglas (BRIEF §6).

3. Verificar parámetros:
   ```bash
   # Claves esperadas:
   # notificaciones.worker.intervalo_segundos
   # notificaciones.worker.max_intentos
   # notificaciones.worker.backoff_segundos
   # notificaciones.retencion_meses
   # notificaciones.horario.silencio
   # notificaciones.bounces.umbral_bloqueo
   ```

4. Probar API pública (desde un script de prueba o test):
   ```ts
   import { programar, estado } from "@/lib/notificaciones/motor";
   const { programadas } = await programar({
     evento: "suscripcion.por_vencer",
     destinatarios: [{ email: "test@example.com", variables: { nombre: "Rector", fecha: "2026-09-01" } }],
   });
   ```
   Resultado esperado: `programadas > 0` y filas `ENCOLADA` en `Notificacion`.

5. Levantar worker:
   ```bash
   node scripts/worker-notificaciones.mjs
   ```
   Verificar que procesa la cola y envía/cancela según quiet hours.

6. Webhook Resend (simulación local):
   ```bash
   curl -X POST http://localhost:5005/api/webhooks/resend \
     -H "Content-Type: application/json" \
     -d '{"type":"delivered","data":{"email_id":"<proveedorId>"}}'
   ```
   La notificación correspondiente debe pasar a `ENVIADA`.

## Verificación en producción / VPS

1. Contenedor worker:
   ```bash
   ssh pi-vps "docker exec pi-notificaciones printenv TZ"
   ssh pi-vps "docker logs --tail 50 pi-notificaciones"
   ```

2. Segundo worker debe salir con código 2:
   ```bash
   ssh pi-vps "docker compose -f /path/to/docker-compose.prod.yml run --rm notificaciones node scripts/worker-notificaciones.mjs; echo $?"
   ```

3. Crear una notificación programada y verificar que el worker la consume en el próximo ciclo.

## Rollback

- Revertir commit de SPEC-201.
- La migración es aditiva; no borra datos. No revertir en prod sin autorización de ZEUS.
