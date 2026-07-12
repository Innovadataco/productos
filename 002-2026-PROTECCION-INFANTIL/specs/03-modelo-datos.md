# 03 — Modelo de Datos

## 3.1 Principios de Diseño

1. **Soft delete por defecto:** Todas las entidades de negocio incluyen `deletedAt` para preservar integridad referencial y trazabilidad.
2. **Auditoría automática:** Toda tabla de negocio incluye `createdAt`, `updatedAt` y `createdBy` (donde aplica).
3. **Unicode completo:** Todos los campos de texto usan `utf8mb4` equivalente en PostgreSQL para soportar emoji y scripts internacionales (relevante para nicks de redes sociales).
4. **Extensibilidad:** Uso de JSONB para atributos que pueden evolucionar sin cambio de schema (ej. metadatos de perfil, configuraciones).

---

## 3.2 Diagrama Entidad-Relación (Fase Fundación)

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     User        │◄─────►│   UserRole      │◄─────►│      Role       │
├─────────────────┤   1:N ├─────────────────┤  N:1  ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ email           │       │ userId (FK)     │       │ name            │
│ passwordHash    │       │ roleId (FK)     │       │ description     │
│ name            │       │ assignedBy (FK) │       │ isSystem        │
│ emailVerifiedAt │       │ assignedAt      │       │ createdAt       │
│ mfaEnabled      │       └─────────────────┘       │ updatedAt       │
│ mfaSecret       │                                 └─────────────────┘
│ status          │                                        ▲
│ failedLogins    │                                        │
│ lockedUntil     │                                 ┌─────┴─────────────┐
│ lastLoginAt     │                                 │   RolePermission  │
│ createdAt       │                                 ├───────────────────┤
│ updatedAt       │                                 │ id (PK)           │
│ deletedAt       │                                 │ roleId (FK)       │
└─────────────────┘                                 │ permissionId (FK) │
       ▲                                            └───────────────────┘
       │                                                   ▲
       │                                            ┌──────┴──────────────┐
       │                                            │    Permission       │
       │                                            ├─────────────────────┤
       │                                            │ id (PK)             │
       │                                            │ resource (STRING)   │
       │                                            │ action (STRING)     │
       │                                            │ description         │
       │                                            │ createdAt           │
       │                                            └─────────────────────┘
       │
       │       ┌─────────────────┐
       └──────►│   AuditLog      │
               ├─────────────────┤
               │ id (PK)         │
               │ userId (FK)     │
               │ action          │
               │ resourceType    │
               │ resourceId      │
               │ metadata (JSONB)│
               │ ipAddress       │
               │ userAgent       │
               │ sessionId       │
               │ createdAt       │
               └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│  ConfigParam    │       │  ConfigAudit    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄─────►│ id (PK)         │
│ key (UNIQUE)    │  1:N  │ configParamId   │
│ value           │       │ changedBy (FK)  │
│ type            │       │ oldValue        │
│ category        │       │ newValue        │
│ isSecret        │       │ reason          │
│ isPublic        │       │ createdAt       │
│ description     │       └─────────────────┘
│ validationRules │               ▲
│ environment     │               │
│ createdAt       │       ┌───────┘
│ updatedAt       │       │
│ updatedBy (FK)  │       │
└─────────────────┘       │
                          │
                    ┌─────┴─────────────┐
                    │      User         │  (referencia FK)
                    └───────────────────┘

