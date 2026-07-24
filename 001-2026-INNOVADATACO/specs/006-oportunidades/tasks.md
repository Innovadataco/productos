# Tasks: Oportunidades (evolución de Licitaciones)

**Input**: Design documents from `specs/006-oportunidades/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (**Aprobada, D-056**),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Rama**: `feature/001-scaffolding` (PRUEBAS). Commit + push en el mismo acto, staging
explícito por ruta (prohibido `git add -A`). **No es trabajo pesado: sin turno.**

**Riesgo central (RZ-4)**: la migración toca datos vivos con semilla. **Ensayo en BD
desechable primero (D-039); NO aplicar a la viva sin conteo antes/después verde (SC-003).**

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos). Cada tarea con su verificación.

---

## Phase 1: Baseline

- [x] T001 Baseline (quickstart §0): suite **249/36**, `tsc` limpio; anotar `count(*)` de
      `licitaciones`, `LicitacionStatus`, `EntidadLicitacion` en la viva (solo lectura).
- [x] T002 [P] Confirmar rama `feature/001-scaffolding` y stack respondiendo en 5001. No bajarlo.

---

## Phase 2: Esquema y migración (US1 — el riesgo)

- [x] T003 Esquema Prisma: modelo **`TipoOportunidad`** (key único, nombreOficial,
      `exigeNumero`/`exigeFechaApertura` bool); evolucionar `Licitacion` (`numero?`,
      `fechaApertura?`, `tipoId?`+index, `ciudadEjecucion?`, 4 fechas de cronograma,
      relación `partidas`); nuevo **`PartidaPresupuesto`** (CASCADE); columnas ampliadas
      opcionales en `EntidadLicitacion`. Comentar el `@@unique([numero, fechaApertura])`
      (FR-006). → data-model
- [x] T004 Migración `add_oportunidades` en el **orden seguro**: (1) crear tablas y columnas
      nullable/default; (2) sembrar 3 tipos; (3) `UPDATE licitaciones SET tipoId=<licitación
      pública> WHERE tipoId IS NULL`; (4) **después** relajar `NOT NULL` de `numero` y
      `fechaApertura`. → FR-004, R-01, R-02
- [x] T005 **Gate migración (SC-003)** en **BD desechable** (D-039): `count(*)` de los tres
      catálogos/tabla idéntico antes y después; ninguna oportunidad sin `tipoId`; `numero`/
      `fechaApertura` conservados. Si algo no cuadra, **detenerse y reportar**. **No** aplicar a
      la viva aún.

**Commit 1** — esquema + migración (ensayada). Push.

---

## Phase 3: Catálogo de tipos (US2)

- [x] T006 [US2] `src/app/api/licitaciones/tipos/route.ts`: `GET` (lista) y `POST` (crea con
      `key`, `nombreOficial`, `exigeNumero`, `exigeFechaApertura`), con `verifyAuth` +
      `apiError`. → FR-002, FR-019
- [x] T007 [US2] `tipos/route.test.ts`: 401 sin sesión; GET lista; POST valida requeridos y
      crea; sin fuga de `err.message`. → FR-002, FR-019, FR-020
- [x] T008 [US2] `scripts/seed.mjs`: `sembrarPorClave(prisma.tipoOportunidad, ...)` con los 3
      tipos (idempotente); README de arranque limpio suma el catálogo. → FR-005
- [x] T009 [US2] **Gate tipos**: `npm run seed` dos veces no duplica; `GET /tipos` ≥ 3. → SC-004

**Commit 2** — catálogo de tipos. Push.

---

## Phase 4: Validación por tipo + enriquecimiento (US1, US3)

- [x] T010 [US1] `POST /api/licitaciones`: exigir `titulo` y `tipoId`; exigir
      `numero`/`fechaApertura` **solo si** el tipo referenciado tiene `exigeNumero`/
      `exigeFechaApertura` (leídas de BD, **sin `if` por nombre**). Migrar el `catch` a
      `apiError`. → FR-003, §0.7
- [x] T011 [US3] `POST`/`PATCH`: aceptar y persistir `ciudadEjecucion`, los 4 hitos nuevos de
      cronograma, y las **partidas** de presupuesto (concepto, monto ≥ 0 validado, moneda).
      → FR-007, FR-008, FR-009
- [x] T012 [US3] `GET`/`GET [id]`: incluir `tipo`, `partidas` (con total calculado), cronograma,
      ciudad y la **entidad ampliada** en la respuesta. → FR-008, FR-010
- [x] T013 [US1/US3] Extender `licitaciones/route.test.ts` y `[id]/route.test.ts`: SC-001 (crea
      sin numero/fecha para tipo sin exigencias), SC-002 (rechaza licitación pública sin ellos),
      partidas/cronograma/ciudad persistidos, total = suma, monto negativo → 400. Mantener 401 y
      contrato. → FR-003, FR-007, FR-008, SC-001, SC-002, SC-005, SC-006
- [x] T014 [US1/US3] **Gate**: pruebas verdes; la validación por tipo verificada con un tipo
      configurado a mano (banderas), no por nombre. → SC-001, SC-002

**Commit 3** — validación por tipo + enriquecimiento. Push.

---

## Phase 5: Expediente — SIN RAG (US4)

- [x] T015 [US4] `src/app/api/licitaciones/[id]/documentos/route.ts`: `POST` sube archivo
      (PDF/`.xlsx`/`.xls`), valida **tipo** y **tamaño** (413), sanea nombre, guarda en
      `uploads/`, crea `LicitacionDocumento`. **Sin** extracción, **sin** cola, **sin**
      embeddings. `GET` lista el expediente. `verifyAuth` + `apiError`. → FR-011, FR-012, FR-015
- [x] T016 [US4] `[id]/documentos/route.test.ts`: 401 sin sesión; PDF y Excel aceptados; tipo
      no permitido → 400; excede tamaño → 413; **`expect(prisma.documentoChunk.create).not.toHaveBeenCalled()`**
      (SC-008); CASCADE al borrar la oportunidad. → FR-011…FR-015, SC-007, SC-008, SC-009
- [x] T017 [US4] **Gate expediente**: pruebas verdes; revisión de que la ruta **no importa**
      nada del pipeline RAG. → FR-013, SC-008

**Commit 4** — expediente. Push.

---

## Phase 6: Interfaz (US5)

- [x] T018 [US5] Quitar el botón "Nueva" de `ListadoSubmodulo` (`LicitacionesTab.tsx:220`); la
      creación permanece en `NuevaSubmodulo`. → FR-016
- [x] T019 [US5] Renombrar textos visibles "Licitación(es)" → "Oportunidad(es)" en
      `LicitacionesTab.tsx`, `LicitacionForm.tsx`, `LicitacionCard.tsx` y los títulos de
      submódulo en `WorkspaceContext.tsx`. Sin tocar identificadores técnicos (SC-011). → FR-017
- [x] T020 [US5] Sumar al formulario ("Nueva") el **selector de tipo** (catálogo) y los campos
      nuevos (cronograma, ciudad, partidas); solo cambian textos del resto (RZ-5). → FR-018
- [x] T021 [US5] Submódulo "Tipos" en `SUBMODULES.licitaciones` con su tab (patrón de
      Entidades/Estados). → FR-002
- [x] T022 [US5] **Gate UI**: listado sin botón de crear; `grep` de "Licitaci" en textos
      visibles → 0. → SC-010, SC-011

**Commit 5** — interfaz. Push.

---

## Phase 7: Cierre y despliegue

- [x] T023 Gates globales: `npx vitest run` ≥ 249 sin BD ni Ollama; `npx tsc --noEmit` limpio;
      `npx eslint src/lib src/app/api` → 0 `no-explicit-any`. → SC-012, SC-013
- [x] T024 Aislamiento: puertos 5005/5433/5010/5434 y el RAG intactos; `git diff --cached
      --name-only` solo rutas de `001-`. → SC-014
- [x] T025 **Aplicar la migración a la viva** solo tras T005 verde: `npx prisma migrate deploy`
      + `npm run seed` (idempotente); reconstruir imagen y recrear app/worker acotando la
      interrupción (SPEC-004), sin bajar PI/SICOV. Verificar `count(*)` sin cambios en la viva
      (SC-003) y HTTP 200. → SC-003, SC-014
- [x] T026 Reporte de una línea a ZEUS; commits scopeados y pusheados.

---

## Mapa de cobertura FR / SC → tasks

| Requisito | Tasks |
|---|---|
| FR-001, FR-004 | T004, T005 |
| FR-002 | T006, T007, T021 |
| FR-003 | T010, T013 |
| FR-005 | T008, T009 |
| FR-006 | T003 |
| FR-007…FR-009 | T011, T012, T013 |
| FR-010 | T003, T012 |
| FR-011…FR-015 | T015, T016 |
| FR-013 | T015, T016, T017 |
| FR-016 | T018 |
| FR-017 | T019 |
| FR-018 | T020 |
| FR-019, FR-020 | T007, T013, T016, T023 |
| FR-021 | T024 |
| SC-001, SC-002 | T013, T014 |
| SC-003 | T005, T025 |
| SC-004 | T009 |
| SC-005, SC-006 | T013 |
| SC-007…SC-009 | T016 |
| SC-008 | T016, T017 |
| SC-010, SC-011 | T022 |
| SC-012, SC-013 | T023 |
| SC-014 | T024, T025 |

## Dependencias

- T001–T002 antes de todo.
- **T003→T004→T005**: el esquema, la migración y su ensayo van en orden; **T005 (cero pérdida)
  bloquea** aplicar a la viva (T025).
- Catálogo de tipos (T006–T009) antes de la validación por tipo (T010): la validación lee el
  tipo.
- Enriquecimiento (T011–T013) tras el esquema (T003).
- Expediente (T015–T017) independiente una vez hay esquema.
- UI (T018–T022) tras las rutas.
- **T025 (aplicar a la viva) al final y solo con T005 verde.**

## Fuera de alcance (NO tocar)

- Kanban / flujo de estados (SPEC-007).
- Análisis documental del expediente (no es Base Oficial): sin OCR, chunking ni embeddings.
- Renombre físico del modelo/tabla/rutas (identificador técnico conservado, SC-011).
- `any` de componentes `.tsx` preexistentes (D-016).
- Base Oficial, pipeline RAG, 002-Protección Infantil, 003-SICOV.

---

## Resultado (2026-07-23)

Implementación completa sin turno (no hay inferencia). Commits, uno por fase:
`7abae8cc` esquema+migración · `ffdb0b2e` catálogo de tipos · `abbf889f` validación por
tipo + enriquecimiento · `03ac5a3e` expediente · `df376a6c` interfaz.

| Gate | Resultado |
|---|---|
| Suite sin BD ni Ollama | **282 verdes** (baseline 249) |
| `npx tsc --noEmit` | limpio |
| `npx eslint src/lib src/app/api` | **0** `no-explicit-any` |
| `npm run build` | compila con las rutas nuevas (tipos, expediente) |
| Migración (SC-003, cero pérdida) | **ensayada en BD desechable** y luego aplicada a la viva; conteo 2/5/52 idéntico antes y después en ambas |
| FR-004 | las 2 oportunidades vivas quedaron "licitación pública" conservando numero/fechaApertura |
| Puertos 5005/5433/5010/5434 + RAG | intactos (PI/SICOV healthy; DocumentoChunk sin tocar) |

**Verificación en vivo tras el despliegue** (token propio de 15 min, limpiado):
- SC-001: crear una contratación directa **sin** numero/fecha → **201**, tipo correcto.
- SC-002: crear una licitación pública **sin** numero → **400**.
- Catálogo `/api/licitaciones/tipos` devuelve los 3 tipos con sus banderas.
- La oportunidad de prueba se **borró** (CASCADE dejó 0 partidas huérfanas); back a 2.

**Cobertura con mocks**: tipos (FR-002), validación por tipo SC-001/SC-002 (FR-003),
partidas/cronograma/ciudad (FR-007/008/009), expediente PDF/Excel con 413 y SC-008
($executeRaw no llamado — no toca el RAG), 401 en toda ruta nueva.

## Frontera respetada

- **El expediente NO pasa por el RAG** (FR-013/SC-008): la ruta no importa nada del
  pipeline; el test lo blinda con `$executeRaw` no llamado.
- **La obligatoriedad de campos es una bandera del tipo** (§0.7): la validación lee
  `exigeNumero`/`exigeFechaApertura` de BD; no hay `if` por nombre de tipo.
- **Identidad técnica conservada** (SC-011): el renombre es de cara al usuario; el modelo
  Prisma, la tabla y las rutas siguen igual, minimizando el riesgo de la migración.
- **Kanban de estados NO tocado** (SPEC-007, RZ-6).
