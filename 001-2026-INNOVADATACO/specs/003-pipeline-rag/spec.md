# Feature Specification: Pipeline RAG (chunking, embeddings y búsqueda semántica)

**Feature Branch**: `003-pipeline-rag`

**Created**: 2026-07-22

**Status**: Draft — pendiente de aprobación por ZEUS (arquitecto) y Jelkin (CEO)

**Input**: User description: "Construir lo que H-05 reveló que no existe: (a) chunking
del texto extraído en el worker; (b) embeddings vía Ollama con nomic-embed-text (768
dims), con modelo y baseUrl CONFIGURABLES por el módulo de configuración existente
respetando la precedencia de D-008; (c) poblar DocumentoChunk en el job de ingesta con
reintentos y estados coherentes; (d) búsqueda semántica real en api/documents/search con
pgvector, definiendo cómo se consulta y cómo se combina con la búsqueda textual actual;
(e) backfill de los documentos ya ingeridos; (f) tests con embeddings mockeados, dejando
la validación real como tarea de turno aprobado; (g) fe de erratas de la constitución
§3.4. Alcance decidido por ZEUS."

## Contexto: qué existe y qué no (verificado el 2026-07-22)

El hallazgo **H-05** de la spec 001 (research D-13) se confirmó ejecutando T018 con turno
aprobado: tras ingerir un PDF de prueba, `select count(*) from "DocumentoChunk"` devolvió
**0**. Inspección posterior del código:

| Pieza | Estado real | Evidencia |
|---|---|---|
| Tabla `DocumentoChunk` con `vector(768)` | **Migrada y vacía** | `prisma/migrations/20260709145941_add_documento_chunk/` aplicada; count = 0 |
| Extensión `pgvector` | **Habilitada** | `CREATE EXTENSION IF NOT EXISTS vector` en esa migración |
| Índice para búsqueda vectorial | **Inexistente en la práctica** | La migración crea `CREATE INDEX ... ON "DocumentoChunk"("embedding")` — índice **por defecto (btree)**, no `ivfflat` ni `hnsw`: no acelera búsqueda por similitud |
| Chunking | **No existe** | 0 referencias a chunk/embed en `src/lib/` y `scripts/worker.mjs`. Lo único parecido es `clean.slice(0, 3000)` en `documentProcessor.ts:121`, que recorta el texto para la extracción por reglas: **no es chunking** |
| Generación de embeddings | **No existe** | `src/lib/modelClients.ts` solo implementa `/api/generate` (generación); no hay llamada a la API de embeddings de Ollama |
| Búsqueda semántica | **No existe** | `api/documents/search` carga documentos con Prisma y puntúa en memoria contando términos presentes (`text.includes(term)`), sin vectores |
| Configuración de modelo de embeddings | **UI lista, backend desconectado** | `ParametrizacionTab.tsx` ya guarda `embedding_model` y `generation_model` en `ModuleSetting` (módulo `base_oficial`), pero **nada lee `ModuleSetting`**: el worker usa `aiModel.findFirst({ active: true })` |

Dos consecuencias que esta spec debe resolver además del pipeline en sí:

1. La **superficie de configuración ya existe** (US2 no tiene que inventarla: tiene que
   consumirla). Hoy el usuario elige un modelo de embeddings en la UI y no surte efecto.
2. Prisma **no soporta el tipo `vector`** (`Unsupported("vector(768)")`): ni la inserción
   del embedding ni la consulta por similitud pueden expresarse con el cliente tipado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trocear el documento en fragmentos indexables (Priority: P1)

Como sistema de ingesta, quiero partir el texto extraído del PDF en fragmentos coherentes
con solape, para que cada fragmento sea una unidad recuperable con significado propio.

**Why this priority**: sin chunks no hay nada que vectorizar. Es la base de todo el
pipeline y la única pieza que no depende de infraestructura externa.

**Independent Test**: pasar un texto conocido al troceador y verificar número de
fragmentos, límites de tamaño y solape, sin BD ni Ollama.

