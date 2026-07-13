# Feature Specification: Módulo de Reportes Comunitarios

**Feature Branch**: `[###-reportes-comunitarios]`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Módulo de reportes de protección infantil (fase 2). Usuarios anónimos y autenticados crean reportes sobre números telefónicos, nicks o usuarios de plataformas (redes sociales, juegos, WhatsApp y otras mensajerías) que consideran de riesgo para menores. Cada reporte contiene: identificador reportado (número o nick + plataforma), texto libre describiendo la situación, fecha del incidente, ciudad y país. Sin fotos, videos ni audio — solo texto. Al crearse, el reporte entra a una cola de procesamiento donde el modelo de IA local clasifica la conducta descrita, detecta reportes duplicados del mismo reportante sobre el mismo identificador, y marca reportes incoherentes o spam para revisión del administrador. Las clasificaciones se guardan junto al texto original, y el administrador puede corregirlas desde su panel (esas correcciones se acumulan como dataset para mejorar el modelo a futuro). Un identificador se vuelve visible en consultas públicas solo al superar el umbral de reportes independientes configurado en los parámetros del sistema (fase 1). Toda pantalla de creación de reporte muestra los canales oficiales de denuncia (línea 141 ICBF, CAI Virtual, Te Protejo)."

---

## User Scenarios & Testing

### User Story 1 — Crear reporte sobre identificador de riesgo (Priority: P1)

Un padre, tutor o ciudadano (anónimo o autenticado) quiere reportar un número telefónico, nick o usuario de plataforma que considera de riesgo para menores. Accede al formulario de reporte, completa los campos obligatorios y recibe confirmación de que su reporte fue recibido.

**Why this priority**: Es el flujo central del módulo. Sin la capacidad de crear reportes, no hay datos para clasificar ni consultar.

**Independent Test**: Un usuario puede acceder a `/reportar`, completar el formulario con un número de teléfono, texto descriptivo, fecha, ciudad, país y plataforma, y recibir una confirmación de éxito. El reporte queda almacenado y visible para el administrador.

**Acceptance Scenarios**:

1. **Given** un usuario anónimo en la pantalla de reporte, **When** completa todos los campos obligatorios (identificador, plataforma, texto, fecha, ciudad, país) y envía, **Then** el sistema almacena el reporte y muestra confirmación con número de seguimiento.
2. **Given** un usuario autenticado (rol PARENT), **When** crea un reporte, **Then** el reporte se vincula a su cuenta y puede consultarlo posteriormente.
3. **Given** cualquier usuario en la pantalla de reporte, **When** la página carga, **Then** se muestran visiblemente los canales oficiales de denuncia (Línea 141 ICBF, CAI Virtual, Te Protejo) antes del formulario.

---

### User Story 2 — Clasificación automática de conductas por IA (Priority: P1)

El sistema procesa cada reporte nuevo mediante un modelo de inteligencia artificial local que analiza el texto descriptivo y clasifica la conducta observada en categorías predefinidas.

**Why this priority**: La clasificación permite agregar datos, detectar patrones y alimentar el módulo de consulta pública. Sin clasificación, los reportes son solo texto no estructurado.

**Independent Test**: Un administrador puede ver en el panel de reportes que cada entrada tiene una clasificación asignada automáticamente (ej: "contacto insistente", "solicitud de material") junto al texto original.

**Acceptance Scenarios**:

1. **Given** un reporte recién creado, **When** entra a la cola de procesamiento, **Then** el modelo de IA local lo clasifica en una de las categorías de conducta definidas en menos de 30 segundos.
2. **Given** un texto descriptivo ambiguo o incompleto, **When** el modelo no puede clasificar con confianza, **Then** marca el reporte como "revisión manual" para el administrador.
3. **Given** un reporte clasificado, **When** el administrador accede al panel, **Then** ve la categoría sugerida junto al texto original y un indicador de confianza.

---

### User Story 3 — Panel de administrador para revisar y corregir clasificaciones (Priority: P2)

El administrador de plataforma revisa los reportes clasificados por IA, corrige clasificaciones erróneas y esas correcciones se acumulan como dataset para mejorar el modelo.

