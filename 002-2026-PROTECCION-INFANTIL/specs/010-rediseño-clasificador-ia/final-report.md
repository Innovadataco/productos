# Reporte final — Spec 010: Rediseño del Clasificador IA

**Rama:** `spec/010-rediseño-clasificador-ia`  
**Período:** 2026-07-15 → 2026-07-16  
**Fixture de evaluación:** `scripts/eval-fixture.json` (110 ejemplos, 11 categorías)  
**Modelo base:** `ornith:9b` (clasificación + PII)  
**Embedding:** `nomic-embed-text`

---

## Resumen ejecutivo

El rediseño del clasificador IA concluye con **F7**. La arquitectura final es:

- **Clasificador:** RAG sobre correcciones de administrador + self-consistency de 5 votos (`umbral_revision = 1.0`).
- **Anonimización/PII:** detector determinístico propio fusionado con LLM.
- **Guardas de seguridad:** DOXING → `REVISION_MANUAL`; keywords críticas y ráfagas → `prioridadAlta` sin reclasificar.
- **Feedback loop:** confirmaciones y correcciones alimentan el dataset de entrenamiento y las métricas de precisión observada.

El KPI de producto (`error_silencioso < 5%`) **aún no se cumple**. La brecha restante es **20.8% → 5%**. No hay ajuste de prompt o de política de agregación en el fixture local que cierre esa brecha sin romper otra métrica; el camino documentado es iterar con correcciones reales de producción.

---

## Evolución de métricas por fase

| Fase | Configuración representativa | Accuracy | `error_silencioso` | `% REVISION_MANUAL` | Recall `OTRO` | Latencia p50 / p95 | Nota |
|---|---|---|---|---|---|---|---|
| **F0.5** | Taxonomía 11 categorías, dataset, labels UI | — | — | — | — | — | Infraestructura de clasificación |
| **F1** | Structured output, umbral 0.5 | 70.9% | 25.6% | 10.9% | 30% | ~2.3 / 2.4 s | Reemplazo de parseo manual |
| **F2** | Clasificación/PII separados, detector determinístico + LLM | 69.1% | 25.9% | 12.1% | 30% | ~2.3 / 2.4 s | No regresa la clasificación |
| **F3-revert (baseline)** | Llamada única, umbral 0.5 | 69.1% | 26.3% | 10.0% | 30% | 2.3 / 2.4 s | Línea base pre-rediseño |
| **F4 default** | Votos 5, `umbral = 0.8` | 70.0% | 28.0% | 15.5% | 30% | 6.0 / 6.3 s | Política testeada en eval formal |
| **F4 recovery** | Votos 5, `umbral = 1.0` | no medido* | 23.3% | 33.6% | 30% | ~6.0 / 6.3 s | Mejor política del sweep offline |
| **F5** | RAG + votos, `umbral = 1.0` | 68.2% | **21.9%** | **33.6%** | 30% | 6.0 / 6.4 s | Nueva línea base |
| **F6 (descartada)** | Cascada a `qwen2.5:32b` / `ornith:35b` | 68.2% | 31.7% / 30.4% | 5.5% / 7.3% | 30% | 9.2 / 24 s, 6.9 / 9.8 s | Falla P4; deshabilitada |
| **F7** | F5 + guardas keywords/rafaga/DOXING | 68.2% | **20.8%** | **34.5%** | 30% | 6.0 / 6.4 s | 3 activaciones; OTRO+keyword → revisión |

\* El sweep offline de F4 reportó `error_silencioso` y `% REVISION_MANUAL`, pero no accuracy global.

### Métricas segmentadas (F7)

| Segmento | Accuracy F7 | `error_silencioso` F7 | `% REVISION_MANUAL` F7 |
|---|---|---|---|
| Limpio | 76.4% | 18.2% | 20.0% |
| Ruidoso | 60.0% | 25.0% | 49.1% |

El 60% de accuracy en el segmento ruidoso es el principal limitante para reducir `error_silencioso` sin más datos de producción.

---

## Estado vs KPI de producto

**KPI:** `error_silencioso < 5%`.

| Estado | Valor actual | Brecha |
|---|---|---|
| ❌ No cumplido | 20.8% | 15.8 pp |

### Por qué no se cierra la brecha con más ingeniería de prompts

- El **piso teórico** del modelo/prompt actual es de ~15.5% (17/110 casos unánimes e incorrectos en F4).
- F5 (RAG) volteó solo **1/17** de esos casos con la siembra inicial de 15 ejemplos.
- F6 (cascada a modelo grande) confirmó erróneamente ~50% de las modas no convergentes, empeorando el error silencioso a ~31%.
- Las guardas F7 no reclasifican, pero el micro-fix final permite escalar a `REVISION_MANUAL` los casos `OTRO` con keywords críticas. Eso redujo `error_silencioso` de 21.9% a 20.8%.

