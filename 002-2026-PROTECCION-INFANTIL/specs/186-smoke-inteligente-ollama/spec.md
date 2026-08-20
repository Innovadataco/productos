# Feature Specification: SPEC-186 — Smoke inteligente del monitor Ollama (002-PI-081)

**Feature Branch**: `work/002-pi-081`

**Created**: 2026-08-20

**Status**: PLANEADO

**Implementación**: pendiente aprobación de ZEUS (compuerta §4). Ver [plan.md](./plan.md) y [tasks.md](./tasks.md).

Impacto en arquitectura: rediseño del probe `ollama_smoke` a 3 niveles (ping siempre → piggyback en tráfico real → smoke real raro); posible columna aditiva `metodo` en `HealthProbe`; nuevo endpoint de historial de probes; ampliación de la tarjeta "Cerebro IA" en el tablero operativo. Cero cambios en el motor `src/lib/ai/**`.

**Input**: 002-PI-081. El smoke actual de SPEC-171 (`monitoreo.ollama.smoke.intervalo_min=5`) dispara una clasificación real contra Ollama cada 5 minutos con `gemma2:27b` (~16 GB). Eso recarga el modelo más rápido que el idle timeout de Ollama, por lo que los 16 GB nunca se descargan de la GPU del CEO y el smoke compite con reportes reales (Ollama serializa requests).

Objetivo: convertir el guarda en un vigilante inteligente que solo moleste a Ollama cuando no haya otra señal de vida. Se conserva la cobertura de I-51 (avisar de caídas silenciosas).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ping HTTP barato siempre (Priority: P1)

Como admin quiero que el monitor toque la puerta de Ollama barato y seguido, para detectar una caída total enseguida sin cargar modelo.

**Why this priority**: es la primera línea de defensa; si Ollama muere de verdad, lo cazamos en ≤1 min.

**Independent Test**: con Ollama vivo, `GET /api/tags` responde en ~100 ms y el semáforo "Cerebro IA" está verde.

**Acceptance Scenarios**:

1. **Given** el parámetro `monitoreo.ollama.ping.intervalo_seg=60`, **When** corre el vigilante, **Then** hace `GET ${OLLAMA_BASE_URL}/api/tags` cada 60 segundos.
2. **Given** Ollama responde 200, **Then** el probe `ollama_ping` se registra como `ok=true` con latencia ~100 ms.
3. **Given** Ollama no responde, **Then** el probe `ollama_ping` falla, dispara re-probe y, si persiste, abre incidente en ≤2 minutos.

### User Story 2 — Piggyback en tráfico real (Priority: P1)

Como admin quiero que, si el cerebro está clasificando reportes reales, el monitor reutilice esa señal de vida en lugar de disparar un smoke nuevo, para no competir por la GPU.

**Why this priority**: hoy el smoke real cada 5 min mantiene el modelo cargado; con tráfico real bastante frecuente no hace falta.

**Independent Test**: crear o esperar una `ClasificacionIA` en los últimos 15 min; verificar que `ollama_smoke` se registra como verde por piggyback sin tocar `/api/generate`.

**Acceptance Scenarios**:

1. **Given** el parámetro `monitoreo.ollama.smoke.piggyback_min=15`, **When** el monitor va a probar `ollama_smoke`, **Then** primero consulta si existe alguna `ClasificacionIA` exitosa con `creadoEn >= ahora - 15 min`.
2. **Given** que SÍ hay clasificación reciente, **Then** el probe `ollama_smoke` se registra como `ok=true` con método `PIGGYBACK` y detalle "vivo por tráfico real, hace N min" — sin llamar a Ollama.
3. **Given** que NO hay clasificación reciente, **Then** el monitor evalúa si toca un smoke real (Bloque C).

### User Story 3 — Smoke real solo cuando hace falta (Priority: P1)

Como admin quiero que el smoke real contra `/api/generate` solo se dispare cuando no hay tráfico reciente y ya pasó el intervalo configurado, para no recargar el modelo en vano.

**Why this priority**: reduce la carga de GPU y la competencia con reportes reales, sin perder la verificación de que Ollama sí clasifica bien.

**Independent Test**: forzar ausencia de `ClasificacionIA` reciente; verificar que el smoke real se ejecuta y se registra con método `SMOKE` y latencia real.

**Acceptance Scenarios**:

