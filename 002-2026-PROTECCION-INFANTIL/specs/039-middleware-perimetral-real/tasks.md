# Tasks — Spec 039: Middleware perimetral real

## Phase 1 — Análisis y preparación

- [P] T001 Verificar que `src/middleware.ts` no existe y que los exports de `src/proxy.ts`/`src/lib/proxy.ts` no se ejecutan como middleware.
  - Archivos: `src/proxy.ts`, `src/lib/proxy.ts`, `src/app/dashboard/admin/layout.tsx`.
- [P] T002 Revisar que `src/lib/proxy.ts` sea edge-safe (solo jose, NextResponse, Headers, Cookies).
  - Archivo: `src/lib/proxy.ts`.
- [P] T003 Definir matcher y matriz de roles finales.
  - Archivos: `specs/039-middleware-perimetral-real/spec.md`, `specs/039-middleware-perimetral-real/plan.md`.

## Phase 2 — US1: Middleware perimetral real

- T011 Crear `src/middleware.ts` con export `middleware` + `config.matcher`, reutilizando/refactorizando `src/lib/proxy.ts`.
  - Archivo: `src/middleware.ts` (nuevo).
- T012 Incluir `COMITE_VALIDACION` en la matriz de roles internos y asegurar redirección a `/dashboard/admin/comite` desde rutas PARENT.
  - Archivo: `src/middleware.ts`.
- T013 Probar los 5 roles (ADMIN, SCHOOL_ADMIN, OPERADOR, PARENT, COMITE_VALIDACION) con curl o tests E2E; confirmar que ninguno queda bloqueado.
  - Archivo: `specs/039-middleware-perimetral-real/quickstart.md`.
- T014 Recién tras validar los 5 roles, eliminar `src/proxy.ts` y ajustar imports residuales si los hay.
  - Archivo: `src/proxy.ts`.
- T015 Mantener `verifyAuth` en endpoints y layouts como defensa en profundidad (no modificar lógica, solo verificar que sigue ahí).
  - Archivos: `src/app/dashboard/admin/layout.tsx`, endpoints `/api/admin/**`.

## Phase 3 — Tests y validación

- [P] T021 Escribir tests para redirecciones del middleware o ejecutar pruebas manuales con curl.
  - Archivos: `src/middleware.test.ts` (nuevo) o `quickstart.md`.
- [P] T022 Ejecutar `npm run lint`, `npx tsc --noEmit`, `npm run test`.
- [P] T023 Ejecutar `rm -rf .next && npm run build`.
- [P] T024 Ejecutar `./scripts/dev-restart.sh` y probar con `quickstart.md`.

## Phase 4 — Cierre

- T031 Actualizar `spec.md` con sección Implementación.
  - Archivo: `specs/039-middleware-perimetral-real/spec.md`.
- T032 Crear `docs/cierre-039.md`.
  - Archivo: `docs/cierre-039.md`.
- T033 Validar checklist de requisitos.
  - Archivo: `specs/039-middleware-perimetral-real/checklists/requirements.md`.
- T034 Commits: uno por US + uno de docs; push a `feature/001-scaffolding`.
