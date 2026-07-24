# Feature Specification: OCR de documentos escaneados (capa de texto para Base Oficial)

**Feature Branch**: `010-ocr-documentos-escaneados` (el trabajo se commitea en la rama de
pruebas `feature/001-scaffolding`; no se abren ramas por feature — AGENTS.md)

**Created**: 2026-07-24

**Status**: **Draft** — pendiente de aprobación por ZEUS (arquitecto) y Jelkin (CEO).
Redactada en el turno nocturno D-060.

> **ESTA SPEC NO SE IMPLEMENTA CON SU APROBACIÓN SOLA.** Tiene **compuerta propia** y su
> ejecución es **trabajo pesado** (ADR_002): el OCR de un corpus de normas es carga sostenida
> de CPU/GPU en la MacStudio que comparten 001, 002-Protección Infantil y 003-SICOV. Ninguna
> tarea marcada 🔥 se ejecuta sin **turno aprobado por Jelkin**.

**Input**: 4 de los 25 PDFs de Base Oficial son **escaneos sin capa de texto** (D-025). La
spec 003 ya los detecta y los marca, pero no puede leerlos: quedan en el repositorio como
documentos mudos. Entre ellos está el **Decreto 1079 de 2015** (400 páginas), la **norma
marco del sector transporte**, hoy invisible para cualquier búsqueda.

## Contexto: el agujero más caro del corpus

Base Oficial existe para que una búsqueda encuentre la norma aplicable. Hoy hay un agujero que
no se ve desde la interfaz: **cuatro documentos entraron, se procesaron sin error y no
contienen nada buscable**.

La spec 003 se comportó bien: al no poder extraer texto no inventó nada, dejó el documento
`completed` **sin chunks** y registró el motivo. Es decir, el sistema **sabe** cuáles son. Lo
que falta es darles capa de texto.

El caso que ordena la prioridad es el Decreto 1079 de 2015: es el decreto único
reglamentario del sector transporte —la norma marco a la que remiten casi todas las
resoluciones que sí están indexadas—. Que sea justo ésa la que no se puede buscar convierte
un hueco de cobertura en un **problema de confianza**: el usuario busca, no encuentra, y
concluye que el sistema no tiene la norma. La tiene. No sabe leerla.

### Estado verificado del código (2026-07-24)

| Pieza | Estado real |
|---|---|
| Extracción de texto | `extractPdfText` (pdf2json) lee la **capa de texto**; un escaneo devuelve vacío |
| Detección del caso | La spec 003 la resuelve: documento sin texto → `completed` **sin chunks**, motivo en auditoría |
| Estados del documento | `queued → processing → completed \| needs_review \| error` (§3.4) |
| Reproceso | El pipeline se dispara en la subida; **no hay** forma de pedir "vuelve a procesar este documento" |
| OCR | **No existe**: ninguna dependencia, ningún paso del pipeline |
| Corpus afectado | **4 de 25** documentos (D-025), incluido el Decreto 1079 de 2015 (≈400 páginas) |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un escaneo deja de ser mudo (Priority: P1) 🔥 trabajo pesado

Como analista, quiero que un documento escaneado adquiera capa de texto, para que su contenido
se pueda leer y buscar como el de cualquier otra norma.

**Why this priority**: es la razón de existir de la spec. Sin esto, los otros escenarios no
tienen sobre qué operar.

**Independent Test**: tomar uno de los 4 escaneos, pasarlo por OCR y comprobar que el
documento pasa de 0 caracteres a texto legible que contiene expresiones reconocibles de la
norma.

**Acceptance Scenarios**:

1. **Given** un documento marcado como escaneo sin texto, **When** se le aplica OCR, **Then**
   su contenido pasa a tener texto y el documento deja de estar vacío.
2. **Given** el texto obtenido, **When** se revisa, **Then** conserva el **orden de lectura**
   del documento (no una sopa de fragmentos sueltos).
3. **Given** un documento que **sí** tenía capa de texto, **When** se procesa, **Then** **no**
   se le aplica OCR: la capa nativa siempre gana (es más fiel y no cuesta nada).
4. **Given** un documento de cientos de páginas, **When** se procesa, **Then** el avance es
   observable: no es una espera opaca de horas sin señal.
5. **Given** un fallo a mitad del proceso, **When** ocurre, **Then** el documento **no** queda
   ni peor que antes ni a medias en silencio: queda en un estado que dice lo que pasó.

