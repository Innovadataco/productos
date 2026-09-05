# SPEC-481 · Profesional sin perfil: redirect a completar (no 500) — bug en prod

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: bug REAL en prod que pegó Jelkin entrando como profesional. Pre-existente (no del rediseño), prioridad alta.

## El bug

`homeParaRol` manda al rol `PROFESIONAL` a `/dashboard/profesional`. Ese Server Component llama a `panelDelProfesional(usuario.id)`, que en `panel.service.ts:130` hace `throw new AppError("Perfil profesional no encontrado", NOT_FOUND, 404)` cuando el usuario **no tiene `PerfilProfesional`**. En un Server Component, esa excepción sin capturar sale como **500**. Verificado en BD prod: `+psico@` (profesional sin perfil) → 500; `+psico1@` (con perfil) → OK. Un profesional que se registra y aún no completó el onboarding cae en 500 en su propia home.

## El fix (acotado a `page.tsx`, sin tocar el service)

`src/app/dashboard/profesional/page.tsx`: se envuelve la llamada al service en try/catch. Si el error es `AppError` con `code === NOT_FOUND`, se hace `redirect("/perfil-profesional/completar")` (el mismo destino del onboarding). Cualquier otro error se re-lanza (no se enmascara). **El contrato de `panelDelProfesional` no cambia** — otros caminos que lo usan siguen viendo el NOT_FOUND (candado 15 v5: redirect acotado a la page).

## Candado (conducta, sin BD)

`src/app/dashboard/profesional/profesional-sin-perfil.candado.test.tsx` (unit): mockea `verifyAuth`, `panelDelProfesional` y `next/navigation.redirect`. Tres casos:
1. Sin perfil (NOT_FOUND) → `redirect("/perfil-profesional/completar")` (307 en runtime), no 500.
2. Con perfil → renderiza el panel, sin redirigir.
3. Otro error (INTERNAL_ERROR) → se propaga, NO redirige (no enmascara fallos reales).
**Verificado por mutación**: quitar el catch/redirect de `page.tsx` → el caso 1 falla (propaga NOT_FOUND, no llama redirect).

## Impacto en arquitectura: no

Un guard de borde en un Server Component. No toca schema, API, service ni `tokens-check.ts`. `/perfil-profesional/completar` ya existe (onboarding).

## Cómo se probó

- Preflight D-106 + suite unit (incluye el candado, 3 tests) + mutación.
- Al verde, el CEO mergea y despliega (prioridad alta).
