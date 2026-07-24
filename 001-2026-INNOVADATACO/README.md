# 001-2026-INNOVADATACO — Plataforma Core

Aplicación frontend de la Plataforma Operativa Innovadataco.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL

## Modos de ejecución

| Modo | Cuándo | Cómo |
|---|---|---|
| **PM2** (`ecosystem.config.js`) | Desarrollo en la Mac | `npm run start:all` (dev-server + worker supervisados). La BD corre en docker: `docker compose up -d db` → `localhost:5435`. |
| **Docker compose sobre Colima** | Producción / VPS | `docker compose up -d --build` levanta app (5001) + worker (pg-boss) + BD (5435). |

**Migración a VPS (ADR_001)**: clonar el repo + copiar `.env` + `docker compose up -d`.
Nada más: la infraestructura completa (app, worker, BD) está declarada en
`docker-compose.yml`.

**Puertos (ADR_002)**: a este proyecto le pertenecen **5001** (app) y **5435** (BD).
Los puertos 5005/5433 (Protección Infantil) y 5010/5434 (SICOV) son de otros
productos y son **intocables**. Si algo falla por conflicto de puertos: detenerse y
reportar; jamás liberar puertos ajenos.

## Levantar el entorno de desarrollo (forma oficial)

Una sola terminal supervisa ambos procesos (dev server + worker). Si alguno muere, PM2 lo reinicia automáticamente:

```bash
npm run start:all   # Levanta dev-server + worker con PM2
npm run status      # Ver estado de los procesos
npm run logs        # Ver logs en tiempo real
npm run stop:all    # Detener todos los procesos
```

**Requiere PM2 instalado** (se instala como devDependency: `npm install -D pm2`).

### Arranque limpio de la base de datos

Este es el procedimiento completo tras crear o **recrear el volumen**. Omitir el
seed deja la aplicación accesible pero inservible: sin entidades ni estados de
licitación, sin catálogo de APIs y sin modelos de IA.

```bash
docker compose up -d db          # 1. Levantar la base (puerto host 5435)
npx prisma migrate deploy        # 2. Aplicar migraciones
npm run init-pgboss              # 3. Crear las tablas de pg-boss
npm run seed                     # 4. Sembrar los catálogos base
node scripts/seedUser.mjs        # 5. Crear el usuario administrador
```

`npm run seed` es **idempotente y no destructivo**: se puede ejecutar las veces que
haga falta y no pisa la configuración hecha desde la interfaz (una API desactivada,
un estado renombrado). Siembra `LicitacionStatus`, `TipoOportunidad`,
`EntidadLicitacion`, `AgentApi` y un `AiModel` de referencia (inactivo: activarlo es
decisión del operador).

## Variables de entorno

Copiar `.env.example` a `.env` y ajustar los valores (`.env` es el archivo
canónico: lo leen docker compose, Next.js y el worker; jamás se commitea).

```bash
cp .env.example .env
```

Notas:
- Credenciales de BD: una sola verdad en el trío `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`.
  El compose deriva de ahí el `DATABASE_URL` interno (`db:5432`); el `DATABASE_URL`
  de `.env` (con `localhost:5435`) es para herramientas fuera de docker (PM2, prisma CLI).
- `OLLAMA_BASEURL`: dejar vacío ⇒ en compose se usa `http://host.docker.internal:11434`
  y en dev el fallback del código es `http://localhost:11434`. El valor configurado
  en BD/UI (módulo Configuración) siempre tiene precedencia (FR-010).
- `.env.local` sigue funcionando como override opcional de desarrollo.

## Post-Migración / Reset de Base de Datos

Tras cualquier migración o reset de la base de datos PostgreSQL, ejecutar:

```bash
npm install
npx prisma migrate deploy
npm run init-pgboss      # Re-crear tablas de pg-boss
npm run seed             # Re-sembrar catálogos (idempotente)
```

Esto asegura que el catálogo de APIs (`AgentApi`) y la cola pg-boss estén poblados correctamente.

## Gobierno

Desarrollado bajo contrato ODIN / Fábrica de Software ZEUS.