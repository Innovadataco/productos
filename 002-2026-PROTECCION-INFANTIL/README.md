# 002-2026-PROTECCION-INFANTIL

Sistema de reportes comunitarios de protección infantil. Fase fundacional: autenticación multi-rol y parámetros de configuración.

## Setup

```bash
cp .env.example .env
docker compose up -d db
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Min 32 chars, never committed |
| `RESEND_API_KEY` | ✅ | Resend API key for transactional email |
| `ENCRYPTION_KEY` | ✅ | 32 chars for data encryption at rest |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run test` | Run tests |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Prisma Studio |

## Architecture

- **Next.js 16.2.10** App Router, API Routes
- **Prisma 5.22.0** + PostgreSQL 16
- **JWT manual** (`jose` + `bcryptjs`) in httpOnly cookies
- **Resend** for transactional emails
- **Vitest** + jsdom for testing

## Project Structure

```
src/app/api/       # API endpoints (route.ts per method)
src/components/    # React components
src/lib/           # Utilities (auth, prisma, errors, cache, email, audit)
prisma/            # Schema and migrations
```

## Quickstart Validation

See `specs/001-multi-role-auth-config/quickstart.md` for curl-based end-to-end scenarios.