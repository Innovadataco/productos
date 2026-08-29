# Feature Specification: Oportunidades (evolución de Licitaciones)

**Feature Branch**: `006-oportunidades` (el trabajo se commitea en la rama de pruebas
`feature/001-scaffolding`; no se abren ramas por feature — AGENTS.md)

**Created**: 2026-07-23

**Status**: **Terminada (ACTA-VALIDACION 006, 2026-07-24)**. Aprobada (2026-07-23, D-056)
por ZEUS (arquitecto) y Jelkin (CEO). Habilita
`/speckit-plan`, `/speckit-analyze` e `/speckit-implement`. Primera de tres specs de la hoja
de ruta de evolución de módulos (D-054, D-055). El Kanban de estados es **SPEC-007** y **no**
entra aquí.

**Input**: Renombre conceptual de "Licitación" a "Oportunidad" (concepto más amplio) más
enriquecimiento del modelo y un expediente de documentos adjuntos. Alcance y restricciones
fijados por ZEUS; decisiones de negocio confirmadas por el CEO vía `/speckit-clarify`
(2026-07-23).

## Contexto: la licitación es un caso, no el todo (D-055)

Hoy el módulo se llama **Licitaciones** y su entidad `Licitacion` (tabla `licitaciones`)
asume que todo registro es un proceso público formal: `numero`, `fechaApertura` y `estadoId`
son **obligatorios**. Pero el negocio persigue oportunidades más amplias —concursos de
méritos, contrataciones directas, negocios— donde esos campos no siempre aplican.

Esta spec **renombra el concepto a Oportunidad** y hace que la licitación pública sea **un
tipo** entre varios, con un catálogo de tipos **configurable** (como ya lo son entidades y
estados). Los campos propios del proceso público formal dejan de ser obligatorios para todos.

**Lo que NO cambia aquí:** el flujo de estados/Kanban (SPEC-007), el módulo Base Oficial, el
pipeline RAG y cualquier otro producto. El formulario de creación (submódulo "Nueva") **no se
toca** salvo el renombrado de textos.

### Estado verificado del código (2026-07-23)

| Pieza | Estado real |
|---|---|
| `Licitacion` (tabla `licitaciones`) | `numero` y `fechaApertura` **obligatorios**; `estadoId` obligatorio; `entidadId` **ya nullable**; `@@unique([numero, fechaApertura])` |
| `LicitacionDocumento` | **Ya existe** (nombre, tipo, contenido, fechas, `licitacionId` con CASCADE) pero **sin ruta de subida**: hoy solo se lee en el GET, nunca se crea uno |
| Catálogos configurables | `EntidadLicitacion` y `LicitacionStatus` con `key @unique`, **sembrados** (D-048) y con submódulos propios (Entidades, Estados) |
| Botón "Nueva" en el listado | `LicitacionesTab.tsx:220` (`ListadoSubmodulo`) abre un modal de creación, **además** del submódulo "Nueva" que ya tiene su formulario |
| Submódulos | `SUBMODULES.licitaciones` = Listado, Nueva Licitación, Entidades, Estados (`WorkspaceContext.tsx:36`) |
| Datos vivos | La tabla tiene datos semilla (entidades, estados). La migración **no puede perderlos** |

### Decisiones de negocio (CEO, `/speckit-clarify` 2026-07-23)

1. **Tipos de oportunidad = catálogo CONFIGURABLE**, no un enum fijo. Set inicial:
   **licitación pública**, **concurso de méritos**, **contratación directa**. El CEO puede
   añadir, renombrar o retirar tipos desde el módulo, igual que hoy hace con entidades y
   estados.
2. **Cronograma = 5 hitos**: **apertura**, **pliegos definitivos**, **entrega de propuesta**,
   **adjudicación**, **cierre**. Todos opcionales (una oportunidad temprana puede no tenerlos
   aún).
3. **Presupuesto = DESGLOSADO**: varias partidas, cada una con su concepto y su monto (no un
   único total).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar oportunidades que no son licitaciones públicas (Priority: P1)

