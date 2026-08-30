# Feature Specification: Notificación enriquecida de Círculo de Confianza

**Feature Branch**: `work/pi-SPEC-308-notificacion-enriquecida-circulo`

**Created**: 2026-08-29

**Status**: PLANEADO

**Impacto en arquitectura:** Añade plantilla de notificación en `src/lib/notificaciones/plantillas/`, extiende `src/lib/email.ts` con un wrapper que consume el motor existente sin modificarlo, y dispara desde el servicio de notificaciones del círculo de confianza del DAL. No cambia schema ni el motor de notificaciones.

**Input**: User description: "Notificación enriquecida (email/push con contexto real · no genérico). Crear src/lib/notificaciones/plantillas/reporte-circulo.ts con renderizado de email enriquecido (nombre contacto, identificador, plataforma, categoría, total reportes, link a expediente). Integrar con src/lib/email.ts enviando alerta contextual vía programar() del motor (sin modificar motor.ts)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Renderizar email enriquecido para alerta de círculo (Priority: P1)

Como padre que tiene contactos en su Círculo de Confianza, quiero recibir un email con datos concretos del contacto afectado (nombre, identificador, plataforma, categoría, total de reportes y link al expediente), para entender la alerta sin entrar primero al panel.

**Why this priority**: Es el núcleo de la SPEC: reemplaza la alerta ciega genérica por contexto útil, reduciendo la fricción del padre y mejorando la tasa de apertura/acción.

**Independent Test**: `renderizarEmailReporteCirculo(...)` debe devolver un objeto con `asunto` y `cuerpo` que contengan todas las variables contextualizadas y escaping correcto.

**Acceptance Scenarios**:

1. **Given** un payload con nombre de contacto, identificador, plataforma, categoría, total de reportes y URL de expediente, **When** se renderiza la plantilla, **Then** el cuerpo incluye todos los datos de forma legible y el link al expediente.
2. **Given** un identificador con caracteres especiales, **When** se renderiza, **Then** se escapan correctamente para evitar inyección HTML/Markdown.
3. **Given** un total de reportes igual a 1, **When** se renderiza, **Then** el texto usa la forma singular ("1 reporte registrado").
4. **Given** un total de reportes mayor a 1, **When** se renderiza, **Then** el texto usa la forma plural ("N reportes registrados").
5. **Given** una URL de expediente, **When** se renderiza, **Then** el cuerpo incluye un link clickable en Markdown (`[Ver expediente](url)`).

### User Story 2 - Integrar alerta enriquecida con el motor de notificaciones (Priority: P1)

Como sistema, quiero enviar la alerta contextualizada usando `programar()` del motor de notificaciones, para respetar preferencias, quiet hours, offsets y reintentos sin duplicar lógica.

**Why this priority**: Garantiza que la nueva alerta se comporte como cualquier otra notificación del motor: opt-out, throttling, reemplazo de programaciones duplicadas y trazabilidad.

**Independent Test**: `enviarAlertaCirculoConfianzaEnriquecida(...)` en `src/lib/email.ts` debe llamar a `programar()` con el evento `padre.circulo_confianza.reporte_enriquecido`, el `sujetoTipo="Reporte"`, el `sujetoId` del reporte y las variables enriquecidas.

**Acceptance Scenarios**:

1. **Given** un reporte visible que impacta un contacto de un padre, **When** se invoca la función, **Then** programa una notificación para el email del padre con todas las variables enriquecidas.
2. **Given** que no hay reglas activas para el evento, **When** se invoca la función, **Then** lanza un error explícito (fail-closed) como el resto de wrappers de `email.ts`.
3. **Given** un payload con `usuarioId` en lugar de email, **When** se invoca, **Then** el motor resuelve el email desde el usuario.
4. **Given** que las notificaciones de círculo están deshabilitadas globalmente, **When** se invoca, **Then** no programa nada y retorna sin error.

### User Story 3 - Disparar alerta enriquecida desde el flujo de círculo de confianza (Priority: P2)

Como sistema, quiero que el flujo existente `notificarCambioCirculoSiCorresponde` use la alerta enriquecida cuando un reporte visible coincide con un identificador del círculo, para que el padre reciba contexto real en lugar del aviso ciego.

**Why this priority**: Cierra el ciclo: la plantilla y el wrapper se conectan con el punto de disparo real del negocio.

**Independent Test**: `notificarCambioCirculoSiCorresponde(reporteId)` debe invocar `enviarAlertaCirculoConfianzaEnriquecida` con los datos del contacto, identificador, plataforma, categoría y expediente correspondientes.

**Acceptance Scenarios**:

1. **Given** un reporte visible que coincide con un identificador activo de un contacto, **When** se ejecuta el flujo de notificación, **Then** se envía una alerta enriquecida al padre con el contexto correcto.
2. **Given** un contacto con múltiples identificadores y solo uno impactado, **When** se notifica, **Then** el email menciona el identificador específico y el expediente asociado.
3. **Given** que el reporte está en un estado no visible (`PENDIENTE`, `POSIBLE_SPAM`, `DUPLICADO`), **When** se ejecuta el flujo, **Then** no se envía alerta enriquecida.
4. **Given** que el usuario desactivó las notificaciones del círculo, **When** se ejecuta el flujo, **Then** no se envía alerta enriquecida.
5. **Given** que el usuario está en cooldown, **When** se ejecuta el flujo, **Then** se mantiene el comportamiento de throttling existente.

