# SPEC-690 · Plan

## Enfoque
Medir antes de escribir dio el dato clave: `rol: PROFESIONAL` persiste en los 6 estados, así
que el gate de estado no existe en ninguna ruta operativa — no es «falta un chequeo», es «la
compuerta no existe». El arreglo se piensa desde el SUSPENDIDO (habilitado AHORA), no desde
el recién registrado.

Dos exigencias del CEO gobiernan el diseño:
1. **Derivada, no repetida:** una función de habilitación que las rutas consultan. El
   predicado ya existía como `puedeAparecerEnDirectorio` (ACTIVO + verificación vigente);
   se extrae `estaHabilitado` como la fuente y el directorio delega en ella.
2. **Imposibilidad estructural donde se pueda:** que la ruta operativa no pueda construirse
   sin pasar por la habilitación (690-B: `exigirProfesionalHabilitado` que trae el contexto
   y gatea en un solo paso).

## 690-A (este PR) — fuente única + contrato con Dev 2
1. `estaHabilitado(perfil, verif, ahora)` en `vigencia.ts`; `puedeAparecerEnDirectorio` delega.
2. `obtenerHabilitacionProfesional(usuarioId)` — computa `{estado, habilitado}` contra la base.
3. `/api/me` para PROFESIONAL agrega `profesional:{estado,habilitado}` — server-side, cada petición.
4. Candados: `estaHabilitado` (unit, incluye el caso SUSPENDIDO) + delegación directorio≡habilitado
   (fuente única no divergible) + contrato `/api/me` (integración: suspender con la misma sesión →
   habilitado:false en la llamada siguiente).
- Sin cambio de conducta visible; entra rápido para desbloquear a Dev 2 (SPEC-691).

## 690-B (sale de main cuando A entre — NO apilar sobre A)
1. `exigirProfesionalHabilitado(userId)` sobre `estaHabilitado`.
2. Compuerta en las rutas operativas: panel, franjas (GET/POST/DELETE), solicitudes
   (GET/confirmar/rechazar), `api/reportes/acceso/canjar` (cuando el actor es PROFESIONAL).
3. Barrido de páginas del profesional cuyo componente de servidor lea por el DAL directo
   (si la API cierra y la página lee por su lado, no se cerró nada).
4. Candado de conducta derivado del árbol, control positivo por remoción del discriminador.

## Fuera
- Pantalla (Diseño). · `upsert` del documento verificado → I-416.
