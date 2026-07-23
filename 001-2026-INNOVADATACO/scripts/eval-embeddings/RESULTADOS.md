# Evaluación de modelos de embeddings — corpus normativo de transporte

**Fecha**: 2026-07-22 · **Ejecutado por**: ODIN · **Corpus**: 25 actos normativos de
transporte (MinTransporte, SuperTransporte, decretos presidenciales)

Reproducible con:

```bash
node scripts/eval-embeddings/evaluate.mjs \
  --corpus-path=<ruta> \
  --models=nomic-embed-text,bge-m3,snowflake-arctic-embed2,paraphrase-multilingual
```

## Resumen ejecutivo

**La elección del modelo de embeddings es secundaria.** El factor que decide la calidad
de esta búsqueda es la **arquitectura híbrida** (decisión D-019), no el modelo: los
cuatro modelos evaluados topan en **recall@1 = 0,40–0,50 para consultas por
identificador**, y entre el **60 % y el 88 %** de todos sus fallos son el mismo error —
confundir documentos hermanos de la misma familia normativa.

**Recomendación: mantener `nomic-embed-text` con dimensión 768.** No porque gane en
calidad bruta (no gana), sino porque la ventaja del mejor modelo es de **una sola
pregunta sobre 22** y cuesta cambiar el esquema de la base, duplicar la latencia de
indexación y añadir 33 % de disco. Ese margen no justifica el coste; la mejora real
vendrá de la rama FTS.

## Corpus

| | |
|---|---|
| PDFs entregados | 25 |
| **Con capa de texto (evaluados)** | **21** |
| **Sin capa de texto (excluidos)** | **4** |
| Fragmentos generados | 678 |
| Preguntas evaluadas | 22 |

### ⚠️ Hallazgo: 4 documentos son escaneos sin OCR

No tienen capa de texto: `pdftotext` extrae **cero bytes**. El pipeline actual del
proyecto (pdf2json) tampoco extraería nada de ellos.

| Documento | Tamaño PDF | Diagnóstico |
|---|---|---|
| **DECRETO-1079-2015** | 9,3 MB | 400 páginas, escáner Kodak, imágenes CCITT bitonales |
| Mintransporte Resolución 378 de 2013 | 0,3 MB | Escáner HP, JPEG |
| Mintransporte Resolución 3600 de 2001 | 0,1 MB | Imagen indexada |
| Mintransporte Resolución 36325 de 2021 | 5,8 MB | "Microsoft: Print To PDF" sobre imágenes |

El más grave es el **Decreto 1079 de 2015**: es el Decreto Único Reglamentario del
Sector Transporte, la norma marco de todo el corpus. Sin OCR queda **invisible** para
cualquier búsqueda, semántica o textual.

## Condiciones de la comparación

Todos los modelos recibieron **exactamente los mismos 678 fragmentos** y las mismas 22
preguntas. Si cada modelo hubiera recibido un troceado distinto, la comparación mediría
el troceado y no el modelo.

- **Troceado**: estructural (corta por CONSIDERANDO / RESUELVE / ARTÍCULO / numerales de
  anexo), máx. 1800 caracteres, solape 200, con fallback por tamaño respetando párrafo o
  frase.
- **Similitud**: coseno (la misma métrica que usará la aplicación, D-020).
- **Ranking de documentos**: max-pooling sobre sus fragmentos, para que cada documento
  aparezca una sola vez (FR-014).

## Resultados

| Modelo | Dims | Disco pull | recall@1 | recall@5 | MRR | ms/frag | ms/consulta | Vectores @2000 docs |
|---|---|---|---|---|---|---|---|---|
| **nomic-embed-text** | **768** | 274 MB | 0,591 | 0,864 | 0,702 | **13,2** | ~20 | **190 MB** |
| bge-m3 | 1024 | 1,2 GB | 0,545 | 0,909 | 0,683 | 29,8 | ~40 | 253 MB |
| **snowflake-arctic-embed2** | 1024 | 1,2 GB | **0,636** | **0,909** | **0,748** | 30,8 | ~45 | 253 MB |
| paraphrase-multilingual | 768 | 562 MB | 0,545 | 0,864 | 0,677 | 13,5 | ~20 | 190 MB |

