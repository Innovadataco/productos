# Feature Specification: El comité de convivencia, operativo

**Feature Branch**: `work/pi-SPEC-319-comite-convivencia-operativo`

**Created**: 2026-08-30

**Status**: PLANEADO

**Input**: SPEC-319 · 002-PI-219 · Brief A-57 · Recorrido #1 manual de Jelkin · I-212. La cuenta compartida del Comité de Convivencia entra, cambia la clave y aterriza en `/mis-reportes` (pantalla del padre) con "No pudimos cargar tus reportes". Bloquea que Jelkin siga probando.

**Impacto en arquitectura:** Sin migración de esquema para §2.1/§2.2/§2.5/§2.6. §2.3 y §2.4 pueden requerir un campo nuevo (`integranteFirmanteId` / registro de firma en el caso) — se confirma en `/speckit-plan` leyendo el modelo de cierre de caso. Se introduce **un módulo cliente nuevo de dominio** (`homeParaRol` fuente única) consumido por los 3 puntos de landing; no agrega rutas (`arch:check` no debería regenerar por §2.1). §2.2 reusa el evento de notificación `colegio.invitacion.enviada` y el patrón de token de invitación existentes — cero mecanismo paralelo. §2.5 es rediseño de UI dentro del módulo comité existente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El comité aterriza en su bandeja, no en la pantalla del padre (Priority: P1) 🔴

La cuenta compartida del Comité de Convivencia inicia sesión (o cambia su clave temporal) y **aterriza en su panel `/dashboard/colegio/comite`**, nunca en `/mis-reportes`. Hoy cae en la pantalla del padre con un error, porque tres copias del mapa rol→home en el cliente omiten el rol `COMITE_CONVIVENCIA`.

**Why this priority**: Es el bloqueo directo que impide a Jelkin seguir probando el módulo del comité (I-212). Sin esto, el comité no puede usar el sistema en absoluto — entra y ve un error.

**Independent Test**: Con la cuenta del comité, iniciar sesión directo y también pasar por el cambio de clave; verificar que ambos caminos terminan en `/dashboard/colegio/comite`. Escribir `/mis-reportes` a mano con esa cuenta y verificar que rebota, no muestra el error.

**Acceptance Scenarios**:

1. **Given** la cuenta del comité con clave ya definida, **When** inicia sesión, **Then** aterriza en `/dashboard/colegio/comite`.
2. **Given** la cuenta del comité recién creada (debe cambiar la clave), **When** define su nueva clave, **Then** aterriza en `/dashboard/colegio/comite`, no en `/mis-reportes`.
3. **Given** la cuenta del comité autenticada, **When** navega manualmente a `/mis-reportes`, **Then** el sistema la rebota a `/dashboard/colegio/comite` sin mostrar el `ErrorState` del padre.
4. **Given** un OPERADOR, **When** inicia sesión y cuando cambia su clave, **Then** aterriza en el **mismo** destino por ambos caminos (hoy se contradicen: `/dashboard/admin/operadores` vs `/dashboard/admin`).
5. **Given** un PARENT, **When** inicia sesión, **Then** aterriza en `/mis-reportes` **igual que hoy** — cero cambio en el landing del padre (Decisión B).

---

### User Story 2 - El acceso del comité llega por email, no por pantalla (Priority: P2)

Cuando el rector crea la cuenta del comité, **el comité recibe un email con un link de activación** y define su propia contraseña — igual que el flujo del rector. La contraseña temporal deja de pintarse en pantalla y de viajar por WhatsApp/chat.

**Why this priority**: Cierra una fuga de secreto (la clave hoy se muestra y se comparte por canales inseguros) y alinea el comité con el flujo de invitación ya probado del rector. Depende de US1 para que, tras activar, el comité aterrice bien.

**Independent Test**: Crear la cuenta del comité; verificar que la UI **no** muestra ninguna contraseña; verificar que se programa el email de invitación con un link `/activar?token=…`; entrar por el link y definir la contraseña.

**Acceptance Scenarios**:

1. **Given** un rector en la ficha del comité, **When** crea la cuenta con el email institucional, **Then** el sistema **no muestra ninguna contraseña** y confirma que se envió una invitación por email.
2. **Given** la invitación enviada, **When** el comité abre el link `/activar?token=…`, **Then** puede definir su propia contraseña y esa contraseña nunca se muestra ni se transmite a otro canal.
3. **Given** una invitación ya usada o vencida, **When** se abre el link, **Then** el sistema lo informa sin exponer datos.

---

### User Story 3 - La pantalla de integrantes es un directorio operable (Priority: P2)