1. **Given** sin tráfico real reciente, **When** ya pasaron `monitoreo.ollama.smoke.intervalo_min` (default 30) desde el último smoke real exitoso, **Then** se ejecuta `POST /api/generate` con el modelo vigente (`ia.rubrica.modelos[0]`).
2. **Given** Ollama responde con respuesta no vacía, **Then** el probe se registra como `ok=true` con método `SMOKE`, latencia real y detalle "smoke real ejecutado, latencia X ms".
3. **Given** Ollama no responde o responde vacío/error, **Then** el probe falla, dispara re-probe y posible incidente.
4. **Given** un smoke real exitoso reciente (< intervalo), **Then** se salta el smoke real y, si aplica, registra piggyback.

### User Story 4 — Visibilidad del historial en el tablero operativo (Priority: P2)

Como CEO quiero ver en el tablero cuántos pings, piggybacks y smokes reales ha hecho el vigilante, para comprobar que el rediseño es inteligente y no un "pasa a boca cerrada".

**Why this priority**: evidencia visual de que el cambio cumple su promesa (muchos piggybacks, pocos smokes reales, cero fallos).

**Independent Test**: abrir `/dashboard/admin/estadisticas/operacion`, hacer click en "Cerebro IA" y ver el historial de los últimos 50 chequeos con método y resultado.

**Acceptance Scenarios**:

1. **Given** el tablero operativo, **When** el admin hace click en la tarjeta "Cerebro IA", **Then** se abre una subsección/modal con una tabla: Hora | Método (Ping / Piggyback / Smoke real) | Resultado | Motivo/latencia.
2. **Given** esa subsección, **Then** arriba muestra el resumen de las últimas 24h: "N pings · M piggybacks · K smokes reales · F fallos".
3. **Given** el historial, **Then** discrimina limpiamente el método de cada probe (columna o campo dedicado, no parsear `detalle`).
4. **Given** un probe viejo de antes de SPEC-186, **Then** se muestra como método "Smoke" (default histórico) o "Desconocido" según se decida en compuerta.

### User Story 5 — Parámetros configurables y resiembra segura (Priority: P2)

Como admin quiero poder configurar el intervalo de piggyback y asegurarme de que el seed siembre/resiembre los parámetros de Ollama, para no depender de tocar la BD a mano.

**Independent Test**: verificar que `monitoreo.ollama.smoke.piggyback_min` existe en seed/ConfigPanel y que `monitoreo.ollama.smoke.intervalo_min` se resiembra si faltaba.

**Acceptance Scenarios**:

1. **Given** el seed, **Then** siembra `monitoreo.ollama.smoke.piggyback_min=15` (INTEGER) con descripción en criollo.
2. **Given** un despliegue donde `monitoreo.ollama.smoke.intervalo_min` no existe, **Then** el seed lo crea con default 30 (resiembra aditiva, sin tocar valores existentes del CEO).
3. **Given** el ConfigPanel, **Then** aparece el nuevo parámetro bajo la sección "Monitoreo".

## Edge Cases

- **Primer arranque sin tráfico real**: el primer `ollama_smoke` debe hacer smoke real (no hay clasificación reciente que aprovechar).
- **Ollama caído pero hay clasificaciones viejas**: el piggyback NO debe ocultar una caída actual; el ping HTTP (Bloque A) detecta la caída en ≤1 min. El piggyback solo alimenta `ollama_smoke` si el ping está verde.
- **Cambio de intervalo en caliente**: el monitor lee parámetros en cada ciclo; al cambiar `piggyback_min` o `intervalo_min` se aplica sin reiniciar.
- **Modelo vigente cambia entre smokes**: el smoke real usa `ia.rubrica.modelos[0]` leído en el momento del disparo.
- **Probes históricos sin campo `metodo`**: se documenta su tratamiento (default `SMOKE` o `DESCONOCIDO`) y no se rompe el endpoint de estado actual.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El probe `ollama_smoke` DEBE evaluarse en 3 niveles ordenados: ping HTTP (siempre) → piggyback en tráfico real → smoke real (solo si no hay tráfico reciente y ya pasó el intervalo).
- **FR-002**: El ping `ollama_ping` DEBE seguir ejecutándose cada `monitoreo.ollama.ping.intervalo_seg` sin cargar modelo.
- **FR-003**: El piggyback DEBE consultar la última `ClasificacionIA` exitosa dentro de la ventana `monitoreo.ollama.smoke.piggyback_min`; si existe, registrar probe `ollama_smoke` verde sin llamar a Ollama.
- **FR-004**: El smoke real DEBE ejecutarse solo cuando no aplica piggyback Y ya transcurrió `monitoreo.ollama.smoke.intervalo_min` desde el último smoke real exitoso.
- **FR-005**: El smoke real DEBE usar el modelo vigente del motor (`ia.rubrica.modelos[0]`) y el timeout configurado; NO debe usar un modelo fijo.
- **FR-006**: El sistema DEBE registrar el método de cada probe (`PING`, `PIGGYBACK`, `SMOKE`) de forma limpia para el historial; se propone columna aditiva `metodo` en `HealthProbe`.
- **FR-007**: El tablero operativo DEBE mostrar un resumen de las últimas 24h (pings / piggybacks / smokes reales / fallos) y un historial paginado de los últimos 50 chequeos de `ollama_smoke`.
- **FR-008**: El endpoint de estado actual (`/api/admin/monitoreo/estado`) DEBE conservar su contrato; el historial DEBE exponerse por un endpoint nuevo (`/api/admin/monitoreo/historial`).
- **FR-009**: El seed DEBE siembra el parámetro `monitoreo.ollama.smoke.piggyback_min=15` y DEBE resiembrar `monitoreo.ollama.smoke.intervalo_min=30` si no existe (aditivo, sin alterar valores existentes).
- **FR-010**: Todo acceso a `HealthProbe` y `ClasificacionIA` DEBE pasar por repositorios (frontera DAL Q-3); `probes.ts` e `incidentes.ts` NO deben importar prisma.
- **FR-011**: Cero cambios en `src/lib/ai/**`; solo se LEE cuándo fue la última clasificación exitosa (query a `ClasificacionIA`, no invocación al motor).

