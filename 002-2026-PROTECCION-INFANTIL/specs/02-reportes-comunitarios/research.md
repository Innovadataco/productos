# Research: Módulo de Reportes Comunitarios

**Feature**: Módulo de Reportes Comunitarios (fase 2)  
**Date**: 2026-07-12  
**Source**: Decisiones técnicas del product owner + lecciones del proyecto 001

---

## R1: Modelo de clasificación IA

**Decision**: `ornith:9b` vía Ollama local

**Rationale**:
- Cumple SC-002 (clasificación < 30 segundos por reporte)
- Deja memoria libre suficiente en el servidor de 36GB que comparte con otros servicios
- No requiere GPU dedicada; corre eficientemente en CPU
- Modelo de 9B parámetros: balance entre calidad de clasificación y velocidad

**Alternatives considered**:
- `llama3.1:8b`: Más lento en pruebas del 001, no mejora significativamente la precisión para clasificación de texto corto
- `mistral:7b`: Similar velocidad pero menor precisión en categorías de conducta de riesgo
- `qwen2.5:14b`: Mejor precisión pero excede el presupuesto de memoria compartido

---

## R2: Configuración del modelo

**Decision**: Patrón ModuleSetting/Parametrización (heredado de fase 1)

**Rationale**:
- El modelo no se hardcodea en el código fuente
- Permite cambiar el modelo sin redeploy (ajuste de parámetro)
- Facilita A/B testing de modelos en producción
- Default "ornith:9b" en seed; administrador puede cambiar desde panel

**Implementation**:
- `settingKey`: `"classification_model"`
- `module`: `"reportes"`
- `valorPorDefecto`: `"ornith:9b"`
- `tipo`: `STRING`
- `esPublico`: `false` (solo admin puede cambiar)

---

## R3: Similitud de texto para duplicados anónimos

**Decision**: Embeddings `nomic-embed-text` vía Ollama + pgvector en PostgreSQL

**Rationale**:
- Patrón probado y validado en proyecto 001-2026-INNOVADATACO
- `nomic-embed-text` genera vectores de 768 dimensiones, optimizado para textos cortos en español
- pgvector permite búsqueda por similitud coseno directamente en PostgreSQL
- No requiere servicio de vector DB adicional (Pinecone, Weaviate, etc.)

**Technical details**:
- Dimensión del embedding: 768
- Métrica de similitud: coseno (cosine similarity)
- Umbral de duplicado: >= 0.92 (ajustable vía parámetro `duplicate.similarity_threshold`)
- Indexación: `ivfflat` o `hnsw` en pgvector para búsquedas rápidas

---

## R4: Cola de procesamiento

**Decision**: pg-boss + worker Node.js supervisado por pm2

**Rationale**:
- pg-boss usa la misma base de datos PostgreSQL (sin infraestructura adicional)
- Lecciones del proyecto 001:
  - **Logging explícito**: Cada llamada a Ollama registra modelo, tokens, latencia, éxito/fracaso
  - **Sin fallbacks silenciosos**: Si Ollama falla, el job se reintenta con backoff exponencial (max 3 intentos)
  - **Detección de cola estancada**: Worker monitorea edad del job más antiguo; alerta si > 5 minutos
  - **No secretos en env**: API keys de Ollama no se usan (local), pero el patrón de no hardcodear secretos aplica a todas las configuraciones

**Worker architecture**:
```
pm2 start scripts/worker-reportes.mjs --name "reportes-worker"
```
- Worker consume jobs de la cola `reporte-procesamiento`
- Procesa un job a la vez (single-threaded para no saturar Ollama)
- Logging estructurado en JSON para ingestión futura

---

## R5: Extensión pgvector en PostgreSQL

**Decision**: Instalar `pgvector` como extensión obligatoria

**Rationale**:
- Necesario para almacenar y buscar embeddings de similitud
- Disponible en PostgreSQL 14+ via `CREATE EXTENSION vector;`
- Debe incluirse en docker-compose.yml y en migraciones

**Docker compose update**:
```yaml
db:
  image: pgvector/pgvector:pg15
  # o para imagen estándar: postgres:15 con pgvector instalado manualmente
```

---

## R6: Embeddings vs. Clasificación (modelos distintos)

**Decision**: Dos modelos de Ollama separados

| Propósito | Modelo | Tarea |
|-----------|--------|-------|
| Clasificación de conducta | `ornith:9b` | Clasificar texto en 7 categorías |
| Embeddings de similitud | `nomic-embed-text` | Generar vector del texto para comparación |

**Rationale**:
- `ornith:9b` es un modelo de lenguaje general, no optimizado para embeddings
- `nomic-embed-text` está especializado en embeddings semánticos de alta calidad
- Separar responsabilidades permite optimizar cada uno independientemente

---

## R7: Detección de PII en menores

**Decision**: La detección de PII se realiza en la **misma llamada** de clasificación a `ornith:9b`. Sin latencia extra.

**Rationale**:
- Una sola llamada al modelo es más eficiente que dos llamadas separadas
- El prompt solicita además de la categoría y confianza: `contiene_pii` (boolean) y `pii_detectada` (lista de fragmentos sospechosos)
- Si `contiene_pii=true`, el reporte pasa a estado `REQUIERE_ANONIMIZACION` y un administrador debe revisar y anonimizar el texto antes de que el reporte cuente para cualquier umbral o consulta
- El texto original se guarda en un campo de auditoría de acceso restringido (`textoOriginal`); nunca se expone en APIs públicas ni alimenta el dataset de entrenamiento

**Regla dura**: Un reporte en estado `REQUIERE_ANONIMIZACION` **NUNCA** cuenta para el umbral de visibilidad pública ni aparece en ninguna consulta hasta ser anonimizado.

---

## Decisions Log Summary

| ID | Decisión | Impacto |
|----|----------|---------|
| D1 | pgvector obligatorio | Requiere cambio en docker-compose.yml y migraciones |
| D2 | Worker separado para pg-boss | Arquitectura asíncrona, no bloquea servidor web |
| D3 | Logging explícito de Ollama | Transparencia operativa, debugging de latencias |
| D4 | Detección de cola estancada | Alerta temprana de problemas de procesamiento |
| D5 | Parámetro `visibility.min_authenticated_ratio` | Nueva fila en ParametroSistema, default 0.5 |
| D6 | Detección de PII integrada en clasificación | Prompt unificado: categoría + confianza + PII |
| D7 | Campo `textoOriginal` restringido | Solo accesible por admin; nunca en APIs públicas |
