# Tasks — Spec 092: Motor — lógica corregida y validada

- [x] T001 US1: `PreguntaRubrica.tipo` (decisiva/contexto) + semilla reestructurada (13 decisivas, 10 categorías) + tolerancia a formato viejo.
- [x] T002 US1: motor — cumple solo si TODAS las decisivas cumplidas (verificación determinista) + prompt reforzado + tests.
- [x] T003 US3: sin principal por gravedad — `categoriasPresentes` es el resultado; `categoria` = mayor % solo por schema; tests.
- [x] T004 US4: `guardas-previas.ts` (ráfaga+doxing cortan antes de modelos) + RAG después de dedup + orden del pipeline.
- [x] T005 US5: `reportes.spam.min_text_length` leído por backend (route) y front (hook `useMinTextoReporte`); Zod solo no-vacío; test existente 17/17.
- [ ] T006 US2: medición del embudo (`scripts/medir-embudo-092.ts`) — corriendo en background.
- [ ] T007 US6: re-corrida banco 200 con la lógica corregida — corriendo en background + análisis de fallos + etiquetas sospechosas.
- [ ] T008 Gate completo + dev-restart + docs + commit/push (staging explícito 002).