**Why this priority**: La precisión del modelo de IA mejora con retroalimentación humana. Sin corrección manual, el modelo no aprende de sus errores.

**Independent Test**: Un administrador puede filtrar reportes por categoría, abrir uno, cambiar su clasificación y ver que el cambio queda registrado como "corrección humana".

**Acceptance Scenarios**:

1. **Given** un reporte clasificado como "ofrecimiento de regalos", **When** el administrador lo revisa y determina que es "suplantación de identidad", **Then** puede cambiar la clasificación y el sistema guarda tanto la original como la corregida.
2. **Given** una corrección aplicada, **When** el administrador guarda, **Then** el registro de corrección se añade al dataset de entrenamiento para futuras iteraciones del modelo.
3. **Given** múltiples reportes pendientes de revisión, **When** el administrador accede al panel, **Then** puede filtrar por estado (pendiente, revisado, marcado para revisión manual) y priorizar.

---

### User Story 4 — Detección de duplicados y filtrado de spam (Priority: P2)

El sistema detecta cuando el mismo reportante envía múltiples reportes sobre el mismo identificador, y marca reportes incoherentes o de baja calidad para revisión del administrador.

**Why this priority**: Evita inflar artificialmente la cuenta de reportes de un identificador y protege la calidad del dataset de entrenamiento.

**Independent Test**: Dos reportes del mismo email sobre el mismo número telefónico son detectados como duplicados; un reporte con texto "asdf asdf" es marcado como posible spam.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado que ya reportó el número +573001234567, **When** intenta crear un segundo reporte sobre el mismo número en menos de 30 días, **Then** el sistema muestra una advertencia y vincula el nuevo reporte al existente en lugar de crear uno nuevo.
2. **Given** un reporte con texto menor a 20 caracteres o sin contenido semántico coherente, **When** entra a procesamiento, **Then** el sistema lo marca como "posible spam" y lo envía a revisión del administrador.
3. **Given** un reporte marcado como duplicado, **When** el administrador revisa, **Then** puede decidir mantenerlo como reporte adicional o descartarlo.

---

### User Story 5 — Visibilidad condicional en consultas públicas (Priority: P3)

Los identificadores reportados solo aparecen en consultas públicas cuando han acumulado suficientes reportes independientes, según el umbral configurable en parámetros del sistema.

**Why this priority**: Protege contra la visibilización prematura de identificadores con pocos reportes, evitando daño reputacional injustificado.

**Independent Test**: Un identificador con 2 reportes no aparece en consulta pública cuando el umbral está en 3; con 3 reportes independientes, sí aparece.

**Acceptance Scenarios**:

1. **Given** un número telefónico con 2 reportes independientes, **When** un usuario consulta en la página pública, **Then** el sistema indica que no hay información suficiente (sin mostrar el número).
2. **Given** un número telefónico con 5 reportes independientes y umbral configurado en 3, **When** un usuario consulta, **Then** ve el número junto con la cantidad de reportes y distribución por fecha/ciudad.
3. **Given** un administrador que cambia el umbral de 3 a 5, **When** guarda el cambio, **Then** los identificadores con 3-4 reportes dejan de ser visibles públicamente.

---

### Edge Cases

- **What happens when** un usuario anónimo reporta un identificador que ya tiene reportes previos de usuarios autenticados? El reporte anónimo cuenta para el umbral agregado pero no se vincula a una cuenta.
- **How does the system handle** un texto que contiene datos personales del menor (nombre, escuela, dirección)? El modelo de IA detecta PII en el texto y marca el reporte para anonimización manual por el administrador.
- **What happens when** Resend (email) falla al enviar confirmación de reporte? El reporte se almacena igualmente; la confirmación de email es un nice-to-have, no bloqueante.
- **How does the system handle** un reporte en idioma diferente al español? El modelo intenta clasificar; si no puede, marca para revisión manual.

---

## Requirements

### Functional Requirements