El rector/comité gestiona el directorio de integrantes (que **no son usuarios** — la cuenta sigue compartida) con información completa y acciones útiles: reenviar la invitación al correo del comité, ver cuántos integrantes hay (total y activos), ver el estado ACTIVO/INACTIVO por fila, editar un integrante, y ver la fecha con hora.

**Why this priority**: Hace usable la pantalla que hoy es un listado ciego; habilita la operación real del comité como directorio documental. Independiente de US4/US5.

**Independent Test**: Abrir la pantalla de integrantes; verificar el contador (total y activos), el estado por fila, el botón de reenviar invitación, la edición desde la UI y la fecha con hora.

**Acceptance Scenarios**:

1. **Given** un colegio con N integrantes (M activos), **When** se abre la pantalla, **Then** un contador muestra "N integrantes · M activos".
2. **Given** la lista de integrantes, **When** se ve cada fila, **Then** su estado ACTIVO/INACTIVO es visible como texto/etiqueta (no solo inferible por el color de un botón), y su fecha se muestra como `DD-MM-AAAA HH:MM` (COT).
3. **Given** una cuenta de comité existente, **When** el rector pulsa "Reenviar invitación", **Then** se reenvía el link de acceso al correo del comité (reemplaza "regenerar contraseña" que invalidaba y pintaba la clave).
4. **Given** un integrante existente, **When** el rector lo edita desde la UI, **Then** los cambios se guardan usando el endpoint ya existente.
5. **Given** la acción de activar/inactivar integrante, **When** se usa, **Then** funciona **exactamente igual que hoy** (sin regresión).

---

### User Story 4 - Quién firma el cierre de un caso (Priority: P2)

Con cuenta compartida, al cerrar/resolver un caso el sistema **pide cuál integrante firma**, elegido entre los integrantes **activos** del colegio. La firma queda registrada en el caso y en la bitácora de auditoría. Es la trazabilidad que reemplaza al acceso individual descartado por Jelkin.

**Why this priority**: Es lo que hace viable y auditable la cuenta compartida — sin firma no se sabe quién decidió. No es opcional. Independiente de US3/US5.

**Independent Test**: Cerrar un caso con la cuenta del comité; verificar que aparece un selector de integrante activo, que sin elegir no se puede cerrar, y que tras cerrar la firma queda en el caso y en el `AuditLog`.

**Acceptance Scenarios**:

1. **Given** un caso abierto y integrantes activos, **When** el comité intenta cerrarlo/resolverlo, **Then** el sistema pide seleccionar el integrante que firma (entre los activos).
2. **Given** el cierre confirmado con un integrante firmante, **When** se completa, **Then** la identidad del firmante queda registrada en el caso y en `AuditLog`.
3. **Given** un colegio sin integrantes activos, **When** el comité intenta cerrar, **Then** el sistema lo informa de forma clara (no permite firmar en el vacío).

---

### User Story 5 - El inicio del comité es una bandeja de trabajo (Priority: P3)

El inicio del comité deja de ser un panel de lectura que se solapa con Gestión de casos y pasa a ser una bandeja que prioriza el trabajo: cabecera humana, lo que apremia primero y grande (vencidos y por vencer en 24 h), cifras con contexto, acciones en verbo, empty state propio, sin duplicar el menú ni la lista completa.

**Why this priority**: Mejora sustancial de usabilidad pero no bloquea la operación (US1 ya desbloquea el acceso). Independiente del resto.

**Independent Test**: Abrir `/dashboard/colegio/comite` con casos vencidos y sin casos; verificar que lo urgente manda, que las métricas traen contexto, que las acciones son verbos, y que el empty state es propio.

**Acceptance Scenarios**:

1. **Given** casos vencidos o por vencer en 24 h, **When** se abre el inicio, **Then** aparecen primero y como lista accionable (con el botón de acción encima), no como un contador suelto.
2. **Given** el inicio del comité, **When** se ve la cabecera, **Then** saluda por franja horaria con la fecha larga en español.
3. **Given** las tarjetas de métricas, **When** se leen, **Then** cada una trae su contexto (p. ej. "3 casos · 1 vence hoy"), no un número solo.
4. **Given** un comité sin casos, **When** abre el inicio, **Then** ve un empty state propio, no un tablero de ceros.
5. **Given** el destino `/dashboard/colegio/comite/casos`, **When** se ve su etiqueta en el lateral y en el header, **Then** usa **un solo nombre** en ambos lados (hoy es "Gestión casos" en uno y "Mi bandeja" en otro).

---

### User Story 6 - Higiene del rol comité en el header (Priority: P3)

