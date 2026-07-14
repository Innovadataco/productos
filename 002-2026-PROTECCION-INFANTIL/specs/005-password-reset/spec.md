# Feature Specification: Restablecimiento de Contraseña

**Feature Branch**: `feature/005-password-reset`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Permitir a usuarios autenticados y no autenticados restablecer su contraseña cuando la olviden. Flujo seguro por email con token de un solo uso, expiración controlada, y sin revelar si el email existe en el sistema."

---

## User Scenarios & Testing

### User Story 1 — Solicitar restablecimiento (Priority: P1) 🎯 MVP

Un usuario que olvidó su contraseña ingresa su correo electrónico en un formulario público y recibe un enlace/token para restablecerla. El sistema no revela si el correo existe.

**Acceptance Scenarios**:

1. **Given** un usuario en `/recuperar`, **When** ingresa un email válido y solicita restablecimiento, **Then** el sistema responde con mensaje genérico de confirmación sin revelar existencia.
2. **Given** un usuario en `/recuperar`, **When** ingresa un email no registrado, **Then** recibe el mismo mensaje genérico.
3. **Given** una solicitud exitosa, **Then** se genera un token único de un solo uso con expiración de 1 hora.

---

### User Story 2 — Validar token de recuperación (Priority: P1) 🎯 MVP

El usuario accede al enlace recibido por email. El sistema valida que el token sea válido y no haya expirado antes de permitir cambiar la contraseña.

**Acceptance Scenarios**:

1. **Given** un token válido y no expirado, **When** accede a `/recuperar/[token]`, **Then** ve el formulario para nueva contraseña.
2. **Given** un token expirado o ya usado, **When** accede al enlace, **Then** ve un mensaje de error y la opción de solicitar uno nuevo.

---

### User Story 3 — Restablecer contraseña (Priority: P1) 🎯 MVP

El usuario ingresa una nueva contraseña segura y confirma el cambio. El token se invalida inmediatamente después del uso.

**Acceptance Scenarios**:

1. **Given** un token válido, **When** ingresa contraseña válida (mínimo 8 caracteres, 1 letra, 1 número) y confirma, **Then** la contraseña se actualiza y el token se marca como usado.
2. **Given** un token válido, **When** ingresa contraseña débil, **Then** recibe error de validación y la contraseña no cambia.
3. **Given** que la contraseña fue actualizada, **When** intenta iniciar sesión, **Then** puede hacerlo con la nueva contraseña.
4. **Given** un token ya usado, **When** intenta restablecer, **Then** recibe error de token inválido.

---

### User Story 4 — Seguridad y privacidad (Priority: P1) 🎯 MVP

El sistema protege contra enumeración de usuarios y asegura que los tokens no sean reutilizables.

**Acceptance Scenarios**:

1. **Given** cualquier email ingresado, **Then** la respuesta HTTP y el mensaje son idénticos sin importar si existe el usuario.
2. **Given** un token usado, **Then** no permite un segundo restablecimiento.
3. **Given** un token expirado, **Then** no permite restablecer.

---

## Requirements

### Functional Requirements

- **FR-001**: Debe existir un formulario público en `/recuperar` para solicitar restablecimiento.
- **FR-002**: Debe existir una página en `/recuperar/[token]` para ingresar nueva contraseña.
- **FR-003**: El endpoint `POST /api/auth/recuperar/solicitar` debe aceptar email y generar token seguro.
- **FR-004**: El endpoint `GET /api/auth/recuperar/validar?token=...` debe verificar validez del token.
- **FR-005**: El endpoint `POST /api/auth/recuperar/restablecer` debe actualizar contraseña e invalidar token.
- **FR-006**: La respuesta de solicitud debe ser idéntica para emails registrados y no registrados.
- **FR-007**: El token debe expirar después de 1 hora.
- **FR-008**: El token debe invalidarse tras un uso exitoso.
- **FR-009**: La nueva contraseña debe cumplir mismas reglas que registro: mínimo 8 caracteres, al menos 1 letra y 1 número.
- **FR-010**: En desarrollo, el sistema debe exponer el token para facilitar pruebas sin depender de Resend.

### Non-Functional Requirements

- **NFR-001**: Tokens generados con criptografía segura (crypto.randomUUID o similar).
- **NFR-002**: Almacenar hash del token, no el token en texto plano.
- **NFR-003**: No enviar emails reales en tests E2E.

---

## Success Criteria

- **SC-001**: Usuario puede completar flujo completo de recuperación en menos de 2 minutos.
- **SC-002**: 100% de tokens usados quedan invalidados después del primer uso.
- **SC-003**: Zero exposición de existencia de cuentas por email.
- **SC-004**: Tests E2E cubren flujo feliz y casos de token inválido/expirado.

---

## Assumptions

- El sistema de autenticación con cookie httpOnly ya existe.
- El servicio de email (Resend) ya está configurado; en dev se usa bypass.
- El modelo `Usuario` ya existe con `passwordHash`.
