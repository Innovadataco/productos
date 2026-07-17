# Evaluation Report — Rediseño del Clasificador IA

**Branch**: `010-rediseño-clasificador-ia`  
**Última evaluación**: F7 guardas (2026-07-16). Ver reporte consolidado en [`final-report.md`](./final-report.md).  
**Modelo local**: `ornith:9b` para clasificación y anonimización/PII  

---

## Resumen de fases

| Fase | Objetivo principal | Estado |
|------|--------------------|--------|
| F0.5 | Taxonomía ampliada (11 categorías), dataset, labels UI | ✅ Completado |
| F1   | Structured output nativo, prompt v1 + I1, threshold sweep | ✅ Completado |
| F2   | Separación clasificación/PII, capa determinística compartida, fusión det+LLM | ✅ Completado |
| F3   | Single-label + `posibleAgresorPar` + guarda DOXING | ✅ Completado |
| F4   | Votación/self-consistency | ✅ Completado |
| F5   | RAG sobre correcciones de admin | ✅ Completado |
| F6   | Cascada de desempate a modelo grande | ✅ Implementado, deshabilitado por defecto |
| F7   | Keywords críticas, ráfagas y precisión observada | ✅ Completado |

---

## Protocolo de evaluación

- **Determinismo**: `temperature = 0`, `seed = 42` en todas las llamadas únicas y evals (default en `src/lib/ai/ollama-client.ts`).
- **Excepción F4**: votación usará `temperature > 0` deliberadamente para generar diversidad.
- **Interpretación**: barras de error observadas ≈ ±0.5 pp; deltas < 1 pp se consideran empate.

---

## F0.5 — Taxonomía ampliada

- Se adoptaron 11 categorías incluyendo `EXTORSION`, `CONTENIDO_GENERADO_IA`, `DIFUSION_NO_CONSENTIDA` y `DOXING`.
- Migración `20260715222354_rediseno_clasificador_ia_f0_5_schema` verificada como segura en DB sembrada.
- Se creó el dashboard de dataset de entrenamiento y el job de backfill `dataset-anonimizacion-backfill`.

## F1 — Structured output y prompt I1

- El parseo manual se reemplazó por `format` JSON Schema en la API de Ollama.
- Se agregó workaround para modelos Qwen3/ornith que devuelven JSON en el campo `thinking`.
- Se ejecutó un threshold sweep y se fijó `reportes.classification.umbral_revision = 0.5` de forma interina.

### Métricas F1-I1 (fixture de 110, sin determinismo)

| Métrica | Valor |
|---------|-------|
| Accuracy global | 71.8% |
| `precision_auto_clasificados` | 73.3% |
| `error_silencioso` | **26.7%** |
| Tasa de revisión manual | 5.5% |
| Latencia p50 / p95 | 2320ms / 2417ms |
| Recall `OTRO` | 30% |

> El bajo recall de `OTRO` fue documentado como issue conocido; se abordará con multi-label (F3) y votación (F4).

## F2 — Separación de clasificación y PII

### Cambios técnicos

- `src/lib/ai/pii-patterns.ts`: capa determinística compartida entre detección de PII-NNA y DOXING.
  - Detecta nombres propios en contexto familiar/escolar, colegios/instituciones, direcciones colombianas, teléfonos atribuidos a NNA y datos escolares identificables.
  - Descarta explícitamente: teléfono/nick/usuario del agresor, nombre del adulto agresor, palabras sueltas como "mamá"/"profesora", direcciones genéricas sin números.
- `src/lib/ai/pii-detector.ts`: fusión determinística + LLM con regla `OR`.
- `src/app/api/reportes/procesar/route.ts`: clasificación y PII se ejecutan en paralelo (`Promise.all`).
- `src/lib/ai/classifier.ts` y `src/lib/ai/schemas.ts`: el schema de clasificación ya no pide PII; la decisión de anonimización proviene únicamente del detector PII combinado.
- `src/lib/ai/pii-patterns.test.ts`: 8 tests unitarios cubren detección determinística y DOXING.

### Fixture F2 PII

- `scripts/eval-pii-fixture.json` con 24 casos:
  - 14 positivos de PII NNA.
  - 10 negativos de PII NNA (agresor, contexto sin identificador, direcciones genéricas).
  - Casos ruidosos con errores ortográficos y puntuación.
  - Casos de DOXING que reutilizan patrones PII + intención de publicar.

### Métricas F2 PII

Archivo: `eval-results/f2-pii-1784162157696.json`

| Métrica | Valor |
|---------|-------|
| Recall determinístico | 78.6% |
| Recall combinado (det + LLM) | **100.0%** |
| Precisión determinística | **100.0%** |
| Precisión combinada | **100.0%** |
| Falsos positivos determinísticos | 0 |
| Falsos positivos combinados | 0 |
| Fragment recall determinístico | 79.2% |
| Fragment recall combinado | **88.9%** |
| Fragment recall LLM | 84.7% |

### P1 — Eval completo de clasificación (fixture 110) con determinismo

Se fijó `temperature=0` y `seed=42` en `src/lib/ai/ollama-client.ts`.

#### F2 — 3 runs deterministas