Como analista de negocio, quiero registrar una oportunidad de cualquier tipo —no solo una
licitación pública— sin verme obligado a inventar un número o una fecha de apertura que no
existen, para reflejar el negocio real.

**Why this priority**: es el corazón del renombre (D-055). Sin esto, el módulo sigue negando
todo lo que no sea un proceso público formal.

**Independent Test**: crear una oportunidad de tipo "contratación directa" sin `numero` ni
`fechaApertura` y comprobar que se guarda; crear una de tipo "licitación pública" y comprobar
que esos campos sí se le exigen.

**Acceptance Scenarios**:

1. **Given** el catálogo de tipos con al menos "licitación pública" y "contratación directa",
   **When** se crea una oportunidad de tipo "contratación directa" sin `numero` ni
   `fechaApertura`, **Then** se guarda correctamente.
2. **Given** una oportunidad de tipo "licitación pública", **When** se crea sin `numero` o sin
   `fechaApertura`, **Then** se rechaza con un error legible indicando qué falta (esos campos
   son propios de ese tipo).
3. **Given** las oportunidades existentes antes de esta spec (datos vivos), **When** se aplica
   la migración, **Then** **todas conservan sus datos** y quedan asignadas al tipo "licitación
   pública" (su naturaleza actual).
4. **Given** una oportunidad de cualquier tipo, **When** se consulta, **Then** su `tipo`
   aparece en la respuesta y en la interfaz.
5. **Given** los catálogos semilla (entidades, estados) y los nuevos tipos, **When** se
   ejecuta la migración y el seed, **Then** ninguno se pierde ni se duplica.

---

### User Story 2 - Administrar el catálogo de tipos de oportunidad (Priority: P1)

Como administrador, quiero crear, renombrar y listar los tipos de oportunidad desde el módulo,
para adaptar el sistema a los tipos que el negocio maneje sin tocar código.

**Why this priority**: el CEO pidió explícitamente que los tipos sean configurables, no un
enum. Es un requisito de §0.7 (todo parámetro operativo configurable) tanto como una petición
de negocio.

**Independent Test**: añadir un tipo nuevo desde el submódulo de tipos y comprobar que aparece
disponible al crear una oportunidad.

**Acceptance Scenarios**:

1. **Given** el submódulo de tipos, **When** se crea un tipo con su nombre, **Then** queda
   disponible para asignarlo a nuevas oportunidades.
2. **Given** el catálogo de tipos, **When** se lista, **Then** devuelve todos los tipos
   activos, incluidos los sembrados por defecto.
3. **Given** un tipo del catálogo, **When** se marca cuáles de sus campos son obligatorios
   (p. ej. `numero`/`fechaApertura` para la licitación pública), **Then** la validación de
   creación respeta esa configuración, sin nombres de tipo cableados en el código.
4. **Given** un tipo en uso por oportunidades, **When** se intenta borrarlo, **Then** el
   sistema lo impide o lo desactiva sin dejar oportunidades huérfanas (la política exacta la
   fija el plan).

---

### User Story 3 - Enriquecer la oportunidad con cronograma, presupuesto, ciudad y entidad ampliada (Priority: P1)

Como analista, quiero registrar el cronograma, el presupuesto desglosado, la ciudad de
ejecución y datos ampliados de la entidad de una oportunidad, para tener la información
completa del proceso en un solo lugar.

**Why this priority**: es el valor de negocio directo de la evolución; convierte un registro
mínimo en un expediente informativo.

**Independent Test**: crear una oportunidad con cronograma, varias partidas de presupuesto y
ciudad, y comprobar que todo se persiste y se devuelve.

**Acceptance Scenarios**:

1. **Given** una oportunidad, **When** se registran sus hitos de cronograma (apertura, pliegos
   definitivos, entrega de propuesta, adjudicación, cierre), **Then** se guardan y se muestran;
   todos son **opcionales**.