**Acceptance Scenarios**:

1. **Given** un texto de N caracteres, **When** se trocea, **Then** se obtienen
   fragmentos cuyo tamaño no excede el máximo configurado y que se solapan entre sí en
   la medida definida.
2. **Given** un documento con estructura normativa (ARTÍCULO, CONSIDERANDO), **When** se
   trocea, **Then** los cortes respetan los límites naturales del texto (párrafo o frase)
   en lugar de partir palabras a la mitad.
3. **Given** un texto más corto que el tamaño de fragmento, **When** se trocea,
   **Then** se obtiene exactamente un fragmento con todo el texto.
4. **Given** un texto vacío o solo con espacios, **When** se trocea, **Then** se obtienen
   cero fragmentos y el pipeline lo trata como documento sin contenido indexable.
5. **Given** los fragmentos generados, **When** se persisten, **Then** conservan su orden
   original (campo `orden`) empezando en 0 y sin huecos.

---

### User Story 2 - Vectorizar con el modelo que el usuario configuró (Priority: P1)

Como administrador, quiero que el modelo de embeddings y su URL salgan de la
configuración existente (Configuración → Base Oficial), para no tener nada cableado en el
código y poder cambiar de modelo sin tocar el repositorio.

**Why this priority**: es el requisito de configurabilidad que ZEUS fijó y, además,
conecta una UI que hoy no hace nada.

**Independent Test**: con el cliente de embeddings mockeado, verificar que la resolución
del modelo y de la URL sigue la precedencia acordada, sin llamar a Ollama.

**Acceptance Scenarios**:

1. **Given** un `ModuleSetting` con `module = "base_oficial"` y
   `settingKey = "embedding_model"` apuntando a un `AiModel`, **When** el pipeline
   vectoriza, **Then** usa ese modelo y su `baseUrl`.
2. **Given** que ese `AiModel` tiene `baseUrl` definido, **When** se resuelve la URL,
   **Then** ese valor manda sobre `OLLAMA_BASEURL` y sobre el default
   (precedencia de **D-008**: BD/UI > variable de entorno > default).
3. **Given** que el `AiModel` no tiene `baseUrl`, **When** se resuelve la URL,
   **Then** se usa `OLLAMA_BASEURL` y, en su ausencia, el default local.
4. **Given** que no hay `embedding_model` configurado, **When** se intenta vectorizar,
   **Then** el sistema no adivina un modelo: falla de forma explícita y trazable, y el
   documento queda en un estado que permite reintentar tras configurarlo.
5. **Given** un modelo cuyo vector no mide 768 dimensiones, **When** se intenta
   persistir, **Then** se rechaza con un error claro (el esquema es `vector(768)`) en
   lugar de corromper la tabla.

---

### User Story 3 - Poblar los fragmentos como parte de la ingesta (Priority: P1)

Como operador, quiero que subir un PDF deje sus fragmentos vectorizados en la base, con
estados y reintentos coherentes con el pipeline actual, para que la ingesta sea una sola
operación observable.

**Why this priority**: es el objetivo central (`DocumentoChunk` deja de estar vacía) y
cierra H-05.

**Independent Test**: ejecutar el job con el cliente de embeddings mockeado y verificar
los registros creados y las transiciones de estado, sin Ollama real.

**Acceptance Scenarios**:

1. **Given** un documento recién ingerido con texto extraído, **When** el worker procesa
   el job, **Then** `DocumentoChunk` contiene un registro por fragmento, con su
   `contenido`, su `orden` y su `embedding` de 768 dimensiones.
2. **Given** un documento que ya tenía fragmentos, **When** se reprocesa, **Then** no se
   duplican: los fragmentos previos del documento se reemplazan de forma consistente.
3. **Given** un fallo transitorio del servicio de embeddings, **When** el worker
   vectoriza, **Then** reintenta según la política definida antes de dar el documento por
   fallido.
