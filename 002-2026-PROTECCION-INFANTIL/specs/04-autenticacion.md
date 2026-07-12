# 04 — Autenticación y Autorización

## 4.1 Modelo de Seguridad

El sistema implementa un modelo de seguridad en tres capas:

1. **Autenticación:** Verificación de identidad mediante credenciales (contraseña + opcionalmente TOTP).
2. **Autorización (RBAC + ABAC):** Verificación de permisos basada en roles y atributos contextuales.
3. **Auditoría:** Registro inmutable de todas las acciones de autenticación y autorización.

---

## 4.2 Flujo de Registro de Cuenta

```
┌─────────┐                                      ┌─────────┐
│ Cliente │                                      │ Servidor │
└────┬────┘                                      └────┬────┘
     │                                                │
     │  POST /api/v1/auth/register                    │
     │  { email, password, name, role? }              │
     │ ──────────────────────────────────────────────▶ │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 1. Validar input│               │
     │              │    (Zod schema) │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 2. Normalizar   │               │
     │              │    email        │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 3. Verificar    │               │
     │              │    unicidad     │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 4. Hash password│               │
     │              │    (bcrypt, 12) │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 5. Crear usuario│               │
     │              │    status:      │               │
     │              │ PENDING_VERIFICATION             │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 6. Generar token│               │
     │              │    de verificación               │
     │              │    (JWT, 24h)   │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 7. Enviar email │               │
     │              │    de verificación              │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 8. Registrar    │               │
     │              │    audit log    │               │
     │              └─────────────────┘               │
     │                                                │
     │  201 Created                                   │
     │  { message: "Verifica tu correo" }             │
     │ ◀────────────────────────────────────────────── │
     │                                                │
```

### Reglas de validación del registro

| Campo | Regla | Mensaje de error |
|-------|-------|------------------|
| `email` | Formato RFC 5322, normalizado a minúsculas, único | `EMAIL_INVALID` o `EMAIL_IN_USE` |
| `password` | Mínimo 12 caracteres, al menos 1 mayúscula, 1 minúscula, 1 número, 1 símbolo | `PASSWORD_TOO_WEAK` |
| `name` | 2-100 caracteres, sin caracteres de control | `NAME_INVALID` |
| `role` | Opcional. Solo `PLATFORM_ADMIN` puede asignar roles en registro. Default: `PARENT` | `ROLE_ASSIGNMENT_UNAUTHORIZED` |

### Verificación de correo electrónico

**Endpoint:** `GET /api/v1/auth/verify-email?token={jwt}`

1. El token JWT de verificación contiene: `sub` (userId), `type: "email_verification"`, `exp` (24h).
2. Al validar: se actualiza `users.emailVerifiedAt = NOW()` y `users.status = ACTIVE`.
3. Si el token expiró, el usuario puede solicitar reenvío: `POST /api/v1/auth/resend-verification`.
4. Máximo 3 reenvíos por hora por email (rate limiting).

---

## 4.3 Flujo de Inicio de Sesión

```
┌─────────┐                                      ┌─────────┐
│ Cliente │                                      │ Servidor │
└────┬────┘                                      └────┬────┘
     │                                                │
     │  POST /api/v1/auth/login                       │
     │  { email, password, totpCode? }                │
     │ ──────────────────────────────────────────────▶ │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 1. Buscar usuario│              │
     │              │    por email    │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 2. Verificar    │               │
     │              │    status y     │               │
     │              │    bloqueo      │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 3. Comparar     │               │
     │              │    bcrypt hash  │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 4. Si MFA habilitado            │
     │              │    y totpCode omitido           │
     │              │    → 202 + mfaRequired: true    │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 5. Validar TOTP │               │
     │              │    (si aplica)  │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 6. Generar      │               │
     │              │    accessToken  │               │
     │              │    (JWT, 15min) │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 7. Generar      │               │
     │              │    refreshToken │               │
     │              │    (random, 7d) │               │
     │              │    → guardar hash en Redis/DB   │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 8. Resetear     │               │
     │              │    failedLogins │               │
     │              │    actualizar   │               │
     │              │    lastLoginAt  │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 9. Registrar    │               │
     │              │    audit log    │               │
     │              └─────────────────┘               │
     │                                                │
     │  200 OK                                        │
     │  { accessToken, refreshToken, expiresIn,       │
     │    user: { id, email, name, roles } }          │
     │ ◀────────────────────────────────────────────── │
     │                                                │
```

