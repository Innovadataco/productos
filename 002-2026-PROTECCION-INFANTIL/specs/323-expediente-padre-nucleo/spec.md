# Feature Specification: El expediente del padre · NÚCLEO

**Feature Branch**: `work/pi-SPEC-323-expediente-padre-nucleo`

**Radicado**: 002-PI-223 · SPEC-323

**Created**: 2026-08-30

**Status**: DESARROLLO

**Prioridad**: CRÍTICA

**Impacto en arquitectura:** Cambio de respuesta en creación de reporte (duplicado → oferta); nuevo flag de vinculación intencional; cableado de `crearExpediente` al flujo del 2º reporte; convergencia a un único camino de creación de reporte (sin `crearReporteVinculado`); nuevo endpoint de detalle de expediente con payload anonimizado (Ley 1581); nuevo endpoint de descarga de PDF del expediente; actualización del wizard de reporte para oferta y campo fijo; actualización de test E2E que afirma el comportamiento anterior.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Oferta en lugar de bloqueo al 2.º reporte (Priority: P1)

Un padre autenticado ha reportado previamente el identificador `XXX01`. Cuando vuelve a reportar el mismo identificador dentro del período de 30 días, el sistema lo reconoce y en lugar de rechazar la solicitud, le ofrece la posibilidad de agregar un nuevo evento sobre el mismo caso.

**Why this priority**: Sin esta historia el padre no puede construir el expediente que necesita para acudir a una autoridad. Es el desbloqueador de todas las demás historias.

**Independent Test**: El padre envía el mismo identificador dos veces. La segunda vez aparece un mensaje con un botón de acción en lugar del mensaje de error. La primera vez se acredita como exitosa (reporte en lista del padre).

**Acceptance Scenarios**:

1. **Given** un padre autenticado con un reporte previo sobre `XXX01` en los últimos 30 días, **When** intenta reportar `XXX01` nuevamente, **Then** el sistema muestra la oferta "Ya reportaste este identificador. ¿Querés agregar otro evento?" con un botón para continuar — no un mensaje de error.

2. **Given** la oferta está visible, **When** el padre hace clic en el botón de continuar, **Then** el formulario de reporte se abre con `XXX01` ya escrito y bloqueado (no editable).

3. **Given** un usuario anónimo reporta el mismo identificador dos veces, **When** lo intenta, **Then** el comportamiento no cambia respecto al estado anterior (el bloqueo de duplicados no afecta reportes anónimos).

4. **Given** un padre autenticado con un reporte previo de más de 30 días sobre `XXX01`, **When** intenta reportar `XXX01` nuevamente, **Then** el flujo es el normal (no hay duplicado reciente, no hay oferta).

---

### User Story 2 — El expediente nace automáticamente al 2.º evento (Priority: P2)

Cuando el padre acepta la oferta y envía el 2.º reporte sobre el mismo identificador, el sistema crea automáticamente un expediente que agrupa ambos eventos. El padre no ve ni escucha la palabra "expediente" hasta que el sistema se lo muestra completo.

**Why this priority**: El expediente es la carpeta que el padre lleva a una autoridad. Sin él, los dos reportes son eventos sueltos sin valor acumulativo.

**Independent Test**: Se completa US1. Tras el 2.º envío, se verifican en la base de datos: 2 reportes + 1 expediente que los agrupa como eventos.

**Acceptance Scenarios**:

1. **Given** el padre aceptó la oferta y completó el formulario con `XXX01` fijo, **When** envía el reporte, **Then** el sistema crea el 2.º reporte con todos los datos reales (lugar, texto, fecha), crea el expediente con el padre como titular, y vincula ambos reportes al expediente como eventos ordenados cronológicamente.

2. **Given** el expediente fue creado, **When** se consulta la base de datos, **Then** el expediente tiene estado ACTIVO, 2 eventos, y el identificador reportado coincide con `XXX01`.

3. **Given** el expediente fue creado, **When** el padre navega a su área personal, **Then** puede ver el expediente en su lista de expedientes.

4. **Given** se crean los dos eventos del expediente, **Then** los datos de lugar (ciudad, país) y fecha del 2.º reporte son los que el padre ingresó realmente (no valores por defecto).

---

### User Story 3 — Vista del expediente con privacidad de terceros (Priority: P3)

El padre puede ver el detalle de un expediente suyo. Ve sus propios eventos con toda la información. De los eventos de otros padres sobre el mismo identificador, solo ve fecha, país, ciudad y clasificación del motor — ningún texto, ningún dato del denunciante.

