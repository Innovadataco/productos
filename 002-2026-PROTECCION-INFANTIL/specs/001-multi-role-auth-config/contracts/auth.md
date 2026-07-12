# Contract: Authentication API

**Base Path**: `/api/auth`

---

## POST /api/auth/verificar/solicitar

Request a 6-digit verification code sent to the user's email. Initiates the self-registration flow (rol = PARENT).

**Request Body**:
```json
{
  "email": "string (RFC 5322, max 255)"
}
```

**Validation**:
- Email must not already be registered
- Maximum 3 active codes per email in 1 hour

**Response 202**:
```json
{
  "message": "Si el email es válido, recibirás un código de verificación."
}
```
(Always returns 202 to prevent email enumeration)

**Response 429**: Rate limit exceeded (3 codes per hour).

---

## POST /api/auth/verificar/validar

Validate the 6-digit verification code. Allows proceeding to password assignment.

**Request Body**:
```json
{
  "email": "string",
  "codigo": "string (6 digits)"
}
```

**Response 200**:
```json
{
  "valido": true,
  "token": "string (temporary JWT, 15 min)"
}
```
The temporary token authorizes the password completion step.

**Response 400**: Invalid or expired code.  
**Response 400**: Maximum attempts exceeded (5 tries).  
**Response 401**: Code already used.

---

## POST /api/auth/verificar/completar

Complete registration by assigning password after successful code verification.

**Request Body**:
```json
{
  "token": "string (temporary JWT from validar)",
  "password": "string (min 8 chars, 1 letter, 1 number)",
  "nombre": "string (optional, max 100)"
}
```

**Response 201**:
```json
{
  "user": {
    "id": "string (cuid)",
    "email": "string",
    "nombre": "string",
    "rol": "PARENT"
  }
}
```
Sets `token` httpOnly cookie with session JWT.

**Response 400**: Weak password or invalid token.  
**Response 409**: Email already registered (race condition).

---

## POST /api/auth/login

Authenticate a user with email and password. Returns JWT in httpOnly cookie.

**Request Body**:
```json
{
  "email": "string",
  "password": "string"
}
```

**Response 200**:
```json
{
  "user": {
    "id": "string (cuid)",
    "email": "string",
    "nombre": "string",
    "rol": "ADMIN | SCHOOL_ADMIN | PARENT"
  }
}
```
Sets `token` httpOnly cookie with JWT.

**Response 400**: Input validation error.  
**Response 401**: Invalid credentials or account blocked.  
**Response 429**: Too many requests (rate limit, future).

---

## POST /api/auth/logout

Invalidate the current session by clearing the JWT cookie.

**Request**: No body. Reads `token` cookie.

**Response 200**:
```json
{ "message": "Sesión cerrada exitosamente" }
```
Clears `token` cookie.

**Response 401**: No valid session.

---

## POST /api/auth/register

Create a new user directly (ADMIN or SCHOOL_ADMIN only). No verification code needed.

**Request Body**:
```json
{
  "email": "string",
  "password": "string (min 8 chars, 1 letter, 1 number)",
  "nombre": "string",
  "rol": "SCHOOL_ADMIN | PARENT",
  "tenantId": "string (optional, required for SCHOOL_ADMIN-created users)"
}
```

**Response 201**:
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "rol": "string"
  }
}
```

**Response 400**: Validation error (weak password, duplicate email).  
**Response 403**: Insufficient permissions to create user with specified role.

---

## GET /api/me

Return current authenticated user profile.

**Request**: Reads `token` cookie.

**Response 200**:
```json
{
  "id": "string",
  "email": "string",
  "nombre": "string",
  "rol": "ADMIN | SCHOOL_ADMIN | PARENT",
  "tenantId": "string | null"
}
```

**Response 401**: No valid session.