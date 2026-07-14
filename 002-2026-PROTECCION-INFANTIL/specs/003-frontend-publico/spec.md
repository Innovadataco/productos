Feature Specification: Frontend Público y Flujo de Reporte

**Feature Branch**: `feature/003-frontend-publico`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Implementar la interfaz web del módulo de reportes comunitarios, conectada a las API routes reales ya existentes. Es la cara pública del producto + el flujo de reporte para padres/anónimos + el seguimiento del padre."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar identificador de riesgo (Priority: P1)

Un visitante (padre, tutor o persona preocupada) llega al sitio y busca un número telefónico, nick de usuario o nombre de perfil para conocer si hay reportes comunitarios asociados. El sistema muestra estadísticas agregadas (por ciudad, mes, plataforma) sin emitir juicios de valor sobre personas. Los canales oficiales de denuncia (Línea 141, CAI Virtual, Te Protejo) son visibles en todo momento.

**Why this priority**: Es el corazón del producto y la razón de existir de la plataforma. Sin consulta pública, no hay valor para el usuario.

**Independent Test**: Un visitante puede buscar `+573001234567` en la página de inicio y ver resultados estadísticos o el mensaje "Sin reportes registrados para este identificador."

**Acceptance Scenarios**:

1. **Given** un visitante en la página de inicio, **When** ingresa un identificador y selecciona plataforma, **Then** ve estadísticas agregadas (total reportes, distribución por ciudad/mes) si supera el umbral configurado.
2. **Given** un identificador sin reportes suficientes, **When** se consulta, **Then** se muestra el mensaje neutro "Sin reportes registrados para este identificador." sin culpabilizar.
3. **Given** cualquier pantalla de consulta o reporte, **When** el usuario navega, **Then** los canales oficiales (Línea 141, CAI Virtual, Te Protejo) son visibles e ineludibles.

---

### User Story 2 - Crear reporte comunitario (Priority: P1)

Un padre o visitante anónimo quiere reportar una conducta sospechosa observada en una plataforma digital. El flujo consta de 4 pasos guiados: seleccionar plataforma → indicar ubicación → describir la conducta → revisar y enviar. Antes de enviar, debe confirmar que entiende que el reporte es informativo y no reemplaza una denuncia formal. Al finalizar, recibe un número de seguimiento.

**Why this priority**: Sin la capacidad de reportar, la base de datos no crece y la consulta pública pierde utilidad. Es el segundo pilar del producto.

**Independent Test**: Un usuario anónimo puede completar el flujo de 4 pasos, recibir un número de seguimiento `RPT-XXXXXX`, y ver el estado del reporte en la página de seguimiento.

**Acceptance Scenarios**:

1. **Given** un visitante sin cuenta, **When** elige "reportar anónimamente", **Then** puede completar los 4 pasos sin autenticación y recibe número de seguimiento.
2. **Given** un padre autenticado, **When** inicia un reporte, **Then** el sistema detecta si ya reportó ese identificador en los últimos 30 días y bloquea duplicados.
3. **Given** un usuario en el paso final, **When** intenta enviar sin marcar el checkbox de confirmación, **Then** el sistema bloquea el envío y muestra el mensaje correspondiente.
4. **Given** un reporte enviado, **When** el usuario ve la confirmación, **Then** se muestra el número de seguimiento y la invitación a guardarlo.

---

### User Story 3 - Autenticación de padres (Priority: P2)

Un padre quiere crear una cuenta para realizar reportes autenticados (que aportan más peso a la visibilidad pública) y consultar sus reportes históricos. El flujo incluye registro con email, verificación por código de 6 dígitos enviado por correo, login con cookie httpOnly, y logout.

**Why this priority**: Los reportes autenticados son críticos para el algoritmo de visibilidad (ratio de autenticados ≥ 50%). Sin autenticación fluida, la consulta pública no alcanza su potencial.

**Independent Test**: Un padre puede registrarse, recibir código de verificación, completar el registro, iniciar sesión, y acceder a su panel de reportes.

**Acceptance Scenarios**:

