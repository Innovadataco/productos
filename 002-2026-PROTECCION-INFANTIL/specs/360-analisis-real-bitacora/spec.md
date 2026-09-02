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
verificada en fuente) encontró que la UI cambia el estado del hijo por
`PATCH /api/padre/hijos/[id]` → `actualizarHijo`, que audita `{campos:["estado"]}`
**sin el valor** — así que el hito de pausa/reactivación no se puede atribuir
todavía. Reparto acordado con el CEO:
- El **lado escritura** del estado del hijo (route → `cambiarEstadoHijo` + cupo)
  lo hace **PI-2 en SPEC-363**. Esta SPEC **no toca** `hijos.ts` ni
  `[id]/route.ts`.
- El lector (`bitacora-menor.ts`) ya espera ese dato: lee `estado` y, si no
  viene, no inventa el hito. Cuando SPEC-363 grabe el estado, el hito enciende
  solo.
- **Merge de #242 EN HOLD** hasta que SPEC-363 entre; después rebase y
  verificación punta a punta de la bitácora.

Qué enciende hoy (caminos vivos, verificados en fuente): alta del menor y de
cada cuenta (de `creadoEn`), y cuenta activada/inactivada
(`cambiarEstadoIdentificador`, que la ruta llama directo).

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
- **NO se toca `hijos.ts` ni `[id]/route.ts`** (reparto con PI-2 · SPEC-363).
  Dos hitos de la bitácora dependen del lado escritura, que no vive en esta SPEC:
  - *pausa/reactivación del menor:* la UI va por `actualizarHijo`
    (`{campos:["estado"]}`, sin valor). Lo graba SPEC-363.
  - *cuenta quitada:* `desvincularIdentificador` BORRA la fila y no deja de qué
    menor era; necesita grabar `{hijoId}`. **No está en el scope estado de
    SPEC-363** → escalado al CEO para dueño.
  El lector ya espera ambos y omite lo que aún no se graba.
- El DTO de `listarCadenasPadre` crece con `analisisIa` y `ficha`. El texto del
  relato **sigue sin viajar** en el listado (research R-4): test que lo afirma.

## Cómo se probó

- `bitacora-menor.test.ts` (6): los asserts van contra las llamadas reales de
  `hijos/hijos.ts`, no contra filas de `AuditLog` escritas a mano — si cambia la
  forma del metadato, el test se cae, que es lo que debe pasar. Cubre los caminos
  vivos (alta, cuenta on/off), el boundary 404 y el metadato con JSON roto, más
  un tripwire que afirma que el estado del hijo por `actualizarHijo` NO enciende
  hito todavía (se cae cuando SPEC-363 lo grabe).
- `cadenas-padre.test.ts` (5): clasificación real, marca de clasificación
  manual, estado honesto sin clasificar, `categoriasSecundarias` con forma
  inesperada, y el relato que no viaja.
- `fecha.test.ts` (11): hora en punto y formato sin minutos.
- Regresión de lo tocado (candado 24v2): `hijos/` completo, 24 verdes.