4. **Given** que la vectorización falla de forma definitiva, **When** termina el job,
   **Then** el documento queda en un estado de revisión con el motivo registrado en
   auditoría, **sin** perder el texto ya extraído ni los metadatos.
5. **Given** un documento sin texto extraíble, **When** se procesa, **Then** se completa
   sin fragmentos y sin marcar error de embeddings (no hay nada que vectorizar).
6. **Given** cualquier resultado, **When** termina el job, **Then** la auditoría permite
   reconstruir qué pasó (fragmentos generados, modelo usado, latencia, error si lo hubo).

---

### User Story 4 - Búsqueda semántica real (Priority: P2)

Como usuario de Base Oficial, quiero encontrar normativa por significado y no solo por
coincidencia literal de palabras, para localizar documentos que usan otra terminología.

**Why this priority**: es el valor visible para el usuario, pero depende de que US1–US3
hayan poblado los fragmentos.

**Independent Test**: con el embedding de la consulta mockeado y la consulta vectorial
aislada, verificar el orden por similitud y la forma de la respuesta.

**Acceptance Scenarios**:

1. **Given** fragmentos vectorizados, **When** se busca una frase,
   **Then** se devuelven documentos ordenados por similitud (más similar primero), con la
   puntuación de similitud incluida en la respuesta.
2. **Given** una consulta cuyo significado coincide con un documento que **no** comparte
   sus palabras literales, **When** se busca, **Then** ese documento aparece en los
   resultados (cosa que la búsqueda textual actual no logra).
3. **Given** los filtros existentes (`tipo`, `entidad`, `sector`, rango de fechas),
   **When** se busca semánticamente, **Then** los filtros se siguen respetando.
4. **Given** que la base aún no tiene fragmentos (o el servicio de embeddings no está
   disponible), **When** se busca, **Then** el sistema responde de forma útil y
   documentada (según la estrategia de convivencia que defina el plan) en vez de fallar
   con un error opaco.
5. **Given** un documento, **When** aparece en los resultados, **Then** se devuelve una
   sola vez, aunque varios de sus fragmentos coincidan.
6. **Given** un error interno de la búsqueda, **When** se responde, **Then** no se filtra
   `err.message` al cliente (contrato de la spec 002, FR-004).

---

### User Story 5 - Backfill de lo ya ingerido (Priority: P2)

Como operador, quiero vectorizar los documentos que ya están en la base sin fragmentos,
para que la búsqueda semántica cubra el histórico y no solo lo que se suba a partir de
ahora.

**Why this priority**: sin backfill, la funcionalidad solo sirve para documentos nuevos y
el histórico queda invisible.

**Independent Test**: ejecutar el proceso de backfill contra un conjunto de documentos
simulados y verificar que procesa solo los que no tienen fragmentos.

**Acceptance Scenarios**:

1. **Given** documentos con texto y **sin** fragmentos, **When** se ejecuta el backfill,
   **Then** quedan vectorizados igual que si se hubieran ingerido hoy.
2. **Given** documentos que **ya** tienen fragmentos, **When** se ejecuta el backfill,
   **Then** se omiten (no se re-vectorizan ni se duplican), salvo que se pida
   explícitamente reprocesarlos.
3. **Given** un backfill interrumpido a la mitad, **When** se vuelve a ejecutar,
   **Then** retoma sin repetir lo ya hecho (es idempotente y reanudable).
4. **Given** un backfill en curso, **When** se observa su avance, **Then** informa
   progreso y resumen final (procesados, omitidos, fallidos).

---

### User Story 6 - Suite verde sin Ollama ni BD (Priority: P1)

Como equipo, quiero que todo el pipeline sea testeable con embeddings simulados, para no
romper la regla ganada en la spec 002: la suite corre sin infraestructura.

**Why this priority**: es una condición de contorno de todo el trabajo, no un extra. Si
se incumple, la spec 002 se deshace.

**Independent Test**: `npm run test` con los contenedores abajo y sin Ollama.

