# Tasks: Saneamiento de infraestructura

**Input**: Design documents from `specs/001-saneamiento-infraestructura/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (Approved), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Estado**: 🟢 EN EJECUCIÓN — luz verde para `/speckit-implement` (2026-07-22).
Enmiendas de ZEUS incorporadas: FR-010 (D-008) desbloquea T019; FR-011 (D-009)
añade T015b; D-010 confirma el enfoque Dockerfile; D-011 la recreación del volumen.
**T018 sigue BLOQUEADA** (turno de trabajo pesado de Jelkin pendiente, ADR_002).

**Tests**: FR-010 modifica rutas API y lib → tests Vitest obligatorios para ese
código (§0.2). Gate global: suite completa verde + validaciones de infra
(`docker compose config`, quickstart).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Story]**: user story de la spec (US1…US5)

---

## Phase 1: Setup / Evidencia base

- [x] T001 Snapshot PRE de aislamiento: guardar `lsof -nP -iTCP:5005 -iTCP:5433 -iTCP:5010 -iTCP:5434 -sTCP:LISTEN` y `docker ps` filtrado en `/tmp/idc001-ports-pre.txt` (quickstart §0). → FR-009, SC-003
- [x] T002 [P] Verificar suite Vitest verde ANTES de tocar nada (`npm run test`) para conocer el estado base (§0.2, constitución §7.1). → gate general

**Checkpoint**: evidencia base capturada.

---

## Phase 2: Foundational — Configuración canónica (bloquea a todas las stories)

- [x] T003 Actualizar `.env.example` al contenido objetivo del plan (§3): trío `POSTGRES_*`, `DATABASE_URL` con `localhost:5435`, `OLLAMA_BASEURL=` vacío documentado, resto de variables intactas, cero secretos reales. → FR-005
- [x] T004 Crear `.env` local desde `.env.example` con la contraseña real. Verificar `git check-ignore .env` y que `git ls-files` no lo liste. **JAMÁS commitearlo.** → FR-005, SC-004

**Checkpoint**: `.env` canónico listo; las stories pueden implementarse.

---

## Phase 3: US1 — BD propia en puerto 5435 (P1) 🎯 MVP

- [x] T005 [US1] `docker-compose.yml`: cambiar mapeo del servicio `db` de `"5432:5432"` a `"5435:5432"`. Ningún otro puerto publicado cambia ni se añade. → FR-001
- [x] T006 [US1] Validar: `docker compose config` OK; render publica solo 5001 (app) y 5435 (db); grep confirma ausencia de 5432/5005/5433/5010/5434 como puertos publicados. → SC-001, SC-002 (estático)
- [x] T007 [US1] Levantar solo `db` (`docker compose up -d db`) y conectar con `psql` a `localhost:5435` (quickstart §2). Si el volumen viejo (`innova`) impide autenticar → aplicar D-09: recrear SOLO el volumen de este compose (down + rm del volumen propio + up), nunca global. → SC-002
- [x] T008 [US1] Confirmar que 5005/5433/5010/5434 no cambiaron (comparación parcial contra T001). Si algo difiere: DETENERSE y reportar. → SC-003

**Checkpoint US1**: BD del proyecto respondiendo en 5435; aislamiento intacto.

---

## Phase 4: US2 — Una sola verdad de credenciales (P1)

- [x] T009 [US2] `docker-compose.yml`: servicio `db` lee `POSTGRES_USER/PASSWORD/DB` de `.env` con sintaxis `${VAR:?mensaje}` (plan §1). Cero credenciales literales en el archivo. → FR-002
- [x] T010 [US2] `docker-compose.yml`: `DATABASE_URL` de `app` compuesto desde el trío (`@db:5432`), eliminando la URL hardcodeada `innova:innova@db`. → FR-003, FR-004
- [x] T011 [US2] Validar: `docker compose config` con `.env` renderiza credenciales del `.env`; sin `.env` falla con el mensaje `:?` (quickstart §1); grep de credenciales literales en compose = 0. → SC-001, SC-004
- [x] T012 [US2] Verificar coherencia dev-fuera-de-docker: `DATABASE_URL` de `.env` apunta a `localhost:5435` con las mismas credenciales del trío; `npx prisma migrate deploy` (o `prisma db pull`) conecta contra 5435. → FR-004

**Checkpoint US2**: una sola fuente de verdad; compose sin secretos.

---

## Phase 5: US3 — Ollama alcanzable desde contenedores (P2)

- [x] T013 [US3] `docker-compose.yml`: `OLLAMA_BASEURL: ${OLLAMA_BASEURL:-http://host.docker.internal:11434}` en `app` (y `worker` cuando exista, T015) + `extra_hosts: ["host.docker.internal:host-gateway"]`. → FR-006
- [x] T014 [US3] Validar los 3 escenarios de US3 vía `docker compose config`: sin variable → default; con valor explícito → precedencia; y (con stack arriba, quickstart §5) `wget` a `$OLLAMA_BASEURL/api/tags` desde el contenedor `app` bajo Colima (valida `host.docker.internal`). → SC-005
- [x] T019 [US3] **(desbloqueada por FR-010 / ZEUS D-008)**: cambiar fallbacks a `process.env.OLLAMA_BASEURL ?? "http://localhost:11434"` en `src/lib/modelClients.ts`, `src/app/api/config/models/discover/route.ts`, `src/app/api/config/apis/[id]/test/route.ts` y el literal de `scripts/seedApis.mjs`. Precedencia: BD/UI manda; la env var solo sustituye defaults/fallbacks. Tests Vitest del código tocado (§0.2). → FR-010

**Checkpoint US3**: capa compose lista; IA end-to-end sujeta a D-07.

---

## Phase 6: US4 — Worker en compose (P2)

- [x] T015 [US4] `docker-compose.yml`: añadir servicio `worker` según plan §1: `build: {context: ., target: builder}`, `command: npx tsx scripts/worker.mjs`, mismo `DATABASE_URL` compuesto (`@db:5432`), `OLLAMA_BASEURL` como `app`, `extra_hosts`, `depends_on: db`, sin `ports`. → FR-007
- [x] T015b [US4] **(nueva por FR-011 / ZEUS D-009)** `docker-compose.yml`: `healthcheck` con `pg_isready` en `db`; `depends_on: {db: {condition: service_healthy}}` en `app` y `worker`; `restart: unless-stopped` en los tres servicios. → FR-011
- [x] T016 [US4] `Dockerfile`: añadir `RUN npx prisma generate` en stage `builder` entre `COPY . .` y `RUN npm run build` (plan §2, research D-05). **+ desviación aprobada por ZEUS**: también `RUN apk add --no-cache openssl` en el stage `base`, sin el cual Prisma carga el engine `openssl-1.1.x` y el worker crashea en bucle (research D-12 / H-04). → habilitador FR-007
- [x] T017 [US4] Validar: `docker compose config` muestra el worker conforme a FR-007; `docker compose up -d --build` levanta app+worker+db; logs del worker sin errores de conexión (quickstart §3). → SC-001, SC-006 (parcial)
- [ ] ⚠️ T018 [US4] Job end-to-end (subir PDF → worker procesa → estado final): **REQUIERE TURNO DE TRABAJO PESADO APROBADO POR JELKIN (ADR_002)** — ejecuta inferencia. Coordinar antes de correr. Nota: el resultado IA puede depender además de T019/D-07. → SC-006

**Checkpoint US4**: `repo + .env + docker compose up` levanta el sistema completo.

---

## Phase 7: US5 — Documentación de modos de ejecución (P3)

- [x] T020 [P] [US5] `README.md`: sección "Modos de ejecución" (PM2 = dev en Mac; docker compose sobre Colima = producción/VPS), comandos de cada modo, criterio VPS del ADR_001, puertos propios 5001/5435 e intocables 5005/5433/5010/5434; actualizar `cp .env.example .env.local` → `cp .env.example .env` (research D-06). → FR-008
- [x] T021 [US5] Validar leyendo el README como operador nuevo: ¿elige el modo correcto sin ayuda? (SC-007). → SC-007

---

## Phase 8: Cierre y verificación global

- [x] T022 Snapshot POST de aislamiento y `diff` contra T001 → idéntico. → FR-009, SC-003
- [x] T023 Gate de commit: `npm run test` verde, `npm run lint` sin nuevos errores, `docker compose config` OK, `git status` solo con rutas de 001, `.env` fuera del índice. → §0.2, SC-004
- [x] T024 Commit de implementación (mensaje en español) + reporte a ZEUS con evidencias (snapshots, renders, logs).

---

## Mapa de cobertura FR / SC → tasks

| Requisito | Tasks |
|---|---|
| FR-001 | T005, T006 |
| FR-002 | T009, T011 |
| FR-003 | T010, T011 |
| FR-004 | T010, T012 |
| FR-005 | T003, T004 |
| FR-006 | T013, T014 |
| FR-007 | T015, T016, T017 |
| FR-008 | T020, T021 |
| FR-009 | T001, T008, T022 |
| FR-010 | T019 |
| FR-011 | T015b, T017 |
| SC-001 | T006, T011, T017 |
| SC-002 | T006, T007 |
| SC-003 | T001, T008, T022 |
| SC-004 | T004, T011, T023 |
| SC-005 | T014 |
| SC-006 | T017, T018 (⚠️ turno) |
| SC-007 | T020, T021 |

## Dependencias

- T001–T004 antes que todo lo demás (T002 ∥ T001).
- US1 (T005–T008) y US2 (T009–T012) tocan el mismo archivo compose → secuenciales
  entre sí (US1 primero), aunque en la práctica T005+T009+T010+T013+T015 son un
  mismo edit del compose aplicado por fases verificables.
- T016 antes de T017 (el build del worker necesita prisma generate).
- T018 al final de US4 y SOLO con turno aprobado.
- T019 bloqueada hasta decisión de ZEUS (D-07).
- T020–T021 en paralelo con cualquier fase posterior a Phase 2.
- T022–T024 cierran, siempre de últimos.
