# Quickstart 030 — Círculo de Confianza con múltiples identificadores

## Escenario A: contacto con un solo identificador (caso base)

1. El usuario inicia sesión como `PARENT`.
2. Va a `/dashboard/circulo-confianza`.
3. En el formulario escribe:
   - Etiqueta: "Tío Carlos"
   - Identificador: valor `+57300111111`, tipo `telefono`, plataforma `WhatsApp`.
4. Hace clic en "Agregar contacto".
5. Esperado: aparece un contacto con el identificador y estado "Sin reportes".

## Escenario B: contacto con múltiples identificadores y reporte en uno de ellos

1. Crear un contacto "Tío" con dos identificadores:
   - Valor `+57300111111`, tipo `telefono`, plataforma `WhatsApp`.
   - Valor `tio_minecraft_2026`, tipo `nick`, plataforma `Minecraft`.
2. Crear un reporte visible para `tio_minecraft_2026` en la plataforma `Minecraft` con estado `CLASIFICADO`.
3. Esperado:
   - La lista muestra el contacto "Tío" con estado "Clasificado".
   - El detalle del contacto muestra ambos identificadores.
   - El identificador `tio_minecraft_2026` indica el reporte asociado.
   - El identificador `+57300111111` sigue en "Sin reportes".

## Escenario C: desactivación y reactivación de contacto

1. Desde el listado, desactivar el contacto "Tío".
2. Esperado: el contacto pasa a inhabilitado y sus identificadores se marcan inactivos.
3. Reactivar el contacto.
4. Esperado: el contacto y sus identificadores vuelven a activos.

## Escenario D: límite de contactos activos

1. Fijar `circulo.max_contactos` en `2`.
2. Crear dos contactos activos.
3. Intentar crear un tercer contacto.
4. Esperado: error "Límite de contactos activos alcanzado".

## Escenario E: vista agregada

1. Crear dos contactos activos con identificadores que tengan reportes visibles.
2. Asegurar que se cumpla el umbral `circulo.umbral_agregacion` (`contactosConReportes:2`, `totalReportes:3`).
3. Esperado: la vista agregada muestra totales por país, ciudad, categoría y timeline.

## Notas para pruebas manuales

- Los reportes de prueba deben estar en estados visibles: `CLASIFICADO`, `CORREGIDO`, `REVISION_MANUAL`, `POSIBLE_SPAM` o `REQUIERE_ANONIMIZACION`.
- Los reportes eliminados o en estados `PENDIENTE`, `PROCESANDO`, `DUPLICADO` no afectan el estado del contacto.
- Las notificaciones por email respetan el cooldown de 24 horas definido en `circulo.notificaciones.cooldown_horas`.
