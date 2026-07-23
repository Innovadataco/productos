# Research — Saneamiento de infraestructura (Fase 0)

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-07-22

Estado del código verificado leyendo los archivos reales del repo (no de memoria):
`docker-compose.yml`, `Dockerfile`, `.env.example`, `README.md`, `package.json`,
`ecosystem.config.js`, `scripts/worker.mjs`, `src/lib/modelClients.ts`, `scripts/seedApis.mjs`.

## D-01 — Mapeo de puerto de BD

- **Decision**: `"5435:5432"` en el servicio `db`; el puerto interno de la red
  compose sigue siendo 5432.
- **Rationale**: 5435 es el puerto host asignado a 001 por ADR_002; los procesos
  dentro de la red compose se conectan por nombre de servicio (`db:5432`) y no les
  afecta el mapeo host.
- **Alternatives considered**: cambiar también el puerto interno (5435:5435 con
  `command: -p 5435`) — rechazado: complejidad sin beneficio; el puerto interno no
  colisiona con nada del host.

## D-02 — Parametrización de credenciales

- **Decision**: trío `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` en
  `.env` como única fuente de verdad. El compose usa `${VAR:?mensaje}` (falla
  explícita si falta) y **compone** los `DATABASE_URL` internos a partir del trío.
- **Rationale**: elimina la doble verdad actual (`innova/innova/innovadataco` en
  compose vs `idc_admin/...@5432/innovadataco_001` en `.env.example`); con la URL
  compuesta es estructuralmente imposible que la app y la BD diverjan dentro de
  compose. `:?` implementa el edge case de la spec (fallar explícito, no levantar
  con credenciales fantasma).
- **Alternatives considered**: (a) `DATABASE_URL` independiente también dentro de
  compose — rechazado: reintroduce la divergencia; (b) `env_file:` por servicio —
  rechazado: inyectaría TODAS las variables (incl. `DATABASE_URL` de host) a los
  contenedores, pisando la URL interna.
- **Nota asumida**: el `DATABASE_URL` de `.env` (para PM2/prisma CLI en el host)
  repite usuario/clave del trío; es el único punto de duplicación restante y queda
  documentado con comentario en `.env.example`. Aceptable: compose no lo usa.

## D-03 — Ollama desde contenedores

- **Decision**: `OLLAMA_BASEURL: ${OLLAMA_BASEURL:-http://host.docker.internal:11434}`
  en `app` y `worker`, más `extra_hosts: ["host.docker.internal:host-gateway"]`.
- **Rationale**: `host.docker.internal` resuelve al host en Docker Desktop y en
  Colima moderno; `host-gateway` lo garantiza también en runtimes Linux/VPS
  (docker engine ≥ 20.10), cubriendo la migración a VPS sin tocar el compose.
  El operador `:-` respeta la precedencia de un valor explícito en `.env`
  (escenario 3 de US3); un valor vacío (`OLLAMA_BASEURL=`) activa el default.
- **Alternatives considered**: (a) `network_mode: host` — rechazado: rompe el
  aislamiento de puertos (crítico bajo ADR_002) y no es portable a Mac;
  (b) IP fija del host — rechazado: frágil, cambia por red;
  (c) contenedorizar Ollama — fuera de scope por spec.
- **Validación pendiente en implementación**: probar resolución real bajo Colima
  (la spec ya lo prevé como edge case).

## D-04 — Cómo empaquetar el worker (mismo Dockerfile, command propio)

- **Decision**: servicio `worker` con `build: { context: ., target: builder }` y
  `command: npx tsx scripts/worker.mjs`.
