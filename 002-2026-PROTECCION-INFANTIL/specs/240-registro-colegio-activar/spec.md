# Feature Specification: Registro público de colegio + /activar por token + rediseño admin pre-registro (fix BUG-01)

**Feature Branch**: `work/002-PI-143`  
**SPEC**: 240  
**Created**: 2026-08-25  
**Status**: PLANEADO  
**Input**: INSTRUCTIVO-002-PI-143 · BRIEF-ACTIVACION-Y-COBROS §5.2/§5.3/§6.1/§6.3/§8/§10/§11 · D-52/D-69/D-72/D-74

Impacto en arquitectura: agrega enum `EstadoActivacion` + 3 campos aditivos en `Usuario` (`estadoActivacion`, `tokenInvitacion`, `tokenInvitacionExpiraEn`), nueva ruta pública `/registro-colegio`, nueva ruta `/activar?token=XYZ`, simplifica admin pre-registro (14→3 campos, fix BUG-01) con modal en vez de banner, nuevo evento `colegio.invitacion.enviada` + parámetro `pagos.invitacion.token_vigencia_horas` en seed idempotente, extensión aditiva de `/api/auth/verificar/completar` para crear Colegio+SCHOOL_ADMIN. El endpoint `POST /api/admin/colegios` conserva compatibilidad legacy con payload completo para journeys existentes.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Registro público de colegio (Priority: P1)

Un rector puede registrar su institución desde una ruta pública sin intervención del admin. El flujo es espejo del registro de padre: ingresa nombre del colegio, nombre del rector y email; recibe un código de verificación de 6 dígitos; ingresa el código y define contraseña. El sistema crea el `Colegio` y el `Usuario` rector con rol `SCHOOL_ADMIN` y `estadoActivacion=REGISTRADO`, inicia sesión automáticamente y lo envía a `/consentimiento` (resuelto en SPEC-241).

**Why this priority**: Habilita el ingreso institucional autogestionado, primer paso del onboarding del módulo Colegio según el BRIEF-ACTIVACION-Y-COBROS.

**Independent Test**: Un usuario anónimo completa el flujo de `/registro-colegio`, se crea el colegio y el rector, y el usuario queda autenticado con rol `SCHOOL_ADMIN`.

**Acceptance Scenarios**:

1. **Given** un usuario anónimo en `/registro-colegio`, **When** ingresa nombreColegio, nombreRector y emailRector válidos y solicita código, **Then** el sistema genera y envía un código de 6 dígitos al email.
2. **Given** un email no registrado que recibió el código, **When** ingresa el código correcto y una contraseña válida, **Then** se crean `Colegio` y `Usuario` (rol `SCHOOL_ADMIN`, `estadoActivacion=REGISTRADO`), se vinculan por `colegioId`/`tenantId`, se inicia sesión automáticamente y se redirige a `/consentimiento`.
3. **Given** un email ya registrado, **When** intenta solicitar código, **Then** el sistema responde con el mensaje genérico de éxito (sin filtrar existencia) y no envía código.
4. **Given** un código incorrecto, **When** intenta completar el registro, **Then** el sistema rechaza la operación, incrementa intentos fallidos y bloquea el código tras 5 intentos.
5. **Given** un intento de registro, **When** el payload es inválido o faltan campos, **Then** la API retorna `400` con mensaje descriptivo.

### User Story 2 — Activación por invitación admin en `/activar?token=XYZ` (Priority: P1)

El admin de la plataforma puede pre-registrar un colegio enviando una invitación por email. El rector abre un link con un token opaco de un solo uso, define su contraseña y queda activo. El token expira según el parámetro global `pagos.invitacion.token_vigencia_horas` (default 48h).

**Why this priority**: Cierra el flujo de pre-registro admin simplificado (14→3 campos) y elimina la contraseña temporal (fix BUG-01).

**Independent Test**: Un rector con `estadoActivacion=INVITADO` y un token vigente puede consumir el link, definir contraseña y quedar autenticado.

**Acceptance Scenarios**:

1. **Given** un token válido y no expirado para un usuario `INVITADO`, **When** el rector accede a `/activar?token=XYZ`, **Then** ve el formulario para crear contraseña.
2. **Given** un token válido, **When** envía una contraseña que cumple reglas, **Then** el sistema actualiza el hash, marca `tokenInvitacion=null`, cambia `estadoActivacion=REGISTRADO`, inicia sesión y redirige a `/consentimiento`.
3. **Given** un token ya consumido o inexistente, **When** se accede a `/activar`, **Then** se muestra la pantalla “Link expirado, contacta al admin”.
4. **Given** un token expirado, **When** se accede a `/activar`, **Then** se muestra la misma pantalla de link expirado.
5. **Given** una contraseña débil, **When** se intenta activar, **Then** la API retorna `400` indicando las reglas de complejidad.

### User Story 3 — Admin pre-registra colegio simplificado + fix BUG-01 (Priority: P1)

El admin crea un colegio desde `/dashboard/admin/colegios/nuevo` con solo 3 campos: nombre del colegio, nombre del rector y email del rector. El sistema crea `Colegio` + `Usuario` rector con `estadoActivacion=INVITADO`, genera token de invitación, emite el evento `colegio.invitacion.enviada` con el link `https://pi.innovadataco.com/activar?token=XYZ` y muestra un modal confirmando el envío. Se elimina el banner ámbar con contraseña temporal.

**Why this priority**: Reduce fricción del admin (dato mínimo indispensable), cierra BUG-01 y desacopla la vigencia del formulario de creación (BUG-06), que ahora se gestiona desde Pagos.

**Independent Test**: Un admin crea un colegio con 3 campos y el rector recibe el email de invitación.

**Acceptance Scenarios**:

1. **Given** un admin autenticado, **When** completa los 3 campos y envía, **Then** se crean `Colegio` y `Usuario` (`INVITADO`), se genera token opaco con expiración `ahora + pagos.invitacion.token_vigencia_horas` y se registra `AuditLog`.
2. **Given** un admin que creó el colegio, **When** la operación es exitosa, **Then** el Motor Notif emite `colegio.invitacion.enviada` al email del rector con la variable `linkActivacion`.
3. **Given** un admin que creó el colegio, **When** la operación es exitosa, **Then** se muestra un modal “✓ Invitación enviada · el rector recibió email para activar su cuenta” y no se expone contraseña temporal.
4. **Given** un email de rector ya registrado, **When** el admin envía el formulario, **Then** la API retorna `409` con mensaje claro.
5. **Given** un admin que accede al formulario, **When** lo visualiza, **Then** no aparecen campos de vigencia ni sección de representante legal completo.

---

## Edge Cases

