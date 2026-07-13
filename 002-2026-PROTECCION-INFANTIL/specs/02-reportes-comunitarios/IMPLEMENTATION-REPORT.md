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
- ✅ Generación de embeddings (con fallback determinístico)
- ✅ Worker pg-boss con retry automático
- ✅ Idempotencia: no reprocesa reportes ya clasificados

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
4. **Fallback de embeddings:** Si Ollama falla, genera vector determinístico de 768 dims para no bloquear el flujo.
5. **Estado `CORREGIDO`:** Unificado para cualquier corrección del admin (simplifica el flujo).

---

## Pendientes Fase 8 (Polish)
- [ ] UI de panel admin
- [ ] Tests automatizados
- [ ] Anonimización automática de PII en textos
- [ ] Métricas y dashboard