1. **Given** un nuevo padre, **When** completa el formulario de registro, **Then** recibe un código de 6 dígitos por email y puede verificar su cuenta.
2. **Given** un padre verificado, **When** inicia sesión con credenciales correctas, **Then** recibe una cookie httpOnly y es redirigido a su panel.
3. **Given** un padre autenticado, **When** hace click en cerrar sesión, **Then** la cookie se elimina y es redirigido a la página de inicio.

---

### User Story 4 - Panel "Mis reportes" del padre (Priority: P2)

Un padre autenticado quiere ver el historial de reportes que ha realizado, con sus estados actuales (Recibido / En revisión / Compartido con autoridades). Nunca ve textoOriginal ni PII de terceros.

**Why this priority**: Cierra el ciclo del flujo de reporte. El padre necesita saber qué pasó con su reporte después de enviarlo.

**Independent Test**: Un padre autenticado puede ver una lista de sus reportes con estado, fecha, plataforma e identificador, sin datos sensibles de terceros.

**Acceptance Scenarios**:

1. **Given** un padre con reportes previos, **When** accede a "Mis reportes", **Then** ve una lista con estado visual (color + etiqueta) para cada reporte.
2. **Given** un reporte en estado "REQUIERE_ANONIMIZACION", **When** el padre lo ve en su lista, **Then** el estado mostrado es "En revisión de privacidad" (texto amigable, no el enum técnico).
3. **Given** cualquier reporte en la lista, **When** el padre lo inspecciona, **Then** nunca ve textoOriginal ni datos PII de menores.

---

### User Story 5 - Seguimiento de reporte por número (Priority: P3)

Cualquier persona con un número de seguimiento puede consultar el estado de un reporte específico sin autenticación.

**Why this priority**: Funcionalidad de transparencia y confianza. Permite al usuario verificar que su reporte fue recibido.

**Independent Test**: Ingresar `RPT-XXXXXX` en el formulario de seguimiento muestra el estado actual del reporte.

**Acceptance Scenarios**:

1. **Given** un número de seguimiento válido, **When** se consulta, **Then** se muestra el estado del reporte con un mensaje descriptivo amigable.
2. **Given** un número de seguimiento inexistente, **When** se consulta, **Then** se muestra un mensaje de error claro sin exponer información interna.

---

### Edge Cases

