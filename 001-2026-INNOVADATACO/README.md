# 001-2026-INNOVADATACO — Plataforma Core

Aplicación frontend de la Plataforma Operativa Innovadataco.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL

## Scripts

```bash
npm install
npm run dev      # Puerto 3000
npm run build
npm start        # Puerto 3000
```

## Variables de entorno

Copiar `.env.example` a `.env.local` y ajustar los valores.

```bash
cp .env.example .env.local
```

## Post-Migración / Reset de Base de Datos

Tras cualquier migración o reset de la base de datos PostgreSQL, ejecutar:

```bash
npm install
npx prisma migrate deploy
node scripts/seedApis.mjs
```

Esto asegura que el catálogo de APIs (`AgentApi`) esté poblado correctamente.

## Gobierno

Desarrollado bajo contrato ODIN / Fábrica de Software ZEUS.