### Respuesta de MFA requerido

Cuando el usuario tiene `mfaEnabled = true` pero no envía `totpCode`:

```json
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "mfaRequired": true,
  "mfaToken": "eyJhbGciOiJSUzI1NiIs...",
  "message": "Se requiere código de autenticación de doble factor"
}
```

El `mfaToken` es un JWT de corta duración (5 minutos) que autoriza únicamente a completar el login con TOTP. Contiene `type: "mfa_pending"` y el `sub` del usuario.

---

## 4.4 Flujo de Refresh Token

```
┌─────────┐                                      ┌─────────┐
│ Cliente │                                      │ Servidor │
└────┬────┘                                      └────┬────┘
     │                                                │
     │  POST /api/v1/auth/refresh                     │
     │  { refreshToken }                              │
     │ ──────────────────────────────────────────────▶ │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 1. Calcular hash│               │
     │              │    SHA-256      │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 2. Buscar en BD/│               │
     │              │    Redis        │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 3. Verificar no │               │
     │              │    revocado ni  │               │
     │              │    expirado     │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 4. Revocar token│               │
     │              │    anterior     │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 5. Generar nuevo│               │
     │              │    accessToken  │               │
     │              └─────────────────┘               │
     │                                                │
     │              ┌─────────────────┐               │
     │              │ 6. Generar nuevo│               │
     │              │    refreshToken │               │
     │              │    (rotación)   │               │
     │              └─────────────────┘               │
     │                                                │
     │  200 OK                                        │
     │  { accessToken, refreshToken, expiresIn }      │
     │ ◀────────────────────────────────────────────── │
     │                                                │
```

### Rotación de Refresh Tokens

Cada uso de un refresh token genera un par nuevo (access + refresh). El token anterior se marca como revocado para prevenir reutilización (detectar token theft).

---

## 4.5 Flujo de Cierre de Sesión

| Escenario | Endpoint | Comportamiento |
|-----------|----------|----------------|
| Cierre en un dispositivo | `POST /api/v1/auth/logout` | Revoca el refresh token actual. El access token sigue válido hasta expirar (≤ 15 min). |
| Cierre en todos los dispositivos | `POST /api/v1/auth/logout-all` | Revoca TODOS los refresh tokens del usuario. Requiere password actual para confirmar. |

---

## 4.6 Recuperación de Contraseña

```
POST /api/v1/auth/forgot-password
{ email }

→ Genera token UUIDv4, guarda hash SHA-256, envía email
→ Token válido por 1 hora, un solo uso
```

```
POST /api/v1/auth/reset-password
{ token, newPassword }

→ Verifica hash del token
→ Verifica no usado previamente
→ Actualiza passwordHash
→ Revoca todos los refresh tokens
→ Registra audit log
```

---

## 4.7 Autenticación Social (OAuth 2.0)

Soportada únicamente para el rol `PARENT`.

| Proveedor | Flujo | Alcance solicitado |
|-----------|-------|-------------------|
| Google | Authorization Code + PKCE | `openid email profile` |
| Apple | Authorization Code + PKCE | `name email` |

### Proceso:

1. Frontend redirige al proveedor OAuth con `state` (CSRF token) y `code_challenge` (PKCE).
2. Proveedor redirige a `callback` con `code` y `state`.
3. Backend intercambia `code` por tokens del proveedor.
4. Backend obtiene email del proveedor y busca/crea usuario.
5. Si el usuario no existe: crea cuenta con `status = ACTIVE` (el proveedor ya verificó el email).
6. Genera access + refresh tokens propios.
7. Retorna tokens al frontend.

**Seguridad:**
- `state` validado contra CSRF.
- PKCE obligatorio para prevenir interceptación del `code`.
- Solo se aceptan emails verificados por el proveedor.

---

## 4.8 Configuración de 2FA/TOTP

### Activación

