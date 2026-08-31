# Feature Specification: Cómo le habla PI al padre (parte independiente)

**Feature Branch**: `work/pi-SPEC-326-lenguaje-padre`

**Created**: 2026-08-31

**Status**: PLANEADO

**Input**: SPEC-326 · 002-PI-226 · Brief A-62 · Recorrido #2 de Jelkin · I-220. Las pantallas del padre "hablan como robot"; el usuario adivina qué hacer. Regla marco: **ninguna pantalla del área del padre termina sin decirle qué puede hacer ahora**. El usuario es un padre no técnico, preocupado.

**Impacto en arquitectura:** Cubre §3.1 (preferencias de notificaciones), §3.4 (perfil del padre), §3.5 (país/ciudad en registro), §3.6 (menú). §3.2/§3.3 quedan FUERA (dependen de A-60/A-61). Migración aditiva a `Usuario`: `telefono`, `ciudadId`, `paisId`, y campos del cambio de correo pendiente (correo nuevo + token/expiración). Reusa: catálogo geográfico + `CiudadSearchSelect` (con `permitirOtra=false`), mecanismo de `CodigoVerificacion` (`/api/auth/verificar`) para verificar el correo nuevo, y el aviso al correo viejo (patrón A-59). NO toca el motor de notificaciones ni sus reglas/plantillas (la pantalla de preferencias solo lee el catálogo de eventos y guarda toggles). Usa el sistema de diseño existente (Instrument/anillos/tokens).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Las notificaciones del padre se leen en frases, sin jerga (Priority: P1)

El padre abre sus preferencias de notificaciones y ve **frases claras**, nunca la clave técnica de un evento. Enciende o apaga solo las que puede controlar; ve, en gris, las que siempre le llegan (seguridad y plan). Cada frase corresponde a un aviso que el sistema realmente envía.

**Why this priority**: Es el defecto más citado ("no entiendo nada"); una pantalla que miente (frase sin evento real) es peor que una corta. La lista fue decidida y aprobada por el CEO.

**Independent Test**: Abrir la pantalla de preferencias como padre; verificar que no aparece ninguna clave técnica, que hay exactamente 2 interruptores reales, que el bloque forzado lista plan+seguridad sin interruptor, y que apagar/encender un toggle persiste.

**Acceptance Scenarios**:

1. **Given** el padre en preferencias, **When** ve la pantalla, **Then** arriba lee "Te escribimos a <su correo> · Cambiar" (sin interruptor).
2. **Given** la pantalla, **When** ve la sección "¿Qué querés que te avisemos?", **Then** hay **dos** interruptores: "Cuando alguien reporte a una persona de mi círculo" y "Cuando se resuelva un reporte que hice".
3. **Given** un interruptor, **When** el padre lo apaga y recarga, **Then** queda apagado (la preferencia persiste).
4. **Given** la pantalla, **When** ve el pie, **Then** un bloque en gris "Algunos avisos son de seguridad o de tu plan y siempre te llegan" lista: plan por vencer, contraseña cambiada, recuperación — **sin interruptor**.
5. **Given** cualquier parte de la pantalla, **When** el padre la lee, **Then** **no** aparece ninguna clave técnica de evento (p. ej. `reporte.resuelto`).
6. **Given** el diseño aprobado, **When** se cuenta lo mostrado, **Then** "identificador de mis hijos" y "resumen de la semana" **no aparecen** (sus eventos no existen aún).

### User Story 2 - El padre tiene un perfil y puede cambiar su correo con seguridad (Priority: P1)

El padre entra a "Mi perfil" (hoy no existe) y ve/edita su nombre, correo, teléfono, país y ciudad, y accede a cambiar su contraseña. Cambiar el correo **no** es inmediato: se verifica el correo nuevo antes de aplicarlo y se avisa al correo anterior.

**Why this priority**: El perfil no existe (SPEC-317 lo retiró); sin él, el padre no puede corregir sus datos ni su identidad. El cambio de correo es cambio de identidad y debe ser seguro.

**Independent Test**: Entrar al perfil como padre; editar nombre/teléfono y ver que guarda; iniciar un cambio de correo y verificar que pide verificación del correo nuevo, que el correo viejo recibe aviso, y que el correo NO cambia hasta confirmar.

**Acceptance Scenarios**:

