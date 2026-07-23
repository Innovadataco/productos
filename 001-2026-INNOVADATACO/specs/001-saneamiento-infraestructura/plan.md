# Implementation Plan: Saneamiento de infraestructura

**Branch**: `feature/001-scaffolding` (dir de spec: `001-saneamiento-infraestructura`) | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-saneamiento-infraestructura/spec.md` (Status: **Approved** por ZEUS y Jelkin, 2026-07-22)

## Summary

Sanear la infraestructura docker del proyecto 001 sin tocar nada ajeno: BD publicada
en el puerto host **5435** (el asignado por ADR_002), credenciales con una sola
fuente de verdad en `.env` (compose parametrizado, cero credenciales literales),
`OLLAMA_BASEURL` con default alcanzable desde contenedores
(`host.docker.internal:11434` + `extra_hosts`), servicio `worker` (pg-boss) dentro
del compose para que VPS = `repo + .env + docker compose up` (ADR_001), y README
documentando PM2 (dev en Mac) vs docker compose sobre Colima (producción/VPS).

**Enfoque técnico**: solo archivos de configuración e infraestructura
(`docker-compose.yml`, `Dockerfile`, `.env.example`, `README.md`, `.env` local no
commiteado). Cero cambios de lógica de aplicación, esquema o migraciones.

## Technical Context

**Language/Version**: Node.js >= 22 (imagen `node:22-alpine`); TypeScript 5.x

**Primary Dependencies**: Next.js 16.2.10, Prisma 5.22.0, pg-boss 12.25.1, tsx 4.x (ejecuta `scripts/worker.mjs`, que importa módulos `.ts` de `src/lib/`)

**Storage**: PostgreSQL 16 + pgvector (imagen `pgvector/pgvector:pg16`), volumen existente `innovadataco_db_data`

**Testing**: Vitest (suite existente debe seguir verde; esta spec no modifica rutas API → no requiere tests nuevos; la validación de infra es `docker compose config` + quickstart)

**Target Platform**: Mac Studio (Colima) hoy; VPS Linux (docker compose) mañana

**Project Type**: Web app (Next.js App Router) + worker de cola — cambio de infraestructura compose

**Performance Goals**: N/A (cambio de configuración; sin metas de rendimiento)

**Constraints**: Puertos permitidos SOLO 5001 (app) y 5435 (BD). Puertos 5005/5433/5010/5434 INTOCABLES. Sin trabajo pesado (inferencia) sin turno aprobado por Jelkin (ADR_002). `.env` jamás en git.

**Scale/Scope**: 4 archivos versionados a modificar + 1 archivo local (`.env`); 3 servicios compose (app, worker, db)

## Constitution Check

*GATE inicial y re-check post-diseño: PASS (sin violaciones).*

| Principio | Evaluación |
|---|---|
| §0.1 Spec-driven | ✅ Spec aprobada por ZEUS y Jelkin (2026-07-22). Este plan no implementa nada. |
| §0.2 Pruebas | ✅ No se crea/modifica ninguna ruta API → no se exige test Vitest nuevo. Gate de commit de la implementación: suite existente verde + `docker compose config` válido. |
| §0.3 Tipado estricto | ✅ N/A — no se toca código TypeScript. |
| §0.4 12-factor (ADR_001) | ✅ Es el corazón de la spec: config por `.env`, secretos fuera del repo, infra en compose, VPS = repo + .env + compose up. |
| §0.5 Aislamiento (ADR_002) | ✅ Solo puertos 5001/5435. Verificación explícita (snapshot antes/después) de que 5005/5433/5010/5434 no cambian. Nada fuera de `001-2026-INNOVADATACO/`. |
| §0.6 IA local por defecto | ✅ Ollama sigue siendo el default; solo se corrige su alcanzabilidad desde contenedores. |

## Project Structure

### Documentation (this feature)

```text
specs/001-saneamiento-infraestructura/
├── spec.md              # Aprobada (ZEUS + Jelkin, 2026-07-22)
├── plan.md              # Este archivo
├── research.md          # Fase 0 — decisiones técnicas y hallazgos
├── quickstart.md        # Fase 1 — guía de validación end-to-end
└── tasks.md             # Fase 2 — /speckit-tasks
```

`data-model.md` y `contracts/` se omiten deliberadamente: la feature es 100%
infraestructura/configuración; no introduce entidades de datos ni interfaces
nuevas (justificación en research.md, D-08).

### Source Code (repository root)

Archivos a tocar en la implementación (NINGUNO se modifica en esta fase de plan):

```text
001-2026-INNOVADATACO/
├── docker-compose.yml    # MODIFICAR — puerto 5435, credenciales por .env, ollama default, servicio worker
├── Dockerfile            # MODIFICAR — `npx prisma generate` en stage builder (prerrequisito de build/worker)
├── .env.example          # MODIFICAR — POSTGRES_*, DATABASE_URL:5435, OLLAMA_BASEURL documentado
├── .env                  # CREAR local (NO commitear — ya está en .gitignore)
└── README.md             # MODIFICAR — sección "Modos de ejecución": PM2 dev vs compose prod/VPS
```

**Structure Decision**: proyecto único existente; no se crean directorios nuevos de
código. Los únicos artefactos nuevos versionados son los documentos de la spec.

## Cambios exactos por archivo

### 1. `docker-compose.yml` (FR-001, FR-002, FR-003, FR-004, FR-006, FR-007)

Contenido objetivo completo:

```yaml
services:
  app:
    build: .
    ports:
      - "5001:5001"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:?Definir POSTGRES_USER en .env}:${POSTGRES_PASSWORD:?Definir POSTGRES_PASSWORD en .env}@db:5432/${POSTGRES_DB:?Definir POSTGRES_DB en .env}?schema=public
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      JWT_SECRET: ${JWT_SECRET}
      OPENAI_APIKEY: ${OPENAI_APIKEY}
      OLLAMA_BASEURL: ${OLLAMA_BASEURL:-http://host.docker.internal:11434}
    extra_hosts:
      - "host.docker.internal:host-gateway"
    depends_on:
      - db
    volumes:
      - ./uploads:/app/uploads

  worker:
    build:
      context: .
      target: builder
    command: npx tsx scripts/worker.mjs
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      OPENAI_APIKEY: ${OPENAI_APIKEY}
      OLLAMA_BASEURL: ${OLLAMA_BASEURL:-http://host.docker.internal:11434}
    extra_hosts:
      - "host.docker.internal:host-gateway"
    depends_on:
      - db

  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: ${POSTGRES_USER:?Definir POSTGRES_USER en .env}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Definir POSTGRES_PASSWORD en .env}
      POSTGRES_DB: ${POSTGRES_DB:?Definir POSTGRES_DB en .env}
    ports:
      - "5435:5432"
    volumes:
      - innovadataco_db_data:/var/lib/postgresql/data

volumes:
  innovadataco_db_data:
```

Puntos clave:
- `"5435:5432"` — único puerto de BD publicado; 5001 se mantiene; ningún otro puerto aparece en el archivo (FR-001).
- `${VAR:?mensaje}` en credenciales — compose falla explícito si `.env` falta o está incompleto (edge case de la spec) (FR-002).
- `DATABASE_URL` interno se **compone** desde el trío `POSTGRES_*` → imposible que diverja de la BD (FR-003, FR-004).
- `OLLAMA_BASEURL` con default `host.docker.internal:11434` y `extra_hosts: host-gateway`; un valor explícito en `.env` tiene precedencia (FR-006).
- Servicio `worker`: mismo Dockerfile con `target: builder` (ver D-04 en research.md), `command` propio, sin `ports`, `depends_on: db` (FR-007).
- Volumen `innovadataco_db_data` sin cambios (Key Entities de la spec).

### 2. `Dockerfile` (habilitador de FR-007 y del build de `app`)

> **Desviación aplicada (implementación 2026-07-22, aprobada por ZEUS)**: además del
> `prisma generate` previsto aquí, hizo falta `RUN apk add --no-cache openssl` en el
> stage `base`. Sin él, Prisma carga el engine `openssl-1.1.x` (inexistente en Alpine)
> y el worker entra en bucle de reinicio. Detalle en research.md → D-12 / H-04.

Cambio previsto en el plan, en el stage `builder`, antes de `RUN npm run build`:

```dockerfile
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate        # ← LÍNEA NUEVA
RUN npm run build
```

Justificación (research.md, D-05): el stage `deps` corre `npm ci` sin
`prisma/schema.prisma` presente, por lo que el postinstall de `@prisma/client` no
puede generar el cliente; sin `prisma generate` en `builder`, tanto `next build`
como el worker (que instancia `PrismaClient`) fallarían. El cliente generado queda
dentro de `node_modules` y llega al stage `runner` por el `COPY` existente.

### 3. `.env.example` (FR-005)

Contenido objetivo:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5001

# --- PostgreSQL (única fuente de verdad de credenciales; compose los lee de aquí) ---
POSTGRES_USER=idc_admin
POSTGRES_PASSWORD=cambiar_esta_clave
POSTGRES_DB=innovadataco_001

# Dev fuera de docker (PM2): host localhost, puerto 5435.
# Dentro de compose NO se usa esta variable: el compose deriva db:5432 del trío POSTGRES_*.
DATABASE_URL=postgresql://idc_admin:cambiar_esta_clave@localhost:5435/innovadataco_001?schema=public

OPENAI_APIKEY=

# Vacío => dentro de compose aplica el default http://host.docker.internal:11434.
# En dev fuera de docker el fallback del sistema es http://localhost:11434.
OLLAMA_BASEURL=

ENCRYPTION_KEY=
JWT_SECRET=
ALLOWED_DEV_ORIGIN=
```

- Credenciales canónicas: `idc_admin` / BD `innovadataco_001` (Assumption aprobada
  en la spec); contraseña real SOLO en `.env` local, placeholder en el example.
- Se crea `.env` local copiando el example y poniendo la contraseña real
  (`.env` ya está en `.gitignore`; verificación `git check-ignore .env` en tasks).

### 4. `README.md` (FR-008)

Añadir sección **"Modos de ejecución"** (y ajustar la instrucción de copia de env):

- **PM2 = desarrollo en Mac**: `npm run start:all` (dev-server + worker
  supervisados, `ecosystem.config.js`), BD del compose en `localhost:5435`.
- **Docker compose sobre Colima = producción/VPS**: `docker compose up -d`
  levanta app (5001) + worker + BD (5435). Migración a VPS = clonar repo +
  copiar `.env` + `docker compose up -d` (ADR_001).
- Actualizar `cp .env.example .env.local` → `cp .env.example .env` (compose lee
  `.env` por convención; el worker ya lee `.env` y `.env.local`; `.env.local`
  queda como override opcional de desarrollo).
- Nota de puertos: 5001/5435 propios; 5005/5433/5010/5434 pertenecen a otros
  productos y son intocables.

## Orden de aplicación (implementación futura)

1. **Snapshot de aislamiento** (pre): guardar estado de puertos 5005/5433/5010/5434
   (`lsof -nP -iTCP:5005 -iTCP:5433 -iTCP:5010 -iTCP:5434 -sTCP:LISTEN` y
   `docker ps` filtrado) → evidencia base para SC-003.
2. `.env.example` + crear `.env` local (base de configuración; nada la consume aún).
3. `docker-compose.yml` (puerto, credenciales, ollama, worker).
4. `Dockerfile` (prisma generate).
5. `README.md`.
6. **Verificación estática** (sin levantar contenedores): `docker compose config`
   con `.env` presente (renderiza) y sin `.env` (falla explícito con `:?`).
7. Levantar stack y validar según quickstart.md (SC-002, SC-005, SC-006 —
   SC-006 completo requiere turno aprobado, ver nota ADR_002).
8. **Snapshot de aislamiento** (post): comparar con (1) → SC-003.

## Verificación por requisito

| FR | Cómo se verifica |
|---|---|
| FR-001 | `docker compose config` renderizado: `db` publica `5435:5432`; grep confirma que 5432/5005/5433/5010/5434 no aparecen como puertos publicados. |
| FR-002 | Grep de `docker-compose.yml`: cero credenciales literales; `docker compose config` sin `.env` → error `:?`; con `.env` → renderiza los valores del `.env`. |
| FR-003 | Los `DATABASE_URL` de `app`/`worker` renderizados contienen exactamente `POSTGRES_USER/PASSWORD/DB` del `.env`; no queda referencia a `innova`/`innova` viejos en archivos de 001. |
| FR-004 | Render interno = `@db:5432`; `.env` local/example = `@localhost:5435`; mismas credenciales en ambos. |
| FR-005 | Diff de `.env.example` (todas las variables, sin secretos reales); `git ls-files` no lista `.env`; `git check-ignore .env` responde ignorado. |
| FR-006 | Render sin `OLLAMA_BASEURL` → `http://host.docker.internal:11434` + `extra_hosts`; render con valor explícito → ese valor. Con stack arriba: `docker compose exec app wget -qO- "$OLLAMA_BASEURL/api/tags"` (ver H-01). |
| FR-007 | `docker compose config`: servicio `worker` con `target: builder`, `command: npx tsx scripts/worker.mjs`, sin `ports`, `depends_on: db`; job de prueba procesado (quickstart). |
| FR-008 | Lectura del README: sección de modos de ejecución con ambos modos, comandos y criterio VPS. |
| FR-009 | Snapshots pre/post idénticos en 5005/5433/5010/5434; `git status` limitado a rutas de 001. |

**Nota SC-006 / ADR_002**: la validación end-to-end de un job de documento ejecuta
inferencia (analyzeDocument → callModel). Eso es trabajo pesado: requiere turno
aprobado por Jelkin. La task correspondiente queda marcada como "requiere turno".

## Complexity Tracking

Sin violaciones constitucionales que justificar.

## Riesgos y hallazgos (detalle en research.md)

- **H-01 (importante)**: el código de la app NO lee `process.env.OLLAMA_BASEURL`;
  resuelve `baseUrl` desde la BD (config de modelos/APIs sembrada por
  `scripts/seedApis.mjs`) con fallback hardcodeado `http://localhost:11434`
  (p. ej. `src/lib/modelClients.ts:41`). FR-006 arregla la capa compose, pero un
  contenedor seguirá intentando `localhost:11434` si la BD tiene ese valor
  sembrado. Decisión fuera del alcance escrito de la spec → **PREGUNTA PARA ZEUS**.
- **H-02**: `next build` dentro del Dockerfile probablemente falla hoy por cliente
  Prisma no generado (D-05). El fix propuesto es 1 línea; el build dockerizado no
  parece haberse ejercitado antes.
- **H-03**: datos existentes del volumen creados con el usuario viejo `innova` no
  se re-crean solos al cambiar `POSTGRES_*` (el init de la imagen solo corre con
  volumen vacío). La spec asume entorno recreable → la implementación recrearía el
  volumen del proyecto (`docker compose down -v` **scopeado a este compose de 001
  únicamente**, jamás global) o dump/restore si ZEUS lo pide.
