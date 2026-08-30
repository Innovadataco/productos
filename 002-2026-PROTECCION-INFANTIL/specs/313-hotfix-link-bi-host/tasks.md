# Tasks: Hotfix — link-bi redirect usa host público real

## Phase 1: Setup
- [X] T001 Agregar `PI_BASE_URL="https://pi.innovadataco.com"` a `.env.example` con comentario SPEC-313

## Phase 2: User Story 1 (P1) — redirect a /login usa host público
- [X] T002 [US1] Modificar `route.ts`: reemplazar `new URL(..., request.url)` por helper con prioridad x-forwarded-host → PI_BASE_URL → hardcode
- [X] T003 [P] [US1] `route.test.ts`: caso con `x-forwarded-host` → Location usa ese host
- [X] T004 [P] [US1] `route.test.ts`: caso sin header, con `PI_BASE_URL` env → Location usa esa env
- [X] T005 [P] [US1] `route.test.ts`: caso sin header ni env → Location usa fallback hardcode
- [X] T006 [P] [US1] `route.test.ts`: assert defensivo — ningún caso existente ni nuevo genera Location con `0.0.0.0`

## Phase 3: Polish
- [X] T007 `npx tsc --noEmit` limpio
- [X] T008 `npm run lint -- <archivos>` + grep `error` explícito
- [X] T009 `npm run arch:check` verde
- [X] T010 Confirmar por diff cero cambios fuera de scope (auth.ts, login/logout, prisma, .github/workflows, segundo redirect a BI)
