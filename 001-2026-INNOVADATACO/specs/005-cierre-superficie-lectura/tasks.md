# Tasks: Cierre de la superficie de la API y protección de páginas

**Input**: Design documents from `specs/005-cierre-superficie-lectura/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (Approved por ZEUS),
[research.md](./research.md), [quickstart.md](./quickstart.md)

**Estado**: ⏸ **NO IMPLEMENTAR** hasta que ZEUS apruebe el plan (instrucción explícita del
2026-07-23).

**Trabajo pesado**: **ninguno**. No se ejecuta inferencia; se cierra la vía por la que un
anónimo podía provocarla. No requiere turno (ADR_002).

**Rama**: `feature/001-scaffolding` (PRUEBAS). Verificar antes de cada commit; nunca `main`.
**Commit y push en el mismo acto, por ODIN** (Metodología §6, regla 2).

**Orden**: lo fija **D-040** — escritura → interfaz → lectura → páginas. No se altera.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivos distintos)
- Cada tarea lleva su verificación; el baseline del quickstart §0 es el criterio.

---

## Phase 1: Baseline

- [ ] T001 Reconfirmar el baseline del quickstart §0 sobre el código del día (§1.1): 8+11
      manejadores abiertos, `DELETE` anónimo → **404**, `discover` anónimo → **200**, 5
      páginas → 200, suite **118/23**, `tsc --noEmit` limpio. **Verif.**: si algo no
      coincide con la spec, **detenerse y reportar** — el inventario es de ayer.
- [ ] T002 [P] Confirmar rama (`git branch --show-current` → `feature/001-scaffolding`) y
      que el stack de Jelkin responde en 5001. **No bajarlo en ningún momento.**
- [ ] T003 [P] Reconfirmar los consumidores de la interfaz sobre el código del día
      (`grep -rn "fetch(" src/app src/components --include="*.tsx"`): la tabla de la spec
      es el punto de partida, no la conclusión. → FR-007

---

## Phase 2: Cimientos (habilitan todos los bloques)

- [ ] T004 `src/lib/apiError.ts`: añadir `noAutenticado()` → `{ error: "No autenticado" }`
      con **401**. Mismo cuerpo que las 11 rutas ya protegidas: no cambia ningún contrato.
      **No** migrar esas 11 (research D-02). → FR-009
- [ ] T005 [P] Extender `src/lib/apiError.test.ts` con `noAutenticado()`: código 401, cuerpo
      exacto `{ error: "No autenticado" }` y ningún campo extra. → §0.2
- [ ] ~~T006~~ **Retirada por D-041**: `src/lib/auth.ts` **no se toca**. El módulo compartido
      `session.ts` solo existía para que el middleware verificara la firma en el borde;
      con la barrera optimista no tiene consumidor (research D-03).
- [ ] ~~T007~~ Retirada por D-041 (era la prueba de `session.ts`).
- [ ] T008 **Gate cimientos**: `npx vitest run src/lib` verde y suite completa sin
      regresión (los mocks de `@/lib/auth` siguen valiendo porque `auth.ts` no cambia).

**Commit 1** — cimientos. Push en el mismo acto.

---

## Phase 3: US-1 · Cierre de la escritura (P1) 🎯 corta el daño irreversible

Patrón en todos: `const session = await verifyAuth(); if (!session) return noAutenticado();`
como **primera línea del `try`**, antes de `await params`, de parsear el cuerpo, de
consultar la base y de cualquier `fetch`.

- [ ] T009 [US1] `src/app/api/licitaciones/[id]/route.ts`: cerrar `PATCH` (:44) y `DELETE`
      (:93) **antes de `await params` y de `findUnique`**. → FR-001, FR-002
- [ ] T010 [P] [US1] `src/app/api/licitaciones/entidades/route.ts`: cerrar `POST` (:19). → FR-001
- [ ] T011 [P] [US1] `src/app/api/licitaciones/estados/route.ts`: cerrar `POST` (:19). → FR-001
- [ ] T012 [P] [US1] `src/app/api/config/apis/[id]/toggle/route.ts`: cerrar `PATCH` (:5). → FR-001
- [ ] T013 [P] [US1] `src/app/api/config/apis/[id]/test/route.ts`: cerrar `POST` (:24),
      **antes** de la llamada saliente. → FR-001, FR-003
- [ ] T014 [P] [US1] `src/app/api/config/models/test/route.ts`: cerrar `POST` (:7),
      **antes** de disparar inferencia. → FR-001, FR-003
- [ ] T015 [P] [US1] `src/app/api/documents/search/route.ts`: cerrar `POST` (:5). → FR-001
- [ ] T016 [P] [US1] `src/app/api/config/models/discover/route.ts`: cerrar `GET` (:20),
      **antes** del `fetch` a `baseUrl` (research D-10). → FR-001, FR-003
- [ ] T017 [US1] Extender los 8 archivos `*.test.ts` correspondientes: 401 sin sesión,
      comportamiento intacto con sesión y **`expect(prisma.X.Y).not.toHaveBeenCalled()`** /
      `fetch` no invocado. → FR-020, FR-021
- [ ] T018 [US1] Verificar que la auditoría de las mutaciones sigue registrándose con
      sesión válida. → FR-004
- [ ] T019 [US1] **Gate US-1**: suite verde; quickstart §2 — `DELETE`/`PATCH` con id
      inexistente → **401** (baseline 404) y `discover` → **401** (baseline 200).
      → SC-001, SC-002, SC-003, SC-004

**Commit 2** — I-010 cerrada. Push en el mismo acto.

---

## Phase 4: US-2 · La pantalla de configuración sobrevive al 401 (P1) 🎯 antes de cerrar lo que consume

- [ ] T020 [US2] Crear `src/lib/respuestaApi.ts` con `listaSegura<T>(res)`: `{ items, error: null }`
      solo si la respuesta fue correcta **y** el cuerpo es una lista; en cualquier otro caso
      `{ items: [], error: <mensaje legible> }`. → FR-005
- [ ] T021 [P] [US2] Crear `src/lib/respuestaApi.test.ts`: 200 con lista, 200 con objeto,
      401 con `{error}`, cuerpo no-JSON y respuesta vacía. En todos los casos fallidos:
      lista vacía y mensaje legible, **sin lanzar**. → FR-005, §0.2
- [ ] T022 [US2] `src/app/configuracion/page.tsx:149-162`: `loadModels`, `loadApis` y
      `loadAudit` pasan por `listaSegura` y avisan con el `toast()` que ya existe. **Ni un
      cambio más en el archivo** (no se tocan los `any` heredados — D-016). → FR-005
- [ ] T023 [US2] **Verificación previa al cierre** (FR-006, RZ-6): con las rutas todavía
      abiertas, borrar la cookie y recargar los datos de `/configuracion`. La pantalla debe
      renderizarse con listas vacías y aviso legible. Baseline: se rompe. → SC-005, SC-006
- [ ] T024 [US2] Corregir cualquier otro consumidor que T003 haya revelado frágil, con el
      mismo criterio. Si no hay ninguno, dejarlo dicho en el commit. → FR-007

**Commit 3** — la interfaz ya aguanta el 401. Push en el mismo acto.

---

## Phase 5: US-3 · Cierre de la lectura (P1)

- [ ] T025 [P] [US3] `config/apis/route.ts`: cerrar `GET` (:5). → FR-008
- [ ] T026 [P] [US3] `config/audit/route.ts`: cerrar `GET` (:4). → FR-008
- [ ] T027 [P] [US3] `config/models/route.ts`: cerrar `GET` (:8). → FR-008
- [ ] T028 [P] [US3] `config/module-settings/route.ts`: cerrar `GET` (:6). → FR-008
- [ ] T029 [P] [US3] `documents/route.ts`: cerrar `GET` (:133). → FR-008
- [ ] T030 [P] [US3] `documents/[id]/logs/route.ts`: cerrar `GET` (:4). → FR-008
- [ ] T031 [P] [US3] `licitaciones/route.ts`: cerrar `GET` (:8). → FR-008
- [ ] T032 [P] [US3] `licitaciones/[id]/route.ts`: cerrar `GET` (:7), antes de `await params`. → FR-008
- [ ] T033 [P] [US3] `licitaciones/entidades/route.ts`: cerrar `GET` (:6). → FR-008
- [ ] T034 [P] [US3] `licitaciones/estados/route.ts`: cerrar `GET` (:6). → FR-008
- [ ] T035 [US3] Extender los 10 archivos de prueba: 401 sin sesión (sin datos, sin tocar
      la capa de datos) y mismo cuerpo con sesión. → FR-009, FR-010, FR-020, FR-021
- [ ] T036 [US3] Revisar los 15 archivos tocados: **ninguno** queda con un método protegido
      y otro abierto. → FR-011
- [ ] T037 [US3] **Gate US-3**: quickstart §4 — los 11 `GET` → 401 sin cookie;
      `/api/config/audit` devuelve `{"error":"No autenticado"}` en vez de auditoría real;
      con sesión, cuerpos idénticos. → SC-007, SC-008, SC-009

**Commit 4** — I-009 cerrada. Push en el mismo acto.

---

## Phase 6: US-4 · Barrera de páginas (P2)

- [ ] T038 [P] [US4] Crear `src/lib/destinoSeguro.ts`: devuelve el destino solo si empieza
      por `/` y **no** por `//` ni `/\`; en cualquier otro caso, `/`. → FR-018
