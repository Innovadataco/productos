# SPEC-414 · El Inicio del admin separa lo sembrado de lo real — cierra I-271 y I-294

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Dev 02 (`idc-80`) · **Origen**: [BRIEF A-76](../../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-A-76-SIEMBRA-DE-DATOS.md) §3.1-3.2 · radicado del CEO 16:3x · alcance ampliado 16:4x con **I-294**.

**Impacto en arquitectura:** ninguna migración, ningún endpoint nuevo, ningún cambio de schema. Cambia el contrato de `calcularEstadoInicio` (gana un parámetro opcional y dos campos en la respuesta) y la pantalla que lo consume. `GET /api/admin/inicio/senales` acepta `?prueba=1`; sin el parámetro se comporta como el default nuevo.

---

## Para qué

Dos defectos que viven en el mismo archivo y se tapan mutuamente.

### I-271 · la cola de trabajo miente

El 99 % de lo que hay en producción es sembrado. El Inicio del administrador cuenta esos datos como trabajo pendiente: **el admin cree que tiene 254 casos de comité esperando y 250 son de mentira.** Una cola de trabajo que miente hace perder el tiempo de alguien.

### I-294 · la única defensa que existía nunca corrió

`senalRevisionManualReales` ya sabía descontar lo sembrado. Pero su consulta decía:

```sql
LEFT JOIN "DemoMarcado" dm       -- ❌ esa tabla no existe
```

El modelo Prisma se llama `DemoMarcado`, pero lleva `@@map("demo_marcado")`: en SQL crudo va el nombre **físico**. La consulta reventaba en **cada** lectura desde SPEC-378.

**Y nadie se enteró**, que es la mitad grave. `calcularEstadoInicio` hacía `Promise.allSettled` y **descartaba los rechazos sin registrar nada**, con un comentario que prometía un `logger` que no existía. O sea: las nueve señales podían estar rotas y la pantalla se veía sana.

> **Un tablero de alarmas que apaga sus propias alarmas es peor que no tener tablero: produce confianza en vez de duda.** La señal tranquila no prueba que todo esté bien; prueba que nadie se quejó.

---

## Qué trae

### 1) El corte CARGA / SALUD

Ya estaba decidido en el brief §3.1 y acá se implementa, señal por señal:

| Familia | Señales | Trato |
|---|---|---|
| **CARGA** — colas de trabajo | `reportes_huerfanos` · `revision_manual_saturada` · `vigencias_por_vencer` · `comite_vencido` | **Descuentan lo sembrado**, y las dos de reportes descuentan también las **simulaciones**. Nadie debe atender un caso de mentira. |
| **SALUD** — el sistema | `correos_fallidos` · `proveedor_email` · `analisis_racha` · `jurado_reducido` · `infra` | **Cuentan todo.** La falla es real aunque la dispare una prueba: si el correo se cae sembrando, se cayó — y `correos_fallidos` fue justamente la pista que destapó I-280. |

Las cuatro de CARGA pasan a una consulta que trae los dos números de una vez:

```sql
SELECT COUNT(*)::bigint AS total,
       COUNT(*) FILTER (WHERE dm.id IS NULL)::bigint AS reales
FROM "Reporte" r
LEFT JOIN demo_marcado dm ON dm."entidad" = 'Reporte' AND dm."entidadId" = r.id
WHERE …
```

### 1-bis) La simulación del motor también es dato de prueba, y llega por otra puerta

Adenda del CEO (18:2x), verificada en fuente: [`simulacion/executor.ts:44`](../../src/lib/simulacion/executor.ts) crea **`Reporte` REALES** con `ReporteRepository` y los encola al motor con `sendReporte` — corren los tres modelos de verdad. Solo después los anota en `simulacion_reportes`, que es una tabla de enlace.

Esos reportes **nunca pasan por `demo_marcado`**, porque no son siembra: son ejercicio del motor y tienen su propia tabla. Sin excluirlos, las **100 o 200 simulaciones** que Jelkin va a lanzar para medir el motor aparecerían como 200 casos «reales» en las colas — el mismo problema que esta spec cierra, entrando por otro lado.

Por eso el criterio de CARGA es **«tiene marca de demo O pertenece a una simulación»**: dos orígenes, una sola definición de «no es trabajo real». No se los marca en `demo_marcado` — no lo son.

En **SALUD** siguen contando: si el motor se cae simulando, se cayó de verdad. Mismo corte.

(El nombre de la tabla en SQL crudo es el **físico**, `simulacion_reportes`, con su candado propio. Es la lección de I-294 aplicada a la tabla siguiente.)

### 2) El interruptor · el default invertido ES el arreglo

**Por defecto se ve SOLO LO REAL.** No es un efecto colateral: es lo que cierra I-271.

- Un control siempre visible dice qué se está mirando y **cuánto dato de prueba hay detrás** — el conteo se muestra incluso cuando es cero, así que nada queda oculto.
- `?prueba=1` lo trae de vuelta con un clic. Vive en la URL, no en estado de cliente: la página sigue siendo un server component, el modo se puede compartir y el botón «atrás» funciona.
- La respuesta del endpoint lleva siempre `incluyeSembrados` y `sembrados`, para que quien lo consuma sepa qué está mirando sin adivinar por el parámetro.

