# Tasks: Hotfix de validación funcional

**Input**: Design documents from `specs/004-hotfix-validacion-funcional/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (Approved), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Estado**: 🟢 EN EJECUCIÓN — aprobada por ZEUS y Jelkin (2026-07-23).

**Trabajo pesado**: **ninguno**. `/api/tags` devuelve metadatos y el seed no ejecuta
modelos. No requiere turno (ADR_002).

**Rama**: `feature/001-scaffolding` (PRUEBAS). Verificar antes de cada commit; nunca `main`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivos distintos)
- Cada tarea lleva su comando de verificación; el baseline es el criterio.

---

## Phase 1: Baseline

- [ ] T001 Registrar el baseline del bloque §0 de quickstart.md: literal ×3, `NODE_ENV` ×1, `projects` sin test, `GET /api/projects` → 200 sin cookie, catálogos `0|0|0|0`. **Verif.**: coincide con la spec; si no, detenerse y reportar.
- [ ] T002 [P] Confirmar rama (`git branch --show-current` → `feature/001-scaffolding`) y que el stack de Jelkin responde (HTTP 200 en 5001). **No bajarlo en ningún momento.**

---

## Phase 2: I-005 — Sesión que persiste (US1, P1) 🎯 desbloquea la verificación manual

- [ ] T003 [US1] Crear `src/lib/authCookie.ts` con `cookieSecure()`: lee `AUTH_COOKIE_SECURE`, normaliza (minúsculas, sin espacios) y devuelve `false` **solo** ante `"false"`; cualquier otro valor → `true` (research D-01). → FR-004
- [ ] T004 [US1] Crear `src/lib/authCookie.test.ts`: default sin variable → `true`; `"false"` → `false`; `"FALSE"`/`" false "` → `false`; `""`, `"sí"`, `"1"`, basura → `true` (ante ambigüedad, seguro). → FR-004, §0.2
- [ ] T005 [US1] `src/app/api/auth/login/route.ts:29`: sustituir `secure: process.env.NODE_ENV === "production"` por `secure: cookieSecure()`. **No tocar** `httpOnly`, `sameSite` ni `maxAge`. → FR-004, FR-006
- [ ] T006 [US1] Documentar `AUTH_COOKIE_SECURE` en `.env.example` (significado, default `true`, cuándo apagarla) y añadirla al `.env` local con `false` (**no se commitea**). → FR-005
- [ ] T007 [US1] `docker-compose.yml`: propagar `AUTH_COOKIE_SECURE` a los servicios que emiten la cookie. → FR-004
- [ ] T008 [US1] **Gate US1**: `grep -rn "NODE_ENV" src/app/api/auth/` → 0 líneas que decidan `Secure`; pruebas de `authCookie` verdes. → SC-003

**Checkpoint US1**: la sesión puede verificarse manualmente; el resto ya es comprobable.

---

## Phase 3: I-007 — Listado de proyectos protegido (US4, P2)

- [ ] T009 [US4] `src/app/api/projects/route.ts`: añadir `verifyAuth()` al `GET`, respondiendo 401 sin sesión y sin devolver datos. → FR-012
- [ ] T010 [US4] Migrar el `catch` del `GET` a `apiError("Proyectos", "GET lista", …)`: es la última ruta fuera del contrato de la spec 002 (research D-05). → FR-015
- [ ] T011 [US4] Crear `src/app/api/projects/route.test.ts` con los mocks establecidos: `GET` 401 sin sesión, `GET` 200 con sesión y mismos datos, `POST` 401 sin sesión, 409 en `P2002`, y caso de fuga (el error no revela `err.message`). → FR-014, FR-013
- [ ] T012 [US4] Verificar consumidores del listado (riesgo R-04): comprobar que ninguna pantalla lo consumía sin sesión. → FR-013
- [ ] T013 [US4] **Gate US4**: pruebas verdes; `curl` sin cookie → 401. → SC-007

---

## Phase 4: I-006 — Seed reproducible (US3, P1)

- [ ] T014 [US3] Migración: `@unique` en `EntidadLicitacion.key` y `LicitacionStatus.key` (research D-03). Tablas vacías → índice sin riesgo. **Verif.**: `npx prisma migrate deploy` sin errores y sin bajar el stack. → FR-008
- [ ] T015 [US3] Crear `scripts/seed.mjs`: `upsert` por `key` para `LicitacionStatus` (5 claves de la UI), `EntidadLicitacion` (desde `entidadesColombia.ts`) y `AgentApi` (catálogo de `seedApis.mjs`); `findFirst` + `create` para `AiModel` (uno de referencia, **inactivo**). Sin `deleteMany`. → FR-007, FR-008, FR-009
- [ ] T016 [US3] El seed informa qué creó y qué omitió, y falla explícito si la base no está migrada. → FR-010
- [ ] T017 [US3] `package.json`: script `seed`. → FR-007
- [ ] T018 [US3] `README.md`: procedimiento de arranque limpio (recrear volumen → `migrate deploy` → `init-pgboss` → `seed`), cerrando el gap operativo de la spec 001 (D-010). → FR-011
- [ ] T019 [US3] **Gate US3**: ejecutar el seed dos veces; los 4 catálogos > 0 y con recuentos idénticos; desactivar una API, re-sembrar y comprobar que sigue desactivada. → SC-005, SC-006

---

## Phase 5: I-004 — Descubrir operativo (US2, P1)

- [ ] T020 [US2] `src/app/configuracion/page.tsx:102`: `baseUrl: "http://localhost:11434"` → `baseUrl: ""`. → FR-001
- [ ] T021 [US2] `:289`: construir la URL **sin** el parámetro `baseUrl` cuando el campo esté vacío; con valor, enviarlo (el explícito manda). → FR-002
- [ ] T022 [US2] Confirmar que el `placeholder` de `:380` **queda intacto**: es ayuda visual, no un valor. → FR-003
- [ ] T023 [US2] **Gate US2**: `grep -n "11434" src/app/configuracion/page.tsx` → **1** sola línea. Verificación manual: campo vacío + *Descubrir* lista modelos. → SC-002, SC-004

---

## Phase 6: Cierre

- [ ] T024 Reconstruir la imagen y recrear los servicios para que tomen los cambios, **sin borrar volúmenes** (`down -v` prohibido aquí) y con el mínimo de interrupción para Jelkin.
- [ ] T025 Verificación manual completa (SC-001, SC-004): login en Safari + acción autenticada; *Descubrir* con campo vacío.
- [ ] T026 Gates globales: `npm run test` ≥ 107 verdes sin BD ni Ollama; `npm run build`; `npx eslint src/lib src/app/api` → 0 `no-explicit-any`. → FR-015, FR-016, SC-008, SC-009, SC-010
- [ ] T027 Aislamiento: puertos 5005/5433/5010/5434 sin cambios; `git diff --cached --name-only` solo rutas de 001; rama = `feature/001-scaffolding`. → FR-017, SC-011, SC-012
- [ ] T028 Commits convencionales con **staging explícito por ruta** (prohibido `git add -A`) y reporte compacto a ZEUS.

---

## Mapa de cobertura FR / SC → tasks

| Requisito | Tasks |
|---|---|
| FR-001 | T020 |
| FR-002 | T021 |
| FR-003 | T022 |
| FR-004 | T003, T005, T007, T008 |
| FR-005 | T006 |
| FR-006 | T005 |
| FR-007 | T015, T017 |
| FR-008 | T014, T015, T019 |
| FR-009 | T015, T019 |
| FR-010 | T016 |
| FR-011 | T018 |
| FR-012 | T009, T013 |
| FR-013 | T011, T012 |
| FR-014 | T011 |
| FR-015 | T010, T026 |
| FR-016 | T026 |
| FR-017 | T027, T028 |
| SC-001 | T025 |
| SC-002 | T023 |
| SC-003 | T008 |
| SC-004 | T023, T025 |
| SC-005, SC-006 | T019 |
| SC-007 | T013 |
| SC-008…SC-010 | T026 |
| SC-011, SC-012 | T027 |

## Dependencias

- T001–T002 antes de todo.
- **US1 (T003–T008) va primero**: sin sesión útil no se verifica manualmente nada más.
- T014 antes de T015 (el `upsert` necesita el índice único).
- T024 después de todos los cambios de código y antes de la verificación manual.
- T026–T028 cierran.

## Fuera de alcance (NO tocar)

Otras rutas `GET` sin `verifyAuth` y la ausencia de `middleware.ts` son **I-008 e I-009**
y pertenecen a la **spec 005**. Cerrarlas ahora, antes de que la sesión funcione, dejaría
la interfaz entera respondiendo 401. Se dejan exactamente como están.
