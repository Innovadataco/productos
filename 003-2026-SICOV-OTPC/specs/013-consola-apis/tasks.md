# Tasks: 013 — Consola de APIs de la Super (Fase 1: UI + estructura + logging, SOLO stub)

**Input**: Design documents from `/specs/013-consola-apis/`
**Prerequisites**: [plan.md](./plan.md) (corregido por ZEUS-003), [spec.md](./spec.md)
**Tests**: INCLUIDOS — FR-008 exige tests (catálogo, ejecutar-stub cero red, redacción, 403 real, bitácora).

**Correcciones ZEUS-003 embebidas**: `@db.Json` → **`jsonb`**; redacción de sensibles **RECURSIVA**
(objetos/arrays anidados, no solo primer nivel).

**Coordinación con 009**: depende del guard de submódulo (`requiereModulo(u,"configuracion","apis")`)
y del módulo `configuracion` + submódulo `apis` sembrados en 009 (T007/T008/T010 de 009). **NO
resembrar**: 013 arranca tras la Foundational de 009.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1 (catálogo+ejecución stub), US2 (logging)

## Path Conventions

`src/lib/consola-apis/**` (lib), `src/app/api/configuracion/apis/**` (endpoints),
`src/app/dashboard/configuracion/apis/**` (UI), `prisma/**` (esquema/migración). Tests `*.test.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: no hay setup propio — reusa la tanda de datos de 009. Punto de control de precondición.

- [ ] T001 Verificar precondición: la Foundational de 009 está aplicada (columna `usm_submodulo_id`, guard extendido, módulo `configuracion` + submódulo `apis` sembrados por nombre). Si no, completar 009 Foundational primero

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tabla de bitácora `tbl_api_llamadas` (nueva, aditiva) — la necesitan US1 (registro de ejecución) y US2 (consulta).

- [ ] T002 En [prisma/schema.prisma](../../prisma/schema.prisma) añadir el modelo `ApiLlamada` (`@@map("tbl_api_llamadas")`, `@@schema("sicov")`, prefijo `apl_`): `request`/`respuesta` como `Json? @db.JsonB` (ZEUS: jsonb, no Json); índices `@@index([creado])`, `@@index([operacion])`, `@@index([modo])`; `creado @db.Timestamptz()`
- [ ] T003 Generar migración `npx prisma migrate dev --create-only --name add_consola_apis` (solo CREATE) — revisión del SQL
- [ ] T004 Aplicar la migración (`pg_dump` previo) + `npx prisma generate`. Puede ir en la MISMA tanda de datos que 009

**Checkpoint**: tabla de bitácora lista; jsonb confirmado en el SQL.

---

## Phase 3: User Story 1 - Catálogo y ejecución SOLO contra el stub (Priority: P1) 🎯 MVP

**Goal**: rol 1 ve el catálogo de operaciones, ejecuta contra el stub y ve request/respuesta/duración. "Ejecutar en real" visible pero DESHABILITADO (doble candado: gate env apagado + `FASE_CONSOLA=1`).

**Independent Test**: rol 1 ejecuta una operación → respuesta stub + `modo:"stub"`, cero tráfico a `*.supertransporte.gov.co`. POST con `real=true` → 403 "Fase 2". Roles 2/3 → 403.

### Tests for User Story 1 ⚠️

- [ ] T005 [P] [US1] Test del catálogo en `src/lib/consola-apis/catalogo.test.ts`: cada entrada declara ejecutor válido ∈ métodos de `ClienteSupertransporte`; `FASE_CONSOLA === 1`; 006/007/008 marcadas "pendiente" (no ejecutables)
- [ ] T006 [P] [US1] Test de `ejecutarOperacion` en `src/lib/consola-apis/ejecutar.test.ts`: usa `getClienteSupertransporte()` (stub por gate), **cero red**, registra en éxito y en error, nunca lanza sin registrar
- [ ] T007 [P] [US1] Test de endpoint `src/app/api/configuracion/apis/ejecutar/route.test.ts`: 403 roles 2/3, 400 payload inválido (intento registrado), 403 fijo cuando `real=true` (Fase 2)

### Implementation for User Story 1

- [ ] T008 [US1] Crear `src/lib/consola-apis/catalogo.ts`: constante tipada de las 7 operaciones Fase 1 (despachos, llegadas, mantenimiento base/preventivo/correctivo, integradora, maestras×2) + entradas "pendiente" 006/007/008; cada una {clave, título, método, pathExterno, cabeceras (nombres), ejemplo, ejecutor, opciones}; `FASE_CONSOLA = 1`; tabla ejecutor→método del cliente (`postTransaccional`|`postMantenimiento`|`getMantenimiento`|`consultarIntegradora`|`consultarRutasActivas`|`consultarAutorizaciones`)
- [ ] T009 [US1] Crear `src/lib/consola-apis/ejecutar.ts`: `ejecutarOperacion(clave, payload, usuario)` — valida contra catálogo, cronometra, despacha por la tabla de ejecutores a `getClienteSupertransporte()` (stub), redacta y registra en `ApiLlamada` (siempre); devuelve {respuesta, duracionMs, logId, modo}
- [ ] T010 [US1] Crear `GET src/app/api/configuracion/apis/catalogo/route.ts` (`verifyAuth([1])` + `requiereModulo(u,"configuracion","apis")`) y `POST src/app/api/configuracion/apis/ejecutar/route.ts` (stub + bitácora; body `real=true` → 403 fijo Fase 1)
- [ ] T011 [US1] UI `src/app/dashboard/configuracion/apis/page.tsx`: lista de operaciones + formulario (ejemplo editable) + resultado (request/respuesta/duración) + botón "Ejecutar en real" `disabled` con nota "Fase 2 — requiere habilitación del CEO". Hereda breadcrumb (I-14)

**Checkpoint**: US1 funcional — ejecutar stub, ver resultado, botón real bloqueado (UI + 403 server-side).

---

## Phase 4: User Story 2 - Logging de llamadas (Priority: P1) 

**Goal**: toda ejecución queda en bitácora (usuario, operación, modo, request/response redactados, status, duración, timestamp Bogotá); consultable y paginada con filtros.

**Independent Test**: ejecutar (éxito y error) → fila con modo `stub`, payload REDACTADO (recursivo), respuesta/error, duración; consultar bitácora → paginación + filtros. Ningún token/clave en BD.

### Tests for User Story 2 ⚠️

- [ ] T012 [P] [US2] Test de redacción **RECURSIVA** en `src/lib/consola-apis/redactar.test.ts`: clave sensible (`clave`,`contrasena`,`token`,`tokenAutorizado`,`Authorization`) en objeto/array ANIDADO a cualquier profundidad → `"***"`; truncado a 8 KB por columna
- [ ] T013 [P] [US2] Test de bitácora paginada en `src/app/api/configuracion/apis/llamadas/route.test.ts`: paginación server-side, filtros (operacion, modo, status, fecha), solo rol 1

### Implementation for User Story 2

- [ ] T014 [US2] Crear `src/lib/consola-apis/redactar.ts`: redacción RECURSIVA por lista de claves (recorre objetos y arrays anidados a cualquier profundidad) + truncado a 8 KB por columna jsonb (documentado)
- [ ] T015 [US2] Integrar `redactar()` en `ejecutar.ts` (T009) ANTES de persistir request/respuesta; registrar `modo` desde `modoIntegracion()` (stub|real) para que Fase 2 use el mismo esquema
- [ ] T016 [US2] Crear `GET src/app/api/configuracion/apis/llamadas/route.ts`: bitácora **paginada server-side estándar** (`page`/`pageSize`, `DEFAULT_PAGE_SIZE=25`, `MAX_PAGE_SIZE=100`, `findMany`+`count` en `Promise.all` — §4.3 constitución — P1) con filtros (operacion, modo, status, fecha), solo rol 1 + guard; detalle por fila
- [ ] T017 [US2] Añadir a la UI (T011) el panel de bitácora paginada con filtros y detalle por fila

**Checkpoint**: US1 + US2 — ejecución stub + bitácora completa con redacción recursiva.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T018 [P] Test de guardarraíl anti-red a nivel suite: confirmar que ninguna ejecución de consola alcanza `*.supertransporte.gov.co` (reusa el mock global de la suite)
- [ ] T019 Ejecutar suite completa + `tsc --noEmit` + lint + `build`; suite previa verde
- [ ] T020 Verificación en navegador (ventana privada): ejecutar una operación stub → ver bitácora → confirmar botón real deshabilitado y 403 del endpoint real
- [ ] T021 Commit por fase con staging explícito (AGENTS §6): `feat(003-US1-013)`, `feat(003-US2-013)`

---

## Phase 6: CIERRE (obligatorio antes de FINALIZAR — no "algún día", evita I-11)

**Purpose**: completar el set de artefactos de la regla de oro §1.5.1 que el MODO PLAN difirió.

- [ ] T022 Escribir `specs/013-consola-apis/quickstart.md`: guion de humo (ejecutar operación stub → ver respuesta+duración → consultar bitácora → confirmar botón real deshabilitado y 403 del endpoint real)
- [ ] T023 [P] Crear `specs/013-consola-apis/checklists/` con el checklist de validación (cero red, doble candado, jsonb, redacción recursiva, sin tokens en BD)
- [ ] T024 Escribir `cierre.md` + sección Implementación en `spec.md` + deuda técnica (purga/exportación de bitácora); estado → PENDIENTE DE PRUEBA/FINALIZADO

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: precondición = Foundational de 009 aplicada (guard submódulo + seed `configuracion/apis`).
- **Foundational (P2)**: tabla `tbl_api_llamadas`; BLOQUEA US1/US2. Puede ir en la misma tanda de datos de 009.
- **US1 (P3)** y **US2 (P4)**: ambas P1; US2 se apoya en `ejecutar.ts` de US1 (T009→T015). US1 registra usando la tabla de Foundational.
- **Polish (P5)**: tras US1+US2.

### Coordinación con 009

- 013 arranca **después** de la Foundational de 009 (guard extendido T010 + seed `configuracion/apis` T007/T008). No duplica seeds ni migración de módulos.
- La migración `add_consola_apis` (T002-T004) es independiente de la de 009 y puede aplicarse en la misma tanda.

### Parallel Opportunities

- T005/T006/T007 (tests US1) en paralelo; T012/T013 (tests US2) en paralelo.
- Redacción (T014) es independiente y puede escribirse en paralelo con el catálogo (T008).

---

## Implementation Strategy

### MVP First (US1)

1. Precondición 009 → 2. Foundational (tabla) → 3. US1 (catálogo + ejecutar stub + UI) → validar cero red + 403 real → demo.

### Incremental Delivery

Foundational → US1 → US2 (logging + bitácora) → Polish. Paso a Fase 2 = habilitar gate + retirar `FASE_CONSOLA`, sin reestructurar.

---

## Notes

- **Doble candado**: gate env (`INTEGRACIONES_MODO=stub` + `SUPERTRANSPORTE_HABILITADO=false`) + `FASE_CONSOLA=1` en código. El endpoint real responde 403 fijo; NO existe código de ejecución real detrás.
- **jsonb** (ZEUS): `request`/`respuesta` con `@db.JsonB`, no `@db.Json`.
- **Redacción RECURSIVA** (ZEUS): campos sensibles anidados a cualquier profundidad → `"***"`, no solo primer nivel.
- Cero tráfico a la Super (Fase 1): todo por el stub vía la factory con gate.
- Commit tras cada tarea o grupo lógico; staging explícito.
