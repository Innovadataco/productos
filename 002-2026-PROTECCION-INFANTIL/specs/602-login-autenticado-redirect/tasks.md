# Tasks — SPEC-602

- [x] **T001** · `src/lib/routing/guardias.ts` — agregar `GUARDIAS_ACCESO.pantallasAuth` (`/login`, `/registro`, `/registro/inicio`, matching exacto) con nota documentando por qué no es `sesion` ni `matcheaRuta`.
- [x] **T002** · `src/lib/routing/guardias.ts` — helper `esPantallaAuth(pathname)` (igualdad exacta).
- [x] **T003** · `middleware.ts` — Paso 1: sustituir la terna hardcodeada por `esPantallaAuth(pathname)`; conservar excepción `mensaje=sesion` y `homeParaRol`; actualizar comentario (SPEC-588 · SPEC-602).
- [x] **T004** · `src/lib/routing/guardias.test.ts` — unitarios de `esPantallaAuth` (exacto, crear-clave/recuperar/puertas fuera, subrutas de /login fuera).
- [x] **T005** · `src/lib/routing/middleware-auth-screens.candado.test.ts` — casos SPEC-602: 3 roles parametrizados en /login → 307 a su home; /registro con JWT → 307; /registro-colegio y /registro-profesional con sesión → next.
- [x] **T006** · Artefactos Spec-Kit (spec.md, plan.md, tasks.md) + README de specs regenerado.
- [x] **T007** · Gate completo: tsc, lint, test, build, arch:check.
