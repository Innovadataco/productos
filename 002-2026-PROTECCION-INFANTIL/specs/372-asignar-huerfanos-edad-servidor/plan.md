# Plan · SPEC-372 · asignar huérfanos + edad servidor

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## Decisiones

**P3 reusa `reconciliarHuerfanos`, no la reimplementa.** El cron y el botón
disparan la misma función; la ruta es una capa fina de auth + rate-limit. Así
no hay dos comportamientos que puedan divergir, y el audit sigue siendo uno.

**P3 sigue el patrón de `reasignar`.** `verifyAuth("ADMIN")` +
`assertModulo("operadores")` + `checkRateLimit("admin_write")` +
`errorToResponse`. Mismo estilo que las otras rutas de `admin/operadores/*`:
un admin que ya sabe usar reasignar no tiene que aprender un patrón nuevo.

**P3 UI: botón `primary` junto a "Actualizar", no en un modal.** Un botón,
tres números en un aviso, la tabla que se actualiza sola. El admin ya está en
la pantalla que muestra la cola; abrir un modal para mostrarle tres números
sería teatro.

**P4 no duplica la constante.** El schema del servidor importa
`EDAD_MENOR_MIN`, `EDAD_MENOR_MAX`, `edadDesdeAnio` y `validarEdadMenor` desde
`documento-menor.ts` — el módulo puro que ya usa la UI. Si Jelkin cambia el
rango algún día (permitir 4 años, por decir), se cambia en un archivo.

**P4 usa `refine`, no `min/max` de Zod.** Con `min/max` la ventana se
congelaría el año en curso; con `refine` que llama a `validarEdadMenor` la
ventana se mueve sola cuando pasa el año. El mensaje sale de la propia función,
así el error dice "entre 5 y 17" sin repetir números a mano.

## Archivos

- `src/app/api/admin/operadores/reconciliacion/route.ts` — endpoint nuevo (POST).
- `src/app/api/admin/operadores/reconciliacion/route.test.ts` — 5 tests.
- `src/app/api/padre/hijos/route.ts` — schema (dos ediciones: imports y refine).
- `src/app/api/padre/hijos/route.test.ts` — 3 tests nuevos de I-262.
- `src/app/dashboard/admin/operadores/asignar/page.tsx` — estado + botón + aviso.
- `src/app/dashboard/admin/operadores/asignar/page.test.tsx` — 3 tests.
- `vitest.unit.includes.ts` — registro del `page.test.tsx` nuevo.
