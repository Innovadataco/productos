# Contract: Authentication API (Spec 045 updates)

**Base Path**: `/api/auth`

> This contract documents the changes introduced by Spec 045. Unchanged endpoints remain as described in `specs/001-multi-role-auth-config/contracts/auth.md`.

---

## POST /api/auth/register

Create a new user directly (ADMIN or SCHOOL_ADMIN only). No verification code needed.

**Request Body**:
```json
{
  "email": "string (valid RFC 5322, max 255)",
  "password": "string (min 8 chars, max 100, at least 1 letter and 1 number)",
  "nombre": "string (optional, max 100)",
  "rol": "SCHOOL_ADMIN | PARENT",
  "tenantId": "string (optional, cuid/UUID, required for SCHOOL_ADMIN-created users)"
}
```

**Validation** (Zod):
- `email`: valid email format, max 255 chars.
- `password`: min 8, max 100, at least 1 letter and 1 number.
- `nombre`: max 100 chars (optional).
- `rol`: one of the allowed enum values for the current user role.
- `tenantId`: valid cuid/UUID if provided.
- Strict: additional fields are rejected.

**Response 201**: Unchanged.

**Response 400**: `VALIDATION_ERROR` if payload fails Zod validation.

**Response 403**: Unchanged — insufficient permissions.

**Response 409**: Unchanged — email already registered.

**Rate limit**: Unchanged — existing `register` scope still applies.

---

## POST /api/auth/recuperar/solicitar

Request a password reset link sent to the user's email.

**Request Body**:
```json
{
  "email": "string (valid RFC 5322, max 255)"
}
```

**Validation** (Zod):
- `email`: valid email format, max 255 chars.

**Rate limit**:
- Scope: `recuperar_solicitar`.
- Applied by IP and by email identifier.
- Default: 5 requests per 1 hour window.
- Configurable via parameters:
  - `ratelimit.recuperar_solicitar.window_seconds`
  - `ratelimit.recuperar_solicitar.max_requests`

**Response 200** (uniform message, no enumeration):
```json
{
  "message": "Si el email está registrado, recibirás un enlace para restablecer tu contraseña.",
  "emailSent": false
}
```

**Response 400**: `VALIDATION_ERROR` if email is invalid or missing.

**Response 429**: `RATE_LIMITED` if IP or email exceeded the limit. Includes `Retry-After` and `X-RateLimit-*` headers. Message is still the uniform success message to prevent enumeration.

---

## POST /api/auth/recuperar/restablecer

Reset password using a valid recovery token.

**Request Body**:
```json
{
  "token": "string (non-empty, recovery token)",
  "password": "string (min 8 chars, max 100, at least 1 letter and 1 number)"
}
```

**Validation** (Zod):
- `token`: non-empty string.
- `password`: min 8, max 100, at least 1 letter and 1 number.
- Strict: additional fields are rejected.

**Response 200**: Unchanged — password updated.

**Response 400**: `VALIDATION_ERROR` if payload fails Zod validation OR token invalid/expired.

**Response 500**: Unchanged — internal error.

**Rate limit**: Unchanged — no rate limit applied in this spec.

---

## POST /api/auth/verificar/solicitar

Request a 6-digit verification code sent to the user's email. Initiates the self-registration flow (rol = PARENT).

**Request Body**:
```json
{
  "email": "string (valid RFC 5322, max 255)"
}
```

**Validation**: Unchanged — existing email validation still applies before rate limit. (Zod standardization deferred to a later security phase.)

**Rate limit**:
- Scope: `verificacion_solicitar`.
- Applied by IP and by email identifier.
- Default: 5 requests per 1 hour window.
- Configurable via parameters:
  - `ratelimit.verificacion_solicitar.window_seconds`
  - `ratelimit.verificacion_solicitar.max_requests`

**Response 202** (uniform message, no enumeration):
```json
{
  "message": "Si el email es válido, recibirás un código de verificación.",
  "emailSent": true
}
```

**Response 429**: `RATE_LIMITED` if IP or email exceeded the limit. Includes `Retry-After` and `X-RateLimit-*` headers. Message is still the uniform success message to prevent enumeration.

---

## Error Response Format

All error responses follow the project standard:

```json
{
  "error": {
    "message": "Human-readable description",
    "code": "VALIDATION_ERROR | RATE_LIMITED | ..."
  }
}
```

For `429` responses, the following headers are included:

- `X-RateLimit-Limit`: maximum requests allowed per window.
- `X-RateLimit-Remaining`: remaining requests in current window (0 when blocked).
- `X-RateLimit-Reset`: Unix timestamp when the window resets.
- `Retry-After`: seconds until the client can retry.

---

## Notes

- Endpoints `POST /api/auth/verificar/validar` and `POST /api/auth/verificar/completar` are not modified by this spec.
- No endpoint contract changes affect response shapes on success; only validation and rate-limiting behavior are added.
- The plan for secure deletion (`POST /api/auth/borrar-solicitar`) is documented in `plan.md` but not implemented in this spec.