- **Email duplicado en registro público**: respuesta idéntica a la de solicitud exitosa (anti-enumeración); el completar falla con `409` si el email se registró en la ventana.
- **Token expirado**: el sistema no permite activar; pantalla de link expirado.
- **Token reutilizado**: tras consumirse, `tokenInvitacion=null`; intentos posteriores muestran link expirado.
- **Código agotado por intentos**: el registro público bloquea el código tras 5 intentos fallidos, siguiendo la misma lógica del padre.
- **Datos institucionales mínimos**: el registro público y el pre-registro admin usan valores por defecto (país CO, ciudad configurable, tipoPeriodo MENSUAL, inicioServicio=ahora); el onboarding perezoso (fuera de scope) pedirá el resto.
- **Ruta `/consentimiento` aún no existe**: SPEC-240 redirige a ella; la página se implementa en SPEC-241.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE ofrecer una ruta pública `/registro-colegio` con un formulario de dos pasos (email + código + contraseña) y un campo institucional `nombreColegio`.
- **FR-002**: El sistema DEBE reutilizar los mecanismos de verificación por código existentes (`/api/auth/verificar/*`), extendiendo `completar` para crear `Colegio` + `Usuario` `SCHOOL_ADMIN` cuando se envíe `nombreColegio`.
- **FR-003**: El sistema DEBE crear el `Colegio` y su `Tenant` asociado en la misma transacción, vinculando el rector por `colegioId` y `tenantId`.
- **FR-004**: El sistema DEBE crear un enum `EstadoActivacion` (`REGISTRADO` | `INVITADO` | `ACTIVO`) y agregarlo al modelo `Usuario` con default `REGISTRADO`.
- **FR-005**: El sistema DEBE agregar a `Usuario` los campos `tokenInvitacion String? @unique` y `tokenInvitacionExpiraEn DateTime?` para invitaciones admin.
- **FR-006**: El sistema DEBE ofrecer una ruta `/activar?token=XYZ` que, para un token vigente y usuario `INVITADO`, permita definir contraseña, consumir el token e iniciar sesión.
- **FR-007**: El sistema DEBE rechazar tokens inválidos, expirados o ya consumidos mostrando una pantalla de link expirado.
- **FR-008**: El sistema DEBE simplificar `/dashboard/admin/colegios/nuevo` a 3 campos (`nombreColegio`, `nombreRector`, `emailRector`), eliminando la sección de vigencia y el banner de contraseña temporal.
- **FR-009**: El sistema DEBE generar un token opaco de invitación (cuid o random 32 bytes) al pre-registrar, con vigencia tomada del parámetro `pagos.invitacion.token_vigencia_horas` (default 48h).
- **FR-010**: El sistema DEBE emitir el evento `colegio.invitacion.enviada` vía Motor Notif al email del rector, incluyendo el link `https://pi.innovadataco.com/activar?token=XYZ`.
- **FR-011**: El sistema DEBE sembrar en `prisma/seed.ts` el parámetro `pagos.invitacion.token_vigencia_horas`, la regla y la plantilla del evento `colegio.invitacion.enviada` usando `upsert({create, update})` (idempotente).
- **FR-012**: El sistema DEBE redirigir al usuario autenticado (registro público, activación o admin pre-registro → consumo) a `/consentimiento`.
- **FR-013**: El sistema DEBE registrar `AuditLog` de creación de colegio y de envío de invitación.

### Key Entities

- **Usuario**: extensión aditiva con `estadoActivacion`, `tokenInvitacion`, `tokenInvitacionExpiraEn`.
- **Colegio**: creado con datos mínimos; ubicación y representante legal completados en onboarding posterior.
- **Tenant**: creado automáticamente y vinculado al colegio.
- **ParametroSistema**: `pagos.invitacion.token_vigencia_horas`.
- **NotificacionRegla / NotificacionPlantilla**: regla y plantilla del evento `colegio.invitacion.enviada`.

---

## Success Criteria *(mandatory)*

- **SC-001**: Un rector completa `/registro-colegio` en menos de 60 segundos y queda autenticado con rol `SCHOOL_ADMIN`.
- **SC-002**: Un rector invitado activa su cuenta desde `/activar` en un solo intento si el token es válido.
- **SC-003**: El 100% de los tokens inválidos/expirados/usados son rechazados sin filtrar estado del usuario.
- **SC-004**: El admin crea un colegio con 3 campos y el email de invitación se encola en menos de 5 segundos.
- **SC-005**: El seed de `colegio.invitacion.enviada` es idempotente: ejecutar `npx prisma db seed` N veces no crea duplicados.
- **SC-006**: No se expone contraseña temporal en el flujo admin (BUG-01 cerrado).

---

## Assumptions

- El flujo de verificación por código del padre (`/api/auth/verificar/*`) se extiende aditivamente; no se reescribe.
- La ubicación por defecto del colegio en registro público/pre-registro es Colombia (país CO) y una ciudad configurable (`registro.colegio.ciudad_default_id`), ya que el brief establece “Colombia por default” y onboarding perezoso.
- Los campos `Colegio.inicioServicio`, `Colegio.tipoPeriodo` y representante legal se completan con valores por defecto seguros; la vigencia real se gestionará desde `Suscripcion` (SPEC-244/SPEC-213).
- La página `/consentimiento` se implementa en SPEC-241; SPEC-240 solo establece las redirecciones.
- `date-fns-tz` se usará para toda aritmética de expiración en timezone Bogotá (D-69).

---

## Implementación

*(Por completar tras aprobación de ZEUS en compuerta §4.)*