**Why this priority**: Arma el contexto del expediente. Pero puede entregarse como pantalla básica incluso si hay pocos eventos propios.

**Independent Test**: Se crea un expediente con eventos propios y se simula un evento de otro padre sobre el mismo identificador. Se verifica que la respuesta del endpoint excluye texto y autor de los eventos ajenos.

**Acceptance Scenarios**:

1. **Given** un expediente con 2 eventos propios del padre, **When** el padre solicita el detalle, **Then** ve ambos eventos con fecha/hora en hora Colombia, lugar, lo que escribió, y la clasificación del motor.

2. **Given** otro padre reportó el mismo identificador, **When** el padre solicita el detalle de su expediente, **Then** aparece en la sección de contexto solo: fecha, país, ciudad y clasificación — sin texto del reporte, sin nombre ni email del otro padre.

3. **Given** el padre solicita el detalle del expediente, **When** la respuesta llega al cliente, **Then** el payload de los eventos ajenos NO contiene el campo de texto ni ningún identificador del otro padre (la exclusión es en el servidor, no solo en la presentación).

4. **Given** el padre intenta acceder al detalle de un expediente de otro padre, **When** hace la solicitud, **Then** recibe un error de no encontrado o no autorizado.

---

### User Story 4 — Descarga del PDF del expediente (Priority: P4)

El padre puede descargar un PDF de su expediente. El documento se genera en el momento, no se guarda en el servidor. Incluye carátula con sus datos, sus eventos completos, y un resumen de contexto de lo que otros reportaron (con el mismo límite de privacidad).

**Why this priority**: Es el entregable final que el padre lleva a la autoridad. Depende de US3 (la vista).

**Independent Test**: Se descarga el PDF de un expediente con eventos propios y contexto de otros. Se verifica que el archivo contiene carátula, lista de eventos propios y contexto de otros sin textos ajenos.

**Acceptance Scenarios**:

1. **Given** un expediente con eventos propios, **When** el padre hace clic en "Descargar expediente", **Then** el navegador descarga un archivo PDF.

2. **Given** el PDF descargado, **When** se abre, **Then** contiene: (a) carátula con el identificador denunciado y la fecha de generación; (b) lista de sus eventos con fecha/hora Colombia, lugar y texto; (c) sección de contexto con lo que otros reportaron (solo fecha, país, ciudad, clasificación — sin texto ni autor).

3. **Given** el PDF fue descargado, **When** se verifica en el servidor, **Then** no existe ningún archivo almacenado (generado en memoria, no retenido).

---

### Edge Cases

- ¿Qué pasa si el padre intenta enviar el 2.º reporte con un `reportePrevioId` que no le pertenece? → El sistema rechaza la vinculación (validación de titularidad).
- ¿Qué pasa si el padre intenta enviar el 2.º reporte con un `reportePrevioId` válido pero para un identificador diferente? → El sistema rechaza (el identificador del 1.º reporte debe coincidir con el del 2.º).
- ¿Qué pasa si el expediente ya existe (3.er reporte y posteriores)? → Se agrega como nuevo evento al expediente existente; no se crea un 2.º expediente.
- ¿Qué pasa si el servicio de PDF falla? → El botón muestra un error; el expediente sigue accesible.
- ¿Qué pasa si el padre tiene el servicio vencido? → La vigencia ya bloquea antes del flujo de reporte; aplica el mismo guard existente.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cuando un padre autenticado detecta que ya reportó el mismo identificador recientemente, el sistema DEBE mostrar una oferta de vinculación en lugar de un mensaje de error bloqueante.
- **FR-002**: La oferta DEBE incluir la identidad del identificador ya reportado y un botón de acción para continuar.
- **FR-003**: Al aceptar la oferta, el formulario DEBE mostrar el identificador fijo y no editable, garantizando que el 2.º reporte quede vinculado al 1.º.
- **FR-004**: La aceptación de la oferta DEBE comunicar al sistema que la vinculación es intencional, referenciando el reporte previo.
- **FR-005**: El sistema DEBE crear el 2.º reporte con todos los datos reales (lugar, texto, fecha) a través del mismo canal que el 1.º reporte — sin atributos por defecto ni caminos alternativos de creación.
- **FR-006**: Al crear el 2.º reporte vinculado, el sistema DEBE crear automáticamente un expediente que agrupe ambos reportes como eventos, sin requerir acción explícita del padre.
- **FR-007**: Si el expediente ya existe para ese padre e identificador (3.er reporte en adelante), el sistema DEBE agregar el nuevo reporte como evento al expediente existente en lugar de crear uno nuevo.
- **FR-008**: El detalle del expediente DEBE mostrar al padre sus propios eventos con fecha/hora en hora Colombia, lugar, texto y clasificación del motor.
- **FR-009**: El detalle del expediente DEBE mostrar el contexto de otros reportes sobre el mismo identificador, pero SOLO con: fecha, país, ciudad y clasificación. El texto y la identidad del otro padre NO deben aparecer ni en la presentación ni en el payload de la respuesta.
- **FR-010**: Solo el padre titular del expediente DEBE poder ver su detalle y descargarlo. El acceso de otros padres al detalle ajeno DEBE ser denegado.
- **FR-011**: El sistema DEBE permitir al padre descargar el PDF del expediente, generado en el momento de la solicitud y no retenido en el servidor.
- **FR-012**: El PDF DEBE incluir: carátula con el identificador denunciado y la fecha de generación, lista completa de eventos propios (con fecha/hora Colombia, lugar, texto), y sección de contexto de otros reportes (solo fecha, país, ciudad, clasificación).
- **FR-013**: La detección de duplicados y el lock de concurrencia existentes (SPEC-137) DEBEN conservarse intactos. Solo cambia la respuesta al padre autenticado; el comportamiento para usuarios anónimos NO cambia.
- **FR-014**: El test E2E que afirma el bloqueo anterior (429 `DUPLICATE_REPORT`) DEBE actualizarse para afirmar el nuevo comportamiento (oferta), con una aserción igual de fuerte.