**El total NO se infla.** Un reporte sembrado puede quedar fuera de dos colas a la vez (huérfano *y* en revisión manual). `sembrados.porSenal` es el desglose por cola —y sí solapa, a propósito—, pero `sembrados.total` **cuenta filas distintas** con una consulta propia sobre `demo_marcado`. Sumar el desglose daría el doble y le mentiría al administrador sobre cuánto humo hay. Hay un test que lo fija.

### 3) I-294 · el nombre de la tabla, y el silencio

- La consulta usa el nombre físico, declarado una sola vez: `const TABLA_MARCADO = Prisma.raw("demo_marcado")`.
- **Cada tarea lleva su nombre.** `allSettled` sobre un array anónimo pierde la identidad de lo que falló; ahora un rechazo se puede nombrar.
- Un rechazo va a `logger.error` **y** sale en `EstadoInicio.degradadas`, que la pantalla pinta arriba de todo: *«No pudimos calcular N señales. Esto no significa que estén bien: significa que no se pudieron mirar.»*

**El admin tiene que poder distinguir «no hay nada» de «no pude mirar».**

---

## Candados

- **Test estático del nombre de tabla**, con contraprueba: el candado detecta `"DemoMarcado"` en código y NO se dispara con la palabra dentro de un comentario (el archivo explica el defecto; explicarlo no puede poner el gate en rojo).
- **Test estático de que el silencio no vuelve**: exige `logger.error`, `degradadas.push`, tareas con etiqueta, y **cero `catch {}` vacíos** en el servicio.
- **Test estático del corte**: las 4 de CARGA reciben `incluirSembrados: boolean`; las de SALUD conservan la firma sin parámetro, así que no pueden empezar a filtrar por descuido.
- **El default está fijado por test**: la pantalla llama `calcularEstadoInicio({ incluirSembrados: false })` cuando no hay parámetro.

---

## Verificación

### Gate de código

- `npm run test:unit` → los 12 candados nuevos de `inicio-admin.marcado.test.ts` y los 12 de la pantalla (`page.test.tsx`, 5 nuevos del interruptor + 3 de degradadas), en verde.
- `npx tsc --noEmit` y `npm run lint` limpios.

### Contra una base de datos de verdad

`src/app/api/admin/inicio/senales/route.test.ts` → **22 tests verdes** (los 13 de SPEC-378 más 9 nuevos), corridos contra una base propia (`pi_spec414_test`, creada y destruida — nunca producción ni la base compartida):

- 5 reportes huérfanos, 4 marcados como sembrados → la señal **no** dispara (queda 1 real, bajo el umbral de 3), `sembrados.total = 4`, `degradadas = []`.
- Los mismos datos con `?prueba=1` → la señal **sí** dispara y dice «5 reportes».
- El conteo viaja en las dos lecturas, con y sin interruptor.
- El desglose por cola suma más de 4 y el total sigue siendo 4.
- **Simulaciones**: 5 huérfanos, 4 atados a una corrida (sin marca de demo) → la señal no dispara, `sembrados.total = 4`; con `?prueba=1` vuelve a decir «5 reportes»; y un reporte que es sembrado **y** de simulación se cuenta **una** vez.

**Prueba negativa de la exclusión de simulaciones**: se quitó el `AND sr.id IS NULL` y el test cae con *«4 de 5 son simulación: queda 1 real, bajo el umbral: expected { id: 'reportes_huerfanos' … } to be undefined»*. Restaurado, los 22 vuelven a verde.

### La prueba negativa de I-294

No basta con que el arreglo esté: hay que ver el defecto morir. Se reintrodujo el nombre viejo (`Prisma.raw("\"DemoMarcado\"")`) y se corrió la misma suite:

```
AssertionError: expected [ …(4) ] to deeply equal []
+ [ { "etiqueta": "reportes sin dueño", "id": "reportes_huerfanos" }, … ]
```

**Las 4 señales de CARGA aparecen en `degradadas`.** Antes de este PR ese mismo fallo desaparecía sin dejar rastro y la pantalla decía «Todo tranquilo». Restaurado el nombre correcto, los 19 tests vuelven a verde.

---

## Lo que hay que saber antes de desplegar

> ⚠️ **Al desplegar esto en producción, el Inicio va a quedar casi vacío. No es un defecto: es la primera vez que se ve el volumen real.**

Hoy el panel está lleno de colas alimentadas por los 9.000 reportes y los 254 casos de comité sembrados. Con el corte puesto, esas colas caen a su tamaño verdadero. Si alguien lo reporta como bug, la respuesta es el interruptor: un clic en «Incluir datos de prueba» devuelve exactamente lo que se veía antes.

Y hay un segundo motivo para esperar menos ruido del habitual: **`revision_manual_saturada` nunca funcionó** — no es que ahora muestre menos, es que antes no mostraba nada.

## Fuera de alcance

- El barrido de `Promise.allSettled` y `catch {}` vacíos en el resto de `src/` (encargo del CEO 16:4x, **después** de esta spec). Si el patrón está en un lado, está en tres.
- Borrar o resembrar datos en producción: eso es SPEC-412 y lo dispara el CEO.
