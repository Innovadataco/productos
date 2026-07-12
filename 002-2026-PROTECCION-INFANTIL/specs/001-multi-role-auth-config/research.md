# Research: Autenticación Multi-Rol y Parámetros de Configuración

**Date**: 2026-07-11
**Feature**: specs/001-multi-role-auth-config/spec.md

---

## Decisions

### D1: Stack heredado del proyecto 001

**Decision**: Replicar exactamente el stack probado en producción del proyecto 001-2026-INNOVADATACO.

**Rationale**: La constitución del proyecto (§2.1) establece el stack como no negociable. Next.js App Router + Prisma + PostgreSQL + JWT manual ha sido validado en producción. No hay justificación para introducir variación en la fase fundacional.

**Components**:
- Next.js 16.2.10 (App Router, API Routes exclusivos)
- Prisma 5.22.0 con PostgreSQL 16+
- JWT manual via `jose` + `bcryptjs`
- Vitest + jsdom + `@testing-library/react`
- Tailwind CSS 3.4
- Docker Compose para PostgreSQL

### D2: Sin Redis — caché en memoria de proceso

**Decision**: Los parámetros de configuración se cachean en un `Map` en memoria del proceso Node.js con invalidación por TTL.

**Rationale**: La constitución no menciona Redis. El proyecto 001 no lo usa. Para la fase fundacional, con 10-20 parámetros de configuración, un caché en memoria es suficiente y elimina una dependencia operativa.

### D3: Sin pg-boss en esta fase

**Decision**: `pg-boss` no se inicializa ni se usa en la fase fundacional.

**Rationale**: `pg-boss` es para procesamiento asíncrono de clasificación IA (constitución §4.4). En esta fase no hay reportes ni IA. Se deja la tabla base de `pg-boss` creada por su schema de migración, pero no se arranca el worker.

### D4: Tablas base para multi-tenant y SaaS

**Decision**: Crear tablas `Tenant`, `Plan`, `Subscription`, `BillingCycle` vacías con sus relaciones, pero sin lógica de negocio activa.

**Rationale**: La constitución §2.4 requiere que el diseño de datos contemple el modelo SaaS desde el inicio. Las tablas se crean ahora para evitar migraciones disruptivas, pero permanecen vacías hasta la fase de monetización.

### D5: Rate limiting en memoria (futuro `@upstash/ratelimit`)

**Decision**: No implementar rate limiting en esta fase. Se documenta como deuda técnica con referencia a la constitución §6.4.

**Rationale**: La constitución marca rate limiting como "futuro". En desarrollo local con Docker Compose no hay necesidad inmediata.

### D6: Validación de inputs — Zod como meta, validación manual como transición

**Decision**: Implementar validación manual explícita en las rutas API (constitución §6.2), con migración a Zod documentada como mejora futura.

**Rationale**: La constitución dice "Meta: Migrar a Zod. Hasta entonces, validación manual explícita". En fase fundacional, la validación manual reduce dependencias y es suficiente para 7-9 endpoints.

### D7: Proveedor de email — Resend

**Decision**: Resend como proveedor de email transaccional.

**Rationale**:
- **Capa gratuita**: Resend ofrece 3,000 emails/mes gratis (suficiente para desarrollo y lanzamiento inicial). Brevo ofrece 300 emails/día (9,000/mes) pero con marca de agua y limitaciones de API.
- **DX superior**: API de Resend es más simple (un solo endpoint `POST /emails`), mejor documentación, SDK de Node.js oficial.
- **Deliverability**: Resend está optimizado para emails transaccionales (códigos de verificación, notificaciones) con buena reputación de IPs.
- **Colombia**: Resend acepta dominios `.co` y no requiere verificación de empresa para la capa gratuita, a diferencia de SendGrid/AWS SES.

**Variable de entorno**: `RESEND_API_KEY` (no hardcodeada, nunca en repo).

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| NextAuth.js / Auth.js | Prohibido por constitución §2.1 |
| tRPC | Prohibido por constitución §2.1 |
| GraphQL | Prohibido por constitución §2.1 |
| PostgREST | Prohibido por constitución §2.1 |
| Redis para sesiones | No en constitución; caché en memoria suficiente |
| OAuth2 en esta fase | Fuera de scope del spec |
| 2FA/TOTP en esta fase | Fuera de scope del spec |
| Brevo (email) | Capa gratuita con marca de agua, API más verbosa |
| SendGrid | Requiere verificación de dominio/empresa, más complejo para arranque |
| AWS SES | Requiere cuenta AWS, fuera de stack (sin cloud) |

---

## Open Questions (0 remaining)

All NEEDS CLARIFICATION resolved. Stack is fully determined by constitution and product owner decisions.