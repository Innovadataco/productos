# Contract: Authentication API

**Base Path**: `/api/auth`

---

## POST /api/auth/login

Authenticate a user with email and password. Returns JWT in httpOnly cookie.

**Request Body**:
```json
{
  "email": "string (RFC 5322, max 255)",
  "password": "string (min 12 chars)"
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

**Response 400**: Input validation error (missing fields, invalid format).  
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

**Response 401**: No valid session (already logged out or expired).

---

## POST /api/auth/register

Create a new user. Only ADMIN can create users with any role. SCHOOL_ADMIN can create PARENT users within their tenant.

**Request Body**:
```json
{
  "email": "string",
  "password": "string",
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