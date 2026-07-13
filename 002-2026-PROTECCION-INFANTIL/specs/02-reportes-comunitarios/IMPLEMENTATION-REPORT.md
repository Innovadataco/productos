# Reporte de Implementación — Módulo de Reportes Comunitarios

**Fecha:** 2026-07-13
**Branch:** `feature/001-scaffolding`
**Commits:** 10+ commits incrementales

---

## Resumen de Fases Implementadas

| Fase | User Story | Estado | Archivos Clave |
|------|-----------|--------|----------------|
| Fase 1 | Setup infraestructura | ✅ | `docker-compose.yml`, `prisma/schema.prisma` |
| Fase 2 | Schema, enums, parámetros | ✅ | `prisma/schema.prisma`, `prisma/seed.ts` |
| Fase 3 | US1 — Crear reporte | ✅ | `src/app/api/reportes/route.ts`, `src/lib/validators.ts` |
| Fase 4 | US2 — Clasificación IA | ✅ | `src/lib/ai/`, `src/app/api/reportes/procesar/route.ts`, `scripts/worker-reportes.mjs` |
| Fase 5 | US3 — Panel admin correcciones | ✅ | `src/app/api/admin/reportes-revision/route.ts`, `src/app/api/admin/correcciones/route.ts` |
| Fase 6 | US4 — Duplicados y spam | ✅ | `src/lib/rate-limit.ts` (actualizado en `src/app/api/reportes/route.ts`) |
| Fase 7 | US5 — Visibilidad condicional | ✅ | `src/app/api/consulta/route.ts` |
| Fase 8 | Polish (UI, tests, anonimización, métricas) | ❌ NO EJECUTADA | Ver sección "Fase 8 (Polish)" |

---

## Endpoints Implementados

### Públicos (sin autenticación)
- `POST /api/reportes` — Crear reporte anónimo o autenticado
- `GET /api/reportes/seguimiento/:numero` — Consultar estado de reporte
- `GET /api/consulta?identificador=...&plataforma=...` — Consulta pública de identificador

### Protegidos (admin)
- `GET /api/admin/reportes-revision` — Listar reportes pendientes de revisión
- `POST /api/admin/correcciones` — Aplicar corrección de clasificación

### Worker
- `POST /api/reportes/procesar` — Procesamiento interno (llamado por worker pg-boss)

---

## Características Implementadas

### US1 — Crear Reporte
- ✅ Validación con Zod (identificador, plataforma, texto, fecha, ciudad, país)
- ✅ Generación de número de seguimiento único (base36, 6 chars)
- ✅ Deduplicación: mismo usuario + identificador en 30 días
- ✅ Soporte anónimo y autenticado
- ✅ Integración con cola pg-boss para procesamiento asíncrono
- ✅ Página `/reportar` con formulario y canales oficiales de denuncia

### US2 — Clasificación IA
- ✅ Cliente Ollama con logging de métricas (latencia, tokens)
- ✅ Clasificador con 7 categorías de conducta + detección de PII
- ✅ Estados derivados: `CLASIFICADO`, `REVISION_MANUAL`, `REQUIERE_ANONIMIZACION`
- ✅ Generación de embeddings vía Ollama (sin fallback — si falla, el job se reintenta)
- ✅ Worker pg-boss con retry automático (max 3 intentos, backoff exponencial 30s/60s/120s)
- ✅ Idempotencia: no reprocesa reportes ya en estado final
- ✅ Campo `processingError` en `Reporte` para trazabilidad de fallos

### US3 — Panel Admin Correcciones
- ✅ Listado de reportes en estados `REVISION_MANUAL`, `REQUIERE_ANONIMIZACION`, `POSIBLE_SPAM`
- ✅ Corrección de categoría con registro de auditoría (`CorreccionAdmin`)
- ✅ Actualización de `DatasetEntrenamiento` para retroalimentación del modelo
- ✅ Solo accesible por `ADMIN_PLATAFORMA`

### US4 — Duplicados y Spam
- ✅ Rate limiting en memoria: 5 reportes/hora/IP para anónimos
- ✅ Detección heurística de spam (longitud, patrones, contexto)
- ✅ Reportes spam marcados como `POSIBLE_SPAM` sin procesar IA

### US5 — Visibilidad Condicional
- ✅ Umbral configurable de reportes (`visibility.report_threshold`, default: 3)
- ✅ Ratio mínimo de autenticados (`visibility.min_authenticated_ratio`, default: 0.5)
- ✅ Consulta pública con distribución agregada (ciudad, país, mes)
- ✅ **Nunca** expone etiquetas de culpabilidad ni textos individuales

---

## Fase 8 (Polish)

