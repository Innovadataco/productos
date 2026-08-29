# MODELO — Clasificación de reportes (flujo post-090)

> **Versión:** 1.2.0 · **Fecha:** 2026-07-24 · **Autor:** ODIN (spec 092)
>
> Explica **cómo decide** el sistema cuando entra un reporte. Los valores exactos
> (modelos, umbrales, sets de preguntas, temperatura, pesos) viven en
> **`ParametroSistema`** (BD) y se editan sin desplegar (ADR_004); este documento
> explica el **flujo y los conceptos** y enlaza a la fuente para lo volátil.
> No copiar aquí valores que cambian — se desactualiza.

## 1. Flujo, de lo barato a lo caro

```
Reporte entrante (API anónima o PARENT)
   │
   ├─ 1. Validación + rate limiting + cifrado del texto original
   ├─ 2. Cola async (pg-boss) → worker (procesa en segundo plano)
   ├─ 3. Embedding del texto (modelo de embeddings local)
   ├─ 4. Deduplicación por similitud de embeddings (mismo identificador+plataforma)
   ├─ 5. GUARDAS BARATAS PREVIAS (ráfaga, doxing — cortan sin gastar modelos)
   ├─ 6. RAG: ejemplos corregidos por humanos semánticamente similares
   ├─ 7. RÚBRICA multi-etiqueta / multi-modelo (clasificación)
   ├─ 8. PII: detección de datos personales (patrones + LLM) → anonimización
   ├─ 9. Guardas posteriores (spam del modelo, keywords+OTRO)
   └─ 10. Decisión de estado → revisión humana si aplica → agregación pública
```

Principio: **la IA es cara y falible**; las capas baratas filtran antes y las
decisiones con evidencia insuficiente o contradictoria van a un humano.

## 2. Las capas

### 2.1 Entrada y cola
- `POST /api/reportes` valida (Zod), aplica rate limits y cifra el texto original
  (AES-256-GCM). El texto nunca se modifica (posible evidencia).
- El procesamiento es asíncrono: pg-boss → worker → `POST /api/reportes/procesar`.

### 2.2 Embedding y deduplicación
- El texto se vectoriza con el modelo de embeddings local (`reportes.embedding_model`).
- `src/app/api/reportes/procesar/helpers/duplicados.ts`: si otro reporte del mismo
  identificador+plataforma supera el umbral de similitud (`reportes.duplicate.*`),
  el nuevo queda DUPLICADO y no se reclasifica.

### 2.3 RAG
- `src/lib/ai/dataset-retrieval.ts`: recupera correcciones humanas similares
  (dataset de entrenamiento) para dar contexto al clasificador.

### 2.4 Clasificación por rúbrica (spec 090) — el corazón

Objetiva (preguntas factuales), multi-etiqueta (0/1 por categoría) y multi-modelo
(N modelos diversos, 1 voto c/u, **secuencial** por RAM):

1. **Embudo permisivo** (`ia.rubrica.modelo_embudo`): lista categorías plausibles.
   Su trabajo es NO descartar de más (medición: la versión estricta mataba la
   categoría correcta en el 35% del banco, spec 092-US2); el filtro estricto viene
   después. Red de seguridad: si devuelve menos de 2, se evalúan todas.
2. **Votación**: cada modelo aplica el SET DE PREGUNTAS de cada categoría plausible
   (`ia.rubrica.preguntas`, editable por expertos en el tab "Rúbrica"). Cada pregunta
   es **DECISIVA** (obligatoria, el núcleo de la conducta) o de **CONTEXTO** (suma al
   análisis, no bloquea). Marca 1 solo si TODAS las decisivas se cumplen con
   **evidencia clara**; ante la duda en una decisiva, 0.
3. **% por categoría** = modelos que marcaron 1 / N.
4. **Persistencia auditable**: la matriz categoría × modelo × 0/1 y las preguntas
   cumplidas quedan en `clasificacion_rubrica_votos`.