- ¿Qué pasa cuando Ollama no está disponible y el reporte queda en "PENDIENTE"? → La UI debe mostrar "En procesamiento" sin alarmar al usuario.
- ¿Cómo se maneja un reporte con texto muy corto (< 20 chars)? → El backend lo marca como POSIBLE_SPAM; la UI debe mostrar "En revisión" sin culpabilizar.
- ¿Qué ocurre si el usuario pierde su número de seguimiento? → No hay recuperación; la UI debe enfatizar en la pantalla de confirmación que guarde el número.
- ¿Cómo se comporta la consulta pública cuando hay exactamente 3 reportes pero todos anónimos? → No es visible (ratio autenticados = 0% < 50%); la UI muestra "Sin reportes registrados".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar una página de inicio con búsqueda de identificador (número, nick, usuario) y selección de plataforma.
- **FR-002**: El sistema DEBE mostrar resultados de consulta con estadísticas agregadas (total reportes, distribución por ciudad, país, mes) cuando el identificador supera el umbral configurado.
- **FR-003**: El sistema DEBE mostrar el mensaje "Sin reportes registrados para este identificador." cuando no hay datos suficientes, sin emitir juicios de valor.
- **FR-004**: Los canales oficiales de denuncia (Línea 141 ICBF, CAI Virtual, Te Protejo) DEBEN ser visibles e ineludibles en toda pantalla de consulta y reporte.
- **FR-005**: El sistema DEBE permitir elegir modo de reporte: anónimo o con cuenta autenticada.
- **FR-006**: El flujo de nuevo reporte DEBE constar de 4 pasos guiados: plataforma → ubicación → descripción → revisar/enviar.
- **FR-007**: El sistema DEBE validar que el texto del reporte tenga entre 20 y 5000 caracteres antes de permitir el envío.
- **FR-008**: El sistema DEBE exigir un checkbox de confirmación antes de enviar: "Entiendo que este reporte es informativo y no reemplaza una denuncia formal ante las autoridades."
- **FR-009**: El sistema DEBE mostrar una pantalla de confirmación con el número de seguimiento (`RPT-XXXXXX`) tras enviar un reporte.
- **FR-010**: El sistema DEBE permitir registro de nuevos padres con email, nombre y contraseña, seguido de verificación por código de 6 dígitos enviado por correo.
- **FR-011**: El sistema DEBE permitir login con email y contraseña, usando cookie httpOnly (JWT), nunca localStorage para datos sensibles.
- **FR-012**: El sistema DEBE permitir logout que elimine la cookie de sesión.
- **FR-013**: El panel "Mis reportes" DEBE listar los reportes del usuario autenticado con estado visual amigado, sin exponer textoOriginal ni PII de terceros.
- **FR-014**: El sistema DEBE permitir consultar el estado de un reporte por número de seguimiento sin requerir autenticación.
- **FR-015**: La interfaz DEBE ser mobile-first, responsive, y seguir la dirección de diseño: estética minimalista con glassmorphism, animaciones suaves, tono sobrio institucional y cálido.
- **FR-016**: El sistema DEBE usar las fuentes Plus Jakarta Sans (texto) y DM Mono (datos técnicos/números).
- **FR-017**: La paleta de colores DEBE seguir el prototipo visual: azules primary, verdes accent, rojo SOLO para errores de UI reales.
- **FR-018**: Todos los formularios DEBEN cumplir accesibilidad básica: labels asociados, foco visible, contraste suficiente.
- **FR-019**: La UI DEBE conectarse a las API routes reales existentes sin mocks: GET /api/consulta, POST /api/reportes, GET /api/reportes/seguimiento/[numero], endpoints de auth.
- **FR-020**: El sistema DEBE implementar el endpoint GET /api/reportes/mis-reportes (o equivalente) para alimentar el panel del padre, respetando la regla de no exponer textoOriginal.
- **FR-021**: La UI de reporte NO DEBE incluir ningún input de archivo, imagen, audio ni video. El reporte es exclusivamente texto. No existe carga ni referencia a multimedia en ninguna pantalla.

### Key Entities

- **IdentificadorReportado**: Representa un número/nick acumulado en la base de datos. Atributos clave: identificador, plataforma, totalReportes, reportesAutenticados, esVisiblePublicamente.
- **Reporte**: Registro individual de una conducta observada. Atributos clave: identificador, plataforma, texto, ciudad, país, estado, esAnonimo, numeroSeguimiento.
- **Usuario (Padre)**: Padre autenticado que realiza reportes. Atributos clave: email, nombre, rol, estado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante puede consultar un identificador y recibir resultados en menos de 3 segundos.
- **SC-002**: Un usuario puede completar el flujo de reporte (4 pasos) en menos de 5 minutos.
- **SC-003**: El 100% de las pantallas de reporte y consulta muestran los canales oficiales de denuncia sin requerir scroll ni interacción adicional.
- **SC-004**: El flujo completo (buscar → consultar → reportar → confirmar → seguir) opera end-to-end sin errores de conexión a APIs reales.
- **SC-005**: La interfaz pasa validación de accesibilidad básica (labels, foco, contraste) en todas las pantallas principales.
- **SC-006**: El tiempo de carga inicial de la aplicación es menor a 2 segundos en conexión 3G simulada.

## Assumptions

- Las API routes de backend (consulta, reportes, auth, seguimiento) están implementadas y funcionales en la rama actual.
- El prototipo visual en `design/` es referencia de dirección creativa pero no código copiable; se adapta a Next.js App Router + Tailwind.
- Ollama y los modelos de IA están disponibles en el entorno de desarrollo para procesamiento de reportes.
- El usuario objetivo principal es padre/tutor en Colombia con nivel medio de alfabetización digital.
- El endpoint GET /api/reportes/mis-reportes no existe aún y debe crearse como parte del plan técnico de esta feature.
- Mobile-first implica que el diseño se optimiza primero para viewport < 768px y luego escala hacia arriba.