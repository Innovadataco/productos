# SPEC-711 · Plan

## Impacto en arquitectura
- **`exigirPadre()`** en `src/lib/padre/guardia-padre.ts`: `verifyAuth()` + si `rol !== PARENT` → `redirect(homeParaRol(rol))`. Devuelve el usuario. Patrón del profesional (redirect a su área, no 403).
- **15 `page.tsx`** de `/dashboard/padre/**` la llaman. Las de token-a-mano (`expedientes`, `expedientes/[id]`, `identificador/[nick]`) se simplifican; `circulo-confianza` (re-export) se envuelve; los stubs de redirect gatean antes de redirigir.
- **Candado** `compuerta-rol-padre.candado.test.ts`: derivado del árbol (cada page.tsx llama `exigirPadre()`) + conducta (PARENT pasa; otro rol → homeParaRol). Mutación-verificado.

## Orden
1. `exigirPadre`. 2. Aplicar a las 15 páginas. 3. Candado + mutación. 4. Barrido colegio/admin (report). 5. Preflight + PR.

## Verificación
- tsc · lint · candado padre (mutación: quitar redirect → rojo) · SPEC-571 (admin/colegio) sin regresión · arch:check (puerta≡predicado) · specs-discipline.
- Recorrido: Calidad entra con una cuenta no-PARENT a `/dashboard/padre/*` y cae en su área.
