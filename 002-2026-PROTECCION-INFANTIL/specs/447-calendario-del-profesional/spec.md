# SPEC-447 · El profesional publica su disponibilidad — cierra I-311

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-63`) · **Origen**: **I-311** (hallado en fuente preparando SPEC-437, verificado por el CEO en producción)

**Impacto en arquitectura:** una pantalla nueva en el área del profesional y dos validaciones que le faltaban a una ruta que ya existía. Sin migración, sin modelo nuevo, sin endpoints nuevos. Los artefactos `02-roles-capacidades.md` y `03-pantallas.md` se regeneran porque hay una ruta más.

---

## El hueco

`POST /api/profesional/franjas` existe desde **SPEC-395 (L4)**: valida, guarda, tiene su guardia de rol. **Ninguna pantalla lo llamaba.**

La única mención de `profesional/franjas` fuera de tests en todo el árbol era **el comentario de cabecera de la propia ruta**. Las únicas creaciones de `FranjaDisponible` eran cuatro archivos de test llamando Prisma directo. El único consumidor de franjas en la interfaz era **el padre**, que las **lee**.

**En producción: `FranjaDisponible` = 0 filas, 0 libres. Cero en toda la historia.**

Es la **segunda causa, independiente de I-310**, de que `SolicitudCita` esté en cero: aunque SPEC-444 quite el 400 del identificador, el padre abre el directorio y **no hay una sola franja que reservar**. Arreglar solo 444 corrige el síntoma y deja la funcionalidad igual de muerta.

Familia de I-301 e I-303 —construido, probado, desplegado y sin nadie que lo use—, pero con una diferencia que importa: acá el hueco es **la pantalla**, no el cableado entre módulos. **Ningún candado de llamador lo habría cazado**, porque a esta ruta no la llama otro módulo: la llama la interfaz.

---

## La ruta la fijó el CEO antes de construir

**`/dashboard/profesional/calendario`** — área de **trabajo**. No `/perfil-profesional/*`, que es donde el profesional completa y verifica su ficha.

No es una preferencia de estilo: **Calidad ya tenía un candado apuntando a `/perfil-profesional/franjas`**, una ruta que nadie había decidido. Si esta pantalla nacía en otro lado, ese `test.fail` quedaba **rojo para siempre** y su «unexpected pass» —lo único que lo cierra— no llegaba nunca. Nadie se habría enterado de que el candado dejó de significar algo.

---

## Lo construido

1. **La pantalla.** Publicar una franja con día, hora de inicio y modalidad. **El fin no se pide**: sale de `duracionMinutos` del perfil (pedirle a alguien que calcule «10:00 + 45 min» es pedirle que se equivoque) y se muestra en vivo mientras escribe.
2. **Ver y retirar.** Las franjas propias agrupadas por día de Bogotá. Una **reservada** se marca como tal y **no ofrece el botón de retirar** — hay una familia esperando de ese lado; el servidor lo impone igual con `borrarSiLibre`.
3. **La hora vive en un solo lugar.** `instanteDesdeHoraBogota` se sumó a `src/lib/fechas/formato-bogota.ts`, junto al resto de la zona horaria, y usa `fromZonedTime` **en vez de restar cinco horas a mano**. Es la lección de I-247 y de SPEC-431: un offset copiado a la pantalla se desincroniza en silencio.
4. **Dos validaciones que la ruta no tenía**, y que la pantalla vuelve alcanzables de verdad por primera vez:
   - **Solape.** Dos franjas encimadas pueden comprometer dos citas en el mismo rato. Se miran también las **tomadas**: una reservada ocupa la agenda igual que una libre. Pegadas (10:00–10:45 y 10:45–…) **sí** se permiten.
   - **Modalidad que no atiende.** Publicar una presencial sin atender presencial es prometerle a una familia algo que no se va a cumplir; el directorio del padre filtra por esos mismos dos campos.
5. **Estado vacío honesto, en una línea** (regla de SPEC-437 §3): *«Sin franjas publicadas, ninguna familia puede agendar contigo.»*

> **«Editar» se resuelve retirando y publicando de nuevo.** La API no tiene `PATCH` y el radicado es explícito: *la API está, no se reescribe*. Agregar un verbo nuevo excedía el alcance; queda dicho en vez de quedar sobreentendido.

---

## Candados · 15, probados muriendo

**Conducta contra la base (11).** Cada uno pega en el endpoint que dispara la pantalla y afirma **la fila**, no el texto del código: la franja queda en base a la hora correcta de Bogotá (10:00 Bogotá = 15:00 UTC), el `GET` se la devuelve, un rango invertido no deja fila, un solape se rechaza, una pegada sí entra, el solape se mira **por profesional**, una modalidad no atendida se rechaza, sin sesión no se publica, la libre se retira, **la tomada no**, y un profesional no retira la de otro.

**De clase (4).** Falla si `POST /api/profesional/franjas` **se queda sin consumidor en la interfaz** — que es exactamente lo que nadie vigilaba. Barre `src/app/**` y `src/components/**` **excluyendo `src/app/api/**`**: si el único sitio que menciona la ruta fuera la ruta misma, seguiría sin pantalla. Cubre también el `DELETE`, la ruta fijada por el CEO, y que la pantalla **no** tenga un offset de Bogotá escrito a mano.

**Hora de Bogotá (6).** Ida y vuelta sobre el día completo, el cruce de medianoche en UTC (21:00 Bogotá = 02:00 UTC del día siguiente, el defecto de SPEC-431), y que enero y julio den el mismo offset — Colombia no tiene horario de verano.

| Mutación en la fuente | Rojos |
|---|---|
| Quitar la validación de solape y la de modalidad | **2**, y solo esas dos |
| Que la pantalla deje de llamar al endpoint | **1** — el candado de clase, el que nadie tenía |

`tsc` limpio · lint 0 errores · **`arch:check` VERDE** (con los dos artefactos regenerados) · unit y la integración de lo tocado en verde.

---

## Anotado, no arreglado

**La puerta deja pasar a PARENT a `/dashboard/profesional/calendario`** — igual que a `/dashboard/profesional`, que ya era así antes de esta spec. El dato está protegido: la página hace `verifyAuth("PROFESIONAL")` y un padre recibe error, no la agenda. Pero recibe **un error en vez de un redirect limpio**. Es preexistente y de otra spec; se reporta, no se ensancha acá.

> **Verde en CI ≠ funciona.** Cierra cuando en producción **un profesional publique una franja desde su pantalla y un padre la reserve**: `FranjaDisponible` y `SolicitudCita` dejan las dos de estar en cero. La franja de prueba que siembre el CEO para el recorrido de Jelkin es un rodeo y **no cierra I-311**.
