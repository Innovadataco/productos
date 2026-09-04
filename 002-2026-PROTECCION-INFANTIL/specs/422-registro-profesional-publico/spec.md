# SPEC-422 · «Soy profesional» era un enlace muerto — cierra I-297

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Dev 02 (`idc-80`) · **Origen**: **I-297**, verificada por el CEO contra producción (`curl https://pi.innovadataco.com/registro-profesional` → **307 → `/login`**).

**Impacto en arquitectura:** una entrada en `GUARDIAS_ACCESO.publicas`. No cambia el middleware, ni la página, ni ningún contrato.

---

## Para qué

La tarjeta «Soy profesional» de `/registro/inicio` apunta bien y la página existe. Pero `/registro-profesional` **no estaba en la allowlist de rutas públicas**, así que el middleware la cortaba antes de llegar: **307 → `/login`**.

Nadie podía inscribirse como psicólogo. Y el enlace del correo (`/registro-profesional/crear-clave/<token>`) caía en lo mismo.

### La trampa que lo causó

`matcheaRuta` es **prefijo por segmento**:

```ts
pathname === ruta || pathname.startsWith(ruta + "/")
```

Por eso `"/registro"` **no** cubre `"/registro-colegio"` ni `"/registro-profesional"` — el segundo carácter tras `/registro` es `-`, no `/`. Cada puerta necesita su propia entrada. Es fácil suponer lo contrario mirando la lista, y eso es exactamente lo que pasó.

### La tercera vez el mismo día

| Ficha | Qué quedó fuera de la allowlist | Consecuencia |
|---|---|---|
| **I-289** | `POST /api/webhooks/resend` | Resend reintentaba y descartaba los eventos de rebote |
| **I-290** | ítem del menú que rebotaba a otro ítem | la bandeja del admin, inalcanzable |
| **I-297** | `/registro-profesional` | **nadie puede inscribirse como psicólogo** |

Tres apariciones de la misma clase en un día. **Por eso el candado importa más que el arreglo.**

---

## Qué trae

### 1) La línea que faltaba

`"/registro-profesional"` en `GUARDIAS_ACCESO.publicas`, con el comentario que explica la trampa del prefijo por segmento para que nadie la borre pensando que `/registro` la cubre.

### 2) El candado, que **descubre las puertas en el disco**

No lista las tres a mano. Lee `src/app/registro*` y exige que **cada directorio con `page.tsx` esté en `publicas`**:

```
puertas de registro que rebotan al login: /registro-profesional.
Agregalas a GUARDIAS_ACCESO.publicas — una puerta de registro que exige
sesión es un enlace muerto (I-297).
```

**El día que nazca `/registro-<loquesea>`, el candado la exige sin que nadie se acuerde de venir a agregarla.** Un candado escrito a mano solo protege lo que ya se rompió; este protege la cuarta puerta, que es la que el CEO pidió cubrir.

Cubre además el **enlace del correo** (`/crear-clave/<token>`) de cada puerta: si rebota, el correo es tan muerto como la tarjeta.

### 3) Comportamiento a través del middleware

Siete casos nuevos en `middleware.test.ts`: las tres puertas y sus tres enlaces de correo, sin sesión, deben responder algo distinto de un 307 al login; y uno que fija la trampa — `matcheaRuta("/registro-profesional", "/registro")` es **false**.

---

## Verificación

- **126 tests verdes** entre `guardias.test.ts` (35) y `middleware.test.ts` (91).
- **Prueba negativa**: se quitó la línea de la allowlist y cayeron **4 tests**, nombrando la puerta culpable con el mensaje accionable de arriba. Restaurada, los 126 vuelven a verde.
- **Contraprueba del candado**: `esRutaPublica("/registro-inventado")` debe ser `false` — sin eso, un helper que devolviera siempre `true` dejaría el test en verde para siempre.
- `tsc` limpio · `lint` 0 errores · **2.308 unitarios verdes** · `arch:check` verde tras regenerar la línea base.

**Confirmación independiente**: la línea base de arquitectura ya documentaba el defecto. Al regenerarla, las dos filas cambian solas:

```diff
-| `/registro-profesional` | página | redirigir→/login | permite | **NO** |
+| `/registro-profesional` | página | permitir       | permite | sí     |
```

`docs/architecture/` lo venía diciendo desde que existe la página; nadie lo leyó como un defecto.

> **Verde en CI ≠ funciona.** Cierra en producción cuando `curl https://pi.innovadataco.com/registro-profesional` deje de responder 307.

---

## La puerta estaba cerrada dos veces

Esta spec abre **una** de las dos cerraduras:

| Ficha | Qué faltaba | Dónde se arregla |
|---|---|---|
| **I-297** (esta) | la ruta no era pública → la página no se alcanza | SPEC-422 |
| **I-296** | sin regla de correo → el enlace nunca sale | SPEC-419 (#323) |

**Las dos tienen que estar en producción para que alguien pueda inscribirse.** Con solo esta, el profesional llega al formulario y después espera un correo que no llega.

## Fuera de alcance

La página `/registro-profesional` en sí: está bien construida y no se toca.
