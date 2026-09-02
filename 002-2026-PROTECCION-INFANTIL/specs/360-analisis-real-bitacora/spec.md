# SPEC-360 · A-70 tanda 2 — Análisis real, bitácora del menor y detalles del expediente

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-01 · **Dev**: PI-1 · **Origen**: A-70 · F11, F10, G18, G19, G20 (recorrido de Jelkin)

## Qué se arregló

Cinco hallazgos del recorrido, todos de la cara del padre.

### F11 — "Mis reportes" mostraba una plantilla, no el análisis

La tarjeta pintaba el parámetro `padre.analisis.explicacion.<CATEGORIA>`: un
texto fijo por categoría que se leía como si fuera el resultado del motor. El
padre nunca veía qué había concluido la clasificación de SU reporte.

Decisión del CEO (opción **A**): se muestran los datos REALES que ya están en
`ClasificacionIA` — cero gasto nuevo por reporte, porque el motor ya corrió.
La explicación parametrizada no desaparece: baja a una línea rotulada "Qué
significa". Si el reporte está en `REVISION_MANUAL` o sin clasificar, el estado
es honesto ("En revisión por una persona"), nunca una plantilla disfrazada.

### F10 — La ficha del menor no decía desde cuándo se lo está cuidando

Nueva bitácora por menor, armada de lo que YA existe (`AuditLog` + los
`creadoEn` de las filas). Sin modelo nuevo: una tabla de bitácora habría
duplicado un histórico que el sistema ya lleva y habría nacido vacía para los
menores existentes.

**Alcance de F10 en esta SPEC = LADO LECTURA.** La auditoría del CEO (idc-71,
verificada en fuente) encontró que la UI cambiaba el estado del hijo por
`PATCH /api/padre/hijos/[id]` → `actualizarHijo`, que audita `{campos:["estado"]}`
**sin el valor**. Reparto acordado con el CEO: el **lado escritura** lo hizo
**PI-2 en SPEC-363**, hoy en main (`e98d937eb`). Tras el rebase de esta rama
sobre ese main:
- La ruta enruta el estado por `cambiarEstadoHijo` (audita `{estado}` con valor ·
  BUG2, y aplica el cupo al reactivar · BUG1). El lector lo lee y enciende el
  hito de pausar/reactivar.
- `desvincularIdentificador` graba `{hijoId}` al borrar la fila (I-259); el
  lector ata el hito "quitaste una cuenta" al menor correcto, sin el valor (PII).
- `cambiarEstadoIdentificador` graba `{hijoId, activo}`; el lector nombra la
  cuenta activada/inactivada.
- Esta SPEC **no toca** `hijos.ts` ni `[id]/route.ts` (los aporta SPEC-363; en el
  rebase, main gana siempre en esos dos archivos).

Qué enciende hoy (caminos vivos, verificados en fuente y probados E2E): alta del
menor y de cada cuenta viva (de `creadoEn`), pausa/reactivación del menor
(`cambiarEstadoHijo`), cuenta activada/inactivada (`cambiarEstadoIdentificador`)
y cuenta quitada (`desvincularIdentificador`, `{hijoId}`).

### G18 — El mapa no encuadraba los puntos

Con un solo punto quedaba en zoom de continente. Ahora `fitBounds` con padding
y tope de zoom.

### G19 — La simulación cronológica iba a una sola velocidad

Selector 0.5× / 1× / 2× / 4× que cambia el ritmo sin perder la posición.

### G20 — La hora del hecho fingía precisión de minuto

El padre no sabe el minuto exacto de algo que pasó. Se captura y se muestra en
hora en punto.

## Impacto en arquitectura: sí

- **Nuevo servicio DAL** `bitacora-menor.ts` y **nueva ruta**
  `GET /api/padre/hijos/[id]/bitacora` (boundary: solo el padre dueño; 404 para
  cualquier otro, con el mismo mensaje que "no existe").
- **NO se toca `hijos.ts` ni `[id]/route.ts`** (reparto con PI-2 · SPEC-363, hoy
  en main). El lado escritura del que dependen dos hitos ya vive ahí:
  - *pausa/reactivación del menor:* la ruta enruta el estado por
    `cambiarEstadoHijo`, que audita `{estado}` con valor. El lector lo lee.
  - *cuenta quitada:* `desvincularIdentificador` graba `{hijoId}` al borrar la
    fila; el lector ata el hito al menor sin filtrar el valor (PII).
- El DTO de `listarCadenasPadre` crece con `analisisIa` y `ficha`. El texto del
  relato **sigue sin viajar** en el listado (research R-4): test que lo afirma.

## Cómo se probó

- `bitacora-menor.test.ts` (9): los asserts van contra las llamadas reales de
  `hijos/hijos.ts`, no contra filas de `AuditLog` escritas a mano — si cambia la
  forma del metadato, el test se cae, que es lo que debe pasar. Cubre los caminos
  vivos (alta, cuenta on/off, pausa/reactivación por `cambiarEstadoHijo`, cuenta
  quitada por `desvincularIdentificador`), que corregir un dato por
  `actualizarHijo` NO es hito, el boundary 404, el metadato con JSON roto, y el
  recorrido E2E de Jelkin (alta → pausa → reactivación → cuenta quitada = 4
  hitos, sin el valor del identificador).
- `cadenas-padre.test.ts` (5): clasificación real, marca de clasificación
  manual, estado honesto sin clasificar, `categoriasSecundarias` con forma
  inesperada, y el relato que no viaja.
- `fecha.test.ts` (11): hora en punto y formato sin minutos.
- Regresión de lo tocado (candado 24v2): `hijos/` completo, 24 verdes.
