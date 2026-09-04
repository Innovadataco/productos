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

### 4) El seed faltante se descubre al desplegar, no al hacer clic

Fallar en cerrado mueve el problema: un seed que no corrió deja de perder avisos y pasa a dar **un 500 en la cara del Verificador**. Por eso `scripts/verify-reglas-notificacion.ts` (`npm run reglas:check`) corre en `deploy-prod.sh` **justo después del seed** y para el despliegue si falta una regla o su plantilla.

Sigue el patrón del guardián de índices (SPEC-251): **solo observa y reporta**, nunca crea ni repara. Y no le alcanza con que la regla exista — verifica también que la **plantilla esté activa**, porque el motor con plantilla ausente registra un warning, sigue de largo y devuelve `programadas: 0`, que es indistinguible de no tener regla.

**Se declaran los 15 eventos, pero solo dos bloquean** (decisión del CEO 18:2x). Los otros trece **avisan sin frenar el despliegue**: volverlos bloqueantes de golpe significaría enterarse de una brecha preexistente *por no poder desplegar*, en el peor momento. En modo aviso la brecha se descubre con calma y él decide cuáles pasan a bloquear con el dato en la mano — mismo criterio que el barrido de SPEC-415: inventario primero, decisión después.

Las cuentas, porque no son obvias: 15 callsites con `programadas === 0`; uno (`analisis/acciones/handlers/enviar-notificacion.ts:62`) dispara un evento **dinámico** y no se puede declarar; el del Verificador emite **dos** eventos según el resultado. 13 + 2 = **15 eventos declarados**.

### Y ya encontró algo

Contra una base recién migrada y sembrada, el guardián avisa de **dos eventos sin regla**:

```
[reglas:check] AVISO auth.registro_enlace_profesional — sin regla activa
                     callsite: src/lib/email-profesional.ts:18
[reglas:check] AVISO auth.bienvenida_profesional — sin regla activa
                     callsite: src/lib/email-profesional.ts:36
[reglas:check] VERDE — 13/15 evento(s) con regla y plantilla activas.
```

SPEC-391 agregó `email-profesional.ts` con sus dos eventos **y el seed nunca recibió sus reglas ni sus plantillas**. Los dos callsites fallan en cerrado, así que `enviarEnlaceRegistroProfesional` lanza — y la ruta `registro-profesional/solicitar` lo atrapa, lo registra y **responde 202 «revisá tu correo» igual**. El profesional espera un enlace que no va a llegar: **no puede registrarse**, y del lado de adentro no hay más que una línea de log.

Es la misma familia de I-295, en la **puerta de entrada** de la Red de Apoyo. Arreglarlo (sembrar esas dos reglas) queda **fuera de esta spec**: es de SPEC-391 y lo prioriza el CEO. Este guardián solo lo descubrió, que es para lo que se hizo.

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

### El guardián, probado en sus tres estados

| Estado de la base | Resultado |
|---|---|
| Migrada, **sin seed** | `exit 1` · nombra los dos eventos, qué sostiene cada uno y en qué callsite |
| **Con seed** | `exit 0` · «2 evento(s) con regla y plantilla activas» |
| Con seed pero **plantilla desactivada** | `exit 1` · «plantilla ausente o inactiva» — el caso que la regla sola no ve |

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