> **`multilingual-e5` no está en la librería oficial de Ollama** (404 en
> `ollama.com/library/multilingual-e5-large` y en la variante `zylonai/`). Se sustituyó
> por los dos modelos multilingües que sí existen: `snowflake-arctic-embed2` y
> `paraphrase-multilingual`.
>
> El pull de `bge-m3` ocupó **1,2 GB**, no los ~2,2 GB estimados.

### recall@1 por tipo de consulta — el dato que importa

| Modelo | Temática | Conceptual | **Identificador** |
|---|---|---|---|
| nomic-embed-text | 0,75 | 0,62 | **0,50** |
| bge-m3 | 0,75 | 0,50 | **0,50** |
| snowflake-arctic-embed2 | 0,75 | **0,75** | **0,50** |
| paraphrase-multilingual | **1,00** | 0,50 | **0,40** |

**Ningún modelo supera 0,50 en consultas por identificador.** No es un problema de
calidad del modelo: es una limitación estructural de la búsqueda vectorial. El número
del acto ("Circular 114 de 2025") es un token diminuto dentro de un documento largo, y
los documentos hermanos comparten prácticamente todo el contenido temático. El embedding
captura el tema —que es idéntico entre hermanos— y el identificador se diluye.

### Fallos por confusión entre documentos hermanos

| Modelo | Fallos | De ellos, hermano por hermano | % |
|---|---|---|---|
| nomic-embed-text | 9 | 7 | 78 % |
| bge-m3 | 10 | 6 | 60 % |
| snowflake-arctic-embed2 | 8 | 7 | **88 %** |
| paraphrase-multilingual | 10 | 8 | 80 % |

Ejemplos reales del corpus (todos los modelos fallan igual):

- **Q13** "Circular externa 20255330000094 del 10 de junio de 2025" → los cuatro modelos
  devolvieron la **Circular 114**. Mismo asunto, distinta fecha.
- **Q14** "Circular 114 de 2025... del 15 de agosto" → devolvieron la 94, la 164 o la 127.
- **Q22** "instrucciones de septiembre de 2025" → devolvieron la Resolución 3476 o la 1455.

El corpus contiene cinco circulares de SICOV con asuntos casi idénticos (94, 114, 124,
164 de 2025 y 14 de 2026) y tres resoluciones encadenadas (14306/2024 → 1455/2025 →
3476/2026). **Distinguirlas es exactamente para lo que sirve la rama FTS**: un `WHERE`
sobre el número resuelve en milisegundos lo que ningún embedding resuelve.

## Recomendación

### Modelo y dimensión: `nomic-embed-text`, 768 dims

| Criterio | Peso en la decisión |
|---|---|
| **Compatibilidad de esquema** | 768 coincide con el `vector(768)` ya migrado. Arctic y bge-m3 exigen 1024 → migración de esquema + re-vectorización total, que es el único caso que **D-022 excluye** del cambio libre de modelo. |
| **Diferencia de calidad real** | Arctic supera a nomic en **una pregunta de 22** (recall@1 0,636 vs 0,591). Con n=22, un acierto vale 4,5 puntos: está dentro del ruido. |
| **Latencia** | nomic indexa **2,3× más rápido** (13,2 vs 30,8 ms/fragmento). En el backfill del histórico, esa diferencia se multiplica por todo el corpus. |
| **Disco** | 190 MB vs 253 MB proyectados a 2000 documentos (+33 %). |

**Cuándo reconsiderar**: si tras implementar el híbrido las consultas **conceptuales**
siguen flojas, `snowflake-arctic-embed2` es el candidato — es el único que mejora ahí de
verdad (0,75 vs 0,62 en recall@1 conceptual). Pero esa migración debe decidirse con un
banco de preguntas más grande y validado, no con estos 22 casos.