**Acceptance Scenarios**:

1. **Given** el pipeline implementado, **When** se ejecuta `npm run test` sin BD y sin
   Ollama, **Then** la suite pasa entera.
2. **Given** los tests del pipeline, **When** se ejecutan, **Then** ninguno realiza una
   llamada de red real ni ejecuta inferencia.
3. **Given** la validación con embeddings reales, **When** se planifique,
   **Then** queda marcada como **trabajo pesado** y no se ejecuta sin turno aprobado por
   Jelkin (ADR_002).

---

### User Story 7 - Constitución corregida (Priority: P3)

Como lector de la constitución, quiero que §3.4 no describa como existente un pipeline
que no lo está, para que la documentación no vuelva a inducir a error.

**Why this priority**: es documentación, pero fue precisamente la que hizo creer que RAG
existía (origen de H-05).

**Independent Test**: leer §3.4 y contrastarla con el código.

**Acceptance Scenarios**:

1. **Given** la constitución antes de implementar esta spec, **When** se lee §3.4,
   **Then** describe el pipeline como **diseño previsto**, no como estado actual
   (fe de erratas, D-015).
2. **Given** esta spec implementada y cerrada, **When** se actualiza la constitución,
   **Then** §3.4 describe el pipeline real, con su versión y fecha de enmienda.

### Edge Cases

- ¿Qué pasa si un fragmento excede el límite de tokens del modelo de embeddings? → El
  troceado debe garantizar fragmentos por debajo del límite del modelo configurado; el
  plan define cómo se comprueba.
- ¿Qué pasa si el modelo configurado cambia (p. ej. de 768 a otra dimensión)? → Los
  vectores existentes dejan de ser comparables. El plan debe definir la conducta:
  bloquear el cambio, o exigir re-vectorización completa. **No** mezclar espacios
  vectoriales distintos en la misma tabla.
- ¿Qué pasa si Ollama responde lento con documentos grandes? → El job es asíncrono
  (pg-boss) y no bloquea la respuesta HTTP; el plan define lotes y tiempos límite.
- ¿Qué pasa si se borra un documento? → Sus fragmentos deben irse con él; hoy la FK es
  `ON DELETE RESTRICT`, así que un borrado fallaría mientras existan fragmentos.
- ¿Y la búsqueda mientras el histórico no esté backfilleado? → Convivencia entre
  semántica y textual (US4, escenario 4): el plan decide y lo documenta.
- ¿El índice vectorial? → El actual es btree y no sirve para similitud; el plan debe
  crear el índice adecuado y justificar la métrica de distancia elegida.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST trocear el texto extraído en fragmentos con tamaño máximo y
  solape **configurables**, cuyos valores por defecto MUST justificarse en `research.md`
  (no elegirse por costumbre).
- **FR-002**: El troceado MUST respetar límites naturales del texto (párrafo/frase) y
  MUST NOT partir palabras.
- **FR-003**: El sistema MUST generar embeddings llamando a la API de embeddings de
  Ollama; el `slice(0, 3000)` de `documentProcessor.ts` MUST permanecer intacto (sirve a
  la extracción por reglas y no es parte del pipeline RAG).
- **FR-004**: El modelo de embeddings MUST resolverse desde `ModuleSetting`
  (`module = "base_oficial"`, `settingKey = "embedding_model"`) → `AiModel`. **Nada**
  MUST estar hardcodeado: ni el nombre del modelo ni la URL.
- **FR-005**: La URL base MUST seguir la precedencia de **D-008**: `baseUrl` del `AiModel`
  (BD/UI) > `OLLAMA_BASEURL` > default local. Se MUST reutilizar
  `resolveOllamaBaseUrl()` de `src/lib/modelClients.ts` (FR-010 de la spec 001).
- **FR-006**: Si no hay modelo de embeddings configurado, el sistema MUST fallar de forma
  explícita y trazable, y MUST NOT elegir un modelo por su cuenta.
