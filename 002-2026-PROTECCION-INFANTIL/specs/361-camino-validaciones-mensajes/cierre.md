# SPEC-361 · Cierre — F4 a F9 del lote A-70

**Fecha**: 01-09-2026 · **Dev**: PI-2 · **Rama**: `work/pi-SPEC-361-camino-validaciones-mensajes`

## F4 · Los errores mudos

El backend **ya sabía** el motivo (documento repetido, tope alcanzado) y lo
mandaba en `error.message`. Quien lo tiraba era la pantalla:
`throw new Error("No se pudo registrar")` descartaba la respuesta sin leerla.
Ahora `MisHijos` lee el mensaje del servidor tanto en el alta como en las
acciones (activar, inactivar, identificadores), y el 400 del schema nombra el
campo ("Escribe el nombre del menor.") en vez de "Datos inválidos".

## F5 · Inactivar libera cupo (con la corrección de Jelkin)

El tope contaba **todas** las fichas; ahora cuenta solo las **activas**. Las tres
reglas quedaron tal cual las fijó Jelkin: el sistema cuenta activos, bloquea con
el texto exacto, y **nunca** inactiva ni sugiere a cuál — el mensaje no nombra
ningún menor y no hay ninguna ruta que inactive por su cuenta.

**Detalle que casi se escapa:** el mensaje salía de un parámetro sembrado, y en
las bases ya desplegadas ese parámetro tiene el texto viejo ("Puedes cuidar hasta
5 menores…"), que le habría ganado al texto aprobado. Verificado en vivo. El
override ahora solo aplica si el parámetro está en el formato nuevo (trae
`{{activos}}`); el seed también quedó actualizado.

## F6 · Contador visible

"N de M menores activos" en la cabecera, siempre, más un aviso ámbar cuando el
cupo está lleno. El máximo llega del parámetro por el servidor (la página del
Paso 3 pasó a server component), sin endpoint nuevo ni número escrito a mano.

## F7 · Documento por tipo

Módulo puro con la forma de cada tipo: RC/TI/CC/CE solo dígitos; pasaporte y
OTRO alfanuméricos con guiones. Validado en la pantalla (aviso inmediato) y en
el servidor (que es quien manda).

## F8 · Edad en vez de año

En el camino se elige la **edad (5 a 17)** y el año se **deriva** contra el año
en curso: en 2026 una edad de 17 da 2009; en 2030 dará 2013. Sin rangos fijos
escritos a mano que envejezcan con el código.

## F9 · Edad al reportar

Lista de 4 a 17, opcional. Antes era un campo libre de 1 a 120.

## Evidencia en vivo (dev, padre real)

- **F7**: `84opkioniby` en una tarjeta de identidad → *"El número de tarjeta de
  identidad debe tener solo números, sin letras ni espacios."* y no se guarda nada.
- **F6**: contador pasa de "0 de 5" a "1 de 5" al registrar.
- **F5**: con 5 activos el 6.º da 409 con el mensaje de Jelkin; el padre inactiva
  uno (200) → el 6.º entra (201) → quedan 6 fichas y 5 activos: liberar cupo no
  es borrar.

## Tests

8 unitarios del módulo puro (incluido el caso exacto de Jelkin) y 4 de
integración nuevos (F5 libera cupo, mensaje del tope sin nombrar menores, F7 por
tipo, F4 nombrando el campo). Dos casos viejos que afirmaban el mensaje anterior
se actualizaron por candado 24v2.

## Gate

`tsc` limpio · lint 0 errores · unit **1941/1941** · integración de hijos 17/17 ·
`next build` verde · `arch:check` VERDE.
