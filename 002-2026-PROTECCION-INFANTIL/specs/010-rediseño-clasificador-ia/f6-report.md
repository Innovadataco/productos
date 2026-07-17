# F6 — Cascada de desempate: reporte de evaluación

## Veredicto

La cascada de desempate a modelo grande **no pasa el criterio P4** con ninguno de los dos candidatos evaluados. Por tanto **F6 queda deshabilitada por defecto** (`reportes.classification.modelo_desempate` vacío).

La decisión se mantiene implementada en código — el pipeline la activa solo cuando el parámetro está configurado — pero no se recomienda su uso con la regla de decisión actual.

## Línea de base previa (F5)

- `error_silencioso`: **21.9%**
- `% REVISION_MANUAL`: **33.6%**
- Criterio P4: `error_silencioso` ≤ 21.9% + 1 pp = **22.92%**

## A/B de modelos de desempate

Evaluado sobre los **110 ejemplos** del fixture, con el pipeline completo F5 + cascada. El subconjunto no convergente fue de **37/110** casos para ambos modelos.

### Tabla A/B — desempate sobre casos no convergentes

| Modelo | No convergentes | Resueltos | Resueltos bien | Mal confirmados | No resueltos | % resuelto | % resuelto bien | % mal confirmado |
|---|---|---|---|---|---|---|---|---|
| `qwen2.5:32b` | 37 | 31 | 14 | 17 | 6 | 83.8% | 37.8% | 45.9% |
| `ornith:35b` | 37 | 29 | 14 | 15 | 8 | 78.4% | 37.8% | 40.5% |

### Métricas del pipeline completo

| Modelo | Accuracy | `error_silencioso` | `% REVISION_MANUAL` | Recall OTRO | `posibleAgresorPar` | Latencia p50 | Latencia p95 |
|---|---|---|---|---|---|---|---|
| `qwen2.5:32b` | 68.2% | **31.7%** ❌ | 5.5% | 30.0% | 10.9% | 9.2 s | 24.0 s |
| `ornith:35b` | 68.2% | **30.4%** ❌ | 7.3% | 30.0% | 10.9% | 6.9 s | 9.8 s |

Ambos modelos superan el umbral P4 de **22.92%**.

### Latencia del desempate

| Modelo | Warmup | Desempate p50 | Desempate p95 | Load duration p50 |
|---|---|---|---|---|
| `qwen2.5:32b` | ~21.8 s | ~14.9 s | ~15.7 s | ~6.7 s |
| `ornith:35b` | ~19.8 s | ~3.0 s | ~3.3 s | ~1.6 s |

> Nota: con `keep_alive=0`, la latencia del desempate incluye la carga del modelo. `ornith:35b` fue sensiblemente más rápido una vez cargado.

## Análisis de la regla de decisión

La regla actual confirma la moda cuando el modelo grande coincide con ella. Esto resultó en una tasa de **mal confirmados** muy alta:

- `qwen2.5:32b`: 17/31 resueltos incorrectamente (~55% de los que resolvió).
- `ornith:35b`: 15/29 resueltos incorrectamente (~52% de los que resolvió).

Aunque el `% REVISION_MANUAL` baja drásticamente (de 33.6% a ~5-7%), el costo en `error_silencioso` es inaceptable: **sube ~9-10 puntos porcentuales** respecto a la línea base.

## Conclusiones

1. **No se activa F6 en producción** con la regla actual. El hallazgo central es empírico: **el acuerdo entre modelos con errores correlacionados no constituye verificación independiente**. Ambos modelos de desempate confirmaron erróneamente aproximadamente la mitad de las modas que resolvieron (~55% y ~52% de mal confirmados), lo que justifica mantener el trade-off de **33.6% de revisión manual** de F5 en lugar de delegar a una cascada que amplifica el error silencioso.
2. El problema principal no es el modelo de desempate, sino la regla "coincidir con la moda": la moda del modelo base ya es errónea en la mayoría de los casos no convergentes, por lo que confirmarla amplifica el error silencioso.
3. Una alternativa futura podría ser usar el modelo grande no para confirmar la moda, sino para re-clasificar de forma independiente y aceptar el resultado solo con confianza muy alta (p. ej. `confianza > 0.9` y/o que el ranking de votos muestre una segunda categoría muy débil). Eso requiere otro diseño y evaluación separada.
4. El parámetro `reportes.classification.modelo_desempate` se mantiene vacío en `prisma/seed.ts`. Configurarlo manualmente activa la cascada bajo la responsabilidad del operador.

## Archivos de referencia

- Plan original: [`plan-f6.md`](./plan-f6.md)
- Reporte detallado del eval: `eval-results/f6-cascada-classifier-1784191930013.json`
- Script de eval: `scripts/eval-classifier-f6.ts`