### Key Entities

- **Reporte**: Denuncia individual de un identificador. Tiene identificador, plataforma, texto, ciudad, país, fecha de incidente, creador (padre o anónimo), estado y clasificación del motor.
- **Expediente**: Carpeta que agrupa todos los reportes de un padre sobre un mismo identificador. Tiene un padre titular, el identificador reportado, estado y lista de eventos ordenados.
- **EventoExpediente**: Entrada en el expediente que referencia un Reporte específico. Tiene fecha/hora, texto y orden secuencial.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un padre autenticado que reporta el mismo identificador por 2.ª vez ve la oferta en menos de 2 segundos desde el envío.
- **SC-002**: Tras aceptar la oferta y enviar el 2.º reporte, el expediente existe en la base de datos en menos de 5 segundos.
- **SC-003**: El payload de "contexto de otros" en el detalle del expediente NO contiene campo de texto ni identificador del autor en ningún caso (tasa de cumplimiento: 100%).
- **SC-004**: El PDF se descarga correctamente en un máximo de 10 segundos para un expediente con hasta 20 eventos.
- **SC-005**: Ningún comportamiento existente de usuarios anónimos o del sistema de anti-abuso es modificado (regresión cero en los tests de anti-abuso).
- **SC-006**: El flujo completo (1.er reporte → oferta → 2.º reporte → expediente → PDF) puede ejercerse de extremo a extremo en un entorno de desarrollo.

---

## Assumptions

- El padre ya está autenticado y tiene el servicio vigente al momento de usar este flujo (la vigencia es validada por el sistema existente antes de llegar a la creación de reportes).
- El expediente agrupa reportes de UN SOLO padre titular. Múltiples padres pueden reportar el mismo identificador, pero cada uno tiene su propio expediente independiente.
- No se mide riesgo ni se genera scoring en esta SPEC. La clasificación del motor (mostrada en el expediente) ya existe y se consume sin modificación.
- El texto de los eventos propios que aparece en la vista del expediente y en el PDF proviene del texto del evento registrado al momento de crear el expediente (no del texto cifrado del reporte).
- La detección de duplicados (30 días, mismo padre + mismo identificador) se conserva sin cambios. La ventana de 30 días es la vigente en el sistema actual.
- La vista del expediente (US3) y el PDF (US4) son accesibles desde el área personal del padre (ruta existente o nueva, a determinar en el plan).
- `pdf-denuncia.ts` puede no ser adecuado para la estructura del expediente del padre — se evaluará en el plan si se reutiliza o se crea un nuevo módulo de PDF.
- La pantalla de los 3.er y posteriores eventos (flujo de reincidencia) no crea un nuevo expediente sino que agrega al existente; este caso se trata como edge case del US2.
- §3.5-3.8 (fecha+hora en el wizard, campo de ubicación, navegación, checkbox anónimo) van en SPEC-B / 002-PI-224 y NO forman parte de esta SPEC.
