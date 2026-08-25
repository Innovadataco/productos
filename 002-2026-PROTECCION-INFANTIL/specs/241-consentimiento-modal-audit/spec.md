# Feature Specification: Middleware consentimiento + modal legal + AuditConsentimiento

**Feature Branch**: `work/002-PI-144`  
**SPEC**: 241  
**Created**: 2026-08-25  
**Status**: PLANEADO  
**Input**: INSTRUCTIVO-002-PI-144 · BRIEF-ACTIVACION-Y-COBROS §5.1/§6.1/§6.2/§6.3/§7/§8/§9.1/§10/§11 · D-52/D-69/D-72/D-74

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Guarda de consentimiento en cualquier ruta autenticada (Priority: P1)

Antes de que un usuario autenticado (PARENT o SCHOOL_ADMIN) acceda a cualquier ruta del dashboard, el sistema verifica que `Usuario.consentimientoVersion` coincida con el parámetro global `consentimiento.version_actual`. Si no coincide, el middleware redirige a `/consentimiento`, que es la única ruta permitida hasta que acepte el documento vigente. Las excepciones son `/api/consentimiento/aceptar`, `/logout` y endpoints públicos.

**Why this priority**: Blindaje SIC (Ley 1581 Art. 7): el representante legal debe autorizar expresamente el tratamiento de datos antes de operar la plataforma.

**Independent Test**: Un usuario autenticado con `consentimientoVersion` desactualizada o nula intenta entrar a `/dashboard/padre/suscripcion` y es redirigido a `/consentimiento`; tras aceptar, accede normalmente.

**Acceptance Scenarios**:

1. **Given** un usuario PARENT autenticado con `consentimientoVersion` nula, **When** navega a `/dashboard/padre/*`, **Then** el layout redirige a `/consentimiento` y el usuario no puede acceder a ninguna otra ruta autenticada.
2. **Given** un usuario SCHOOL_ADMIN autenticado con `consentimientoVersion` nula, **When** navega a `/dashboard/colegio/*`, **Then** el layout redirige a `/consentimiento` y bloquea el resto del dashboard.
3. **Given** un usuario autenticado con `consentimientoVersion == parametro.consentimiento.version_actual`, **When** navega a cualquier ruta de su dashboard, **Then** el layout permite el acceso sin intervención.
4. **Given** un usuario autenticado cuya `consentimientoVersion` quedó desactualizada porque el CEO cambió `consentimiento.version_actual`, **When** vuelve a ingresar, **Then** el middleware detecta el mismatch y fuerza re-aceptación.
5. **Given** un usuario no autenticado, **When** accede a rutas públicas (`/registro`, `/consulta`, `/reportar`), **Then** el middleware de consentimiento no interviene.
6. **Given** un usuario en `/consentimiento`, **When** intenta abandonar la página sin aceptar, **Then** puede ir a `/logout` pero no a otras rutas autenticadas del dashboard.

### User Story 2 — Modal legal con scroll obligatorio y checkboxes (Priority: P1)

La ruta `/consentimiento` muestra un modal legal. Para PARENT se carga `POLITICA-TRATAMIENTO-DATOS-v0.4.md` y se exigen 2 checkboxes: "Declaro ser padre/tutor legal" y "Acepto la política de datos personales". Para SCHOOL_ADMIN se cargan dos bloques: `CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md` y `POLITICA-TRATAMIENTO-DATOS-v0.4.md`, con 2 checkboxes: "Firmo como representante legal del colegio" y "Acepto la política de datos personales". El botón "Acepto" permanece deshabilitado hasta que (a) el usuario haya hecho scroll completo del último documento (detectado por `IntersectionObserver`) y (b) todos los checkboxes estén marcados. El modal usa el color del rol: cielo para padre, pino para colegio.

**Why this priority**: Garantiza que el representante legal lee y acepta expresamente los documentos vigentes antes de operar; es requisito de auditoría SIC.

**Independent Test**: Un usuario PARENT no puede hacer clic en "Acepto" hasta desplazarse hasta el final del documento y marcar ambos checks; un SCHOOL_ADMIN debe recorrer ambos bloques y marcar sus 2 checks.

**Acceptance Scenarios**:

1. **Given** un usuario PARENT en `/consentimiento`, **When** carga la página, **Then** se muestra el título "Antes de continuar", el documento de política y 2 checkboxes desmarcados; el botón "Acepto" está deshabilitado.
2. **Given** un usuario PARENT que hizo scroll hasta el final del documento, **When** aún no marca los checkboxes, **Then** el botón "Acepto" sigue deshabilitado.
3. **Given** un usuario PARENT que marcó los 2 checkboxes pero no hizo scroll completo, **When** intenta aceptar, **Then** el botón sigue deshabilitado.
4. **Given** un usuario PARENT que hizo scroll completo y marcó los 2 checkboxes, **When** hace clic en "Acepto", **Then** la UI envía `POST /api/consentimiento/aceptar` y, al recibir 201, redirige a `/dashboard/padre/suscripcion`.
5. **Given** un usuario SCHOOL_ADMIN en `/consentimiento`, **When** carga la página, **Then** se muestran dos bloques de scroll (convenio + política) y 2 checkboxes; el botón "Acepto" está deshabilitado hasta completar ambos scrolls y marcar ambos checks.
6. **Given** un usuario autenticado de cualquier rol, **When** intenta acceder directamente por URL a `/consentimiento` con versión ya vigente, **Then** el sistema puede redirigirlo a su dashboard correspondiente (comportamiento seguro, no obligatorio).

