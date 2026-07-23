# Tasks — Spec 085: Evaluación por error silencioso y modelo por defecto (ADR_006)

## D1 — Sanear el banco

- [x] T001 #43 → SOLICITUD_MATERIAL (justificación research.md §R1).
- [x] T002 `secundariaEsperada` en #45 y #27; regla primaria ≥ severidad (7 swaps en lotes nuevos).
- [x] T003 Acierto multi-etiqueta en métricas y comparador (test incluido).
- [x] T004 Auditoría 3+: solo #43; resto confirmado (research.md §R3).

## D2 — Métricas

- [x] T005 `erroresSilenciosos` (confianza ≥ umbral_revision) — métrica principal en UI.
- [x] T006 `subestimaciones` + `severidadPerdida`.
- [x] T007 `esps` (Σ|Δsev| silenciosos, subestimación ×3) + función pura testeada.
- [x] T008 Severidad desde `scoring.severity.*` (`obtenerSeveridades`, params sembrados ×12).
- [x] T009 UI: seguridad primero (detalle + comparador); accuracy deja de ser titular.

## D3 — Modelo por defecto

- [x] T010 `reportes.classification_model = gemma2:27b` (param vivo + seed). Reversión documentada.

## D4 — Banco ≥200

- [x] T011 150 casos nuevos (2 lotes, adversariales/limítrofes/multi-etiqueta) validados.
- [x] T012 Formato `{fixtureVersion: 2, casos}` + `fuente` por caso; parser retrocompatible; advertencia de mezcla en comparador.

## Cierre

- [x] T013 Pregunta abierta #43 respondida (0 reportes reales) + recomputo 5 modelos (research.md §R4: RANKING CAMBIA, reportado).
- [x] T014 Tests (ESPS, silenciosos, multi-etiqueta) + gate + dev-restart.
- [x] T015 Artefactos completos + commit/push con staging explícito del 002.
