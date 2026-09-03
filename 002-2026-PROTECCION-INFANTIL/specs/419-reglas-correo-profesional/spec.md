# SPEC-419 · El psicólogo puede recibir su enlace de registro — cierra I-296

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Dev 02 (`idc-80`) · **Origen**: **I-296 🔴**, descubierta por el guardián `reglas:check` de SPEC-418 **en su primer uso, antes de desplegar** · confirmada por el CEO contra producción.

**Impacto en arquitectura:** ninguno. Dos plantillas y dos reglas en `prisma/seed.ts`, aditivas e idempotentes. Ni una línea de `src/` cambia de comportamiento.

---

## Para qué

**El psicólogo no puede registrarse. No es que no quiera: es que no puede.**

SPEC-391 creó [`email-profesional.ts`](../../src/lib/email-profesional.ts) con dos eventos del motor — `auth.registro_enlace_profesional` y `auth.bienvenida_profesional` — y los escribió **fallando en cerrado**, que es lo correcto:

```ts
if (result.programadas === 0) {
    throw new Error("Sin reglas activas para auth.registro_enlace_profesional");
}
```

**Pero el seed nunca recibió sus reglas ni sus plantillas.** Confirmado por el CEO contra producción: `SELECT evento, activa FROM notificacion_reglas WHERE evento ILIKE '%profesional%'` → **0 filas**, contra 109 reglas activas. Nadie las creó a mano.

Y el defecto era **invisible desde afuera**, porque [`solicitar/route.ts:70`](../../src/app/api/auth/registro-profesional/solicitar/route.ts) atrapa el throw, lo registra y **responde 202 igual**:

> «Si el correo es válido, te enviamos un enlace para crear tu contraseña.»

El profesional llena el formulario, lee esa frase, y espera un enlace que no existe. Del lado de adentro no queda más que una línea de log.

> **Lo que esto explica:** veníamos leyendo «cero profesionales en producción» como que nadie se había inscrito. Era otra cosa.

---

## Qué trae

Dos bloques de seed, siguiendo el patrón de la puerta del padre (SPEC-339):

| Evento | Plantilla | Rol | Obligatoria |
|---|---|---|---|
| `auth.registro_enlace_profesional` | `…​.email` con `{{url}}` | `PROFESIONAL` | **sí** |
| `auth.bienvenida_profesional` | `…​.email` con `{{urlLogin}}` y `{{urlCompletarPerfil}}` | `PROFESIONAL` | **sí** |

**Obligatorias** por la misma razón que las del padre: sin el correo no puede entrar, así que no admiten opt-out.

La bienvenida además le dice lo que le falta — completar el perfil y subir la autorización —, porque sin ese paso su perfil queda en `BORRADOR` y no llega a la cola del Verificador.

### Lo que NO se toca

**El 202 se queda como está.** Es el anti-enumeración de SPEC-338: la respuesta tiene que ser idéntica exista o no el correo. El arreglo era sembrar las reglas, no cambiar la respuesta.

**El `throw` tampoco se ablanda.** Fallar en cerrado es lo correcto — si mañana falta la regla otra vez, tiene que romperse, no perderse. Hay un candado que exige que los dos `programadas === 0` sigan ahí.

---

## Verificación

**3 tests de integración verdes** contra una base propia (`pi_419_test`, creada y destruida):

- Con la regla sembrada → **1 fila `ENCOLADA`** para el profesional, con el enlace `/registro-profesional/crear-clave/...` dentro de `variables`.
- **Sin la regla — la reproducción exacta de I-296** → la respuesta es la **misma 202** y hay **cero filas**. El log del test lo muestra literal:
  ```
  [ERROR] [REGISTRO_PROFESIONAL] Error al enviar correo a p***@ejemplo.local:
          Error: Sin reglas activas para auth.registro_enlace_profesional
  ```
  Por eso mirar el status nunca lo habría encontrado, y por eso el test mira la tabla.
- El `TokenRegistro` se creaba **igual desde siempre**: el agujero estaba en el aviso, no en el servicio de registro. Se afirma para no atribuirle a `RegistroEnlaceService` un defecto ajeno.

**9 candados estáticos**: los eventos se leen **del emisor** (no escritos a mano en el test), cada uno debe tener regla y plantilla, del rol correcto y obligatorias, las plantillas deben nombrar las variables que el emisor envía —una plantilla sin `{{url}}` manda un correo sin enlace, que sirve tanto como no mandarlo— y los dos `throw` deben seguir en pie.

**Seed corrido de verdad** contra una base limpia: las dos reglas quedan `rol=PROFESIONAL, obligatoria=t, activa=t`.

`tsc` limpio · `lint` 0 errores · suite unitaria completa en verde.

> **Verde en CI ≠ funciona.** Esto cierra en producción cuando alguien complete el formulario de registro profesional y **reciba el correo**. Antes de eso, la señal barata es `reglas:check` en el contenedor: los dos eventos tienen que salir en OK.

---

## Cómo apareció, que es lo que vale registrar

Este defecto **no lo encontró una persona mirando**. Lo encontró el guardián de SPEC-418 la primera vez que se corrió, contra una base recién sembrada, **antes de desplegar nada**. Estaba vivo desde SPEC-391 y nadie lo había visto porque su síntoma es el silencio.

Es el mejor argumento para que los trece eventos que hoy solo avisan pasen a bloquear.
