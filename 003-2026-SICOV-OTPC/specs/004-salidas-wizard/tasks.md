# Tasks — 004-salidas-wizard

> Ordenadas por dependencia. `[P]` = paralelizable. **MODO PLAN:** ejecutar **solo tras aprobación humana**. Guardarraíl: stub, cero APIs reales. **Reuso, no duplicación.**

## Fase 0 — Tipos y constructor de payload
- [ ] T001 `src/lib/despachos/despacho-tipos.ts`: DTOs `RegistroDespachoIntegracion`, `ObjDespachoIntegracion`, `ObjVehiculoIntegracion`, `ObjConductoresIntegracion`, `ObjRutasIntegracion` (del modelo real).
- [ ] T002 `src/lib/despachos/payload.ts`: `buildObjDespacho`, `buildObjVehiculo(form, integradora)`, `buildObjConductores(form, integradora)`, `buildObjRutas`, `buildRegistroDespacho` (portado de `salidas-payload.util`; helpers `str`/`num`; normaliza a string; `limpiarPlaca`). + test (form + RespuestaIntegradora → payload correcto, valores string, pólizas/tarjeta/mantenimientos desde integradora).

## Fase 1 — Maestras (read-through, stub)
- [ ] T010 `src/lib/integracion/cliente.ts`: agregar `consultarRutasActivas(nit, identificacion, idRol)` y `consultarAutorizaciones(nit, placa, fecha, identificacion, idRol)` a la interfaz.
- [ ] T011 `cliente-stub.ts`: implementar maestras simuladas (rutas 1–2, autorizaciones []), sin red. + test.
- [ ] T012 `cliente-http.ts`: implementar maestras reales (`GET {URL_MATENIMIENTOS}/maestras/...`, auth TOKEN/paramétrica); solo modo real, **no ejercitado**.
- [ ] T013 `GET /api/integracion/maestras/rutas-activas-empresa/route.ts` y `.../autorizaciones/route.ts`: `verifyAuth([1,2,3])`, NIT efectivo, devuelven listas. + tests.

## Fase 2 — Wizard (US1)
- [ ] T020 `src/app/dashboard/salidas/nueva/page.tsx` (o `wizard.tsx`): página con **secciones colapsables** gateadas por la integradora.
- [ ] T021 Sección cabecera (`obj_despacho`): validaciones fecha≤hoy / hora≤ahora (Bogota), valorTiquete dígitos.
- [ ] T022 Sección integradora: reusa `POST /api/integracion/integradora/resumen` (003); al responder, habilita/autocompleta.
- [ ] T023 Secciones conductores + vehículo: autocompletado desde `RespuestaIntegradora`.
- [ ] T024 Sección rutas + autorizaciones: cargan maestras; arman `obj_rutas` / `array_autorizaciones`.
- [ ] T025 Botón "Registrar despacho": habilitado si integradora+vehículo+conductores+ruta OK; `buildRegistroDespacho` → **UN POST** a `/api/integracion/despachos`. + manejo de respuesta (solicitudId).

## Fase 3 — Listado (US2)
- [ ] T030 `src/app/dashboard/salidas/page.tsx`: listado (reusa `GET /api/integracion/despachos`), estado, botón "Reintentar" (reusa `POST /api/despachos/[id]/reintentar`), botón "Registrar salida" → wizard.

## Fase 4 — Verificación y cierre
- [ ] T040 `tsc`/`lint`/`vitest` (stub)/`build`.
- [ ] T041 Smoke en vivo (modo stub): recorrer wizard (cabecera → integradora → subforms → registrar) → 202; worker procesa; listado muestra el despacho. Verificar **un solo POST** y cero APIs reales.
- [ ] T042 `cierre.md` + Implementación en `spec.md`.
- [ ] T043 Commits `feat(003-US1)`/`feat(003-US2)`/`docs(003)` con rutas explícitas `003-`; `git pull --rebase` (autostash) + push.

## Operación
- Smoke: **matar dev/worker solo por PID/puerto del 003 (5010)**; nunca `pkill`/`killall` amplio (AGENTS.md §6).

## Bloqueado (verificación humana)
- [ ] TX01 Activar maestras reales (`ClienteHttp`) y el reporte real — solo tras aprobación + credenciales rotadas.
- [ ] TX02 `/speckit.clarify`: contrato de maestras (rutas/autorizaciones + auth), catálogos (clase, nivelServicio, tipoIdentificacion, via).
