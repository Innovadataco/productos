# Research — 094-deuda-tecnica-documentacion

**Fecha**: 2026-07-24 · **Autor**: ODIN

## R1 — Barrido de parámetros: método y hallazgos verificados

Método: claves sembradas en `prisma/seed.ts` (119) vs lecturas `getParametroSistema*`/`findUnique` en `src/` y `scripts/`. Los falsos positivos se descartaron verificando uso indirecto (template `ratelimit.${scope}.*` sí lee los suyos; `alerts.subscriptions.enabled` se usa en `email.ts:228`).

**Muertos verificados** (nadie los lee): `security.password_min_length`, `system.maintenance_mode`, `reportes.worker.max_retries`, `reportes.worker.stalled_threshold_minutes`.

**Hallazgo nuevo del barrido**: `security.jwt_ttl_hours` existe como parámetro pero `src/lib/auth.ts:20` tiene `const JWT_TTL = "24h"` QUEMADO — violación de ADR_004 que no estaba en ningún inventario.

## R2 — Dos bancos divergentes (D-094-5)

`CasoEval` (eval-runner) tiene 110 casos `fixtureVersion=1`; el banco de simulación tiene 200 casos `fixtureVersion=2` en JSON. No comparten fuente. No se re-siembra solo: requiere decisión de ZEUS sobre cuál es la fuente única (probablemente el banco de 200 alimentando ambos flujos).

## R3 — Apelaciones: documentar sin tocar

El código de apelaciones está vivo (flujo, pausa de visibilidad, job de vencimiento) pero el CEO lo sacó de alcance. La decisión pendiente (implementar bien / retirar / enmendar §1.6) es legal (Ley 1581, habeas data) — se registra como D-APE-1 y se actualiza N5/A3 sin tocar código.

## R4 — Documentación como código

MODELO.md (v1.2.0) e IaDocsPanel se actualizan con el MISMO flujo que el pipeline real post-092 (guardas previas antes de modelos, RAG tras dedup, embudo permisivo, decisivas/contexto, todas las conductas). La versión del doc registra el cambio (bloque de historial).