- **FR-007**: El sistema MUST validar que el vector recibido tiene **768** dimensiones
  antes de persistirlo, para no corromper la columna `vector(768)`.
- **FR-008**: El job de ingesta MUST poblar `DocumentoChunk` (`contenido`, `orden`
  consecutivo desde 0, `embedding`) como parte del procesamiento del documento.
- **FR-009**: El reprocesamiento de un documento MUST ser idempotente: MUST NOT dejar
  fragmentos duplicados ni huérfanos.
- **FR-010**: La vectorización MUST tener política de reintentos ante fallos transitorios
  y, agotados los reintentos, MUST dejar el documento en estado de revisión con el motivo
  en auditoría, **sin** perder texto ni metadatos ya obtenidos.
- **FR-011**: `POST /api/documents/search` MUST ofrecer búsqueda por similitud vectorial
  sobre `DocumentoChunk`, devolviendo documentos ordenados por similitud e incluyendo la
  puntuación.
- **FR-012**: La consulta vectorial MUST implementarse con SQL crudo parametrizado
  (`$queryRaw` de Prisma) porque el cliente no soporta el tipo `vector`; MUST NOT
  construirse por concatenación de strings (riesgo de inyección).
- **FR-013**: MUST crearse un índice vectorial apropiado (`ivfflat` o `hnsw`) con la clase
  de operador correspondiente a la métrica de distancia elegida; la elección MUST
  justificarse en `research.md`. El índice btree actual sobre `embedding` MUST
  reemplazarse, ya que no acelera búsqueda por similitud.
- **FR-014**: La búsqueda MUST seguir respetando los filtros existentes (`tipo`,
  `entidad`, `sector`, `fechaDesde`, `fechaHasta`) y MUST devolver cada documento una
  sola vez.
- **FR-015**: La estrategia de convivencia con la búsqueda textual actual (reemplazo,
  híbrido o respaldo) MUST decidirse y documentarse en el plan, incluyendo qué ocurre
  cuando no hay fragmentos o el servicio de embeddings no responde.
- **FR-016**: MUST existir un proceso de backfill idempotente y reanudable que vectorice
  los documentos con texto y sin fragmentos, informando progreso y resumen final.
- **FR-017**: Toda la lógica nueva MUST ser testeable con embeddings **mockeados**:
  `npm run test` MUST pasar sin BD y sin Ollama, y ninguna prueba MUST hacer red ni
  inferencia.
- **FR-018**: Las respuestas de error de las rutas tocadas MUST respetar el contrato de la
  spec 002 (sin `err.message` al cliente) y el tipado estricto MUST mantenerse: cero `any`
  nuevos en `src/lib` y rutas API (§0.3).
- **FR-019**: MUST aplicarse la fe de erratas a la constitución §3.4 (D-015),
  describiendo el pipeline como diseño previsto, y MUST actualizarse a la realidad cuando
  esta spec cierre.
- **FR-020**: Ningún cambio MUST tocar archivos, contenedores, volúmenes o puertos de
  `002-2026-PROTECCION-INFANTIL` ni `003-2026-SICOV-OTPC` (ADR_002).

### Key Entities

- **Fragmento (`DocumentoChunk`)**: porción de texto de un documento con su posición
  (`orden`) y su representación vectorial (`embedding`, 768 dims). Ya existe en el
  esquema; esta spec lo llena por primera vez.
- **Modelo de embeddings (`AiModel` + `ModuleSetting`)**: la configuración
  `base_oficial / embedding_model` que la UI ya escribe y que el backend pasará a leer.
- **Consulta semántica**: texto del usuario vectorizado con el mismo modelo que los
  fragmentos, comparado por distancia en el espacio vectorial.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras ingerir un PDF con texto, `select count(*) from "DocumentoChunk"` para
  ese documento es **> 0** (baseline hoy: 0 para todos los documentos).
- **SC-002**: Todos los embeddings almacenados tienen **768** dimensiones; ninguna fila
  con otra dimensión.
