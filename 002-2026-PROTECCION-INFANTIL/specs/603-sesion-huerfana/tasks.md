# Tasks · SPEC-603 · Sesión huérfana

## Fase 1 · Fix

- [x] T001 `src/lib/auth.ts` — agregar `getSessionUser()` (sesión huérfana ⇒ null).
- [x] T002 `src/app/reportar/layout.tsx` — resolver sesión con `getSessionUser()`; anónimo si huérfana.
- [x] T003 `src/app/api/me/route.ts` — expirar cookies de sesión en respuestas 401.

## Fase 2 · Tests (BD real)

- [x] T004 `src/lib/auth-sesion-huerfana.test.ts` — getSessionUser (activo/eliminado/inactivo/sin cookie/token inválido) + verifyAuth huérfano ⇒ 401.
- [x] T005 [P] `src/app/reportar/layout.sesion-huerfana.test.ts` — JWT huérfano ⇒ 200 sin crash ni auditoría; SPEC-242 intacto.
- [x] T006 [P] `src/app/api/me/route.test.ts` — huérfano ⇒ 401 + cookies expiradas; activo ⇒ 200; sin cookie ⇒ 401.

## Fase 3 · Artefactos y gate

- [x] T007 `specs/603-sesion-huerfana/{spec,plan,tasks}.md` + línea en `specs/README.md` (regenerado con `scripts/specs/generar-readme.ts`).
- [x] T008 Gate: `npx tsc --noEmit` · `npm run lint` · `npm run test` · `npm run build`.
- [x] T009 Commit (español, imperativo, staging explícito) + push + PR `SPEC-603: ...` (sin merge).
