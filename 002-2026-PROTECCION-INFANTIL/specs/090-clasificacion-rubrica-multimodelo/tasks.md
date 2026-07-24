# Tasks — Spec 090: Clasificación por rúbrica multi-etiqueta + multi-modelo

## US1 — Motor

- [x] T001 Migración aditiva `clasificacion_rubrica_votos` (matriz categoría×modelo×0/1 + preguntas).
- [x] T002 Semilla de preguntas (10 categorías, 3-4 estrictas c/u) + params `ia.rubrica.*` (seed).
- [x] T003 Motor `src/lib/ai/rubrica.ts`: embudo → N modelos secuencial → % por categoría → umbral de presencia → desacuerdo a revisión.
- [x] T004 Persistencia de la matriz + `%` en ClasificacionIA (confianza = % principal).
- [x] T005 Tests: matriz 0/1, %, umbral sube/baja, desacuerdo→revisión, plantilla (8/8).

## US2 — Principal pública

- [x] T006 Principal = mayor gravedad entre presentes; ninguna/OTRO → REVISION_MANUAL; 089 intacta (regresión 799+ tests).
- [x] T007 Flag `ia.rubrica.enabled` (rollback a legacy por parámetro).

## US3 — Mis reportes

- [x] T008 Endpoint privado (403 no dueño) con matriz + % + análisis plantilla + tests (5/5).
- [x] T009 Vista `/dashboard/mis-reportes/[id]` con tabla y análisis; sin "% de riesgo" (tests 4/4).

## US3-bis — Configuración

- [x] T010 Módulo `ia_rubrica` en catálogo + seed.
- [x] T011 Endpoints GET/PUT preguntas/PATCH config con guard + AuditLog + tests (13/13).
- [x] T012 Tab "Rúbrica" en IA_TABS + `RubricaTab` (CRUD por categoría + config).

## US3-ter / US4

- [x] T013 IaDocsPanel al flujo real (deduplicación + rúbrica, sin "moda").
- [x] T014 `scripts/eval-rubrica-banco.ts` + corrida banco 200 en background; sanity 6/6 aciertos.
- [x] T015 Gate + dev-restart + docs + commit/push (staging explícito 002).
