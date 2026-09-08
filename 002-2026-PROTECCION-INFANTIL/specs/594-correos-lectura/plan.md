# Plan: Correos de lectura — reglas del dueño (SPEC-594)

## Reglas (decisiones del dueño, 2026-09-08)

1. **Rol interno (OPERADOR/ADMIN/COMITE_VALIDACION) lee → CERO correos al padre.** La lectura interna es operación normal; queda solo la auditoría interna `LecturaReporte`.
2. **Un solo disparo.** Ninguna acción le manda al padre dos correos idénticos.
3. **Aviso de lectura SOLO para acceso externo, en la acción real.** El aviso es `padre.reporte.acceso_canjeado` (disparado en el canje del código, que es la acción que abre la sesión de lectura) — nunca al abrir pantallas ni por cada lectura de la sesión.

## Cambios

- `src/lib/dal/services/auditoria-lectura.ts`: se elimina el bloque `programar(...)` (era el único emisor de `padre.reporte.texto_leido`). La escritura fail-loud en `LecturaReporte` se mantiene.
- `prisma/seed.ts` (`seedAccesoCifradoTextos`): fuera plantillas y reglas de `padre.reporte.texto_leido`; entra `padre.stepup.codigo.email` (SPEC-592).
- Consecuencias gratis del cambio: el render del detalle ya no notificaba por SPEC-592b; la corrección de clasificación (que descifraba texto + textoOriginal) deja de mandar los 2 correos idénticos que el dueño recibió «al clasificar».
- Texto de los correos que quedan: solo metadatos (identificador, rol, fecha) — sin texto del reporte (ya era así; se mantiene).

## Testing

- `src/app/api/reportes/acceso/acceso.test.ts`: corrección sin notificación + auditoría viva; render sin notificación (SPEC-592b).
- Flujo de canje existente (SPEC-584) sigue verificando el único aviso externo.

## Diagnóstico adjunto (SPEC-592c)

- `Notificacion` → `@@map("notificaciones")`: el `relation does not exist` era el nombre de tabla en psql.
- Cadena: `notificaciones.estado/ultimo_error` → worker `pi-notificaciones` → Resend (bounces, dominio, API key).
