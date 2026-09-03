# SPEC-402 · Tasks

## Estado: CERRADO — PR abierto

- [x] Reverificar contra `origin/main` que `/api/webhooks/resend` sigue sin listar (candado 15 v3 del CEO).
- [x] Worktree fresco `.worktrees/pi-SPEC-402` desde `origin/main d832ec3db` + `npm install`.
- [x] `guardias.ts` — agregar `"/api/webhooks/resend"` a `publicas` con comentario que apunta al modelo HMAC-Svix.
- [x] `middleware.test.ts` — 3 casos candado: POST sin JWT, GET sin JWT, POST con firma Svix inválida.
- [x] `spec.md`, `plan.md`, `tasks.md` + fila en `specs/README.md`.
- [x] `npm run test:unit -- src/lib/routing/middleware.test.ts` verde (75/75).
- [x] `tsc --noEmit` verde.
- [x] `eslint` verde en archivos tocados.
- [ ] Commit + push + PR.
- [ ] Post-deploy: `curl` de verificación + inspeccionar eventos entrantes del proveedor para probar/descartar hipótesis I-283.
