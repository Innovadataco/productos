# Implementation Plan: SPEC-186 — Smoke inteligente del monitor Ollama

**Branch**: `work/002-pi-081` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

---

## Summary

Rediseñar el probe `ollama_smoke` a 3 niveles (ping siempre → piggyback en tráfico real → smoke real raro) para que Ollama solo sea molestado cuando no hay otra señal de vida. Incluye: posible columna aditiva `metodo` en `HealthProbe`; nuevo método en `MonitoreoRepository` para leer la última clasificación exitosa; ajuste de `probeOllamaSmoke` en `src/lib/monitoreo/probes.ts`; nuevo endpoint `/api/admin/monitoreo/historial`; ampliación de la tarjeta "Cerebro IA" en el tablero operativo; y resiembra de parámetros en `prisma/seed.ts`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10, Prisma 5.22.0 |
| **Storage** | PostgreSQL 16 — posible migración ADITIVA (columna `metodo` en `HealthProbe`) o cero migración (campo en `detalle`) |
| **Testing** | Vitest integration para probes/repositorio/endpoint; unit para componente de historial |
| **Proceso** | `scripts/monitor-probes.mjs` separado, se reusa el loop existente |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| IA local | ✅ Pass | El smoke real sigue golpeando Ollama local/tailnet; el piggyback solo lee BD. Nada sale a terceros. |
| §3.5 Logs y auditoría | ✅ Pass | Solo señal, timestamps, latencia y método; sin texto de reportes. |
| I-49 Migraciones aditivas | ✅ Pass | Si se añade `metodo`, es `ALTER TABLE ... ADD COLUMN` con default; cero DROP. |
| Candado "sin destructivas" | ✅ Pass | El monitor solo lee, escribe probes y envía email; jamás reinicia procesos. |
| Frontera DAL Q-3 | ✅ Pass | `probes.ts` e `incidentes.ts` NO importan prisma; usan `MonitoreoRepository` y `ClasificacionIARepository`. |

---

## Estado actual (verificado en fuente)

- `src/lib/monitoreo/probes.ts`: `probeOllamaPing` (GET `/api/tags`) y `probeOllamaSmoke` (POST `/api/generate` con modelo vigente). Hoy `ollama_smoke` siempre ejecuta la generación real.
- `src/lib/monitoreo/incidentes.ts`: `registrarProbe` + `evaluarSenal` + `confirmarRojo`; persisten por `MonitoreoRepository`.
- `src/lib/dal/repositories/monitoreo.ts`: opera `HealthProbe` e `IncidenteInfra`; no tiene método para consultar `ClasificacionIA`.
- `src/lib/dal/repositories/clasificacion-ia.ts`: CRUD básico de `ClasificacionIA`; no tiene método de "última clasificación exitosa dentro de ventana".
- `scripts/monitor-probes.mjs`: tick cada 5s, lee parámetros en cada ciclo y llama a `correrProbe("ollama_smoke", config)` según el intervalo. No distingue métodos ni piggyback.
- `src/app/api/admin/monitoreo/estado/route.ts`: devuelve el estado de las 6 señales; no expone historial.
- `src/components/modules/monitoreo/SemaforoCard.tsx`: tarjeta de solo lectura; no es clickable hoy.
- `src/app/dashboard/admin/estadisticas/operacion/OperacionTableroClient.tsx`: renderiza las 6 tarjetas; no tiene historial.
- `prisma/seed.ts`: siembra `monitoreo.ollama.smoke.intervalo_min=5` (sin resiembra de valor) y no siembra `monitoreo.ollama.smoke.piggyback_min`.

---

## Diseño por fase

### Fase 1 — Modelo y repositorios

**Opción A (recomendada): columna aditiva `metodo`**
- Migración aditiva: `ALTER TABLE "HealthProbe" ADD COLUMN "metodo" TEXT DEFAULT 'SMOKE';` (o `VARCHAR`).
- No se toca el índice existente `@@index([senal, creadoEn])`; opcionalmente se añade `@@index([senal, metodo, creadoEn])` si el resumen de 24h lo necesita (verificar con `EXPLAIN` en implementación).
- Enum TypeScript `MetodoProbe = "PING" | "PIGGYBACK" | "SMOKE"`.
- `MonitoreoRepository`:
  - `crearProbe(data)` acepta `metodo` y lo persiste.
  - `ultimosProbesPorSenal(senales)` retorna filas con `metodo`.
  - NUEVO `resumenOllamaUltimas24h()` → `{ pings, piggybacks, smokes, fallos }` usando `WHERE senal IN ('ollama_ping','ollama_smoke') AND creadoEn >= ahora - interval '24 hours'` y agrupando por `metodo`/`ok`.
  - NUEVO `historialProbes(senal, limite)` → últimos `limite` probes de una señal, ordenados por `creadoEn DESC`.
