# Tasks — SPEC-597 · Quitar selector de cuenta del OAuth de Google

## Fase 1 — Cambio
- [x] T001 · Quitar `prompt: "select_account"` del `URLSearchParams` de
      `buildGoogleAuthUrl` (sin reemplazo; comportamiento por defecto de
      Google) — `src/lib/auth-oauth.ts`
- [x] T002 · Actualizar docstring de `buildGoogleAuthUrl` (SPEC-597, motivo) —
      `src/lib/auth-oauth.ts`

## Fase 2 — Test candado
- [x] T010 · Caso de la auth URL: afirmar `params.get("prompt") === null` y
      `not.toContain("select_account")`, conservando `client_id`,
      `redirect_uri`, `response_type`, `scope` y `state` —
      `src/lib/auth-oauth.test.ts`

## Fase 3 — Compuertas
- [x] T020 · `npx tsc --noEmit` verde
- [x] T021 · `npm run lint` verde
- [x] T022 · `npm run test` verde
- [x] T023 · `npm run build` verde

## Fase 4 — Artefactos y cierre
- [x] T030 · `spec.md` + `plan.md` + `tasks.md` en `specs/597-oauth-sin-selector/`
- [x] T031 · Índice `specs/README.md` actualizado
