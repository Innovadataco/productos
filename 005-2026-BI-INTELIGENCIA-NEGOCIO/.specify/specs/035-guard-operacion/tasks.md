# TASKS-035 · Guard de sesión en `/operacion`

## F1 · Helper compartido
- [ ] `src/lib/auth/guard-bi-sesion.ts` · `exigirSesionBi(rutaBi)` · headers→Request sintético→sesionDeRequest→redirect si null (candado 22 · SOLO LECTURA)

## F2 · `operacion/layout.tsx`
- [ ] Nuevo · `await exigirSesionBi("/operacion")` · `return <>{children}</>` SIN BiAppShell (full-page standalone · diseño NO cambia)

## F3 · `dashboard/layout.tsx` (refactor)
- [ ] Usa `exigirSesionBi("/dashboard")` · comportamiento idéntico (returnTo=/dashboard · BiAppShell)

## F4 · Tests
- [ ] `bi-operacion-guard.test.tsx` · /operacion sin sesión→redirect · con sesión→children · helper con/sin sesión
- [ ] **REGRESIÓN genérica (ajuste Fábrica):** para cada layout top-level protegido (dashboard, operacion) sin sesión → EXISTE redirect (no 200). Sin atar al destino/returnTo/host

## F5 · Gate local
- [ ] `rm -rf .next && npm run build` verde
- [ ] `npm run typecheck` verde
- [ ] `npx vitest run` verde
- [ ] Ratchets 4/5 verdes

## F6 · Evidencia §6 (candado 25 · seguridad · sin las 4 NO hay CUMPLE)
- [ ] 1. `curl -w "%{http_code}"` /operacion SIN cookie → 307 (no 200)
- [ ] 2. `curl` /operacion SIN cookie `| grep -E "Fábrica|Calidad|Jelkin"` → vacío
- [ ] 3. CON cookie válida → tablero sin regresión (captura)
- [ ] 4. `curl -sI` SIN cookie → Location con `returnTo=...%2Foperacion`

## F7 · Push + PR
- [ ] commit + push + `gh pr create --base main`
- [ ] Señal: `desarrollo-bi-2: BI-SPEC-035 · REALIZADO · <hash> · gh pr checks OK + evidencia §6`

## Reglas duras
- [ ] Diseño del tablero NO cambia (sin sidebar/shell)
- [ ] returnTo=/operacion
- [ ] No tocar lo congelado
- [ ] Sin las 4 evidencias → no CUMPLE