┌─────────────────┐       ┌─────────────────┐
│ RefreshToken    │       │ PasswordReset   │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ userId (FK)     │       │ userId (FK)     │
│ tokenHash       │       │ tokenHash       │
│ expiresAt       │       │ expiresAt       │
│ revokedAt       │       │ usedAt          │
│ createdAt       │       │ createdAt       │
│ ipAddress       │       └─────────────────┘
│ userAgent       │
└─────────────────┘
```

---

## 3.3 Schema Prisma (Fase Fundación)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// CORE: Usuarios y Autenticación
// ============================================================

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  PENDING_VERIFICATION
}

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String
  name            String?
  
  // Verificación de correo
  emailVerifiedAt DateTime?
  
  // MFA / 2FA
  mfaEnabled      Boolean   @default(false)
  mfaSecret       String?   // Cifrado con AES-256-GCM en aplicación
  
  // Seguridad de cuenta
  status          UserStatus @default(PENDING_VERIFICATION)
  failedLogins    Int        @default(0)
  lockedUntil     DateTime?
  lastLoginAt     DateTime?
  
  // Soft delete y auditoría
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  deletedAt       DateTime?
  createdBy       String?    // ID del usuario que creó la cuenta (null = registro propio)
  
  // Relaciones
  userRoles       UserRole[]
  refreshTokens   RefreshToken[]
  passwordResets  PasswordReset[]
  auditLogs       AuditLog[]
  configAudits    ConfigAudit[]
  configUpdates   ConfigParam[] @relation("ConfigUpdatedBy")
  
  @@index([email])
  @@index([status])
  @@index([deletedAt])
  @@map("users")
}

// ============================================================
// CORE: Tokens de Sesión
// ============================================================

model RefreshToken {
  id          String    @id @default(cuid())
  userId      String
  tokenHash   String    @unique // SHA-256 del token raw
  expiresAt   DateTime
  revokedAt   DateTime?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime  @default(now())
  
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([tokenHash])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

model PasswordReset {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([tokenHash])
  @@map("password_resets")
}

// ============================================================
// RBAC: Roles y Permisos
// ============================================================

model Role {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  isSystem    Boolean  @default(false) // Roles base no eliminables
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  userRoles       UserRole[]
  rolePermissions RolePermission[]
  
  @@map("roles")
}

model UserRole {
  id          String   @id @default(cuid())
  userId      String
  roleId      String
  assignedBy  String?  // ID del admin que asignó el rol
  assignedAt  DateTime @default(now())
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role        Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  
  @@unique([userId, roleId])
  @@index([userId])
  @@index([roleId])
  @@map("user_roles")
}

model Permission {
  id          String   @id @default(cuid())
  resource    String   // Ej: "user", "config", "report", "audit"
  action      String   // Ej: "read", "write", "delete", "admin"
  description String?
  
  createdAt   DateTime @default(now())
  
  rolePermissions RolePermission[]
  
  @@unique([resource, action])
  @@map("permissions")
}

model RolePermission {
  id           String @id @default(cuid())
  roleId       String
  permissionId String
  
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  
  @@unique([roleId, permissionId])
  @@index([roleId])
  @@index([permissionId])
  @@map("role_permissions")
}

// ============================================================
// CONFIGURACIÓN: Parámetros Globales
// ============================================================

enum ConfigType {
  STRING
  INTEGER
  FLOAT
  BOOLEAN
  JSON
  STRING_ARRAY
}

enum ConfigCategory {
  SECURITY
  VISIBILITY
  LEGAL
  EMAIL
  RATE_LIMIT
  SYSTEM
}

enum Environment {
  DEVELOPMENT
  STAGING
  PRODUCTION
  ALL
}

model ConfigParam {
  id               String         @id @default(cuid())
  key              String         @unique
  value            String         // Valor serializado como string
  type             ConfigType
  category         ConfigCategory @default(SYSTEM)
  isSecret         Boolean        @default(false)
  isPublic         Boolean        @default(false)
  description      String?
  validationRules  String?        // JSON schema o regex para validación
  environment      Environment    @default(ALL)
  
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  updatedBy        String?
  
  // Relaciones
  updater          User?          @relation("ConfigUpdatedBy", fields: [updatedBy], references: [id])
  auditHistory     ConfigAudit[]
  
  @@index([key])
  @@index([category])
  @@index([environment])
  @@map("config_params")
}

model ConfigAudit {
  id            String   @id @default(cuid())
  configParamId String
  changedBy     String?
  oldValue      String?
  newValue      String
  reason        String?
  createdAt     DateTime @default(now())
  
  configParam   ConfigParam @relation(fields: [configParamId], references: [id], onDelete: Cascade)
  user          User?       @relation(fields: [changedBy], references: [id])
  
  @@index([configParamId])
  @@index([changedBy])
  @@index([createdAt])
  @@map("config_audits")
}

// ============================================================
// AUDITORÍA: Log de Eventos
// ============================================================

enum AuditAction {
  USER_REGISTERED
  USER_LOGIN
  USER_LOGOUT
  USER_PASSWORD_CHANGED
  USER_PASSWORD_RESET_REQUESTED
  USER_PASSWORD_RESET_COMPLETED
  USER_MFA_ENABLED
  USER_MFA_DISABLED
  USER_UPDATED
  USER_DEACTIVATED
  USER_REACTIVATED
  ROLE_ASSIGNED
  ROLE_REVOKED
  ROLE_CREATED
  ROLE_UPDATED
  ROLE_DELETED
  PERMISSION_CREATED
  PERMISSION_UPDATED
  CONFIG_CHANGED
  TOKEN_REVOKED_ALL
  TOKEN_REFRESHED
  SUSPICIOUS_ACTIVITY
  ADMIN_ACTION
}

model AuditLog {
  id           String      @id @default(cuid())
  userId       String?
  action       AuditAction
  resourceType String?     // Ej: "user", "config", "role"
  resourceId   String?     // ID del recurso afectado
  metadata     Json?       // Datos contextuales adicionales (estructura flexible)
  
  // Contexto de la petición
  ipAddress    String?
  userAgent    String?
  sessionId    String?
  
  createdAt    DateTime    @default(now())
  
  user         User?       @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  @@index([userId])
  @@index([action])
  @@index([resourceType])
  @@index([createdAt])
  @@map("audit_logs")
}

// ============================================================
// FASE 2 (Reservado): Estructura base para extensión
// ============================================================
// Las siguientes tablas se documentan como placeholder para
// la fase de reportes y consultas. NO se implementan en Fase 1.

// model Report { ... }
// model Identifier { ... }
// model Platform { ... }
// model School { ... }
// model SchoolUser { ... }
```

