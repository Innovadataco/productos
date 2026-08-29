# Research: SPEC-127 — Home del padre

**Date**: 2026-07-29 | **Spec**: [spec.md](spec.md)

## Defecto (verificado en fuente por ZEUS, auditoría 002-PI-042, I-40)

- `homeForRole` (`src/lib/proxy.ts:169-173`) tiene casos para COMITE_VALIDACION y
  SCHOOL_ADMIN; PARENT no existe como caso → cae al `return "/dashboard/admin"`.
- `esDestinoPermitidoPorRol` (`proxy.ts:121-123`): para PARENT, toda ruta
  `/dashboard/admin` → `false`. La puerta (`proxyCore`, `proxy.ts:224-232`) lo redirige a `/`.
- Cadena rota: PARENT → ruta admin-only → `redirectToHome` → `/dashboard/admin` → puerta
  niega → `/`. Doble rebote; el "home" del padre no es su home.
- Confirmado en la línea base generada: `docs/architecture/03-pantallas.md` (tabla
  home-por-rol sin fila PARENT; `/dashboard` alcanzable solo por PARENT).
- **No es fuga**: la puerta niega correctamente el área interna. Es redirección/UX rota.

## Decisión

**Caso explícito `PARENT → /dashboard` en `homeForRole`** (D-42: "NADA MÁS").

## Alternativas consideradas

| Alternativa | Veredicto | Motivo |
|---|---|---|
| Caso explícito PARENT en `homeForRole` | **Elegida** | Es exactamente la D-42; mínima; no altera veredictos de la puerta |
| Cambiar el default a `/dashboard` | Descartada | Rompería ADMIN/OPERADOR (roles internos: `/dashboard` les está negada) |
| Redirigir PARENT a `/` | Descartada | Es el aterrizaje roto actual (resultado del rebote, no un home) |
| Permitir `/dashboard/admin` a PARENT | Descartada | Fuga de seguridad; contradice `esDestinoPermitidoPorRol` y la Aserción A |

## Riesgos y mitigaciones

- **`proxy.ts` es archivo peligroso (D-36)** → suite completa + `tsc --noEmit` + `build` +
  test de regresión del camino PARENT, todo previsto en el plan.
- **Drift de la línea base**: la tabla home-por-rol de `03-pantallas.md` queda vieja → se
  regenera en el mismo commit; `arch:check` (CI) lo haría fallar en caso contrario.
- **Aserción A**: compara permitir/bloquear, no destinos de redirect → no debería moverse.
  Si se mueve, es hallazgo real: se reporta y se para (patrón SPEC-126).
