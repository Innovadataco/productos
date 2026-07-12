# 02 — Arquitectura

## 2.1 Stack Tecnológico

### Decisión: Node.js + TypeScript (Backend)

Se elige **Node.js con TypeScript** sobre Python por:
- Mismo lenguaje en frontend y backend, reduciendo context switching del equipo.
- Ecosistema maduro de librerías de autenticación (Passport.js, `jose`, `otplib`).
- Mejor rendimiento en I/O concurrente para la naturaleza request/response de la API.
- Compatibilidad nativa con JSON Web Tokens y flujos OAuth 2.0.

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| Runtime | Node.js | 20 LTS | Soporte a largo plazo, performance, native fetch. |
| Lenguaje | TypeScript | 5.5+ | Tipado estático, IDE experience, prevención de errores en runtime. |
| Framework | Fastify | 4.x+ | Alto rendimiento (schema-based validation, faster than Express), plugin architecture. |
| ORM | Prisma | 5.x+ | Type-safe queries, migrations automáticas, excelente DX. |
| Auth | `jose` + `otplib` | Latest | RS256 JWT, TOTP 2FA sin dependencias pesadas. |
| Cache | Redis (ioredis) | 7.x+ | Caché de sesiones, rate limiting, parámetros de configuración. |
| Testing | Vitest + Supertest | Latest | Rápido, nativo ESM, compatible con cobertura v8. |
| Documentación API | Scalar (OpenAPI 3.1) | Latest | UI moderna, generación desde schemas Zod. |

### Frontend

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| Framework | React | 18.x | Ecosistema maduro, React Router v6, buen soporte PWA. |
| Bundler | Vite | 5.x+ | HMR rápido, output optimizado, ESM nativo. |
| Estilos | Tailwind CSS | 3.4+ | Utility-first, bundle size controlado, dark mode nativo. |
| Estado | Zustand | 4.x+ | Ligero, TypeScript-friendly, sin boilerplate. |
| Forms | React Hook Form + Zod | Latest | Validación type-safe, performance en formularios grandes. |
| Query | TanStack Query | 5.x+ | Caché de servidor, sincronización, revalidación. |
| i18n | `react-i18next` | Latest | Soporte multilenguaje desde la fundación. |

### Base de Datos e Infraestructura

| Componente | Tecnología | Justificación |
|------------|-----------|---------------|
| Relacional | PostgreSQL 15+ | ACID, JSONB para flexibilidad futura, PostGIS para geolocalización. |
| Caché / Sesiones | Redis 7+ | Estructuras de datos, TTL nativo, pub/sub para futuras notificaciones. |
| Contenerización | Docker + Docker Compose | Desarrollo local consistente, orquestación ligera. |
| CI/CD | GitHub Actions | Integración nativa con repositorio, matrices de prueba. |
| Cloud (producción) | AWS | RDS PostgreSQL, ElastiCache Redis, ECS Fargate, S3, CloudFront. |

---

## 2.2 Patrón Arquitectónico: Clean Architecture / Hexagonal

El backend sigue una arquitectura limpia con capas bien definidas:

```
┌─────────────────────────────────────────────┐
│  Infraestructura (Infrastructure Layer)     │
│  - HTTP controllers (Fastify routes)        │
│  - Middleware (auth, rate limit, logging)   │
│  - Repositorios concretos (Prisma)          │
│  - Servicios externos (email, cache)        │
├─────────────────────────────────────────────┤
│  Aplicación (Application Layer)             │
│  - Casos de uso (Use Cases)                 │
│  - DTOs de entrada/salida                   │
│  - Orchestration, transaction boundaries    │
├─────────────────────────────────────────────┤
│  Dominio (Domain Layer)                     │
│  - Entidades de negocio                     │
│  - Repositorios (interfaces)                │
│  - Servicios de dominio                     │
│  - Reglas de negocio puro                   │
├─────────────────────────────────────────────┤
│  Core (Shared Kernel)                       │
│  - Excepciones comunes                      │
│  - Tipos base, utils seguras                │
│  - Contratos de eventos                     │
└─────────────────────────────────────────────┘
```

### Dependencia de Capas

Las dependencias apuntan siempre hacia adentro:
- **Infraestructura** conoce **Aplicación** y **Dominio**.
- **Aplicación** conoce **Dominio**.
- **Dominio** solo conoce **Core**.

Ninguna capa interna conoce detalles de implementación de una capa externa.

---