---

### User Story 2 - El texto reconocido entra al RAG como cualquier otro (Priority: P1)

Como analista, quiero que el texto obtenido por OCR se trocee, se vectorice y se pueda buscar
igual que el del resto del corpus, para que la búsqueda lo encuentre.

**Why this priority**: sin esto, US1 produce texto que nadie ve. Es lo que cierra el valor.

**Independent Test**: tras el OCR del Decreto 1079, buscar una expresión que solo aparezca en
él y comprobar que sale como resultado.

**Acceptance Scenarios**:

1. **Given** un documento con texto recién reconocido, **When** termina el proceso, **Then**
   entra por el **mismo** pipeline de troceado y vectorización que el resto (no una vía
   paralela).
2. **Given** el documento indexado, **When** se busca una expresión suya, **Then** aparece
   entre los resultados con su evidencia.
3. **Given** el espacio vectorial vigente, **When** se indexa, **Then** se respeta el modelo de
   embeddings y la configuración de enriquecimiento que la spec 003 exige (no se mezclan
   espacios).

---

### User Story 3 - Se sabe qué tan fiable es lo reconocido (Priority: P2)

Como analista, quiero distinguir un OCR limpio de uno dudoso, para no citar como norma un
texto que la máquina adivinó mal.

**Why this priority**: un OCR malo es **peor que no tener texto**: convierte un hueco visible
en un dato falso invisible. En un corpus normativo eso es inaceptable.

**Independent Test**: procesar un escaneo de buena calidad y uno malo, y comprobar que el
sistema los distingue.

**Acceptance Scenarios**:

1. **Given** un documento pasado por OCR, **When** se consulta, **Then** consta que su texto
   **procede de OCR** y no de la capa nativa.
2. **Given** un resultado de calidad dudosa, **When** se evalúa, **Then** el documento queda
   señalado para **revisión humana** en vez de darse por bueno.
3. **Given** un resultado señalado, **When** un humano lo revisa, **Then** puede aceptarlo o
   rechazarlo, y esa decisión queda registrada.

---

### User Story 4 - El operador decide qué se procesa y cuándo (Priority: P1) 🔥 gobierna el turno

Como operador, quiero lanzar el OCR **explícitamente** sobre los documentos que elija, para
que una carga pesada nunca arranque sola en una máquina compartida.

**Why this priority**: es la traducción de ADR_002 a la funcionalidad. Sin esto, subir un
escaneo dispararía horas de CPU sin que nadie lo haya autorizado.

**Independent Test**: subir un escaneo y comprobar que **no** arranca OCR solo; lanzarlo a
mano y comprobar que sí.

**Acceptance Scenarios**:

1. **Given** un escaneo recién subido, **When** termina su procesamiento normal, **Then**
   queda **marcado como candidato** a OCR pero el OCR **no** arranca solo.
2. **Given** la lista de candidatos, **When** el operador la consulta, **Then** ve cuáles son y
   puede estimar el coste (páginas, tamaño).
3. **Given** un documento candidato, **When** el operador lanza el OCR, **Then** empieza, y
   solo entonces.
4. **Given** un proceso en curso, **When** el operador necesita parar, **Then** puede
   cancelarlo sin corromper el documento.
5. **Given** la máquina compartida, **When** se ejecuta OCR, **Then** **no** se solapa con
   otro trabajo pesado (ADR_002: un modelo grande a la vez).

---

### User Story 5 - Repetible sin destruir (Priority: P2)

Como operador, quiero poder repetir el OCR sin miedo, para corregir un mal resultado sin
perder lo que ya había.

**Acceptance Scenarios**:

1. **Given** un documento ya procesado por OCR, **When** se repite, **Then** el resultado
   sustituye limpiamente al anterior, sin duplicar fragmentos en el índice.
2. **Given** un documento con texto nativo, **When** alguien pide OCR por error, **Then** el
   sistema **protege** el texto nativo (lo avisa o lo rechaza), no lo pisa.
3. **Given** un OCR interrumpido, **When** se reintenta, **Then** no quedan restos del intento
   anterior mezclados con el nuevo.

### Edge Cases

- ¿Y un PDF **mixto** (algunas páginas con texto y otras escaneadas)? → Caso real en normas con
  anexos escaneados. El plan define si el OCR se aplica por página o al documento entero; lo que
  **no** puede pasar es perder el texto nativo de las páginas que sí lo tienen.
