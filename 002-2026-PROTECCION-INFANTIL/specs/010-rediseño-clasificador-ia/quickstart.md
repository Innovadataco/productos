# Quickstart: Rediseño del Clasificador IA

## Prerequisitos

- Ollama corriendo localmente con `ornith:9b` disponible.
- Para F4, configurar `OLLAMA_NUM_PARALLEL=2` (recomendado) en el entorno de Ollama. Los 5 votos se lanzan en tandas de ese tamaño para evitar saturar el servicio.
- PostgreSQL con pgvector operativo.
- Variables de entorno cargadas (`.env`).

## Validar el eval harness baseline

```bash
cd /Users/idc/productos/INNOVADATACO/002-2026-PROTECCION-INFANTIL
node --env-file=.env --import tsx scripts/eval-classifier-baseline.ts scripts/eval-fixture.json
```

**Resultado esperado**: reporte JSON en `eval-results/baseline-{timestamp}.json` con:
- accuracy global
- `precision_auto_clasificados`
- `error_silencioso`
- `% REVISION_MANUAL`
- métricas segmentadas limpio/ruidoso
- latencias p50/p95
- matriz de confusión 11x11

## Verificar reportes demo generados

```bash
node --env-file=.env --import tsx scripts/verificar-demo.ts
```

## Validar F0.5 — anonimización en correcciones

1. Crear un reporte con PII de NNA en el texto.
2. Procesar el reporte para que pase por anonimización (`textoOriginal` no null).
3. Corregir la clasificación desde el panel admin.
4. Verificar que `DatasetEntrenamiento.texto` NO contiene la PII original.
5. Verificar que `DatasetEntrenamiento.textoAnonimizado === true`.

## Validar F1 — structured output

1. Enviar un reporte y verificar que `ClasificacionIA.rawResponse` contiene JSON parseable sin regex.
2. Verificar que la categoría está dentro de las 11 categorías válidas.

## Validar F2 — PII determinística + LLM

1. Reporte con texto "mi hijo Juan estudia en el colegio San José".
2. Verificar que `contienePii === true` y `piiDetectada` incluye "Juan" y "colegio San José".

## Validar F3 — single-label + posibleAgresorPar + guarda DOXING

1. Enviar reporte con texto mezcla (ej. ofrecimiento de regalo + solicitud de encuentro).
2. Verificar que la categoría principal es la más relevante; `categoriasSecundarias` se llena a partir de F4.
3. Verificar que `posibleAgresorPar` se infiere correctamente.
4. Enviar reporte con datos personales + intención de publicar; verificar que la guarda DOXING escala a `REVISION_MANUAL` sin cambiar la categoría principal.

## Validar F4 — self-consistency / votación

### Diseño reproducible (S1)

Los 5 votos usan seeds fijos por índice (`[42, 123, 456, 789, 1024]`). Esto hace que:

- Dentro de un reporte haya dispersión controlada (cada voto tiene seed distinto).
- Los evals entre runs sean idénticos si el modelo/prompt/fixture no cambian.
- Con F4 validado, los evals de confirmación pueden reducirse a **1 run**.

### Política de agregación final (S2-S4)

Resultados del sweep offline sobre el eval F4 inicial (`ornith:9b`, 5 votos, temp 0.7):

| Política | `error_silencioso` | `% REVISION_MANUAL` | notas |
|---|---|---|---|
| umbral 0.5 (original) | 29.8% | 5.5% | no recupera F3 |
| umbral 0.6 | 29.8% | 5.5% | sin cambio (distribución de modas) |
| umbral 0.8 | 28.0% | 15.5% | mejor política testeada |
| margen moda-segunda ≥2 | 29.3% | 10.0% | mejora marginal |
| umbral 0.6 + margen ≥2 | 29.3% | 10.0% | sin ventaja sobre umbral 0.8 |

- **Techo irreducible con el modelo/prompt actual**: 17/110 casos (15.5%) son 5/5 unánimes e incorrectos. Estos no se arreglan con políticas de agregación; son insumo para F5 (RAG de correcciones) y F6 (modelo de desempate).
- **Fronteras más problemáticas**: `DIFUSION_NO_CONSENTIDA → COMPARTIMIENTO_SEXUAL`, `SOLICITUD_MATERIAL → EXTORSION`, `OTRO → CONTACTO_INSISTENTE`.

Configuración aplicada:

- `reportes.classification.umbral_revision = 0.8` (mejor política offline).
- `posibleAgresorPar` se decide por **voto mayoritario** (`≥3/5`); evita el sobre-disparo de la regla OR-de-5 (22.7% → ~10.0%).
- `min_score_categoria` permanece en 0.3.

Pasos de validación:

1. Ejecutar el eval harness:
   ```bash
   node --env-file=.env --import tsx scripts/eval-classifier-f4.ts scripts/eval-fixture.json
   ```
