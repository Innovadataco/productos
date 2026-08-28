# SPEC-001 · Scaffolding Next.js + Auth JWT compartido

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 001 |
| **Nombre** | scaffolding-nextjs-auth |
| **Origen** | BI · INSTRUCTIVO-001 · F3C 2026-08-28 COT |
| **Brief** | BI · A-01 (setup infra BI Fase 1) |
| **Estado** | ✅ CUMPLE · desplegado en `23c5100e` · auditado por Fábrica |
| **Reescrita por** | bi-dev-2 en SPEC-005 (post-mortem · código intacto) |

---

## Objetivo

Crear el proyecto Next.js base del BI con autenticación JWT compartida con PI, estructura `src/` mínima, sistema de diseño copiado de PI, 4 ratchets grep-based, CI workflow `bi.yml`, y verificación en vivo (candado 14).

---

## Stack verificado en fuente (candado 15)

| Paquete | Versión | Verificado contra |
|---|---|---|
| `next` | 16.2.10 | PI `package.json` |
| `jose` | ^6.0.10 | PI `package.json` |
| `react` / `react-dom` | 19.2.4 | PI `package.json` |
| `typescript` | ^5.8.3 | PI `package.json` |
| `tailwindcss` | ^3.4.17 | PI `package.json` |
| `vitest` | ^3.2.3 | PI `package.json` |
| Fonts | Inter + DM_Mono | PI `layout.tsx` (candado 15 · ver research.md) |

---

## Estructura entregada

```
src/
  app/
    api/health/route.ts    ← GET → {"status":"ok"}
    globals.css
    layout.tsx             ← Inter + DM_Mono · ThemeProvider
    login/page.tsx         ← redirect a PI login
    page.tsx               ← landing "BI en construcción"
  components/ui/           ← 11 componentes copiados de PI
    Badge · Button · EmptyState · ErrorState · GlassCard
    Input · Modal · Select · Slider · ThemeToggle · Tooltip
    ThemeProvider.tsx
  lib/
    auth/jwt.ts            ← verifyToken con jose · candado 11
    bi/motor.ts            ← stub · "Motor BI no disponible aún · Fase 2" · candado 1
    test-setup.ts
scripts/ratchets/
  cero-secretos.sh
  cero-sql-raw.sh
  imports-llm-solo-motor.sh
  no-additional-properties-true.sh
  run-all.sh
scripts/
  verificar-indices-post-migrate.mjs
tests/unit/
  health.test.ts  ← 1 test
  jwt.test.ts     ← 3 tests
  motor.test.ts   ← 2 tests
productos/.github/workflows/bi.yml   ← 4 jobs (raíz monorepo · I-34 PI)
```

---

## Candados aplicados

| Candado | Aplicación |
|---|---|
| 1 · Enum cerrado / solo via motor.ts | `motor.ts` es la única puerta al LLM; ratchet 3 enforza |
| 11 · Guard tenancy / JWT | `verifyToken` lee `JWT_SECRET` compartido con PI; sin secret → null |
| 14 · Verificación en vivo | `/api/health` 200 · `/` 200 · `/login` 307 → PI antes de REALIZADO |
| 15 · Verificar en fuente | Versiones next/jose/react/font verificadas en fuente PI antes de escribir spec |

---

## Fuera de alcance de esta SPEC

- Motor NL-to-SQL real (Vanna + Ollama) → SPEC-003
- Docker Compose BI → SPEC-002
- Superset, Vanna, Bot Telegram → SPEC-003/004
- Cloudflare Tunnel → SPEC-004

---

## Criterios de aceptación verificados

- [x] `npm run typecheck` → EXIT: 0
- [x] `npm run test:unit` → 6/6 tests verdes
- [x] `bash scripts/ratchets/run-all.sh` → 4/4 verdes
- [x] `rm -rf .next && npm run build` → compiled successfully · 4 rutas
- [x] `/api/health` → HTTP 200 · `{"status":"ok"}`
- [x] `/` → HTTP 200
- [x] `/login` → HTTP 307 → `https://pi.innovadataco.com/login`
- [x] CI `bi.yml` en raíz monorepo con 4 jobs

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 (reescrita post-mortem en SPEC-005) |
| **F3C original** | 2026-08-28 COT (commit `23c5100e`) |
| **F3C reescritura** | 2026-08-28 madrugada COT (SPEC-005 · bi-dev-2) |
| **Autor original** | bi-dev-2 (Desarrollo BI) |
| **Autor reescritura** | bi-dev-2 (Desarrollo BI) |