---

## 3.4 Diccionario de Datos

### Tabla `users`

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | CUID | No | Identificador único del usuario. |
| `email` | STRING(255) | No | Correo electrónico, único. Normalizado a minúsculas. |
| `passwordHash` | STRING(255) | No | Hash bcrypt de la contraseña. |
| `name` | STRING(255) | Sí | Nombre completo o alias del usuario. |
| `emailVerifiedAt` | TIMESTAMP | Sí | Fecha de verificación del correo. NULL = no verificado. |
| `mfaEnabled` | BOOLEAN | No | Indica si 2FA/TOTP está activo. |
| `mfaSecret` | STRING(255) | Sí | Secreto TOTP cifrado con AES-256-GCM. |
| `status` | ENUM | No | Estado de la cuenta. |
| `failedLogins` | INTEGER | No | Contador de intentos fallidos consecutivos. |
| `lockedUntil` | TIMESTAMP | Sí | Bloqueo temporal hasta esta fecha. |
| `lastLoginAt` | TIMESTAMP | Sí | Último inicio de sesión exitoso. |
| `createdAt` | TIMESTAMP | No | Fecha de creación. |
| `updatedAt` | TIMESTAMP | No | Fecha de última modificación. |
| `deletedAt` | TIMESTAMP | Sí | Soft delete. NULL = activo. |

### Tabla `roles`

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | CUID | No | Identificador único. |
| `name` | STRING(50) | No | Nombre único del rol (`PLATFORM_ADMIN`, `SCHOOL_ADMIN`, `PARENT`). |
| `description` | STRING(255) | Sí | Descripción legible del rol. |
| `isSystem` | BOOLEAN | No | `true` para roles base que no pueden eliminarse. |

### Tabla `permissions`

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | CUID | No | Identificador único. |
| `resource` | STRING(50) | No | Recurso protegido: `user`, `role`, `config`, `report`, `audit`, etc. |
| `action` | STRING(50) | No | Acción: `read`, `write`, `delete`, `admin` (CRUD + admin = todos). |
| `description` | STRING(255) | Sí | Explicación del permiso. |

**Combinaciones base de permisos (seed data):**

| Recurso | Acción | Descripción |
|---------|--------|-------------|
| `user` | `read` | Ver usuarios |
| `user` | `write` | Crear/modificar usuarios |
| `user` | `delete` | Desactivar/eliminar usuarios |
| `user` | `admin` | Gestión total de usuarios |
| `role` | `read` | Ver roles y permisos |
| `role` | `write` | Crear/modificar roles |
| `role` | `delete` | Eliminar roles |
| `role` | `admin` | Gestión total de roles |
| `config` | `read` | Leer parámetros de configuración |
| `config` | `write` | Modificar parámetros de configuración |
| `config` | `admin` | Gestión total de configuración |
| `audit` | `read` | Ver logs de auditoría |
| `audit` | `admin` | Gestión total de auditoría |
| `report` | `read` | Ver reportes (fase 2) |
| `report` | `write` | Crear reportes (fase 2) |
| `report` | `admin` | Moderar reportes (fase 2) |
| `school` | `read` | Ver datos de colegio (fase 2) |
| `school` | `write` | Gestionar colegio (fase 2) |
| `school` | `admin` | Administrar todos los colegios (fase 2) |

