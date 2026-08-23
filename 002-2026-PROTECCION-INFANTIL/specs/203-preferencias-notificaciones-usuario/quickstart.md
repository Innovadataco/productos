> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Quickstart: SPEC-203 — Preferencias de Notificaciones del Usuario (002-PI-100)

## Verificación local

1. Asegurar que SPEC-201 esté implementada y seed aplicada.

2. Login como `PADRE` (o cualquier rol).

3. Navegar a `/dashboard/perfil/notificaciones`:
   - Ver lista de eventos aplicables al rol.
   - Verificar que eventos transaccionales (`suscripcion.por_vencer`, etc.) aparecen con toggle deshabilitado.
   - Desactivar un evento no transaccional y guardar.

4. Verificar persistencia:
   ```bash
   npx prisma studio
   # NotificacionPreferencia debe tener fila con habilitado=false.
   ```

5. Probar centro de notificaciones:
   - Generar una notificación del motor para el usuario.
   - Ver que la campana muestra el conteo.
   - Marcar como leída y ver que desaparece del conteo.

6. Verificar opt-out:
   - Con preferencia deshabilitada, disparar el evento correspondiente.
   - Confirmar que no se crea notificación para ese usuario.

## Verificación en producción / VPS

1. Mismo flujo con usuario real en producción.
2. Verificar que el webhook Resend y worker no interfieren con preferencias.

## Rollback

- Revertir commit de SPEC-203.
- Las preferencias guardadas permanecen en BD; no hay migración propia.
