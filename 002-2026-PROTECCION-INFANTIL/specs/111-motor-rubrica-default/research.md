# Research — SPEC-111 (D-28)

**Date**: 2026-07-28

## Evidencia (medida, no estimada)

**Calidad del motor** (ACTA_VALIDACION_08, banco curado, misma corrida):
legacy 74,5% acc · ESPS 1240 · 9 silenciosos GRAVES · rúbrica 70,5% acc · ESPS 595 · 0
silenciosos graves. Reproducibilidad verificada: dos corridas de 200 idénticas byte a byte
y 20/20 tras reinicio real de Ollama (T1, 002-PI-028).

**Capacidad** (002-PI-029, pipeline REAL `POST /api/reportes/procesar`, esta Mac,
`scripts/medicion-capacidad-111.ts`, ejecutada 2026-07-28):
- (a) LEGACY punta a punta: **37.7 s** (reporte CLASIFICADO).
- (b) RÚBRICA punta a punta: **52.0 s** (reporte CLASIFICADO) — **bajo el tope de 3 min**.
- (c) Throughput rúbrica: **~69 reportes/hora** (1 worker) · **~138/hora** a
  `worker.concurrencia=2` (valor actual del parámetro).
- Contexto de RAM: la rúbrica vota SECUENCIALMENTE (1 modelo a la vez por diseño, cuida la
  RAM de 36 GB); las corridas de 200×2 ya demostraron estabilidad en esta máquina.

## Decisiones

- **Decisión: el cambio es SOLO de parámetro** (`ia.rubrica.enabled`), no de código del
  motor. Rationale: la rúbrica ya está implementada y validada (SPEC-090/092/095/098/104);
  D-28 es encenderla. El pipeline ya ramifica por ese parámetro.
- **Decisión: script idempotente separado para la BD operada** (`aplicar-rubrica-default-111.ts`).
  Rationale: el seed es upsert no destructivo; la I-27 nació de una recomendación sin
  aplicar — esta vez queda ejecutable y verificable.
- **Decisión: test de EFECTO sobre el pipeline real** (votos en `ClasificacionRubricaVoto`
  como evidencia de rúbrica; ausencia como evidencia de legacy). Rationale: I-14/I-20 —
  probar el efecto, no la existencia del parámetro.
- **Restricciones confirmadas**: textos de preguntas, terna y umbral 60% intactos; el
  parámetro de la BD dev vuelve a `false` tras la medición (LEGACY hasta el despliegue).

## Referencias

- `docs/cola-nocturna-025.md` (medición reproducible), `resultados-104-*.json` (evidencia).
- D-19 (default LEGACY) → superseded por D-28 con esta spec.
