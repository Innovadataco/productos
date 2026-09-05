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
| @react-pdf/renderer | ^4.6.0 |
| bcryptjs | ^3.0.2 |
| date-fns | ^4.4.0 |
| date-fns-tz | ^3.2.0 |
| exceljs | ^4.4.0 |
| jose | ^6.0.10 |
| leaflet | ^1.9.4 |
| lucide-react | 1.28.0 |
| next | 16.2.10 |
| pdfmake | ^0.3.11 |
| pg-boss | ^12.26.0 |
| prisma | 5.22.0 |
| react | 19.2.4 |
| react-dom | 19.2.4 |
| react-leaflet | ^5.0.0 |
| react-markdown | ^10.1.0 |
| recharts | 3.10.1 |
| remark-gfm | ^4.0.1 |
| resend | ^4.5.0 |
| tailwindcss | ^3.4.17 |
| tsx | ^4.19.4 |
| zod | ^4.4.3 |

## Dependencias de desarrollo (package.json)

| Dependencia | Versión |
| --- | --- |
| @playwright/test | ^1.61.1 |
| @tailwindcss/typography | ^0.5.20 |
| @testing-library/react | ^16.3.0 |
| @types/bcryptjs | ^2.4.6 |
| @types/leaflet | ^1.9.21 |
| @types/node | ^22.15.17 |
| @types/pdfmake | ^0.3.3 |
| @types/react | ^19.0.12 |
| @types/react-dom | ^19.0.5 |
| @vitejs/plugin-react | ^4.5.2 |
| @vitest/coverage-v8 | ^3.2.7 |
| autoprefixer | ^10.4.21 |
| eslint | ^9.26.0 |
| eslint-config-next | 16.2.10 |
| jsdom | ^26.1.0 |
| postcss | ^8.5.6 |
| typescript | ^5.8.3 |
| vitest | ^3.2.3 |
| wtfnode | ^0.10.1 |

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
| `db:verify:hnsw` | `npm run indices:check` |
| `dev` | `next dev -p 5005` |
| `indices:check` | `tsx scripts/verify-hnsw-indexes.ts` |
| `lint` | `eslint .` |
| `locks:check` | `tsx scripts/locks-check.ts` |
| `ratchets:check` | `npm run ratchets:no-x-invoke-path && npm run ratchets:no-redirect-layout && npm run ratchets:no-self-redirect && npm run ratchets:guardia-invariante && npm run ratchets:no-usd-vistas && npm run ratchets:no-unref-timer` |
| `ratchets:guardia-invariante` | `tsx scripts/lint/guardia-invariante.ts` |
| `ratchets:no-redirect-layout` | `tsx scripts/lint/no-redirect-en-layout-de-dashboard.ts` |
| `ratchets:no-self-redirect` | `tsx scripts/lint/no-self-redirect-server-actions.ts` |
| `ratchets:no-unref-timer` | `tsx scripts/lint/no-unref-timer-nuevo.ts` |
| `ratchets:no-usd-vistas` | `tsx scripts/lint/no-usd-en-vistas-suscripcion.ts` |
| `ratchets:no-x-invoke-path` | `tsx scripts/lint/no-x-invoke-path.ts` |
| `reglas:check` | `tsx scripts/verify-reglas-notificacion.ts` |
| `start` | `next start -p 5005` |
| `test` | `node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run` |
| `test:coverage` | `npm run test:unit && npm run test:integration` |
| `test:e2e` | `node --env-file=.env.test ./node_modules/@playwright/test/cli.js test` |
| `test:e2e:ui` | `node --env-file=.env.test ./node_modules/@playwright/test/cli.js test --ui` |
| `test:integration` | `node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run --coverage.enabled` |
| `test:journeys` | `node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run --config vitest.journeys.config.ts` |
| `test:unit` | `node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run --config vitest.unit.config.ts --coverage.enabled` |
| `test:watch` | `node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs` |
| `tokens:check` | `tsx scripts/tokens-check.ts` |
| `worker` | `node --import tsx scripts/worker-supervisor.mjs` |
| `worker:notificaciones` | `node --import tsx scripts/worker-notificaciones.mjs` |
| `worker:sesiones` | `node --import tsx scripts/worker-sesiones.mjs` |

## Imagen de producción (Dockerfile)

Etapas: node:22-alpine (etapa `deps`) → node:22-alpine (etapa `builder`) → node:22-alpine (etapa `prod`) → node:22-alpine (etapa `runner`).
Puertos expuestos: 3000.
Comando por defecto: `["node", "server.js"]`.

## Contenedores y puertos

### Desarrollo (`docker-compose.yml`)

| Servicio | Imagen / build | Contenedor | Puertos (host:interno) |
| --- | --- | --- | --- |
| app | build local (Dockerfile) | `pi-app-dev` | 5005:3000 |
| db | `pgvector/pgvector:pg16` | — | 5433:5432 |
| pi-sesiones | build local (Dockerfile) | `pi-sesiones-dev` | — |
| pi-verificacion-vencimiento | build local (Dockerfile) | `pi-verificacion-vencimiento-dev` | — |
| pi-vigencia | build local (Dockerfile) | `pi-vigencia-dev` | — |

### Producción (`docker-compose.prod.yml`)

| Servicio | Imagen / build | Contenedor | Puertos (host:interno) |
| --- | --- | --- | --- |
| app | `pi-app:${PI_APP_TAG:-latest}` (+ build local) | `pi-app` | — |
| db | `pgvector/pgvector:pg16` | `pi-db` | — |
| monitor | `pi-app:${PI_APP_TAG:-latest}` | `pi-monitor` | — |
| pi-analisis-expediente | `pi-app:${PI_APP_TAG:-latest}` | `pi-analisis-expediente` | — |
| pi-analisis-reglas | `pi-app:${PI_APP_TAG:-latest}` | `pi-analisis-reglas` | — |
| pi-analisis-score | `pi-app:${PI_APP_TAG:-latest}` | `pi-analisis-score` | — |
| pi-anomalias | `pi-app:${PI_APP_TAG:-latest}` | `pi-anomalias` | — |
| pi-expediente-motor | `pi-app:${PI_APP_TAG:-latest}` | `pi-expediente-motor` | — |
| pi-notificaciones | `pi-app:${PI_APP_TAG:-latest}` | `pi-notificaciones` | — |
| pi-senal-comunitaria | `pi-app:${PI_APP_TAG:-latest}` | `pi-senal-comunitaria` | — |
| pi-sesiones | `pi-app:${PI_APP_TAG:-latest}` | `pi-sesiones` | — |
| pi-verificacion-vencimiento | `pi-app:${PI_APP_TAG:-latest}` | `pi-verificacion-vencimiento` | — |
| pi-vigencia | `pi-app:${PI_APP_TAG:-latest}` | `pi-vigencia` | — |
| simulador-abuso | `pi-app:${PI_APP_TAG:-latest}` | `pi-simulador-abuso` | — |
| worker | `pi-app:${PI_APP_TAG:-latest}` | `pi-worker` | — |
