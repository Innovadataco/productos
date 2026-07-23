# Research — Pipeline RAG (Fase 0, parcial)

**Spec**: [spec.md](./spec.md) · **Estado**: Draft (la spec no está aprobada; este research
se adelanta **solo** para dejar citable la evidencia del barrido que FR-001 exige).

Los datos crudos y su metodología completa viven en
[`scripts/eval-embeddings/RESULTADOS.md`](../../scripts/eval-embeddings/RESULTADOS.md),
generados por `evaluate.mjs` y `sweep.mjs` sobre el corpus normativo real (21 documentos
con texto, 22 preguntas). `reports/` está en `.gitignore`, así que las cifras se citan
aquí; ZEUS no las reprodujo (exige inferencia = turno, ADR_002) y auditó código y
trazabilidad, no los números.

## §1 — Troceado: estructural / 1800 medidos, solape 200 NO medido (D-029)

Barrido `43bbe1a0` (`sweep.mjs`), matriz 2 estrategias × 3 tamaños × 4 enriquecimientos =
**24 configuraciones**, `nomic-embed-text` 768 congelado (D-024) como única variable el
troceado.

**Estrategia — estructural gana, sin discusión** (promedio de las 12 configuraciones de
cada estrategia):

| Estrategia | MRR | recall@1 | recall@5 | ident@1 |
|---|---|---|---|---|
| **Estructural** | **0,704** | **0,587** | **0,909** | **0,717** |
| Ventana fija | 0,610 | 0,470 | 0,852 | 0,633 |

9 de las 10 mejores configuraciones son estructurales. → **default estructural, justificado.**

**Tamaño — 1800 gana en MRR estructural**: 0,702 (1800) frente a 0,701 (1000) y 0,610
(2800). → **default 1800, justificado.**

**Solape — 200: NO medido.** El barrido **no varió esta variable**. Entra como default
declarado sin evidencia. **No se presenta como justificado** en ningún documento (D-029).
El plan debe barrerlo en un ciclo propio o dejar constancia explícita de que nadie lo midió.

> **Límite del barrido**: muestra de 22 preguntas (un acierto = 4,5 puntos de recall). Solo
> son robustas las conclusiones que se sostienen en todo el barrido —estructural gana,
> 1800 es el mejor tamaño—, no las diferencias finas entre configuraciones vecinas.

## §2 — El texto que se vectoriza ≠ el que se almacena (D-030, D-031)

El barrido midió cuatro variantes de enriquecimiento (prefijo de metadatos delante del
fragmento, **solo para vectorizar**). Promedio de las 6 configuraciones de cada variante:

| Variante | ident@1 | **concep@1** |
|---|---|---|
| Ninguno | 0,533 | **0,354** |
| Metadatos del texto | 0,550 | 0,312 |
| Solo título | 0,883 | 0,312 |
| Metadatos + título | 0,733 | 0,312 |

**Lo que los datos sostienen limpio:**
- **Costo, medido limpio**: el enriquecimiento **baja concep@1 en las tres variantes**
  (0,354 → 0,312). El prefijo ocupa espacio semántico del fragmento.
- **Beneficio, sin medir limpio**: la única variante no contaminada (metadatos del texto)
  da **+0,017 en ident@1** = ruido. La fuerte (título, +0,350) está **contaminada por la
  fuga de etiqueta** (§4).

**Consecuencia de diseño (D-030)**: separar contenido almacenado del texto vectorizado; el
prefijo es configurable (§0.7) y su configuración pasa a ser **parte de la identidad del
espacio vectorial** junto al modelo (FR-021, FR-026). La rama **FTS indexa `contenido`
plano** (FR-027): si indexara el prefijo, el identificador contaría doble y la rama textual
dejaría de ser el control limpio.

**Decisión (D-031): apagado por defecto.** No por prudencia: es lo único que sostienen los
datos. Además, el enriquecimiento ataca **el mismo fallo que ya resuelve la rama FTS** (las
consultas por identificador), y cobra su peaje en las conceptuales —que es donde está el
valor de negocio y donde el sistema va peor—. Se reevalúa con el híbrido montado, juzgando
**ident@1 y concep@1 por separado, nunca por MRR global** (el banco es 10/22 identificador,
así que el MRR está dominado por lo que el FTS ya resuelve gratis).

## §3 — Registro por fragmento de modelo + enriquecimiento (D-030, extiende FR-021)

Si se enciende el prefijo y se re-vectoriza solo una parte del corpus, medio corpus queda
con prefijo y medio sin él. Sin registrar la configuración de enriquecimiento por fragmento
—además del modelo— la búsqueda mezclaría dos espacios vectoriales en silencio. Por eso
FR-021 pasa a exigir: cada fragmento registra **modelo + enriquecimiento**, la búsqueda
filtra por **ambos**, y el contador de pendientes de re-vectorizar cubre **las dos causas**.

## §4 — Fuga de etiqueta del banco (D-032)

`scripts/eval-embeddings/lib/enrich.mjs:62` antepone `doc.id` a cada fragmento, y `doc.id`
**es** el `documentoEsperado` del banco (el nombre del archivo). En la variante "título",
eso inyecta la respuesta correcta dentro del texto que se rankea. Ejemplo: Q14 pregunta por
la *"Circular 114 de 2025 de la Superintendencia de Transporte"* y el archivo se llama
`SuperTransporte  Circular 114 DE 2025`. **El +0,350 no es una cota superior optimista: no
es evidencia.**

**Corrección exigida (FR-028)**, antes de usar el banco como arnés de regresión (D-028):
`documentoEsperado` → **id opaco** sin relación con el texto que se rankea; **título** como
campo aparte con **calidad realista** (el corpus ya tiene un archivo llamado `3476`).
Mientras la fuga siga, el banco es **línea base firmada por el CEO** (D-034), no criterio de
aceptación. La corrección es tarea de implementación de la spec 003.

## Pendiente para el research completo (tras aprobación)

Este documento cubre **solo** lo que exigían D-029…D-032. Al aprobarse la spec, el research
de la fase de plan debe además decidir y justificar: umbral de similitud, `top-k` y pesos
RRF por defecto; política de reintentos y lotes de vectorización; forma exacta de la consulta
híbrida en SQL; y la medición del solape que aquí queda pendiente.
