# SPEC-438 · La fecha y la hora del hecho son obligatorias, y el sistema nunca las inventa

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-80`) · **Origen**: **I-305** · radicado del 04-09

**Impacto en arquitectura:** una columna nueva (`Reporte.horaAproximada`, aditiva con default `false`) y un módulo puro nuevo (`lib/reportes/franja-aproximada.ts`). Sin endpoints nuevos; el contrato del POST suma un campo opcional.

---

## El defecto

El formulario dejaba enviar sin fecha ni hora, y el cliente rellenaba:

```ts
// ReporteWizard.tsx:146-148
fechaIncidente: data.fechaIncidente
    ? new Date(data.fechaIncidente).toISOString()
    : new Date().toISOString(),   // ← el instante del ENVÍO
```

**El momento del envío quedaba guardado como la hora del hecho.** Verificado en producción: `RPT-G0LVZS` con `fechaIncidente` igual a su creación al milisegundo.

No queda un dato faltante: **queda un dato falso**, indistinguible de uno verdadero, alimentando la franja horaria que se le entrega al modelo, el patrón nocturno, la línea de tiempo del expediente y un informe con valor probatorio.

> El esquema del servidor **ya exigía** `fechaIncidente`. Por eso nunca se vio un 400: el cliente siempre mandaba algo. El agujero estaba del lado que rellena, no del que valida.

---

## Qué trae

**La fecha y la hora son obligatorias.** El paso del detalle no deja avanzar sin ellas — antes solo exigía país, ciudad y descripción, tal como el formulario declaraba.

**El sistema no rellena nada.** Desaparece la rama que fabricaba la hora. Si no hay dato, no se envía.

**Para quien no recuerda la hora: una franja.** Madrugada, mañana, tarde o noche. La hora representativa es el **centro** del bloque (03/09/15/21), no su borde — decir «de noche» y guardar las 18:00 en punto dejaría el hecho justo en la frontera con la tarde.

**Y queda marcada como aproximada.** `horaAproximada` viaja hasta el payload del modelo, para que el análisis pueda **distinguir una hora precisa de una estimada**. Cuando un hecho no proviene de un `Reporte` (la fecha es la del evento), se marca aproximada: no se puede afirmar precisión que no se tiene.

**La franja se calcula en hora de Bogotá, en un solo lugar.** Es la lección de **I-247 b**, donde la franja se calculó sobre UTC durante meses y la noche entera del país llegaba al modelo como madrugada. El módulo es puro y se prueba con tabla de casos contra `Intl`.

---

## Verificación

**Candados de conducta, probados muriendo:**

- **Ninguna ruta de creación fabrica la hora.** Se revisan los cuatro archivos del camino de creación. **Contraprueba:** al restaurar la forma exacta que tenía el wizard, el candado **cae** — verificado.
- **Sin fecha no se envía**: la guardia del paso exige `fechaIncidente`, y el esquema del servidor no la vuelve opcional.
- **La marca llega al análisis**: el hecho que viaja al modelo lleva `horaAproximada`, la consulta la trae, y sin `Reporte` no se asume precisión.

**Conducta contra la base (3 tests nuevos, 29 en el archivo):**

- **Sin fecha del hecho → 400**, nombrando el campo.
- Una hora **estimada** queda `horaAproximada = true` en la base.
- Una hora **exacta** queda `false`.

**7 tests del módulo de franja**: cada franja cae en su hora de Bogotá, el día local no se corre, y «noche» **no se convierte en madrugada del día siguiente** (el error de I-247 b, probado al revés).

`tsc` limpio · `lint` 0 errores · unitarios completos verdes.

---

## Punto 4 del radicado — los reportes ya creados

**No se tocan en esta spec, y la migración no los reescribe.** Reescribir la fecha de un informe con valor probatorio no se hace en una migración silenciosa: es decisión del CEO.

**El número hay que sacarlo de producción, no de desarrollo.** En dev el 100 % coincide, pero es un artefacto del poblador: `_poblar-v5-casos.ts:190` fija `creadoEn: p.fecha` a propósito. Y en producción también hay datos sembrados, así que la consulta tiene que **excluir lo marcado** (SPEC-412):

```sql
SELECT count(*) AS sospechosos
FROM "Reporte" r
LEFT JOIN demo_marcado d ON d."entidadId" = r.id AND d.entidad = 'Reporte'
WHERE r.eliminado = false
  AND d.id IS NULL
  AND abs(extract(epoch FROM (r."fechaIncidente" - r."creadoEn"))) < 2;
```

Los que salgan de ahí llevan una hora fabricada por este defecto. Qué hacer con ellos —marcarlos `horaAproximada = true`, anularles la hora, o dejarlos con una nota— lo decide el CEO.
