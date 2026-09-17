# SPEC-698 · Plan

## Impacto en arquitectura

Dos funciones de `src/lib/dal/services/autenticacion.ts`:
- `restablecerPassword`: quitar `estado: "activo"` del `update` (la única línea que reactiva). El resto del reset (password, desbloqueo de lockout, flags) queda igual.
- `solicitarRecuperacion`: tras `findByEmail`, si `usuario.estado === "inactivo"`, devolver un `tipo` distinto de `"ok"` (sin crear token). La ruta ya trata `tipo !== "ok"` como «no mandar nada», con respuesta constante → sin enumeración.

No hay cambio de esquema, migración, ni contrato de API. El único riesgo es de conducta (¿el reset sigue reactivando?), y lo cubre el candado.

## Orden de trabajo (candado antes del fix)

1. Candado de conducta que hoy queda ROJO: `bloqueado` que resetea NO queda `activo`; `inactivo` no recibe token. (Con el código actual, ambos fallan.)
2. Quitar `estado: "activo"` de `restablecerPassword`.
3. Guardia de `inactivo` en `solicitarRecuperacion`.
4. Corregir `restablecer/route.test.ts:42` (hoy fija «reset → activo»): pasa a afirmar preservación del estado.
5. Verde + preflight (tsc, lint) + PR.

## Verificación

- Candado rojo→verde por la remoción del discriminador (mutación: reponer `estado: "activo"` → rojo).
- Suite de `recuperar/**` y `auth` sin regresión.
- El caminado del recorrido (forgot-password → bloqueado → reset → login) lo valida Calidad.
