# Cierre: Endurecimiento de Seguridad (Spec 046)

**Spec**: `specs/046-endurecimiento-seguridad/spec.md`  
**Feature Branch**: `feature/001-scaffolding`  
**Fecha de cierre**: 2026-07-20  
**Status final**: `CERRADA`

---

## Resumen

Se implementó el endurecimiento de seguridad previo a SPEC-050/SPEC-060: inventario de PII, CSP endurecida, tope de `pageSize`, saneamiento de errores y un test e2e de anonimización. Se corrigió posteriormente la CSP/HSTS para no romper el acceso por HTTP: los headers `upgrade-insecure-requests` y `Strict-Transport-Security` ahora se gobiernan con `ENABLE_HTTPS_HEADERS` (default `false`). La rotación de `PARAM_ENCRYPTION_KEY` queda documentada como plan-only (US6).

## Commits

```
27392b1 feat(046): US5 - saneamiento de mensajes de error crudos
4d6dfd3 feat(046): US4 - tope máximo de pageSize en endpoints paginados
7e2c68b test(046): US3 - test e2e de anonimización de PII
7fd5c2f feat(046): US2 - endurecer CSP sin unsafe-eval en producción
0047d08 feat(046): US1 - inventario y minimización de PII
```

## Archivos tocados

- `docs/pii-inventory.md`
- `next.config.ts`
- `playwright.config.ts`
- `src/lib/proxy.ts`
- `src/lib/errors.ts`
- `src/lib/pagination.ts`
- `src/app/api/admin/dataset-entrenamiento/route.ts`
- `src/app/api/config/parametros/route.ts`
- `src/app/api/reportes/mis-reportes/route.ts`
- Rutas saneadas con `safeErrorMessage()`: `admin/comite/integrantes`, `admin/ia/*`, `admin/operadores`, `admin/reportes-revision`, `auth/recuperar/solicitar`, `auth/verificar/solicitar`, `circulo-confianza`, `health/worker`.
- `tests/e2e/anonimizacion.spec.ts`
- `specs/046-endurecimiento-seguridad/` (spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md, checklists/requirements.md, cierre.md)
- `docs/ARCHITECTURE.md`
- `.env.example`

## Resultados de validación

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | OK |
| `npm run lint` | OK (1 warning preexistente en `GestionPageClient.tsx`) |
| `npm run test` | 479 tests pasan |
| `npm run test:e2e -- tests/e2e/anonimizacion.spec.ts` | 3/3 pasan |
| `npm run test:e2e` (completo) | 21/26 pasan; 5 fallos preexistentes en tests de otros specs (consulta, dashboard-publico, reportes, admin-panel) |
| `./scripts/dev-restart.sh` | Build OK, healthcheck OK (`workerAlive: true`, `dbOk: true`) |
| CSP en producción (curl `localhost:5005/`) | `script-src 'self' 'unsafe-inline'` (sin `unsafe-eval`) |

## Notas

- La CSP se dejó en `next.config.ts` (no en middleware) porque Next.js 16/Turbopack no inyecta automáticamente nonces en los scripts generados, lo que rompía la funcionalidad client-side y los tests e2e.
- Se condicionó `unsafe-eval`: ausente en producción, presente en `next dev` para HMR de Turbopack.
- Se ajustó `playwright.config.ts` para que el `webServer` reciba `DATABASE_URL` y comparta la BD de prueba con el código de los tests.

## Deuda técnica / follow-up

- 5 tests e2e de otros specs fallan por expectativas desactualizadas o contaminación de datos; no están dentro del alcance de Spec 046.
- La rotación de `PARAM_ENCRYPTION_KEY` (US6) es un ítem de pre-producción registrado en `docs/PRE-PRODUCCION.md`; se implementará en una fase posterior.
- Corrección post-cierre: `upgrade-insecure-requests` y HSTS se gobiernan mediante `ENABLE_HTTPS_HEADERS` (default `false`) para evitar bloqueos en entornos sin TLS (Mac, Tailscale, LAN).