- [ ] T039 [P] [US4] Crear `src/lib/destinoSeguro.test.ts`: rutas internas con y sin query,
      `//evil.com`, `/\evil.com`, `https://…`, `null`, vacío. → FR-018, §0.2
- [ ] T040 [US4] Crear `src/middleware.ts` con el orden de decisión del plan: estáticos y
      rutas públicas pasan; `/api/**` sin cookie → **401 JSON**; `/login` con cookie → `/`;
      página sin cookie → `/login?next=<ruta+query>`. **D-041**: decide por **presencia** de
      `req.cookies.get("token")` — sin verificar firma, sin base de datos y **sin importar
      `@/lib/auth`**. → FR-012…FR-017, FR-019
- [ ] T041 [US4] `matcher` que excluya `/_next/static`, `/_next/image` y el icono del sitio.
      → FR-014
- [ ] T042 [US4] `src/app/login/page.tsx`: tras un login correcto navegar a
      `destinoSeguro(new URLSearchParams(window.location.search).get("next"))`. Sin
      `useSearchParams` (research D-06). Nada más de la pantalla se toca. → FR-017, FR-018
- [ ] T043 [US4] Crear `src/middleware.test.ts`: página protegida sin cookie → redirección
      a `/login?next=…`; con cookie → pasa; `/login` sin cookie → pasa; `/login` con cookie
      → `/`; `/api/documents` sin cookie → **401 JSON, no redirección**;
      `POST /api/auth/login` y `POST /api/auth/logout` sin cookie → pasan; y el
      comportamiento **declarado** de D-041: una cookie basura pasa la barrera (la ruta la
      rechaza igual). → FR-022