## 2.3 Diagrama de Componentes (Fase Fundación)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTES                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Web App     │  │  Web App     │  │  Web App     │  │  Mobile App  │    │
│  │  (PARENT)    │  │(SCHOOL_ADMIN)│  │(PLATFORM_ADM)│  │   (PARENT)   │    │
│  │  React + Vite│  │  React + Vite│  │  React + Vite│  │   (futuro)   │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼─────────────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │                 │
          └─────────────────┴────────┬────────┴─────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CDN / WAF (CloudFront + AWS WAF)                    │
│                    TLS 1.3, Rate limiting per IP, DDoS protection           │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY / LOAD BALANCER                         │
│                         (AWS ALB / Kong / Traefik)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (ECS Fargate)                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Fastify Application                                                  │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐ │  │
│  │  │ Auth Module │ │ User Module │ │ Config Module│ │ Audit Module   │ │  │
│  │  │ - Register  │ │ - CRUD      │ │ - Parameters │ │ - Event log    │ │  │
│  │  │ - Login     │ │ - Roles     │ │ - Validation │ │ - Query        │ │  │
│  │  │ - 2FA/TOTP  │ │ - Profile   │ │ - Cache      │ │ - Export       │ │  │
│  │  │ - OAuth     │ │ - Capabilities│              │ │                │ │  │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └────────────────┘ │  │
│  │         └─────────────────┴───────────────┘                          │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │ Cross-cutting: JWT Middleware │ RBAC Middleware │ Rate Limiter  │ │  │
│  │  │                Request Logger │ Error Handler   │ Input Sanitizer│ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────────┐
│   PostgreSQL    │  │      Redis      │  │        S3 (futuro)              │
│   (RDS)         │  │  (ElastiCache)  │  │  - Backups de auditoría         │
│  - Users        │  │  - Sessions     │  │  - Exportación de datos         │
│  - Roles        │  │  - Rate limit   │  │                                 │
│  - Permissions  │  │  - Config cache │  │                                 │
│  - Config params│  │  - OTP secrets  │  │                                 │
│  - Audit logs   │  │                 │  │                                 │
└─────────────────┘  └─────────────────┘  └─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVICIOS EXTERNOS                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │ Email Service│  │   Twilio     │  │  Have I Been │                       │
│  │ (AWS SES /   │  │  (futuro:    │  │   Pwned API  │                       │
│  │  SendGrid)   │  │   SMS alerts)│  │ (futuro:     │                       │
│  │              │  │              │  │  leak check) │                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2.4 Estructura de Directorios

### Backend (`/backend`)

```
backend/
├── src/
│   ├── core/                          # Shared kernel
│   │   ├── errors/                    # Excepciones de dominio
│   │   ├── types/                     # Tipos compartidos
│   │   └── utils/                     # Utilidades puras (hashing, etc.)
│   │
│   ├── modules/                       # Módulos de dominio
│   │   ├── auth/
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   ├── repositories/
│   │   │   │   └── services/
│   │   │   ├── application/
│   │   │   │   ├── use-cases/
│   │   │   │   ├── dto/
│   │   │   │   └── mappers/
│   │   │   ├── infrastructure/
│   │   │   │   ├── http/
│   │   │   │   │   ├── routes.ts
│   │   │   │   │   ├── schemas.ts     # Zod validation
│   │   │   │   │   └── controllers.ts
│   │   │   │   ├── persistence/
│   │   │   │   │   └── prisma-auth.repository.ts
│   │   │   │   └── services/
│   │   │   │       └── bcrypt-password.service.ts
│   │   │   └── auth.module.ts
│   │   │
│   │   ├── user/                      # Gestión de usuarios y perfiles
│   │   ├── role/                      # RBAC: roles y permisos
│   │   ├── config/                    # Parámetros de configuración
│   │   └── audit/                     # Logging de auditoría
│   │
│   ├── infrastructure/                # Infraestructura compartida
│   │   ├── database/
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma      # Schema único de BD
│   │   │   │   └── migrations/
│   │   │   └── connection.ts
│   │   ├── cache/
│   │   │   └── redis.client.ts
│   │   ├── email/
│   │   │   └── email.service.ts
│   │   ├── logger/
│   │   │   └── pino.logger.ts
│   │   └── server/
│   │       └── fastify.factory.ts
│   │
│   ├── config/                        # Configuración de la aplicación
│   │   ├── env.validation.ts          # Validación de variables de entorno (Zod)
│   │   └── app.config.ts
│   │
│   └── main.ts                        # Entry point
│
├── tests/
│   ├── unit/                          # Pruebas unitarias (Vitest)
│   ├── integration/                   # Pruebas de integración (Supertest + test DB)
│   └── e2e/                           # Pruebas end-to-end
│
├── prisma/
│   └── schema.prisma
│
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── tsconfig.json
└── package.json
```