1. **Given** un padre autenticado, **When** abre "Mi perfil", **Then** ve nombre, correo, teléfono, país y ciudad, y un acceso a cambiar contraseña.
2. **Given** el perfil, **When** edita su nombre o teléfono y guarda, **Then** los cambios persisten y la pantalla lo confirma.
3. **Given** el padre pide cambiar su correo, **When** ingresa el correo nuevo, **Then** el sistema envía una verificación al correo **nuevo** y **no** aplica el cambio todavía.
4. **Given** una verificación de correo pendiente, **When** el padre la confirma, **Then** el correo se actualiza **y** se envía un aviso al correo **anterior**.
5. **Given** una verificación pendiente o vencida, **When** no se confirma, **Then** el correo original permanece intacto.
6. **Given** cada campo/acción del perfil, **When** el padre la ve, **Then** termina en un verbo/acción clara (no un dato muerto).

### User Story 3 - Al registrarse, al padre se le pide país y ciudad (Priority: P2)

Cuando un padre nuevo completa su registro, además de su nombre y contraseña se le piden **país y ciudad** (con fines estadísticos), usando el mismo buscador de ciudades del sistema, **sin** la opción de texto libre "Otra ciudad".

**Why this priority**: Dato estadístico faltante; se captura en el único momento natural (registro). Reusa componentes existentes.

**Independent Test**: Completar el registro de un padre; verificar que se piden país y ciudad, que la ciudad se elige del catálogo (sin "Otra ciudad"), y que quedan guardados en su cuenta.

**Acceptance Scenarios**:

1. **Given** un padre en el paso final del registro, **When** ve el formulario, **Then** hay campos de país y ciudad.
2. **Given** el campo ciudad, **When** el padre busca, **Then** elige del catálogo geográfico existente y **no** hay opción de "Otra ciudad" (texto libre).
3. **Given** el registro completado, **When** se consulta la cuenta, **Then** país y ciudad quedaron guardados.

### User Story 4 - El menú del padre es coherente (Priority: P3)

El padre encuentra "Mis reportes" y "Mi perfil" en su menú lateral, no solo en el header. El lateral aparece de forma coherente al navegar.

**Why this priority**: Coherencia de navegación; "Mis reportes" hoy solo vive en el header y "Mi perfil" fue retirado. Menor que el contenido, pero afecta el "sé qué puedo hacer".

**Acceptance Scenarios**:

1. **Given** el menú lateral del padre, **When** lo abre, **Then** aparece "Mis reportes" (además del header).
2. **Given** el menú del padre, **When** lo abre, **Then** aparece "Mi perfil" apuntando a la pantalla nueva (US2).
3. **Given** el comportamiento "el lateral solo aparece al elegir algo del menú derecho", **When** se verifica con A-56/A-57 ya desplegados, **Then** si ya está resuelto se documenta y no se cambia; si no, se corrige.

### Edge Cases

- **Correo nuevo ya en uso** por otra cuenta al cambiar correo → se rechaza con mensaje claro; el correo original permanece.
- **Toggle de una notificación cuyo evento existe pero es forzado** (plan por vencer) → no se ofrece como interruptor; va al bloque gris.
- **Padre sin país/ciudad** (cuentas viejas anteriores a la migración) → el perfil permite completarlos; no rompe.
- **Ciudad sin resultados en el buscador** → como no hay "Otra ciudad", el padre refina la búsqueda; no se guarda texto libre.
- **Verificación de correo nuevo vencida** → el correo no cambia; el padre puede reintentar.

## Requirements *(mandatory)*

### Functional Requirements

**§3.1 · Preferencias de notificaciones (US1)**
- **FR-001**: La pantalla DEBE mostrar el correo de contacto arriba con una acción "Cambiar", sin interruptor.
- **FR-002**: La pantalla DEBE ofrecer **exactamente dos** interruptores controlables por el padre: círculo (evento `padre.circulo_confianza.reporte_enriquecido`) y reporte resuelto (evento `reporte.resuelto`), con los textos aprobados por el CEO.
- **FR-003**: La pantalla DEBE mostrar un bloque en gris "siempre te llegan" con plan por vencer + seguridad (contraseña cambiada, recuperación), **sin interruptor**.
- **FR-004**: La pantalla NO DEBE mostrar ninguna clave técnica de evento; el padre solo ve frases.
- **FR-005**: La pantalla NO DEBE mostrar frases cuyo evento no exista (se excluyen "identificador de mis hijos" y "resumen de la semana").
- **FR-006**: Encender/apagar un interruptor DEBE persistir la preferencia del padre y respetarse en envíos futuros.
- **FR-007**: La pantalla NO DEBE modificar el motor de notificaciones, sus reglas ni sus plantillas (solo lee el catálogo y guarda toggles).