- **Rationale**: `scripts/worker.mjs` necesita en runtime: `scripts/`, `src/lib/*.ts`
  (los importa vía tsx), `prisma/` y `node_modules` con tsx y el cliente Prisma
  generado. El stage `runner` actual NO copia `scripts/` ni `src/` (solo `.next`,
  `public`, `node_modules`, `package.json`), así que el worker no puede correr en
  `runner` sin engordar ese stage. El stage `builder` ya contiene el árbol completo
  + node_modules; usarlo como target cumple FR-007 ("mismo Dockerfile, command
  propio") sin duplicar imagen base ni tocar el runtime de la app. Docker reutiliza
  las capas: no hay build extra real.
- **Alternatives considered**: (a) añadir `COPY scripts/ src/ prisma/` al stage
  `runner` — rechazado: engorda la imagen de la app con código fuente que la app
  no necesita; (b) Dockerfile.worker separado — rechazado: contradice FR-007
  (mismo Dockerfile) y duplica mantenimiento.
- **Trade-off aceptado**: la imagen del worker incluye devDependencies y fuente;
  para VPS es aceptable (un solo host, capas compartidas). Optimizar después si
  pesa (fuera de scope).

## D-05 — `npx prisma generate` en el stage builder

- **Decision**: añadir `RUN npx prisma generate` en `builder`, entre `COPY . .` y
  `RUN npm run build`.
- **Rationale**: en el stage `deps`, `npm ci` corre solo con `package.json` (sin
  `prisma/schema.prisma`), de modo que el postinstall de `@prisma/client` no genera
  el cliente real. Sin generate: `next build` (rutas API importan `@prisma/client`)
  y el worker fallarían. Generar en `builder` deja el cliente dentro de
  `node_modules`, que ya se copia a `runner` → arregla app y worker con 1 línea.
- **Alternatives considered**: (a) `postinstall: prisma generate` en package.json —
  rechazado: afecta a todos los `npm install` locales (efecto colateral fuera de
  scope); (b) generar en `runner` — rechazado: `runner` no tiene `prisma/`.

## D-06 — `.env` como archivo canónico (vs `.env.local`)

- **Decision**: la implementación instruirá `cp .env.example .env`. `.env` es el
  archivo canónico; `.env.local` queda como override opcional de desarrollo.
- **Rationale**: docker compose hace interpolación desde `.env` por convención (no
  lee `.env.local`); Next.js lee ambos; `scripts/worker.mjs` ya carga ambos
  (`.env.local` primero, `.env` después). Un solo canónico = una sola verdad
  (FR-003/FR-005); la spec pide explícitamente "crear `.env` local".
- **Alternatives considered**: mantener `.env.local` como canónico y añadir
  `env_file`/`--env-file` al compose — rechazado: más fricción en cada comando
  compose y divergencia con la convención 12-factor del ADR_001.
- **Nota**: `.gitignore` ya cubre `.env` y `.env.local`.

## D-07 — HALLAZGO H-01: el código no lee `OLLAMA_BASEURL` (decisión para ZEUS)

- **Hecho verificado**: no existe ninguna referencia a `process.env.OLLAMA_BASEURL`
  en `src/` ni `scripts/`. El `baseUrl` de Ollama vive en la BD (tablas de config
  sembradas por `scripts/seedApis.mjs` con `http://localhost:11434` literal) y los
  fallbacks del código son hardcodeados: `src/lib/modelClients.ts:41`,
  `src/app/api/config/models/discover/route.ts:6`,
  `src/app/api/config/apis/[id]/test/route.ts:48`.
- **Implicación**: FR-006 (variable correcta en contenedores) es necesario pero NO
  suficiente para que la IA funcione en modo compose: la app leerá `localhost`
  desde la BD/fallbacks aunque la variable esté bien.
- **Opciones** (no se decide en este plan):
  - (a) Cambio mínimo de código: los fallbacks pasan a
    `process.env.OLLAMA_BASEURL ?? "http://localhost:11434"` y `seedApis.mjs`
    siembra desde la variable. Toca 3-4 archivos TS + seed; al modificar rutas API,
    la constitución §0.2 exige tests Vitest para esas rutas.
  - (b) Operativo sin código: en modo compose, actualizar el `baseUrl` en la BD (UI
    de Configuración o seed) a `http://host.docker.internal:11434`.
  - (c) Spec aparte para "config de IA 12-factor".
- **Estado**: PREGUNTA PARA ZEUS (ver reporte). Las tasks de US3 cubren la capa
  compose (alcance escrito de la spec) y dejan este punto explícitamente bloqueado.

## D-08 — Omisión de data-model.md y contracts/

- **Decision**: no generar `data-model.md` ni `contracts/`.
- **Rationale**: la feature no crea entidades de datos ni interfaces nuevas
  (las "Key Entities" de la spec son servicios compose y archivos de config, ya
  descritos en plan.md); generar artefactos vacíos añadiría ruido sin valor.
  El template de plan permite omitirlos para features puramente internas/infra.

## D-09 — Datos existentes del volumen (H-03)

- **Hecho**: la imagen postgres solo ejecuta el init (creación de usuario/BD) con
  el volumen vacío. `innovadataco_db_data` fue creado con `innova/innova`; cambiar
  el trío `POSTGRES_*` no migra usuarios ni renombra la BD.
- **Decision**: seguir la Assumption de la spec (entorno dev recreable): recrear el
  volumen al aplicar (down + borrar SOLO el volumen de este compose + up). Nunca
  `docker system prune` ni `-v` global (constitución §0.5).
- **Alternatives considered**: dump/restore con credenciales nuevas — disponible
  como plan B si al implementar se detectan datos valiosos (la spec ya lo prevé).