**Estado: NO EJECUTADA.**

La Fase 8 (Polish) no se implementó en este ciclo. Los siguientes items quedan pendientes para iteraciones futuras:

- [ ] UI de panel admin (tabla de reportes, filtros, acciones masivas)
- [ ] Tests automatizados de integración (reportes, worker, embeddings)
- [ ] Anonimización automática de PII en textos (reemplazo de nombres, colegios, etc.)
- [ ] Métricas y dashboard (cola estancada, latencia promedio, tasa de éxito/fracaso)

---

## Fix Crítico: Eliminación de Fallback Silencioso en Embeddings

**Problema identificado en auditoría:** `src/lib/ai/embedder.ts` contenía `fallbackVector()`, una función que generaba vectores pseudoaleatorios determinísticos (768 dimensiones a partir del hash del texto) cuando Ollama fallaba. Estos vectores inventados se guardaban en pgvector como si fueran embeddings reales, corrompiendo silenciosamente la detección de duplicados por similitud.

**Fix aplicado:**
- `fallbackVector()` eliminada por completo
- `generarEmbedding()` ahora lanza un `Error` explícito cuando Ollama responde con error HTTP o con embedding vacío/mal formado
- El job de pg-boss reintenta automáticamente (max 3 intentos con backoff exponencial: 30s → 60s → 120s)
- Si agota reintentos, el reporte queda en estado `REVISION_MANUAL` con `processingError` registrado
- **NUNCA** se guarda un vector inventado en la base de datos

Archivos modificados:
- `src/lib/ai/embedder.ts` — eliminación de fallback, lanzamiento de errores explícitos
- `src/app/api/reportes/procesar/route.ts` — embedding obligatorio (no try/catch silencioso), guardado de `processingError` en catch global
- `src/lib/queue.ts` — configuración de retry (`retryLimit: 3`, `retryDelay: 30`, `retryBackoff: true`)
- `scripts/worker-reportes.mjs` — logging de número de intento (`retryCount`)
- `prisma/schema.prisma` — campo `processingError String? @db.Text` agregado a `Reporte`

---

## DECISION-PENDIENTE-PO

| ID | Tarea | Descripción | Estado |
|----|-------|-------------|--------|
| T046 | US5 | Texto exacto de respuesta cuando no hay datos suficientes en consulta pública | **PENDIENTE** |

La implementación actual responde con `{"reportes":0,"esVisible":false}` cuando no hay datos. El PO debe definir si se requiere un mensaje descriptivo adicional (ej: "No hay información suficiente sobre este identificador") y en qué idiomas.

---

## Evidencia de Build y Tests

### `npm run build`

```text
> 002-2026-proteccion-infantil@0.1.0 build
> next build

▲ Next.js 16.2.10 (Turbopack)
- Environments: .env

  Creating an optimized production build ...
✓ Compiled successfully in 764ms
  Running TypeScript  ...  Finished TypeScript in 1061ms
✓ Finished TypeScript in 1061ms
  Collecting page data using 13 workers  ...  in 582ms
✓ Collecting page data using 13 workers in 582ms
  Generating static pages using 13 workers (0/22)  [    ]✓ Generating static pages using 13 workers (22/22) in 105ms
  Finalizing page optimization  ...  in 8ms
✓ Finalizing page optimization in 8ms

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/admin/correcciones
├ ƒ /api/admin/reportes-revision
├ ƒ /api/auth/login
├ ƒ /api/auth/logout
├ ƒ /api/auth/register
├ ƒ /api/auth/verificar/completar
├ ƒ /api/auth/verificar/solicitar
├ ƒ /api/auth/verificar/validar
├ ƒ /api/config/parametros
├ ƒ /api/config/parametros/[clave]
├ ƒ /api/config/parametros/publicos
├ ƒ /api/consulta
├ ƒ /api/me
├ ƒ /api/reportes
├ ƒ /api/reportes/procesar
├ ƒ /api/reportes/seguimiento/[numero]
├ ○ /dashboard
├ ○ /dashboard/configuracion
├ ○ /login
├ ○ /registro
└ ○ /reportar


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

**Resultado:** ✅ Build exitoso, 0 errores TypeScript, 0 errores de compilación.

### `npm run test`

```text
> 002-2026-proteccion-infantil@0.1.0 test
> vitest run


 RUN  v3.2.7 /Users/idc/productos/INNOVADATACO/002-2026-PROTECCION-INFANTIL

 ❯ src/app/api/config/parametros/route.test.ts [queued]

 Test Files 0 passed (4)
      Tests 0 passed (0)
   Start at 10:58:53
   Duration 404ms
 ✓ src/lib/errors.test.ts (3 tests) 1ms
 ✓ src/lib/config-cache.test.ts (4 tests) 1ms

 ❯ src/app/api/config/parametros/route.test.ts 1/2
 ❯ src/lib/auth.test.ts 0/1

 Test Files 2 passed (4)
      Tests 8 passed (10)
   Start at 10:58:53
   Duration 504ms
 ✓ src/app/api/config/parametros/route.test.ts (2 tests) 37ms

 ❯ src/lib/auth.test.ts 0/1

 Test Files 3 passed (4)
      Tests 9 passed (10)
   Start at 10:58:53
   Duration 910ms
 ✓ src/lib/auth.test.ts (1 test) 595ms
   ✓ auth utils > hashes and verifies password  595ms

 Test Files  4 passed (4)
      Tests  10 passed (10)
   Start at  10:58:53
   Duration  1.11s (transform 63ms, setup 35ms, collect 152ms, tests 635ms, environment 1.21s, prepare 138ms)
