# SPEC-418 · El aviso de devolución al profesional no se pierde — cierra I-295

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Dev 02 (`idc-80`) · **Origen**: **I-295**, cazada por Calidad recorriendo producción · radicado del CEO 17:55.

**Impacto en arquitectura:** el motor de notificaciones gana la capacidad de **programar dentro de la transacción del llamador** — `programar(input, { tx })` y `despacharEnvios()`. Es aditivo: el campo nuevo del resultado es opcional y los llamadores existentes no cambian ni de firma ni de conducta. No hay migración; el catálogo de los dos eventos nuevos se siembra idempotente en `prisma/seed.ts`.

---

## Para qué

[`verificador/service.ts:288`](../../src/lib/profesionales/verificador/service.ts) enviaba el aviso de la decisión con `enviarEmailNotificacion` — el envío **directo** por Resend, el mismo que usa el worker — **fuera de la transacción y con el error tragado** en un `catch` que solo hacía `console.error`.

Con el proveedor caído (**hoy lo está, por cuota**) el resultado es:

- El profesional **nunca se entera** de que le devolvieron la solicitud.
- **No queda ninguna fila** en `notificaciones` que permita saberlo después.
- **El ciclo de admisión se detiene en silencio** y nadie lo nota: el profesional espera una respuesta que no va a llegar, y del lado de adentro la decisión figura tomada.

Es el mismo barrido de SPEC-415 aplicado al caso que más duele, porque **de este aviso depende que el ciclo siga**.

---

## Qué trae

### 1) El motor aprende a programar dentro de una transacción

`programar(input, { tx })`. Con `tx`, los cinco repositorios del motor se arman sobre la transacción del llamador, así que la fila de `Notificacion` nace **atómica con la decisión que la origina**: o se guardan las dos, o ninguna.

**Lo que NO se hace adentro es el despacho a pg-boss.** pg-boss corre por otra conexión: si se despachara dentro y la transacción revirtiera, quedaría un job apuntando a una fila que no existe. Los despachos se devuelven en `ProgramarResult.envios` y el llamador los dispara **después del commit** con `despacharEnvios()`.

Y si ese despacho falla, **no se pierde nada**: la fila ya está `ENCOLADA` y el worker tiene polling de respaldo — `worker-notificaciones.mjs` lo dice literal: *"Polling de respaldo para reintentos y jobs perdidos"*. El despacho solo adelanta el envío; no lo condiciona. **Esa propiedad es la que hace que el aviso no se pueda perder.**

Sin `tx` todo queda exactamente como estaba: despacho en línea y `envios` vacío. `envios` es opcional en el tipo justamente porque solo tiene sentido en el camino transaccional.

### 2) El Verificador encola en vez de enviar

El aviso pasa por el motor como el resto del producto, con dos eventos propios: `profesional.verificacion.aprobada` y `profesional.verificacion.devuelta`. El helper `enviarEmailProfesional` se eliminó — su texto vive ahora en las plantillas sembradas, editables sin desplegar.

**Falla en cerrado.** Si el motor no encuentra regla activa, `programar` devuelve `0` y el service **lanza dentro de la transacción**: la decisión no se guarda. Es deliberado — mejor que la decisión no pase y se vea el error, a que pase y el aviso desaparezca, que es exactamente I-295. Precedente: `enviarCodigoVerificacion` ya falla en cerrado por la misma razón desde SPEC-296.

Si el envío después falla, la fila queda `FALLIDA` **con el motivo real del proveedor** — eso ya lo da SPEC-401, que entró hoy.

### 3) El catálogo, sembrado y parametrizable

`seedVerificacionProfesional()` en `prisma/seed.ts`: plantilla + regla por evento, idempotente (patrón I-100). Las dos reglas son **`obligatoria: true`** a propósito — no son marketing, son el paso que hace avanzar el ciclo, y nadie puede quedarse sin ellas por una preferencia. Como además el service falla en cerrado, una regla desactivada **bloquea** la decisión en vez de perderla en silencio.

---

## Verificación

### Contra la base de datos, que es donde se ve

`decidir/route.test.ts` — **4 tests verdes** contra una base propia (`pi_spec418_test`, creada y destruida; nunca producción ni la compartida). Afirman lo único que importa: **después de decidir, existe la fila en `notificaciones`.** Un envío directo no deja fila; el motor sí — por eso el candado mira la tabla y no un espía.

- **Devolución** → 1 fila en `profesional.verificacion.devuelta`, `ENCOLADA`, al usuario correcto, con el detalle de qué corregir dentro de `variables`.
- **Aprobación** → 1 fila en su propio evento.
- **Atomicidad** → con la regla desactivada: 500, **cero** `VerificacionProfesional`, el perfil **sigue en `EN_REVISION`** y cero notificaciones. El aviso y la decisión viajan juntos.

### La prueba negativa

Se simuló la conducta vieja (la decisión commitea, el aviso no deja fila) y se corrió la misma suite:

```
× DEVOLUCIÓN: deja fila en `notificaciones` …
  → sin fila, el aviso se perdió — eso es I-295: expected [] to have a length of 1 but got +0
× APROBACIÓN: también deja su fila …
× el aviso y la decisión viajan JUNTOS …
✓ una verificación aprobada deja el perfil ACTIVO y su fila de historial
```

**Ese cuarto test pasó con el defecto vivo.** Es la lección: un test que solo mira que el perfil quedó `ACTIVO` habría estado en verde todo este tiempo con I-295 abierta. Lo que caza el defecto es preguntar por la fila del aviso.

### Gate

13 candados estáticos nuevos (con contraprueba de que el candado no se dispara por un comentario) · `tsc` limpio · `lint` 0 errores · `tokens:check` sin subir el piso · **2.242 unitarios verdes**. Seed corrido de verdad: las dos reglas quedan `obligatoria=t, activa=t`.

> **Verde en CI ≠ funciona.** Lo que cierra esto en producción es abrir una devolución real con el correo caído y ver la fila `FALLIDA` con el motivo del proveedor, en vez del silencio de hoy.

---

## Una corrección al radicado

El radicado decía *"se encola en `notificaciones` dentro de la transacción, **como el resto del motor**"*. Verificado en fuente: **ningún llamador del motor pasaba una transacción** — `programar()` ni siquiera aceptaba una. Los 30+ callsites de `email.ts`, `email-colegio.ts`, expediente, análisis y comité programan siempre después de sus escrituras.

Así que esto no es alinear el Verificador con una práctica existente: es **estrenarla**. Se implementó como pedía la intención del radicado y de forma aditiva, para que el resto del motor pueda adoptarla cuando se decida — pero conviene que quede escrito que hoy el Verificador es el único que la usa.

## Fuera de alcance

- Migrar los demás callsites al camino transaccional. Aditivo y disponible; es una decisión de alcance del CEO, no un efecto colateral de esta spec.
- El resto del inventario de SPEC-415 (grupos A restante, C con I-236, D después).
