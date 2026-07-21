# Tasks — 003-integradora-consulta

> Ordenadas por dependencia. `[P]` = paralelizable. **MODO PLAN:** ejecutar **solo tras aprobación humana**. Guardarraíl: ninguna tarea consume APIs productivas (stub). No hay worker ni migraciones.

## Fase 0 — Tipos y cliente
- [ ] T001 `src/lib/integracion/integradora-tipos.ts`: DTOs `SolicitudIntegradora` + `RespuestaIntegradora` (Conductor, Persona, Licencia, Alcoholimetria, ExamenMedico, AptitudFisica, Vehiculo, Poliza(s), TarjetaOperacion, Empresa, Mantenimiento) — del modelo real del frontend.
- [ ] T002 `src/lib/integracion/cliente.ts`: agregar `consultarIntegradora(body): Promise<RespuestaIntegradora>` a la interfaz `ClienteSupertransporte`.
- [ ] T003 `src/lib/integracion/cliente-stub.ts`: implementar `consultarIntegradora` — devuelve `RespuestaIntegradora` simulada (documentos VIGENTES, placa/identificación consultadas, conductor2 solo si `numeroIdentificacion2`). NUNCA toca red. + test.
- [ ] T004 `src/lib/integracion/cliente-http.ts`: implementar `consultarIntegradora` — `POST {URL_INTEGRADORA}/api-integradora/resumen` con **solo** `Authorization: Bearer <getTokenProveedor()>`, timeout 100 s, normaliza `obj ?? raíz`. Solo instanciable en modo real. **No se ejercita contra la Super.**

## Fase 1 — Endpoint (US1)
- [ ] T010 `src/app/api/integracion/integradora/resumen/route.ts` (POST): `verifyAuth([1,2,3])`; `limpiarPlaca`; validar `placa`/`numeroIdentificacion1` (400); exigir `horaConsulta` si `fechaConsulta`≠hoy(Bogota); `nit` efectivo; `cliente.consultarIntegradora`; normalizar; responder `RespuestaIntegradora`. Manejo de 502/504. + test.

## Fase 2 — Pantalla (US1)
- [ ] T020 `src/app/dashboard/integradora/page.tsx`: formulario (placa + numeroIdentificacion1 [+2] + fecha [+hora]) → POST → render del resumen: conductor(es) (licencia/alcoholimetría/examen/aptitud con estado+fecha), vehículo (SOAT/RTM), pólizas, tarjeta de operación; resaltar vencidos; nota "consulta informativa en vivo".
- [ ] T021 [P] Enlace desde el menú/dashboard a `/dashboard/integradora`.

## Fase 3 — Verificación y cierre
- [ ] T030 `tsc --noEmit`, `lint`, `vitest run` (solo stub) verdes; `next build`.
- [ ] T031 Smoke en vivo (modo stub): POST resumen con placa+identificación+fecha → `RespuestaIntegradora`; verificar **solo Bearer** (sin `token`/`documento`); segundo conductor con `numeroIdentificacion2`; validación 400. **Sin APIs reales.**
- [ ] T032 `cierre.md` + sección Implementación en `spec.md`.
- [ ] T033 Commit `feat(003-US1)` + `docs(003)` con rutas explícitas `003-`; `git pull --rebase` (autostash) + push.

## Operación
- Al parar dev en pruebas: **matar solo por PID/puerto del 003 (5010)**; nunca `pkill`/`killall` amplio (AGENTS.md §6). Esta feature no levanta worker.

## Bloqueado (requiere verificación humana)
- [ ] TX01 Activar `ClienteHttp.consultarIntegradora` real y probar contra la Super — solo tras aprobación + credenciales rotadas; validar si la Super exige 1 o 3 cabeceras en ese endpoint.
- [ ] TX02 `/speckit.clarify`: payload exacto de request y envoltorio de respuesta reales.
