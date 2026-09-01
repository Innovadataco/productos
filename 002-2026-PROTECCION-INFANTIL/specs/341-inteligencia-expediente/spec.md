# Feature Specification: SPEC-341 · La inteligencia del expediente (análisis IA en fila)

**Feature Branch**: `work/pi-SPEC-341-inteligencia-expediente`

**Created**: 2026-09-01

**Status**: DESARROLLO

**Impacto en arquitectura:** aditivo · nuevo modelo `AnalisisExpediente` + enums `AlcanceAnalisis` / `EstadoAnalisis` · nueva cola pg-boss `padre.analisis.expediente` con advisory-lock 123456799 · nueva ruta `GET/POST /api/padre/expedientes/[id]/analisis` · nuevo componente `AnalisisExpediente` bajo el mapa del `ExpedienteVivo` (SPEC-340). Sin cambios en tablas existentes; el motor de expediente actual (SPEC-323/236/340) no se toca.

**Input**: Brief A-68 §4.4 capa 2 · Fase 2 · "La inteligencia del expediente"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El padre abre su expediente y lee el análisis interpretativo (Priority: P1)

Un padre abre el expediente de una cadena por primera vez, o vuelve después de que
llegó un evento nuevo (propio o ajeno). Bajo el mapa aparece la sección
**"Análisis detallado"** con el texto interpretativo del modelo, sellado por su
corte (fecha y N hechos incluidos), etiquetado como *análisis asistido* y cerrando
con **"Qué puedes hacer ahora"** — los pasos concretos de la categoría dominante
tomados de la GuiaAccionCategoria publicada. El sistema decide solo:

- Si ya hay un análisis previo Y la cadena no cambió (mismo hash) → muestra ese
  análisis al instante, sin gastar modelo.
- Si la cadena cambió o nunca hubo → encola la generación, muestra el último
  disponible (o la invitación si no hay ninguno) + el aviso *"Estamos generando
  tu análisis con lo más reciente — estará en ~X minutos"*. El padre puede
  navegar y volver.

**Why this priority**: es la funcionalidad completa del brief; sin ella el panel
"Lo que muestra tu expediente" queda sin la lectura interpretativa y sigue
mostrando la invitación abstracta prometida en la capa 1 (SPEC-340).

**Independent Test**: entrar al detalle de un expediente por primera vez,
verificar que aparece el estado *"generando"*, esperar el tiempo estimado y
recargar → aparece el análisis con su sello, la etiqueta "análisis asistido" y
la sección "Qué puedes hacer ahora" con los pasos de la categoría dominante.

**Acceptance Scenarios**:

1. **Given** un expediente del padre sin análisis previo y con al menos 1 hecho,
   **When** el padre abre el detalle del expediente,
   **Then** el sistema encola UN job de análisis y muestra el placeholder
   *"Estamos generando tu análisis con lo más reciente — estará en ~<X> minutos"*
   (donde X viene de un parámetro de sistema), y el padre puede navegar libremente.
2. **Given** un análisis previo con corte que coincide con el hash actual de la
   cadena, **When** el padre reabre el expediente,
   **Then** aparece el análisis previo instantáneamente, con su sello
   *"Análisis al corte del <fecha> · incluye <N> hechos"*, sin generar uno nuevo.
3. **Given** un análisis previo cuyo hash NO coincide (llegó un evento después),
   **When** el padre reabre el expediente,
   **Then** aparece el análisis previo con el aviso *"Hay <M> hechos nuevos desde
   este análisis"* Y en paralelo se encola un análisis nuevo (o se reusa el job
   en curso si ya existe uno pendiente para el mismo expediente).

---

### User Story 2 — El padre pide "Actualizar análisis" a mano (Priority: P2)

El padre no confía en la última generación (o pasó tiempo y quiere verlo fresco)
y aprieta **"Actualizar análisis"**. El botón está bajo la ventana de enfriamiento
mientras el análisis vigente sea muy reciente; una vez pasado el cool-down, el
botón queda activo. Si al momento de apretarlo la cadena NO cambió y el análisis
ya está al día, el sistema lo dice honestamente en vez de gastar modelo.

**Why this priority**: es el respiradero manual del brief. Sin él, un análisis
raro o incompleto no se puede rehacer y el padre se queda con dudas.

**Independent Test**: con un análisis vigente y un cool-down parametrizado en
5 min, verificar: (a) el botón está deshabilitado con el texto del tiempo
restante; (b) tras el cool-down el botón se habilita; (c) apretarlo genera un
job nuevo; (d) si no cambió la cadena, el sistema responde *"Tu análisis ya está
al día — nada nuevo que interpretar"*.

