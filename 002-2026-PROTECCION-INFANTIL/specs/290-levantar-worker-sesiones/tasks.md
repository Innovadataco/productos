# Tasks — SPEC-290 · Levantar `worker-sesiones` como servicio

## Estado: IMPLEMENTADO

| # | Tarea | Estado |
|---|-------|--------|
| 1 | `docker-compose.prod.yml` · nuevo servicio `pi-sesiones` con healthcheck de edad (< 90 s) | ✅ Hecho |
| 2 | `docker-compose.yml` (dev) · mismo bloque con `build` en vez de `image` | ✅ Hecho |
| 3 | `scripts/worker-sesiones-heartbeat.mjs` · helper puro `touchAliveFile()` + constantes | ✅ Hecho |
| 4 | `scripts/worker-sesiones.mjs` · heartbeat inicial + `setInterval(30 s)` + touch al final del tick + guard `import.meta.url === argv[1]` para poder importarlo en tests | ✅ Hecho |
| 5 | `scripts/worker-sesiones.test.mjs` · 3 tests unit (escribe, no lanza en EROFS, HEARTBEAT_INTERVAL_MS < 90 s) | ✅ Hecho |
| 6 | `src/components/modules/config-panel/types.ts` · nueva sección `sesiones` con `prefixes: ["sesion."]` | ✅ Hecho |
| 7 | `src/components/modules/config-panel/types.test.ts` · grep ratchet §4.3 (sección existe + los 4 params caen ahí) | ✅ Hecho |
| 8 | `scripts/ADVISORY-LOCKS.md` · fila 8 (ID `123456797`) → `pi-sesiones` (sin latente) | ✅ Hecho |
| 9 | `vitest.unit.includes.ts` · registro de los 2 tests nuevos | ✅ Hecho |
| 10 | `specs/README.md` · entrada SPEC-290 | ✅ Hecho |

## Desviación consciente del brief §2

El brief pide `AuditLog` con `accion="CONFIG_SESIONES_ACTUALIZADA"`. Se reutiliza `PARAM_UPDATE` (ya emitido por `ConfiguracionService.actualizar`, SPEC-053) porque agregar un enum a `AccionAudit` requiere migración Prisma, prohibida por candado del INSTRUCTIVO-190. El AuditLog registra igual valor viejo/nuevo/usuario/timestamp — la única diferencia es la etiqueta.

## Ajuste al plan

- El plan original hablaba de touch **al final del tick**. Como el tick corre cada 5 min y el healthcheck exige < 90 s, se añadió un **heartbeat independiente cada 30 s** (`setInterval`) además del touch en el handler. Justificación en el bloque de comentario del worker.
- Para poder testear el helper sin arrastrar Prisma/pg-boss se extrajo a módulo puro `worker-sesiones-heartbeat.mjs`. El worker lo importa; el test también. Cero cambio de lógica del worker.
