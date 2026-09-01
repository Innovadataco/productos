# Phase 0 · Research · SPEC-341

Registro de decisiones técnicas basadas en verificación del código actual.

---

## R-1 · Cliente Ollama estructurado

**Decision**: reusar `src/lib/ai/ollama-client.ts` con `llamarOllamaStructured<T>()`,
imponiendo timeout via el parámetro existente `ia.ollama.timeout_ms`. No se
introduce cliente nuevo.

**Rationale**: el cliente ya implementa (a) validación de JSON Schema, (b)
métricas de latencia y tokens, (c) manejo de errores logueado. Duplicar
un cliente por SPEC-341 es duplicación gratuita.

**Alternatives considered**:
- Cliente nuevo dedicado al análisis capa 2 — rechazado (viola R-16 y
  Constitution §2.1).
- Cambiar a un provider externo (OpenAI/Anthropic) — rechazado por brief
  (motor local es requisito de negocio de PI).

---

## R-2 · Reintentos del análisis

**Decision**: SIN reintento automático dentro del job. Un fallo del modelo
(timeout, error 5xx) marca el job `FALLIDO` con motivo y el UI cae al fallback
(último análisis + aviso *"El último intento no completó — puedes actualizar
más tarde"*). Reintentar es acción explícita del padre.

**Rationale**: el brief prohíbe "trabajo invisible". Un reintento silencioso
gasta modelo por decisión del sistema, no del usuario. Además, si el modelo
falló por saturación de la Mac, reintentar empeora el problema (R-16).

**Alternatives considered**:
- Un reintento con back-off — rechazado por el mismo motivo (invisible +
  puede saturar).
- Reintento manual por admin desde panel — fuera de alcance (no lo pide
  el brief).

---

## R-3 · Advisory-lock

**Decision**: reservar ID `123456799` para
`scripts/worker-analisis-expediente.mjs` (servicio `pi-analisis-expediente`
en el compose). Es el siguiente entero libre después de `123456798`
(scripts/ADVISORY-LOCKS.md línea 20).

**Rationale**: la tabla es la fuente única (SPEC-284) y el patrón es
"siguiente libre en la serie `12345679X`".

**Alternatives considered**:
- `923456790` — rechazado: no hay razón para saltar de bloque.

**Acción de plan**: agregar la fila en `scripts/ADVISORY-LOCKS.md` en el
mismo PR (regla operativa 2 del propio documento).

---

## R-4 · Prioridad de pg-boss

**Decision**: `padre.analisis.prioridad = 5` (default) y
`queue.clasificacion.prioridad = 10` (existente). pg-boss consume primero
las prioridades MAYORES; nuestro parámetro es un entero menor → los reportes
se despachan primero.

**Rationale**: el CEO cerró (01-09-2026) que un análisis NUNCA puede demorar
la clasificación crítica de un reporte nuevo. Sin este orden, un pico de
aperturas de padres bloquea toda la clasificación.

**Alternatives considered**:
- Prioridades iguales — rechazado (rompe la garantía).
- Colas separadas con workers separados — descartado por simplicidad: un
  solo worker (`worker-analisis-expediente`) escucha su propia cola; la
  cola de clasificación ya tiene su worker. No compiten por CPU salvo por
  Ollama, que ya está limitado por `max_concurrentes=1`.

---

## R-5 · Formato de fecha en la UI

**Decision**: `Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" })`
para el sello *"Análisis al corte del 31 de agosto de 2026, 4:12 p. m."*.

**Rationale**: es la misma configuración que ya usa `ExpedienteVivo.tsx`
(SPEC-340) y el resto del panel del padre. Consistencia visual.

**Alternatives considered**:
- Formato ISO — rechazado (no lo lee un padre no técnico).

---

## R-6 · Estado de SPEC-340 en `main`

**Decision**: al momento de escribir esta spec (2026-09-01 03:00), SPEC-340
está mergeado (PR #208, hash `d54b898ec` + `e1b52e6b3`). El plan asume:

- `Expediente.numEventos`, `categoriasDominantesJson`, `ultimoEventoEn`
  disponibles (existen desde antes; SPEC-340 no los toca).
- `Reporte.reportePrincipalId` (self-FK de SPEC-340) — usado por SPEC-340
  para agrupar cadenas, no lo consume SPEC-341.
- `ExpedienteVivo.tsx` — SPEC-340 lo tiene; monta debajo del mapa.

**Rationale**: verificado en `git log origin/main` al arrancar la rama.

**Ruta de fallback**: si al implementar SPEC-340 fuese revertido, el análisis
se muestra en `ExpedienteDetalleClient.tsx` (predecesor) — el componente
`AnalisisExpediente.tsx` es autocontenido y no depende de la estructura del
padre.

---

## R-7 · Mecanismo de refresco del UI

**Decision**: **polling** desde el cliente al `GET /api/padre/expedientes/[id]/analisis`
cada 15 s mientras el estado sea `GENERANDO`. Detener al primer `PUBLICADO`
o `FALLIDO`.

**Rationale**:
- No requiere infra nueva (SSE, WebSocket).
- El análisis raro y la latencia esperada (~90 s) hacen que 15 s sea una
  cadencia razonable (6 requests por generación en el peor caso).
- El endpoint es barato: lee 1 fila + calcula hash con datos ya en memoria.

**Alternatives considered**:
- SSE — rechazado (más infra, más superficie de bug, sin ganancia clara).
- WebSocket — mismo argumento, aún más pesado.
- Sin refresco (usuario recarga) — rechazado (rompe la UX de primera clase
  del CEO: banner "vivo" con posición actualizable).

---

## R-8 · Estructura del payload al modelo (por alcance)

**Decision**: dos armadores en `armar-payload.ts`, seleccionados por
`alcance`:

- `PADRE_COMPLETO`: lista de hechos (fecha, ciudad, país, plataforma,
  categoría, edadReportada) + agregados (categoría dominante, franja horaria
  dominante, ciudad dominante) + cruce con hijo (solo edad/sexo, no nombre).
- `COLEGIO_BLINDADO`: solo agregados (categorías dominantes, franjas
  horarias, curso, plataforma), CERO identificadores, CERO textos, CERO
  edad/sexo por hecho individual.

Ambos armadores devuelven un `PayloadAnalisis` tipado que el orquestador
serializa a JSON y envía al modelo.

**Rationale**: garantiza que el switch por `alcance` esté encapsulado en un
único módulo verificable por test (SC-002 y SC-006). El módulo colegio C3
importará solo la función `armarPayloadColegio()` y llamará al mismo
orquestador — cero código nuevo de motor.

**Alternatives considered**:
- Un solo armador con flags — rechazado: la lógica del blindaje colegio es
  suficientemente distinta (agregados vs hechos) para justificar dos funciones.