2. **Given** una oportunidad, **When** se registra el presupuesto como **varias partidas**
   (concepto + monto + moneda), **Then** se persisten todas y se puede consultar su total.
3. **Given** una oportunidad, **When** se registra su **ciudad de ejecución**, **Then** se
   guarda y se muestra.
4. **Given** una oportunidad de una entidad, **When** se consulta, **Then** muestra la
   **información ampliada de la entidad** (más allá del nombre): el plan define qué campos
   ampliados entran, reutilizando el catálogo de entidades existente.
5. **Given** un monto de presupuesto, **When** se captura, **Then** se valida que es un número
   válido y no negativo; un valor no numérico se rechaza con error legible.
6. **Given** las fechas del cronograma, **When** se capturan, **Then** se validan como fechas
   reales; una fecha inválida se rechaza.

---

### User Story 4 - Expediente: adjuntar documentos del proceso (PDF y Excel) (Priority: P2)

Como analista, quiero subir a una oportunidad los documentos del proceso (pliegos, anexos,
respuestas) en PDF o Excel, para tener el expediente completo asociado, **sin** que esos
archivos pasen por el análisis documental de Base Oficial.

**Why this priority**: completa el expediente, pero depende de que la oportunidad exista
(US1–US3). Es adjuntar y listar, no analizar.

**Independent Test**: subir un PDF y un Excel a una oportunidad y comprobar que quedan
asociados y descargables; comprobar que **no** se generan fragmentos ni embeddings.

**Acceptance Scenarios**:

1. **Given** una oportunidad, **When** se sube un documento en PDF, **Then** queda asociado a
   esa oportunidad y aparece en su expediente.
2. **Given** una oportunidad, **When** se sube un documento en Excel (`.xlsx`/`.xls`), **Then**
   queda asociado igual que el PDF.
3. **Given** un archivo de un tipo no permitido (p. ej. `.exe`, imagen), **When** se intenta
   subir, **Then** se rechaza con error legible indicando los tipos aceptados.
4. **Given** un archivo que excede el límite de tamaño, **When** se sube, **Then** se rechaza
   con `413` y un mensaje legible.
5. **Given** un documento subido al expediente, **When** se observa el sistema, **Then** **no**
   se crea ningún `DocumentoChunk`, ni se llama al pipeline de embeddings: es un adjunto, no
   una fuente de Base Oficial.
6. **Given** una oportunidad con documentos, **When** se elimina la oportunidad, **Then** sus
   documentos adjuntos se eliminan con ella (no quedan huérfanos).
7. **Given** el expediente de una oportunidad, **When** se lista, **Then** muestra cada
   documento con su nombre, tipo de archivo y fecha de subida.

---

### User Story 5 - El listado no crea, solo lista (Priority: P3)

Como usuario, quiero que el listado de oportunidades sea solo para consultar y buscar, con la
creación en su propia pantalla, para que la interfaz sea coherente y no ofrezca dos caminos de
creación.

**Why this priority**: es una limpieza de interfaz pedida explícitamente; pequeña pero mejora
la coherencia.

**Independent Test**: abrir el listado y comprobar que no hay botón de crear; abrir la pantalla
"Nueva" y comprobar que la creación sigue ahí.

**Acceptance Scenarios**:

1. **Given** el submódulo de listado, **When** se abre, **Then** **no** aparece el botón de
   crear/"Nueva": solo búsqueda y lista.
2. **Given** el submódulo "Nueva", **When** se abre, **Then** el formulario de creación sigue
   funcionando igual que hoy (solo cambian los textos por el renombrado).
3. **Given** el renombrado, **When** se recorre el módulo, **Then** los textos visibles dicen
   "Oportunidad(es)" donde antes decían "Licitación(es)", sin residuos del término anterior en
   la interfaz.

### Edge Cases

- ¿Qué pasa con las oportunidades existentes que tienen `numero`/`fechaApertura` al migrar? →
  Se conservan tal cual y se les asigna el tipo "licitación pública" (su naturaleza). Nada se
  pierde (US1-3).