- ¿Y si el escaneo está torcido, con sellos, firmas o tablas? → El resultado será peor; para eso
  existe US3 (señalar dudoso, no darlo por bueno).
- ¿Y un documento de 400 páginas que no cabe en memoria de una vez? → El plan define el
  troceado del trabajo; el requisito es que **avance de forma observable** y que un fallo en la
  página 300 no tire las 299 anteriores.
- ¿Y si el OCR reconoce texto pero es basura ilegible? → US3. El sistema debe poder decir "esto
  no vale" en vez de indexar ruido en el corpus normativo.
- ¿Qué pasa con el idioma? → El corpus es normativa colombiana: español, con tildes y ñ. Un OCR
  configurado en inglés produciría basura sutil, que es la peor clase de basura.

## Requirements *(mandatory)*

### Restricciones (no negociables)

- **RZ-1 · Trabajo pesado (ADR_002)**: ninguna ejecución de OCR sin **turno aprobado por
  Jelkin**. Un solo trabajo pesado a la vez en la MacStudio. Los puertos y procesos de 002 y
  003 son intocables.
- **RZ-2**: el OCR **nunca** pisa una capa de texto nativa existente.
- **RZ-3**: el texto de OCR entra por el **mismo** pipeline de troceado/vectorización (spec
  003), sin vía paralela y sin mezclar espacios vectoriales.
- **RZ-4**: toda ruta API nueva con `verifyAuth`, contrato `apiError` y **test Vitest**; cero
  `any` en `src/lib` y `src/app/api`; la suite pasa **sin** OCR instalado (el motor se mockea).
- **RZ-5**: cero pérdida de datos. Un OCR fallido deja el documento como estaba.
- **RZ-6**: IA local por defecto (§0.6): el reconocimiento ocurre **en la máquina**, no en un
  servicio externo. El corpus es documentación oficial y no sale del entorno.

### Functional Requirements

- **FR-001**: el sistema MUST poder producir una **capa de texto** para un documento que no la
  tenga, conservando el orden de lectura.
- **FR-002**: el sistema MUST identificar y **listar** los documentos candidatos a OCR
  (escaneos sin texto ya detectados por la spec 003).
- **FR-003**: el OCR MUST lanzarse **explícitamente** por el operador; MUST NOT arrancar solo
  al subir un documento (RZ-1).
- **FR-004**: el avance de un OCR largo MUST ser **observable**, y un fallo parcial MUST NOT
  invalidar lo ya reconocido ni corromper el documento.
- **FR-005**: el texto reconocido MUST entrar por el pipeline existente de troceado y
  vectorización y quedar **buscable** (RZ-3).
- **FR-006**: el sistema MUST registrar que el texto de un documento **procede de OCR**,
  distinguible de la capa nativa.
- **FR-007**: el sistema MUST señalar para **revisión humana** los resultados de calidad
  dudosa, en vez de darlos por buenos (US3).
- **FR-008**: repetir el OCR MUST sustituir el resultado anterior **sin duplicar** fragmentos
  en el índice (FR-008 depende de la limpieza de chunks de la spec 003).
- **FR-009**: el OCR MUST NOT ejecutarse sobre un documento con capa de texto nativa sin una
  confirmación explícita (RZ-2).
- **FR-010**: el reconocimiento MUST configurarse para **español** (§0.7: configurable, no
  cableado).
- **FR-011**: el proceso MUST poder **cancelarse** sin dejar el documento corrupto.
- **FR-012**: toda operación de OCR MUST quedar en **auditoría**: documento, quién la lanzó,
  duración, resultado y calidad estimada.
- **FR-013**: la suite MUST pasar **sin** el motor de OCR instalado; la ejecución real es
  materia de turno, no de CI.
- **FR-014**: ningún cambio MUST tocar archivos, puertos ni contenedores de
  `002-2026-PROTECCION-INFANTIL` ni `003-2026-SICOV-OTPC` (ADR_002).

### Preguntas abiertas para el plan (no las decide esta spec)

1. **Motor de reconocimiento**: ¿OCR clásico local (tipo Tesseract) o un modelo de visión
   sobre las páginas rasterizadas? El primero es más barato, predecible y suficiente para
   texto impreso limpio; el segundo lee mejor lo difícil pero **es carga de modelo grande** y
   compite por la MacStudio con 002 y 003. Es la decisión con más consecuencias sobre el turno,
   y la debe tomar ZEUS.
