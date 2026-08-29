# Research: SPEC-186

## Problema verificado

- SPEC-171 creó `probeOllamaSmoke` que ejecuta `POST /api/generate` cada `monitoreo.ollama.smoke.intervalo_min` minutos (default 5).
- En producción el modelo vigente es `gemma2:27b` (~16 GB). Cada generación recarga el modelo si Ollama lo descargó de la GPU; con un intervalo de 5 min el modelo nunca llega al idle timeout, por lo que los 16 GB permanecen residentes.
- Ollama serializa requests; el smoke compite con reportes reales.

## Opciones consideradas para el piggyback

| Opción | Descripción | Pros | Contras |
|--------|-------------|------|---------|
| A. `ClasificacionIA.creadoEn` | Usar la última clasificación exitosa como señal de vida. | Simple, no toca el motor, refleja tráfico real. | No detecta si el modelo cambió a un estado donde no clasifica bien (pero el smoke real periódico sí). |
| B. `TransicionReporte` a `CLASIFICADO` | Usar transiciones de estado. | Más cercano al negocio. | Más complejo; una transición no garantiza que Ollama respondió (podría ser corrección humana). |
| C. Heartbeat del worker de reportes | Reutilizar el heartbeat. | Ya existe. | Indica que el worker vive, no que Ollama clasifica. |

**Decisión propuesta**: Opción A (`ClasificacionIA`) — es la señal más directa de que Ollama acaba de clasificar un reporte real.

## Opciones consideradas para distinguir el método

| Opción | Descripción | Pros | Contras |
|--------|-------------|------|---------|
| Columna `metodo` en `HealthProbe` | Campo dedicado con default. | Limpio para queries y UI; no parsea strings. | Requiere migración aditiva (aunque sea trivial). |
| Prefijo en `detalle` | `[PING] ...`, `[PIGGYBACK] ...`, `[SMOKE] ...`. | Sin migración. | Frágil; rompe la semántica de `detalle`; agregaciones costosas. |

**Decisión propuesta**: columna `metodo` (Opción A).

## Cobertura de I-51

- Caída total de Ollama: `ollama_ping` cada 60s + re-probe 60s → ≤2 min para abrir incidente (≤1 min si se considera el primer rojo visible en el tablero tras un solo fallo, aunque el incidente requiere doble rojo).
- Degradación (responde ping pero no clasifica): smoke real máx cada 30 min → ≤30 min para detectar.
- El piggyback no debilita la cobertura porque el ping sigue corriendo y el smoke real sigue existiendo.