### Frontend (`/frontend`)

```
frontend/
├── src/
│   ├── app/                           # Entry point, providers, router
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   │
│   ├── modules/                       # Módulos por dominio
│   │   ├── auth/
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── RegisterPage.tsx
│   │   │   │   ├── ForgotPasswordPage.tsx
│   │   │   │   └── Setup2FAPage.tsx
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   └── useLogout.ts
│   │   │   ├── services/
│   │   │   │   └── auth.api.ts
│   │   │   └── types/
│   │   │       └── auth.types.ts
│   │   │
│   │   ├── dashboard/                 # Dashboard por rol
│   │   ├── admin/                     # Panel de administración de plataforma
│   │   └── profile/                   # Perfil de usuario
│   │
│   ├── shared/                        # Recursos compartidos
│   │   ├── components/                # UI components (Button, Input, Modal, etc.)
│   │   ├── hooks/                     # Hooks genéricos
│   │   ├── utils/                     # Utilidades
│   │   ├── lib/                       # Configuración de librerías (axios, i18n, etc.)
│   │   └── types/                     # Tipos globales
│   │
│   └── assets/                        # Imágenes, íconos, fuentes
│
├── public/
├── tests/
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 2.5 Flujo de Datos: Autenticación

```
┌─────────┐     POST /auth/register     ┌─────────────┐
│ Cliente │ ───────────────────────────▶ │  API Gateway │
└─────────┘                              └──────┬──────┘
                                                │
                                                ▼
                                        ┌───────────────┐
                                        │ Auth Controller│
                                        │  - validate()  │
                                        │  - sanitize()  │
                                        └───────┬───────┘
                                                │
                                                ▼
                                        ┌───────────────┐
                                        │ RegisterUseCase│
                                        │  - check email │
                                        │  - hash pwd    │
                                        │  - create user │
                                        └───────┬───────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              ▼                 ▼                 ▼
                        ┌──────────┐    ┌─────────────┐    ┌──────────┐
                        │UserRepo  │    │EmailService │    │AuditRepo │
                        │(Prisma)  │    │(AWS SES)    │    │(Prisma)  │
                        └──────────┘    └─────────────┘    └──────────┘
```

---

## 2.6 Decisiones Arquitectónicas Registradas (ADRs)

### ADR-001: Monolito modular vs. Microservicios

**Decisión:** Monolito modular con separación por dominio dentro de un único deployable.

**Contexto:** El equipo es pequeño, el dominio aún evoluciona, y la fase fundacional no requiere escalabilidad independiente por componente.

**Consecuencias:**
- (+) Desarrollo más rápido, testing end-to-end más simple.
- (+) Transacciones ACID entre módulos sin saga patterns.
- (-) Acoplamiento potencial si no se respetan los boundaries.
- (-) Escalación futura requerirá extraer módulos a servicios.

### ADR-002: JWT stateless + Refresh Token Rotation

**Decisión:** Access tokens JWT cortos (15 min) sin estado en servidor. Refresh tokens largos (7 días) almacenados en Redis con rotación y revocación.

**Contexto:** Necesitamos balancear rendimiento (sin lookup de BD por request) con capacidad de revocación.

**Consecuencias:**
- (+) Alta performance en validación de requests.
- (+) Revocación inmediata de refresh tokens.
- (-) Access tokens revocados siguen válidos hasta expirar (ventana de 15 min máximo).

### ADR-003: RBAC + ABAC híbrido

**Decisión:** Sistema base RBAC (roles con permisos) extendido con atributos contextuales para el `SCHOOL_ADMIN` (solo usuarios de su escuela).

**Contexto:** Los permisos de `SCHOOL_ADMIN` dependen de una relación dinámica (organización asignada), no solo del rol estático.

**Consecuencias:**
- (+) Modelo simple para roles base, flexible para casos especiales.
- (-) Requiere evaluación de políticas con contexto en cada request de `SCHOOL_ADMIN`.

### ADR-004: PostgreSQL como única base de datos (fase 1)

**Decisión:** PostgreSQL para datos relacionales y documentales (JSONB). Redis solo para caché, sesiones y rate limiting.

**Contexto:** Evitar complejidad operativa de múltiples bases de datos en la fase fundacional.

**Consecuencias:**
- (+) Operación más simple, backups consistentes.
- (+) PostgreSQL JSONB permite flexibilidad para extensiones futuras.
- (-) Para consultas de reportes agregadas (Fase 2) puede requerirse Elasticsearch o ClickHouse.