### Camino documentado hacia < 5%

1. **Flywheel de correcciones reales.** Cada corrección de admin se anonimiza, guarda en `DatasetEntrenamiento` y se indexa como embedding.
2. **RAG con ejemplos de producción.** A medida que el pool de correcciones crece, los casos ruidosos y las fronteras problemáticas reciben ejemplos similares en el prompt.
3. **Precisión observada como termómetro.** El dashboard admin muestra `precisionObservada` por categoría. Solo cuando la precisión observada de una categoría sea > 90% se podrá bajar `% REVISION_MANUAL` para esa categoría sin riesgo de aumentar `error_silencioso`.
4. **Revisión periódica de fronteras.** Con datos reales, identificar confusiones persistentes (p. ej. `DIFUSION_NO_CONSENTIDA ↔ COMPARTIMIENTO_SEXUAL`, `SOLICITUD_MATERIAL → EXTORSION`) y ajustar ejemplos o taxonomía.

---

## Hallazgos centrales por fase

### F1 — Structured output
- El parseo manual se reemplazó por JSON Schema nativo de Ollama.
- Se descubrió que gran parte de la variabilidad inicial era **ruido por ausencia de determinismo**, no regresión real.

### F2 — Separación clasificación / PII
- Separar responsabilidades **no empeoró** la clasificación (`error_silencioso` 25.56% vs 25.88%, empate dentro del error observado).
- El detector determinístico propio superó a Microsoft Presidio en el dominio colombiano (recall 100% vs 71.4%, precisión 100% vs 76.9%).

### F3 — Revert a single-label + posibleAgresorPar
- El multi-label inicial introdujo ruido; se optó por categoría principal + categorías secundarias calculadas a partir de F4.
- La guarda DOXING escala a revisión manual sin cambiar la categoría principal.

### F4 — Self-consistency
- Con `umbral = 1.0` se logró `error_silencioso = 23.3%`, pero a costa de `revision_manual = 33.6%`.
- Se identificó que **~15.5% de los errores son unánimes** e irreducibles con agregación pura.

### F5 — RAG sobre correcciones
- RAG + votos `umbral = 1.0` redujo `error_silencioso` de 23.3% (F4) a **21.9%**.
- El valor del RAG depende del volumen y calidad de las correcciones reales.

### F6 — Cascada de desempate
- **Descartada para producción.** Tanto `qwen2.5:32b` como `ornith:35b` fallaron el criterio P4.
- Hallazgo clave: **el acuerdo entre modelos con errores correlacionados no constituye verificación independiente.**

### F7 — Guardas y precisión observada
- Keywords, ráfagas y DOXING no introducen regresión.
- **Micro-fix final:** un caso `OTRO` + keyword crítica escala a `REVISION_MANUAL` (la categoría principal no se toca). Esto bajó `error_silencioso` de 21.9% a 20.8%.
- Se habilita la confirmación de clasificaciones correctas como mecanismo de feedback.
- Se expone `precisionObservada` por categoría en el dashboard admin.

---

## Validación final del spec

| Tipo | Resultado |
|---|---|
| Lint | ✅ OK |
| Tests unitarios | **108/108** pasaron |
| TypeScript (`tsc --noEmit`) | ✅ OK |
| Build | ✅ OK |
| Eval F7 | ✅ `error_silencioso` 20.8%, `revision_manual` 34.5% (↓ 1.1 pp / ↑ 0.9 pp vs F5) |

### Archivos de referencia

- Plan maestro: [`spec.md`](./spec.md)
- Reportes por fase:
  - F4: [`f4-recovery-report.md`](./f4-recovery-report.md)
  - F5: [`plan-f5.md`](./plan-f5.md)
  - F6: [`f6-report.md`](./f6-report.md)
  - F7: [`f7-report.md`](./f7-report.md)
- Resultados JSON: `eval-results/f{3,4,5,6,7}-*.json`

---

## Recomendaciones y próximo trabajo

1. **No activar F6 en producción** con la regla actual.
2. **Monitorear `precisionObservada` por categoría** semanalmente; es el principal input para ajustar `% REVISION_MANUAL`.
3. **Alimentar el RAG con correcciones reales** antes de intentar bajar la revisión manual.
4. **Mantener `% REVISION_MANUAL = 34.5%`** hasta que `error_silencioso` baje por debajo de ~10% con datos reales.
5. **Revisar el recall de `OTRO` (30%)** cuando haya suficientes ejemplos de producción; no expandir keywords como atajo.