**Acceptance Scenarios**:

1. **Given** un análisis vigente creado hace menos de <cooldown> minutos,
   **When** el padre mira el botón, **Then** aparece deshabilitado con el
   texto *"Podrás actualizar en <N> minutos"*.
2. **Given** un análisis vigente con cool-down cumplido Y hash de cadena
   diferente al del análisis, **When** el padre pulsa "Actualizar análisis",
   **Then** el sistema encola un job nuevo (o reusa el en curso), regresa a
   la sección con el aviso *"Estamos generando…"* y el botón queda inhabilitado
   con el nuevo cool-down.
3. **Given** un análisis vigente con cool-down cumplido pero mismo hash de
   cadena, **When** el padre pulsa "Actualizar análisis",
   **Then** el sistema NO encola job, muestra *"Tu análisis ya está al día"* y
   reinicia el cool-down para evitar spam del botón.

---

### User Story 3 — La fila avanza de a uno con corte visible (Priority: P2)

El motor procesa los análisis uno a uno para no saturar la Mac de producción.
Cuando el padre está esperando su análisis y hay cola, el aviso lo dice honesto:
*"Estamos generando tu análisis — hay <K> antes en la fila, tomará ~<Y> minutos"*.
Cada análisis publicado deja un corte auditable: fecha exacta de generación,
número de hechos incluidos, y el hash de cadena sobre el que se calculó.

**Why this priority**: sin fila serializada, dos padres abriendo a la vez
saturan el modelo y ambos ven demoras impredecibles; sin corte, el padre no
puede juzgar si el análisis mira lo mismo que lo que ve en el mapa.

**Independent Test**: encolar 5 jobs manualmente, verificar que se procesan uno
a uno respetando el máximo configurado, y que cada análisis persiste su
`versionSecuencial`, `corteN`, `hashCadena` y `generadoEn`.

**Acceptance Scenarios**:

1. **Given** el parámetro `padre.analisis.max_concurrentes = 1`,
   **When** llegan 3 jobs a la vez, **Then** el segundo y tercero esperan a
   que termine el primero, sin correr en paralelo.
2. **Given** un job atascado más allá del `tiempo_estimado_seg` × 3,
   **When** el worker detecta el timeout, **Then** el job se marca FALLIDO con
   motivo *"tiempo excedido"* y el UI del padre queda en fallback (último
   análisis disponible + aviso de reintentar).
3. **Given** un análisis publicado, **When** se consulta desde el DAL,
   **Then** el registro es inmutable: sus campos `texto`, `corteN`,
   `hashCadena`, `generadoEn` no se pueden mutar (nueva versión = nueva fila).

---

### User Story 4 — El módulo colegio reusa la misma tubería con datos blindados (Priority: P3)

El módulo colegio (SPEC-C3, fuera de este brief pero anticipado por el CEO)
necesita el mismo motor de análisis IA sobre patrones institucionales, pero SIN
PII (no vive dentro del expediente de un padre). Este SPEC entrega la tubería
con un parámetro **alcance** — `PADRE_COMPLETO` o `COLEGIO_BLINDADO` — que:

- Determina qué datos de entrada arma el orquestador para el modelo (para
  padre: hechos con ciudad/plataforma/categoría/fecha por hecho; para colegio:
  agregados por categoría/franja horaria/curso, jamás por identificador).
- Selecciona el prompt sistema del parámetro de configuración
  (`padre.analisis.prompt_sistema` vs `colegio.analisis.prompt_sistema`).
- Se guarda con `alcance` en el modelo para nunca confundir un análisis con el
  otro cuando se consulte.

**Why this priority**: es lo que le permite al CEO no volver a construir esto
para el colegio. No entrega funcionalidad al padre — su valor es evitar la
duplicación cuando arranque C3. La consumibilidad se prueba con un test unitario
del orquestador que cambia `alcance` y verifica que arma datos distintos.

**Independent Test**: llamar al orquestador con `alcance=COLEGIO_BLINDADO` y un
expediente arbitrario, comprobar que los datos que arma NO incluyen
identificadores, texto crudo ni PII, y que el prompt sistema usado es el del
colegio. No requiere que el módulo colegio exista para probarse.

**Acceptance Scenarios**:

1. **Given** un expediente con eventos e identificadores,
   **When** el orquestador arma los datos con `alcance=COLEGIO_BLINDADO`,
   **Then** el payload al modelo contiene solo agregados y no aparece
   ningún valor de identificador (grep de valores exactos = 0 hits).
2. **Given** el mismo expediente, **When** el orquestador arma con
   `alcance=PADRE_COMPLETO`, **Then** el payload incluye la lista de hechos
   con ciudad + plataforma + categoría + fecha por hecho (el detalle rico que
   el padre ve en su UI).

---

### Edge Cases

- **Expediente sin hechos**: no se encola ningún análisis; el UI muestra
  *"Este expediente no tiene eventos analizables todavía"*.
- **Cadena cambió justo mientras el worker genera**: el análisis se guarda con
  su hash-al-momento-de-armar-datos, y al abrir el padre ve el aviso
  *"Hay N hechos nuevos desde este análisis"*. NO se reintenta automáticamente
  (cero trabajo invisible); el padre debe pedir "Actualizar" si quiere.
- **Fallo del modelo (timeout, error 5xx del cliente Ollama)**: el análisis
  vigente sigue mostrándose; se registra el fallo en la traza del job y el UI
  añade *"El último intento no completó — puedes actualizar más tarde"*.
- **Padre abre dos pestañas del mismo expediente**: cada apertura evalúa el
  hash; si en la segunda apertura ya hay un job en curso para ese expediente,
  la segunda NO encola otro (idempotencia por `expedienteId + hashCadena` a
  nivel de la cola y del modelo AnalisisExpediente).
- **La GuiaAccionCategoria de la categoría dominante NO está publicada**: el
  análisis se muestra igual, pero la sección "Qué puedes hacer ahora" cae a un
  mensaje neutro (*"Estamos preparando la guía para esta categoría"*), y el
  fallo se registra en la traza del job para que el admin lo publique.
- **Concurrencia de "Actualizar" de dos padres distintos**: la cola serializa
  por `padre.analisis.max_concurrentes`, pero cada job es de un expediente
  distinto → cada padre recibe su análisis en orden de llegada.

---

## Requirements *(mandatory)*

### Functional Requirements

**Detección del cambio de la cadena**

- **FR-001**: El sistema DEBE calcular un `hashCadena` determinista sobre
  `(Expediente.ultimoEventoEn, Expediente.numEventos, Expediente.categoriasDominantesJson)`
  cada vez que se abre el detalle del expediente.
- **FR-002**: El sistema DEBE reusar el análisis vigente sin encolar ni gastar
  modelo cuando el `hashCadena` calculado coincide con el `hashCadena` del
  último `AnalisisExpediente` publicado del expediente.
- **FR-003**: El sistema DEBE encolar UN job de análisis cuando el hash difiere
  o cuando no existe ningún análisis para el expediente.

**Motor de generación (fila, uno a uno)**

- **FR-004**: El sistema DEBE serializar la generación de análisis vía cola
  con concurrencia máxima definida por el parámetro
  `padre.analisis.max_concurrentes` (default 1).
- **FR-005**: El worker de análisis DEBE tomar advisory-lock propio para evitar
  ejecuciones múltiples en paralelo entre instancias.
- **FR-006**: El sistema NO DEBE ejecutar barridos periódicos ni regeneración
  automática por evento — el gasto de modelo solo se dispara por apertura del
  expediente o por acción explícita "Actualizar" del padre.
- **FR-007**: Cada job DEBE llevar `expedienteId` y `hashCadena` como llave
  natural, de forma que múltiples aperturas del mismo expediente sin cambios
  no encolen más de un job vivo.
- **FR-008**: Un job DEBE marcarse FALLIDO con motivo cuando exceda
  `padre.analisis.tiempo_estimado_seg × 3` sin completar; el fallo NO borra
  el análisis vigente.
- **FR-008-bis**: El job de análisis DEBE encolarse con PRIORIDAD ESTRICTAMENTE
  MENOR que la clasificación de reportes (`padre.analisis.prioridad`, seed en
  el valor decidido por CEO 01-09: menor que `queue.clasificacion.prioridad`),
  de forma que un pico de reportes nuevos jamás demore la clasificación
  crítica por culpa de análisis en cola.
- **FR-008-ter**: La cola DEBE respetar un TOPE máximo de jobs vivos
  (`padre.analisis.tope_fila`, default 50): superado el tope, aperturas nuevas
  NO encolan y el UI muestra *"La cola está llena — vuelve a intentar en
  unos minutos"*. Esto evita que picos de tráfico saturen el modelo.