**Las 3 reglas anti-sobre-etiquetado:**
1. Preguntas estrictas, denegar por defecto (1 solo con evidencia clara).
2. Umbral de presencia parametrizable (`ia.rubrica.umbral_presencia`): una categoría
   solo cuenta si su % lo supera.
3. Embudo primero: sin señal, no hay evaluación completa.

**Desacuerdo → humano**: si ninguna categoría supera el umbral (los modelos no se
ponen de acuerdo), el reporte va a REVISION_MANUAL. El desacuerdo entre modelos
diversos es la señal de incertidumbre (mejor que la auto-consistencia de 5 votos
del mismo modelo del motor anterior).

Motor: `src/lib/ai/rubrica.ts`. Config: parámetros `ia.rubrica.*`
(`enabled`, `preguntas`, `modelos`, `temperatura`, `umbral_presencia`,
`modelo_embudo`). `enabled=false` restaura el motor legacy.

### 2.5 PII y guardas
- `src/lib/ai/pii-detector.ts` + `anonimizador.ts`: datos personales se detectan y
  el texto publicable se anonimiza (víctima/denunciante, nunca el agresor).
- `helpers/guardas.ts`: reglas determinísticas (DOXING, keywords críticas, ráfagas,
  spam). Nunca reclasifican; escalan a revisión manual o priorizan.

### 2.6 Decisión de estado

- Se muestran **TODAS las conductas** que superan el umbral de presencia (ya no se
  elige una "principal" por gravedad, spec 092-US3). La gravedad solo prioriza la
  bandeja del operador (interno).
- Ninguna presente (desacuerdo), resultado OTRO, o guardas disparadas →
  **REVISION_MANUAL** (un humano reclasifica o descarta).
- Con categoría real y sin guardas → CLASIFICADO; un operador puede corregir
  (CORREGIDO) y esa corrección alimenta el RAG.
- El usuario final solo ve 2 estados: "En proceso" / "Procesado" (spec 089).

## 3. Superficie pública (qué se expone y qué no)

- La consulta pública muestra **hechos agregados** (conteos, plataformas, categorías
  de conducta, actividad baja/alta) — nunca score ni etiqueta de riesgo sobre una
  persona (constitución §1.3/§1.5).
- Solo cuentan los **reportes aprobados** (`esReporteAprobado`, spec 089-US3):
  estado CLASIFICADO/CORREGIDO ∧ categoría ∉ {SPAM, OTRO} ∧ no eliminado.
- El detalle de la matriz de la rúbrica es **privado del dueño** del reporte
  ("Mis reportes"), nunca público ni anónimo.

## 4. Responsables

| Componente | Fuente |
|---|---|
| Motor rúbrica | `src/lib/ai/rubrica.ts` |
| Semilla de preguntas | `src/lib/ai/rubrica-semilla.ts` (sembrada en `ia.rubrica.preguntas`) |
| Config de la rúbrica | `ParametroSistema` claves `ia.rubrica.*` (tab "Rúbrica") |
| Pipeline de procesamiento | `src/app/api/reportes/procesar/` (route + helpers) |
| Guardas | `src/app/api/reportes/procesar/helpers/guardas.ts` |
| Severidad | `scoring.severity.*` vía `src/lib/scoring.ts` (`obtenerSeveridades`) |
| Predicado de aprobación | `src/lib/reporte-aprobado.ts` |
| Worker/colas | `scripts/worker-reportes.mjs`, `src/lib/queue.ts` |

## 5. Historial

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0.0 | 2026-07-1x | Flujo original (guardas, clasificador, score) |
| 1.1.0 | 2026-07-24 | Post-090: rúbrica multi-etiqueta/multi-modelo, deduplicación explícita, decisión por gravedad+umbral, desacuerdo→humano, sin score público |
| 1.2.0 | 2026-07-24 | Post-092: guardas baratas previas, RAG tras dedup, embudo permisivo con red de seguridad, preguntas decisivas/contexto, todas las conductas sin principal |

> **Nota:** La documentación operativa para administradores del motor vive también
> en el tab "Documentación" del Centro de Control IA (`IaDocsPanel`). Mantener ambas
> al día juntas.
