# Feature Specification: Panel de Administración

**Feature Branch**: `feature/004-panel-admin`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Panel de administración + dashboard con estadísticas. Área administrativa protegida (solo rol ADMIN), separada del público, para operar la plataforma. Bandeja de reportes con filtros, corrección de clasificación, anonimización de PII desde UI, dashboard de estadísticas agregadas. Fuera de alcance: módulo colegios, SaaS/pagos, gestión de usuarios/roles (salvo lo mínimo del admin). Reglas duras: solo ADMIN accede, texto con PII visible solo al admin, sin librerías de charts pesadas, reusar diseño glassmorphism, cookie httpOnly, lenguaje sin culpabilizar."

---

## User Scenarios & Testing

### User Story 1 — Bandeja de reportes (Priority: P1) 🎯 MVP

Un administrador autenticado con rol ADMIN ingresa al área administrativa y ve una bandeja con todos los reportes del sistema, puede filtrarlos por estado, plataforma, categoría de conducta y rango de fechas, y acceder al detalle completo de cada reporte incluyendo la clasificación realizada por IA.

**Why this priority**: Es la operación principal del administrador: revisar y gestionar reportes comunitarios.

**Independent Test**: El admin puede ingresar al panel, ver la lista de reportes, aplicar filtros y ver el detalle de un reporte con clasificación IA.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con rol ADMIN, **When** accede a `/dashboard/admin`, **Then** ve la bandeja de reportes con paginación
2. **Given** la bandeja cargada, **When** aplica filtro por estado `REQUIERE_ANONIMIZACION`, **Then** solo se muestran reportes en ese estado
3. **Given** un reporte en la lista, **When** el admin hace clic en "Ver detalle", **Then** ve el texto completo (incluyendo PII), la clasificación IA, y las acciones disponibles

---

### User Story 2 — Corrección de clasificación (Priority: P1) 🎯 MVP

El administrador revisa un reporte cuya clasificación automática por IA considera incorrecta, selecciona la categoría correcta desde un listado cerrado, y registra la corrección para mejorar el dataset de entrenamiento.

**Why this priority**: La calidad de la clasificación impacta directamente la efectividad del sistema y la confianza de los usuarios.

**Independent Test**: El admin puede abrir un reporte clasificado, cambiar su categoría, y ver la corrección reflejada.

**Acceptance Scenarios**:

1. **Given** un reporte con clasificación IA visible, **When** el admin selecciona una categoría diferente y confirma, **Then** se crea un registro de corrección y se actualiza el dataset de entrenamiento
2. **Given** una corrección registrada, **When** otro admin revisa el mismo reporte, **Then** ve la categoría corregida como la vigente
3. **Given** un reporte sin clasificación (error de procesamiento), **When** el admin intenta corregir, **Then** el sistema maneja el caso con mensaje apropiado

---

### User Story 3 — Anonimización de PII (Priority: P1) 🎯 MVP

El administrador identifica un reporte marcado como `REQUIERE_ANONIMIZACION`, revisa el texto original que contiene datos personales de menores, edita el texto para eliminar o generalizar la PII, y confirma la anonimización. El reporte pasa a estado `CLASIFICADO` y queda disponible para la consulta pública.

**Why this priority**: Es un paso crítico del pipeline para proteger la identidad de menores antes de exponer datos agregados al público.

**Independent Test**: El admin puede ver reportes pendientes de anonimización, editar el texto, y confirmar la anonimización.

**Acceptance Scenarios**:

1. **Given** un reporte en estado `REQUIERE_ANONIMIZACION`, **When** el admin abre la vista de anonimización, **Then** ve el texto original con PII y un campo para texto anonimizado
2. **Given** el campo de texto anonimizado completado (20-5000 caracteres), **When** el admin confirma, **Then** el estado cambia a `CLASIFICADO`, `textoOriginal` conserva la PII, y `texto` contiene la versión anonimizada
3. **Given** un reporte ya anonimizado, **When** el admin intenta anonimizar de nuevo, **Then** el sistema rechaza la operación con mensaje claro

---

### User Story 4 — Dashboard de estadísticas (Priority: P2)

El administrador accede a una vista resumen con métricas agregadas del sistema: total de reportes recibidos, distribución por estado, categoría de conducta, plataforma y ciudad, tendencia temporal de reportes en los últimos 30 días, y conteo de reportes pendientes por revisión o anonimización.

**Why this priority**: Proporciona visibilidad operativa del volumen y patrones de reportes, ayudando a priorizar recursos.

**Independent Test**: El admin puede ver el dashboard con datos reales, los gráficos muestran distribuciones correctas, y las cifras coinciden con la base de datos.

**Acceptance Scenarios**:

1. **Given** reportes existentes en múltiples estados, **When** el admin abre el dashboard, **Then** ve tarjetas con conteos totales y distribuciones por categoría
2. **Given** reportes de diferentes plataformas, **When** el admin revisa la sección de plataformas, **Then** ve la distribución proporcional sin exponer identificadores individuales
3. **Given** un reporte nuevo que requiere anonimización, **When** se recibe, **Then** el contador de "pendientes de anonimización" aumenta en tiempo real (o al recargar)

---

