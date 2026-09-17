# SPEC-698 · Tasks

## Candado antes del fix
- [ ] T1 · Candado de conducta (integración) — hoy ROJO con el código actual:
  - `restablecerPassword`: un `bloqueado` con token válido queda `bloqueado` (no `activo`); un `inactivo` con token queda `inactivo`.
  - `solicitarRecuperacion`: un `inactivo` no crea fila en `tokenRecuperacion`; control positivo: un `activo` sí.

## Fix
- [ ] T2 · `restablecerPassword`: quitar `estado: "activo"` del update (nunca cambia estado).
- [ ] T3 · `solicitarRecuperacion`: si `estado === "inactivo"`, devolver `tipo` ≠ `"ok"` sin crear token (respuesta genérica constante — sin enumeración).
- [ ] T4 · Corregir `restablecer/route.test.ts:42` (hoy fija «reset → activo»): afirmar preservación del estado.

## Cierre
- [ ] T5 · Candado verde + mutación (reponer el discriminador → rojo). Preflight tsc + lint.
- [ ] T6 · PR SPEC-698. Reportar verde al CEO. Calidad camina el recorrido.

## Fuera
- Política de lockout de `bloqueado` (no se toca). · Reactivación de `inactivo` (carril admin).