2. Verificar que el reporte incluye 1 run (determinismo confirmado) o la media de varios runs si se desea.
3. Procesar reporte con `n_votos=5`.
4. Verificar que `ClasificacionIA.votos` tiene 5 entradas.
5. Verificar que `confianza === votosGanador / 5`.
6. Verificar que `categoriasSecundarias` incluye categorías con fracción ≥ `min_score_categoria` (0.3).
7. Verificar que `posibleAgresorPar` coincide con `≥3/5` votos `true`.

## Validar F5 — RAG sobre correcciones

Veredicto F4 previo: no recuperado (`error_silencioso` 28.0% con umbral 0.8; 23.3% con umbral 1.0 pero 33.6% de revisión manual). Detalles en [`f4-recovery-report.md`](./f4-recovery-report.md).

### Resultados del eval A/B F5

| Configuración | `error_silencioso` | `% REVISION_MANUAL` | notas |
|---|---|---|---|
| RAG + votos (umbral 0.8) | 27.2% | 16.4% | base conservadora |
| RAG + llamada única (umbral 0.5) | 26.3% | 10.0% | paridad F3-revert |
| RAG + votos (umbral 1.0) | **21.9%** | **33.6%** | **política ganadora** |
| RAG + votos (margen ≥2) | 29.0% | 9.1% | — |

- **Ganador:** la **política `umbral 1.0`** sobre el brazo de votos.
- **Línea de base F5:** `error_silencioso = 21.9%`, `% REVISION_MANUAL = 33.6%`.
- **Anti-leakage:** verificado en eval; gemelos >0.98 son excluidos.
- **Efecto del RAG:** +1.4 pp de mejora sobre votos (27.2% → 21.9%), ~0 pp sobre llamada única, 1/17 casos unánimes erróneos volteados. El valor del RAG escalará con correcciones reales; siembra actual = 15 ejemplos.
- `posibleAgresorPar` se mantiene ~10%.
- **Decisión de producto:** se acepta 33.6% de revisión manual como configuración provisional para priorizar `error_silencioso` bajo; revisable tras F6 y con volumen real.

Reporte completo: `eval-results/f5-rag-classifier-1784187260732.json`.

### Pasos de validación

1. Tener al menos una corrección con embedding (o siembra inicial).
2. Crear un nuevo reporte con texto similar.
3. Verificar en logs que el prompt de clasificación incluye el ejemplo corregido.
4. En modo eval, verificar exclusión del propio registro (similitud >0.98).
5. Correr eval A/B RAG+votos vs RAG+llamada-única y quedarse con la base ganadora.

## Validar F6 — cascada de desempate (implementada, deshabilitada por defecto)

La cascada a modelo grande **está implementada** en `src/lib/ai/classifier.ts`, pero **deshabilitada por defecto** tras fallar el criterio P4 en el eval A/B. Ver [`f6-report.md`](./f6-report.md) para el reporte completo.

### Resultado del A/B F6

| Modelo de desempate | `error_silencioso` pipeline | `% REVISION_MANUAL` | % resuelto bien / mal confirmado |
|---|---|---|---|
| Línea base F5 | 21.9% | 33.6% | — |
| `qwen2.5:32b` | 31.7% ❌ | 5.5% | 37.8% / 45.9% |
| `ornith:35b` | 30.4% ❌ | 7.3% | 37.8% / 40.5% |

- Umbral P4: `error_silencioso` ≤ 22.92%.
- Ningún modelo cumplió P4; confirmar la moda del modelo base introdujo demasiados errores silenciosos.
- El parámetro `reportes.classification.modelo_desempate` permanece vacío en `prisma/seed.ts`.

### Headroom de RAM en este host

Hardware de referencia: Apple M4 Max, 36 GB RAM unificada.
Modelos base ya cargados en Ollama:

| Modelo | Descarga | RAM estimada en uso (Q4) |
|--------|----------|--------------------------|
| `ornith:9b` | 5.6 GB | ~5.6–6.0 GB |
| `nomic-embed-text` | 274 MB | ~0.3–0.4 GB |
| Sistema operativo + overhead | — | ~2.0 GB |
| **Total base** | **~5.9 GB** | **~8.0–8.4 GB** |

**RAM libre estimada para el modelo de desempate**: ~27.5 GB.
Eso deja margen para un modelo 27-32B Q4 (~18-22 GB en uso), quedando ~5-9 GB de headroom.

### Candidatos para desempate (~27-32B Q4)

| Modelo | Tag exacto | Descarga | RAM en uso Q4 estimada | Comando pull | Fortaleza esperada | keep_alive recomendado |
|--------|------------|----------|------------------------|--------------|--------------------|------------------------|
| `qwen2.5:32b` | `qwen2.5:32b` | 19 GB | ~20-22 GB | `ollama pull qwen2.5:32b` | Excelente español e instrucciones; buen razonamiento de fronteras. | `0` o `1m` (descargar tras cada uso) |
| `ornith:35b` | `ornith:35b` | 21 GB | ~21-23 GB | `ollama pull ornith:35b` | Mismo ecosistema que el modelo base; español coloquial LATAM sólido. | `0` o `1m` |
| `gemma2:27b` | `gemma2:27b` | ~15.5 GB | ~17-19 GB | `ollama pull gemma2:27b` | Buen rendimiento con la menor RAM del grupo; español aceptable. | `0` o `1m` |

