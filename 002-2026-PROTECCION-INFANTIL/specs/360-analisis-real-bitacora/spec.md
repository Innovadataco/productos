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
- **`desvincularIdentificador` ahora audita `{ hijoId }`.** Quitar una cuenta
  BORRA su fila, así que el registro de auditoría quedaba huérfano: no había
  forma de saber de qué menor era y el hito no se podía atribuir. Va el hijoId y
  nada más — el valor del identificador es PII y no entra a la auditoría. Los
  registros anteriores a este cambio no se pueden atribuir y se omiten, antes
  que colgarle a un menor la cuenta de otro.
- El DTO de `listarCadenasPadre` crece con `analisisIa` y `ficha`. El texto del
  relato **sigue sin viajar** en el listado (research R-4): test que lo afirma.

## Cómo se probó

- `bitacora-menor.test.ts` (8): los asserts van contra las llamadas reales de
  `hijos/hijos.ts`, no contra filas de `AuditLog` escritas a mano — si cambia la
  forma del metadato, el test se cae, que es lo que debe pasar. Cubre el cruce
  entre hermanos, el boundary 404 y el metadato con JSON roto.
- `cadenas-padre.test.ts` (5): clasificación real, marca de clasificación
  manual, estado honesto sin clasificar, `categoriasSecundarias` con forma
  inesperada, y el relato que no viaja.
- `fecha.test.ts` (11): hora en punto y formato sin minutos.
- Regresión de lo tocado (candado 24v2): `hijos/` completo, 24 verdes.
