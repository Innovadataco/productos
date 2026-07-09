# 001-2026-INNOVADATACO — Plataforma Core

Aplicación frontend de la Plataforma Operativa Innovadataco.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL

## Levantar el entorno de desarrollo (forma oficial)

Una sola terminal supervisa ambos procesos (dev server + worker). Si alguno muere, PM2 lo reinicia automáticamente:

```bash
npm run start:all   # Levanta dev-server + worker con PM2
npm run status      # Ver estado de los procesos
npm run logs        # Ver logs en tiempo real
npm run stop:all    # Detener todos los procesos
```

**Requiere PM2 instalado** (se instala como devDependency: `npm install -D pm2`).

**Setup inicial de la base de datos** (solo una vez):

```bash
npx prisma migrate deploy
npm run init-pgboss   # Crea tablas de pg-boss en PostgreSQL
node scripts/seedApis.mjs
node scripts/seedUser.mjs
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
npm run init-pgboss      # Re-crear tablas de pg-boss
node scripts/seedApis.mjs
```

Esto asegura que el catálogo de APIs (`AgentApi`) y la cola pg-boss estén poblados correctamente.

## Gobierno

Desarrollado bajo contrato ODIN / Fábrica de Software ZEUS.