- ¿El `@@unique([numero, fechaApertura])` sigue teniendo sentido si ambos son nullable? → El
  plan debe decidir: en Postgres varios `NULL` no colisionan, así que la unicidad solo aplica
  a las que tienen ambos (las licitaciones públicas). Debe quedar documentado, no accidental.
- ¿Un tipo configurable puede quedarse sin ningún campo obligatorio? → Sí; es válido (una
  oportunidad de negocio puede requerir solo título y tipo).
- ¿Qué pasa si se borra un tipo del catálogo en uso? → No debe dejar oportunidades sin tipo
  (US2-4).
- ¿Un Excel con macros o muy grande? → Se valida tipo y tamaño como en la subida existente; el
  contenido **no** se procesa (no es Base Oficial).
- ¿Puede el expediente confundirse con Base Oficial? → No: son tablas y flujos distintos; el
  expediente **nunca** genera chunks ni embeddings (US4-5). Es la línea que esta spec no cruza.
- ¿El presupuesto admite varias monedas? → El plan lo define; por defecto cada partida lleva su
  moneda para no asumir una sola.

## Requirements *(mandatory)*

### Restricciones de ZEUS (no negociables)

- **RZ-1**: toda ruta API tocada lleva **test Vitest** (§0.2) y devuelve el contrato
  **`apiError`** (§0.3).
- **RZ-2**: **cero `any` nuevos**, **cero fugas de `err.message`** al cliente.
- **RZ-3**: **no** se toca Base Oficial, el pipeline RAG ni otro producto. El expediente
  **no** vectoriza.
- **RZ-4**: la migración **no puede perder los datos semilla** ni las oportunidades existentes.
- **RZ-5**: el formulario de creación ("Nueva") **no se toca** salvo el renombrado de textos.
- **RZ-6**: el Kanban de estados es **SPEC-007**; aquí no se rediseña el flujo de estados.

### Functional Requirements

**Renombre y tipos (US1, US2)**

- **FR-001**: la entidad `Licitacion` MUST evolucionar a **`Oportunidad`** conservando su
  tabla y sus datos; el renombre MUST NOT perder registros ni relaciones existentes.
- **FR-002**: la oportunidad MUST tener un campo **`tipo`** que referencie un **catálogo de
  tipos configurable** (crear/listar/renombrar desde el módulo), análogo a los catálogos de
  entidades y estados.
- **FR-003**: los campos `numero` y `fechaApertura` MUST pasar a ser **opcionales** a nivel de
  datos. Su obligatoriedad MUST depender del **tipo** (configurable), no de código con nombres
  de tipo cableados: la validación consulta la configuración del tipo.
- **FR-004**: la migración MUST asignar a las oportunidades existentes el tipo **"licitación
  pública"** y conservar sus valores actuales de `numero`/`fechaApertura`.
- **FR-005**: el catálogo de tipos MUST sembrarse con **licitación pública, concurso de
  méritos y contratación directa** (idempotente, sin destruir ajustes del usuario — patrón del
  seed existente, D-048).
- **FR-006**: la restricción de unicidad que hoy es `@@unique([numero, fechaApertura])` MUST
  revisarse a la luz de los campos opcionales y su comportamiento MUST quedar **documentado**
  (no accidental).

**Enriquecimiento (US3)**

- **FR-007**: la oportunidad MUST admitir un **cronograma** con los hitos **apertura, pliegos
  definitivos, entrega de propuesta, adjudicación y cierre**, todos **opcionales** y validados
  como fechas reales.
- **FR-008**: la oportunidad MUST admitir un **presupuesto desglosado**: varias partidas, cada
  una con **concepto**, **monto** (número no negativo, validado) y **moneda**. MUST poder
  consultarse el total.
- **FR-009**: la oportunidad MUST admitir una **ciudad de ejecución**.
- **FR-010**: la oportunidad MUST mostrar **información ampliada de la entidad**, reutilizando
  el catálogo de entidades existente; el plan define qué campos ampliados se añaden.