2. **Granularidad**: ¿OCR por página o por documento? Afecta a los PDF mixtos, al avance
   observable y a la recuperación ante fallo.
3. **Umbral de "dudoso"** (FR-007): qué medida y qué corte separan un OCR aceptable de uno que
   exige revisión humana.
4. **Dónde vive el trabajo**: ¿otro tipo de trabajo en la cola pg-boss existente, o un proceso
   aparte? Lo primero reutiliza infraestructura; lo segundo aísla mejor una carga larga.
5. **Rasterización**: convertir PDF a imagen exige una herramienta del sistema; hay que decidir
   cuál y declararla como dependencia de despliegue.

## Success Criteria *(mandatory)*

- **SC-001**: los **4** documentos escaneados de D-025 pasan de 0 caracteres a texto legible.
- **SC-002**: una búsqueda de una expresión propia del **Decreto 1079 de 2015** lo devuelve
  como resultado (hoy no devuelve nada).
- **SC-003**: la cobertura buscable del corpus pasa de **21/25** a **25/25** documentos.
- **SC-004**: ningún documento con capa de texto nativa ve su texto alterado (verificable
  comparando antes/después de los 21 restantes).
- **SC-005**: el OCR no arranca nunca sin que un operador lo lance (verificable subiendo un
  escaneo y comprobando que solo queda como candidato).
- **SC-006**: todo documento con texto de OCR es distinguible de uno con texto nativo.
- **SC-007**: repetir el OCR sobre el mismo documento no duplica fragmentos en el índice.
- **SC-008**: `npx vitest run` pasa **sin** motor de OCR instalado y no baja de la línea base
  vigente (388).
- **SC-009**: `npx tsc --noEmit` limpio; `npx eslint src/lib src/app/api` con **0**
  `no-explicit-any`.
- **SC-010**: durante toda la ejecución, los puertos 5005/5433/5010/5434 y los procesos de 002
  y 003 permanecen intactos.

## Definición de terminado

| # | Regla de Oro | Cómo se acredita |
|---|---|---|
| 1 | Spec Kit aplicado | `specs/010-ocr-documentos-escaneados/` con spec, plan, tasks y checklist |
| 2 | Código a la rama de pruebas | Commits scopeados a `001-2026-INNOVADATACO/`, push en el mismo acto |
| 3 | Pruebas escritas y pasando | SC-008: suite verde **sin** OCR instalado |
| 4 | Despliegue accesible y probable | SC-002: el CEO busca en el Decreto 1079 y lo encuentra |
| 5 | Revisión de arquitectura de ZEUS | Decisión de motor (pregunta abierta 1) y respeto de ADR_002 |

## Qué exige turno y qué no

Es la distinción que hace esta spec ejecutable de noche… en parte.

| Trabajo | ¿Turno? |
|---|---|
| Redactar plan, tasks y checklists | **No** |
| Instalar/declarar dependencias y escribir el código del paso de OCR | **No** (no ejecuta nada) |
| Tests con el motor **mockeado** | **No** |
| Rasterizar y reconocer **un** documento de prueba pequeño | **Sí** 🔥 (carga real) |
| OCR del corpus: los 4 escaneos, con el Decreto 1079 de 400 páginas | **Sí** 🔥🔥 (el grande) |
| Re-vectorizar lo reconocido | **Sí** 🔥 (usa el modelo de embeddings) |

## Assumptions

- Los 4 documentos de D-025 siguen siendo los mismos y siguen marcados por la spec 003.
- El corpus es **normativa colombiana en español**, texto impreso (no manuscrito).
- El pipeline de la spec 003 se **reutiliza** entero para lo que viene después del texto.
- La ejecución real se hace en la MacStudio, con turno, y **nunca** en paralelo con otro
  trabajo pesado de 002 o 003.
- Esta spec **no se implementa** hasta ser aprobada por ZEUS y Jelkin (§0.1), y su ejecución
  además exige turno (ADR_002).

## Out of Scope

- **Corregir a mano** el texto reconocido (edición asistida de OCR): otro frente.
- Reconocer **manuscritos**, firmas o sellos.
- Extraer **tablas** como estructura (solo texto en orden de lectura).
- Traducción o normalización lingüística del texto reconocido.
- Reprocesar documentos que **sí** tienen capa de texto para "mejorarla".
- Base Oficial como dato, el diseño del RAG (spec 003), 002-Protección Infantil, 003-SICOV.
