# Spec 011 — Centro de Control IA

## Estado
**COMPLETO**

## Contexto
El clasificador IA es una caja negra difícil de explicar y calibrar. Los administradores necesitan una zona segura donde entender el pipeline, probar textos con parámetros distintos y comparar el resultado contra la configuración actual, sin afectar reportes reales ni exponer PII.

## Objetivo
Crear un Centro de Control IA en `/dashboard/admin/ia` con tres pestañas:
1. **Documentación** visual e interactiva del pipeline.
2. **Playground** sandbox para ejecutar el pipeline con overrides.
3. **Configuración** reutilizando el panel existente.

## Alcance

### Incluido
- Backend sandbox en memoria (`src/lib/ai/sandbox.ts`).
- Endpoint `POST /api/admin/ia/sandbox` (solo admins, rate-limited).
- Modo comparación baseline vs override.
- UI de documentación con diagrama clickeable, demos de votos, gauge de confianza y precisión observada.
- UI de playground con sliders de parámetros, textarea y trace visual etapa por etapa.
- Integración con `ConfigPanel` existente y link en navegación admin.
- Tests unitarios de la API sandbox.
- Eval F7 de no-regresión tras agregar `rag_top_k`.

### Excluido
- Modificación del pipeline real de producción.
- Persistencia de textos de prueba, embeddings o dataset.
- Re-entrenamiento del modelo.

## Requisitos funcionales
1. Un admin puede escribir un texto de prueba y obtener el trace completo del pipeline.
2. Puede modificar overrides: `umbral_revision`, `n_votos`, `temperatura_votos`, `min_score_categoria`, `rag_top_k`.
3. Puede comparar la salida con la configuración actual en una sola acción.
4. La documentación explica cada etapa y muestra cómo la distribución de votos y el umbral afectan la decisión.
5. El panel de configuración permite guardar parámetros reales; el playground nunca los persiste.

## Requisitos no funcionales / Riesgos
- **R1 — Inmutabilidad del texto original:** el texto de prueba nunca se modifica ni persiste.
- **R2 — Privacidad:** el texto de prueba y PII detectados no salen del entorno local; no se loguean; no se guardan en BD.
- **R3 — Guardas determinísticas:** las guardas (DOXING, keywords, ráfaga) nunca reclasifican; solo escalan estado/prioridad.
- **R4 — Migraciones:** si se toca el schema, usar `prisma migrate dev`.
- **R5 — Embedding intacto:** no modificar `EmbeddingReporte` ni su pipeline.
- **R6 — Calidad:** cada bloque termina con lint, tsc, build y tests verdes.
- **R7 — Consumir, no alterar:** el spec consume el pipeline. Si se modifica (ej. `rag_top_k`), correr eval F7 de 110 ejemplos.

## Criterios de aceptación
- [x] `/dashboard/admin/ia` carga con tabs Documentación / Playground / Configuración.
- [x] El playground ejecuta el sandbox y muestra trace con embedding, RAG, votos, PII, anonimización, guardas y decisión.
- [x] El modo comparación muestra baseline y override resaltando cambios de estado/categoría/confianza.
- [x] La ruta sandbox requiere admin y aplica rate limit `ia_sandbox` (10 req / 10 min).
- [x] No se crean registros de `Reporte`, `ClasificacionIA`, `DatasetEntrenamiento` ni `EmbeddingDataset` al usar el sandbox.
- [x] Eval F7 no muestra regresión respecto al cierre de Spec 010.
- [x] `npm run lint`, `npx tsc --noEmit`, `npm run build` y `npm test` pasan.

## Métricas de éxito
- Eval F7: `error_silencioso` ≤ 21%, `% REVISION_MANUAL` ≤ 35%.
- Tests unitarios ≥ 110.

---

## Decisiones de diseño
- El sandbox ejecuta el mismo código de producción (`embedder`, `dataset-retrieval`, `classifier`, `pii-detector`, `anonimizador`, guardas) pero sin persistir.
- `rag_top_k` se agregó como parámetro configurable para poder experimentar con RAG sin cambiar código.
- Los overrides del playground se pasan por body; solo los valores numéricos iniciales pueden venir por query params al abrir desde Configuración.
