# Research — 095-default-seguro-jwt-banco

**Fecha**: 2026-07-24 · **Autor**: ODIN

## R1 — D-19: el default es el motor, no la rúbrica

La rúbrica es un experimento auditable en desarrollo; el motor productivo debe ser el que mejor rinde hoy (legacy, 94-100% en la spec 085). El flip se hace en DOS capas: el valor del seed (`ia.rubrica.enabled=false`) y el fallback del loader (sin parámetro → `enabled === true` requerido). Así un entorno limpio sin la clave también cae a legacy. La rúbrica y su configuración (preguntas, modelos, umbral, matriz) se conservan íntegras para la iteración experta — solo sale del camino por defecto.

## R2 — D-21 y el barrido de muertos: cablear o retirar, no sembrar-sin-leer

| Parámetro | Decisión | Por qué |
|---|---|---|
| `security.jwt_ttl_hours` | **CABLEADO** (`auth.ts` `obtenerJwtTtlSegundos`, fallback 24h) | Era el huevo D-094-2 del barrido: param sembrado + literal quemado en el mismo archivo. |
| `security.password_min_length` | **CABLEADO** en `cambiar-password` (validación desde el parámetro, fallback 8) | Tenía uso real latente; el Zod ya no fija el mínimo. |
| `system.maintenance_mode` | **RETIRADO del seed** | No existe ninguna feature de modo mantenimiento; cablearla sería inventar alcance. |
| `reportes.worker.max_retries` | **RETIRADO del seed** | Duplicado mal nombrado de `worker.max_reintentos` (que SÍ se lee en `queue.ts`). |
| `reportes.worker.stalled_threshold_minutes` | **RETIRADO del seed** | No hay detector de cola estancada; sería feature nueva fuera de alcance. |

Las filas viejas en la BD de dev quedan inertes (el seed ya no las recrea); no se borran por no-destructivo.

## R3 — D-20: fuente única gobernada = CasoEval

Los dos bancos divergían: `CasoEval` 110 casos `fixtureVersion=1` (eval-runner) vs JSON de simulación 200 casos `fixtureVersion=2`. Unificación: el banco de 200 manda y se siembra en `CasoEval` con `fixtureVersion=2` (upsert por texto+fuente+versión, preservando `secundariaEsperada`). El de 110 queda subordinado (no se borra: historia del eval-runner). El JSON de simulación pasa a ser un EXPORT reproducible (`scripts/exportar-banco-simulacion.ts`) — la gobernanza vive en BD, editable desde el tab de casos del Centro IA.

## R4 — Adjudicación: hoja de trabajo, no decisiones

Los 42 casos en disputa (3/3 modelos contra la etiqueta) se re-corren capturando el voto de CADA modelo y se entregan como hoja de trabajo (`docs/adjudicacion-095-casos-disputa.md`) con "Etiqueta adjudicada" y "Razón" vacías. La adjudicación es tarea de ZEUS+CEO+experto, como ordena D-20.

## R5 — Runner dual: la comparación limpia pendiente

`scripts/eval-dual-banco.ts` corre legacy (gemma2:27b × 5 votos, umbral 1.0) y rúbrica sobre el MISMO banco gobernado, con `legacyOk`/`rubricaOk` por caso (multi-etiqueta acepta secundaria). Verificado en submuestra (4/4 ambos). Cuando lleguen las etiquetas adjudicadas, re-correrlo da la comparación definitiva sin sesgo de banco.
