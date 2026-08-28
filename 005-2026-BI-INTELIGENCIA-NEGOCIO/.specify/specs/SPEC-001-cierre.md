# SPEC-001 · cierre

## Resultado
Scaffolding Next.js 16.2.10 · auth JWT jose · UI de PI copiado · 4 ratchets · CI bi.yml · verificación en vivo OK.

## Gate local (candado 14)
- `npm run typecheck` → sin errores
- `npm run test:unit` → 6/6 verdes (jwt 3 · motor 2 · health 1)
- `bash scripts/ratchets/run-all.sh` → 4/4 verdes
- `rm -rf .next && npm run build` → compiled successfully · 4 rutas (/, /_not-found, /api/health, /login)

## Verificación en vivo
```
curl /api/health  → HTTP 200 · {"status":"ok"}
curl /            → HTTP 200 (landing "BI en construcción")
curl /login       → HTTP 307 · Location: https://pi.innovadataco.com/login
```

## Simulación de daño ratchet 1 (evidencia)
```
$ echo "// prisma.user.findMany()" >> src/app/page.tsx
$ bash scripts/ratchets/cero-sql-raw.sh
src/app/page.tsx:16:// prisma.user.findMany()
❌ SQL raw fuera del motor · usa src/lib/bi/motor.ts
Exit: 1

$ # revertido
$ bash scripts/ratchets/cero-sql-raw.sh
✅ ratchet 1 OK
Exit: 0
```

## Decisiones aplicadas
- **D-01-BI · Font Inter+DM_Mono** — INSTRUCTIVO decía "Instrument Sans"; verificado en fuente PI usa Inter+DM_Mono; Fábrica confirmó Inter+DM_Mono.
- **D-02-BI · Sin worktree separado** — feature/bi-scaffolding ya checkeada en clone principal; git worktree add en misma rama da error fatal; sin paralelismo activo.
- **D-03-BI · ThemeProvider ampliado** — ThemeToggle de PI necesita `theme` + `toggleTheme` + `mounted`. ThemeProvider expone los tres.
- **D-04-BI · Test JWT en environment node** — jose 6 rechaza Uint8Array del polyfill TextEncoder de jsdom. `// @vitest-environment node` al inicio del archivo jwt.test.ts.

## Ajustes no previstos en spec
1. **ThemeProvider expandido** (D-03-BI arriba): tipo Theme cambió a `"light" | "dark"` (sin "system"); se añadieron `toggleTheme` y `mounted` para compatibilidad con ThemeToggle.tsx copiado de PI.
2. **jwt.test.ts environment node** (D-04-BI arriba).
3. **.gitignore añadido** (no estaba en el INSTRUCTIVO explícitamente pero es necesario para no commitear node_modules/.next/.env).

## Tests añadidos
- `tests/unit/jwt.test.ts` — 3 tests (secret correcto · secret incorrecto · JWT_SECRET ausente)
- `tests/unit/motor.test.ts` — 2 tests (stub sin fetch · stub con pregunta vacía)
- `tests/unit/health.test.ts` — 1 test (200 + body ok)

## Candados aplicados
- **Candado 1** · motor.ts es la única puerta al LLM; ratchet 3 lo enforza
- **Candado 11** · verifyToken lee JWT_SECRET compartido con PI; sin secret → null
- **Candado 14** · verificación en vivo con curl completada antes de REALIZADO
- **Candado 15** · versiones next/jose/react/font verificadas en fuente PI antes de escribir spec
