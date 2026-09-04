# Plan · SPEC-449 — La verificación vencida saca al profesional del directorio

## Análisis en fuente (antes de escribir una línea)

| Archivo | Qué se sacó |
|---|---|
| `perfil-profesional.ts:184` | `listarActivos` filtra solo por estado. `obtenerPublicoPorId` igual, y tiene **tres** consumidores — uno es `cita.service`. |
| `vigencia.ts:127` · `cron-vencimiento.ts:56` | Lógica correcta, pura, sin imports… y **sin llamadores**. |
| Barrido de `VENCIDO` en todo el árbol | Solo declaraciones de tipo y lecturas. **Nadie lo escribe.** |
| `vista-profesional.ts:66` · `verificador-repository.ts:49` · `service.ts:203` | Los cuatro eslabones que hacen de `VENCIDO` un callejón sin salida. |
| `worker-vigencia-pagos.mjs` | El molde del corte diario: lock → `ensureStarted` → `createQueue` → `schedule` → `work`, con la lógica en un `.service.ts`. |
| `ADVISORY-LOCKS.md` · los dos compose · `docker-adapter.ts` · `probes.ts` | Los **cinco** sitios de registro. Sin uno, el worker queda muerto o rompe una compuerta. |

## Decisiones

- **Cablear lo que existe, no reescribirlo.** `decidirAcciones` se usa tal cual; lo que faltaba era la consulta que lo alimenta y quien aplique el resultado.
- **La ejecución va en un `.service.ts`, no en el `.mjs`.** El comentario de cabecera de `cron-vencimiento.ts` dice lo contrario, pero el molde real de la casa deja el `.mjs` como cáscara y la lógica del lado testeable.
- **Imports relativos** en todo lo que entra en la cadena del worker (SPEC-197 · I-88).
- **CAS en las dos escrituras**, y el sello del aviso **antes** de enviarlo: sellar después deja la ventana para dos correos.
- **La corrida lanza si hay errores.** Un reloj que termina «bien» con acciones fallidas es el defecto que la spec cierra.
- **Clave de parámetro propia**, no la de pagos.
- **Señal de monitor propia:** un worker legal que muere en silencio es el mismo defecto con otro disfraz.

## Riesgo

| Riesgo | Cómo se acota |
|---|---|
| Que el reloj se vuelva a quedar sin llamador | Candado de cableado que exige la llamada en el worker **y** la escritura en el servicio. Muere al quitar cualquiera de las dos. |
| Que `VENCIDO` encierre al profesional | `reenviarParaVerificacion` acepta `VENCIDO`; candado en las dos direcciones (`RECHAZADO` sigue sin poder). |
| Que el worker quede a medio registrar | Candado que verifica los cinco sitios; `locks:check` y `arch:check` cubren dos de ellos por su lado. |
| Que la ventana previa al reloj deje pasar a un vencido | El filtro de vigencia va en la CONSULTA, no solo en el estado. |
| Que dos corridas dupliquen correos | Sello con CAS antes de enviar. |
