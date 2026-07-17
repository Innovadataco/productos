# Plan F6 — Cascada de desempate para reducir revisión manual

## Objetivo

Reducir el **33.6% de revisión manual** de F5 **sin subir el `error_silencioso` de 21.9%**. Se aplica un modelo grande de desempate solo sobre los casos que no convergen en votación (confianza < 1.0).

## Diseño

### Cuándo se activa

- Caso con votos **no unánimes**: la moda no tiene 5/5 votos, por lo que `clasificarConVotos` devuelve `REVISION_MANUAL` bajo `umbral_revision = 1.0`.
- El desempate se ejecuta **después** de la votación y **después** del retrieval RAG.

### Prompt de desempate

Misma estructura que el prompt de clasificación F5, pero con contexto adicional:

- Los mismos **ejemplos RAG** recuperados para el caso.
- Las **categorías votadas** y su frecuencia (p. ej. `CONTACTO_INSISTENTE: 3, OTRO: 2`).
- La instrucción explícita: "Decide la categoría final considerando los votos y los ejemplos. Si persiste la ambigüedad, responde OTRO."

### Regla de decisión

1. Llamar al modelo de desempate con `temperature=0` y seed fijo (determinista).
2. Si la categoría del desempate **coincide con la moda** de los votos → el reporte se **auto-clasifica** con esa categoría.
3. Si el desempate **contradice la moda** o el caso era muy disperso (empate, etc.) → se mantiene `REVISION_MANUAL`.

> El desempate **refina**, nunca fuerza una categoría contra la moda.

## A/B de modelos

Ambos modelos ya están instalados en Ollama local:

- `qwen2.5:32b`
- `ornith:35b`

Configuración de la llamada de desempate:

- `temperature = 0`
- seed fijo (p. ej. `42`)
- `keep_alive = 0` (se descarga tras cada uso)
- Llamada única (sin votos)

El eval se corre sobre el **subconjunto no convergente** del fixture de 110 ejemplos (los casos que con F5 quedaron en `REVISION_MANUAL`).

## Métricas

Para cada modelo de desempate:

1. **% del 33.6% resuelto:** cuántos de los casos no convergentes logra auto-clasificar.
2. **% resuelto bien:** de los que resolvió, cuántos coinciden con la etiqueta dorada.
3. **`error_silencioso` del pipeline completo:** F5 + desempate.
4. **Latencia del desempate:** incluyendo carga del modelo con `keep_alive=0`.
5. **Recall de OTRO** vigilado.

## Criterio P4

- Si el `error_silencioso` del pipeline completo supera **21.9% + 1 pp = 22.9%** con un modelo, ese modelo queda **descartado**.
- Si **ambos** modelos superan 22.9%, F6 queda **deshabilitada** y se documenta.
- Si al menos uno de los dos modelos mantiene `error_silencioso` ≤ 22.9% **y** baja la revisión manual respecto a 33.6%, ese modelo se activa como desempate por defecto.

## Archivos esperados a tocar

- `src/lib/ai/classifier.ts` — detectar no-unanimidad y llamar desempate.
- `src/app/api/reportes/procesar/route.ts` — persistir flag `usoCascada` en `ClasificacionIA`.
- `prisma/seed.ts` — agregar parámetro `reportes.classification.modelo_desempate`.
- `scripts/eval-classifier-f6.ts` — eval A/B de desempate.
- `specs/010-rediseño-clasificador-ia/quickstart.md` — sección F6.
- `specs/010-rediseño-clasificador-ia/f6-report.md` — reporte de resultados.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Alto consumo de RAM al cargar modelo 32-35B | `keep_alive=0`; medir uso. |
| Latencia extremadamente alta por carga del modelo | Medir p95; si supera tolerancia, dejar deshabilitado. |
| Desempate introduce errores silenciosos | Regla estricta: solo si coincide con la moda. |
| Concurrencia con pipeline normal | Ollama encola; worker asíncrono tolera espera. |

## Estado de implementación

- Implementado en `src/lib/ai/classifier.ts` y `src/app/api/reportes/procesar/route.ts`.
- Eval A/B ejecutado sobre 110 ejemplos.
- Resultado: **ningún modelo pasó P4**. Ver [`f6-report.md`](./f6-report.md).
- F6 queda **deshabilitada por defecto** (`reportes.classification.modelo_desempate` vacío).
