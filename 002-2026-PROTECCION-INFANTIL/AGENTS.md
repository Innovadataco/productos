# AGENTS.md — Producto 002 (Protección Infantil)

Archivo de referencia para agentes de IA que trabajen en este repositorio. Asume que el lector no conoce el proyecto.

## Qué es

SaaS de reportes comunitarios de riesgos para menores (Innovadataco): la comunidad reporta conductas de riesgo asociadas a números telefónicos, nicks o perfiles; una IA local clasifica la conducta y, superado un umbral configurable, el identificador aparece en una consulta pública con estadísticas agregadas (nunca datos personales ni textos de reportes).

Trabajas dentro de esta carpeta (`002-2026-PROTECCION-INFANTIL`), repo `Innovadataco/productos`, rama `feature/001-scaffolding`. **Fase: DESARROLLO, no producción.** No desplegar a producción; eso lo decide el responsable.

## Restricciones de producto (no negociables)

Definidas en `.specify/memory/constitution.md`; tienen prioridad absoluta:

- **Solo texto**: prohibido subir, almacenar o procesar fotos, video, audio o cualquier multimedia. Los reportes son texto + identificador + metadatos contextuales.
- **Presunción de inocencia**: la consulta pública usa lenguaje descriptivo/estadístico ("N reportes registrados"), nunca veredictos ("número peligroso").
- **IA local**: los textos sensibles se procesan con Ollama local y nunca salen del servidor hacia APIs de terceros. La IA clasifica conductas, no genera scores de personas.
- **Canales oficiales**: toda interfaz de reporte muestra de forma visible Línea 141 ICBF, CAI Virtual y Te Protejo.
- **Disputas (Ley 1581 de 2012)**: el titular de un identificador puede solicitar revisión, anonimización o eliminación.
- **No modificar nunca el texto original de un reporte** (posible evidencia).

## Entorno

