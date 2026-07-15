# Tasks: Módulo de Reportes Comunitarios

**Input**: Design documents from `/specs/02-reportes-comunitarios/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/reportes.md, quickstart.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Actualizar infraestructura para soportar pgvector, pg-boss, y modelo de IA local

- [ ] T001 Actualizar docker-compose.yml: imagen `pgvector/pgvector:pg16`, recrear contenedor db
- [ ] T002 Instalar dependencias: `pg-boss`, verificar compatibilidad con Prisma 5.22.0
- [ ] T003 [P] Verificar extensión pgvector en PostgreSQL: `CREATE EXTENSION vector;`
- [ ] T004 [P] Crear script `scripts/worker-reportes.mjs` (esqueleto del worker pg-boss)

**Checkpoint**: `docker compose ps` muestra db healthy, `npm install` sin conflictos, pgvector activo

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema Prisma, enums, seed de plataformas y parámetros — debe completarse antes de cualquier user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 [P] Agregar enums `CategoriaConducta`, `EstadoReporte` a `prisma/schema.prisma`
- [ ] T006 [P] Agregar modelo `Plataforma` a `prisma/schema.prisma`
- [ ] T007 [P] Agregar modelo `Reporte` a `prisma/schema.prisma`
- [ ] T008 [P] Agregar modelo `IdentificadorReportado` a `prisma/schema.prisma`
- [ ] T009 [P] Agregar modelo `ClasificacionIA` a `prisma/schema.prisma`
- [ ] T010 [P] Agregar modelo `CorreccionAdmin` a `prisma/schema.prisma`
- [ ] T011 [P] Agregar modelo `DatasetEntrenamiento` a `prisma/schema.prisma`
- [ ] T012 [P] Agregar modelo `EmbeddingReporte` con tipo `Unsupported("vector(768)")` a `prisma/schema.prisma`
- [ ] T013 Ejecutar `npx prisma migrate dev --name reportes_fase2`
- [ ] T014 Actualizar `prisma/seed.ts`: agregar seed de 10 plataformas y 7 parámetros de sistema nuevos
- [ ] T015 Ejecutar `npx prisma db seed` y verificar datos insertados

**Checkpoint**: `npx prisma generate` sin errores, seed ejecutado, tablas creadas con pgvector

---

## Phase 3: User Story 1 — Crear reporte sobre identificador de riesgo (Priority: P1) 🎯 MVP

**Goal**: Usuarios anónimos y autenticados pueden crear reportes con validaciones, número de seguimiento, y canales oficiales de denuncia visibles

**Independent Test**: Escenario A del quickstart: POST /api/reportes → 201 con numeroSeguimiento

### Implementation for User Story 1

- [ ] T016 [P] [US1] Crear `src/lib/validators.ts`: esquema Zod para validación de reporte (identificador, plataforma, texto ≥20 chars, fecha, ciudad, país)
- [ ] T017 [P] [US1] Crear `src/lib/reporte-utils.ts`: generador de número de seguimiento `RPT-XXXXXX`
- [ ] T018 [US1] Implementar `POST /api/reportes/route.ts`: crear reporte, validar, generar seguimiento, guardar en BD
- [ ] T019 [US1] Implementar lógica de deduplicación autenticada en `POST /api/reportes`: detectar email+identificador en 30 días
- [ ] T020 [US1] Crear página `src/app/reportar/page.tsx`: formulario con campos obligatorios y canales oficiales de denuncia visibles
- [ ] T021 [US1] Crear componente `src/components/modules/CanalesDenuncia.tsx`: Línea 141 ICBF, CAI Virtual, Te Protejo (sin scroll)
- [ ] T022 [US1] Crear componente `src/components/modules/ReporteForm.tsx`: formulario reutilizable con validación cliente
- [ ] T023 [US1] Implementar `GET /api/reportes/seguimiento/[numero]/route.ts`: consulta pública de estado por número de seguimiento

**Checkpoint**: Escenario A pasa (POST /api/reportes → 201), Escenario E parcial (duplicados autenticados detectados)

---

## Phase 4: User Story 2 — Clasificación automática de conductas por IA (Priority: P1)

**Goal**: Cada reporte nuevo se clasifica automáticamente por IA local (Ollama ornith:9b) con detección de PII, en <30 segundos

**Independent Test**: Escenario B del quickstart: reporte creado → worker procesa → estado CLASIFICADO o REQUIERE_ANONIMIZACION

### Implementation for User Story 2

- [ ] T024 [P] [US2] Crear `src/lib/ai/ollama-client.ts`: cliente HTTP para Ollama local con timeout, retry (max 3), y logging de latencia
- [ ] T025 [P] [US2] Crear `src/lib/ai/classifier.ts`: prompt unificado que solicita categoría, confianza, contiene_pii, pii_detectada
- [ ] T026 [P] [US2] Crear `src/lib/ai/embedder.ts`: generar embeddings con nomic-embed-text via Ollama
- [ ] T027 [US2] Crear `src/lib/queue.ts`: cliente pg-boss para publicar jobs en cola `reporte-procesamiento`
- [x] T028 [US2] Implementar `POST /api/reportes/procesar/route.ts`: endpoint interno para worker (clasificación + embedding + actualización de estado)
- [x] T029 [US2] Completar `scripts/worker-reportes.mjs`: consumir jobs de pg-boss, llamar a classifier + embedder, manejar errores con backoff
- [x] T030 [US2] Implementar lógica de estados en worker: PENDIENTE → PROCESANDO → CLASIFICADO / REVISION_MANUAL / POSIBLE_SPAM / REQUIERE_ANONIMIZACION
- [x] T031 [US2] Implementar detección de similitud para duplicados anónimos: embeddings + pgvector (cosine ≥ 0.92)
- [x] T032 [US2] Crear `src/lib/ai/similarity.ts`: búsqueda de reportes similares por embedding en PostgreSQL
- [x] T033 [US2] Implementar actualización de `IdentificadorReportado` tras clasificación: conteos, visibilidad condicional

**Checkpoint**: Escenario B pasa (worker clasifica reporte), build compila, tests pasan

---

## Phase 5: User Story 3 — Panel de administrador para revisar y corregir clasificaciones (Priority: P2)

**Goal**: Admin puede filtrar, revisar y corregir clasificaciones; correcciones alimentan dataset de entrenamiento

**Independent Test**: Escenario C y D del quickstart: admin lista reportes → corrige clasificación → dataset registrado

### Implementation for User Story 3

- [x] T034 [P] [US3] Implementar `GET /api/admin/reportes-revision/route.ts`: listado paginado con filtros (estado, categoría, plataforma, orden)
- [x] T035 [P] [US3] Crear página `src/app/dashboard/admin/page.tsx`: panel admin con tabla paginada y filtros
- [x] T036 [US3] Implementar `POST /api/admin/correcciones/route.ts`: corrección de clasificación, guardar original+corregida
- [x] T037 [US3] Implementar `PATCH /api/admin/reportes/[id]/anonimizar/route.ts`: eliminar PII, guardar textoOriginal en auditoría, actualizar texto
- [x] T038 [US3] Escribir en `DatasetEntrenamiento` tras corrección (texto anonimizado si aplica)
- [x] T039 [US3] Crear componente `src/components/modules/AdminReporteDetalle.tsx`: vista de detalle con clasificación, confianza, y controles de corrección/anonimización

**Checkpoint**: Escenarios C y D pasan, Escenario G pasa (anonimización PII)

---

## Phase 6: User Story 4 — Detección de duplicados y filtrado de spam (Priority: P2)

**Goal**: Duplicados autenticados bloqueados, duplicados anónimos detectados por IA, spam marcado

**Independent Test**: Escenario E completo del quickstart: segundo reporte autenticado → 429 DUPLICATE_REPORT; texto spam → POSIBLE_SPAM

### Implementation for User Story 4

- [ ] T040 [US4] Completar deduplicación autenticada: verificar en T019 funciona con respuesta 429 correcta
- [x] T041 [US4] Completar deduplicación anónima: verificar en T031 detecta similitud ≥ 0.92 y marca DUPLICADO con reporteOrigenId
- [ ] T042 [US4] Implementar filtrado de spam en worker: texto < 20 chars o sin contenido semántico → POSIBLE_SPAM
- [ ] T043 [US4] Crear `src/lib/duplicate-detector.ts`: consolidar lógica de deduplicación autenticada + anónima

**Checkpoint**: Escenario E pasa completo (autenticado y anónimo), build compila, tests pasan

---

## Phase 7: User Story 5 — Visibilidad condicional en consultas públicas (Priority: P3)

**Goal**: Identificadores solo visibles públicamente si superan umbral Y ratio de autenticados ≥ 50%

**Independent Test**: Escenario F del quickstart: identificador con 4 anónimos + umbral 3 → NO visible; 2 autenticados + 2 anónimos → visible

### Implementation for User Story 7

- [x] T044 [US5] Implementar lógica de visibilidad en `src/lib/visibility.ts`: calcular `esVisiblePublicamente` (umbral + min_authenticated_ratio)
- [x] T045 [US5] Implementar actualización automática de `IdentificadorReportado.esVisiblePublicamente` tras cada reporte clasificado/anonimizado
- [x] T046 [US5] Crear `GET /api/consulta/route.ts`: endpoint público para consultar identificador (respuesta estadística, sin culpabilidad) — texto aprobado: "Sin reportes registrados para este identificador."
- [x] T047 [US5] Verificar regla dura: reportes en REQUIERE_ANONIMIZACION NUNCA cuentan para umbral ni aparecen en consultas

**Checkpoint**: Escenario F pasa, build compila, tests pasan

---

## Phase 8: Ranking y Scoring de Identificadores (Priority: P2)

**Goal**: Calcular un score de riesgo por identificador basado en reportes acumulados, clasificaciones IA, recencia y ratio de autenticados; mostrar resultados diferenciados para usuarios anónimos y autenticados.

**Independent Test**: Usuario consulta un identificador con reportes previos y recibe score, nivel de riesgo, distribución geográfica y timeline.

### Backend

- [x] T054 [P] Crear `src/lib/ranking.ts`: calcular score 0-100, nivel de riesgo, categorías agregadas, timeline y distribución por país/ciudad. Parámetros del sistema definen pesos y umbrales.
- [x] T055 [P] Extender `prisma/seed.ts` con parámetros de ranking: `ranking.weight.count`, `ranking.weight.recency`, `ranking.weight.severity`, `ranking.weight.authenticated`, `ranking.recency_days`, `ranking.severity.*`, `ranking.threshold.low`, `ranking.threshold.medium`.
- [x] T056 [P] Extender `GET /api/consulta/route.ts`:
  - Anónimo: total de reportes, resumen textual, distribución país/ciudad/fecha.
  - Autenticado: score, nivel de riesgo, categorías agregadas, timeline completo.
  - Nunca exponer texto individual ni PII.

### Frontend

- [x] T057 [P] Actualizar `src/components/modules/ConsultaResultado.tsx`: mostrar score, nivel de riesgo, distribución geográfica, timeline y categorías agregadas.
- [x] T058 [P] Crear componentes SVG nativos para ranking: ranking, timeline y categorías se renderizan directamente en `ConsultaResultado.tsx` sin componentes separados.
- [x] T059 [P] Actualizar `src/app/page.tsx`: integrar nuevos componentes y mensajes diferenciados para usuarios anónimos vs autenticados.

### Tests

- [x] T060 [P] Tests de integración para `src/lib/ranking.ts`.
- [x] T061 [P] Tests E2E: consulta anónima básica y consulta autenticada con score.

**Checkpoint**: Endpoint devuelve score y datos agregados; UI muestra ranking sin exponer PII; tests pasan.

---

## Deudas técnicas cerradas

- [x] D1 [P] Ollama estable — healthcheck + retry 3x + backoff + DLQ en `scripts/worker-reportes.mjs`.
- [x] D2 [P] Supervisor worker — auto-restart si muere, max 5 intentos (`scripts/worker-supervisor.mjs`, `/api/health/worker`).
- [x] D3 [P] Prisma seed en `package.json` (`npx prisma db seed` funciona sin `tsx` manual).
- [x] D4 [P] Fix warning `MODULE_TYPELESS` renombrando `postcss.config.js` → `postcss.config.mjs`.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validación final, documentación, robustez

- [x] T048 [P] Ejecutar `npm run build` — debe compilar sin errores
- [x] T049 [P] Ejecutar `npm run test` — todos los tests deben pasar al 100%
- [x] T050 Ejecutar quickstart completo (escenarios A-G) con curl real, registrar salidas literales
- [x] T051 Actualizar `README.md` con instrucciones de Ollama, pm2 worker, y pgvector
- [x] T052 [P] Revisar que ningún log exponga textos de reportes, PII, o códigos de verificación
- [x] T053 [P] Verificar que `textoOriginal` nunca se expone en APIs públicas ni en dataset de entrenamiento
- [x] T062 [P] Exponer métricas de la cola pg-boss desde `/api/admin/estadisticas`: jobs en cola, activos, estancados, completados, fallidos.
- [x] T063 [P] Calcular latencia promedio de jobs completados/fallidos desde `pgboss.job`.
- [x] T064 [P] Calcular tasa de éxito del worker (% completados sobre terminados).
- [x] T065 [P] Mostrar métricas de la cola en el dashboard admin (`/dashboard/admin/estadisticas`).
- [x] T066 [P] Tests E2E para métricas de la cola de procesamiento.

**Checkpoint**: Build OK, tests 100%, quickstart validado, reglas duras verificadas, métricas de worker visibles

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends on | Bloquea |
|-------|-----------|---------|
| Phase 1 (Setup) | Nada | Phase 2 |
| Phase 2 (Foundational) | Phase 1 | Phase 3-7 |
| Phase 3 (US1) | Phase 2 | Nada (independiente) |
| Phase 4 (US2) | Phase 2 + US1 | Nada (independiente) |
| Phase 5 (US3) | Phase 2 + US2 | Nada (independiente) |
| Phase 6 (US4) | Phase 2 + US1 + US2 | Nada (independiente) |
| Phase 7 (US5) | Phase 2 + US1 + US2 | Nada (independiente) |
| Phase 9 (Polish) | Todas las anteriores | Nada |

### Within Each Phase

- Models/Enums antes de endpoints
- Endpoints antes de UI
- Core implementation antes de integración

### Parallel Opportunities

- Phase 1: T001-T004 pueden ejecutarse en paralelo
- Phase 2: T005-T012 (modelos Prisma) en paralelo; T013-T015 secuenciales
- Phase 3: T016-T017 (validators/utils) en paralelo con T021 (CanalesDenuncia)
- Phase 4: T024-T027 (AI libs + queue) en paralelo
- Phase 5: T034-T035 (API + UI listado) en paralelo

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Phase 1: Setup
2. Phase 2: Foundational (CRITICAL - blocks all stories)
3. Phase 3: US1 — Crear reporte
4. Phase 4: US2 — Clasificación IA
5. **STOP and VALIDATE**: Escenarios A, B, E del quickstart
6. Deploy/demo if ready

### Incremental Delivery

7. Phase 5: US3 — Panel admin
8. Phase 6: US4 — Duplicados/spam
9. Phase 7: US5 — Visibilidad condicional
10. Phase 8: Polish

---

## Notes

- Total tasks: 53
- Tasks por fase: P1=4, P2=11, P3=8, P4=10, P5=6, P6=4, P7=4, P8=6
- Tests: No se generaron tareas de test explícitas (no fueron solicitados en la spec)
- Reglas duras a verificar en cada fase:
  - Sin logueo de textos de reportes, PII, o códigos de verificación
  - `textoOriginal` nunca en APIs públicas
  - `requireEnv` obligatorio para todas las configuraciones
  - Sin fallbacks silenciosos de secretos