El header deja de ofrecerle al comité opciones de padre ("Mi panel", "Círculo de Confianza", "Mis reportes"). El rol `COMITE_CONVIVENCIA` se reconoce como empleado.

**Why this priority**: Pulido de coherencia de rol; hoy una sola salvaguarda tapa el síntoma. Independiente del resto.

**Acceptance Scenarios**:

1. **Given** la cuenta del comité autenticada, **When** abre el menú del header, **Then** no se le ofrecen las opciones propias del padre.

### Edge Cases

- **Rol desconocido / futuro en la fuente única**: un rol no mapeado cae al default `/mis-reportes` (comportamiento conservador actual preservado). Documentado como decisión, no como olvido.
- **PARENT y la fuente única**: PARENT cae al default `/mis-reportes` de forma **explícita y comentada** — el landing del padre NO cambia en este PR (ver Assumptions · Decisión B).
- **Comité llega a `/mis-reportes` por un link viejo o el header**: la propia pantalla lo rebota a su panel.
- **Reenviar invitación cuando la cuenta ya activó su clave**: definir comportamiento en plan (reenviar re-habilita activación vs. informar que ya está activa) — sin exponer secreto en ningún caso.
- **Cerrar caso sin integrantes activos**: no se permite firmar en el vacío; el sistema lo informa.

## Requirements *(mandatory)*

### Functional Requirements

**§2.1 · Fuente única rol→home (P1)**
- **FR-001**: El sistema DEBE tener **una sola fuente de verdad** para el destino de inicio por rol, consumida por los tres puntos de landing del cliente (login, cambio de clave, y el desvío de `/mis-reportes`).
- **FR-002**: La fuente única DEBE mapear explícitamente los roles no-padre a su home canónica, coherente con `homeForRole` del middleware: `COMITE_CONVIVENCIA`→`/dashboard/colegio/comite`, `OPERADOR`→`/dashboard/admin`, `ADMIN`→`/dashboard/admin`, `SCHOOL_ADMIN`→`/dashboard/colegio`, `COMITE_VALIDACION`→`/dashboard/admin/comite`.
- **FR-003**: `PARENT` (y cualquier rol no mapeado) DEBE caer al default `/mis-reportes` de forma **explícita y comentada** — el landing del padre no cambia en este SPEC (Decisión B).
- **FR-004**: El comité DEBE aterrizar en `/dashboard/colegio/comite` tanto por login directo como tras cambiar la clave temporal.
- **FR-005**: `/mis-reportes` DEBE rebotar a su panel a cualquier rol que no sea consumidor final de esa pantalla si llega ahí (incluye `COMITE_CONVIVENCIA`), sin pintar el error.
- **FR-006**: La contradicción de `OPERADOR` DEBE quedar resuelta a un único destino (`/dashboard/admin`, coherente con `homeForRole`).
- **FR-007**: Los mapas rol→home con **otro propósito** (`operadores/page.tsx` fallback de acceso-denegado; `NavHeader.tsx` destino del logo) NO se absorben en la fuente única y DEBEN quedar con un comentario que explique por qué no son la fuente única.

**§2.2 · Acceso por email (P2)**
- **FR-008**: Al crear la cuenta del comité, el sistema NO DEBE mostrar ninguna contraseña en pantalla ni transmitirla por chat.
- **FR-009**: El sistema DEBE enviar al correo del comité un email de invitación con un link de activación, reusando el mecanismo existente (evento y token de invitación del flujo del rector), sin inventar uno paralelo.
- **FR-010**: El comité DEBE poder definir su propia contraseña desde el link de activación; esa contraseña no se muestra ni viaja.

**§2.3 · Directorio de integrantes (P2)**
- **FR-011**: El sistema DEBE ofrecer "Reenviar invitación" al correo del comité, reemplazando la acción de "regenerar contraseña" (que invalidaba y pintaba la clave).
- **FR-012**: La pantalla DEBE mostrar un contador de integrantes (total y activos).
- **FR-013**: Cada fila DEBE mostrar el estado ACTIVO/INACTIVO de forma explícita (texto/etiqueta), no solo por el color de un botón.
- **FR-014**: El rector DEBE poder editar un integrante desde la UI, usando el endpoint/servicio ya existentes.
- **FR-015**: Las fechas de integrantes DEBEN mostrarse con hora en formato `DD-MM-AAAA HH:MM` (COT).
- **FR-016**: Activar/inactivar integrante DEBE seguir funcionando sin regresión (no se toca).

**§2.4 · Firma del cierre (P2)**
- **FR-017**: Al cerrar/resolver un caso, el sistema DEBE pedir cuál integrante firma, elegido entre los integrantes **activos** del colegio.
- **FR-018**: La identidad del integrante firmante DEBE quedar registrada en el caso y en `AuditLog`.
- **FR-019**: Si no hay integrantes activos, el sistema DEBE impedir el cierre con firma y explicarlo.