```

**Resultado:** ✅ 4/4 test files passed, 10/10 tests passed.

---

## Evidencia Git

### 1. `git log --oneline -5`

```text
f338b02 (HEAD -> feature/001-scaffolding, origin/feature/001-scaffolding) docs(002-02): Reporte de implementación completo — Fases 1-7
385ef33 impl(002-02) Fase 7: US5 — visibilidad condicional, consulta pública con umbral
96f9508 impl(002-02) Fase 6: US4 — rate limiting, detección spam, deduplicación
23bcc0c impl(002-02) Fase 5: US3 — panel admin, correcciones, dataset entrenamiento
b3181b2 impl(002-02) Fase 4: US2 — clasificación IA completa (Ollama, PII, embeddings, worker, cola)
```

### 2. `git status`

```text
On branch feature/001-scaffolding
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   prisma/schema.prisma
	modified:   scripts/worker-reportes.mjs
	modified:   src/app/api/reportes/procesar/route.ts
	modified:   src/lib/ai/embedder.ts
	modified:   src/lib/queue.ts

no changes added to commit (use "git add" and/or "git commit -a")
```

### 3. `git diff --stat`

```text
 .../prisma/schema.prisma                         |  1 +
 .../scripts/worker-reportes.mjs                  | 13 +++-
 .../src/app/api/reportes/procesar/route.ts       | 72 +++++++++++---------
 .../src/lib/ai/embedder.ts                       | 58 ++++------------
 002-2026-PROTECCION-INFANTIL/src/lib/queue.ts    |  8 ++-
 5 files changed, 70 insertions(+), 82 deletions(-)
```

---

## Pruebas Realizadas

### Escenario A: Reporte válido
```bash
curl -X POST /api/reportes -d '{"identificador":"+573001234567","plataforma":"whatsapp","texto":"...","fechaIncidente":"2026-07-10T14:30:00Z","ciudad":"Bogotá","pais":"Colombia"}'
# → HTTP 201, {reporte: {id, numeroSeguimiento, estado: "PENDIENTE"}}
```

### Escenario B: Reporte con PII
- Texto: "Este número contactó a mi hija **María** del **colegio San José**..."
- Clasificación IA: `OFRECIMIENTO_REGALOS`, confianza 0.95
- PII detectada: `{María, San José}`
- Estado: `REQUIERE_ANONIMIZACION`

### Escenario C: Rate limiting
- 6 reportes anónimos desde misma IP → HTTP 429 con `retryAfter`

### Escenario D: Consulta pública
- Umbral = 1, ratio = 0 → identificador visible con distribución agregada
- Umbral = 3, ratio = 0.5 → identificador con 2 reportes anónimos: "Sin reportes"

---

## Decisiones Técnicas

1. **Prisma con `Unsupported("vector")`:** Los embeddings se insertan con `$executeRawUnsafe` para evitar problemas de tipos.
2. **pg-boss v12:** Requiere `createQueue()` explícito antes de `send()` y `work()`.
3. **Ollama local:** Modelo `ornith:9b` para clasificación. Endpoint `/api/embeddings` para embeddings (no `/api/generate`).
4. **Retry de jobs pg-boss:** `retryLimit: 3`, `retryDelay: 30s`, `retryBackoff: true` (exponencial: 30s, 60s, 120s). Configurado en `src/lib/queue.ts` al publicar el job.
5. **Estado `CORREGIDO`:** Unificado para cualquier corrección del admin (simplifica el flujo).
6. **Sin fallback silencioso de embeddings:** Si Ollama falla, se lanza error explícito. El job se reintenta. Si agota reintentos, el reporte queda en `REVISION_MANUAL` con `processingError` registrado.