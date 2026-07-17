# Implementation Plan: Rediseño del Clasificador IA

**Branch**: `010-rediseño-clasificador-ia` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-rediseño-clasificador-ia/spec.md`

## Summary

Rediseñar el pipeline de clasificación IA de reportes comunitarios para mejorar la precisión, eliminar el parseo frágil de JSON, separar la detección de PII de la clasificación, soportar múltiples categorías por texto, reemplazar la confianza auto-reportada por votación de modelos, incorporar ejemplos corregidos por administradores mediante RAG, agregar una cascada opcional a modelo grande y establecer una red de seguridad con keywords de alto riesgo y métricas de calidad. Además, adoptar la taxonomía de grooming LATAM 2024-2026 (cuatro categorías nuevas) y priorizar la reducción del error silencioso.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js >=22

**Primary Dependencies**: Next.js 16.2.10, Prisma 5.22.0, Ollama local, pgvector, pg-boss

**Storage**: PostgreSQL 16+ con extensión pgvector

**Testing**: Vitest + scripts de evaluación standalone en `scripts/eval-classifier-*.ts`

**Target Platform**: Servidor local / Mac Studio

**Project Type**: Web application (Next.js App Router + API Routes)

**Performance Goals**: Procesamiento de reporte <60s en p95 con votación y RAG habilitados

**Constraints**:
- Todos los modelos son locales (Ollama). Ningún texto de reporte sale del servidor.
- No modificar `reporte.texto` ni `reporte.textoOriginal`.
- Las keywords no pueden reclasificar la categoría asignada por el modelo.
- Migraciones solo con `prisma migrate dev`.
- No alterar el pipeline de dedup por embeddings existente.

**Scale/Scope**: 100-1000 reportes/día estimados; pipeline asíncrono via worker pg-boss.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| 1.2 Solo texto | ✅ Pass | No se almacena multimedia |
| 1.5 Clasificación de conductas | ✅ Pass | El modelo clasifica conductas, no personas |
| 2.1 Stack heredado | ✅ Pass | Se mantiene Next.js + Prisma + Ollama + pg-boss |
| 3.1 TypeScript strict | ✅ Pass | Los nuevos módulos usan tipos estrictos |
| R1 No modificar texto original | ✅ Pass | Pipeline solo lee `reporte.texto` |
| R2 PII no sale del servidor | ✅ Pass | Toda IA es local |
| R3 Keywords no reclasifican | ✅ Pass | Keywords solo afectan prioridad |
| R4 Migraciones con migrate dev | ✅ Pass | Plan incluye migraciones Prisma |
| R5 No tocar dedup existente | ✅ Pass | Nueva tabla `EmbeddingDataset` separada |

## Project Structure

### Documentation (this feature)

```text
specs/010-rediseño-clasificador-ia/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Decisiones técnicas y preguntas abiertas
├── data-model.md        # Entidades y migraciones
├── quickstart.md        # Guía de validación end-to-end
├── contracts/           # Contratos de interfaces
│   ├── classification-result.md
│   └── eval-report.md
└── tasks.md             # Generado por /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── ai/
│       ├── ollama-client.ts       # + soporte format/schema + temperature + keep_alive
│       ├── classifier.ts          # reescrito: multi-label + votos + cascada
│       ├── pii-detector.ts        # NUEVO: capa determinística + LLM
│       ├── embedder.ts            # sin cambios (reutilizar)
│       ├── similarity.ts          # sin cambios en dedup
│       ├── retrieval.ts           # NUEVO: RAG sobre correcciones
│       └── keywords-riesgo.ts     # NUEVO: diccionario estático
├── app/
│   └── api/
│       ├── reportes/
│       │   └── procesar/
│       │       └── route.ts       # orquesta PII + clasificación + keywords
│       └── admin/
│           ├── correcciones/
│           │   └── route.ts       # + embedding + flag anonimizado (FIX F0.5)
│           └── estadisticas/
│               └── route.ts       # + métricas de clasificador
└── components/
    └── admin/
        └── ColaRevision.tsx       # + prioridad alta + términos detectados + posibleAgresorPar
