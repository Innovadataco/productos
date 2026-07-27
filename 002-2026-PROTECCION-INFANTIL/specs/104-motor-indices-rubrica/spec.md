# Feature Specification: Motor de rúbrica — votación por índices (adiós al match verbatim)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-27

**Status**: FINALIZADO (implementada; medición de reproducibilidad = B5 de la cola 002-PI-025)

**Input**: "Motor: eliminar la fragilidad del match verbatim. El prompt exige copia VERBATIM
de las preguntas y el código compara con igualdad exacta de cadena; cualquier variación de
formato tumba la categoría aunque el modelo haya entendido el caso (medido en SPEC-098: los
mismos 20 casos dieron 95% y 65% el mismo día, mismos modelos, mismo servidor). El modelo
debe devolver ÍNDICES de pregunta en vez de texto; cumpleCategoria compara índices; la
estabilidad del índice ante reordenamientos del parámetro debe resolverse en el plan; y
cerrar I-30 (el modo --rubrica-only del eval lee un archivo que ya no existe)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Votación por índices, inmune al formato (Priority: P1)

Como responsable del motor de clasificación, quiero que los modelos devuelvan los NÚMEROS
de las preguntas que se cumplen en vez de copiar su texto, de modo que el cumplimiento de
una categoría dependa del criterio del modelo y no de su capacidad de copiar una cadena
exacta.

**Why this priority**: Es la fragilidad que hace al motor no medible hoy (varianza 95%↔65%
mismo día, mismos modelos). Sin match estable, cualquier medición o afinamiento es ruido.

**Independent Test**: Con votos de modelos reales, una categoría cuyas decisivas se cumplen
cuenta como cumplida aunque el modelo nunca produzca el texto exacto de la pregunta; y el
mismo caso evaluado dos veces con el mismo voto produce el mismo veredicto.

**Acceptance Scenarios**:

1. **Given** un voto de modelo que marca las preguntas 1 y 3 de una categoría con decisivas
   1 y 3, **When** se evalúa el cumplimiento, **Then** la categoría cuenta como cumplida
   (la comparación es por índices).
2. **Given** un modelo que antes fallaba por formato (prefijo "1.", "[DECISIVA]", "¿"
   ausente), **When** ahora devuelve índices, **Then** su voto correcto cuenta (el formato
   del texto ya no participa).
3. **Given** la salida estructurada del modelo, **When** devuelve índices fuera de rango o
   vacíos, **Then** el sistema los descarta con seguridad (no cumple por índices inválidos).

---

### User Story 2 - Persistencia legible y estable para auditoría (Priority: P2)

Como operador del expediente del reporte, quiero que lo persistido por voto siga siendo
legible y trazable a la pregunta de la rúbrica, aunque el voto viaje por índices, para que
la traza del expediente no dependa del orden del parámetro en el futuro.

**Why this priority**: Los índices son un formato de cable dentro de una llamada; lo que se
guarda para auditoría (expediente, SPEC-096) debe sobrevivir reordenamientos o ediciones
del parámetro de la rúbrica.

**Independent Test**: Un voto persistido muestra las preguntas cumplidas como textos
canónicos de la rúbrica (traducidos desde el índice en el momento del voto), y el
expediente los cruza con el parámetro vivo como hoy.

**Acceptance Scenarios**:

1. **Given** un voto por índices, **When** se persiste, **Then** se guardan los textos
   canónicos correspondientes (mapeados en el momento del voto, no los que escribió el
   modelo).
2. **Given** una edición posterior del texto de una pregunta en el parámetro, **When** se
   consulta el expediente, **Then** el comportamiento degrada igual que hoy (no rompe).

---

### User Story 3 - I-30: entrada del modo --rubrica-only (Priority: P3)

Como medidor del motor, quiero que el archivo de entrada del modo `--rubrica-only` del
runner sea configurable por CLI (o apunte al baseline), porque el archivo que leía por
defecto ya no existe y el modo está roto.

**Why this priority**: Sin esto no se puede re-medir solo la rúbrica (la medición que ZEUS
ordenará tras esta spec).

**Independent Test**: El modo `--rubrica-only` arranca sin errores con el archivo por
defecto o con uno pasado por argumento.

**Acceptance Scenarios**:

1. **Given** el baseline existente, **When** corre `--rubrica-only` sin argumentos extra,
   **Then** el runner lee el baseline y no lanza ENOENT.
2. **Given** un archivo alternativo, **When** se pasa por argumento CLI, **Then** el runner
   lo usa como fuente del legacy.
3. **Given** la ruta de escritura, **When** termina la corrida, **Then** se mantiene sin
   cambios (fuera de alcance).

---

### Edge Cases

- Índices duplicados o fuera de rango en la respuesta del modelo: se descartan; nunca
  cuentan como pregunta cumplida.
- Categoría sin decisivas: comportamiento actual intacto (basta el 0/1 del modelo).
- Parámetro reordenado entre la construcción del prompt y la evaluación del voto: no puede
  ocurrir dentro de una misma clasificación (la numeración se construye y consume en la
  misma llamada); entre clasificaciones no importa porque los índices no se persisten.
- Respuesta del modelo con textos (formato viejo): la clasificación los ignora con
  seguridad (no es compatible hacia atrás a propósito: una variable a la vez).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El prompt de votación numera las preguntas por categoría y pide los NÚMEROS de
  las que se cumplen; la salida estructurada del voto usa una lista de enteros en vez de
  cadenas.
- **FR-002**: El cumplimiento de una categoría se evalúa comparando índices de pregunta (las
  decisivas deben estar TODAS entre los índices reportados), nunca por igualdad de cadenas.
- **FR-003**: Índices inválidos (fuera de rango, duplicados) se descartan con seguridad y
  nunca cuentan como cumplimiento.
- **FR-004**: Lo persistido por voto (auditoría/expediente) sigue siendo el texto canónico
  de la pregunta, traducido desde el índice en el momento del voto; los índices no se
  persisten.
- **FR-005**: La estabilidad del índice queda garantizada por construcción: la numeración se
  genera y consume dentro de la misma llamada de clasificación (el reordenamiento del
  parámetro entre corridas no afecta; ver plan para el argumento completo y la alternativa
  de id estable evaluada).
- **FR-006**: I-30 — la entrada del modo `--rubrica-only` es un argumento del CLI
  (p.ej. `--legacy-desde=<ruta>`) con default al baseline existente
  (`resultados-dual-095-baseline-pre098.json`); la ruta de escritura no cambia.
- **FR-007**: NO se tocan los textos de las preguntas, NI la terna de modelos, NI el umbral
  del 60%, NI el default productivo (sigue LEGACY, D-19).

### Key Entities

- **Voto de rúbrica por modelo**: por categoría, 0/1 + lista de índices de preguntas
  cumplidas (transporte), con persistencia como textos canónicos (auditoría).
- **Pregunta de rúbrica**: orden dentro de su set (fuente del índice), texto canónico, tipo
  (decisiva/contexto), activo.

## Success Criteria *(mandatory)*

- **SC-001**: El 100% de los cumplimientos de categoría se evalúan por índice (0
  comparaciones por igualdad de cadenas en la ruta de votación).
- **SC-002**: Un voto bien formado por índices siempre cuenta, sin depender de formato de
  texto (0 fallos por "1.", "[DECISIVA]" o "¿" ausente).
- **SC-003**: Lo persistido por voto es 100% texto canónico de la rúbrica (trazable al
  parámetro vivo como hoy).
- **SC-004**: `--rubrica-only` arranca sin ENOENT con su default y acepta archivo por CLI
  (I-30 cerrado).
- **SC-005**: Terna, umbral y textos de preguntas bit a bit idénticos al inicio (diff de la
  rúbrica y parámetros sin tocar esos campos).
- **SC-006**: Gate verde (lint + test + tsc + build) con tests actualizados al nuevo contrato.

## Assumptions

- NO se corre ninguna evaluación del banco en esta spec: la reproducibilidad se demuestra
  con dos corridas completas de 200 casos que ZEUS ordena después.
- El motor productivo sigue siendo LEGACY (D-19); esta spec no cambia el default.
- El formato viejo (textos) no se soporta en compatibilidad: los votos son siempre del
  esquema nuevo tras el despliegue; los votos persistidos históricos (textos) se leen como
  hoy (el expediente ya los consume como textos).