### User Story 5 — Acceso restringido y navegación (Priority: P1) 🎯 MVP

Solo los usuarios con rol ADMIN pueden acceder al área administrativa. Cualquier intento de acceso por parte de usuarios con otros roles o no autenticados es redirigido a la página pública o de login.

**Why this priority**: Protege datos sensibles (PII de menores) y funciones críticas del sistema.

**Independent Test**: Un usuario no-admin intenta acceder al panel y es bloqueado/redirigido; un admin accede sin problemas.

**Acceptance Scenarios**:

1. **Given** un usuario no autenticado, **When** intenta acceder a `/dashboard/admin`, **Then** es redirigido a `/login`
2. **Given** un usuario autenticado con rol PARENT, **When** intenta acceder al panel, **Then** es redirigido a la página pública con mensaje de acceso denegado
3. **Given** un usuario autenticado con rol ADMIN, **When** accede al panel, **Then** ve el menú de navegación del admin (bandeja, dashboard, anonimización)

---

### Edge Cases

- ¿Qué ocurre si el admin intenta corregir la clasificación de un reporte que aún no ha sido procesado por IA (estado `PENDIENTE` o `PROCESANDO`)?
- ¿Cómo se maneja un reporte cuyo procesamiento por IA falló (`processingError` no nulo)?
- ¿Qué sucede si el texto anonimizado es menor a 20 caracteres o mayor a 5000?
- ¿Cómo se comporta el sistema si no hay reportes en un período seleccionado en el dashboard?
- ¿Qué ocurre si un admin pierde su sesión mientras edita un reporte (cookie expirada)?

---

## Requirements

### Functional Requirements

- **FR-001**: El área administrativa DEBE estar protegida por verificación de rol ADMIN en cada ruta y endpoint
- **FR-002**: El admin DEBE poder listar reportes con paginación y filtros por estado, plataforma, categoría de conducta, y rango de fechas
- **FR-003**: El admin DEBE ver el detalle completo de un reporte, incluyendo texto con PII, clasificación IA, y metadatos de procesamiento
- **FR-004**: El admin DEBE poder corregir la categoría de clasificación de un reporte, seleccionando de la lista de `CategoriaConducta`
- **FR-005**: El admin DEBE poder anonimizar reportes en estado `REQUIERE_ANONIMIZACION`, proporcionando un texto sin PII de 20 a 5000 caracteres
- **FR-006**: El admin DEBE ver un dashboard con métricas agregadas: total de reportes, distribución por estado, categoría, plataforma, ciudad, y tendencia temporal
- **FR-007**: El dashboard DEBE mostrar contadores de reportes pendientes por revisión manual y por anonimización
- **FR-008**: El sistema DEBE registrar audit logs para cada acción administrativa (corrección, anonimización, acceso)
- **FR-009**: Las APIs administrativas DEBEN validar el rol ADMIN antes de procesar cualquier solicitud
- **FR-010**: Los textos con PII DEBEN ser visibles solo para usuarios con rol ADMIN; las APIs públicas DEBEN continuar exponiendo solo `texto` (anonimizado)
- **FR-011**: El lenguaje de la UI administrativa DEBE mantener la presunción de inocencia: "N reportes registrados", nunca "culpable", "depredador", "delincuente"
- **FR-012**: Las visualizaciones del dashboard DEBEN usar SVG/CSS nativo sin librerías de charts externas

### Key Entities

- **Reporte**: Solicitud comunitaria con identificador, plataforma, texto (anonimizado), textoOriginal (con PII, solo admin), estado, fecha, ubicación
- **ClasificacionIA**: Resultado del modelo de IA con categoría, confianza, contienePii, piiDetectada
- **CorreccionAdmin**: Registro de corrección manual de categoría por un admin, vinculado al dataset de entrenamiento
- **DatasetEntrenamiento**: Textos anonimizados con clasificación correcta, usados para reentrenar el modelo
- **Usuario**: Usuario del sistema con rol (ADMIN, SCHOOL_ADMIN, PARENT)

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: El admin puede revisar y filtrar reportes con latencia menor a 2 segundos para listados de hasta 100 registros
- **SC-002**: 100% de las acciones administrativas (corrección, anonimización) quedan registradas en audit logs con timestamp, usuario y cambios
- **SC-003**: El dashboard carga métricas agregadas en menos de 1.5 segundos
- **SC-004**: Cero exposiciones de PII en APIs públicas — verificable mediante revisión de contratos de API
- **SC-005**: Un admin puede anonimizar un reporte y ver el cambio reflejado en la consulta pública en menos de 5 segundos tras recargar

---

## Assumptions

- El sistema de autenticación con cookie httpOnly ya existe y proporciona el rol del usuario
- Los endpoints de backend `GET /api/admin/reportes-revision`, `POST /api/admin/correcciones`, y `PATCH /api/admin/reportes/[id]/anonimizar` ya existen y responden con el contrato definido
- El modelo de IA y el worker de procesamiento de reportes continúan operando de forma independiente
- El diseño visual del admin reutiliza el sistema glassmorphism del frontend público, pero con densidad mayor (tablas en lugar de cards)
- Las estadísticas del dashboard se calculan sobre datos ya anonimizados o agregados, nunca sobre textoOriginal