- App: puerto `5005`. Acceso remoto (Tailscale) requiere levantar con `-H 0.0.0.0`.
- Postgres (Docker): contenedor `002-2026-proteccion-infantil-db-1`, puerto `5433`, user `proteccion`, BD `proteccion_infantil` (imagen `pgvector/pgvector:pg16`, ver `docker-compose.yml`).
- Ollama: clasificación con `ornith:9b` (default), embeddings con `nomic-embed-text`.
- Runtime: Node.js >= 22.
- Variables de entorno requeridas (ver `.env.example` / README): `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `ENCRYPTION_KEY`, `WORKER_SECRET`, `NEXT_PUBLIC_APP_URL`. Secrets solo por variables de entorno, nunca en código.

## Stack técnico

- **Next.js 16.2.10** (App Router, API Routes exclusivos; no tRPC, no GraphQL) + **React 19** (Server Components por defecto, `"use client"` solo para interacción).
- **TypeScript 5** con `strict: true`.
- **Prisma 5.22.0** + PostgreSQL 16 + **pgvector** (embeddings). Singleton `PrismaClient` en `src/lib/prisma.ts`.
- **Auth manual**: JWT con `jose` + `bcryptjs` en cookie `httpOnly` (expira 24 h). No NextAuth/Auth.js. Fuente de verdad: `src/lib/auth.ts` (`verifyAuth`).
- **Colas asíncronas**: `pg-boss` sobre la misma PostgreSQL (singleton en `src/lib/queue.ts`).
- **Emails**: Resend (`resend`).
- **UI**: Tailwind CSS 3.4 como única fuente de estilos; mapas con Leaflet/react-leaflet; PDF con pdfmake; Excel con xlsx.
- **Tests**: Vitest + jsdom + Testing Library (no Jest); Playwright para E2E.
- **Lint**: ESLint 9 con `eslint-config-next` (sin Prettier).

## Comandos

- Build: `npm run build` · Tests: `npm run test` · Types: `npx tsc --noEmit` · Lint: `npm run lint` · E2E: `npm run test:e2e`
- Worker: `npm run worker` · Migraciones: `npm run db:migrate` · Seed: `npm run db:seed` · Studio: `npm run db:studio`
- Auditoría accesibilidad: `npm run a11y:audit`, `npm run a11y:contrast`
- **Reinicio/deploy limpio (usar SIEMPRE tras cada cambio): `./scripts/dev-restart.sh`** — hace `rm -rf .next`, build, mata app y workers viejos, levanta app (`-H 0.0.0.0`) + UN worker, healthcheck. Nunca dejar más de un worker.

## Arquitectura en runtime

Cinco capas (detalle completo en `docs/ARCHITECTURE.md`):

1. **UI/App Router** (`src/app/**`, `src/components/**`): páginas y layouts; los layouts de admin verifican rol antes de renderizar.
2. **API Routes** (`src/app/api/**/route.ts`): un `route.ts` por endpoint; validan entrada, autentican y delegan a servicios. Rutas de admin bajo `src/app/api/admin/**`.
3. **Servicios** (`src/lib/**`): lógica de negocio — `auth.ts`, `proxy.ts` (control de acceso por ruta/rol; no es middleware clásico de Next.js), `queue.ts`, `errors.ts` (`AppError` + códigos canónicos), `rate-limit.ts` (ventanas fijas en PostgreSQL, fail-open), `param-encryption.ts` (AES-256-GCM), `scoring.ts`, `visibility.ts`, `ai/` (classifier, embedder, anonimizador).
4. **Datos**: Prisma sobre PostgreSQL (`prisma/schema.prisma`, ~45 migraciones). Modelos principales: `Usuario`, `Tenant`/`Colegio`/`Curso`/`Alumno`, `Reporte`, `IdentificadorReportado`, `ClasificacionIA`, `ApelacionIdentificador`, `ParametroSistema`, `AuditLog`, `RateLimit`, embeddings y modelo SaaS (`Plan`, `Subscription`, `BillingCycle`).
5. **Workers** (`scripts/worker-reportes.mjs` + `worker-supervisor.mjs`): consumen la cola `reporte-procesamiento` de pg-boss, verifican salud de Ollama y llaman a `POST /api/reportes/procesar` con header `X-Worker-Secret`. Usan advisory lock de PostgreSQL: exactamente UN worker activo.

### Flujo de un reporte (resumen)

`POST /api/reportes` (anónimo o `PARENT`; validación Zod + rate limits; texto original cifrado con AES-256-GCM) → estado `PENDIENTE` → job pg-boss → worker → `POST /api/reportes/procesar` (embedding, RAG con ejemplos corregidos, deduplicación por similitud, clasificación con votos, detección de PII/doxing, anonimización) → estados finales: `CLASIFICADO`, `CORREGIDO`, `REVISION_MANUAL`, `POSIBLE_SPAM`, `DUPLICADO`, `REQUIERE_ANONIMIZACION` → revisión humana por `OPERADOR`/`ADMIN`/`COMITE_VALIDACION` → agregación en `IdentificadorReportado` y visibilidad pública según umbrales en `ParametroSistema` → `GET /api/consulta` devuelve solo estadísticas agregadas.

### Roles (`RolUsuario`)

`ADMIN` (plataforma), `SCHOOL_ADMIN` (su tenant), `OPERADOR` (reportes asignados), `COMITE_VALIDACION` (casos escalados), `PARENT` (usuario final), más acceso anónimo para reportar y consultar. Helpers en `src/lib/operadores/permisos.ts`. Multi-tenant: cada colegio es un `Tenant` aislado (`tenantId` en entidades de negocio); la consulta pública agrega todos los tenants sin identificar la fuente.

## Estructura del código

```text
src/app/            # Páginas (page.tsx), layouts y API Routes (api/**/route.ts)
src/components/     # modules/ (vistas de negocio), ui/, providers/
src/lib/            # Servicios: auth, proxy, queue, prisma, rate-limit, errors, ai/, operadores/, schemas/
prisma/             # schema.prisma, migrations/ (aditivas), seed.ts
scripts/            # workers, dev-restart.sh, evals de clasificador, auditorías
tests/e2e/          # Playwright
specs/              # Specs Spec-Kit (NNN-nombre/), una por feature
.specify/           # Config y memoria de Spec-Kit (constitution.md, feature.json)
docs/               # ARCHITECTURE.md, cierres, evidencia
```

## Convenciones de código

- Nombres: rutas API `route.ts`, páginas `page.tsx`, componentes PascalCase, hooks `useX`, utilidades camelCase, constantes SCREAMING_SNAKE_CASE, modelos Prisma PascalCase singular con tablas snake_case.
- TypeScript estricto: prohibido `any` y `as any` (usar `unknown` + type guards; si es inevitable, `// TODO(any): justificación`); `// @ts-expect-error` con justificación en vez de `@ts-ignore`; `const` siempre que se pueda.
- Filtros Prisma dinámicos tipados (`Prisma.ReporteWhereInput`, nunca `any`).
- Errores: `AppError` (`src/lib/errors.ts`) con códigos canónicos (400/401/403/404/409/413/429/500/502/503). Nunca exponer stack traces al cliente (`safeErrorMessage`).
- Paginación estándar en listas: `page`/`pageSize` (default 25, máx 100), respuesta `{ items, pagination }`.
- Validación: objetivo Zod (ya en `POST /api/reportes` y `GET /api/consulta`); texto de reporte máx 2000 chars, teléfonos E.164, rechazar URLs de imágenes/base64/multimedia.
- React: no `Math.random()` en render, no `setState` sincrónico en `useEffect`.
- Logs: formato `[Módulo] Acción: resultado — detalle`; `console.error/warn`; sin `console.log` de debug. Toda mutación crítica registra `AuditLog` (sin texto completo del reporte, solo metadatos).
- Mensajes de commit en español, imperativo; un cambio lógico = un commit.
- Tono NEUTRAL en textos de UI, sin voseo ("reporta/crea/verifica", no "reportá/creá/verificá").