```
POST /api/v1/auth/mfa/setup
Authorization: Bearer {accessToken}

→ Genera secreto TOTP (base32)
→ Guarda secreto cifrado (AES-256-GCM) en users.mfaSecret
→ Retorna: secret (para QR), backupCodes[]
→ No habilita aún: requiere verificación
```

```
POST /api/v1/auth/mfa/verify-setup
{ totpCode }

→ Verifica código contra secreto almacenado
→ Si válido: users.mfaEnabled = true
→ Invalida sesiones existentes (requiere re-login)
```

### Desactivación

```
POST /api/v1/auth/mfa/disable
{ password, totpCode }

→ Requiere ambas credenciales para prevenir desactivación no autorizada
→ users.mfaEnabled = false, users.mfaSecret = null
→ Registra audit log USER_MFA_DISABLED
```

### Backup Codes

- 10 códigos de respaldo de un solo uso generados al activar 2FA.
- Almacenados como bcrypt hashes.
- Un código usado se marca como consumido.
- Permiten login si el usuario pierde acceso al autenticador.

---

## 4.9 Autorización: RBAC + ABAC

### Jerarquía de Permisos

```
┌─────────────────────────────────────────────┐
│           PLATFORM_ADMIN                    │
│  └─ Todos los permisos de todos los recursos │
├─────────────────────────────────────────────┤
│           SCHOOL_ADMIN                      │
│  └─ Permisos de school:* (fase 2)           │
│  └─ Permisos de user:read/write (sólo       │
│      usuarios de su escuela asignada)       │
├─────────────────────────────────────────────┤
│              PARENT                         │
│  └─ Permisos de user:read/write (sólo       │
│      su propio perfil)                      │
│  └─ Permisos de report:write (fase 2)       │
│  └─ Permisos de report:read (fase 2)        │
└─────────────────────────────────────────────┘
```

### Resolución de Permisos Efectivos

```typescript
// Pseudo-código de resolución
async function resolveEffectivePermissions(userId: string): Promise<Permission[]> {
  const userRoles = await getUserRoles(userId);
  const permissions = new Set<Permission>();
  
  for (const userRole of userRoles) {
    const rolePerms = await getRolePermissions(userRole.roleId);
    rolePerms.forEach(p => permissions.add(p));
  }
  
  return Array.from(permissions);
}
```

### Middleware de Autorización

```typescript
// Fastify hook preHandler
function requirePermission(resource: string, action: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user; // set by auth middleware
    
    const hasPermission = await checkPermission(user.id, resource, action);
    
    if (!hasPermission) {
      // ABAC: verificar contexto adicional
      const abacAllowed = await evaluateABAC(user, resource, action, request);
      
      if (!abacAllowed) {
        reply.code(403).send({ error: 'FORBIDDEN', message: 'Permiso denegado' });
        return;
      }
    }
  };
}
```

### Políticas ABAC (Contextuales)

| Rol | Recurso | Acción | Condición ABAC |
|-----|---------|--------|----------------|
| `SCHOOL_ADMIN` | `user` | `read` | `user.schoolId === request.user.schoolId` |
| `SCHOOL_ADMIN` | `user` | `write` | `user.schoolId === request.user.schoolId` AND `targetUser.roles` no incluye `PLATFORM_ADMIN` |
| `PARENT` | `user` | `read` | `targetUser.id === request.user.id` |
| `PARENT` | `user` | `write` | `targetUser.id === request.user.id` |

---

## 4.10 JWT: Especificación Técnica

### Access Token

```json
{
  "sub": "user_cuid",
  "email": "usuario@ejemplo.com",
  "roles": ["PARENT"],
  "permissions": ["user:read", "user:write", "report:write"],
  "iat": 1720742400,
  "exp": 1720743300,
  "jti": "unique-token-id",
  "type": "access"
}
```

- **Algoritmo:** RS256 (par de claves asimétricas).
- **Expiración:** 15 minutos (configurable vía `security.jwt_access_ttl_minutes`).
- **Emisor:** `proteccion-infantil-api`.
- **Audiencia:** `proteccion-infantil-app`.

### Refresh Token

