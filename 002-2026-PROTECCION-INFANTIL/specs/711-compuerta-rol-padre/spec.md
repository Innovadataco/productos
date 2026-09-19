# SPEC-711 · Un profesional entra a las pantallas del padre — compuerta por rol

**Status**: DESARROLLO

**Origen:** Jelkin probando (17-09 22:35): con su cuenta de PROFESIONAL abrió `/dashboard/padre/profesionales` y vio el cascarón del padre. **Carril:** Dev 1 · Calidad.

## Lo medido

De las 15 `page.tsx` bajo `/dashboard/padre/**`, la mayoría no comprobaba el rol: 5 usaban `verifyAuth("PARENT")` (que tira 403, un ERROR), 1 `verifyAuth()` + redirect a `/`, 3 leían el token a mano (`verifyToken`, redirect a `/login`), y el resto no gateaba. **No es fuga** ([[dev-barrido-guardia-pagina-shell-no-es-fuga]]): las APIs exigen PARENT y el cascarón no trae datos. Pero un rol paseándose por el área de otro erosiona la separación que el producto promete.

## El arreglo

- **`exigirPadre()`** (`src/lib/padre/guardia-padre.ts`): autentica y, si el rol no es PARENT, redirige a SU área (`homeParaRol`), **no** a un 403 — el patrón de la compuerta del profesional (SPEC-691/690-B). El no autenticado lo maneja `verifyAuth` (401 → login).
- **Las 15 páginas** del padre llaman a `exigirPadre()`. Las que leían el token a mano se simplificaron a la compuerta; la re-exportación de `circulo-confianza` se envuelve.
- **Candado derivado del árbol** (`compuerta-rol-padre.candado.test.ts`): toda `page.tsx` bajo `/dashboard/padre/**` LLAMA a `exigirPadre()`; una página nueva sin ella lo pone rojo. + conducta: PARENT pasa, otro rol redirige a su home (mutación: quitar el redirect → rojo).

## El barrido de colegio/admin (lo pidió el CEO)

`/dashboard/admin/**` y `/dashboard/colegio/**` **NO tienen el hueco del padre**: ya los cubre `guardia-rol-pagina.candado.test.ts` (SPEC-571 · I-353), un candado absoluto por página (verifyAuth(rol) / módulo / verifyToken+gate+redirect / stub). El área del padre era la ÚNICA superficie del dashboard sin candado propio (el profesional tiene el suyo, SPEC-691); SPEC-711 la cierra con el mismo patrón. No hay nada que arreglar en colegio/admin.

## Impacto

**Impacto en arquitectura:** una compuerta por rol a nivel de página para el área del padre (`exigirPadre`), consistente con la del profesional (SPEC-691) y con la de admin/colegio (SPEC-571). Sin esquema, sin ruta nueva, sin cambio de datos ni de copy (el padre habla de «tú», §1.9 — no se toca). Defensa en profundidad: cierra el cascarón; los datos ya estaban protegidos por las APIs.

## Fuera

- Endurecer roles de las APIs (ya exigen PARENT). · La forma/copy del padre (no se toca).
