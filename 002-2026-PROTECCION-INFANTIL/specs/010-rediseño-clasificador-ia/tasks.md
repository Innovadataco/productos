# Tasks: Rediseño del Clasificador IA

**Input**: Design documents from `/specs/010-rediseño-clasificador-ia/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Orden de implementación**: F0.5 → F1 → F2 → F3 → F4 → F5 → F6 → F7

**Regla de no-regresión**: después de cada fase que cambie comportamiento, correr el eval completo sobre `scripts/eval-fixture.json`. Si `error_silencioso` empeora vs. la fase anterior, detenerse y reportar antes de continuar.

## Phase 1: F0.5 — Fix de anonimización en correcciones

**Goal**: Garantizar que `DatasetEntrenamiento.texto` siempre sea la versión anonimizada antes de que entren correcciones reales.

**Independent Test**: Crear reporte con PII de NNA, procesarlo, corregirlo como admin y verificar que el registro del dataset no contiene la PII original.

- [ ] T001 Audit `src/app/api/admin/correcciones/route.ts` para identificar el punto de inserción en `DatasetEntrenamiento` y decidir estrategia de anonimización
- [ ] T002 Implementar anonimización síncrona en `src/app/api/admin/correcciones/route.ts` antes de insertar en `DatasetEntrenamiento` cuando `textoOriginal` sea null y `contienePii === true`
- [ ] T003 Manejar fallback asíncrono: si Ollama falla, insertar con `textoAnonimizado=false` y encolar backfill
- [ ] T004 Crear test en `tests/` o script de validación que cubra: reporte con PII → corrección admin → DatasetEntrenamiento sin PII
- [ ] T005 Correr `npm run test` y `npm run build`; asegurar que pasan
- [ ] T006 Ejecutar eval sobre fixture de 110 (este punto aún no cambia clasificación, solo valida que no se rompa el pipeline)

**Checkpoint**: F0.5 listo. Ningún registro futuro de `DatasetEntrenamiento` puede contener PII sin anonimizar.

---

## Phase 2: F1 — Structured outputs nativos + barrido terminológico

**Goal**: Eliminar parseo frágil de JSON y preparar el modelo para la taxonomía ampliada.

**Independent Test**: Procesar reportes y verificar que `ClasificacionIA.rawResponse` contiene JSON parseable directamente sin regex, con categorías dentro del enum extendido.

- [ ] T007 [P] Ampliar enum `CategoriaConducta` en `prisma/schema.prisma` con las 4 categorías LATAM
- [ ] T008 [P] Generar migración Prisma con `prisma migrate dev`
- [ ] T009 Modificar `src/lib/ai/ollama-client.ts` para aceptar parámetro `format` (JSON schema) y propagarlo a `/api/generate`
- [ ] T010 Definir JSON schema de clasificación con 11 categorías en `src/lib/ai/classifier.ts`
- [ ] T011 Reescribir `src/lib/ai/classifier.ts`: eliminar regex match, parsear respuesta estructurada, validar con Zod, mantener fallback a REVISION_MANUAL solo por red/timeout
- [ ] T012 Actualizar prompt de clasificación con taxonomía extendida y fronteras excluyentes (ver P1: SOLICITUD_MATERIAL vs COMPARTIMIENTO_SEXUAL)
- [ ] T013 Incluir 2-3 ejemplos contrastivos de la frontera SOLICITUD_MATERIAL / COMPARTIMIENTO_SEXUAL / EXTORSION / DIFUSION_NO_CONSENTIDA en el prompt
- [ ] T014 [P] Realizar barrido terminológico: reemplazar "pornografía infantil" por MASNNA, "menor" por NNA donde aplique, eliminar afirmaciones de delito en prompts, UI, correos y docs
- [ ] T015 Actualizar tipos TypeScript y validadores de Zod que referencien `CategoriaConducta`
- [ ] T016 [P] Actualizar fixture `scripts/eval-fixture.json` si se detectan ambigüedades en las fronteras
- [ ] T017 Correr `npm run test` y `npm run build`
- [ ] T018 Ejecutar eval sobre fixture de 110 y guardar `eval-results/F1-{timestamp}.json`
- [ ] T019 Reportar matriz de confusión del par SOLICITUD_MATERIAL / COMPARTIMIENTO_SEXUAL (P1)

**Checkpoint**: F1 listo. Parseo estructurado funciona, taxonomía extendida disponible, terminología actualizada.

---

## Phase 3: F2 — Separar clasificación y detección de PII

**Goal**: Tareas simples en vez de multitarea; redundancia en PII con capa determinística + LLM.

**Independent Test**: Validar con textos que contienen y no contienen PII de NNA; recall debe ser >=99% y no debe marcarse el identificador del agresor como PII.

- [ ] T020 Crear `src/lib/ai/pii-detector.ts` con capa determinística (patrones compartidos con DOXING: direcciones, colegios, teléfono personal de NNA, doxing)
- [ ] T021 Implementar capa LLM en `src/lib/ai/pii-detector.ts` con prompt dedicado y structured output
- [ ] T022 Combinar resultados: unión de capa determinística y LLM (`contienePii = A OR B`)
- [ ] T023 Actualizar `src/lib/ai/classifier.ts` para remover instrucciones de PII del prompt de clasificación
- [ ] T024 Modificar `src/app/api/reportes/procesar/route.ts` para llamar PII y clasificación en paralelo con `Promise.all`
- [ ] T025 Agregar tests de PII en `tests/` (textos con nombres, colegios, direcciones; textos con solo identificador de agresor)
- [ ] T026 Correr `npm run test` y `npm run build`
- [ ] T027 Ejecutar eval sobre fixture de 110 y guardar `eval-results/F2-{timestamp}.json`
- [ ] T028 Verificar regla de no-regresión: `error_silencioso` no debe empeorar vs F1

**Checkpoint**: F2 listo. PII detectado de forma redundante; clasificación ya no multitarea.

---

## Phase 4: F3 — Multi-label con score por categoría

**Goal**: Textos mixtos dejan de caer en OTRO; categoría principal + secundarias.

**Independent Test**: Procesar texto con múltiples conductas y verificar que `categoriasSecundarias` incluye las categorías esperadas.

- [ ] T029 Migración Prisma: agregar `ClasificacionIA.categoriasSecundarias Json?` y `ClasificacionIA.posibleAgresorPar Boolean @default(false)`
- [ ] T030 Crear parámetro `reportes.classification.min_score_categoria` en `ParametroSistema` con valor 0.3
- [ ] T031 Actualizar JSON schema de clasificación a multi-label: array `{ categorias: [{ categoria, score }], posible_agresor_par }`
- [ ] T032 Modificar `src/lib/ai/classifier.ts` para devolver categoría principal, secundarias y `posibleAgresorPar`
- [ ] T033 Actualizar prompt de clasificación a multi-label
- [ ] T034 Verificar impacto aguas abajo: `src/lib/scoring.ts` y `src/lib/visibility.ts` usan categoría principal
- [ ] T035 Actualizar `src/app/api/admin/correcciones/route.ts` para aceptar corrección de categoría principal
- [ ] T036 [P] Actualizar UI admin para mostrar categorías secundarias y `posibleAgresorPar`
- [ ] T037 Correr `npm run test` y `npm run build`
- [ ] T038 Ejecutar eval sobre fixture de 110 y guardar `eval-results/F3-{timestamp}.json`
- [ ] T039 Verificar regla de no-regresión vs F2

**Checkpoint**: F3 listo. Multi-label operativo; scoring/visibilidad intactos.

---

## Phase 5: F4 — Self-consistency (voto por mayoría)

**Goal**: Reemplazar confianza auto-reportada por acuerdo empírico entre múltiples votos.

**Independent Test**: Procesar reporte con n=5 votos y verificar que `confianza === votosGanador / 5`.

- [ ] T040 Migración Prisma: agregar `ClasificacionIA.votos Json?`
- [ ] T041 Crear parámetros en `ParametroSistema`: `reportes.classification.n_votos` (5), `reportes.classification.temperature` (0.7), `reportes.classification.umbral_revision` (0.6)
- [ ] T042 Modificar `src/lib/ai/ollama-client.ts` para aceptar `options.temperature`
- [ ] T043 Implementar `clasificarConVotos` en `src/lib/ai/classifier.ts`: n llamadas en paralelo (`Promise.all`), categoría ganadora por mayoría
- [ ] T044 Calcular confianza real como `votosGanador / n`; usarla en `determineEstado`
- [ ] T045 Guardar votos individuales en `ClasificacionIA.votos`
- [ ] T046 Documentar `OLLAMA_NUM_PARALLEL=2` en `quickstart.md`; implementar votos en tandas de 2-3 simultáneas (no 5 de golpe)
- [ ] T047 Correr `npm run test` y `npm run build`
- [ ] T048 Ejecutar eval sobre fixture de 110 y guardar `eval-results/F4-{timestamp}.json`
- [ ] T049 Reportar p50/p95 y comparar latencia vs F3 (P3)
- [ ] T050 Verificar regla de no-regresión vs F3

**Checkpoint**: F4 listo. Confianza por votos; latencia documentada.

---

## Phase 6: F5 — RAG sobre correcciones de admin

**Goal**: El sistema aprende de cada corrección humana mediante recuperación por similitud.

**Independent Test**: Agregar corrección para un texto y luego clasificar uno similar; verificar que el ejemplo aparece en el prompt.

- [ ] T051 Migración Prisma: crear modelo `EmbeddingDataset` con vector(768); agregar `DatasetEntrenamiento.textoAnonimizado Boolean @default(false)` y relación 1:1
- [ ] T052 [P] Backfill: crear `scripts/backfill-embeddings-dataset.ts` para generar embeddings de registros existentes
- [ ] T053 Crear `src/lib/ai/retrieval.ts` con `buscarEjemplosSimilares(vector, k)` usando similitud coseno
- [ ] T054 Crear parámetro `reportes.classification.rag_top_k` en `ParametroSistema` con valor 3
- [ ] T055 Modificar `src/app/api/admin/correcciones/route.ts` para generar embedding del texto anonimizado al insertar corrección
- [ ] T056 Modificar `src/app/api/reportes/procesar/route.ts` para reutilizar el embedding del reporte y llamar a retrieval
- [ ] T057 Actualizar `src/lib/ai/classifier.ts` para construir prompt dinámico con ejemplos RAG
- [ ] T058 Implementar exclusión del propio registro en modo eval (similitud >0.98) para evitar data leakage
- [ ] T059 Correr `npm run test` y `npm run build`
- [ ] T060 Ejecutar eval sobre fixture de 110 y guardar `eval-results/F5-{timestamp}.json`
- [ ] T061 Verificar regla de no-regresión vs F4

**Checkpoint**: F5 listo. Correcciones humanas disponibles como contexto.

---

## Phase 7: F6 — Cascada de desempate con modelo grande

**Goal**: Casos de baja confianza escalan a modelo más capaz antes de rendirse a revisión manual.

**Independent Test**: Configurar modelo grande, enviar texto ambiguo y verificar `usoCascada === true`.

- [ ] T062 Migración Prisma: agregar `ClasificacionIA.usoCascada Boolean @default(false)` y `ClasificacionIA.modeloCascada String?`
- [ ] T063 Crear parámetros en `ParametroSistema`: `reportes.classification.modelo_desempate` (vacío = deshabilitado), `reportes.classification.umbral_desempate` (0.6)
- [ ] T064 Modificar `src/lib/ai/ollama-client.ts` para soportar `keep_alive` corto
- [ ] T065 Implementar lógica de cascada en `src/lib/ai/classifier.ts`: si votos < umbral y modelo configurado → llamar modelo grande
- [ ] T066 Crear prompt de desempate con distribución de votos previos
- [ ] T067 [P] Actualizar `quickstart.md` con 2-3 candidatos de modelo grande (~27-32B Q4), RAM estimada y comandos `ollama pull`
- [ ] T068 Correr `npm run test` y `npm run build`
- [ ] T069 Ejecutar eval sobre fixture de 110 con modelo base (F6 deshabilitado) y guardar `eval-results/F6-disabled-{timestamp}.json`
- [ ] T070 (Opcional, solo si usuario instala modelo grande) ejecutar eval con F6 habilitado y guardar `eval-results/F6-enabled-{timestamp}.json`

**Checkpoint**: F6 listo. Cascada implementada pero deshabilitada por defecto.

---

## Phase 8: F7 — Keywords de alto riesgo + métricas

**Goal**: Red de seguridad determinística y observabilidad de calidad del clasificador.

**Independent Test**: Enviar reporte OTRO/REVISION_MANUAL con términos críticos; verificar prioridad alta en cola y métricas en dashboard.

- [ ] T071 Migración Prisma: agregar `Reporte.prioridadAlta Boolean @default(false)` y `Reporte.keywordsDetectadas String[]`
- [ ] T072 Crear parámetro `reportes.keywords.riesgo` en `ParametroSistema` (JSON con diccionario)
- [ ] T073 Crear `src/lib/ai/keywords-riesgo.ts` con diccionario estático auditado en git, incluyendo términos de sextorsión, deepfake/nudificación, difusión y doxing
- [ ] T074 Modificar `src/app/api/reportes/procesar/route.ts` para aplicar keywords post-clasificación cuando estado sea REVISION_MANUAL o categoría OTRO
- [ ] T075 Actualizar `src/lib/email.ts` para indicar prioridad alta sin incluir texto ni términos
- [ ] T076 Extender `src/app/api/admin/estadisticas/route.ts` con métricas: precision por categoría, `precision_auto_clasificados`, `error_silencioso`, tasa REVISION_MANUAL, tasa cascada, distribución de confianza
- [ ] T077 Actualizar componente de cola de revisión admin para ordenar por prioridad alta y mostrar keywords detectados + posibleAgresorPar
- [ ] T078 Correr `npm run test` y `npm run build`
- [ ] T079 Ejecutar eval sobre fixture de 110 y guardar `eval-results/F7-{timestamp}.json`
- [ ] T080 Verificar regla de no-regresión vs F5 (o F6 si se habilitó)

**Checkpoint**: F7 listo. Keywords y métricas operativas.

---

## Phase 9: Reporte final consolidado

**Goal**: Documentar el delta baseline → F1 → F3 → F4 → F5 (→ F6 si aplica) → F7.

- [ ] T081 Generar reporte consolidado `eval-results/CONSOLIDATED-{timestamp}.md` con tablas de métricas globales y segmentadas limpio/ruidoso
- [ ] T082 Incluir interpretación del baseline: 40/110 ejemplos son de categorías que el clasificador original no conoce (techo teórico ~64% accuracy) (P2)
- [ ] T083 Incluir análisis de latencia p50/p95 por fase y trade-off votos/latencia (P3)
- [ ] T084 Revisar que todos los archivos modificados cumplen R1-R7
- [ ] T085 Commit final y resumen al usuario

---

## Dependencies & Execution Order

```text
F0.5 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → Reporte final
```

Cada fase depende de la anterior. Dentro de cada fase, las tareas marcadas `[P]` pueden ejecutarse en paralelo, pero el checkpoint de eval debe esperar a que todas terminen.