- **Formato:** UUIDv4 criptográficamente seguro (no JWT).
- **Almacenamiento:** Hash SHA-256 en PostgreSQL + Redis.
- **Expiración:** 7 días (configurable vía `security.jwt_refresh_ttl_days`).
- **Rotación:** Sí, un solo uso.

### Claves y Rotación

- Par de claves RSA-2048 (mínimo) o RSA-4096 (recomendado).
- Rotación automática cada 90 días.
- Durante rotación, se aceptan tokens firmados con la clave anterior durante un período de gracia de 24 horas.
- Las claves se almacenan en AWS Secrets Manager o equivalente.

---

## 4.11 Rate Limiting por Endpoint

| Endpoint | Límite | Ventana | Alcance |
|----------|--------|---------|---------|
| `POST /auth/register` | 5 | 1 hora | Por IP |
| `POST /auth/login` | 10 | 1 hora | Por IP + email |
| `POST /auth/refresh` | 30 | 1 hora | Por IP |
| `POST /auth/forgot-password` | 3 | 1 hora | Por email |
| `POST /auth/resend-verification` | 3 | 1 hora | Por email |
| `POST /auth/mfa/*` | 10 | 5 minutos | Por userId |
| API general autenticada | 1000 | 1 hora | Por userId |
| API general anónima | 100 | 1 hora | Por IP |

Implementación: Redis con `ioredis` usando ventanas deslizantes (sliding window).

---

## 4.12 Gestión de Sesiones

### Estados de Sesión

```
┌─────────────┐    login exitoso     ┌─────────────┐
│  Anónimo    │ ───────────────────▶ │ Autenticado │
└─────────────┘                      └──────┬──────┘
                                            │
                              ┌─────────────┼─────────────┐
                              │             │             │
                              ▼             ▼             ▼
                        ┌─────────┐   ┌─────────┐   ┌─────────┐
                        │ Activo  │   │ Inactivo│   │ Revocado│
                        │ (usando)│   │ (idle)  │   │ (logout)│
                        └─────────┘   └────┬────┘   └─────────┘
                                           │
                                           │ 30 min sin actividad
                                           ▼
                                     ┌─────────────┐
                                     │ Token expirado│
                                     │ (re-login)  │
                                     └─────────────┘
```

### Detección de Actividad Sospechosa

El sistema registra `SUSPICIOUS_ACTIVITY` en auditoría cuando:

- Login desde una IP geolocalizada en país diferente al habitual (sin VPN conocida).
- Múltiples intentos fallidos seguidos de un login exitoso.
- Uso de refresh token desde dispositivo con user-agent diferente.
- Dos logins activos en continentes diferentes con menos de 2 horas de diferencia.

---

## 4.13 Endpoints de Autenticación (Resumen)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | No | Registro de nueva cuenta |
| GET | `/api/v1/auth/verify-email` | No | Verificación de correo |
| POST | `/api/v1/auth/resend-verification` | No | Reenviar email de verificación |
| POST | `/api/v1/auth/login` | No | Inicio de sesión |
| POST | `/api/v1/auth/refresh` | No | Renovar access token |
| POST | `/api/v1/auth/logout` | Access token | Cerrar sesión actual |
| POST | `/api/v1/auth/logout-all` | Access token | Cerrar todas las sesiones |
| POST | `/api/v1/auth/forgot-password` | No | Solicitar recuperación |
| POST | `/api/v1/auth/reset-password` | No | Restablecer contraseña |
| POST | `/api/v1/auth/oauth/:provider` | No | Iniciar flujo OAuth |
| GET | `/api/v1/auth/oauth/:provider/callback` | No | Callback OAuth |
| POST | `/api/v1/auth/mfa/setup` | Access token | Iniciar configuración 2FA |
| POST | `/api/v1/auth/mfa/verify-setup` | Access token | Completar configuración 2FA |
| POST | `/api/v1/auth/mfa/disable` | Access token | Desactivar 2FA |
| GET | `/api/v1/me` | Access token | Perfil del usuario actual |
| GET | `/api/v1/me/capabilities` | Access token | Permisos y capacidades |
| PATCH | `/api/v1/me` | Access token | Actualizar perfil propio |
| POST | `/api/v1/me/password` | Access token | Cambiar contraseña |