# Tasks — 002-llegadas-doble-token

> Ordenadas por dependencia. `[P]` = paralelizable. **MODO PLAN:** estas tareas se ejecutan **solo tras aprobación humana**. Guardarraíl: ninguna consume APIs productivas (stub).

## Fase 0 — Datos
- [ ] T001 `prisma/schema.prisma`: agregar `model LlegadaSolicitud` (14 columnas base + 4 de cola; `@map` a `lle_sol_*`; índices `lle_sol_estado_intento_idx` y `nitVigilado`). (data-model.md)
- [ ] T002 Migración aditiva `add_llegadas_cola` (`prisma migrate dev`). Verificar que crea la tabla con todas las columnas; **nunca** reset.
- [ ] T003 `prisma/seed.ts`: agregar 2-3 llegadas demo (pendiente/procesado/fallido) para el vigilado.

## Fase 1 — Librería
- [ ] T010 [P] `src/lib/normalizar.ts`: agregar `extraerIdLlegadaExterno` (candidatos `obj.obj.id|obj.id|obj.idLlegada|data.idLlegada|data.id|idLlegada|id`) + test en `normalizar.test.ts`.
- [ ] T011 `src/lib/llegadas/cola.ts`: `enviarLlegada`, `procesarLoteLlegadas`, `reintentarLlegada` — reusa `getClienteSupertransporte`, `construirCabeceras`, backoff 5min/máx 3, POST a `{URL_DESPACHOS}/llegadasempresas`. + test (stub, prisma mockeado o BD test).

## Fase 2 — US1 Registro + reporte (P1)
- [ ] T020 `POST /api/integracion/llegadas`: `verifyAuth([1,2,3])`, resolver contexto (herencia rol 3), validar `placa`/`tipoLlegada`, insertar `pendiente`. + test.
- [ ] T021 `scripts/worker-despachos.mjs` → `worker.mjs`: segunda pasada `procesarLoteLlegadas()` bajo el mismo advisory lock; actualizar script `worker` en `package.json`.
- [ ] T022 `POST /api/llegadas/[id]/reintentar`: resetea `reintentos=0`, re-encola. + test.

## Fase 3 — US2 Listado + KPI (P2)
- [ ] T030 `GET /api/integracion/llegadas`: paginado server-side, filtro por NIT efectivo (rol 1 ve todo). + test.
- [ ] T031 `src/app/api/dashboard/route.ts`: agregar `llegadasHoy` (`fecha_creacion >= inicioDiaBogota()`). + test.
- [ ] T032 [P] UI mínima de llegadas (opcional en P2): listado + botón Reintentar funcional.

## Fase 4 — Verificación y cierre
- [ ] T040 `tsc --noEmit`, `lint`, `vitest run` (solo stub) verdes; `next build`.
- [ ] T041 Smoke en vivo (modo stub): registrar llegada rol 2 y rol 3 → worker → `procesado`; reintento; KPI. **Sin APIs reales.**
- [ ] T042 `cierre.md` + sección Implementación en `spec.md` + deuda técnica.
- [ ] T043 Commits `feat(003-US1)`/`feat(003-US2)`/`docs(003)` con rutas explícitas de `003-`; `git pull --rebase` (o push fast-forward) y push.

## Operación (recordatorio)
- Al parar dev/worker en pruebas: **matar solo por PID o puerto del 003 (5010/5434)**; nunca `pkill`/`killall` por patrón amplio (regla en `AGENTS.md §6`).

## Bloqueado (requiere verificación humana)
- [ ] TX01 Activar `ClienteHttp` real para llegadas y probar contra la Super — solo tras aprobación + credenciales rotadas.
- [ ] TX02 `/speckit.clarify`: payload de `llegadasempresas`, catálogo `tipoLlegada`.
