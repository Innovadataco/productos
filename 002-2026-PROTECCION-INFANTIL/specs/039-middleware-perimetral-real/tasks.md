# Tasks — Spec 039: Middleware perimetral real

## Phase 1 — Análisis y preparación

- [P] T001 Verificar convención de middleware en Next.js 16.2.10 (usar `src/proxy.ts` con export `proxy`, no `src/middleware.ts`).
  - Archivos: `src/proxy.ts`, `src/lib/proxy.ts`.
- [P] T002 Revisar que `src/lib/proxy.ts` sea edge-safe (solo jose, NextResponse, Headers, Cookies).
  - Archivo: `src/lib/proxy.ts`.
- [P] T003 Definir matcher y matriz de roles finales.
  - Archivos: `specs/039-middleware-perimetral-real/spec.md`, `specs/039-middleware-perimetral-real/plan.md`.

## Phase 2 — US1: Middleware perimetral real

- T011 Confirmar que `src/proxy.ts` exporta `proxy` + `config.matcher`, reutilizando `src/lib/proxy.ts`.
  - Archivo: `src/proxy.ts`.
- T012 Incluir `COMITE_VALIDACION` en la matriz de roles internos y asegurar redirección a `/dashboard/admin/comite` desde rutas PARENT.
  - Archivo: `src/lib/proxy.ts`.
- T013 Probar los 5 roles (ADMIN, SCHOOL_ADMIN, OPERADOR, PARENT, COMITE_VALIDACION) con curl; confirmar que ninguno queda bloqueado.
  - Archivo: `specs/039-middleware-perimetral-real/quickstart.md`.
- T014 Validar que rutas públicas (incluyendo `POST /api/reportes` anónimo) no sean bloqueadas por el proxy.
  - Archivo: `src/lib/proxy.ts`.
- T015 Mantener `verifyAuth` en endpoints y layouts como defensa en profundidad (no modificar lógica, solo verificar que sigue ahí).
  - Archivos: `src/app/dashboard/admin/layout.tsx`, endpoints `/api/admin/**`.

## Phase 3 — Tests y validación

- [P] T021 Ejecutar pruebas manuales con curl para redirecciones de los 5 roles.
- [P] T022 Ejecutar `npm run lint`, `npx tsc --noEmit`, `npm run test`.
- [P] T023 Ejecutar `rm -rf .next && npm run build`.
- [P] T024 Ejecutar `./scripts/dev-restart.sh` y probar con `quickstart.md`.

## Phase 4 — Cierre

- T031 Actualizar `spec.md` con sección Implementación (notando el ajuste a `src/proxy.ts` por Next.js 16).
  - Archivo: `specs/039-middleware-perimetral-real/spec.md`.
- T032 Actualizar `research.md`, `plan.md`, `tasks.md` y `quickstart.md` para reflejar `src/proxy.ts`.
  - Archivos: `specs/039-middleware-perimetral-real/research.md`, `plan.md`, `tasks.md`, `quickstart.md`.
- T033 Crear `docs/cierre-039.md`.
  - Archivo: `docs/cierre-039.md`.
- T034 Validar checklist de requisitos.
  - Archivo: `specs/039-middleware-perimetral-real/checklists/requirements.md`.
- T035 Commits: uno por US + uno de docs; push a `feature/001-scaffolding`.