### Key Entities

- **HealthProbe**: resultado de un chequeo (señal, ok, latenciaMs, detalle, creadoEn, **metodo?**). Append-only, retención 7 días.
- **ClasificacionIA**: fuente del piggyback (última clasificación exitosa dentro de la ventana).
- **Parámetros monitoreo.ollama.smoke.***: `intervalo_min`, `piggyback_min`, `timeout_ms`; `monitoreo.ollama.ping.intervalo_seg` ya existe.

## Success Criteria *(mandatory)*

- **SC-001**: Con Ollama apagado, `ollama_ping` pasa a rojo en ≤2 minutos (ping 60s + re-probe 60s).
- **SC-002**: Con Ollama sano y tráfico real reciente, el contador de smokes reales en 24h es bajo (idealmente 0) mientras el contador de piggybacks refleja la actividad.
- **SC-003**: Sin tráfico real reciente, un smoke real se ejecuta a lo sumo cada 30 minutos y se refleja en el historial.
- **SC-004**: El historial del tablero discrimina Ping / Piggyback / Smoke real y muestra el resumen de 24h.
- **SC-005**: Gate local completo verde (tsc, lint --no-cache, arch:check, tests unitarios/integración, build) y CI del PR verde.

## Assumptions

- El monitor sigue siendo un proceso separado (`scripts/monitor-probes.mjs`) con advisory lock; el rediseño afecta la lógica del probe, no la arquitectura del vigilante.
- "Tráfico real" = cualquier fila en `ClasificacionIA` (independientemente de la categoría o confianza), porque su sola existencia demuestra que Ollama respondió una clasificación.
- El modelo vigente se lee de `ia.rubrica.modelos[0]` (decisión ZEUS en SPEC-171); el smoke real reusa esa misma regla.
- El parámetro `monitoreo.ollama.smoke.intervalo_min` pasa a default 30 en el seed (frente al 5 actual), pero los valores existentes en BD no se sobrescriben (resiembra aditiva).
- El tablero operativo actual tiene tarjeta "Cerebro IA" (`ollama_ping`) y "Clasificación real del cerebro" (`ollama_smoke`); el historial se ancla a la tarjeta "Cerebro IA" por ser la señal que resume la salud de Ollama.

## Decisiones de compuerta §4 (aprobadas)

1. **Columna aditiva `metodo` en `HealthProbe`**: ✅ APROBADA. Se añade `metodo String? @default("SMOKE")` con migración aditiva. Probes históricos se reportan como `"SMOKE"` (eran todos smokes reales antes de SPEC-186).
2. **Defaults operativos**: ✅ APROBADOS.
   - `monitoreo.ollama.smoke.intervalo_min` pasa a `30` minutos (antes 5).
   - `monitoreo.ollama.smoke.piggyback_min` = `15` minutos.
3. **Seed MIXTO (I-65)**: ✅ APROBADO.
   - Los 13 parámetros viejos de SPEC-171 se siembran si faltan con `update: {}` (no pisan valores custom del CEO).
   - Los 2 parámetros nuevos/cambiados de SPEC-186 (`intervalo_min`, `piggyback_min`) se aplican siempre con `update: { valor, descripcion }`.
4. **UI del historial**: ✅ APROBADA. Modal al hacer click en la tarjeta "Cerebro IA", con resumen de 24h y tabla de últimos 50 chequeos.