- **FR-008-quater**: Un análisis publicado tiene un TTL de refresco natural
  aparte del hash: `padre.analisis.ttl_horas` (default 168 h = 7 días). Si el
  análisis vigente es más viejo que el TTL, se lo considera obsoleto aunque
  el hash coincida y la próxima apertura encola generación (con el aviso
  *"Este análisis tiene más de <N> días — regenerando"*). Sin TTL,
  expedientes inactivos guardarían análisis viejos indefinidamente.

**Datos que se envían al modelo (nunca inventa hechos)**

- **FR-009**: El orquestador DEBE armar el payload al modelo a partir de
  DATOS CALCULADOS (hechos con fecha/ciudad/plataforma/categoría, agregados
  cuando apliquen), y NUNCA enviar textos crudos de reportes ni información
  privada de terceros.
- **FR-010**: El orquestador DEBE aceptar un parámetro `alcance` con dos
  valores exclusivos: `PADRE_COMPLETO` (lista de hechos rica para el padre) o
  `COLEGIO_BLINDADO` (solo agregados, cero identificadores/PII). El payload
  resultante debe ser observable y auditable por test.

**Salida del análisis**

- **FR-011**: El texto del análisis DEBE describir patrones y no acusar; el
  UI DEBE etiquetarlo como *"análisis asistido"* de forma visible en la misma
  tarjeta.
- **FR-012**: El análisis DEBE cerrar con la sección **"Qué puedes hacer ahora"**
  resolviendo la `GuiaAccionCategoria` PUBLICADA cuya categoría coincide con la
  categoría dominante del expediente.
- **FR-013**: Cuando NO exista una guía publicada para la categoría dominante,
  el análisis DEBE mostrarse igual con un mensaje neutro en lugar de la guía y
  registrar el faltante en la traza del job.
- **FR-014**: NADA en el análisis puede provenir de plantillas interpretativas
  pre-horneadas. El worker DEBE rechazar y fallar el job si el modelo devuelve
  un texto que coincide con la lista de frases prohibidas del parámetro
  `padre.analisis.frases_prohibidas_json`.

**Persistencia y corte inmutable**

- **FR-015**: Cada análisis publicado DEBE persistirse con:
  `expedienteId`, `versionSecuencial` (creciente por expediente), `corteN`
  (número de hechos incluidos al momento de armar el payload), `hashCadena`,
  `alcance`, `texto`, `categoriaDominante`, `modeloUsado`,
  `latenciaMs`, `generadoEn`.
- **FR-016**: Un análisis publicado DEBE ser inmutable: la única forma de
  "actualizar" es crear un nuevo `versionSecuencial`. Los análisis viejos NO
  se borran (auditoría permanente).
- **FR-017**: El sistema DEBE exponer la lectura del último análisis vigente
  del expediente vía el DAL, respetando la boundary del PARENT dueño del
  expediente para el `alcance=PADRE_COMPLETO` (403 para otros).

**Interacción "Actualizar análisis"**

- **FR-018**: El botón "Actualizar análisis" DEBE quedar deshabilitado por
  `padre.analisis.cooldown_min` minutos desde el `generadoEn` del análisis
  vigente. La UI DEBE mostrar el tiempo restante.
- **FR-019**: Al pulsarlo, si el hash de cadena NO cambió, el sistema DEBE
  responder *"Tu análisis ya está al día"* SIN encolar job y reiniciar el
  cool-down.
- **FR-020**: Al pulsarlo cuando el hash cambió, el sistema DEBE encolar un
  job nuevo (o reusar el en curso para el mismo expediente).

**UI del expediente**

- **FR-021**: El detalle del expediente DEBE mostrar una sección
  **"Análisis detallado"** con: el texto del análisis vigente, el sello
  *"Análisis al corte del <fecha con zona America/Bogota> · incluye <N> hechos"*,
  el aviso *"Hay <M> hechos nuevos desde este análisis"* cuando el hash actual
  difiere, y el botón "Actualizar análisis".
- **FR-022**: Cuando no exista análisis, el UI DEBE mostrar el placeholder
  *"Estamos generando tu análisis con lo más reciente — estará en ~<X> minutos"*
  (X = `padre.analisis.tiempo_estimado_seg` traducido a minutos) y refrescar
  automáticamente cuando el análisis se publique.
- **FR-023**: La UI DEBE informar honestamente si hay cola: *"Hay <K> antes en
  la fila, tomará ~<Y> minutos"*.