### Tabla `config_params`

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | CUID | No | Identificador único. |
| `key` | STRING(100) | No | Clave única del parámetro. Notación `category.subkey` recomendada. |
| `value` | TEXT | No | Valor serializado a string. El tipo real se indica en `type`. |
| `type` | ENUM | No | `STRING`, `INTEGER`, `FLOAT`, `BOOLEAN`, `JSON`, `STRING_ARRAY`. |
| `category` | ENUM | No | Agrupación lógica. |
| `isSecret` | BOOLEAN | No | Si `true`, el valor se cifra antes de almacenar. |
| `isPublic` | BOOLEAN | No | Si `true`, lectura sin autenticación permitida. |
| `description` | TEXT | Sí | Documentación del parámetro. |
| `validationRules` | TEXT | Sí | Reglas de validación (JSON schema o expresión). |
| `environment` | ENUM | No | Entorno al que aplica. `ALL` para todos. |

---

## 3.5 Parámetros de Configuración por Defecto (Seed Data)

| Clave | Valor | Tipo | Categoría | `isPublic` | Descripción |
|-------|-------|------|-----------|------------|-------------|
| `visibility.report_threshold` | `3` | INTEGER | VISIBILITY | `true` | Mínimo de reportes independientes para que un identificador aparezca en consultas públicas. |
| `visibility.daily_report_limit` | `10` | INTEGER | VISIBILITY | `true` | Máximo de reportes por identificador por día desde una misma IP. |
| `security.max_login_attempts` | `5` | INTEGER | SECURITY | `false` | Intentos fallidos antes de bloqueo temporal. |
| `security.lockout_duration_minutes` | `30` | INTEGER | SECURITY | `false` | Minutos de bloqueo tras superar intentos fallidos. |
| `security.password_min_length` | `12` | INTEGER | SECURITY | `true` | Longitud mínima de contraseña. |
| `security.mfa_required_roles` | `["PLATFORM_ADMIN"]` | STRING_ARRAY | SECURITY | `false` | Roles obligados a tener 2FA. |
| `security.jwt_access_ttl_minutes` | `15` | INTEGER | SECURITY | `false` | Vida del access token en minutos. |
| `security.jwt_refresh_ttl_days` | `7` | INTEGER | SECURITY | `false` | Vida del refresh token en días. |
| `email.verification_ttl_hours` | `24` | INTEGER | EMAIL | `false` | Horas de validez del enlace de verificación. |
| `email.password_reset_ttl_hours` | `1` | INTEGER | EMAIL | `false` | Horas de validez del enlace de recuperación. |
| `legal.privacy_policy_url` | `""` | STRING | LEGAL | `true` | URL de la política de privacidad. |
| `legal.terms_url` | `""` | STRING | LEGAL | `true` | URL de los términos de uso. |
| `system.maintenance_mode` | `false` | BOOLEAN | SYSTEM | `true` | Modo mantenimiento: API en read-only. |

---

## 3.6 Estrategia de Migraciones

1. **Migraciones versionadas:** Cada cambio de schema requiere una migración Prisma con nombre descriptivo (`YYYYMMDD_action_description`).
2. **Migraciones en CI:** Los despliegues automáticos ejecutan `prisma migrate deploy` antes de iniciar la aplicación.
3. **Rollback:** Se mantiene un script de rollback por migración en producción. En caso crítico, se restaura desde backup.
4. **Datos iniciales:** El seed de roles, permisos y parámetros por defecto se ejecuta mediante `prisma db seed` en el primer despliegue.

---

## 3.7 Consideraciones para Fase 2

Las siguientes entidades se definirán en la fase de reportes y colegios:

| Entidad | Propósito |
|---------|-----------|
| `Identifier` | Números telefónicos, nicks, usuarios reportados. Incluye hash para anonimización parcial. |
| `Report` | Reporte individual vinculado a un `Identifier`. Incluye texto descriptivo, fecha, ciudad, país, plataforma. |
| `Platform` | Catálogo de plataformas (WhatsApp, TikTok, Discord, Fortnite, etc.). |
| `School` | Institución educativa con relación a `SchoolAdmin`. |
| `SchoolUser` | Usuarios internos de un colegio con permisos granulares definidos por el `SCHOOL_ADMIN`. |