# Gesmovil · Plataforma de Gestión y Control

Rediseño arquitectónico del sistema Gesmovil / Sicov, construido desde cero con
identidad visual propia y stack moderno. Preserva las entidades, reglas de negocio
y flujos del sistema actual (despachos, llegadas, mantenimientos, novedades,
proveedores vigilados, integradora) sin reutilizar código heredado.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite + TypeScript · sistema de diseño propio (sin plantillas) |
| Datos (front) | TanStack Query + React Router |
| Backend | NestJS 10 + TypeScript |
| ORM / BD | Prisma · SQLite (dev) / PostgreSQL 16 (prod) |
| Auth | JWT (Passport) · login interno y Vigía |
| Colas | Procesador en proceso (dev) → BullMQ + Redis (prod) |
| Integraciones | Capa única con stubs (Supertransporte, Vigía, integradora) |

## Estructura

```
plataforma/
├── api/          Backend NestJS + Prisma
│   ├── prisma/   Esquema del dominio + seed con datos demo
│   └── src/      auth, despachos, llegadas, mantenimientos, catalogos,
│                 usuarios, dashboard, colas, integraciones
├── web/          Frontend React + Vite (diseño propio)
│   └── src/      auth, api (cliente), ui (diseño+iconos), app (layout), pages
└── docker-compose.yml   Postgres + Redis para producción
```

## Cómo ejecutar (desarrollo, sin dependencias externas)

### 1. Backend (puerto 5050)
```bash
cd api
npm install
npm run setup      # genera Prisma, crea la BD SQLite y siembra datos demo
npm run dev        # arranca la API en http://localhost:5050/api/v1
```

### 2. Frontend (puerto 4300)
```bash
cd web
npm install
npm run dev        # http://localhost:4300  (proxy /api -> :5050)
```

Si el backend no está arriba, el frontend cae automáticamente a datos demo
locales para poder previsualizar la interfaz.

### Credenciales demo
`admin / admin` (administrador) · `operador / operador` · `cliente / cliente`

## Pasar a PostgreSQL (producción)

1. `docker compose up -d` (Postgres + Redis).
2. En `api/prisma/schema.prisma` cambiar `provider = "sqlite"` → `"postgresql"`.
3. En `api/.env` poner el `DATABASE_URL` de Postgres.
4. `npm run setup` para migrar y sembrar.

## Conectar integraciones reales

La capa `src/integraciones/integraciones.service.ts` centraliza el contacto con
Supertransporte / Vigía / integradora. Con `INTEGRACIONES_MODO=real` en `.env` se
activan los `fetch` reales (pendientes de credenciales) sin tocar la UI ni las colas.

## Seguridad — pendientes heredados del sistema actual

- Aislar secretos en gestor propio y **rotar** todas las claves antes de desplegar.
- Restringir CORS (hoy abierto en dev), servir tras TLS y detrás de dominio propio.
- Los datos de este repo son **demo**; no contiene secretos vivos.
