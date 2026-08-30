# TASKS-030 · Endurecer resolución de BI_BASE_URL

## F1 · Helper `src/lib/bi/base-url.ts`
- [ ] `resolveBiBaseUrl(h)` con 3 niveles: x-forwarded-host+proto → BI_BASE_URL env → (prod: THROW / dev: localhost)
- [ ] Normalización: proto lista `a,b` toma el primero · sin trailing slash
- [ ] Mensaje de throw claro con prefijo `[SPEC-030]`

## F2 · `src/app/dashboard/layout.tsx`
- [ ] Reemplazar `process.env.BI_BASE_URL ?? "http://localhost:3001"` por `resolveBiBaseUrl(h)`
- [ ] Import del helper · conservar comentario D-029.6 · PI_BASE_URL sin cambios

## F3 · `src/app/api/auth/link/route.ts`
- [ ] Eliminar helper local `biBase` con fallback silencioso
- [ ] Resolver `const biBase = resolveBiBaseUrl(req.headers)` una vez en GET
- [ ] Pasar `biBase` como parámetro a `sanitizeReturnTo` y `errRedirect`
- [ ] `isProd()` (cookie secure) se mantiene

## F4 · Tests unitarios
- [ ] `tests/unit/bi-base-url.test.ts` (`@vitest-environment node`) · 8 tests: Nivel 1 gana · proto lista · env Nivel 2 · prod sin nada THROW · dev sin nada localhost · trailing slash normalizado · regresión no-localhost en prod con forwarded · regresión throw evita localhost
- [ ] `tests/unit/bi-auth-link-endpoint.test.ts` · +1 test (x-forwarded-host en request → redirect usa ese host)

## F5 · Gate local
- [ ] `rm -rf .next && npm run build` verde
- [ ] `npm run typecheck` verde
- [ ] `npx vitest run` verde
- [ ] Ratchets 4/5 verdes (mv-schema-check SKIP · pre-existente)
- [ ] curl `next start` con `NODE_ENV=production` + `X-Forwarded-Host/Proto` → redirect usa host público, NO localhost
- [ ] curl `NODE_ENV=production` sin env ni forwarded → 500 (no redirect a localhost)

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
