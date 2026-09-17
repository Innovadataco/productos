# SPEC-698 (I-423) · «Olvidé mi contraseña» nunca reactiva una cuenta desactivada

**Status**: DESARROLLO

**Origen:** I-423 (el CEO, revisando #629, 16-09). **Carril:** Dev 1 · Calidad. **Orden:** después de #618; es seguridad, va antes que lo nuevo.

## El defecto

`login` respeta el estado: una cuenta `inactivo` (desactivada por un admin — `operadores.ts`, `profesionales-admin.ts`) NO recupera acceso ni con la contraseña correcta (`autenticacion.ts:96`). Pero el reset por correo lo saltea:

- `restablecerPassword` (`autenticacion.ts:237`) pone `estado: "activo"` **sin condición**. Una cuenta desactivada que canjea un token de reset se REACTIVA sola.
- `solicitarRecuperacion` (`autenticacion.ts:171-197`) le emite un token a **cualquier** cuenta que exista, sin mirar su estado — incluso a una desactivada.

Resultado: «Olvidé mi contraseña» es la puerta trasera que reactiva lo que el admin desactivó.

## El arreglo

1. **`restablecerPassword` NUNCA cambia `estado`.** Solo desbloquea el mecanismo de lockout (`intentosFallidos: 0`, `bloqueadoHasta: null`) y sella la contraseña nueva. El estado queda como estaba: un `inactivo` sigue `inactivo` (el login lo niega); un `bloqueado` queda con `bloqueadoHasta` limpio y el primer login exitoso lo pasa a `activo` (misma recuperación de siempre, sin que el reset toque el estado).
2. **`solicitarRecuperacion` no emite token a una cuenta `inactivo`.** La respuesta externa sigue siendo la genérica constante (`CUERPO_EXITO`) — la ruta ya no manda correo ni token para `tipo !== "ok"` (`recuperar/solicitar/route.ts`), así que no hay enumeración por cuerpo ni por tiempo (SPEC-630 intacto).

### Por qué `inactivo` y NO «estado ≠ activo»

El radicado dice «estado ≠ activo»; se implementa **solo `inactivo`** (lo que dice el mensaje del CEO: «una cuenta inactiva no recibe token»). Bloquear también `bloqueado` **atraparía el caso de reset más común**: quien olvida su clave falla varios logins → queda `bloqueado` → y entonces pide «Olvidé mi contraseña». `bloqueado` solo se limpia con un login exitoso (`autenticacion.ts:102`), que esa persona no puede hacer. Negarle el token la deja sin salida. Y no gana seguridad: el reset está atado al correo (un atacante no lo recibe), y bloquear `bloqueado` solo alarga un lockout que un atacante pudo inducir. `inactivo` (desactivación deliberada del admin) SÍ se niega — es la amenaza real.

## Candado de conducta

- **`restablecerPassword` no reactiva:** un `bloqueado` que canjea un token válido queda `bloqueado` (con `bloqueadoHasta` limpio), NO `activo`. Control positivo por remoción del discriminador: con la línea `estado: "activo"` puesta, queda `activo` → rojo. Un `inactivo` con token queda `inactivo` (defensa en profundidad: aunque el token exista, el reset no reactiva).
- **`solicitarRecuperacion` no emite token a `inactivo`:** cero filas en `tokenRecuperacion` y cero correos para la cuenta desactivada; control positivo sobre una `activo` (una fila de token). La respuesta HTTP es idéntica en ambos casos (anti-enumeración).

## Impacto

**Impacto en arquitectura:** cambio acotado a `dal/services/autenticacion.ts` (dos funciones) y `types/auth.ts` (un `tipo` nuevo), más sus tests. NO toca esquema, ni migraciones, ni la ruta (`recuperar/solicitar/route.ts` ya cierra la enumeración por construcción — respuesta constante, trabajo caso-dependiente despachado sin await). El invariante «el reset NO cambia el estado de la cuenta» queda del lado del servicio, con candado de conducta que muere si vuelve la reactivación.

## Fuera

- Cambiar la política de lockout (`bloqueado`) — este spec no la toca, solo deja de reactivar desde el reset.
- La reactivación legítima de una cuenta `inactivo` sigue siendo del admin (su carril), nunca del reset.
