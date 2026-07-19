# Requirements Checklist — Spec 039

## User Story 1 — Middleware perimetral real

- [x] Confirmado `src/proxy.ts` como entrypoint válido en Next.js 16.2.10 (export `proxy` + `config.matcher`). `src/middleware.ts` no se usa porque el build lo rechaza.
- [x] `src/proxy.ts` reutiliza lógica edge-safe de `src/lib/proxy.ts`.
- [x] `COMITE_VALIDACION` incluido en roles internos.
- [x] Rutas admin protegidas: sin sesión → redirect a `/login` (pages) o 401 (API).
- [x] Roles internos en rutas PARENT redirigidos a su área correspondiente.
- [x] Rutas públicas permiten tráfico anónimo.
- [x] `src/lib/proxy.ts` conservado como helper compartido.
- [x] `src/proxy.ts` conservado como entrypoint de convención Next.js 16.
- [x] `verifyAuth` sigue usándose en layouts y endpoints.
- [x] Prueba de los 5 roles realizada sin lockout.
- [x] Proxy verificado como ejecutado (respuesta 401/307 de `/api/admin/*` y `/dashboard/admin` sin sesión).

## General

- [x] Todos los artefactos Spec-Kit están creados.
- [x] `npm run lint` pasa sin errores.
- [x] `npx tsc --noEmit` pasa sin errores.
- [x] `npm run test` pasa.
- [x] `npm run build` compila exitosamente.
- [x] `./scripts/dev-restart.sh` levanta la app con un solo worker.
- [x] Se completó el `quickstart.md` manualmente.
- [x] Se generó `cierre.md` y se actualizó la sección Implementación en `spec.md`.
- [x] Se registró deuda técnica (ninguna nueva).
- [x] Se hicieron commits: uno por User Story + uno de docs.
- [x] Se hizo push a `feature/001-scaffolding`.
