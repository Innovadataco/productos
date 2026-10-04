# SPEC-861 · I-413 · Una ruta muerta que instala sesiones

> Nota de feature opcional. Seguridad. Ficha: gestión `REGISTROS/INCIDENCIAS.md` → I-413.

## El defecto

`POST /api/auth/verificar/completar` llamaba `setSessionCookie` (instala sesión) y **no la invocaba ningún llamador del producto**. El padre va por `registro/completar` (SPEC-339) y el colegio por `registro-colegio/completar`; esta ruta quedó superada. Mientras fuera alcanzable por HTTP era **superficie de entrada de sesiones sin dueño**: nadie la camina, nadie la prueba, nadie nota si cambia de conducta. Además el journey `padre.test.tsx` la ejercía → daba verde sobre **código muerto**, sin probar el camino real del padre.

## Qué se hizo

1. **Borrada** la ruta `verificar/completar` (`route.ts` + `route.test.ts`) y su validador propio `verificarCompletarSchema`/`VerificarCompletarInput` (solo lo usaba esa ruta).
2. **Repuntado** `padre.test.tsx` al camino VIVO (SPEC-339): acuña el enlace con `RegistroEnlaceService().solicitarEnlace()` —el token no se expone por `registro/solicitar` por anti-enumeración (SPEC-338), igual patrón que `registro/completar/route.test.ts`— y completa el alta por `POST /api/auth/registro/completar`.
3. **Candado de clase (I-413)** en `src/lib/auth/sesion-cookie-refresca-contexto.candado.test.ts` (segundo `describe`, MISMA derivación del árbol que el candado I-411): **toda ruta que llama `setSessionCookie` tiene al menos un llamador en el producto** (un test no cuenta). Con control positivo bidireccional: descubre una viva conocida (`/api/auth/activar`→ActivarForm) y devuelve 0 para una ruta inexistente. Muere con el defecto: con `verificar/completar` presente, su conteo de llamadores era 0 → rojo.

## Por qué el candado extiende el de I-411 y no es nuevo

El candado de I-411 solo vigila rutas de sesión que **tienen** llamador cliente (itera `callers`); una ruta con **cero** llamadores es invisible para él — justo el hueco de I-413. Se añadió como segundo `describe` en el mismo archivo para reusar `fuentesDeSrc`/`urlDeRoute`/`LLAMA_SET_COOKIE`/`invoca` y que no existan dos definiciones de «qué es una ruta de sesión» que se desincronicen.

## Hallazgo (fuera de alcance — para el CEO)

- Al borrar `verificar/completar`, **`AutenticacionService.completarRegistro` queda huérfano** (era su único llamador; `src/lib/dal/services/autenticacion.ts:327`), con su docstring apuntando a la ruta borrada. No lo toco: es método de servicio (no superficie HTTP, no cae en la clase del candado) y el radicado pedía «una cosa a la vez». Candidato a barrido follow-up.
- `registrarPublico` NO queda huérfano: lo comparte `registro-colegio/completar`.

## Verificación

- **Candado** validado DB-free (replica fiel del barrido): `rutasCookie` = 5 rutas vivas (sin `verificar/completar`), cada una con 1 llamador de producto, control negativo = 0 → verde; pre-cambio habría dado rojo por `verificar/completar`.
- **tsc**: mis archivos sin errores (los de `scripts/demo-prod/*` del árbol son cliente Prisma stale del entorno local, no de este cambio; CI regenera).
- **eslint**: limpio en los archivos tocados.
- **DB-backed** (candado en vitest `test-unit`, journey en job `journeys`): corre en CI con cliente fresco + base migrada.
