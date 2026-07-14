# Quickstart — Restablecimiento de Contraseña

## Escenario A: Solicitar restablecimiento

1. Navegar a `/recuperar`.
2. Ingresar email registrado.
3. Enviar formulario.
4. Confirmar mensaje genérico (sin revelar existencia).

**Validación**: `POST /api/auth/recuperar/solicitar` retorna 200 con mensaje genérico. En dev, respuesta incluye `devToken`.

---

## Escenario B: Validar token

1. Acceder a `/recuperar/[token]` con token válido.
2. Confirmar que se muestra formulario de nueva contraseña.

**Validación**: `GET /api/auth/recuperar/validar?token=...` retorna `{ valido: true }`.

---

## Escenario C: Restablecer contraseña

1. En `/recuperar/[token]`, ingresar nueva contraseña válida.
2. Confirmar.
3. Intentar login con nueva contraseña.

**Validación**: `POST /api/auth/recuperar/restablecer` retorna 200. Login posterior con nueva contraseña es exitoso.

---

## Escenario D: Token inválido o usado

1. Usar token expirado o ya usado.
2. Confirmar mensaje de error.

**Validación**: Endpoint retorna 400 con error claro.

---

## Escenario E: Privacidad

1. Solicitar restablecimiento con email existente y no existente.
2. Confirmar que respuesta y mensaje son idénticos.

**Validación**: No hay diferencia observable entre ambos casos.