### User Story 3 — Registro inmutable de aceptación + evento de notificación (Priority: P1)

Al aceptar, el endpoint `POST /api/consentimiento/aceptar` calcula el hash SHA256 del contenido del documento aceptado, crea una fila inmutable en `AuditConsentimiento` con versión, tipo de documento, hash, IP, userAgent y flag `esRepresentanteLegal`, actualiza `Usuario.consentimientoAceptadoEn/Version/DocumentoHash/IP`, y programa el evento `consentimiento.aceptado` vía Motor Notif.

**Why this priority**: Deja traza auditable inmutable ante SIC y confirma al usuario que su aceptación fue registrada.

**Independent Test**: Un usuario acepta el consentimiento; la base contiene exactamente una fila en `AuditConsentimiento` con el hash SHA256 correcto del documento y el evento `consentimiento.aceptado` queda programado.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado que acepta el consentimiento, **When** el endpoint recibe `{ version, documentoTipo, esRepresentanteLegal }`, **Then** calcula el hash SHA256 del documento cargado desde la ruta parametrizada y persiste el registro en `AuditConsentimiento`.
2. **Given** un usuario PARENT que acepta, **When** se crea el registro, **Then** `esRepresentanteLegal = true` y `documentoTipo = "POLITICA_DATOS"`.
3. **Given** un usuario SCHOOL_ADMIN que acepta, **When** se crea el registro, **Then** `esRepresentanteLegal = true` y `documentoTipo = "CONVENIO_INSTITUCIONAL"` (la traza principal del convenio institucional; el flujo puede opcionalmente registrar también la política personal si el brief lo requiere, pero el mínimo exigido es el convenio).
4. **Given** un usuario que acepta, **When** la operación es exitosa, **Then** `Usuario.consentimientoAceptadoEn`, `consentimientoVersion`, `consentimientoDocumentoHash` e `consentimientoIP` se actualizan en la misma transacción.
5. **Given** un usuario que acepta, **When** la operación es exitosa, **Then** el Motor Notif programa el evento `consentimiento.aceptado` con destinatario el mismo usuario, canales EMAIL + IN_APP.
6. **Given** un usuario que ya aceptó la versión vigente, **When** intenta aceptar nuevamente, **Then** el endpoint retorna 200/204 sin crear duplicados (idempotencia segura).
7. **Given** un usuario que envía un `documentoTipo` no permitido, **When** el endpoint lo recibe, **Then** retorna 400 con mensaje descriptivo.

---

## Edge Cases