- `ClasificacionIARepository`:
  - NUEVO `existeClasificacionExitosaDesde(fecha)` → `boolean` (o `findUltimaClasificacionExitosaDesde(fecha)` → `{ creadoEn } | null`).
  - Criterio de "exitosa": fila `ClasificacionIA` existe (la creación del registro implica que Ollama respondió). No se filtra por categoría ni confianza.

**Opción B (alternativa): codificar método en `detalle`**
- Sin migración. `detalle` comienza con prefijo `[PING]`, `[PIGGYBACK]` o `[SMOKE]`.
- Más barato pero frágil para agregaciones y el resumen de 24h. Se documenta en la compuerta para decisión de ZEUS.

### Fase 2 — Probes

- `probeOllamaPing`: sin cambios funcionales; al registrar se le asigna `metodo="PING"`.
- NUEVO `probeOllamaPiggyback({ ventanaMin })`:
  - Lee `MonitoreoRepository` + `ClasificacionIARepository`.
  - Si hay clasificación reciente → `{ ok: true, latenciaMs: 0, detalle: "vivo por tráfico real, hace N min", metodo: "PIGGYBACK" }`.
  - Si no → devuelve `null` o señal de "no aplica" para que el caller decida smoke real.
- `probeOllamaSmoke` (modificado):
  - Recibe `intervaloMin` y `timeoutMs`.
  - Consulta la última clasificación reciente (piggyback); si aplica, retorna el resultado piggyback.
  - Si no aplica, consulta la hora del último smoke real exitoso (`MonitoreoRepository.ultimoSmokeRealExitoso()`); si aún no ha pasado `intervaloMin`, salta este ciclo (sin escribir probe, o escribiendo un probe piggyback con detalle "smoke real no necesario aún" — a definir en compuerta).
  - Si toca smoke, ejecuta `POST /api/generate` con el modelo vigente y retorna `metodo="SMOKE"`.

**Ciclo del monitor (`scripts/monitor-probes.mjs`)**:
- La señal `ollama_smoke` sigue siendo una sola; `correrProbe` decide internamente ping/piggyback/smoke según la config.
- Se añade lectura de `monitoreo.ollama.smoke.piggyback_min`.
- El intervalo de `ollama_smoke` pasa a regir el smoke REAL; el piggyback puede ocurrir más seguido si el tick lo evalúa (pero se propone respetar el mismo intervalo para no saturar la BD de probes piggyback). Se discute en compuerta.

### Fase 3 — Endpoints

- `GET /api/admin/monitoreo/historial?senal=ollama_smoke&limite=50`:
  - `verifyAuth("ADMIN")` + `assertModulo(admin, "estadisticas")`.
  - Valida `senal` contra `SENALES_MONITOREO`; `limite` default 50, máx 100.
  - Retorna `{ items: HealthProbe[], resumen24h: { pings, piggybacks, smokes, fallos } }`.
- `GET /api/admin/monitoreo/estado`: sin cambios de contrato; sigue usando `ultimosProbesPorSenal`.

### Fase 4 — UI

- `SemaforoCard`: opcionalmente hacerla clickable cuando tenga historial disponible (prop `onClick`); sin romper usos actuales.
- NUEVO componente `OllamaSmokeHistorial`:
  - Modal o subsección desplegable.
  - Muestra resumen de 24h y tabla de los últimos 50 chequeos.
  - Columnas: Hora, Método, Resultado, Latencia/Motivo.
- `OperacionTableroClient`:
  - Ancla el historial a la tarjeta "Cerebro IA" (`ollama_ping`).
  - Fetch a `/api/admin/monitoreo/historial?senal=ollama_smoke&limite=50` al abrir.

### Fase 5 — Seed y ConfigPanel

