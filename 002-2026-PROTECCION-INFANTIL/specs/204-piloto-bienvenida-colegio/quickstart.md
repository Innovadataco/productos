> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Quickstart: SPEC-204 — Piloto Migración Bienvenida Colegio (002-PI-101)

## Verificación local

1. Aplicar seed:
   ```bash
   npx prisma db seed
   ```

2. Verificar regla y plantilla:
   ```bash
   npx prisma studio
   # NotificacionRegla: evento = "colegio.bienvenida"
   # NotificacionPlantilla: clave = "colegio.bienvenida.email"
   ```

3. Crear un colegio desde el panel admin:
   - `POST /api/admin/colegios` debe retornar éxito.
   - Verificar que se crea una fila `Notificacion` con evento `colegio.bienvenida`, estado `ENCOLADA`.

4. Si el worker de notificaciones corre, verificar que envía el email.

5. Reenviar credenciales:
   - `POST /api/admin/colegios/:id/reenviar-email`.
   - Verificar nueva fila `Notificacion`.

6. Comparar contenido:
   - El email recibido debe tener el mismo asunto y cuerpo que antes de la migración.

## Verificación en producción / VPS

1. Crear colegio en producción.
2. Verificar en bandeja de admin del motor que aparece la notificación `colegio.bienvenida`.
3. Verificar entrega real vía Resend.

## Rollback

- Revertir commit de SPEC-204.
- Restaurar llamadas directas a `enviarEmailBienvenidaColegio` si es necesario.
- No hay migración propia; la regla/plantilla quedan en BD pero no se usan si el código revierte.