## Edge Cases

- ¿Qué pasa si el contacto no tiene etiqueta (nombre)? → Se usa el identificador como fallback o un texto genérico ("Un contacto de tu Círculo de Confianza").
- ¿Qué pasa si no hay expediente abierto para el identificador? → El link apunta a `/dashboard/circulo-confianza` o se omite el link según decisión de UX; el email sigue siendo útil.
- ¿Qué pasa si el reporte no tiene clasificación (categoría)? → Se muestra "Categoría en revisión" o similar, nunca texto del reporte.
- ¿Qué pasa si el identificador tiene formato de teléfono E.164? → Se muestra tal cual, sin intentar formatear.
- ¿Qué pasa si hay múltiples contactos del mismo padre impactados por el mismo reporte? → Se envía una alerta por contacto o una sola agregada; se define en implementación con preferencia por una sola alerta agrupada por padre.
- ¿Qué pasa si la plataforma del reporte es "otra" (`otraPlataforma`)? → Se usa el texto libre en lugar del nombre de la plataforma conocida.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE proveer `renderizarEmailReporteCirculo` en `src/lib/notificaciones/plantillas/reporte-circulo.ts` que reciba: `nombreContacto`, `identificador`, `plataforma`, `categoria`, `totalReportes`, `urlExpediente`.
- **FR-002**: El renderizado DEBE devolver `{ asunto: string, cuerpo: string }` con lenguaje descriptivo/estadístico; PROHIBIDO usar veredictos como "peligroso" o "seguro".
- **FR-003**: El cuerpo DEBE incluir un link Markdown al expediente (`[Ver expediente](urlExpediente)`).
- **FR-004**: El sistema DEBE escapar identificadores y textos libres para evitar inyección de Markdown/HTML.
- **FR-005**: El sistema DEBE añadir en `src/lib/email.ts` la función `enviarAlertaCirculoConfianzaEnriquecida` que use `programar()` con el evento `padre.circulo_confianza.reporte_enriquecido`.
- **FR-006**: `enviarAlertaCirculoConfianzaEnriquecida` DEBE aceptar `usuarioId` o `email` como destinatario y un payload con los datos contextuales.
- **FR-007**: El sistema DEBE añadir en `prisma/seed.ts` la plantilla `padre.circulo_confianza.reporte_enriquecido.email` y la regla asociada para rol `PARENT`, canales `EMAIL` e `IN_APP`.
- **FR-008**: El flujo `notificarCambioCirculoSiCorresponde` DEBE usar `enviarAlertaCirculoConfianzaEnriquecida` para enviar el contexto real en lugar del aviso ciego cuando corresponda.
- **FR-009**: El flujo de notificación DEBE respetar el cooldown global (`circulo.notificaciones.cooldown_horas`) y las preferencias individuales del usuario.
- **FR-010**: El sistema NO DEBE incluir texto original del reporte, nombres de menores ni datos personales de terceros en el email.
- **FR-011**: PROHIBIDO usar LLM o servicios externos para generar el contenido; el renderizado es puramente template-based.

### Key Entities

- **ContactoConfianza**: contacto del círculo del padre. Atributos relevantes: `id`, `usuarioId`, `etiqueta`, `activo`.
- **IdentificadorContacto**: identificador asociado a un contacto. Atributos relevantes: `contactoId`, `valor`, `activo`, `plataformaId`.
- **Reporte**: reporte visible. Atributos relevantes: `id`, `identificador`, `plataformaId`, `otraPlataforma`, `estado`, `clasificacion`.
- **Expediente**: expediente del padre asociado al identificador. Atributos relevantes: `id`, `padreUsuarioId`, `identificadorReportado`, `plataformaId`, `scoreGravedadActual`.
- **Plataforma**: nombre legible de la plataforma. Atributos relevantes: `id`, `nombre`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El renderizado incluye los 6 campos contextuales (nombre contacto, identificador, plataforma, categoría, total reportes, link expediente) en 100% de los casos de prueba.
- **SC-002**: La alerta enriquecida se programa vía `programar()` y pasa por el motor sin modificar `motor.ts`.
- **SC-003**: Cobertura de tests > 80% para `reporte-circulo.ts`, la nueva función de `email.ts` y `notificarCambioCirculoSiCorresponde`.
- **SC-004**: No se incluye texto original de reportes ni PII de terceros en las variables del email.
- **SC-005**: El flujo respeta cooldown y preferencias: si el usuario está en cooldown o desactivó notificaciones, no se programa email.

## Assumptions

- El motor de notificaciones (`src/lib/notificaciones/motor.ts`) se mantiene intacto; la integración usa su API pública `programar()`.
- El envío real de email sigue siendo texto plano/markdown a través de Resend (`enviar-email.ts`); el "enriquecido" se refiere al contenido contextual, no a HTML multimedia.
- El punto de disparo es `notificarCambioCirculoSiCorresponde`, ya invocado cuando un reporte pasa a estado visible.
- La URL base para links se obtiene de `process.env.NEXT_PUBLIC_APP_URL` como el resto de wrappers.
- El mapeo de categorías (`CategoriaConducta`) a etiquetas legibles ya existe o se define en la plantilla.
- El expediente asociado se busca por `(padreUsuarioId, identificadorReportado, plataformaId)` o se crea si no existe según la lógica previa del flujo de expedientes.
