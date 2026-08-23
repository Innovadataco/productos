> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Quickstart: SPEC-202 — Panel Admin del Motor de Notificaciones (002-PI-099)

## Verificación local

1. Asegurar que SPEC-201 esté implementada y seed aplicada.

2. Login como `ADMIN`.

3. Navegar a `/dashboard/admin/configuracion` → pestaña/sección "Notificaciones":
   - Ver bandeja con notificaciones (vacía si no se han generado).
   - Crear/editar una plantilla y usar preview.
   - Ver reglas semilla; editar offset de `suscripcion.por_vencer` y confirmar recálculo.
   - Editar parámetros (`intervalo_segundos`, `horario.silencio`, etc.).

4. Navegar a `/dashboard/admin/estadisticas` (o `/dashboard/admin/monitoreo`) → tab "Salud motor":
   - Ver conteos por estado.
   - Ver contactos bloqueados (si hay).

5. Webhook Resend:
   ```bash
   curl -X POST http://localhost:5005/api/webhooks/resend \
     -H "Content-Type: application/json" \
     -d '{"type":"delivered","data":{"email_id":"resend-id-123"}}'
   ```
   Verificar que el estado de la notificación con `proveedorId = resend-id-123` cambie a `ENVIADA`.

## Verificación en producción / VPS

1. Configurar webhook de Resend apuntando a `https://pi.innovadataco.com/api/webhooks/resend`.
2. Verificar eventos `delivered`, `opened`, `clicked`, `bounced`.
3. Verificar que bounces incrementan y bloquean tras umbral.

## Rollback

- Revertir commit de SPEC-202.
- No hay migraciones propias; los datos del motor permanecen en modelos de SPEC-201.