**§3.4 · Perfil del padre (US2)**
- **FR-008**: DEBE existir una pantalla "Mi perfil" del padre con nombre, correo, teléfono, país, ciudad y acceso a cambiar contraseña.
- **FR-009**: El padre DEBE poder editar nombre y teléfono, y que persistan.
- **FR-010**: El cambio de correo DEBE requerir verificación del correo **nuevo** antes de aplicarse; el correo original NO cambia hasta confirmar.
- **FR-011**: Al confirmarse el cambio de correo, el sistema DEBE avisar al correo **anterior**.
- **FR-012**: El sistema DEBE rechazar un correo nuevo ya usado por otra cuenta, sin cambiar el correo original.
- **FR-013**: Cada campo/acción del perfil DEBE terminar en un verbo/acción clara.

**§3.5 · País y ciudad en el registro (US3)**
- **FR-014**: El registro del padre DEBE pedir país y ciudad en el paso de completar la cuenta.
- **FR-015**: La ciudad DEBE elegirse del catálogo geográfico existente, **sin** opción de texto libre "Otra ciudad".
- **FR-016**: País y ciudad DEBEN quedar guardados en la cuenta del padre.

**§3.6 · Menú del padre (US4)**
- **FR-017**: "Mis reportes" DEBE aparecer en el menú lateral del padre (además del header).
- **FR-018**: "Mi perfil" DEBE aparecer en el menú del padre, apuntando a la pantalla de US2.
- **FR-019**: El comportamiento "lateral solo al elegir del menú derecho" DEBE verificarse contra A-56/A-57; si ya está resuelto se documenta sin cambio, si no se corrige.

### Key Entities *(include if feature involves data)*

- **Usuario (padre)**: hoy nombre + correo. Se agregan: teléfono, país, ciudad, y el estado del cambio de correo pendiente (correo nuevo + verificación). Todos aditivos y opcionales.
- **CodigoVerificacion** (existente, se reusa): valida el correo nuevo antes de aplicar el cambio.
- **Catálogo geográfico** (existente, solo lectura): país + ciudad (92.558 ciudades).
- **Preferencia de notificación** (existente): un registro por (padre, evento) que guarda si el toggle está encendido; el motor lo respeta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 claves técnicas de evento visibles en la pantalla de notificaciones del padre.
- **SC-002**: La pantalla de notificaciones muestra exactamente 2 interruptores reales + el bloque forzado; 0 frases sin evento real.
- **SC-003**: Un cambio de correo nunca aplica sin verificación del correo nuevo, y el correo anterior siempre recibe aviso (0 cambios de identidad silenciosos).
- **SC-004**: 100% de los registros nuevos de padre capturan país y ciudad del catálogo (0 texto libre).
- **SC-005**: "Mis reportes" y "Mi perfil" aparecen en el menú lateral del padre.
- **SC-006**: Todas las pantallas tocadas del padre terminan en una acción con verbo; se ven bien en teléfono.

## Assumptions

- **§3.1 diseño CEO-aprobado (2026-08-30)**: la lista de 2 toggles + bloque forzado + drop de 2 frases es decisión cerrada del CEO. La frase 3 dice "se resuelva" (no "cambie el estado") porque el evento `reporte.resuelto` solo dispara al resolver.
- **Hallazgo I-221 (NO tocar)**: la regla `suscripcion.por_vencer` usa rol "PADRE" mientras el enum es "PARENT"; registrado por Fábrica como incidencia aparte; solo-lectura para este SPEC.
- **Migración aditiva**: `Usuario` gana `telefono`, `ciudadId`, `paisId` y los campos del correo pendiente; todo nullable, sin backfill.
- **Reuso**: `CodigoVerificacion` + `/api/auth/verificar` para el correo nuevo; el aviso al correo viejo sigue el patrón de A-59; `CiudadSearchSelect` con `permitirOtra=false`; si A-60 ya arregló el defecto de "Otra ciudad" en el wizard, se reusa ese arreglo.
- **Fuera de alcance**: §3.2 (inicio del padre) y §3.3 (secciones protejo/vigilo) dependen de A-60/A-61; motor de notificaciones/plantillas/reglas; expediente/reportes/PDF (A-60); modelo de hijos (A-61); rediseñar colegio/comité; inventar sistema de diseño nuevo.
- **Solo-lectura**: `src/lib/ai/**`, `.github/workflows/**`, `deploy-prod.sh`, el motor de notificaciones.
- **Evidencia §6**: capturas en producción, se ve bien en teléfono (la mayoría de padres entran por móvil).
