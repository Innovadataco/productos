# 002-2026-PROTECCION-INFANTIL

Sistema de reportes comunitarios de protección infantil. Desarrollo guiado por especificaciones (Spec-Driven Development con Spec Kit).

## Fases del proyecto

| Fase | Feature | Estado | Spec |
|------|---------|--------|------|
| F1 | Scoring 0-100 de identificadores | ✅ Implementado | `specs/02-reportes-comunitarios/` |
| F2 | Rate limiting PostgreSQL | ✅ Implementado | `specs/02-reportes-comunitarios/` |
| F3 | Landing page pública | ✅ Implementado | `specs/003-frontend-publico/` |
| F4 | PWA (manifest, service worker, offline) | ✅ Implementado | `specs/003-frontend-publico/` |
| F5 | Onboarding de primer uso | ✅ Implementado | `specs/003-frontend-publico/` |
| F6 | Páginas legales y footer | ✅ Implementado | `specs/006-paginas-legales/` |
| F7 | Alertas por email | ✅ Implementado | `specs/007-alertas-email/` |
| F8 | SEO y metadatos | 🚧 Pendiente | `specs/008-seo/` |
| F9 | Dashboard público | 🚧 Pendiente | `specs/009-dashboard-publico/` |

## Setup local

```bash
cp .env.example .env
# Edita .env con tus credenciales
docker compose up -d db
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

## Despliegue local de producción

```bash
npm run build
npm start          # App en :5005
npm run worker     # Worker de procesamiento de reportes
```

## Variables de entorno

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Min 32 chars, never committed |
| `RESEND_API_KEY` | ✅ | Resend API key for transactional email |
| `EMAIL_FROM` | ✅ | Remitente de emails |
| `ENCRYPTION_KEY` | ✅ | 32 chars for data encryption at rest |
| `WORKER_SECRET` | ✅ | Secret para endpoint de procesamiento de reportes |
| `NEXT_PUBLIC_APP_URL` | ✅ | URL pública de la app (ej. `http://localhost:5005`) |
| `OLLAMA_BASE_URL` | ⚪ | URL de Ollama (default `http://localhost:11434`) |
| `DISABLE_RATE_LIMIT` | ⚪ | `true` para desactivar rate limiting (solo tests) |
| `NEXT_PUBLIC_DISABLE_ONBOARDING` | ⚪ | `true` para desactivar el onboarding |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server en `:5005` |
| `npm run build` | Production build |
| `npm run start` | Production server en `:5005` |
| `npm run worker` | Supervisor del worker de reportes |
| `npm run test` | Unit/integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Prisma Studio |

## Arquitectura

- **Next.js 16.2.10** App Router, API Routes
- **React 19** con Server Components y Client Components
- **Prisma 5.22.0** + PostgreSQL 16 + pgvector
- **JWT manual** (`jose` + `bcryptjs`) en httpOnly cookies
- **Resend** para emails transaccionales y alertas
- **Vitest** + jsdom para tests unitarios/integración
- **Playwright** para tests E2E
- **Ollama** local para clasificación (`ornith:9b`) y embeddings (`nomic-embed-text`)

## Estructura del proyecto

```text
src/app/api/       # API endpoints (route.ts por método)
src/app/           # Páginas y layouts
src/components/    # React components
src/lib/           # Utilidades (auth, prisma, errors, cache, email, audit, scoring)
prisma/            # Schema, migraciones y seed
specs/             # Especificaciones de features (Spec Kit)
.specify/          # Configuración y plantillas de Spec Kit
```

## Metodología

Este proyecto usa **Spec-Driven Development** con [GitHub Spec Kit](https://github.com/github/spec-kit). Cada feature tiene su directorio en `specs/###-feature/` con:

- `spec.md` — requisitos, user stories y criterios de aceptación.
- `plan.md` — contexto técnico y estructura.
- `tasks.md` — tareas ejecutables organizadas por fase.
- `checklists/requirements.md` — lista de verificación.
- `contracts/` — contratos de APIs o funciones internas.

La feature activa se indica en `.specify/feature.json`.

## Gate de calidad

Antes de considerar una fase cerrada se ejecuta:

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
npx tsc --noEmit
```

## Quickstart

- Ver `specs/001-multi-role-auth-config/quickstart.md` para escenarios de autenticación.
- Ver `specs/02-reportes-comunitarios/quickstart.md` para escenarios del módulo de reportes.