**Estado de espera de primera clase (mockup ExpedienteGenerando aprobado)**

El brief y el CEO exigen que el estado "generando" NO sea un placeholder
neutro: es UX de primera línea con tres piezas visibles a la vez.

- **FR-024**: El componente `ExpedienteGenerando` (o equivalente) DEBE mostrar
  un banner honesto con: (a) posición REAL en la fila (`hay K antes de ti`,
  calculado sobre la cola en vivo), (b) minutos estimados totales de espera
  (`K × padre.analisis.tiempo_estimado_seg`), y (c) el mensaje base
  *"Estamos generando tu análisis con lo más reciente"*. Todos los números se
  actualizan sin que el padre recargue (polling o SSE — la spec no lo dicta,
  pero el resultado debe verse "vivo").
- **FR-025**: MIENTRAS el análisis se genera, la sección de la capa 1
  (SPEC-340 · "Lo que muestra tu expediente" con las cifras determinsitas)
  DEBE seguir visible y marcada como **"En vivo"** — es información del
  padre que no depende del modelo y NUNCA se oculta por estar "generando".
- **FR-026**: SI hay un análisis previo (aunque su hash sea viejo), DEBE
  mostrarse ABAJO del banner, marcado *"N hechos nuevos después"* con
  el N calculado exacto (numEventos actual − corteN del análisis previo).
  Nunca desaparece — el padre siempre tiene "algo que leer" mientras espera.
- **FR-027**: El botón "Actualizar análisis" DEBE estar deshabilitado durante
  el estado "generando" (no encolar dos jobs al mismo expediente por accidente
  del padre); DEBE reaparecer habilitado cuando el análisis nuevo se publique y
  el cool-down se aplique desde el nuevo `generadoEn`.

### Key Entities

- **AnalisisExpediente**: registro del análisis IA de una cadena. Uno vigente
  por expediente + histórico inmutable. Atributos: `expedienteId`,
  `versionSecuencial`, `alcance`, `hashCadena`, `corteN`, `texto`,
  `categoriaDominante`, `modeloUsado`, `latenciaMs`, `generadoEn`, `estado`
  (`GENERANDO` | `PUBLICADO` | `FALLIDO`), `motivoFallo?`.

- **Cadena (derivada de Expediente)**: no es tabla nueva; es la vista lógica
  que se hashea. Componentes del hash: `ultimoEventoEn` + `numEventos` +
  `categoriasDominantesJson` del `Expediente`. Cualquier cambio en cualquiera
  de esos tres campos invalida el análisis vigente.

- **JobAnalisis (cola)**: entrada en pg-boss con nombre lógico
  `padre.analisis.expediente`. Payload: `{expedienteId, hashCadena, alcance,
  disparador: "APERTURA" | "ACTUALIZAR"}`. Idempotencia natural: si ya hay
  un job vivo con la misma `(expedienteId, hashCadena)` no se encola otro.

- **GuiaAccionCategoria (existente, se consume)**: catálogo por categoría con
  pasos y botones de acción. El análisis capa 2 la resuelve por
  `categoriaDominante` y `estado="publicada"`.

