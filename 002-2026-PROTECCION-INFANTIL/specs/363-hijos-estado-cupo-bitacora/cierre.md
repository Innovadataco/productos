# SPEC-363 · Cierre — el PATCH de estado por su camino correcto

**Fecha**: 01-09-2026 · **Dev**: PI-2 · **Rama**: `work/pi-SPEC-363-hijos-estado-cupo-bitacora`
(sobre #243, que incluye #241)

## El rojo de CI de #241 (primero, desbloquea el merge)

No era la validación de apellidos: el fixture de `MisHijos.test.tsx` usaba documento **"3003"** (4
dígitos), que la validación F7 (SPEC-361) rechaza como muy corto y corta el submit antes del POST.
Es dato inválido en el test, no validación de más — verificado: con un documento de 10 dígitos +
apellidos el happy path sí dispara el POST. Arreglado en la rama de #241 (`4dfa06338`); 10/10 verde.

## El punto único de los dos bugs

El `PATCH .../[id]` de estado pasaba por `actualizarHijo`. De ahí nacían los dos:

- **BUG1 (cupo burlable):** `actualizarHijo` no cuenta activos → reactivar burlaba el tope.
- **BUG2 (bitácora muda):** `actualizarHijo` audita `{campos:["estado"]}` sin el valor; la bitácora
  del menor (de PI-1) lee `valorNuevo.estado` → null → sin hito. `cambiarEstadoHijo` sí audita
  `{estado}` con el valor, pero ningún route lo llamaba.

**El arreglo:** la ruta separa el estado (→ `cambiarEstadoHijo`) de las correcciones de datos
(→ `actualizarHijo`); un PATCH que trae las dos cosas hace las dos. `cambiarEstadoHijo` gana el cupo
al reactivar (cuenta solo si el menor estaba inactivo; reafirmar "activo" sobre uno activo no
consume). El tope no lee parámetros dentro de `hijos.ts` (cadena de workers, SPEC-197): la ruta se
lo inyecta.

## Una sola fuente del tope y su texto

`src/lib/padre/tope-hijos.ts` centraliza el número máximo y la plantilla del mensaje aprobado por
Jelkin. Antes el texto vivía inline en la ruta de alta; con la segunda puerta (reactivación) habría
que duplicarlo, y dos textos "iguales" divergen. El POST también pasó a usar el helper.

## Tests (por el route real, no por la función directa)

- **BUG1:** 5 activos → inactivar 1 → registrar el 6º (201) → reactivar el inactivo → **409** con el
  texto aprobado, y el menor **sigue inactivo** (el rebote no lo dejó a medias). Más: reactivar con
  cupo disponible funciona, y reafirmar activo sobre uno activo no rebota.
- **BUG2:** pausar y reactivar por la ruta real → el audit trae `{estado:"inactivo"}` y
  `{estado:"activo"}`, y **no** hay ningún `{campos:[...]}` para el cambio de estado. Más: un PATCH
  mixto (apellidos + estado) corrige los datos Y audita el estado con valor.

El escenario del CEO queda fijado contra el handler real + BD, que es donde vivían los dos bugs.

## Gate

`tsc` limpio · lint **0 errores** · unit **1942/1942** · integración hijos **21/21** + hijos.ts
**13/13** · `next build` verde · `arch:check` VERDE.

## Nota

BUG1/BUG2 son lógica de backend; la prueba fuerte es el test de integración contra el route real y la
BD (reproduce el escenario exacto del CEO), no un clic de navegador — que ejercería los mismos
handlers. El consumidor de BUG2 (`bitacora-menor.ts`) es de PI-1 (SPEC-360, otra rama); este arreglo
produce el audit correcto que esa bitácora lee.

## Adenda · I-259 — los hitos de identificador se atan al menor

El `recursoId` de los audits de identificador es el del IDENTIFICADOR, no el del hijo, así que la
bitácora del menor no podía atar "activaste/pausaste/quitaste la cuenta" al menor correcto — y en
"quitar" la fila ya no existe para preguntarle. Dos puntos en `hijos.ts`, mismo lugar (`valorNuevo`)
que el evento AGREGADO que la bitácora ya lee:

- `cambiarEstadoIdentificador` → `{ hijoId, activo }`.
- `desvincularIdentificador` (borra la fila) → `{ hijoId }`, **nunca el valor del identificador**
  (PII, no vuelve al log).

Tests nuevos por las rutas reales (`identificadores/[id]/route.test.ts`): el audit lleva `hijoId` en
PATCH y DELETE, y el valor PII nunca aparece en el log. Con esto la bitácora del menor (F10, display
de PI-1 en #242) queda completa punta a punta.
