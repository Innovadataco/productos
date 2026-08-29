# Cierre SPEC-206 — Infra · Session Log (002-PI-120)

## Estado

- **Rama:** `work/002-pi-120`
- **Base:** `feature/001-scaffolding` (`aed748d3`)
- **Status:** IMPLEMENTADO
- **PR:** por abrir tras gate verde

## Alcance entregado

Infraestructura de instrumentación de sesiones activas, bloqueante para el score de valor del BRIEF-ANALISIS-DINERO-VS-VALOR.

### Componentes entregados

| Componente | Archivo | Nota |
|---|---|---|
| Modelo + migración | `prisma/schema.prisma`, `prisma/migrations/20260822000000_spec_206_sesion_log/migration.sql` | `SesionLog`, `MotivoCierreSesion`, índices, relación con `Usuario` |
| Seed params | `prisma/seed.ts` | 4 params `sesion.*` con `update: {}` (respeta custom) |
| Permiso módulo | `src/lib/permisos-catalogo.ts` | `sesiones_admin` bajo `estadisticas` |
| Servicio DAL | `src/lib/dal/services/session-log.ts` | CRUD + cierre por inactividad + forzar cierre + purga |
| Helpers IP | `src/lib/session-log/ip-hash.ts` | Reusa `calcularIpHash` de anti-abuso |
| Auth | `src/lib/auth.ts` | `verifyAuth` rechaza JWT si `sesionLogId` cerrado |
| Login | `src/app/api/auth/login/route.ts` | Crea `SesionLog` e incluye `sesionLogId` en JWT |
| Ping | `src/app/api/session/ping/route.ts` | Actualiza `ultimaActividadEn` |
| Admin listado | `src/app/api/admin/sesiones/route.ts` | Paginado, solo activas |
| Admin cierre | `src/app/api/admin/sesiones/[id]/cerrar/route.ts` | Forzar cierre + `AuditLog` |
| Rate limit | `src/lib/rate-limit.ts` | Scope `session_ping` |
| Cliente ping | `src/hooks/useSessionPing.ts` + `src/components/providers/SessionPingProvider.tsx` | Solo cuando pestaña visible |
| Layout | `src/app/dashboard/layout.tsx` | Monta provider |
| Vista admin | `src/app/dashboard/admin/estadisticas/operacion/components/SesionesTab.tsx` | Tabla + forzar cierre |
| Sub-nav | `src/app/dashboard/admin/estadisticas/components/EstadisticasSubNav.tsx` | Tab "Sesiones" |
| Tablero | `src/app/dashboard/admin/estadisticas/operacion/OperacionTableroClient.tsx` | Renderiza `SesionesTab` |
| Worker | `scripts/worker-sesiones.mjs` | pg-boss, advisory lock distinto al de reportes |
| Package | `package.json` | Script `worker:sesiones` |

### Tests entregados

- `src/app/api/auth/login/route.test.ts` — login crea `SesionLog` y JWT incluye `sesionLogId`.
- `src/app/api/session/ping/route.test.ts` — ping actualiza actividad; sesión cerrada devuelve 401.
- `src/app/api/admin/sesiones/route.test.ts` — listado paginado de activas; operador sin módulo 403.
- `src/app/api/admin/sesiones/[id]/cerrar/route.test.ts` — forzar cierre + 404 en sesión inexistente/cerrada.
- `src/lib/dal/services/session-log.test.ts` — registro, ping, cierre por inactividad, forzado, activa, purga.

### Artefactos de arquitectura

Regenerados y alineados:
- `docs/architecture/01-modelo-datos.md`
- `docs/architecture/02-roles-capacidades.md`
- `docs/architecture/06-stack.md`

## Gate local

- [x] `npx tsc --noEmit` — VERDE
- [x] `npm run lint -- --no-cache` — VERDE (0 errores, warnings preexistentes)
- [x] `npm run arch:check` — VERDE
- [x] `npm run test` — 1501 passed / 2 failed preexistentes (ver Hallazgo)
- [x] `npm run build` — VERDE

## Hallazgo preexistente (no bloqueante para SPEC-206)

`src/lib/dal/repositories/alerta-colegio-tablero.test.ts` falla 2 tests de `reloj24h`:
- `hora Bogotá: un reporte a las 02:00 UTC pica en la hora 21; ceros rellenos (SC-002)`
- `A/B tenant: la actividad de B no se cuela al reloj de A; colegio vacío → 24 ceros`

Verificado con `git stash` en `work/002-pi-120`: el test falla igual contra `origin/feature/001-scaffolding` limpio. No es causado por SPEC-206. Archivo no tocado en este PR.

## Ajuste necesario fuera del alcance estricto

`src/lib/deploy-seed-idempotencia.test.ts` (SPEC-190) recibió timeout de 30 s en el `describe`. Al añadir parámetros `sesion.*` al seed, el tiempo de `main()` en CI superó el timeout default de 5 s. Localmente el test pasa en ~2.5 s; en CI fue cancelado a los 5 s. El cambio es aditivo y no altera la lógica del test.

## Migración

Aplicada aditivamente en BD de test con:

```bash
node --env-file=.env.test ./node_modules/.bin/prisma migrate deploy
```

En producción se aplicará vía `npm run db:migrate` en deploy.

## Configuración de entorno

Ninguna variable nueva obligatoria. Reutiliza:
- `DATABASE_URL`
- `JWT_SECRET`
- `ANTI_ABUSO_SALT` (para hash de IP)
- `WORKER_SECRET` no se usa en este worker (usa advisory lock de PostgreSQL)

## Deuda técnica / notas

- Worker separado con advisory lock distinto al de reportes; permite coexistir.
- Tokens sin `sesionLogId` siguen funcionando (retrocompatibilidad); al próximo login adquieren el campo.
- `prisma/seed.ts` usa `update: {}` para los params `sesion.*` para no pisar ajustes manuales del CEO.

## Commit propuesto

```text
feat(SPEC-206 / 002-PI-120): infraestructura Session Log

- Modelo SesionLog + migración aditiva + seed params
- Auth: verifyAuth rechaza JWT con sesión cerrada; login crea sesión
- Endpoints: ping, admin listado, admin forzar cierre
- Cliente: useSessionPing con Page Visibility API
- Worker: cierre por inactividad con advisory lock separado
- Vista admin: sub-tab Sesiones en estadísticas/operacion
- Tests de integración + DAL
- Regenera artefactos de arquitectura
```