### Lo que de verdad mueve la aguja

1. **El híbrido FTS + vectorial con RRF (D-019) queda validado empíricamente.** La
   evaluación no lo asume: lo demuestra. El techo de 0,50 en identificadores y el 60–88 %
   de fallos por documentos hermanos son precisamente lo que la rama FTS resuelve.
2. **OCR para los 4 escaneos.** El Decreto 1079 de 2015 es la norma marco del corpus y
   hoy es invisible. Ningún modelo de embeddings arregla esto.
3. **Metadatos como filtro de primera clase.** Muchos fallos se evitarían filtrando por
   número, entidad y año **antes** de buscar — que es justamente el orden que fija D-019
   (filtros antes de ambas ramas).

## Límites de esta evaluación

- **22 preguntas es una muestra pequeña.** Las diferencias de 1–2 aciertos entre modelos
  no son estadísticamente significativas. El banco es un **borrador pendiente de
  validación de Jelkin**; conviene ampliarlo antes de tomar decisiones irreversibles.
- Mide **recuperación**, no calidad de respuesta generada.
- Un solo troceado. Variar tamaño y solape probablemente mueva los resultados tanto como
  cambiar de modelo — y el banco ya permite probarlo sin tocar código
  (`--max-chars`, `--overlap-chars`).
- La proyección de disco cubre solo la columna vectorial: excluye el texto del fragmento
  y el índice HNSW.

---

# Barrido de troceado (D-027) — 2026-07-22

Ejecutado con **`nomic-embed-text` (768) únicamente**, ya congelado en D-024, para que
la única variable sea la configuración. Mismo corpus (21 documentos con texto) y mismo
banco (22 preguntas). Matriz completa: 2 estrategias × 3 tamaños × 4 enriquecimientos =
**24 configuraciones**.

```bash
node scripts/eval-embeddings/sweep.mjs --sizes=1000,1800,2800 \
  --enrich=ninguno,metadatos,titulo,metadatos+titulo
```

## (a) Troceado estructural vs ventana fija — **gana estructural, sin discusión**

Promedio de las 12 configuraciones de cada estrategia:

| Estrategia | MRR | recall@1 | recall@5 | ident@1 |
|---|---|---|---|---|
| **Estructural** (por marcas del acto) | **0,704** | **0,587** | **0,909** | **0,717** |
| Ventana fija (por tamaño) | 0,610 | 0,470 | 0,852 | 0,633 |
| **Diferencia** | **+0,094** | **+0,117** | +0,057 | +0,084 |

**9 de las 10 mejores configuraciones son estructurales.** La peor configuración de todo
el barrido es `tamano/1800/ninguno` (MRR 0,486); la mejor con ventana fija
(`tamano/1800/titulo`, MRR 0,681) queda por debajo de cinco configuraciones estructurales.

> **La decisión que ZEUS tomó en la spec estaba bien.** Pedía que se le dijera si perdía;
> no pierde: gana en las cuatro métricas y en todos los tamaños probados. Ya no es una
> decisión sin evidencia.

Cortar por CONSIDERANDO / RESUELVE / ARTÍCULO produce fragmentos que coinciden con
unidades de sentido jurídico; la ventana fija parte artículos por la mitad y mezcla el
final de uno con el principio del siguiente.

## (b) Enriquecimiento con metadatos — **la hipótesis se confirma, con matices**

Promedio de las 6 configuraciones de cada variante:

| Variante del prefijo | MRR | recall@1 | **ident@1** | concep@1 |
|---|---|---|---|---|
| Ninguno | 0,602 | 0,462 | 0,533 | **0,354** |
| Metadatos del texto (tipo, número, año, entidad, fecha) | 0,650 | 0,485 | 0,550 | 0,312 |
| **Solo título** | 0,685 | **0,599** | **0,883** | 0,312 |
| Metadatos + título | **0,693** | 0,568 | 0,733 | 0,312 |