- **ParametrosSistema (existentes + nuevos, TODO SEMBRADO — regla de la casa,
  admin edita, Jelkin no se pregunta)**:
  - `padre.analisis.max_concurrentes` (int, default 1)
  - `padre.analisis.cooldown_min` (int, default 5)
  - `padre.analisis.tiempo_estimado_seg` (int, default 90)
  - `padre.analisis.tope_fila` (int, default 50 — FR-008-ter)
  - `padre.analisis.ttl_horas` (int, default 168 — FR-008-quater)
  - `padre.analisis.prioridad` (int, default 5 — MENOR que
    `queue.clasificacion.prioridad` que ya está en 10, FR-008-bis)
  - `padre.analisis.modelo` (string, default modelo Ollama disponible)
  - `padre.analisis.prompt_sistema` (string, sembrado con voz "análisis
    asistido · describe patrones, no acusa")
  - `padre.analisis.frases_prohibidas_json` (json array, sembrado con la
    lista corta de plantillas prohibidas del brief)
  - Gemelos `colegio.analisis.max_concurrentes`, `colegio.analisis.modelo`,
    `colegio.analisis.prompt_sistema` (semilla mínima para C3; el módulo
    colegio los explotará después).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 90% de las aperturas de un expediente con análisis vigente y
  hash coincidente muestran el texto en menos de 1 segundo, sin gasto de modelo.
- **SC-002**: El 0% de los análisis publicados incluye textos crudos de reportes
  o valores de identificadores en su input (verificable por grep sobre el
  payload registrado en la traza del job).
- **SC-003**: Cuando la cola está vacía, un análisis nuevo se publica en menos
  del doble del `padre.analisis.tiempo_estimado_seg` en más del 80% de los casos.
- **SC-004**: Cuando dos padres abren simultáneamente expedientes distintos con
  `max_concurrentes=1`, el segundo padre ve el aviso correcto de fila
  (*"hay 1 antes"*) y su análisis se publica al terminar el primero.
- **SC-005**: El botón "Actualizar" nunca encola dos jobs vivos para el mismo
  expediente ni permite gastar modelo cuando la cadena no cambió (verificable
  contando jobs y mediciones de latencia sobre el cliente IA).
- **SC-006**: El módulo colegio (SPEC-C3), cuando llegue, puede llamar al
  orquestador con `alcance=COLEGIO_BLINDADO` y obtener un análisis sin PII
  usando 0 líneas de código nuevas del motor (solo un cliente diferente que
  arma el payload). Verificable con un test unitario del orquestador que hoy
  ya pasa (aunque el módulo colegio no exista).
- **SC-007**: El componente `ExpedienteGenerando` es útil solo — un padre que
  llega en estado "generando" (a) ve su posición REAL en la fila, (b) sigue
  leyendo la capa 1 "En vivo", y (c) tiene el análisis previo visible con el
  contador "N hechos nuevos después" cuando existe. Verificable con un
  recorrido navegador que abre un expediente sin análisis, verifica los tres
  bloques presentes, y luego repite con expediente que sí tenía uno previo.
- **SC-008**: Cero jobs de análisis quedan "adelante" de un job de
  clasificación de reporte en la cola bajo ningún patrón de carga —
  verificable inyectando 10 análisis + 5 reportes intercalados y midiendo
  el orden real de despacho (los 5 reportes salen primero).

---

## Assumptions

- El brief A-68 §4.4 capa 1 (SPEC-340) ya está mergeado en producción o en
  camino inminente. Este SPEC se apoya en su modelo de "cadena" (Expediente
  con `numEventos`, `categoriasDominantesJson`, `ultimoEventoEn`) y en el
  panel `ExpedienteVivo` / `ExpedienteDetalleClient` para colgar la sección
  del análisis capa 2. Si al implementar SPEC-340 aún no está en `main`, se
  reintegra al mergear.
- La infraestructura de Ollama en la Mac de producción tolera el modelo
  configurado en `padre.analisis.modelo` corriendo de a uno (candado R16 de
  la memoria del CEO: la Mac no aguanta jurado de 3 modelos + operación,
  este SPEC corre UN modelo por vez).
- El `GuiaAccionCategoria` existente es la fuente única para "Qué puedes
  hacer ahora". No se hardcodea nada en el análisis; si falta la guía, el
  admin la publica y el próximo análisis la incluye.
- pg-boss es la cola de referencia (ya en uso por otros workers del producto);
  no se introduce un motor de colas nuevo.
- El cliente Ollama existente (`src/lib/ai/ollama-client.ts`) se reusa; este
  SPEC agrega un consumidor, no un cliente nuevo.
- Los buzones `+demo-*` y el guión demo SPEC-345 son un ambiente aceptable
  para probar el flujo end-to-end sin datos reales.

---

## Fuera de alcance (explícito)

- **Barrido nocturno, regeneración por evento o "background refresh"**: el
  brief lo prohíbe (*"cero trabajo invisible"*).
- **Guías de acción nuevas**: se consume el catálogo existente; publicar
  guías nuevas es tarea del admin, aparte.
- **Módulo colegio (C3)**: este SPEC entrega la tubería reutilizable, no la
  UI ni el consumo del colegio. C3 tiene su propio brief pendiente.
- **Escala multi-nodo**: el motor corre en la Mac única de producción; el
  advisory-lock protege contra doble ejecución cuando esa Mac se replique.
- **Notificación proactiva "análisis listo"**: el padre lo ve al reabrir; no
  se encola correo/campana por análisis publicado (§5-ter cubre otro evento).
- **Verificación pública del análisis (código verificador)**: el análisis vive
  dentro del expediente del padre; no lleva sello imprimible como el PDF de
  informes (SPEC-234/340). Si en el futuro se exporta como PDF, se abre otro
  SPEC para el sello.
