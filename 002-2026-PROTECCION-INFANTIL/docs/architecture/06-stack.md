> GENERADO por `scripts/arch/generar-stack.ts` — no editar a mano.
> Fuentes: `package.json`, `Dockerfile`, `docker-compose.prod.yml`, `docker-compose.yml`.
> Regenerar: `npx tsx scripts/arch/generar-stack.ts` (o `npm run arch:check` para verificar).

# 06 · Stack, contenedores y puertos

Paquete: `002-2026-proteccion-infantil`. Runtime: Node (sin engines declarado).
Valores de secretos NUNCA se documentan aquí: solo nombres de variables y puertos.

## Dependencias de runtime (package.json)

| Dependencia | Versión |
| --- | --- |
| @prisma/client | 5.22.0 |
| bcryptjs | ^3.0.2 |
| jose | ^6.0.10 |
| leaflet | ^1.9.4 |
| next | 16.2.10 |
| pdfmake | ^0.3.11 |
| pg-boss | ^12.26.0 |
| prisma | 5.22.0 |
| react | 19.2.4 |
| react-dom | 19.2.4 |
| react-leaflet | ^5.0.0 |
| resend | ^4.5.0 |
| tailwindcss | ^3.4.17 |
| tsx | ^4.19.4 |
| xlsx | ^0.18.5 |
| zod | ^4.4.3 |

## Dependencias de desarrollo (package.json)

| Dependencia | Versión |
| --- | --- |
| @playwright/test | ^1.61.1 |
| @testing-library/react | ^16.3.0 |
| @types/bcryptjs | ^2.4.6 |
| @types/leaflet | ^1.9.21 |
| @types/node | ^22.15.17 |
| @types/pdfmake | ^0.3.3 |
| @types/react | ^19.0.12 |
| @types/react-dom | ^19.0.5 |
| @vitejs/plugin-react | ^4.5.2 |
| autoprefixer | ^10.4.21 |
| eslint | ^9.26.0 |
| eslint-config-next | 16.2.10 |
| jsdom | ^26.1.0 |
| postcss | ^8.5.6 |
| typescript | ^5.8.3 |
| vitest | ^3.2.3 |

## Scripts npm (package.json)

| Script | Comando |
| --- | --- |
| `a11y:audit` | `node scripts/a11y_audit.js` |
| `a11y:contrast` | `node scripts/contrast_check.js` |
| `arch:check` | `tsx scripts/arch/arch-check.ts` |
| `build` | `next build` |
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate deploy` |
| `db:seed` | `tsx prisma/seed.ts` |
| `db:studio` | `prisma studio` |
| `db:verify:hnsw` | `tsx scripts/verify-hnsw-indexes.ts` |
| `dev` | `next dev -p 5005` |
| `lint` | `eslint .` |
| `start` | `next start -p 5005` |
| `test` | `node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run` |
| `test:e2e` | `node --env-file=.env.test ./node_modules/@playwright/test/cli.js test` |
| `test:e2e:ui` | `node --env-file=.env.test ./node_modules/@playwright/test/cli.js test --ui` |
| `test:watch` | `node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs` |
| `worker` | `node scripts/worker-supervisor.mjs` |

## Imagen de producción (Dockerfile)

Etapas: node:22-alpine (etapa `deps`) → node:22-alpine (etapa `builder`) → node:22-alpine (etapa `prod`) → node:22-alpine (etapa `runner`).
Puertos expuestos: 3000.
Comando por defecto: `["node", "server.js"]`.

## Contenedores y puertos

### Desarrollo (`docker-compose.yml`)

| Servicio | Imagen / build | Contenedor | Puertos (host:interno) |
| --- | --- | --- | --- |
| db | `pgvector/pgvector:pg16` | — | 5433:5432 |

### Producción (`docker-compose.prod.yml`)

| Servicio | Imagen / build | Contenedor | Puertos (host:interno) |
| --- | --- | --- | --- |
| app | `pi-app:${PI_APP_TAG:-latest}` (+ build local) | `pi-app` | — |
| db | `pgvector/pgvector:pg16` | `pi-db` | — |
| worker | `pi-app:${PI_APP_TAG:-latest}` | `pi-worker` | — |