- [ ] T044 [US4] **Gate US-4**: quickstart §5 — las 5 páginas redirigen sin cookie y se
      muestran con ella; `/login` responde 200 sin sesión (si redirige, hay bucle);
      `/api/**` devuelve JSON, nunca HTML. → SC-010, SC-011, SC-012, SC-013

**Commit 5** — I-008 cerrada. Push en el mismo acto.

---

## Phase 7: Red de seguridad y cierre

- [ ] T045 Crear `src/app/api/superficie.test.ts`: recorre `src/app/api/**/route.ts` con
      `import.meta.glob`, invoca cada manejador exportado sin sesión (segundo argumento
      sintético `{ params: Promise.resolve({ id: "x" }) }`) y exige **401**. Lista blanca
      **declarada con motivo**: `POST /api/auth/login`, `POST /api/auth/logout`. → FR-023
- [ ] T046 Comprobación deliberada de que la prueba sirve: retirar la verificación de una
      ruta cualquiera → la suite se pone **roja**; restaurar. → SC-015
- [ ] T047 Recrear el stack con la mínima interrupción: `docker-compose build app` **antes**
      de `docker-compose up -d app`. **`down -v` prohibido.** → R-05
- [ ] T048 Verificar en ejecución que la barrera no estorba: con sesión iniciada, las
      páginas protegidas **no** redirigen; sin cookie, todas llevan al login. (El riesgo del
      secreto en el borde quedó cerrado por **D-041**: el middleware no lo necesita.)