- **Versión cambia tras aceptar**: si el CEO actualiza `consentimiento.version_actual` de "v0.4" a "v0.5", el middleware detecta el mismatch en el próximo request y fuerza re-aceptación.
- **Documento no encontrado en disco**: si la ruta parametrizada no existe, el endpoint retorna 500 con log interno; el modal no se bloquea indefinidamente (fallback a mensaje de error visible).
- **Usuario ADMIN u OPERADOR**: el middleware también aplica a roles internos autenticados; el admin ve el modal con el documento de política de datos (color ambar).
- **API `/api/consentimiento/aceptar` sin auth**: retorna 401.
- **Tampering de versión en body**: el servidor siempre usa `consentimiento.version_actual` del parámetro global, ignorando cualquier versión enviada por el cliente.
- **Hash mismatch**: el hash se calcula server-side del archivo leído; no se confía en hash enviado por el cliente.
- **Inmutabilidad de `AuditConsentimiento`**: no existe endpoint ni servicio que edite o borre filas de esta tabla; las migraciones no incluyen UPDATE/DELETE sobre ella.
- **IP real detrás de proxy**: se lee `x-forwarded-for` si existe; de lo contrario `req.socket.remoteAddress` o equivalente de Next.js.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE extender el modelo `Usuario` aditivamente con `consentimientoAceptadoEn DateTime?`, `consentimientoVersion String?`, `consentimientoDocumentoHash String?` y `consentimientoIP String?`.
- **FR-002**: El sistema DEBE crear la tabla `AuditConsentimiento` con: `id String @id @default(cuid())`, `usuarioId String`, `version String`, `documentoTipo String`, `documentoHash String`, `aceptadoEn DateTime @default(now())`, `ip String`, `userAgent String?`, `esRepresentanteLegal Boolean @default(false)`; índices en `(usuarioId, aceptadoEn)` y `(version)`; FK a `Usuario`.
- **FR-003**: El sistema DEBE sembrar en `prisma/seed.ts` los parámetros `consentimiento.version_actual`, `consentimiento.padre.documento_ruta` y `consentimiento.colegio.documento_ruta` usando `upsert({create, update})` idempotente.
- **FR-004**: El sistema DEBE crear una página `/consentimiento/page.tsx` (Server Component) que cargue el documento vigente según el rol del usuario y renderice `ModalConsentimiento`.
- **FR-005**: El sistema DEBE crear el componente `ModalConsentimiento` con scroll obligatorio (`IntersectionObserver` en el último elemento del texto), checkboxes según rol, botón "Acepto" deshabilitado hasta cumplir condiciones, y color por rol (cielo/pino/ambar).
- **FR-006**: El sistema DEBE crear el endpoint `POST /api/consentimiento/aceptar` que valide sesión, calcule hash SHA256 del documento, cree `AuditConsentimiento`, actualice `Usuario` y programe evento `consentimiento.aceptado` vía `programar` de `src/lib/notificaciones`.
- **FR-007**: El sistema DEBE agregar el middleware/guardia de consentimiento en los layouts autenticados (`/dashboard/layout.tsx`, `/dashboard/padre/layout.tsx`, `/dashboard/colegio/layout.tsx`, `/dashboard/admin/layout.tsx`) que redirija a `/consentimiento` cuando `consentimientoVersion != parametro.consentimiento.version_actual`.
- **FR-008**: El sistema DEBE excluir del middleware de consentimiento las rutas `/api/consentimiento/aceptar`, `/logout` y endpoints públicos.
- **FR-009**: El sistema DEBE sembrar en `prisma/seed.ts` el evento `consentimiento.aceptado` con reglas EMAIL e IN_APP y plantilla en español, usando `upsert({create, update})` idempotente.
- **FR-010**: El sistema DEBE cargar los documentos legales v0.4 desde las rutas parametrizadas (`consentimiento.padre.documento_ruta` y `consentimiento.colegio.documento_ruta`); ODIN NO redacta contenido legal.
- **FR-011**: El sistema DEBE capturar IP real y `userAgent` en `AuditConsentimiento`.
- **FR-012**: El sistema DEBE usar `date-fns-tz` con timezone `America/Bogota` para toda aritmética de expiración o timestamps mostrados (D-69).
- **FR-013**: El sistema DEBE garantizar que ninguna fila de `AuditConsentimiento` sea editable ni eliminable desde la aplicación (inmutabilidad).

### Key Entities

- **Usuario**: extensión aditiva con campos de consentimiento (`consentimientoAceptadoEn`, `consentimientoVersion`, `consentimientoDocumentoHash`, `consentimientoIP`).
- **AuditConsentimiento**: registro inmutable de cada aceptación con versión, hash SHA256 del documento, IP, userAgent y flag de representante legal.
- **ParametroSistema**: `consentimiento.version_actual`, `consentimiento.padre.documento_ruta`, `consentimiento.colegio.documento_ruta`.
- **NotificacionRegla / NotificacionPlantilla**: reglas y plantillas del evento `consentimiento.aceptado`.

---

## Success Criteria *(mandatory)*

- **SC-001**: El 100% de usuarios autenticados con versión desactualizada son redirigidos a `/consentimiento` antes de acceder a cualquier ruta del dashboard.
- **SC-002**: El botón "Acepto" del modal permanece deshabilitado hasta completar el scroll y marcar todos los checkboxes, verificado por test de componente.
- **SC-003**: Cada aceptación genera exactamente una fila en `AuditConsentimiento` con el hash SHA256 correcto del documento aceptado.
- **SC-004**: El evento `consentimiento.aceptado` queda programado en EMAIL + IN_APP tras cada aceptación.
- **SC-005**: Al cambiar `consentimiento.version_actual`, todos los usuarios existentes son forzados a re-aceptar en su próximo request.
- **SC-006**: No se expone stack trace ni texto completo de reportes en errores del endpoint de consentimiento.
- **SC-007**: El seed de parámetros y del evento `consentimiento.aceptado` es idempotente: ejecutar `npx prisma db seed` N veces no crea duplicados.

---

## Assumptions

- Los documentos legales v0.4 ya existen en `05-ENTREGABLES/` y se copiarán al bundle o se leerán desde ruta parametrizada; ODIN solo los carga, no los redacta.
- La verificación legal de citas con abogado y la RNBD ante SIC son deudas paralelas del CEO, no técnicas.
- El flujo de registro de padre y colegio (SPEC-240) redirige a `/consentimiento`; SPEC-241 implementa la página destino.
- El middleware de vigencia (SPEC-242) se implementa después y no se activa hasta que `/consentimiento` esté disponible, evitando bloqueos cruzados.
- El color por rol sigue D-74: admin `ambar`, padre `cielo`, colegio `pino`.
- `date-fns-tz` se usará para toda aritmética de timestamps de aceptación si se muestran al usuario.
- La aplicación no usa `middleware.ts` global; las guardas se implementan en layouts Server Components, siguiendo el patrón existente.

---

## Implementación

*(Por completar tras aprobación de ZEUS en compuerta §4.)*