- **SC-003**: Reprocesar dos veces el mismo documento deja el **mismo** número de
  fragmentos que procesarlo una vez (idempotencia).
- **SC-004**: `POST /api/documents/search` devuelve resultados **ordenados de mayor a
  menor similitud**, con la puntuación incluida en la respuesta.
- **SC-005**: Una consulta semánticamente equivalente pero **sin palabras en común** con
  el documento lo recupera; la búsqueda textual actual no lo hace. (Verificación con
  embeddings reales: **requiere turno**.)
- **SC-006**: Tras el backfill, el número de documentos con texto y **cero** fragmentos es
  **0**.
- **SC-007**: Ejecutar el backfill dos veces no cambia el número total de fragmentos.
- **SC-008**: `npm run test` pasa entera **sin BD y sin Ollama**, y el número de archivos
  de test de rutas API no baja de 19 (spec 002).
- **SC-009**: `npx eslint src/lib src/app/api` reporta **0** errores `no-explicit-any`, y
  ninguna ruta devuelve `err.message` al cliente (contratos de la spec 002).
- **SC-010**: Existe un índice `ivfflat` o `hnsw` sobre `DocumentoChunk.embedding`; no
  queda el índice btree actual.
- **SC-011**: La constitución §3.4 no describe como existente ninguna pieza que no lo
  esté (verificable contrastando con el código).
- **SC-012**: Los puertos 5005/5433/5010/5434 permanecen sin cambios.

## Trabajo pesado (ADR_002)

Estas actividades ejecutan inferencia real y **no se realizan sin turno aprobado por
Jelkin**. La implementación debe marcarlas explícitamente en `tasks.md`:

- **TP-1**: Validación end-to-end de la ingesta con `nomic-embed-text` real (comprobar
  SC-001, SC-002 con vectores auténticos).
- **TP-2**: Validación de la búsqueda semántica con embeddings reales (SC-004, SC-005).
- **TP-3**: Ejecución del backfill sobre los documentos existentes (SC-006, SC-007):
  vectoriza todo el histórico, es la tarea más costosa.
- **TP-4**: Cualquier medición de latencia o comparación entre modelos de embeddings.

Todo lo demás (chunking, resolución de configuración, consulta SQL, manejo de estados y
la suite completa) se implementa y verifica **con embeddings mockeados, sin turno**.

## Assumptions

- El modelo de referencia es `nomic-embed-text` (768 dimensiones, coincide con el esquema
  ya migrado) y está disponible en el Ollama del host — se verificó su presencia durante
  T018 de la spec 001.
- La dimensión 768 se trata como **fija** en esta spec: cambiarla implicaría migración de
  esquema y re-vectorización completa, fuera de alcance.
- Los fragmentos y sus vectores se guardan en la misma base PostgreSQL del proyecto
  (puerto 5435); no se introduce una base vectorial aparte.
- La suite unitaria sigue el patrón de la spec 002: mocks de Prisma y de los clientes de
  modelos; sin BD ni red.
- Esta spec **no se implementa** hasta ser aprobada por ZEUS y Jelkin (§0.1).

## Out of Scope

- Generación de respuestas con RAG (recuperar fragmentos y redactar una respuesta con un
  LLM): esta spec construye la **recuperación**, no la generación.
- Reranking, búsqueda híbrida con BM25/`tsvector` u otras técnicas avanzadas, más allá de
  la estrategia de convivencia que exige FR-015.
- Cambiar la dimensión del vector o el proveedor de embeddings a un servicio externo.
- Interfaz de usuario nueva para la búsqueda semántica: se reutiliza la existente (la
  configuración de modelo ya tiene su pantalla).
- Base de datos vectorial dedicada (pgvector es suficiente para el volumen actual).
- Los `any` restantes en componentes `.tsx` y demás deuda de la spec 002 fuera de alcance.
- Cualquier cambio en 002-Protección Infantil o 003-SICOV.
