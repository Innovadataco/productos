# SPEC-001 · plan.md

## Plan ejecutado (post-mortem · código en `23c5100e`)

### Paso 1 · package.json + tsconfig + postcss + tailwind + vitest + next.config

Configurar el proyecto Next.js desde cero. Verificar versiones contra PI (candado 15).

```json
// package.json scripts clave:
"dev": "next dev -p 3001",
"typecheck": "tsc --noEmit",
"lint": "eslint .",
"test:unit": "node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run tests/unit",
"ratchets:check": "bash scripts/ratchets/run-all.sh"
```

### Paso 2 · globals.css copiado de PI

CSS base de PI copiado sin modificaciones. Tailwind configurado.

### Paso 3 · api/health + login + jwt.ts

- `GET /api/health` → `{"status":"ok"}` (candado 14: verificación en vivo)
- `GET /login` → redirect 307 a `https://pi.innovadataco.com/login`
- `src/lib/auth/jwt.ts`: `verifyToken(token)` usando `jose.jwtVerify` + `JWT_SECRET` env

### Paso 4 · motor.ts stub

```typescript
// src/lib/bi/motor.ts
export async function preguntarVanna(_pregunta: string): Promise<string> {
    return "Motor BI no disponible aún · Fase 2";
}
```

Stub intencionado: SPEC-003 implementa el motor real. Ratchet 3 enforza que ningún código importe LLM fuera de este archivo.

### Paso 5 · layout.tsx + page.tsx + ThemeProvider

`ThemeProvider` ampliado respecto al de PI: expone `theme` + `toggleTheme` + `mounted` porque `ThemeToggle.tsx` necesita los tres (D-03-BI).

### Paso 6 · UI copiado de PI (11 componentes)

Badge · Button · EmptyState · ErrorState · GlassCard · Input · Modal · Select · Slider · ThemeToggle · Tooltip. Copia directa sin modificaciones.

### Paso 7 · Tests unitarios (jwt · motor · health) — 6/6 verdes

- `jwt.test.ts`: 3 tests (secret correcto · secret incorrecto · JWT_SECRET ausente). `@vitest-environment node` necesario porque jose 6 rechaza el polyfill TextEncoder de jsdom (D-04-BI).
- `motor.test.ts`: 2 tests (stub sin fetch · stub con pregunta vacía).
- `health.test.ts`: 1 test (200 + body ok).

### Paso 8 · 4 ratchets + run-all + verificar-indices

| Ratchet | Qué enforza |
|---|---|
| `cero-sql-raw.sh` | SQL raw fuera de `motor.ts` → exit 1 |
| `cero-secretos.sh` | Secretos hardcodeados → exit 1 |
| `imports-llm-solo-motor.sh` | Imports LLM solo desde `motor.ts` |
| `no-additional-properties-true.sh` | `additionalProperties: true` prohibido en schemas |

### Paso 9 · .env.bi.example + .env.test

- `.env.bi.example`: plantilla con placeholders (`JWT_SECRET=REEMPLAZAR_...`)
- `.env.test`: variables de test (JWT_SECRET, PI_BASE_URL, PORT)

### Paso 10 · bi.yml (4 jobs · raíz del monorepo)

`productos/.github/workflows/bi.yml` con jobs: verify (ratchets) → typecheck → test-unit → build. En raíz del monorepo porque el CI corre sobre el repo `productos` completo (aprendizaje I-34 de PI).

### Paso 11 · Simulación daño ratchet 1

```bash
$ echo "// prisma.user.findMany()" >> src/app/page.tsx
$ bash scripts/ratchets/cero-sql-raw.sh
# → exit 1 · error detectado
$ # revertido
```

### Paso 12 · Gate local completo

`typecheck` OK · `tests 6/6` · `build OK` · `ratchets 4/4`.

### Paso 13 · Verificación en vivo (candado 14)

```
curl /api/health  → HTTP 200 · {"status":"ok"}
curl /            → HTTP 200 (landing "BI en construcción")
curl /login       → HTTP 307 · Location: https://pi.innovadataco.com/login
```

### Paso 14 · cierre.md + tasks.md + .gitignore

Documentación completada. `.gitignore` creado (no estaba en el INSTRUCTIVO explícitamente pero es obligatorio para no commitear `node_modules/.next/.env`).

### Paso 15 · Push único a origin feature/bi-scaffolding

3 commits (no 1 único): en la práctica la regla "push único" se interpretó como "no hacer push hasta tener el gate completo". Commiteado y pusheado en `23c5100e`.

---

## Decisiones técnicas tomadas

| ID | Decisión | Razón |
|---|---|---|
| D-01-BI | Fonts: Inter + DM_Mono | INSTRUCTIVO decía "Instrument Sans"; verificado en fuente PI (`layout.tsx`) → usa Inter+DM_Mono. Fábrica confirmó. Candado 15. |
| D-02-BI | Sin worktree separado | `feature/bi-scaffolding` ya checkeada en clone principal. `git worktree add` en la misma rama da error fatal. Sin paralelismo activo en este SPEC. |
| D-03-BI | ThemeProvider con `theme` + `toggleTheme` + `mounted` | `ThemeToggle.tsx` de PI necesita los 3. ThemeProvider expandido para ser compatible. |
| D-04-BI | `@vitest-environment node` en jwt.test.ts | `jose` 6 rechaza `Uint8Array` del polyfill `TextEncoder` de jsdom. Sin esta directiva los tests de JWT fallan. |

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 (reescrita post-mortem en SPEC-005) |
| **F3C** | 2026-08-28 madrugada COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
