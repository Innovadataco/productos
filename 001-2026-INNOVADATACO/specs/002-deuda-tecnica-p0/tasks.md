# Tasks: Deuda técnica P0

**Input**: Design documents from `specs/002-deuda-tecnica-p0/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (Approved), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Estado**: ⛔ NO EJECUTAR — pendiente de luz verde para `/speckit-implement`.

**Tests**: esta spec **es** tests y contrato. Gate de cada tramo: `npm run test`
verde **con los contenedores abajo** (si la BD está arriba, un test que abra
conexión pasaría sin demostrar nada).

**Orden fijado por ZEUS**: US1 → US2 → US3 → US4. Cada tramo es committeable por
separado; parar tras cualquiera deja el repo consistente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Story]**: user story de la spec (US1…US4)
- Cada tarea lleva **su comando de verificación**; los números del baseline son el criterio.

---

## Phase 1: Baseline y evidencia

- [ ] T001 Registrar el baseline ejecutando el bloque §0 de quickstart.md y guardando la salida. Debe reproducir: `any` 5/29, fugas 13 archivos, tests de ruta 3, suite 13 verdes + 1 rojo, lint 112. **Verif.**: la salida coincide con la tabla de la spec; si no, detenerse y reportar (el repo cambió desde la medición).
- [ ] T002 [P] Snapshot de aislamiento PRE de 5005/5433/5010/5434. **Verif.**: `lsof -nP -iTCP:5005 -iTCP:5433 -iTCP:5010 -iTCP:5434 -sTCP:LISTEN` guardado. → FR-012

---

## Phase 2: US1 — Harness de tests (P1) 🎯 desbloquea medir todo lo demás

**Goal**: `npm run test` verde y determinista sin BD ni `.env`.

- [ ] T003 [US1] Crear `.env.test` versionado con valores **dummy** (`JWT_SECRET` de 32+ chars claramente falso, `ENCRYPTION_KEY`, `DATABASE_URL` de mentira, `OLLAMA_BASEURL`), según plan §US1.1. **Verif.**: `git ls-files .env.test` lo lista y `grep -iE "innovadataco2026|[0-9a-f]{32}" .env.test` no encuentra secretos reales. → FR-001
- [ ] T004 [US1] Modificar `vitest.config.ts` para cargar `.env.test` en `process.env` antes de la suite (research D-01). **Verif.**: un test sonda imprime `JWT_SECRET.length >= 32`. → FR-001
- [ ] T005 [US1] Crear `src/test/prismaMock.ts` extrayendo el patrón `vi.mock("@/lib/prisma")` ya validado en `config/apis/[id]/test/route.test.ts` (research D-07). **Verif.**: importable desde un test sin abrir conexión. → FR-002
- [ ] T006 [US1] Reescribir `src/app/api/auth/login/route.test.ts` con el mock de Prisma (hash bcrypt precomputado en fixture): casos 401 credenciales inválidas y 200 + cookie `token`. **NO** tocar el `throw` de `src/lib/auth.ts` (research D-02). **Verif.**: `docker-compose down && npx vitest run src/app/api/auth/login/route.test.ts` → verde. → FR-002
- [ ] T007 [US1] **Gate US1**: `docker-compose down && npm run test` → exit 0, 0 archivos fallidos. Además prueba de aislamiento: mover `.env` fuera, correr la suite, restaurarlo. **Verif.**: verde en ambos casos. → FR-003, SC-001

**Checkpoint US1**: el gate "suite verde antes de commit" (§0.2) pasa a ser aplicable. Cierra D-013 de la spec 001.

---

## Phase 3: US2 — Contrato de errores (P1)

**Goal**: ninguna ruta filtra `err.message` al cliente; forma de error única.

- [ ] T008 [US2] Crear `src/lib/apiError.ts` con la firma del plan §US2.1: devuelve `{ error: mensajeCliente }` y registra `[Módulo] Acción: error — detalle` en el log (constitución §2.5). **Verif.**: test unitario del helper (no expone `err.message` en la respuesta; sí lo registra). → FR-005
- [ ] T009 [US2] Migrar las 4 rutas de **licitaciones** (`licitaciones`, `licitaciones/[id]`, `licitaciones/estados`, `licitaciones/entidades`) a `apiError`, eliminando `details`. **Verif.**: `grep -n "details:\|error.message" src/app/api/licitaciones -r` → 0 en respuestas al cliente. → FR-004, FR-005
- [ ] T010 [US2] Migrar las 5 rutas de **config** que filtran (`config/models`, `config/models/[id]`, `config/models/test`, `config/models/discover`, `config/module-settings`, `config/apis/[id]/test`) conservando campos legítimos (`latencyMs`, `text`) y las llamadas a `auditLog` (research D-03). **Verif.**: grep sin fugas; los campos extra siguen presentes. → FR-004, FR-005
- [ ] T011 [US2] Migrar `auth/login`, `projects` y `research/analyze` (esta última conserva `rawText`/`latencyMs`, con código 502 para fallo de upstream de IA). **Verif.**: grep sin fugas; códigos HTTP conforme a §2.4. → FR-004, FR-005
- [ ] T012 [US2] Añadir por cada ruta migrada un test que **fuerza el error** (mock que lanza) y verifica que la respuesta no contiene `err.message`, `details` ni stack. **Verif.**: `npm run test` verde. → FR-006
- [ ] T013 [US2] Revisar los componentes que consumen las rutas migradas (`LicitacionesTab.tsx`, `ProjectForm.tsx`, `configuracion/*`): confirmar que leen `error.error` y que ninguna pantalla queda mostrando `undefined` (research D-04 ya verificó que nadie lee `.details`). **Verif.**: `grep -rn "\.details" src/components src/app --include="*.tsx"` → 0. → FR-011
- [ ] T014 [US2] **Gate US2**: `grep -rn "err.message\|error.message" src/app/api --include="route.ts"` → 0 fugas al cliente; `grep -rn "details:" src/app/api --include="route.ts" | wc -l` → 0; `npm run test` verde. → SC-002

**Checkpoint US2**: contrato de error único y sin fugas; §0.3 cumplido en su mitad de errores.

---

## Phase 4: US3 — Tipado (P2)

**Goal**: cero `any` en `src/lib` y en las rutas API.

- [ ] T015 [US3] `src/lib/documentProcessor.ts`: eliminar los 5 `any` (líneas 147, 154, 159-161) con interfaces locales para pdf2json (research D-05). **Verif.**: conteo en `src/lib` → **0** (baseline 5); `npm run test` verde. → FR-007
- [ ] T016 [US3] Tipar los filtros dinámicos de Prisma con `Prisma.XWhereInput` en las rutas que los usan (`licitaciones`, `documents`, `config/audit`), conforme a §2.2. **Verif.**: `grep -rn "WhereInput" src/app/api --include="route.ts"` los muestra; sin `any`. → FR-008
- [ ] T017 [US3] Eliminar los `any` restantes de las rutas API por densidad: `licitaciones/[id]` (4), `documents` (3), `config/apis/[id]/test` (3), luego los de 2 y 1 ocurrencia (tabla del plan §US3). Ojo con `documents/route.ts` (FormData/File, riesgo R-02): resolver con interfaces locales, nunca con `any`. **Verif.**: conteo en `src/app/api` → **0** (baseline 29). → FR-007
- [ ] T018 [US3] Si al tipar aflora un bug latente (p. ej. filtro que nunca aplicaba): corregir si es trivial; si cambia comportamiento observable, **detenerse y escalar a ZEUS** — nunca silenciar con un cast (riesgo R-01). **Verif.**: incidencias documentadas en el reporte.
- [ ] T019 [US3] **Gate US3**: ambos conteos en 0; `npm run build` compila; `npm run test` verde; `npm run lint | tail -3` < 112 problemas y 0 errores `no-explicit-any` en las zonas saneadas. Reportar el **número real** de lint, no solo el umbral (research D-08). → SC-003, SC-005, SC-006

**Checkpoint US3**: §0.3 cumplido íntegro en lib y rutas.

---

## Phase 5: US4 — Cobertura de rutas críticas (P2)

**Goal**: ≥15 archivos de test de rutas; los 5 módulos críticos cubiertos.

Cada archivo cubre el mínimo de FR-009: **caso feliz, 401 sin auth, 400 input inválido**. Todos con mocks (T005); ninguno abre BD.

- [ ] T020 [P] [US4] **auth**: test de `auth/logout` (1 archivo). **Verif.**: verde sin BD. → FR-009
- [ ] T021 [P] [US4] **licitaciones**: tests de `licitaciones`, `licitaciones/[id]`, `licitaciones/entidades`, `licitaciones/estados` (4 archivos). → FR-009
- [ ] T022 [P] [US4] **documents**: tests de `documents`, `documents/[id]/logs`, `documents/search` (3 archivos). Nota: el upload maneja FormData — usar fixture de `File` en memoria, sin escribir a disco. → FR-009
- [ ] T023 [P] [US4] **config**: tests de las 7 rutas sin cobertura (`config/apis`, `config/apis/[id]/toggle`, `config/audit`, `config/models`, `config/models/[id]`, `config/models/test`, `config/module-settings`). → FR-009
- [ ] T024 [P] [US4] **research**: test de `research/analyze` mockeando `callModel` (sin inferencia real; ADR_002). **Verif.**: verde y sin llamadas de red. → FR-009
- [ ] T025 [US4] **Gate US4**: `find src/app/api -name "*.test.ts" | wc -l` → **≥ 15** (baseline 3); `docker-compose down && npm run test` verde. → SC-004

**Checkpoint US4**: red de seguridad completa sobre los módulos críticos.

---

## Phase 6: Cierre

- [ ] T026 Medir la tabla completa baseline → resultado (quickstart §0 y §5) y dejarla en el reporte con los números reales. → SC-001…SC-006
- [ ] T027 Snapshot de aislamiento POST y `diff` contra T002 → sin cambios en 5005/5433/5010/5434. → FR-012, SC-008
- [ ] T028 Gate de commit: suite verde, `npm run build` OK, `git status` solo con rutas de 001, `.env` fuera del índice (`.env.test` SÍ va versionado, es dummy). → §0.2
- [ ] T029 Commit(s) en español — uno por tramo si se prefiere granularidad — y reporte a ZEUS con la tabla de números y cualquier incidencia de T018.

---

## Mapa de cobertura FR / SC → tasks

| Requisito | Tasks |
|---|---|
| FR-001 | T003, T004 |
| FR-002 | T005, T006 |
| FR-003 | T007 |
| FR-004 | T009, T010, T011, T014 |
| FR-005 | T008, T009, T010, T011, T014 |
| FR-006 | T012 |
| FR-007 | T015, T017, T019 |
| FR-008 | T016 |
| FR-009 | T020, T021, T022, T023, T024, T025 |
| FR-010 | T019, T026 |
| FR-011 | T013, T026 |
| FR-012 | T002, T027 |
| SC-001 | T007 |
| SC-002 | T014 |
| SC-003 | T015, T017, T019 |
| SC-004 | T025 |
| SC-005 | T019 |
| SC-006 | T019 |
| SC-007 | T013, T026 |
| SC-008 | T027 |

## Dependencias

- T001–T002 antes de todo (evidencia base).
- **US1 (T003–T007) bloquea al resto**: sin suite verde, ningún gate posterior es válido.
- T008 antes que T009–T011 (el helper debe existir para migrar).
- T009–T011 pueden hacerse por módulo, pero cada una cierra con su grep.
- **US2 antes que US3** (research D-06): migrar a `apiError` ya convierte
  `catch (err: any)` en `unknown` en 13 de los 16 archivos; el orden inverso obligaría
  a tocar los mismos archivos dos veces.
- T015–T017 secuenciales por archivo, pero independientes entre módulos.
- T020–T024 son [P] entre sí (archivos nuevos distintos), todas requieren T005.
- T026–T029 cierran, siempre al final.

## Notas de alcance (no hacer aquí)

- `any` en componentes `.tsx` (~28) y en `scripts/*.mjs` — fuera (spec futura).
- El `require()` de pdf2json en `documentProcessor.ts` (error ESLint preexistente)
  — fuera: esta spec se limita a `any` (research D-05).
- Suite de integración con BD real, CI que automatice los gates, Zod, rate limiting,
  paginación pendiente y pipeline de embeddings (H-05) — todo fuera.
