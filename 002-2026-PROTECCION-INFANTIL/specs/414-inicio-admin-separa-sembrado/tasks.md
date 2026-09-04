# Tareas · SPEC-414 — El Inicio del admin separa lo sembrado de lo real

- [x] T001 Tipos: `OpcionesInicio`, `ConteoSembrados`, `SenalDegradada`; `EstadoInicio` gana `degradadas`, `incluyeSembrados` y `sembrados`.
- [x] T002 I-294 (a): la consulta usa el nombre físico `demo_marcado`, declarado una sola vez en `TABLA_MARCADO`.
- [x] T003 CARGA: `senalReportesHuerfanos`, `senalRevisionManual`, `senalVigenciasPorVencer` y `senalComiteVencido` traen `total` y `reales` en una consulta y respetan el interruptor.
- [x] T004 SALUD: `correos`, `proveedor`, `racha IA`, `jurado` e `infra` quedan intactas — cuentan todo.
- [x] T005 I-294 (b): cada tarea con nombre; el rechazo va a `logger.error` y sale en `degradadas`.
- [x] T006 El total de sembrados cuenta filas distintas (`contarSembradosDeCarga`), no la suma de descuentos.
- [x] T007 Pantalla: interruptor siempre visible con el conteo al lado, `?prueba=1`, y bloque de señales degradadas. Cero rojo (regla de Jelkin).
- [x] T008 Endpoint `GET /api/admin/inicio/senales?prueba=1`.
- [x] T009 Candados estáticos `inicio-admin.marcado.test.ts` (12) + en `vitest.unit.includes.ts`.
- [x] T010 Tests de pantalla: 5 del interruptor + 3 de degradadas (12 en total en el archivo).
- [x] T011 Integración contra BD real: 6 casos nuevos, 19 verdes en el archivo.
- [x] T012 **Prueba negativa de I-294**: reintroducir el nombre viejo y verificar que las 4 señales de CARGA aparecen en `degradadas` en vez de desaparecer.
- [x] T012-bis (adenda CEO 18:2x) Excluir de las dos colas de reportes los que pertenecen a una simulación: el simulador crea `Reporte` reales por otra puerta y no pasan por `demo_marcado`. Verificado en fuente antes de tocar. Cuenta en el total sin duplicar; SALUD no los excluye. Probado contra BD y con reproducción negativa.
- [x] T013 Gate (`tsc`, `lint`, unit) + fila en `specs/README.md` + PR.

## Fuera de esta spec, anotado

- Barrido de `Promise.allSettled` y `catch {}` vacíos en el resto de `src/` — encargo del CEO para después de cerrar 414.