## Testing

- **Vitest** (unitario/integración): tests junto al código (`src/lib/*.test.ts`, `src/app/api/**/route.test.ts`, `src/components/**/*.test.tsx`). Config en `vitest.config.ts`: jsdom, setup `src/lib/test-setup.ts`, alias `@` → `./src`, `fileParallelism: false` (los tests de integración comparten una única PostgreSQL, se ejecutan secuencialmente). Se corren con `.env.test` (`node --env-file=.env.test`).
- Patrón de test de API: importar el handler (`POST`, `GET`...) del `route.ts` y llamarlo con `Request` nativo; seed en `beforeAll`, cleanup + `prisma.$disconnect()` en `afterAll`. Todo endpoint CRUD nuevo debe traer su `.test.ts`.
- **Playwright** (E2E): `tests/e2e/`, `baseURL http://localhost:5005`, levanta `npm run dev` con `DISABLE_RATE_LIMIT=true` y `NEXT_PUBLIC_DISABLE_ONBOARDING=true`.
- Gate de calidad antes de cerrar trabajo: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build` + `./scripts/dev-restart.sh`.

## Seguridad

- Cifrado en reposo del texto original del reporte con AES-256-GCM (`src/lib/param-encryption.ts`); claves solo en variables de entorno.
- Rate limiting en PostgreSQL con scopes configurables vía `ParametroSistema` (`ratelimit.{scope}.*`); fail-open con log si el limitador falla.
- Headers de seguridad en `next.config.ts` (CSP, X-Frame-Options, etc.); HSTS y `upgrade-insecure-requests` solo con `ENABLE_HTTPS_HEADERS=true`.
- Cookies `httpOnly`, `secure` en HTTPS, `SameSite`; JWT de 24 h.
- Audit logs y logs de aplicación nunca incluyen texto completo de reportes.

## Metodología: Spec-Kit (Spec-Driven Development)

Flujo obligatorio por feature: **specify → clarify → plan → tasks → analyze → implement → validate → close**. Si no hay slash commands nativos, lee y ejecuta como instrucciones los archivos `.clinerules/workflows/speckit-*.md`. Respeta `.specify/memory/constitution.md`.

Cada spec vive en `specs/NNN-nombre/` con el MISMO set y formato que `specs/001-multi-role-auth-config/`: `spec.md` (User Stories con Priority + Acceptance Scenarios + Edge Cases; Functional Requirements "FR-XXX: El sistema DEBE..."; Success Criteria; Assumptions; sección Implementación al cerrar), `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/` (si hay endpoints), `checklists/requirements.md`, `tasks.md` (fases + `TNNN [P]` con ruta de archivo, orden por dependencias, TDD donde aplique). La feature activa se indica en `.specify/feature.json`.

### Valores canónicos de Status (encabezado de cada spec)

`PLANEADO` → `DESARROLLO` → `IMPLEMENTADO` → `PENDIENTE DE PRUEBA` → `FINALIZADO` → `CERRADA`.

## Reglas de cierre (las 5, ninguna se salta)

1. Spec-Kit completo (todos los artefactos + checklist validado).
2. commit + push a `feature/001-scaffolding`: un commit por User Story + uno de docs, con evidencia (git log + archivos tocados).
3. Deploy limpio con `./scripts/dev-restart.sh`.
4. Probar con el `quickstart.md`.
5. Documentar: `cierre.md` (en `specs/NNN/` o histórico en `docs/cierre-NNN.md`) + sección Implementación en `spec.md` + deuda técnica.

## Reglas de oro

- Migraciones SIEMPRE aditivas y NO destructivas. Nunca `prisma migrate reset` ni nada que borre datos.
- Nunca confiar en una build sin `rm -rf .next` antes (aparecen builds viejas).
- Un solo worker a la vez (el advisory lock hace que un segundo worker termine con código 2).
- No cerrar hasta completar TODAS las tareas del prompt y todos los artefactos.
- Reporte final CONCISO, sin gastar tokens.
- Setup inicial: `cp .env.example .env`, `docker compose up -d db`, `npm install`, `npx prisma migrate dev`, `npx prisma db seed`, `npm run dev`.