> **Nota**: `qwen2.5:32b` y `ornith:35b` ya están instalados en este entorno. `gemma2:27b` es la alternativa si se prefiere menor consumo de RAM.

### Concurrencia con el pipeline normal

Si un reporte normal llega mientras la cascada F6 está corriendo:

- Ollama encolará la solicitud de clasificación/anonimización/embedding hasta que haya capacidad.
- El worker de reportes es asíncrono, por lo que no hay timeout HTTP inmediato; la latencia total del reporte normal aumentará.
- Con tres modelos cargados simultáneamente (`ornith:9b`, `nomic-embed-text`, modelo de desempate), el uso de RAM se acerca a los 28-30 GB, dejando poco margen. Esto puede forzar a macOS a comprimir/swapear páginas, lo que aumenta la latencia de ambos modelos.
- **Recomendación**: mantener `keep_alive=0` (o `1m`) para el modelo de desempate, de modo que se descargue inmediatamente después de cada uso y no compita con el pipeline normal.
- Si se espera alta frecuencia de cascadas, considerar aumentar la RAM del host o serializar explícitamente las llamadas de desempate con `OLLAMA_NUM_PARALLEL=1`.

Pasos de validación (cuando se active F6):

1. Instalar el modelo elegido.
2. Configurar `reportes.classification.modelo_desempate` con el nombre del modelo.
3. Enviar un texto ambiguo que genere votos dispersos.
4. Verificar que `ClasificacionIA.usoCascada === true`.
5. Medir el aporte de F6 por separado vs la línea de base de F4.

## Validar F7 — keywords, ráfagas, prioridad y precisión observada

### Eval de no-regresión

```bash
node --env-file=.env --import tsx scripts/eval-classifier-f7.ts scripts/eval-fixture.json
```

**Resultado esperado:** reporte en `eval-results/f7-guardas-classifier-{timestamp}.json` con:

- `error_silencioso` ≈ 20.8%
- `revision_manual` ≈ 34.5%
- `activacionesGuardas` ≥ 1 (depende del fixture)

### Keywords críticas

1. Enviar reporte con categoría `OTRO` que contenga términos críticos (p. ej. "MASNNA", "deepfake", "difundir").
2. Verificar que el estado final es `REVISION_MANUAL`.
3. Verificar que `Reporte.prioridadAlta === true`.
4. Verificar que `Reporte.keywordsDetectadas` incluye el término correspondiente.
5. Verificar que **la categoría principal no cambió** (la guarda no reclasifica).

Para reportes ya en `REVISION_MANUAL`, la guarda solo marca `prioridadAlta = true` sin cambiar el estado.

### Ráfagas

1. Enviar varios reportes contra el mismo `identificador` / `plataformaId` dentro de la ventana configurada (por defecto 3 reportes en 24 horas).
2. Verificar que los reportes a partir del tercero quedan en `REVISION_MANUAL` con `esRafaga === true` y `prioridadAlta === true`.
3. Verificar que `Reporte.keywordsDetectadas` incluye `"rafaga"`.

### DOXING

1. Enviar reporte que combine datos personales de un NNA + intención de publicar (p. ej. "voy a subir tu dirección y teléfono a un grupo").
2. Verificar que el estado final es `REVISION_MANUAL`.
3. Verificar `prioridadAlta === true` y `keywordsDetectadas` incluye `"doxing"`.

### Confirmación de clasificación correcta

1. En el panel admin, abrir un reporte en `REVISION_MANUAL` cuya categoría propuesta sea correcta.
2. Pulsar "Confirmar clasificación".
3. Verificar que se crea un `CorreccionAdmin` con `categoriaOriginal === categoriaCorregida`.
4. Verificar que `ClasificacionIA.confirmacionCorreccionId` apunta a esa corrección.
5. Verificar que el reporte pasa a estado `CLASIFICADO`.

### Precisión observada

1. Confirmar algunas clasificaciones correctas y corregir otras.
2. Ir a `/dashboard/admin/estadisticas`.
3. Verificar tabla "Precisión observada por categoría".
4. Verificar que `precisionObservada = confirmaciones / (confirmaciones + correcciones)`.

### Privacidad en alertas de alta prioridad

1. Configurar una suscripción de alerta para un identificador.
2. Enviar un reporte de alta prioridad contra ese identificador.
3. Verificar que el email de alerta indica "PRIORIDAD ALTA".
4. Verificar que el email **no incluye** el texto del reporte ni los términos detectados.

### Panel admin

1. Acceder a `/dashboard/admin`.
2. Verificar que la cola está ordenada con los reportes `prioridadAlta` primero.
3. Abrir un reporte prioritario y verificar la sección "Señales detectadas" con chips de keywords/rafaga.
4. Verificar que el detalle muestra los términos detectados.
