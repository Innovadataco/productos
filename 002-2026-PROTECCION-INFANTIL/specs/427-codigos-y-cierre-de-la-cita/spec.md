# SPEC-427 · Los dos códigos y el cierre de la cita — A-75 · L6

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-80`) · **Origen**: brief A-75 §9 momento 6 · §3 · cierra **I-300** y **I-301**

**Impacto en arquitectura:** migración aditiva (`CodigoCita`, `TipoCodigoCita`, `SolicitudCita.autocerradaEn`, 7 acciones de auditoría). **Un servicio nuevo en producción**: `pi-citas`, el worker que corre los barredores de la cita. Tres endpoints nuevos y dos eventos del motor de notificaciones que **bloquean el despliegue** si les falta la regla.

---

## Para qué

El brief llama a esto «el corazón del cierre». Dos códigos, únicos, de un solo uso, con vigencia de 30 minutos:

| Código | Para qué | Cuándo llega |
|---|---|---|
| **De cita** | Certifica que la sesión **ocurrió** | Al padre, 10 minutos antes, diciendo en el mismo mensaje que vence en 30 |
| **De expediente** | Autoriza a **abrir el expediente** | Solo si el padre eligió compartirlo |

El padre se los dicta al profesional en la sesión. El profesional los digita.

Con las palabras del brief: *«la autorización deja de ser una casilla marcada días antes y pasa a ser un acto del padre, en el momento, con constancia. Si se arrepiente, no entrega el código y no hay nada que revocar.»*

**Con esta spec, por primera vez, alguien escribe `CUMPLIDA`.** El estado existía en el enum desde L4 y no lo ponía nadie: el candado de SPEC-425 lo dejó anotado y cayó hoy, que era exactamente para lo que estaba puesto.

---

## Lo que se encontró en el camino

Dos defectos que no estaban en el pedido y que se arreglan acá porque esta spec pisa el mismo código.

### I-300 · La bandeja del Verificador mostraba solicitudes impagas como incidentes

`SIN_CONFIRMAR` significaba dos cosas: **el estado inicial** de una solicitud que nadie pagó, y **«la cita pasó y nadie la cerró»**. La cola 2 filtraba solo por el estado, así que cada solicitud impaga aparecía en la bandeja del Verificador como un incidente por resolver.

Se separa con **columna dedicada** (`autocerradaEn`), no infiriendo del pago — es la regla de SPEC-398 / I-278: cuando un valor carga dos intenciones, la separación va en una columna.

### I-301 · Los barredores de la cita no los llamaba nadie

`barrerAvisoVencimiento48h` y `barrerPlazoPagoDelPadre` (SPEC-395) estaban escritos, probados y mergeados — y **sin un solo llamador**. Ni un `boss.schedule`, ni un servicio en el compose. En producción **el reloj de 48 h del brief §3 nunca corrió**: la franja de una solicitud sin responder no se liberaba y el padre no recibía el aviso.

Es degradación silenciosa de manual: funcionaba lo suficiente para no avisar. El arreglo tiene que avisar la próxima vez, así que además del worker va un candado que **rompe el build si un barredor exportado no tiene llamador**.

---

## Cómo quedó

**Un modelo para los dos códigos, con el tipo en columna dedicada.** Son dos cosas distintas que en algún momento van a divergir; inferirlas de la forma sería el error que ya se pagó en I-278.

**Cada emisión es una fila, y ese conjunto ES la traza** que el brief exige que vean los tres. Cuántas veces se pidió = contar filas. Si el profesional lo digitó = `usadoEn`.

**El envío no se copia: se apunta.** `notificacionId` referencia la fila del motor, que es la única que sabe si el correo salió, cuándo, y si falló. Un `enviadoEn` propio mentiría el día que el proveedor esté caído (I-295).

**El código y su aviso nacen juntos o no nacen.** Van en la misma transacción: si el aviso no se encola, el código no queda. Sin eso, la cita tendría código emitido —y por lo tanto fuera del barrido— pero el padre nunca lo recibiría: no podría cerrarse jamás y nadie se enteraría.

**El código se emite cerca de la cita, no al confirmar.** Un barredor cada 5 minutos lo emite y programa el correo con `enviarEn`. Cuanto menos tiempo exista un código en la base, menos tiempo hay para que sirva de algo si alguien lo ve donde no debe.

**Un solo uso de verdad**: el consumo va con `updateMany ... WHERE usadoEn IS NULL`. Si dos peticiones llegan juntas, gana una.

**Los dos estados de cierre tienen un único escritor.** `CUMPLIDA` (con código) y `NO_ASISTIO_PADRE` (declaración del profesional, sin código porque no hay quién lo dicte) se escriben solo en el repositorio, y un candado lo custodia.

---

## Verificación

**9 tests de integración contra una base propia**, creada y destruida para esto:

- El barrido emite el código **una vez**: una segunda corrida no le manda otro correo al padre.
- El código correcto cierra; **el mismo código no cierra dos veces**.
- Un código **vencido no gasta intentos** — vencer no es fallar.
- Cinco códigos equivocados y se cierra la puerta.
- La traza cuenta las dos emisiones y marca **cuál se digitó**.
- A los 5 días sin código, la cita se autocierra y **deja su marca**.
- **I-300**: la bandeja muestra la autocerrada y **no** la impaga recién creada.
- La bandeja trae la traza instrumentada, no un `null`.

**Probado muriendo, dos veces:**

| Defecto reintroducido | Qué pasó |
|---|---|
| Filtro viejo (`estado` a secas) en la cola 2 | El test de I-300 **falla**: la impaga aparece en la bandeja |
| El worker sin llamar a los dos barredores de SPEC-395 | El candado **falla** y nombra cuáles quedaron huérfanos |

**39 candados estáticos** en tres archivos: que el código nunca se guarde ni se audite en claro, que use CSPRNG, que el orden de validación sea vencimiento → intentos → comparación, que el barrido sea idempotente por consulta, que el cron sea más frecuente que la anticipación del recordatorio, y que los dos estados de cierre tengan un solo escritor. Cada uno con su contraprueba.

`tsc` limpio · `lint` 0 errores · `arch:check` verde · `locks:check` 14 IDs sin colisión.

> **Verde en CI ≠ funciona.** Esto cierra cuando un padre reciba su código diez minutos antes y un profesional cierre una cita con él en producción.

---

## Lo que NO trae, a propósito

- **La plata.** Liberar el pago, el giro y la devolución del autocierre son de **L7**. Acá la cita queda cerrada o marcada, y el incidente arriba de la mesa del Verificador — que es lo que hace falta para poder devolver.
- **Las encuestas.** Son de **SPEC-429**, en paralelo. El punto de unión es `al-cumplir.ts`: una función vacía que 429 llena y que 427 llama en los dos cierres.
- **El aviso al administrador por correo.** El brief dice «se le avisa al padre y al administrador». Al padre, por correo. Al administrador, **por la cola 2**, que es su canal real y queda hasta que alguien la resuelva. Un correo más a una casilla compartida no es un aviso: es ruido.
- **El autocierre de la cita virtual con las dos entradas registradas** (brief §3). PI no hospeda la cita, así que no hay entradas que registrar.