- **FR-001**: Usuarios anónimos y autenticados (rol PARENT) pueden crear reportes sobre identificadores de riesgo.
- **FR-002**: Cada reporte contiene obligatoriamente: identificador reportado (número o nick), plataforma, texto descriptivo, fecha del incidente, ciudad y país.
- **FR-003**: El sistema rechaza reportes que intenten adjuntar fotos, videos, audio o cualquier archivo multimedia.
- **FR-004**: Toda pantalla de creación de reporte muestra, de forma visible e ineludible, los canales oficiales de denuncia: Línea 141 ICBF, CAI Virtual, Te Protejo.
- **FR-005**: Los reportes nuevos entran automáticamente a una cola de procesamiento asíncrono.
- **FR-006**: El modelo de IA local clasifica la conducta descrita en el texto en categorías predefinidas (contacto insistente, solicitud de material, ofrecimiento de regalos, suplantación de identidad, solicitud de encuentro, compartimiento de contenido sexual).
- **FR-007**: El sistema detecta reportes duplicados del mismo reportante sobre el mismo identificador en un período de 30 días.
- **FR-008**: El sistema marca reportes incoherentes, de texto muy corto (< 20 caracteres) o sin contenido semántico como "posible spam" para revisión del administrador.
- **FR-009**: El administrador (rol ADMIN) puede revisar y corregir clasificaciones desde un panel dedicado.
- **FR-010**: Cada corrección de clasificación se registra como par (texto original, clasificación correcta) en un dataset de entrenamiento para futuras mejoras del modelo.
- **FR-011**: Un identificador solo aparece en resultados de consulta pública cuando ha acumulado un número de reportes independientes igual o mayor al umbral configurable en parámetros del sistema.
- **FR-012**: En consultas públicas, el lenguaje es exclusivamente descriptivo y estadístico — nunca implica culpabilidad ni emite juicios de valor sobre personas.

### Key Entities

- **Reporte**: Representa una denuncia individual. Contiene identificador, plataforma, texto descriptivo, fecha del incidente, ciudad, país, estado de procesamiento, clasificación IA, y vínculo al reportante (si autenticado).
- **IdentificadorReportado**: Un número telefónico, nick o nombre de usuario que ha recibido uno o más reportes. Tiene conteo agregado de reportes independientes y visibilidad pública condicionada al umbral.
- **ClasificacionIA**: Resultado del análisis automático de un reporte. Contiene categoría de conducta, nivel de confianza, y timestamp de procesamiento.
- **CorreccionAdmin**: Registro de una corrección manual aplicada por un administrador a la clasificación de un reporte. Guarda clasificación original, clasificación corregida, administrador que corrigió, y motivo.
- **DatasetEntrenamiento**: Colección acumulada de pares (texto de reporte, clasificación correcta) derivada de correcciones administrativas, usada para reentrenar el modelo de IA.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Un usuario puede crear un reporte completo en menos de 3 minutos desde el primer clic en el formulario hasta la confirmación.
- **SC-002**: El modelo de IA clasifica un reporte en menos de 30 segundos desde que entra a la cola de procesamiento.
- **SC-003**: El sistema detecta automáticamente al menos el 95% de los reportes duplicados (mismo reportante + mismo identificador en ventana de 30 días).
- **SC-004**: El 100% de las pantallas de creación de reporte muestran los canales oficiales de denuncia sin requerir scroll ni interacción adicional.
- **SC-005**: Un administrador puede corregir la clasificación de un reporte en menos de 1 minuto desde que abre el panel de revisión.
- **SC-006**: Los identificadores con reportes por debajo del umbral configurado nunca aparecen en resultados de consulta pública.

---

## Assumptions

- El modelo de IA corre localmente mediante Ollama; los textos de reporte no salen del servidor.
- La cola de procesamiento asíncrono usa `pg-boss` sobre la misma base de datos PostgreSQL.
- El umbral de visibilidad pública ya está configurado en el sistema (fase 1, módulo de parámetros).
- Los usuarios anónimos proporcionan un email opcional para recibir confirmación, pero no es obligatorio.
- La detección de duplicados se basa en email (si autenticado) o cookie/ fingerprint (si anónimo) más el identificador reportado.
- El sistema de consulta pública se implementa en fase 3; este módulo solo crea y clasifica reportes.