| Run | Archivo | `error_silencioso` | Accuracy | Revisión manual | Recall `OTRO` |
|-----|---------|--------------------|----------|-----------------|---------------|
| 1 | `f2-classifier-1784164572536.json` | 26.04% | 68.18% | 12.73% | 30% |
| 2 | `f2-classifier-1784164846282.json` | 26.04% | 68.18% | 12.73% | 30% |
| 3 | `f2-classifier-1784165156151.json` | 25.56% | 70.91% | 10.91% | 30% |

**Rango F2**: `error_silencioso` 25.56–26.04% (±0.24 pp). Media ≈ 25.88%.

#### F1-I1 reconstruido — 1 run determinista

Se reconstruyó el prompt y schema de F1-I1 (con multitarea PII en el clasificador) para comparar bajo el mismo determinismo.

| Métrica | Valor |
|---------|-------|
| `error_silencioso` | **25.56%** |
| Accuracy | 70.91% |
| Revisión manual | 10.91% |
| Recall `OTRO` | 30% |

Archivo: `eval-results/f1-1784165490823.json`.

#### Comparación determinista F1-I1 vs F2

| Métrica | F1-I1 det | F2 det (media) | Δ |
|---|---|---|---|
| `error_silencioso` | 25.56% | 25.88% | +0.32 pp |
| Accuracy | 70.91% | 69.09% | -1.82 pp |
| Revisión manual | 10.91% | 12.12% | +1.21 pp |
| Recall `OTRO` | 30% | 30% | 0 pp |

#### Veredicto P1

**Empate técnico.** La delta de `error_silencioso` es 0.32 pp, dentro de la barra de error observada (±0.5 pp). La "regresión" de 26.7% → 29.7% vista inicialmente era **ruido inducido por la ausencia de determinismo**, no una regresión real.

Por tanto, **F2 no empeora la clasificación** al separar PII, y cumple su objetivo de desacoplar responsabilidades.

### P2 — Diseño del anonimizador (V2 implementado)

`src/lib/ai/anonimizador.ts` fue modificado para recibir los fragmentos detectados por el detector combinado:

1. `anonimizarTexto(modelo, texto, piiDetectada)`.
2. Reemplazo determinístico obligatorio por etiquetas genéricas (`[NOMBRE]`, `[COLEGIO]`, `[DIRECCION]`, `[TELEFONO]`, `[INFO_ESCOLAR]`, `[FAMILIAR]`) antes de llamar al LLM.
3. El prompt del LLM recibe el texto pre-anonimizado y la lista de fragmentos ya detectados, con instrucción de mantenerlos reemplazados y detectar PII adicional.
4. Post-proceso: si algún fragmento original aún aparece en la salida del LLM, se fuerza su reemplazo.
5. La lista `piiDetectada` devuelta es la unión de hints + PII adicional detectado por el LLM.

Esto elimina el riesgo de que un fragmento detectado por regex/LLM del detector quede sin anonimizar si el LLM del anonimizador lo omite.

Tests: `src/lib/ai/anonimizador.test.ts` verifica el caso de fragmento detectado por regex pero omitido por el LLM.

### P3 — Spike Microsoft Presidio

Documentado en `specs/010-rediseño-clasificador-ia/research.md`.

Resumen ejecutivo:

| Métrica | Detector F2 | Presidio default |
|---|---|---|
| Recall caso | 100.0% | 71.4% |
| Precisión caso | 100.0% | 76.9% |
| Falsos positivos | 0 | 3 |
| Fragment recall | 88.9% | 54.2% |

**Decisión: descartar Presidio como tercera capa por defecto.** Su fortaleza (nombres propios) ya está cubierta por nuestras capas; su debilidad (no entender direcciones/teléfonos colombianos ni la regla agresor-no-es-PII) coincide con el hueco crítico del dominio.

---

## Validación

| Tipo | Resultado |
|------|-----------|
| Lint | ✅ OK |
| Unitarios | **78/78** pasaron (incluye 8 PII + 2 anonimizador) |
| Build | ✅ OK |
| Eval F2 PII (24 casos) | ✅ Recall 100%, precisión 100% |
| Eval F2 clasificación determinista (110 casos) | ✅ Empate con F1-I1 (`error_silencioso` 25.88% vs 25.56%) |
| Spike Presidio | ✅ Completado, descartado como tercera capa default |

### Archivos clave

- `src/lib/ai/pii-patterns.ts`
- `src/lib/ai/pii-detector.ts`
- `src/lib/ai/anonimizador.ts`
- `src/lib/ai/anonimizador.test.ts`
- `src/lib/ai/classifier.ts`
- `src/lib/ai/schemas.ts`
- `src/lib/ai/ollama-client.ts`
- `src/app/api/reportes/procesar/route.ts`
- `scripts/eval-pii-fixture.json`
- `scripts/eval-pii.ts`
- `scripts/eval-classifier-f2.ts`
- `scripts/presidio-spike.py`
- `scripts/presidio-compare.py`
- `src/lib/ai/pii-patterns.test.ts`

## Próximo paso

**F3 — Multi-label**: extender el schema de clasificación para devolver `categoria_principal` + `categorias_secundarias` ordenadas por score, y adaptar el eval para reportar métricas multi-label (recall@k, etc.) sin perder el recall de `OTRO`.
