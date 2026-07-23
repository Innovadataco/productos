# Checklist de requisitos — Spec 085

**Spec**: `specs/085-evaluacion-error-silencioso/spec.md` · **Verificado**: 2026-07-23

## D1 — Saneamiento

- [x] #43 corregida a SOLICITUD_MATERIAL con justificación (research.md §R1).
- [x] `secundariaEsperada` en #45/#27; secundaria cuenta como acierto (test).
- [x] Auditoría 3+ documentada: solo #43; resto confirmado (research.md §R3).

## D2 — Métricas

- [x] Errores silenciosos (confianza ≥ umbral_revision) — métrica principal, primero en UI (test).
- [x] Subestimaciones + severidad perdida (test).
- [x] ESPS con subestimaciones ×3 (test, incl. función pura).
- [x] Severidad desde `scoring.severity.*` (params sembrados; nada duplicado en código).
- [x] Accuracy visible pero no titular.

## D3 — Modelo por defecto

- [x] gemma2:27b vía parámetro (sin código); valor anterior y reversión en cierre.md.
- [x] Ranking recalculado y REPORTADO: gemma2:27b ya no es el mejor (empate con qwen2.5:32b) → decisión ZEUS+CEO, no se revierte solo.

## D4 — Banco

- [x] ≥200 casos (200), adversariales/limítrofes/multi-etiqueta, 12 categorías cubiertas.
- [x] `fuente` por caso + `fixtureVersion: 2`; comparador advierte mezcla de bancos.

## No negociable

- [x] Migración aditiva (columna nullable). Sin reset.
- [x] Severidad y modelo por defecto desde parámetros.
- [x] Tests: ESPS, silenciosos, multi-etiqueta.
- [x] Staging explícito solo de `002-2026-PROTECCION-INFANTIL/`.

## Cierre

- [x] Pregunta abierta #43 respondida (0 reportes reales).
- [x] Artefactos completos (spec, plan, research, data-model, contracts, quickstart, checklists, tasks, cierre).
- [ ] ACTA-VALIDACION de ZEUS (+ decisión sobre el default gemma2:27b vs qwen2.5:32b) — PENDIENTE.
