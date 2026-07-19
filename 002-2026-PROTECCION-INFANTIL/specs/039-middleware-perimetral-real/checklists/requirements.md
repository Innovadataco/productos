# Requirements Checklist — Spec 039

## User Story 1 — Middleware perimetral real

- [ ] Creado `src/middleware.ts` con export `middleware` y `config.matcher`.
- [ ] `src/middleware.ts` reutiliza lógica edge-safe de `src/lib/proxy.ts`.
- [ ] `COMITE_VALIDACION` incluido en roles internos.
- [ ] Rutas admin protegidas: sin sesión → redirect a `/login` (pages) o 401 (API).
- [ ] Roles internos en rutas PARENT redirigidos a su área correspondiente.
- [ ] Rutas públicas permiten tráfico anónimo.
- [ ] `src/proxy.ts` eliminado tras validar los 5 roles.
- [ ] `src/lib/proxy.ts` conservado como helper compartido.
- [ ] `verifyAuth` sigue usándose en layouts y endpoints.
- [ ] Prueba de los 5 roles realizada sin lockout.
- [ ] Middleware verificable como ejecutado (header temporal o log) antes de quitar.

## General

- [ ] Todos los artefactos Spec-Kit están creados.
- [ ] `npm run lint` pasa sin errores.
- [ ] `npx tsc --noEmit` pasa sin errores.
- [ ] `npm run test` pasa.
- [ ] `npm run build` compila exitosamente.
- [ ] `./scripts/dev-restart.sh` levanta la app con un solo worker.
- [ ] Se completó el `quickstart.md` manualmente.
- [ ] Se generó `cierre.md` y se actualizó la sección Implementación en `spec.md`.
- [ ] Se registró deuda técnica si aplica.
- [ ] Se hicieron commits: uno por User Story + uno de docs.
- [ ] Se hizo push a `feature/001-scaffolding`.
