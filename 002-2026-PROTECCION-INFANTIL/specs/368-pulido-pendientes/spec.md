# SPEC-368 · A-74 — Lote de pulido (pendientes chicos)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 · **Origen**: A-74 (brief del CEO)

## P0 · I-245 — ya estaba arreglado (no se rehízo)

El brief pedía agregar `COLUMNAS_OPCIONALES_DOCUMENTO` a la plantilla del
colegio. **Verificado en fuente: ya estaba.** Lo arregló SPEC-344 (`7ef2ccca0`),
que además dejó el test-candado `plantilla-alumnos-autoconsistente` (pasa). Y ese
commit **es ancestro de la tanda 2 desplegada** (`e98d937eb`): está en producción.
No se tocó nada. Si la carga del colegio falla, la causa es otra.

**Hueco real que sí existía y se cerró:** la plantilla del **camino guiado**
(`cursos/unificado/plantilla`) —la que descarga el rector— **no tenía candado
propio**. Hoy coincide con su validador, pero podían divergir sin que nadie se
enterara. Ahora tiene su test autoconsistente, verificado simulando la
divergencia: al quitarle las columnas de documento, el test cae con el síntoma
exacto de I-245 ("Falta el tipo/número de documento del estudiante" → 0 filas).

## P1 · La fecha del hecho

**Lo que se verificó en el RENDER (no en el atributo):** el `datetime-local`
nativo, aun con `step=3600`, pinta el segmento de minutos —"02/09/2026, 02:00
p.m."— y vacío se ve "dd/mm/aaaa, --:-- ----". El a.m./p.m. sí aparecía (locale
es-CO), pero el campo pide una precisión que el padre no tiene.

**Arreglo:** `FechaHoraIncidente`, un control de tres piezas —día + hora 1 a 12 +
a.m./p.m.— **sin minutos a la vista**. Vive en el paso compartido del wizard, así
que entra por el reportar **anónimo** y por el autenticado.

**Candados de B1 (SPEC-359) que conserva, con tests:** es imposible elegir futuro
(el tope va en hora LOCAL, y si el día elegido es HOY las horas que no han pasado
quedan deshabilitadas); el error del servidor sigue nombrando el campo; el
contrato de `onChange` no cambia, así que el borrador en sessionStorage sigue
igual; y siempre sale la hora en punto.

**I-261 (presentación):** se enumeraron con grep todas las vistas que muestran
`fechaIncidente`. Las del padre ya usaban el formato sin minutos; faltaba el
**detalle del admin** (`ReporteDetalleInfo`), que tenía su propio
`toLocaleDateString` y ni siquiera mostraba la hora. Ahora usa el mismo
formateador (a.m./p.m., sin minutos).

**Los PDFs NO se tocan** (expediente, denuncia, forense): formatean la fecha con
sus propios helpers y son evidencia legal; su formato no es "presentación".

## P2 · El duplicado en la bandeja

Un reporte DUPLICADO aparecía como **"Sin asignar"** y parecía trabajo pendiente.
Ahora dice **"Duplicado — sin acción"**. Sigue siendo válido tras SPEC-366: el
duplicado conserva `estado=DUPLICADO` almacenado.

## Aseo · código huérfano

Se borró `ReporteStepUbicacion.tsx`: **cero referencias** (imports estáticos,
dinámicos, tests, includes). Tenía un segundo campo "Fecha del incidente" que
inducía a error al leer el código.

## Impacto en arquitectura: no

Sin modelo ni migración. Un componente nuevo de presentación, dos helpers puros
de fecha, una etiqueta en la bandeja y un archivo muerto menos.

## Cómo se probó

- Candado de la plantilla del camino guiado (2), **probado simulando la divergencia**.
- `FechaHoraIncidente` (7): las tres piezas sin minutos, futuro imposible, borde
  del día de hoy, hora en punto, el error que nombra el campo.
- Helpers de fecha (5 nuevos): bordes del reloj de 12, hora en punto, ida y vuelta.
- I-261 en el detalle del admin (1) · wizard sin regresión (14).
- Verificación EN VIVO en el navegador del reportar anónimo (es público): se
  confirmó el defecto y luego el control corregido, incluida una corrección de
  maquetación que solo se vio mirando la pantalla.
