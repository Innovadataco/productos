# Cierre formal — Lote 3 (F1-F5 + R7)

Fecha: 2026-07-16
Ambiente: local macOS, PostgreSQL 16 (`localhost:5433/proteccion_infantil`), Ollama `ornith:9b` + `nomic-embed-text`.

## 1. Fix de validación de número de seguimiento

- `src/lib/validators.ts`: regex cambiado de `^RPT-[A-Z0-9]{6,}$` a `^RPT-[A-Z0-9]{6}$`.
- Tests actualizados:
  - `src/app/api/reportes/seguimiento/[numero]/route.test.ts`: fixtures `RPT-NOEXISTE` → `RPT-NOEXIS`, `RPT-ENRICH` → `RPT-ENRICH` (6 caracteres exactos).
  - `tests/e2e/consulta.spec.ts`: generador ahora produce exactamente 6 caracteres alfanuméricos después de `RPT-`.

## 2. Resultados de build

```
npm run build
```

- Estado: ✅ exit 0
- Duración: ~4 s
- Salida resumida: todas las rutas construidas correctamente; middleware proxy activo.

## 3. Resultados de tests unitarios

```
npm test
```

- Estado: ✅ 115/115 tests pasando
- Archivos: 22 pasados
- Duración: ~12 s

## 4. Smoke test E2E

```
node --env-file=.env --import tsx scripts/smoke-e2e.ts
```

- Estado: ✅ SMOKE TEST PASÓ
- Pasos verificados:
  1. Login de admin.
  2. Crear reporte vía API pública.
  3. Procesar reporte con worker.
  4. Verificar persistencia (PII detectada, texto anonimizado, clasificación, votos, embedding).
  5. Verificar estado coherente.
  6. Verificar cola admin (`REVISION_MANUAL`).
  7. Limpieza de datos de prueba.

## 5. Verificación de índices vectoriales (F1)

Script: `scripts/explain-vector-indexes.ts`

- Índices existentes en catálogo:
  - `EmbeddingReporte_vector_idx` — `CREATE INDEX ... USING hnsw (vector vector_cosine_ops)`
  - `EmbeddingDataset_vector_idx` — `CREATE INDEX ... USING hnsw (vector vector_cosine_ops)`
- EXPLAIN con `SET LOCAL enable_seqscan = off;`:
  - Plan principal: `Index Scan using "EmbeddingReporte_vector_idx" on "EmbeddingReporte"` ordenado por `vector <=> ...`.
  - Los `Seq Scan` en los `InitPlan` corresponden a la subconsulta que obtiene el vector de referencia en una tabla con muy pocas filas; el plan de búsqueda por similitud usa el índice hnsw.

## 6. Evaluación de no-regresión R7 (F1 → RAG retrieval)

Script: `scripts/eval-classifier-f7.ts`
Fixture: `scripts/eval-fixture.json` (110 ejemplos, 11 categorías × 10).

- Estado: ✅ completado (exit 0, duración ~12 min).
- Reporte: `eval-results/f7-guardas-classifier-1784249985743.json`
- Métricas globales:
  - Accuracy: **68.2%** (75/110 correctos)
  - Precision auto-clasificados: **79.2%**
  - Error silencioso: **20.8%**
  - Revisión manual: **34.5%**
  - Recall OTRO: **30.0%**
  - Posible agresor par: **10.9%**
  - Latencia p50: **6076 ms**, p95: **6406 ms**
- Segmentado:
  - Limpio: accuracy 76.4%, error silencioso 18.2%, revisión manual 20.0%
  - Ruidoso: accuracy 60.0%, error silencioso 25.0%, revisión manual 49.1%
- Comparativa de no-regresión (corridas F7 previas):
  - 2026-07-15 19:05: accuracy 68.2%, p50 6048 ms, p95 6391 ms
  - 2026-07-15 20:17: accuracy 68.2%, p50 6057 ms, p95 6387 ms
  - 2026-07-16 02:48: accuracy 68.2%, p50 6052 ms, p95 6374 ms
  - 2026-07-16 19:59 (esta corrida): accuracy 68.2%, p50 6076 ms, p95 6406 ms
- Conclusión: sin regresión observable tras la recreación de índices hnsw (F1). Las diferencias de latencia están dentro de la variabilidad del runtime local.

## Checklist de cierre Lote 3

| Requisito | Estado |
|-----------|--------|
| Build pasa | ✅ |
| npm test 115/115 | ✅ |
| smoke-e2e.ts pasa | ✅ |
| EXPLAIN con índices recreados (F1) | ✅ |
| Eval no-regresión 110 ejemplos (R7) | ✅ |
