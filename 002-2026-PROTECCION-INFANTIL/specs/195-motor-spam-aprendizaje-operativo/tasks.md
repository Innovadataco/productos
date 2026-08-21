# Tareas: SPEC-195 — Motor SPAM + Aprendizaje operativo (002-PI-089)

## Fase 1: Rúbrica SPAM y parámetros (Bloques A, J)

- [ ] T001 [P1] `src/lib/ai/rubrica-semilla.ts`: añadir bloque SPAM con 5 preguntas.
- [ ] T002 [P1] `prisma/seed.ts`: añadir `scoring.severity.spam=0` al mapa de severidades.
- [ ] T003 [P1] `prisma/seed.ts`: añadir 9 parámetros nuevos en `monitoreoNuevos`.
- [ ] T004 [P2] `src/components/modules/ia/IaDocsPanel.tsx`: agregar `SPAM: "Spam"` a `CATEGORIA_LABELS` y ajustar descripción de RAG/caché.

## Fase 2: Caché semántico humano (Bloque B)

- [ ] T005 [P1] `src/lib/ai/cache-semantico.ts`: implementar `buscarClasificacionCache`.
- [ ] T006 [P1] `src/lib/ai/cache-semantico.test.ts`: tests unitarios de hit/miss/anti-abuso.
- [ ] T007 [P1] `src/lib/dal/services/reporte-processing/index.ts`: integrar caché después de guardas-previas, saltar motor en hit.
- [ ] T008 [P1] `src/app/api/reportes/procesar/route.test.ts` (o nuevo): test de caché hit en pipeline.

## Fase 3: Patrón coordinado (Bloque D)

- [ ] T009 [P1] `src/lib/ai/patron-coordinado.ts`: implementar `detectarPatronCoordinado`.
- [ ] T010 [P1] `src/lib/ai/patron-coordinado.test.ts`: tests de detección con 5 identificadores distintos.
- [ ] T011 [P1] `src/lib/dal/services/reporte-processing/index.ts`: integrar patrón coordinado después de motor/caché.
- [ ] T012 [P1] `src/lib/ai/patron-coordinado.ts` / `reporte-processing/index.ts`: registrar `IncidenteInfra` con señal `patron_coordinado:<hash-texto>` y detalle JSON.

## Fase 4: Flujo operativo integrado (Bloque E)

- [ ] T013 [P1] `src/app/api/admin/reportes/[id]/resolver-spam/route.ts`: endpoint con 3 decisiones.
- [ ] T014 [P1] `src/app/api/admin/reportes/[id]/resolver-spam/route.test.ts`: tests de integración.
- [ ] T015 [P1] Job SLA spam: detectar POSIBLE_SPAM vencidos y alertar admin (reusar job de monitoreo).

## Fase 5: Panel de análisis (Bloque F)

- [ ] T016 [P1] `src/app/api/admin/spam/analitica/route.ts`: endpoint de métricas y distribución.
- [ ] T017 [P1] `src/app/api/admin/spam/analitica/route.test.ts`: tests de integración.
- [ ] T018 [P1] `src/components/modules/SpamRevisionPanel.tsx`: rediseñar como panel de análisis.
- [ ] T019 [P2] `src/app/dashboard/admin/spam/page.tsx`: adaptar a nuevo modo análisis o crear `/spam/analitica`.
- [ ] T020 [P2] Botón "Sugerir al banco": generar JSONL compatible con `fixtures/banco-curado-v2.jsonl`.

## Fase 6: Retroalimentación y notificación (Bloques G, H)

- [ ] T021 [P2] `src/lib/dal/services/reporte-processing/...` / endpoint: asegurar DatasetEntrenamiento + EmbeddingDataset en `es_spam` y `corregir`.
- [ ] T022 [P2] `src/lib/email/notificacion-spam.ts`: servicio de notificación al denunciante.
- [ ] T023 [P2] `src/lib/email/notificacion-spam.test.ts`: test con mock de Resend.
- [ ] T024 [P2] `src/lib/reporte-estados-usuario.ts`: añadir `DADO_DE_BAJA` → "Cerrado" / "muted".

## Fase 7: Documentación y cierre (Bloque I)

- [ ] T025 [P2] Actualizar `MODELO-DE-CLASIFICACION.md` en repo gestión (§5, §8, §9, §14).
- [ ] T026 [P1] Actualizar `.specify/feature.json` y `specs/README.md` (al final, con cuidado de paralelas).
- [ ] T027 [P1] Gate local completo: tsc, lint, arch:check, tests, build.
- [ ] T028 [P1] Commit único + push a `work/002-pi-089`.
