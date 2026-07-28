# Feature Specification: SPEC-113 — El colegio atrapado (I-35/I-35b) y menú por rol (I-36)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-28

**Status**: PLANEADO (en compuerta §4 — pendiente aprobación de ZEUS)

**Input**: "I-35 (bloquea el piloto): el proxy permite la pantalla /cambiar-password pero
bloquea con 403 el endpoint /api/auth/cambiar-password al que llama — el colegio no puede
completar el alta obligatoria. I-35b: 'Cerrar sesión' desde esa pantalla no sale de ella
(mismo callejón: /api/auth/logout tampoco está en las rutas permitidas del colegio). I-36:
el menú muestra a un SCHOOL_ADMIN entradas del área de padres; filtrar el menú por rol con
el MISMO criterio del proxy, sin segunda fuente de verdad."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El colegio completa su alta obligatoria (Priority: P1) 🔴

Como SCHOOL_ADMIN con contraseña temporal (`debeCambiarPassword=true`), quiero poder enviar
el formulario de cambio de contraseña para completar mi alta y usar el panel, en vez de
recibir un 403 que me deja atrapado en la pantalla.

**Why this priority**: BLOQUEA EL PILOTO. Reproducido por el CEO: el sistema exige el
cambio, muestra el formulario y prohíbe enviarlo; no hay forma de completar el alta.

**Independent Test**: con rol SCHOOL_ADMIN y `debeCambiarPassword=true`, el POST a
`/api/auth/cambiar-password` responde 200 y la contraseña cambia. **Antes del fix el test
debe estar ROJO** (verificado y reportado, como con la guarda de la migración).

**Acceptance Scenarios**:

1. **Given** SCHOOL_ADMIN autenticado con la bandera de cambio obligatorio, **When** hace
   POST a `/api/auth/cambiar-password` con credenciales válidas, **Then** 200 y la
   contraseña nueva funciona en el siguiente login.
2. **Given** el proxy, **When** se revisan los roles, **Then** NINGÚN rol autenticado que
   deba cambiar contraseña queda bloqueado por el endpoint (verificación por rol: PARENT y
   roles internos no sufren el bloque; SCHOOL_ADMIN queda cubierto).
3. **Given** el comentario del propio código ("sin /cambiar-password el cambio obligatorio
   queda en bucle (C-9)"), **When** se corrige, **Then** página Y endpoint quedan cubiertos
   (el comentario mencionaba la página; se olvidó su API).

---

### User Story 2 - Salir de la pantalla con "Cerrar sesión" (Priority: P1)

Como SCHOOL_ADMIN atrapado en la pantalla de cambio obligatorio, quiero que "Cerrar sesión"
me saque de verdad al inicio público, para no quedar encerrado en esa pantalla.

**Why this priority**: es la salida de emergencia del mismo callejón; hoy el botón falla en
silencio (el endpoint de logout tampoco está en las rutas permitidas del colegio).

**Independent Test**: con SCHOOL_ADMIN en `/cambiar-password`, al pulsar "Cerrar sesión" la
sesión muere (cookie borrada) y el navegador termina en el inicio público (`/`).

**Acceptance Scenarios**:

1. **Given** SCHOOL_ADMIN autenticado, **When** llama `POST /api/auth/logout`, **Then** no
   recibe 403 (el endpoint de sesión está permitido para su rol) y la cookie se borra.
2. **Given** el botón "Cerrar sesión", **When** la llamada al endpoint fallara por cualquier
   motivo, **Then** la navegación al inicio público ocurre igualmente (la UI no depende del
   resultado de la API para sacar al usuario).

---

### User Story 3 - El menú ofrece solo lo permitido al rol (Priority: P2) 🟡

Como SCHOOL_ADMIN, quiero que el menú del header me muestre solo las entradas que mi rol
puede usar, para no seguir caminos que terminan en error y no confundir mi cuenta
institucional con una de padres.

**Why this priority**: no hay fuga (el proxy bloquea), pero ofrecer rutas prohibidas
confunde y erosiona la confianza en la validación funcional del piloto.

**Independent Test**: por cada rol, el menú ofrece exactamente lo que el proxy le permite
(SCHOOL_ADMIN: solo su área de colegio; PARENT: su área; roles internos: la suya).

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN, **When** abre el menú, **Then** NO ve "Círculo de Confianza"
   ni "Mis reportes" (entradas del área de padres).
2. **Given** un PARENT, **When** abre el menú, **Then** ve sus entradas ("Mi panel",
   "Círculo de Confianza", "Mis reportes") — nada se quita de más.
3. **Given** el criterio de filtrado, **When** se compara con el proxy, **Then** es el MISMO
   (se reutiliza la fuente de verdad existente; no se inventa una segunda).

---

### Edge Cases

- SCHOOL_ADMIN con `debeCambiarPassword=false` usando el endpoint por iniciativa propia:
  también debe funcionar (no es solo para el flujo obligatorio).
- Sesión expirada en la pantalla de cambio: la pantalla redirige a `/login` (comportamiento
  ya existente, se conserva).
- Menú para anónimo (sin sesión): sin cambios (muestra "Iniciar sesión" como hoy).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `/api/auth/cambiar-password` DEBE ser accesible para SCHOOL_ADMIN (agregado a
  las rutas de sesión permitidas del proxy para ese rol).
- **FR-002**: `/api/auth/logout` DEBE ser accesible para SCHOOL_ADMIN (mismo mecanismo); el
  botón "Cerrar sesión" debe terminar en el inicio público incluso si la llamada falla.
- **FR-003**: Debe existir un test que, con SCHOOL_ADMIN y `debeCambiarPassword=true`,
  pruebe POST 200 a `/api/auth/cambiar-password` y el cambio efectivo — verificado ROJO
  antes del fix y VERDE después.
- **FR-004**: El menú del header DEBE filtrar entradas por rol con el MISMO criterio de
  rutas que aplica el proxy (una sola fuente de verdad reutilizada), con test por rol.
- **FR-005**: Verificación documentada de que ningún otro rol no-admin (PARENT, OPERADOR,
  COMITE_VALIDACION) sufre el bloque de los endpoints de sesión (o se corrige si aparece).

### Key Entities

- **Rutas de sesión del proxy** (`SESION_ROUTES`): página y endpoints que cualquier rol
  autenticado necesita (datos del usuario, cambio de contraseña, logout).
- **Criterio único de rutas por rol** (el del proxy): el menú lo consume, no lo duplica.

## Success Criteria *(mandatory)*

- **SC-001**: POST de SCHOOL_ADMIN a `/api/auth/cambiar-password` → 200 y contraseña
  cambiada (test rojo→verde verificado).
- **SC-002**: "Cerrar sesión" desde `/cambiar-password` termina en `/` con la sesión muerta.
- **SC-003**: Por cada rol, el menú muestra solo lo que el proxy permite (test).
- **SC-004**: Gate verde (tsc + lint + test + build) y CI GitHub success. NO desplegar.

## Assumptions

- La causa raíz verificada por ZEUS se toma como dada (página permitida, API olvidada); la
  verificación del resto de roles (FR-005) sí se ejecuta y se reporta.
- I-37 (admin no ve usuarios padre) y la pantalla "En proceso" quedan FUERA de alcance
  (registrados aparte).