- [ ] T049 Verificación manual completa: login → las cinco pantallas funcionan igual que
      antes; retorno a la dirección solicitada; `?next=` externo termina en `/`. → SC-012, SC-014
- [ ] T050 Gates globales: `npx vitest run` ≥ 118 verdes sin BD ni Ollama;
      `npx tsc --noEmit` limpio; `npx eslint src/lib src/app/api` → 0 `no-explicit-any`.
      → FR-024, FR-025, SC-016, SC-017
- [ ] T051 Aislamiento: puertos 5005/5433/5010/5434 sin cambios; `git diff --cached
      --name-only` solo rutas de `001-2026-INNOVADATACO/`; rama correcta. → FR-026, SC-018, SC-019
- [ ] T052 Commit de cierre con **staging explícito por ruta** (prohibido `git add -A`),
      **push en el mismo acto** y reporte de una línea a ZEUS.

---

## Mapa de cobertura FR / SC → tasks

| Requisito | Tasks |
|---|---|
| FR-001 | T009–T016 |
| FR-002 | T009, T019 |
| FR-003 | T013, T014, T016, T019 |
| FR-004 | T018 |
| FR-005 | T020, T021, T022 |
| FR-006 | T023 |
| FR-007 | T003, T024 |
| FR-008 | T025–T034 |
| FR-009 | T004, T035 |
| FR-010 | T035, T037 |
| FR-011 | T036 |
| FR-012…FR-014 | T040, T041 |
| FR-015 | T040, T043 |
| FR-016 | T040, T043 |
| FR-017 | T040, T042 |
| FR-018 | T038, T039, T042 |
| FR-019 | T040, T043 |
| FR-020, FR-021 | T017, T035 |
| FR-022 | T043 |
| FR-023 | T045 |
| FR-024, FR-025 | T050 |
| FR-026 | T051, T052 |
| SC-001…SC-004 | T019 |
| SC-005, SC-006 | T023 |
| SC-007…SC-009 | T037 |
| SC-010…SC-013 | T044 |
| SC-014 | T049 |
| SC-015 | T046 |
| SC-016, SC-017 | T050 |
| SC-018, SC-019 | T051 |

## Dependencias

- T001–T003 antes de todo. Si el baseline no coincide, **detenerse y reportar**.
- Cimientos (T004, T005, T008) antes de cualquier bloque: `noAutenticado` lo usan todos.
  T006 y T007 quedan **retiradas por D-041**.
- **US-1 (T009–T019) va primero** (D-040): el daño irreversible se corta antes que nada.
- **US-2 (T020–T024) antes de US-3**: cerrar los `GET` de configuración sin la guarda
  reproduce el riesgo de T012 (RZ-1, RZ-6).
- T032 (`GET` de `licitaciones/[id]`) después de T009: mismo archivo.
- T038–T039 antes de T042; T040–T041 antes de T043.
- US-4 (T040–T044) **al final**: es lo único que puede dejar al CEO fuera de su propia
  aplicación si se ajusta mal.
- T045–T046 después de todos los cierres (si no, la prueba estructural nace roja).
- T047 después de todo el código; T048–T052 cierran.

## Fuera de alcance (NO tocar)

- RBAC y respuestas 403; rate limiting (§5.4).
- Lista blanca de destinos para el `baseUrl` de *Descubrir*.
- Los `any` de los componentes `.tsx` (D-016), incluido el `catch (err: any)` de
  `licitaciones/page.tsx`.
- Estrenar el arnés de pruebas de componentes React (research D-07).
- Pipeline RAG (spec 003) y OCR (D-025) — RZ-4.
- Migrar las 11 apariciones antiguas del literal de 401 (research D-02).
- Verificar la firma del token en el middleware, declarar runtime Node.js para el borde o
  inyectar `JWT_SECRET` en la imagen (**D-041**; lo último, además, violaría §0.4).
- Cualquier archivo de 002-Protección Infantil o 003-SICOV.