**§2.5 · Rediseño del inicio (P3)**
- **FR-020**: El inicio del comité DEBE priorizar lo urgente (vencidos y por vencer 24 h) como lista accionable arriba, con cabecera humana (saludo por franja + fecha larga en español), métricas con contexto, acciones en verbo y empty state propio.
- **FR-021**: El inicio NO DEBE duplicar el menú ni la lista completa de casos (que vive en Gestión de casos).
- **FR-022**: El destino `/dashboard/colegio/comite/casos` DEBE tener **un solo nombre** en el lateral y en el header.

**§2.6 · Higiene de rol (P3)**
- **FR-023**: El rol `COMITE_CONVIVENCIA` DEBE reconocerse como empleado en el header, de modo que no se le ofrezcan las opciones propias del padre.

### Key Entities *(include if feature involves data)*

- **Cuenta de comité** (Usuario rol `COMITE_CONVIVENCIA`): una por colegio, **compartida** (`comiteColegioId @unique`). Nace pendiente de activar su clave.
- **IntegranteComite**: directorio documental (NO usuario). Atributos: nombre, estado ACTIVO/INACTIVO, fechas. Un colegio tiene muchos; los **activos** son elegibles como firmantes.
- **Caso / cierre de caso**: al resolverse guarda **quién firma** (integrante activo). La firma se refleja también en `AuditLog`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los inicios de sesión de la cuenta del comité (login directo y tras cambiar la clave) terminan en `/dashboard/colegio/comite`; 0% terminan en `/mis-reportes` con error.
- **SC-002**: El OPERADOR aterriza en el mismo destino por ambos caminos (login y post-cambio de clave) — 0 contradicciones.
- **SC-003**: El PARENT sigue aterrizando donde aterriza hoy (`/mis-reportes`) — 0 regresiones en el landing del padre.
- **SC-004**: Al crear la cuenta del comité, 0 contraseñas aparecen en pantalla; el acceso llega por email.
- **SC-005**: Un caso no puede cerrarse sin registrar un integrante firmante activo.
- **SC-006**: La pantalla de integrantes muestra contador, estado por fila y fecha con hora en el 100% de las filas.
- **SC-007**: Cero regresión en: activar/inactivar integrante, y el landing de todos los demás roles ya correctos.

## Assumptions

- **Decisión B (aprobada por Fábrica PI-1, 2026-08-30 17:30 COT)**: la fuente única preserva el landing del padre en `/mis-reportes`. NO se cambia a `/dashboard/padre` en este SPEC porque **Jelkin está probando el rol padre ahora mismo**, y un cambio de navegación del padre fuera del alcance del bug del comité es exactamente el tipo de regresión que cuesta vueltas. La coherencia total del padre (`/mis-reportes` → `/dashboard/padre`, alineada con SPEC-317) queda para un SPEC de seguimiento con su propia evidencia; el default de la fuente única lo deja documentado, no como olvido.
- **`homeForRole` (proxy.ts) es la referencia del destino correcto**, no la fuente que se edita como origen. La fuente única del cliente es la que decide el landing en runtime (el brief indica que `homeForRole` quedó fuera del runtime tras SPEC-287); se mantienen coherentes.
- **La cuenta del comité sigue compartida** (decisión de Jelkin): los integrantes no son usuarios; el acceso individual está descartado. La firma al cerrar es la trazabilidad que lo reemplaza.
- **Se reusa el mecanismo de invitación del rector** (evento `colegio.invitacion.enviada`, token de invitación, ruta `/activar`) — no se crea un flujo paralelo. Se confirmará en el plan si `/activar` acepta el rol del comité o requiere un ajuste mínimo.
- **§2.3/§2.4 pueden requerir un campo nuevo** para registrar el firmante en el caso; se confirma en `/speckit-plan` contra el modelo de datos. Si lo requiere, es una migración aditiva mínima.
- **Fuera de alcance**: acceso individual por integrante; guardianes del middleware (A-56); profesores (A-58); aviso de cambio de clave (A-59); rediseñar Estadísticas del comité; eliminar integrantes (la baja sigue lógica).
- **Solo-lectura**: `src/lib/ai/**`, `.github/workflows/**`, `deploy-prod.sh`, middleware/guardas, profesores.
- **Frontera de propiedad**: Dev PI-2 es dueño único de `login/page.tsx`, `cambiar-password/page.tsx`, `mis-reportes/page.tsx` (A-56 los trata como solo-lectura).
