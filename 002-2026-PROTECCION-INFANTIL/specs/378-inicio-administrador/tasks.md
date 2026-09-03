# SPEC-378 · Tasks

- [X] T001 Diagnóstico 15v5: leer INVENTARIO-SENALES-OPERACION.md, monitor, HealthProbe, pantallas admin
- [X] T002 Reportar diagnóstico + plan al CEO ANTES de codificar
- [X] T003 Añadir `inicio_admin` a `CATALOGO_MODULOS` (orden 5, admin)
- [X] T004 `src/lib/dal/services/inicio-admin.ts` — agregador con 7 sondas + reuso HealthProbe
- [X] T005 `GET /api/admin/inicio/senales/route.ts` — verifyAuth ADMIN + assertModulo + no-store
- [X] T006 `/dashboard/admin/inicio/page.tsx` — server component + tarjetas ámbar
- [X] T007 Redirect en `/dashboard/admin/page.tsx` cuando el admin tiene el módulo
- [X] T008 Añadir "Inicio" primero en `ADMIN_NAV_ITEMS`
- [X] T009 Sembrar 6 umbrales idempotentes en `prisma/seed.ts` con `update:{}`
- [X] T010 Test integration del endpoint (8 casos)
- [X] T011 Test unit de la página (4 casos, cero rojo, ámbar, sin módulo → SinAcceso)
- [X] T012 Registrar el test unit en `vitest.unit.includes.ts`
- [X] T013 Gate: tsc, lint 0 errores, unit + integration verdes
- [ ] T014 [Post-merge] verificación viva del CEO: entrar a `/dashboard/admin` como admin, ver el Inicio y disparar una alerta real (crear un huérfano de 25 h en prod-staging o un correo FALLIDA con `quota` en el ultimoError).
