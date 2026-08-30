# TASKS-030 · Endurecer resolución de BI_BASE_URL

## F1 · Helper `src/lib/bi/base-url.ts`
- [x] `resolveBiBaseUrl(h)` con 3 niveles: x-forwarded-host (+proto default https) → BI_BASE_URL env → (prod: THROW / dev: localhost)
- [x] Normalización: proto lista `a,b` toma el primero · sin trailing slash
- [x] Mensaje de throw claro con prefijo `[SPEC-030]`
- [x] D-030.6 adoptado: Nivel 1 entra con solo `x-forwarded-host`, proto default `https` (observación de Fábrica en REVISO)
- [x] D-030.8 (hallazgo Fábrica post-REVISO): en prod, `x-forwarded-host` local (localhost/127.0.0.1/0.0.0.0/::1) NO se retorna → cae al Nivel 2. `esHostLocal()` compara solo hostname sin puerto. Cierra el hueco donde el fallback localhost se había mudado del Nivel 3 al Nivel 1

## F2 · `src/app/dashboard/layout.tsx`
- [x] Reemplazar `process.env.BI_BASE_URL ?? "http://localhost:3001"` por `resolveBiBaseUrl(h)`
- [x] Import del helper · conservar comentario D-029.6 · PI_BASE_URL sin cambios

## F3 · `src/app/api/auth/link/route.ts`
- [x] Eliminar helper local `biBase` con fallback silencioso
- [x] Resolver `const biBase = resolveBiBaseUrl(req.headers)` una vez en GET
- [x] Pasar `biBase` como parámetro a `sanitizeReturnTo` y `errRedirect` (incluye el redirect final)
- [x] `isProd()` (cookie secure) se mantiene

## F4 · Tests unitarios
- [x] `tests/unit/bi-base-url.test.ts` (`@vitest-environment node` · vi.stubEnv) · 12 tests verdes (incluye 3 de D-030.8: prod+localhost→env · prod+127.0.0.1 sin env→throw · dev+localhost→OK)
- [x] `tests/unit/bi-auth-link-endpoint.test.ts` · +1 test (x-forwarded-host en request → redirect usa host público) · 10 tests verdes

## F5 · Gate local (2026-08-29 23:3x COT)
- [x] `rm -rf .next && npm run build` verde
- [x] `npm run typecheck` verde
- [x] `npx vitest run` · **166 passed · 15 skipped · 0 failed**
- [x] Ratchets 4/5 verdes (mv-schema-check SKIP · pre-existente)
- [x] curl `next start` `NODE_ENV=production` + `X-Forwarded-Host: bi.innovadataco.com` → `returnTo=https%3A%2F%2Fbi.innovadataco.com%2Fdashboard`, NO localhost ✓
- [x] curl endpoint `/api/auth/link` sin token + `X-Forwarded-Host` → `login-error` usa `https://bi.innovadataco.com` ✓
- [x] **Nota honesta:** el path THROW (Nivel 3) NO se puede reproducir con `next start` porque Next.js 15 SIEMPRE inyecta `x-forwarded-host` (= host del socket local, ej. `localhost:3011`) — consistente con D-029.6. Por eso el request "sin forwarded" local igual resuelve por Nivel 1. En prod real Cloudflare pone el host público. El path THROW se verifica con el UNIT TEST (header source vacío → throw), que es la fuente autoritativa de esa rama.

## F6 · Push
- [ ] `git add` archivos listados en plan.md F6
- [ ] `git commit -m "fix(bi): SPEC-030 endurece resolución de BI_BASE_URL · sin fallback silencioso a localhost"`
- [ ] `git push origin work/bi-SPEC-030-endurecer-base-url`

## Cierre
- [ ] Señal: `desarrollo-bi-2: BI-SPEC-030 · REALIZADO · <hash> · gh pr checks OK`

## Reglas duras
- [ ] `sesionDeRequest` y `jwt.ts` NO se tocan (candado 22)
- [ ] Contrato del JWT y lógica del puente NO cambian (solo resolución de URL base)
- [ ] `.env.bi.production` del VPS NO se toca (es de Jelkin)
- [ ] En producción NUNCA se devuelve localhost en silencio