**Expediente de documentos (US4)**

- **FR-011**: MUST existir una ruta para **subir documentos** asociados a una oportunidad,
  aceptando **PDF y Excel** (`.xlsx`, `.xls`) y rechazando otros tipos con error legible.
- **FR-012**: la subida MUST reutilizar la **mecánica de validación y almacenamiento
  existente** (tipo de archivo, límite de tamaño con `413`, nombre saneado, ruta no expuesta),
  **sin** chunking ni embeddings.
- **FR-013**: los documentos del expediente MUST NOT generar `DocumentoChunk` ni pasar por el
  pipeline de embeddings (RZ-3): son adjuntos, no fuentes de Base Oficial.
- **FR-014**: los documentos del expediente MUST asociarse a su oportunidad y **eliminarse con
  ella** (CASCADE), sin quedar huérfanos.
- **FR-015**: MUST poder **listarse** el expediente de una oportunidad (nombre, tipo de
  archivo, fecha).

**Interfaz (US5)**

- **FR-016**: el submódulo de **listado** MUST NOT ofrecer el botón de crear/"Nueva"; la
  creación permanece en el submódulo "Nueva".
- **FR-017**: los textos visibles del módulo MUST decir **"Oportunidad(es)"** donde hoy dicen
  "Licitación(es)", sin residuos del término anterior en la interfaz.
- **FR-018**: el formulario de creación ("Nueva") MUST seguir funcionando igual que hoy; solo
  cambian sus textos (RZ-5).

**Transversales**

- **FR-019**: toda ruta API creada o modificada MUST llevar test Vitest y responder con el
  contrato `apiError`; MUST exigir sesión (`verifyAuth`) como el resto de la API (spec 005).
- **FR-020**: cero `any` nuevos en `src/lib` y rutas API; ninguna ruta MUST filtrar
  `err.message` (spec 002).
- **FR-021**: ningún cambio MUST tocar Base Oficial, el pipeline RAG, ni archivos, contenedores
  o puertos de `002-2026-PROTECCION-INFANTIL` ni `003-2026-SICOV-OTPC` (ADR_002).

### Key Entities

- **Oportunidad** (evoluciona `Licitacion`): proceso o negocio que la organización persigue.
  Campos comunes (título, tipo, entidad, ciudad de ejecución, descripción) y campos propios del
  tipo (numero, fechaApertura para licitación pública). Conserva su relación con estado
  (SPEC-007 lo evolucionará) y con su expediente.
- **Tipo de oportunidad** (catálogo configurable, nuevo): `key`/nombre y la configuración de
  qué campos exige (p. ej. numero/fechaApertura). Sembrado con tres tipos iniciales.
- **Hito de cronograma**: fecha opcional de un momento del proceso (apertura, pliegos
  definitivos, entrega de propuesta, adjudicación, cierre).
- **Partida de presupuesto**: concepto + monto + moneda; una oportunidad tiene varias.
- **Documento de expediente** (evoluciona/reutiliza `LicitacionDocumento`): archivo adjunto
  (PDF/Excel) de una oportunidad. **No** es una fuente de Base Oficial: no se vectoriza.
- **Entidad** (catálogo existente `EntidadLicitacion`): se le añade información ampliada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: crear una oportunidad de un tipo que no exige `numero`/`fechaApertura` (p. ej.
  contratación directa) **sin** esos campos tiene éxito (baseline: hoy es imposible, ambos
  obligatorios).
- **SC-002**: crear una "licitación pública" sin `numero` o sin `fechaApertura` se rechaza con
  error legible.
- **SC-003**: tras la migración, el número de oportunidades y de filas de los catálogos
  (entidades, estados) es **el mismo que antes**: cero pérdida de datos.
- **SC-004**: el catálogo de tipos queda con **≥ 3** tipos tras el seed y admite añadir uno
  nuevo desde el módulo, que aparece disponible al crear.