**Mejor configuración global**: `estructural / 1800 / titulo` →
**MRR 0,803 · recall@1 0,727 · recall@5 0,909 · ident@1 0,90**

Frente a la línea base (`estructural/1800/ninguno`, MRR 0,702, ident@1 0,50):
**MRR +0,101 y consultas por identificador +0,40 (de 0,50 a 0,90)**.

### Tres matices que cambian cómo hay que leer esto

**1. El título hace casi todo el trabajo; los metadatos extraídos del texto, poco.**
Antepone solo número, entidad y fecha → ident@1 pasa de 0,533 a 0,550 (**+0,017**,
ruido). Antepone solo el título → 0,883 (**+0,350**). Y combinar ambos es *peor* que el
título solo (0,733): los metadatos añaden ruido que diluye la señal del título.

**2. Mi medición probablemente exagera el efecto del título.** El "título" de esta
evaluación es el nombre del archivo, y en este corpus los nombres son excepcionalmente
limpios (`SuperTransporte Circular 114 DE 2025`), muy parecidos a como están redactadas
las preguntas. En producción el título es un campo real —la aplicación usa el nombre del
archivo como valor por defecto (`documents/route.ts`)— pero su calidad es variable. Con
títulos pobres ("escaneo_3.pdf"), la ganancia se evapora. **La cota inferior defendible
es la de los metadatos extraídos del texto: +0,017. La cota superior es +0,350.**

**3. El enriquecimiento degrada las consultas conceptuales, siempre.** concep@1 baja de
0,354 a 0,312 en las **tres** variantes de enriquecimiento. El prefijo ocupa espacio
semántico del fragmento: gana identificación, pierde comprensión. Es un intercambio, no
una mejora gratuita.

## ¿Cambia el diseño de la spec 003?

**Sí, en un punto concreto**: el texto que se vectoriza deja de ser igual al texto que se
almacena. Hoy la spec asume implícitamente que se vectoriza el contenido del fragmento;
hay que separar ambos conceptos y hacer el prefijo **configurable** (§0.7): qué campos lo
componen y si se aplica.

**Pero recomiendo NO darlo por decidido todavía**, por una razón de fondo:

> El enriquecimiento ataca **exactamente el mismo fallo** que la rama FTS (D-019): las
> consultas por identificador. Si el FTS ya resuelve "Circular 114 de 2025" con un
> `WHERE` sobre el número —y lo hará, de forma exacta y barata—, el enriquecimiento
> aportaría poco y **seguiría cobrando su peaje en las consultas conceptuales**.

Propuesta: implementar el prefijo como opción configurable, **desactivada por defecto**,
y volver a medir con el híbrido ya montado. El banco queda como arnés de regresión
(D-028) precisamente para eso: entonces se decide con datos si el enriquecimiento suma
algo por encima del FTS o solo estorba a las conceptuales.

## Parámetros recomendados para la implementación

| Parámetro | Valor | Base |
|---|---|---|
| Estrategia de troceado | **estructural** | Gana en las 4 métricas y en los 3 tamaños |
| Tamaño de fragmento | **1800** caracteres | Mejor MRR en estructural (0,702 sin enriquecer, frente a 0,701 con 1000 y 0,610 con 2800) |
| Solape | 200 caracteres | No barrido; conviene medirlo en el siguiente ciclo |
| Prefijo de metadatos | **configurable, apagado por defecto** | Ver razonamiento arriba |

## Límite de este barrido

Sigue siendo **una muestra de 22 preguntas**: un acierto vale 4,5 puntos de recall. Las
conclusiones robustas son las que se sostienen en todo el barrido —que estructural gana
y que el prefijo ayuda a los identificadores—, no las diferencias finas entre
configuraciones vecinas. El solape (200) no se varió.
