# Research — 090-clasificacion-rubrica-multimodelo

**Fecha**: 2026-07-24 · **Autor**: ODIN

## R1 — Por qué rúbrica y no otra forma de multi-etiqueta

El motor anterior respondía UNA categoría por voto (juicio holístico): no hay forma de auditar por qué una categoría perdió. La rúbrica descompone cada categoría en indicadores factuales ("¿se compartió?", "¿es menor?", "¿es explícitamente sexual?"): el 0/1 por categoría es verificable pregunta por pregunta, y las preguntas cumplidas quedan persistidas (auditoría real). Alternativa descartada: multi-label libre (el modelo lista categorías) — sin preguntas estrictas el sobre-etiquetado es incontrolable; las 3 reglas anti-sobre-etiquetado (estrictas/denegar-por-defecto, umbral de presencia parametrizable, embudo) son la defensa.

## R2 — Multi-modelo diverso vs 5 votos del mismo modelo

5 votos del mismo modelo miden auto-consistencia (ADR_006: 83% de los errores salía con confianza=1.00). Con N modelos de familias distintas, el DESACUERDO es la señal: si los modelos no se ponen de acuerdo, el caso es genuinamente difícil → humano. El % por categoría (1s/N) reemplaza a la "confianza" como métrica de presencia, y el umbral de presencia (default 60% ≈ 2/3) es la compuerta configurable. Secuencial por RAM (ADR: la MacStudio no soporta 3 modelos grandes en paralelo); la cola async absorbe la latencia.

## R3 — Embudo: costo controlado

La rúbrica completa sobre 10 categorías × N modelos sería N×10 evaluaciones por reporte. El embudo (1 llamada al modelo rápido, default qwen2.5:14b) descarta categorías sin señal; la rúbrica corre solo en las plausibles (típicamente 1-3). Si el embudo falla, se evalúan todas (fallback seguro). Si no hay plausibles → OTRO → revisión humana, sin llamadas a los modelos.

## R4 — Decisión y convivencia con la 089

- Categorías presentes = % ≥ `ia.rubrica.umbral_presencia`.
- Principal = la de mayor severidad (`scoring.severity.*`) entre las presentes (mismo criterio que la 089-US2b: la gravedad manda sobre la frecuencia).
- Ninguna presente → desacuerdo → `REVISION_MANUAL`. OTRO → revisión (089-US2a intacta).
- `confianza` = % de la principal (compatible con el contrato existente: el umbral de revisión/estados/guardas no cambian).
- `esReporteAprobado`, 2 estados de usuario, exclusión SPAM/OTRO y la ausencia de nivelRiesgo se conservan sin tocar (validado por la suite completa).
- `ia.rubrica.enabled` permite volver al motor legacy por parámetro (rollback sin desplegar).

## R5 — Detalle privado: qué se muestra y por qué es suficiente

El dueño autenticado ve la matriz categoría × modelo (0/1), el % por categoría y el análisis por plantilla determinista (describe acuerdo, no inventa). NO hay "% de riesgo" global: la suma de evidencias por conducta informa sin veredicto. La privacidad se enforce en el endpoint (403 si `usuarioId !== user.id`), no solo en la UI.

## R6 — Sets de preguntas como parámetro (ADR_004)

`ia.rubrica.preguntas` (JSON por categoría) se siembra desde `src/lib/ai/rubrica-semilla.ts` (única fuente en código, derivada de la semántica de cada categoría) y se edita en vivo desde el tab "Rúbrica" (PUT por categoría) o Configuración. Modelos, temperatura, umbral y embudo igual (`ia.rubrica.*`). Nada quemado: el motor lee la config en cada clasificación.

## R7 — Semilla de preguntas: criterio de derivación

3-4 preguntas por categoría (10 categorías de riesgo), formato: (1) acción nuclear factual, (2) condición de víctima (menor), (3) condición de agresor/contexto (adulto/desconocido), (4) evidencia específica que evita confusión con la categoría vecina (p. ej. COMPARTIMIENTO: "¿la acción de compartir está presente?" vs SOLICITUD: "¿la pide?"). OTRO y SPAM no tienen set: son estados por defecto/anti-abuso, no conductas.
