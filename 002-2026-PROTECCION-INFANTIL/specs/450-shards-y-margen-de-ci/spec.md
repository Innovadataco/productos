# SPEC-450 · El margen de CI contra el techo de 45 minutos — cierra I-282

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-63`) · **Origen**: diagnóstico de I-282 pedido por el CEO

**Impacto en arquitectura:** el workflow de CI pasa de 4 a 6 shards. **No se toca el `timeout 45m` ni el reintento de SPEC-407.** Sin código de producto.

---

## El diagnóstico, primero

**I-282 no era un cuelgue.** No hay deadlock, ni conexión Prisma sin cerrar, ni `boss` sin `stop`, ni timeout ausente. Medido job por job:

| Hecho | Evidencia |
|---|---|
| Existe techo y funciona | `timeout-minutes: 100` en el job, `timeout 45m` en el step, un reintento **solo** por exit 124 |
| Línea base | **17-19 min** por shard (shard 2: 17.7/18.6/18.9/19.3 · shard 4: 17.1/16.9/17.2/17.6) |
| Anomalía | El **mismo** trabajo a veces tarda **40-43 min** (2,2-2,4×) |
| El «colgado» de #349 | Era el intento 1, cancelado a mano. **El intento 2 corrió 40,2 min y cerró bien, sin emitir el warning de reintento** |

**Descartado con evidencia, no por descarte:**
- **No es el reparto** — los cuatro shards salían **exactamente iguales**: 879 s estimados cada uno.
- **No es contención de BD entre shards** — cada shard levanta **su propio servicio `db`** en su job.
- **No es un test que bloquea** — si lo fuera, el `timeout 45m` cortaría y dispararía el reintento con su warning. Nunca apareció.

**Lo que no se pudo determinar:** por qué un runner tarda 2,3× lo mismo. GitHub no expone la máquina. SPEC-407 ya lo había llamado «caso B · runner lento»; esta medición **confirma esa hipótesis y descarta las de código**.

## El problema real: el margen

El peor caso medido —**43,3 min**— es el **96 % del techo**. Cruzarlo dispara el reintento y el job termina en **63-90 min**, que es exactamente lo que se ve como cuelgue. La suite pesa **57,4 min de test puro**: con 4 shards son 14,4 min teóricos y corre en 17-19 reales.

---

## Lo construido

**1 · Seis shards.** ~9,6 min teóricos y peor caso proyectado ~28 min: margen real contra un runner lento. **El fallback de vitest también pasa a `/6`** — dejarlo en `/4` con matriz de 6 haría que dos shards corrieran lo mismo y dos no corrieran nada, y hay candado que lo caza.

**2 · Un peso sin medir AVISA.** Antes entraba callado con la mediana. Eso está bien como arranque pero **es mentira para un archivo pesado**: el máximo medido son ~33 s contra una mediana de ~6 s, así que un test nuevo y caro se subestima 5× y el shard que le toque se pasa de largo. **Al escribirlo destapó 12 archivos sin medición**, varios de hoy.

**3 · Mediana de una ventana, no media de una corrida.** El archivo entero se armó el 03-09 con `corridas: 1`: una foto de un runner puntual. Con media móvil, un runner lento contaminaba el peso **para siempre**; la mediana de las últimas 5 corridas ignora el pico sin tener que detectarlo. Cada entrada declara ahora de **cuántas corridas** sale, y con menos de 3 el reparto la marca **provisional**.

**4 · Señal a los 30 minutos.** `::warning` + línea en el resumen del run. **Avisa, no corta**: el techo sigue siendo el de SPEC-407. La deriva del 04-09 pasó de 18 a 43 min sin que nadie se enterara hasta que un job pareció colgado.

## Candados, probados muriendo

| Mutación | Rojo |
|---|---|
| Volver la matriz a 4 shards | **1** |
| Subir el `timeout 45m` (que esta spec **no** debe tocar) | **1** |

Más: el fallback en `/6` · la señal avisa y no corta · los seis shards salen con el mismo peso (±5 %) · ninguno queda vacío · el lector entiende el formato viejo **y** el nuevo · el actualizador usa mediana y ya no la media móvil.

`npm run lint` 0 errores · `tsc` limpio · `arch:check` VERDE · `tokens:check` en el piso · unit **287/287 (2400)**.

---

## Anotado

- **El techo y el reintento de SPEC-407 no se tocan**, por orden del CEO y porque son lo que impide que un cuelgue real dure para siempre. Esta spec solo agranda el margen y hace visible la deriva.
- **La migración del formato de pesos es gradual:** el lector acepta el número suelto y el `{ms, muestras}`. La primera corrida en rama base convierte lo que toque. Romper el formato de golpe habría dejado el reparto a ciegas en silencio.
- **Regla operativa que salió del diagnóstico** (la escribió el CEO en I-282): **no se cancela un job antes de los 45 min.** Cancelar el de #349 a los 40 alargó la espera un CI completo — iba a cerrar al minuto siguiente.

> **Verde en CI ≠ funciona.** Cierra cuando pasen varios días sin que ningún shard toque el aviso de 30 min, y con `test-durations.json` mostrando `muestras ≥ 3` en la mayoría de sus entradas.
