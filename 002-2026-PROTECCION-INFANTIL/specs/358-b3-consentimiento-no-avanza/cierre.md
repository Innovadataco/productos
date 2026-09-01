# SPEC-358 · Cierre — B3: la puerta de entrada abre

**Fecha**: 01-09-2026 · **Dev**: PI-2 · **Rama**: `work/pi-SPEC-358-b3-consentimiento`

## Qué estaba roto, de verdad

La traza que llegó ("401 en /api/me tras aceptar") apuntaba a la sesión. **No era
eso**: por API el flujo completo responde 200 / 201 / 200. El bloqueo estaba
antes del clic — **el botón "Acepto" nunca se habilitaba**.

Verificado en el navegador, con el documento scrolleado al 100 % (3079 de 3079),
las dos casillas marcadas y el centinela completamente dentro del área visible:
el `IntersectionObserver` del gate no reportó intersección. Creé a mano otro
observer con el mismo `root` y `threshold` para descartar que fuera el
componente: tampoco disparó. El gate tenía una sola llave y esa llave falla.

**Por qué la suite estaba verde:** el test del componente mockeaba el
`IntersectionObserver` y siempre lo hacía disparar — probaba el mock, no el gate.

## El arreglo

`marcarSiLlegoAlFinal()` mide directamente `scrollTop + clientHeight` contra
`scrollHeight` (margen de 24 px por subpíxeles y zoom), y corre en tres momentos:
al montar, en cada `onScroll` del contenedor y al cambiar el tamaño de la
ventana. El `IntersectionObserver` se conserva como refuerzo: si dispara, mejor;
ya no es la única llave.

Dos resguardos para no debilitar el candado en el intento de abrirlo:

- **documento que no desborda** (corto, o pantalla muy alta) → no hay nada que
  bajar, se considera leído: si no, sería el mismo encierro por otra puerta;
- **medición vacía** (`clientHeight === 0`: contenedor aún sin pintar u oculto)
  → **no se concluye nada**. Sin esto, el candado se abriría solo antes de que el
  navegador midiera. Este agujero apareció al correr los tests (dos casos que
  exigen el botón deshabilitado se pusieron rojos) y se cerró ahí mismo.

## Evidencia en vivo (dev, recorrido completo del padre)

1. Entrar a `/consentimiento`: botón **deshabilitado** (candado puesto).
2. Marcar las dos casillas, subir el scroll al final → botón **habilitado**
   (`disabled: false`, `scrollTop 21141` de `21165`).
3. Clic en "Acepto" → `POST /api/consentimiento/aceptar` **201**, `/api/me`
   **200**, y la pantalla avanza a `/dashboard/padre`.

## Tests

Bloque nuevo con un **observer mudo** (el escenario de Jelkin): llegar al final
habilita · documento que no desborda no traba · scroll casi al final (a 10 px)
también cuenta. Los 11 casos previos del componente siguen pasando sin tocarse.

## Gate

`tsc` limpio · lint 0 errores · unit **1928/1928** · `next build` verde ·
`arch:check` VERDE.