- `prisma/seed.ts`:
  - Añadir `monitoreo.ollama.smoke.piggyback_min=15`.
  - Cambiar el default de creación de `monitoreo.ollama.smoke.intervalo_min` a `30` (solo afecta nuevas BD o resiembra; valores existentes se respetan).
  - Implementar resiembra real con `ON CONFLICT DO UPDATE` o lógica equivalente para que, si el parámetro existe con valor vacío/nulo, se actualice al default. **Nota**: el patrón actual de `upsert({ update: {} })` no actualiza el valor si ya existe; se propone en compuerta si se desea forzar la migración del default en BD existente.
- ConfigPanel: la sección "Monitoreo" ya existe; el nuevo parámetro aparece automáticamente por el prefijo `monitoreo.ollama.smoke.`.

---

## Project Structure

```text
prisma/migrations/..._spec_186_smoke_inteligente_ollama/migration.sql   # OPCIONAL (solo si se añade columna metodo)
prisma/schema.prisma                                                    # MOD opcional: +metodo en HealthProbe
prisma/seed.ts                                                          # MOD: +piggyback_min, default intervalo_min=30, resiembra
src/lib/dal/repositories/monitoreo.ts                                   # MOD: +metodo, +resumenOllamaUltimas24h, +historialProbes
src/lib/dal/repositories/clasificacion-ia.ts                            # MOD: +existeClasificacionExitosaDesde
src/lib/monitoreo/probes.ts                                             # MOD: probeOllamaSmoke (piggyback + smoke real), +probeOllamaPiggyback, metodo en ResultadoProbe
src/lib/monitoreo/incidentes.ts                                         # MOD: registrarProbe pasa metodo
scripts/monitor-probes.mjs                                              # MOD: lee piggyback_min, reusa probeOllamaSmoke
src/app/api/admin/monitoreo/historial/route.ts                          # NUEVO
src/app/api/admin/monitoreo/historial/route.test.ts                     # NUEVO
src/components/modules/monitoreo/OllamaSmokeHistorial.tsx               # NUEVO
src/components/modules/monitoreo/SemaforoCard.tsx                       # MOD: onClick opcional
docs/architecture/                                                      # REGENERAR (endpoint nuevo + modelo opcional)
tests: probes (integration), repositorios (unit/integration), endpoint historial (integration), componente (unit)
```

---

## Orden de implementación (tasks.md tras compuerta)

1. Decisión de compuerta: columna `metodo` vs `detalle`; defaults de parámetros.
2. Migración opcional + seed params.
3. Repositorios (`MonitoreoRepository` y `ClasificacionIARepository`) con tests.
4. `src/lib/monitoreo/probes.ts` (ping/piggyback/smoke) con tests.
5. `scripts/monitor-probes.mjs` ajustado.
6. Endpoint `/api/admin/monitoreo/historial` + tests.
7. UI historial en tablero operativo + tests de componente.
8. `docs/architecture/` + gate local completo.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| El piggyback oculte una caída de Ollama | El ping HTTP (`ollama_ping`) sigue corriendo cada minuto y detecta caídas totales. El piggyback nunca se usa si el ping está rojo. |
| El smoke real se dispara menos y no detecta degradación lenta | Si Ollama responde ping pero no clasifica bien, el smoke real (máx cada 30 min) lo caza. Se mantiene I-51. |
| Resiembra del default 30 min choque con el valor 5 min del CEO | El seed no sobrescribe valores existentes a menos que ZEUS apruebe forzar el cambio en BD existente. |
| Agregar columna `metodo` rompa queries existentes | Default `SMOKE` en la migración; el endpoint de estado ignora el campo y sigue funcionando. |
| Más probes piggyback saturan `HealthProbe` | Se propone registrar un probe por ciclo de `ollama_smoke` (no uno por piggyback extra); el ciclo respeta el intervalo. |

---

## Decisiones para compuerta §4

1. **Columna `metodo` en `HealthProbe`**: ¿Opción A (columna aditiva, recomendada) u Opción B (prefijo en `detalle`)?
2. **Default histórico para `metodo`**: `"SMOKE"` (asume que todos los probes previos eran smokes reales) o `"DESCONOCIDO"`.
3. **Defaults operativos**: ¿`monitoreo.ollama.smoke.intervalo_min=30` y `monitoreo.ollama.smoke.piggyback_min=15`?
4. **Resiembra en BD existente**: ¿Forzar el cambio del default 5→30 en BD existente (UPDATE si el valor actual es 5) o dejar el valor del CEO intacto?
5. **UI del historial**: ¿modal al hacer click en "Cerebro IA" o subsección desplegable debajo de la grilla de semáforos?