- **SC-005**: una oportunidad admite los 5 hitos de cronograma, ≥ 2 partidas de presupuesto y
  una ciudad, y todo se devuelve al consultarla.
- **SC-006**: el total del presupuesto de una oportunidad coincide con la suma de sus partidas.
- **SC-007**: subir un PDF y un Excel a una oportunidad los asocia y los lista; subir un tipo no
  permitido se rechaza.
- **SC-008**: subir un documento al expediente **no** crea ninguna fila en `DocumentoChunk`
  (verificable: el conteo no cambia).
- **SC-009**: borrar una oportunidad elimina sus documentos de expediente (0 huérfanos).
- **SC-010**: el submódulo de listado **no** muestra botón de crear; el submódulo "Nueva" sí
  crea.
- **SC-011**: `grep` de "Licitación/Licitaciones" en los textos visibles del módulo devuelve
  **0** (renombrado completo en la interfaz); el identificador técnico interno puede conservarse
  si el plan lo justifica.
- **SC-012**: `npx vitest run` pasa **sin BD ni Ollama**, no baja de **249** pruebas, e incluye
  cobertura nueva de las rutas de oportunidades y del expediente.
- **SC-013**: `npx tsc --noEmit` limpio y `npx eslint src/lib src/app/api` con **0** errores
  `no-explicit-any`; ninguna ruta filtra `err.message`.
- **SC-014**: los puertos 5005/5433/5010/5434 y el pipeline RAG (Base Oficial) permanecen sin
  cambios.

## Definición de terminado

| # | Regla de Oro | Cómo se acredita aquí |
|---|---|---|
| 1 | Spec Kit aplicado | `specs/006-oportunidades/` con spec, plan, tasks y checklist |
| 2 | Código subido a la rama de pruebas | Commits convencionales scopeados a `001-2026-INNOVADATACO/`, con push en el mismo acto |
| 3 | Pruebas escritas y pasando | SC-012: suite verde sin infraestructura, con cobertura de oportunidades y expediente |
| 4 | Despliegue accesible y probable | SC-001…SC-010: el CEO registra oportunidades de varios tipos, con cronograma/presupuesto/ciudad y expediente |
| 5 | Revisión de arquitectura de ZEUS | RZ-1…RZ-6 e integridad de la migración |

## Assumptions

- El renombre es **conceptual y de datos**, no una tabla nueva: `Licitacion` evoluciona a
  `Oportunidad` conservando la tabla y los registros (FR-001). El plan decide si el nombre
  físico de la tabla cambia o se conserva (`@@map`) para no romper la migración.
- Los tipos son un **catálogo configurable** con una propiedad que indica qué campos exige cada
  tipo (así "licitación pública exige numero/fechaApertura" no queda cableado). El plan fija el
  mecanismo exacto.
- El expediente reutiliza `LicitacionDocumento` (ya existe con CASCADE) evolucionado a
  documento de oportunidad; se le añade la **ruta de subida** que hoy no existe.
- El presupuesto desglosado se modela como filas hijas (partidas) de la oportunidad, cada una
  con su moneda, para no asumir una sola divisa.
- La información ampliada de la entidad se añade al catálogo `EntidadLicitacion` existente; qué
  campos concretos los define el plan con negocio.
- La suite sigue el patrón de mocks (spec 002): sin BD ni red.
- Esta spec **no se implementa** hasta ser aprobada por ZEUS y Jelkin (§0.1).

## Out of Scope

- **Kanban / flujo de estados** de las oportunidades: es **SPEC-007**.
- **Análisis documental del expediente** (OCR, extracción, búsqueda semántica): los adjuntos no
  son Base Oficial (RZ-3).
- Integración con fuentes externas (SECOP u otras): sigue siendo captura manual (D-003).
- Rediseño del formulario de creación más allá del renombrado (RZ-5).
- Migrar los `any` de componentes `.tsx` preexistentes (deuda de la spec 002, D-016).
- Cualquier cambio en Base Oficial, el pipeline RAG, 002-Protección Infantil o 003-SICOV.