```

```text
scripts/
├── eval-classifier.mjs|ts         # eval harness final (F0+)
├── eval-classifier-baseline.ts    # baseline actual (ajustado a taxonomía final)
├── eval-fixture.json              # fixture sintético con ruido (110 ejemplos)
├── audit-dataset-pii.ts           # NUEVO: auditoría DatasetEntrenamiento
└── backfill-embeddings-dataset.ts # NUEVO: generar embeddings existentes
```

```text
prisma/
└── migrations/
    └── 2026xxxx_rediseno_clasificador_ia/  # migración consolidada
```

## Complexity Tracking

> No se identificaron violaciones que requieran justificación compleja. La complejidad principal es la latencia agregada por votación y RAG, mitigada por el procesamiento asíncrono.

## Fases de implementación y archivos por fase

### FASE 0 — Eval Harness

**Migraciones**: Ninguna.

**Archivos**:
- `scripts/eval-classifier-baseline.ts`
- `scripts/eval-fixture.json`
- `eval-results/baseline-{timestamp}.json`

**Fixture**: 110 ejemplos sintéticos, 10 por cada una de las 11 categorías. Cada categoría incluye:
- 4-5 ejemplos limpios
- 4-5 ejemplos con ruido realista: typos, palabras fragmentadas, texto telegráfico, mezcla de categorías, jerga de plataformas (WhatsApp, TikTok, Roblox, Discord, Free Fire), franja etaria 9-13, lenguaje coloquial colombiano.

Cada ejemplo lleva metadato `"ruido": true|false`. Los de mezcla de categorías incluyen `"secundariaEsperada"` para evaluar F3.

### FASE 0.5 — Fix de anonimización en correcciones (BLOQUEANTE)

**Objetivo**: garantizar que `DatasetEntrenamiento.texto` siempre sea la versión anonimizada.

**Migraciones**: Ninguna en schema; se reutiliza `DatasetEntrenamiento.textoAnonimizado` (migración F5).

**Archivo modificado**:
- `src/app/api/admin/correcciones/route.ts`

**Lógica propuesta**:
1. Al crear una corrección, verificar `reporte.textoOriginal`.
2. Si `textoOriginal` es `null` y `reporte.clasificacion.contienePii === false` → `reporte.texto` es seguro (no se detectó PII).
3. Si `textoOriginal` no es `null` → `reporte.texto` ya fue anonimizado; usarlo.
4. Si `textoOriginal` es `null` y `contienePii === true` → esto indica una inconsistencia; lanzar al worker de anonimización antes de insertar en `DatasetEntrenamiento`, o marcar `textoAnonimizado=false` y `pendienteAnonimizacion=true` para procesarlo asíncronamente.

**Decisión recomendada**: Opción A — anonimizar síncronamente antes de insertar, porque el volumen es bajo y simplifica el flujo. Si Ollama falla, la corrección NO debe fallar: en ese caso insertar con `textoAnonimizado=false` y encolar backfill.

**Test obligatorio**:
- Crear reporte con PII de NNA en texto.
- Procesar (detecta PII, anonimiza → `textoOriginal` no null).
- Corregir clasificación desde admin.
- Verificar que `DatasetEntrenamiento.texto` NO contiene la PII original.

### FASE 1 — Structured Outputs Nativos + Barrido terminológico

**Migraciones**: ampliar enum `CategoriaConducta` (misma migración consolidada de F3).

**Archivos modificados**:
- `src/lib/ai/ollama-client.ts`: aceptar `format` JSON schema.
- `src/lib/ai/classifier.ts`: eliminar regex, parsear directo, validar con Zod.
- Prompts, UI, correos, docs: reemplazar "pornografía infantil" por MASNNA, "menor" por NNA donde aplique, eliminar afirmaciones de delito.

**JSON schema de clasificación**:

```json
{
  "type": "object",
  "properties": {
    "categoria": {
      "type": "string",
      "enum": [
        "CONTACTO_INSISTENTE",
        "SOLICITUD_MATERIAL",
        "OFRECIMIENTO_REGALOS",
        "SUPLANTACION_IDENTIDAD",
        "SOLICITUD_ENCUENTRO",
        "COMPARTIMIENTO_SEXUAL",
        "OTRO",
        "EXTORSION",
        "CONTENIDO_GENERADO_IA",
        "DIFUSION_NO_CONSENTIDA",
        "DOXING"
      ]
    },
    "confianza": { "type": "number", "minimum": 0, "maximum": 1 },
    "contiene_pii": { "type": "boolean" },
    "pii_detectada": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["categoria", "confianza", "contiene_pii", "pii_detectada"]
}
```

**Prompt de clasificación (F1)**:

```text
Eres un clasificador especializado en protección de NNA. Analiza el texto proporcionado y responde ÚNICAMENTE en formato JSON válido con esta estructura exacta:

{
  "categoria": "CONTACTO_INSISTENTE|SOLICITUD_MATERIAL|OFRECIMIENTO_REGALOS|SUPLANTACION_IDENTIDAD|SOLICITUD_ENCUENTRO|COMPARTIMIENTO_SEXUAL|OTRO|EXTORSION|CONTENIDO_GENERADO_IA|DIFUSION_NO_CONSENTIDA|DOXING",
  "confianza": 0.0-1.0,
  "contiene_pii": true|false,
  "pii_detectada": ["fragmento1", "fragmento2"]
}

Categorías:
- CONTACTO_INSISTENTE: contacto repetido e incómodo
- SOLICITUD_MATERIAL: solicitud de fotos/videos íntimos o MASNNA
- OFRECIMIENTO_REGALOS: ofrecimiento de dinero, regalos o beneficios
- SUPLANTACION_IDENTIDAD: fingir ser NNA, familiar o figura de autoridad
- SOLICITUD_ENCUENTRO: solicitud de reunión física
- COMPARTIMIENTO_SEXUAL: envío o solicitud de contenido sexual o MASNNA
- EXTORSION: chantaje usando contenido íntimo real o generado por IA (sextorsión)
- CONTENIDO_GENERADO_IA: deepfakes sexuales o nudificación digital de un NNA
- DIFUSION_NO_CONSENTIDA: publicación o reenvío de fotos/videos íntimos sin permiso
- DOXING: publicación maliciosa de información privada de un NNA para exponerlo
- OTRO: conducta de riesgo real que no encaja en las anteriores

PII = datos personales identificables de NNA (nombres propios, nombres de escuelas/colegios, direcciones, datos escolares, teléfono personal del NNA). No incluyas el número telefónico o nick del agresor como PII.

Si el texto es ambiguo, incompleto o no puedes clasificar con confianza, usa categoria "OTRO" y confianza baja (< 0.5).

Responde SOLO el JSON, sin markdown, sin explicaciones.
```

### FASE 2 — Separar Clasificación y Detección de PII

**Migraciones**: Ninguna en schema; cambio de código.

**Archivos nuevos**:
- `src/lib/ai/pii-detector.ts`

**Archivos modificados**:
- `src/lib/ai/classifier.ts`: remover instrucciones de PII del prompt.
- `src/app/api/reportes/procesar/route.ts`: llamar PII y clasificación en paralelo.

**JSON schema de PII**:

```json
{
  "type": "object",
  "properties": {
    "contiene_pii": { "type": "boolean" },
    "pii_detectada": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["contiene_pii", "pii_detectada"]
}
```

**Prompt de PII**:

```text
Eres un detector de datos personales identificables de NNA. Analiza el texto y responde ÚNICAMENTE en formato JSON válido:

{
  "contiene_pii": true|false,
  "pii_detectada": ["fragmento1", "fragmento2"]
}

Reglas:
- PII incluye: nombres propios de NNA, nombres de colegios/escuelas/instituciones educativas, direcciones específicas, teléfonos personales del NNA, datos escolares.
- NO incluyas: el número telefónico o nick del agresor, nombres de aplicaciones, nombres de ciudades/países.
- Si no hay PII de NNA, devuelve contiene_pii: false y array vacío.

Responde SOLO el JSON.
```

**Capa determinística en `pii-detector.ts`** (compartida con DOXING de F7):
- Direcciones colombianas: `(calle|carrera|avenida|diagonal|transversal)\s+\d+\s*(#|n°|no\.?)\s*\d+(-\d+)?`.
- Colegios/escuelas: `(colegio|escuela|institucion educativa|unidad educativa)\s+[A-Z][\w\s]+`.
- Teléfono personal de NNA en contexto: `(mi celular|mi número|mi tel|mi whatsapp)\s*(es|:)?\s*\d{10}`.
- Doxing: publicación de domicilio, teléfono o colegio con intención de exponer.
- Heurística de nombres propios: palabras capitalizadas precedidas por "mi hijo", "la niña", "mi sobrino", etc.

### FASE 3 — Single-Label + posibleAgresorPar + guarda de escalamiento DOXING

**Nota de ejecución**: el plan original proponía multi-label en F3. Durante la implementación se probó pedir un array `{categoria, score}` a `ornith:9b`, pero el modelo no calibra scores multi-label en una sola pasada: `error_silencioso` saltó a 35.7 % (+9.8 pp vs F2), con confusión masiva en fronteras difíciles y más falsos `OTRO`. Se decidió **revertir a single-label**, conservar `posible_agresor_par` e implementar la guarda DOXING. El multi-label se reprograma como derivado de la votación de F4.

**Migraciones** (consolidadas en una sola migración con F1):
- Ampliar enum `CategoriaConducta`.
- `ClasificacionIA.categoriasSecundarias Json?`
- `ClasificacionIA.votos Json?`
- `ClasificacionIA.usoCascada Boolean @default(false)`
- `ClasificacionIA.modeloCascada String?`
- `ClasificacionIA.posibleAgresorPar Boolean @default(false)`
- `ParametroSistema` clave `reportes.classification.min_score_categoria` valor `0.3`

**Archivos modificados**:
- `src/lib/ai/ollama-client.ts`: schema single-label.
- `src/lib/ai/classifier.ts`: devolver `categoria`, `confianza`, `posibleAgresorPar`.
- `src/lib/ai/pii-patterns.ts`: `detectarDoxing` con normalización NFD de tildes.
- `src/app/api/reportes/procesar/route.ts`: guarda DOXING (R3) + persistencia de secundarias vacías y `posibleAgresorPar`.
- `src/components/modules/AdminReporteDetalle.tsx`: mostrar secundarias, `posibleAgresorPar` y prioridad alta.

**JSON schema F3-revert**:

```json
{
  "type": "object",
  "properties": {
    "categoria": {
      "type": "string",
      "enum": ["CONTACTO_INSISTENTE", "SOLICITUD_MATERIAL", "OFRECIMIENTO_REGALOS", "SUPLANTACION_IDENTIDAD", "SOLICITUD_ENCUENTRO", "COMPARTIMIENTO_SEXUAL", "OTRO", "EXTORSION", "CONTENIDO_GENERADO_IA", "DIFUSION_NO_CONSENTIDA", "DOXING"]
    },
    "confianza": { "type": "number", "minimum": 0, "maximum": 1 },
    "posible_agresor_par": { "type": "boolean" }
  },
  "required": ["categoria", "confianza", "posible_agresor_par"]
}
```

**Guarda DOXING (R3)**:
- Si `detectarDoxing(texto).esDoxing === true` y la categoría principal del LLM no es `DOXING`:
  - No se modifica la categoría principal.
  - Estado final = `REVISION_MANUAL`.
  - `Reporte.prioridadAlta = true`.
  - `Reporte.keywordsDetectadas` se puebla con fragmentos detectados.

**Resultados de cierre F3-revert**:

| Métrica | Valor |
|---------|-------|
| accuracy | 69.09 % |
| precision_auto_clasificados | 73.68 % |
| error_silencioso | 26.32 % |
| revisión_manual | 10.00 % |
| latencia p50 / p95 | 2.287 ms / 2.350 ms |
| posibleAgresorPar | 9.09 % |

Veredicto: **empate técnico con F2** (`error_silencioso` dentro de ±1 pp). Guarda DOXING se activó en 1 caso real con precisión 100 %. F3 cierra como parcial.

### FASE 4 — Self-Consistency / Votación con multi-label derivado

**Objetivo**: ejecutar `n` clasificaciones independientes por reporte con `temperature > 0` y seeds distintos, derivar la categoría principal y las secundarias de la distribución de votos, y mantener la cascada opcional a modelo grande.

**Decisiones de diseño**:
- `n = 5` (configurable vía `reportes.classification.n_votos`).
- `temperature = 0.7` (configurable vía `reportes.classification.temperature`).
- Seeds: `[42, 123, 456, 789, 1024]` (fijos para reproducibilidad de evals; la variación viene de `temperature`).
- Schema por voto: mismo single-label de F3 (`categoria`, `confianza`, `posible_agresor_par`).
- Agregación:
  - Para cada categoría, contar votos.
  - Categoría principal = moda.
  - `confianza` = votos de la moda / n.
  - Categorías secundarias = categorías con fracción ≥ `min_score_categoria` (0.3), excluyendo la principal, ordenadas por fracción descendente.
  - `posibleAgresorPar` = OR de los 5 votos (a evaluar; si degrada `error_silencioso`, se pasa a voto mayoritario).
- Estado final:
  - Si confianza (fracción de moda) < `umbral_revision` (0.5 por defecto) → `REVISION_MANUAL`.
  - Si no → `CLASIFICADO`.
- Cascada a modelo grande:
  - Disparador: moda < 3/5 (confianza < 0.6) **y** `reportes.classification.modelo_desempate` está configurado.
  - Modelo: `ornith:35b` por defecto si está disponible.
  - Temperatura: 0.
  - Se reutiliza el schema single-label; el resultado de la cascada reemplaza la decisión de los votos pequeños.
  - Se marca `usoCascada = true` y `modeloCascada` en `ClasificacionIA`.

**Migraciones**: ninguna nueva; se reutilizan las columnas ya creadas (`votos`, `usoCascada`, `modeloCascada`). Se agregan o actualizan los siguientes `ParametroSistema`:
- `reportes.classification.n_votos` = `5`
- `reportes.classification.temperature` = `0.7`
- `reportes.classification.umbral_desempate` = `0.6`
- `reportes.classification.modelo_desempate` = `ornith:35b`

**Archivos modificados**:
- `src/lib/ai/classifier.ts`: nueva función `clasificarConVotos` que llama 5 veces a `clasificarReporte` con `options` distintos; lógica de agregación y cascada.
- `src/lib/ai/ollama-client.ts`: ya acepta `options`; verificar que `temperature` se puede sobrescribir.
- `src/app/api/reportes/procesar/route.ts`: usar `clasificarConVotos` en lugar de `clasificarReporte`; persistir `votos`, `categoriasSecundarias`, `usoCascada`, `modeloCascada`.
- `scripts/eval-classifier-f3.ts` → renombrar/extender a `scripts/eval-classifier-f4.ts`: medir métricas de votación, varianza entre 3 runs, tasa de cascada, y comparar contra F3-revert.

**Evaluación F4**:
- Fixture: `scripts/eval-fixture.json`.
- Métricas: accuracy, `precision_auto_clasificados`, `error_silencioso`, tasa de revisión manual, recall de `OTRO`, segmentación limpio/ruidoso, latencia p50/p95, tasa de cascada, varianza de `error_silencioso` entre 3 runs.
- Regla de empate: ±1 pp vs F3-revert.
- Freno P4: `error_silencioso > 26.9 %` o latencia p95 > 60 s.

### FASE 5 — RAG sobre Correcciones de Admin

**Migraciones**:
- Nuevo modelo `EmbeddingDataset` con vector(768).
- `DatasetEntrenamiento.textoAnonimizado Boolean @default(false)`.
- Relación 1:1 `DatasetEntrenamiento.embedding`.

**Archivos nuevos**:
- `src/lib/ai/retrieval.ts`
- `scripts/backfill-embeddings-dataset.ts`

**Archivos modificados**:
- `src/app/api/admin/correcciones/route.ts`: generar embedding al crear corrección.
- `src/app/api/reportes/procesar/route.ts`: incluir ejemplos RAG en prompt.
- `src/lib/ai/classifier.ts`: construir prompt dinámico con ejemplos.

**Prompt con ejemplos**:

```text
Eres un clasificador especializado en protección de NNA. A continuación hay ejemplos de casos reales ya clasificados por humanos. Úsalos como referencia.

{{#each ejemplos}}
Ejemplo {{@index}}:
Texto: "{{texto}}"
Clasificación: {{categoriaCorrecta}}
{{/each}}

Ahora clasifica el siguiente texto y responde SOLO el JSON multi-label:
{
  "categorias": [{ "categoria": "...", "score": 0.0-1.0 }],
  "posible_agresor_par": true|false
}

Texto: "{{textoReporte}}"
```

### FASE 6 — Cascada de Desempate con Modelo Grande

**Migraciones**:
- `ClasificacionIA.usoCascada Boolean @default(false)`
- `ClasificacionIA.modeloCascada String?`
- `ParametroSistema` claves:
  - `reportes.classification.modelo_desempate` valor `""` (vacío = deshabilitado)
  - `reportes.classification.umbral_desempate` valor `0.6`

**Archivos modificados**:
- `src/lib/ai/classifier.ts`: si votos < umbral y modelo_desempate configurado → llamar modelo grande.
- `src/lib/ai/ollama-client.ts`: soportar `keep_alive` corto.

**Prompt de desempate**:

```text
Eres un clasificador senior de protección de NNA. Varios análisis previos no se pusieron de acuerdo sobre este texto. Te presento los resultados y pido tu decisión final.

Texto: "{{texto}}"

Distribución de votos previos:
{{distribucionVotos}}

Responde SOLO el JSON multi-label con tu decisión final:
{
  "categorias": [{ "categoria": "...", "score": 0.0-1.0 }],
  "posible_agresor_par": true|false
}
```

**Candidatos de modelo grande** (a decisión del usuario):

| Modelo | Tamaño aprox. | RAM estimada Q4 | Notas |
|--------|---------------|-----------------|-------|
| qwen2.5:32b | 32B | ~20 GB | Buen balance calidad/velocidad |
| llama3.1:30b | 30B | ~19 GB | Buen rendimiento en español |
| mistral-nemo:22b | 22B | ~14 GB | Menor consumo, calidad menor |

### FASE 7 — Keywords de Alto Riesgo + Métricas

**Migraciones**:
- `Reporte.prioridadAlta Boolean @default(false)`
- `Reporte.keywordsDetectadas String[]`
- `ParametroSistema` clave `reportes.keywords.riesgo` (JSON con diccionario)

**Archivos nuevos**:
- `src/lib/ai/keywords-riesgo.ts`

**Archivos modificados**:
- `src/app/api/reportes/procesar/route.ts`: aplicar keywords post-clasificación.
- `src/app/api/admin/estadisticas/route.ts`: agregar métricas de clasificador.
- Componente de cola de revisión admin.
- `src/lib/email.ts`: alertas indican prioridad alta sin texto.

**Diccionario inicial de keywords**:

```typescript
const KEYWORDS_RIESGO: Record<CategoriaConducta | "GENERAL", RegExp[]> = {
  SOLICITUD_MATERIAL: [/fotos?\s*(sin\s*ropa|desnud[oa]|intima)/i, /videos?\s*intimo/i, /mandame\s*foto/i, /MASNNA/i],
  COMPARTIMIENTO_SEXUAL: [/contenido\s*sexual/i, /video\s*pornografico/i, /imagenes?\s*desnud[oa]/i, /MASNNA/i],
  SOLICITUD_ENCUENTRO: [/quedar\s*a\s*solas/i, /encontrarnos\s+en\s+secreto/i, /vamos\s+a\s*la\s*cabana/i],
  OFRECIMIENTO_REGALOS: [/te\s*compro/i, /te\s*regalo/i, /dinero\s*a\s*cambio/i],
  SUPLANTACION_IDENTIDAD: [/soy\s+tu\s+(profesor|director)/i, /finge/i, /me\s+hago\s+pasar/i],
  EXTORSION: [/chantaje/i, /extorsion/i, /si\s+no\s+mandas/i, /deepfake/i, /nudifica/i],
  CONTENIDO_GENERADO_IA: [/deepfake/i, /nudifica/i, /foto\s*falsa/i, /ia\s*gener/i],
  DIFUSION_NO_CONSENTIDA: [/difundi/i, /comparti\s+sin\s+permiso/i, /public\s*fotos/i],
  DOXING: [/dox/i, /publiqu\s+tu\s+direccion/i, /sabe\s+donde\s*vives/i],
  GENERAL: [/NNA/i, /menor\s+de\s+edad/i, /niñ[oa]\s+de\s+\d+/i],
};
```

## Baseline del clasificador actual

> **Obsoleto**: el baseline inicial de 70 ejemplos y 7 categorías será reemplazado por un nuevo baseline con taxonomía ampliada (11 categorías) y fixture con ruido realista (110 ejemplos). Los resultados iniciales se mantienen solo como referencia histórica.

### Baseline inicial (7 categorías, 70 ejemplos limpios)

| Métrica | Valor |
|---------|-------|
| Accuracy global | 78.6% |
| Revisión manual | 5.7% |
| Latencia p50 / p95 | 5,831 ms / 10,891 ms |

| Categoría | Precision | Recall | F1 |
|-----------|-----------|--------|-----|
| CONTACTO_INSISTENTE | 72.7% | 80.0% | 76.2% |
| SOLICITUD_MATERIAL | 75.0% | 60.0% | 66.7% |
| OFRECIMIENTO_REGALOS | 100% | 80.0% | 88.9% |
| SUPLANTACION_IDENTIDAD | 100% | 70.0% | 82.4% |
| SOLICITUD_ENCUENTRO | 90.0% | 90.0% | 90.0% |
| COMPARTIMIENTO_SEXUAL | 62.5% | 100% | 76.9% |
| OTRO | 70.0% | 70.0% | 70.0% |

**Hallazgos principales**:
- Confusión frecuente `SOLICITUD_MATERIAL` ↔ `COMPARTIMIENTO_SEXUAL`.
- `OTRO` mal clasificado como `CONTACTO_INSISTENTE` en 3 de 10 casos.
- 2 de 10 `CONTACTO_INSISTENTE` fueron a `REVISION_MANUAL` por baja confianza.
- El problema crítico: ~15-16% de errores silenciosos entre casos auto-clasificados.

Reporte completo: `eval-results/baseline-1784150976956.json`

### Nuevo baseline (11 categorías, 110 ejemplos con ruido)

Ejecutado con `scripts/eval-classifier-baseline.ts scripts/eval-fixture.json` sobre el clasificador actual `ornith:9b`.

| Métrica | Valor |
|---------|-------|
| Accuracy global | **41.8%** |
| precision_auto_clasificados | **48.2%** |
| error_silencioso | **51.8%** |
| Revisión manual | **17.3%** |
| Latencia p50 / p95 | **6,382 ms / 35,890 ms** |

Segmentación limpio vs ruidoso:

| Segmento | Accuracy | precision_auto_clasificados | error_silencioso | REVISION_MANUAL |
|----------|----------|------------------------------|------------------|-----------------|
| Limpio (55) | 50.9% | 54.0% | 46.0% | 1.8% |
| Ruidoso (55) | 32.7% | 40.0% | 60.0% | 32.7% |

Precision/recall/F1 por categoría:

| Categoría | Precision | Recall | F1 |
|-----------|-----------|--------|-----|
| CONTACTO_INSISTENTE | 81.8% | 90.0% | 85.7% |
| SOLICITUD_MATERIAL | 33.3% | 10.0% | 15.4% |
| OFRECIMIENTO_REGALOS | 100% | 80.0% | 88.9% |
| SUPLANTACION_IDENTIDAD | 100% | 60.0% | 75.0% |
| SOLICITUD_ENCUENTRO | 85.7% | 60.0% | 70.6% |
| COMPARTIMIENTO_SEXUAL | 14.9% | 70.0% | 24.6% |
| OTRO | 32.1% | 90.0% | 47.4% |
| EXTORSION | 0% | 0% | 0% |
| CONTENIDO_GENERADO_IA | 0% | 0% | 0% |
| DIFUSION_NO_CONSENTIDA | 0% | 0% | 0% |
| DOXING | 0% | 0% | 0% |

**Interpretación**: El clasificador actual desconoce las 4 categorías nuevas de la taxonomía LATAM, por lo que las clasifica erróneamente (la mayoría como `COMPARTIMIENTO_SEXUAL`) o las envía a revisión manual. El error silencioso del 51.8% refleja tanto la confusión entre categorías originales como la imposibilidad de detectar las nuevas. Este baseline será el punto de comparación para medir la mejora tras F1-F3.

Reporte completo: `eval-results/baseline-1784152962977.json`

## Auditoría de PII en DatasetEntrenamiento

- **Registros actuales**: 0.
- **Riesgo identificado**: `src/app/api/admin/correcciones/route.ts` línea 106 guarda `reporte.texto` directamente.
- **Fix F0.5**: garantizar que el texto persistido en `DatasetEntrenamiento` sea siempre la versión anonimizada. Ver FASE 0.5.

## Riesgos identificados

1. **Latencia**: n=5 votos multiplica por ~5 el tiempo de clasificación. Mitigación: procesamiento asíncrono + posibilidad de ajustar n según carga.
2. **Memoria**: 5 llamadas paralelas de ornith:9b más embedding pueden saturar el Mac Studio. Mitigación: documentar `OLLAMA_NUM_PARALLEL` y monitorear.
3. **Data leakage en eval**: RAG puede recuperar el mismo ejemplo que se evalúa. Mitigación: excluir registro con similitud >0.98 en modo eval.
4. **Overfitting a correcciones**: pocos ejemplos de admin pueden sesgar al modelo. Mitigación: RAG solo cuando haya suficientes ejemplos diversos.
5. **Falsos positivos de PII**: capa determinística + LLM puede sobre-anonimizar. Mitigación: falso positivo es aceptable (R2 prioriza recall).
6. **Taxonomía extendida**: más categorías pueden aumentar confusión inicial. Mitigación: ejemplos en prompts y RAG para desambiguar.

## Preguntas abiertas

1. ¿Cuántos reportes por segundo debe soportar el worker en producción? Esto afecta la viabilidad de n=5 votos.
2. ¿El Mac Studio tendrá suficientes recursos para correr 5 llamadas en paralelo de ornith:9b más el modelo de embedding? Se recomienda ajustar `OLLAMA_NUM_PARALLEL`.
3. ¿Existe un modelo grande preferido para la cascada? Queda a decisión del usuario.
