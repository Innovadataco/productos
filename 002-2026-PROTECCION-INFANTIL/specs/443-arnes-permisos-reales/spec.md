# SPEC-443 · El arnés de pruebas deja de repartir permisos que producción no da — cierra I-309

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: Dev 02 en fuente (04-09), verificado por el CEO en `origin/main` y contra la BD de prod. Radicado del CEO. Va **después** de SPEC-452 (que ya afirma la conducta real de operador/comité).

## El problema (I-309)

`src/lib/test-utils.ts` (`otorgarTodosLosPermisos`) encendía **43 módulos × 8 roles** en cada `resetDatabase()`. Prod es selectivo (`seed-modulos-grants.ts`). Falla en las dos direcciones y en silencio: una prueba que afirma «este rol lo bloquea `assertModulo`» pasa porque el guard devuelve `true`, no porque bloquee; una que afirma «este rol SÍ entra» pasa aunque en prod el rol no tenga el módulo (I-278: el comité no abría ningún caso con el CI en verde). **Candado de palabras a escala de suite entera.**

## Qué se hizo

1. **Fuente única.** `otorgarTodosLosPermisos` → **`sembrarPermisosDeProduccion`**, que llama `syncModulosYGrants` de `prisma/seed-modulos-grants.ts` — **el mismo módulo importado**, no una copia. El arnés siembra ahora exactamente el mapa de prod.
2. **Inventario de rojos (reportado al CEO antes de arreglar).** Full integration: **6 rojos en 5 archivos**, ninguno una brecha real (ningún rol necesita un módulo que no tenga → sin ficha nueva). Dos causas:
   - **A · el arnés precreaba filas `permisoModulo` que el mapa real no tiene** (3): `permisos-modulos` (VERIFICADOR), `denuncia-formal` (PARENT), `permiso-modulo` (repo). Hacían `update()`/snapshot sobre una fila inexistente.
   - **B · `syncModulosYGrants` siembra además el param real `seguridad.permisos_roles_protegidos`** (anti-lockout) que el arnés viejo no sembraba (3): `permisos-modulos` (anti-lockout, `create` duplicado), `parametros/todos` (contaba 3, ahora 4), `ia/rubrica/config` (`count()===0`, ahora 1).
3. **Arreglados afirmando la verdad**, sin volver a encender todo: A → el escenario crea/upserta la fila que necesita, o afirma el 403 directo si el rol nunca la tuvo; B → el escenario acota su conteo (upsert/deleteMany/filtro por clave) reconociendo que la BD de test se parece más a prod.

## La evidencia, acotada

Con el arnés en permisos REALES, **2876 tests pasan**. Enunciado con honestidad: el mapa real **alcanza para los caminos que los tests cubren**. No dice «no hay brecha» a secas — lo no cubierto sigue sin saberse. Es un dato, no una ilusión.

## Límite duro respetado (Causa A)

Crear/upsertar una fila valió SOLO donde su existencia es precondición legítima del escenario (el endpoint/repo opera sobre grants existentes). **No se le fabricó a ningún rol un módulo que el mapa real le niega para que una aserción pasara** — eso recrearía la mentira del arnés viejo a escala chica. Modelos: VERIFICADOR (se afirma el 403/estado ausente real, sin recrear la fila) y el repo (`snapshotDe`/`aplicarCambios` sobre un grant REAL, OPERADOR+bandeja_reportes; el camino de creación prueba la operación del repo, no un acceso fabricado).

## Mejora concreta (no daño colateral)

El arnés viejo **NO sembraba** `seguridad.permisos_roles_protegidos`: el anti-lockout **nunca se ejerció contra el parámetro real**. Ahora sí. Los 3 rojos de Causa B son el costo de que la BD de test se parezca más a prod — y el anti-lockout gana una prueba real que no tenía.

## Candado de conducta

`src/lib/arnes-permisos-reales.candado.test.ts`: tras `resetDatabase()`, compara las FILAS `permisoModulo` activas en BD contra `CLAVES_POR_ROL` y falla si se separan en cualquier dirección; además afirma que PARENT no tiene ningún módulo. **Verificado por mutación en LAS DOS direcciones:** agregar un permiso de más en el arnés → rojo (de sobra); quitar uno que el seed declara → rojo (de menos). La equivalencia arnés ≡ CLAVES_POR_ROL es bidireccional. No mira nombres de función; mira las filas reales.

## Lo que NO se tocó (radicado)

- **`seed-modulos-grants.ts`**: prod está bien; el que mentía era el arnés.
- **Ningún guard de producto.** Ningún rojo reveló una brecha real; si la hubiera, era ficha nueva al CEO, no se arregla acá.

## Impacto en arquitectura: no

Solo el arnés de tests + 5 tests afirmando la verdad + un candado. No toca schema, endpoints, seed de prod ni `tokens:check`.

## Referencias
- I-309 (este arnés) · I-278 (el comité sin acceso, con CI verde) · SPEC-452 (grants operador/comité, delante).
