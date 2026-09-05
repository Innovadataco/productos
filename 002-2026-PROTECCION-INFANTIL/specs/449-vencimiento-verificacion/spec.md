# SPEC-449 · La verificación vencida saca al profesional del directorio — cierra I-313

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-63`) · **Origen**: hallado en fuente preparando SPEC-441, verificado por el CEO en `origin/main` y en la BD de producción

**Impacto en arquitectura:** un worker nuevo (`pi-verificacion-vencimiento`) con su servicio en los dos compose, su advisory lock y su señal de monitor. Sin migración. `arch:check` regenera `06-stack.md`.

---

## El hueco

La Ley 2375/2024 obliga a revalidar antecedentes cada **4 meses**. **SPEC-389 construyó dos mecanismos para hacerlo cumplir y ninguno estaba cableado:**

| Pieza | Estado real antes de esta spec |
|---|---|
| `listarActivos` (`perfil-profesional.ts:184`) | filtraba **solo** `{ estado: "ACTIVO" }` — no miraba vigencia |
| `puedeAparecerEnDirectorio` (`vigencia.ts:127`) | **sí** comprueba el vencimiento · **cero llamadores** fuera de su test |
| `decidirAcciones` (`cron-vencimiento.ts:56`) | decide `MARCAR_VENCIDO` · **cero llamadores** · ningún `.mjs`, ningún job |

**Y el remate: nada en todo el árbol escribía `estado = "VENCIDO"`.** Un perfil no podía llegar a ese estado por ningún camino, así que **un profesional cuyos antecedentes caducaron seguía en el directorio del padre para siempre.**

Es la **quinta vez en el día** de la misma clase —construido, probado, nunca llamado— y la primera con consecuencia legal.

---

## El bloqueante que apareció al diseñar, y que habría empeorado las cosas

**Escribir `VENCIDO` habría encerrado al profesional para siempre.** Verificado en los cuatro eslabones antes de tocar nada:

- `reenviarParaVerificacion` lanzaba **«Solo se puede reenviar desde BORRADOR»**.
- Las rutas del profesional solo hacen `BORRADOR → EN_REVISION`.
- La cola del Verificador lista **solo** `EN_REVISION` (`verificador-repository.ts:49`).
- `decidir` aborta si el estado no es `EN_REVISION` (`service.ts:203`).

`VENCIDO` era un **callejón sin salida**: el profesional no podía reenviar, el Verificador no lo veía y nadie podía decidir sobre él. Tal como estaba escrito el radicado, esta spec habría creado **un defecto peor que el que cierra**.

**Arreglo (aprobado por el CEO):** `reenviarParaVerificacion` acepta también `VENCIDO`. `RECHAZADO` y `SUSPENDIDO` **siguen sin poder** — son decisiones humanas de IDC, no un plazo cumplido.

---

## Lo construido

**1 · El reloj, cableado.** `worker-verificacion-vencimiento.mjs` corre diario y llama a `ejecutarCorridaVencimiento`, que le pide la decisión a `decidirAcciones` —la lógica que ya existía— y **la aplica**. `createQueue` **antes** de `schedule`/`work` (I-131). Escrituras con **CAS**: `marcarVencidoSiActivo` solo si sigue `ACTIVO`, y el aviso se **sella antes de enviarse** para que dos corridas cruzadas no manden dos correos. **La corrida falla ruidosamente** si alguna acción no se pudo aplicar: un reloj que se traga sus errores y termina «bien» es la misma degradación silenciosa que esta spec cierra.

**2 · El directorio filtra por estado ∧ vigencia.** El worker corre una vez al día; entre que los antecedentes caducan y que el reloj pasa, el perfil sigue `ACTIVO`. `vigenciaVigente` cierra esa ventana **en la consulta**, así que **las dos defensas suman en vez de sustituirse**. Va en `listarActivos` y en `obtenerPublicoPorId` — este último lo usa `cita.service` para validar al profesional, así que de paso **bloquea las citas nuevas** contra un vencido.

**3 · El aviso, antes de que venza.** Plantilla y regla **sembradas**, y la hora de la corrida es un parámetro con default duro: un valor inválido cae a las 02:00 **sin romper el worker**. Clave propia, no la de pagos — atar dos relojes de dominios distintos al mismo parámetro hace que mover uno mueva el otro sin que nadie se entere.

**4 · El contacto se cierra.** `debeExponerContacto` devuelve **falso** para un perfil `VENCIDO` aunque la cita esté confirmada: PI no puede seguir sirviendo el teléfono de alguien de quien **ya escribió en su propia auditoría** que venció. Y el parámetro quedó **cableado** en el mapper — uno sin llamador habría sido el defecto que esta misma spec cierra.

> **El punto 4 del radicado —qué pasa con las citas ya confirmadas— lo decidió el CEO** con un panel de cuatro propuestas enfrentadas que **empataron 22-22-22-23 y cuyos cuatro jueces rechazaron la suya**. No hubo ganadora: el dilema no tenía salida limpia. Lo disolvió el **tope de horizonte**, que vive en **SPEC-447** por decisión suya: si ninguna franja puede terminar después del `venceEn`, ninguna cita nueva cae del otro lado del vencimiento. **Prevenir en vez de cortar** — cancelarle la cita a un menor en riesgo por un papel vencido puede hacer más daño que el que evita.

---

## Candados · probados muriendo

| Mutación | Rojos |
|---|---|
| Que el worker deje de llamar a la corrida, y la corrida de escribir el estado | **2** — los de cableado |
| Quitar el filtro de vigencia del directorio | **2** — no aparece en la lista · su ficha da 404 |

El candado central es de **CABLEADO**, no de existencia: la lógica ya existía y ese era justamente el problema. Verifica además que el worker esté en **los cinco sitios** de registro —advisory lock, los dos compose, el adapter y las señales del monitor—, porque un worker sin registrar queda muerto o rompe una compuerta.

`tsc` limpio · lint 0 errores · **`locks:check` 14/14** · **`arch:check` VERDE** · **`tokens:check` en el piso** · unit **287/287 (2407)**.

> **Un test ajeno mejorado, no parcheado.** El del monitor afirmaba la lista de señales **literal**, y se desincronizaba cada vez que un worker sumaba la suya —pasó con SPEC-427 y volvió a pasar acá—, con el rojo saliendo en el shard 3 de CI a los 21 minutos. Ahora **deriva de `SENALES_MONITOREO`**: sigue vigilando que el tablero devuelva todas, y deja de romperse porque se agregó una bien.

> **Verde en CI ≠ funciona.** Cierra cuando en producción un perfil con antecedentes caducados **deje de estar en el directorio** y quede la fila en `VENCIDO` puesta **por el worker**, no a mano.
