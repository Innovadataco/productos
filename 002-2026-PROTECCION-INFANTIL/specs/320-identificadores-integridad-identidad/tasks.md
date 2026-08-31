---
description: "Task list — SPEC-320 Identificadores: integridad + identidad (A-58 SPEC-A)"
---

# Tasks: Identificadores — integridad + identidad (SPEC-320 · 002-PI-220)

**Input**: Design documents from `specs/320-identificadores-integridad-identidad/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Status**: DESARROLLO (spec+plan aprobados en PARA; diseño asimétrico cerrado). Migración de identidad §2.2 **BLOQUEADA** hasta confirmación del truncate de `Profesor` por el CEO.

**Tests**: incluidos (candado 24 v2 — correr los tests de todo lo que toca lo editado; el proyecto exige `.test.ts` por endpoint CRUD nuevo).

## Convenciones de ruta

Repo `002-2026-PROTECCION-INFANTIL/`. Migraciones aditivas en `prisma/migrations/`. Índices únicos parciales con `NULLS NOT DISTINCT` como SQL crudo dentro de la migración (permitido por constitución §2.1).

---

## Phase 1: Setup (infraestructura compartida)

- [ ] T001 Leer `docs/architecture/00-INDICE.md` y los artefactos de arquitectura relevantes (schema, DAL) antes de tocar `src/` (regla de oro AGENTS.md).
- [ ] T002 Baseline local: `npx tsc --noEmit` + `npm run lint` para conocer el estado base (coordinar turno de builds con Fábrica antes de correr; máquina apretada).

---

## Phase 2: Foundational (prerequisito bloqueante — catálogo base)

**Purpose**: El catálogo de tipos de documento es la fuente de vocabulario que §2.2 (documento profesor) consume. Su tabla + seed deben existir antes de US2.

- [ ] T003 Agregar el modelo `TipoDocumento` a `prisma/schema.prisma` (patrón `Plataforma`: `clave @unique`, `nombre`, `categoria @default("persona")`, `esActiva @default(true)`, `creadoEn`; `@@index([clave])`, `@@index([esActiva])`). Ver data-model §1.
- [ ] T004 Crear migración A (tabla `TipoDocumento`) con `npm run db:migrate` (nombre descriptivo, aditiva).
- [ ] T005 Seed idempotente del catálogo en `prisma/seed.ts` (`upsert` por `clave`): RC, TI, CC, CE, PA, PEP, NIT, OTRO con sus nombres de la norma colombiana. No preguntar a Jelkin (candado siembra parametrizables).
- [ ] T006 [P] Crear el repo `src/lib/dal/repositories/tipo-documento.ts` (patrón `plataforma.ts`: listar activos, obtener por clave, crear, actualizar/estado).
- [ ] T007 [P] Test `src/lib/dal/repositories/tipo-documento.test.ts` (seed presente, unicidad de clave, filtro `esActiva`).

**Checkpoint**: catálogo existe y sembrado; US2 puede validar `tipoDocumento` contra él.

---

## Phase 3: User Story 1 — Un identificador pertenece a una sola persona por colegio (Priority: P1) 🎯

**Goal**: unicidad del identificador por colegio con diseño asimétrico (estudiante/profesor red dura de BD; acudiente por-acudiente) + warn-con-override cross-sujeto. Cierra el bug I-213 y la alerta duplicada.

**Independent Test**: registrar el mismo identificador en dos personas del mismo colegio → aviso de a quién pertenece; en dos colegios distintos → permitido; reporte contra identificador compartido → una sola alerta.

### Esquema y migración (§2.1)

- [ ] T008 [US1] Agregar `colegioId String` + relación a `Colegio` + `@@index([colegioId, estado])` a `IdentificadorEstudiante` en `prisma/schema.prisma` (H1). Mantener `@@map("IdentificadorAlumno")` / `@map("alumnoId")`.
- [ ] T009 [US1] Reescribir los tres `@@unique` de identificador a la forma asimétrica (data-model §3.3): estudiante y profesor → `(colegioId, tipo, valor, plataformaId)`; acudiente → se mantiene `(acudienteId, tipo, valor, plataformaId)`. (En Prisma se documenta; la constraint real la crea el SQL crudo de T011.)
- [ ] T010 [US1] Crear migración B: `ALTER TABLE "IdentificadorAlumno" ADD COLUMN "colegioId"` + backfill `UPDATE ... SET "colegioId" = (SELECT "colegioId" FROM "Alumno" ...)` + `SET NOT NULL` + FK. Verificar datos antes (SELECT de duplicados por `(colegioId, valor)` cruzando los tres sujetos — Fábrica corrió: 0; re-verificar al desencolar) y reportar el hallazgo a Fábrica (señal pre-migración).
- [ ] T011 [US1] En la misma migración B: DROP de los `@@unique` viejos y `CREATE UNIQUE INDEX ... WHERE estado='activo' NULLS NOT DISTINCT` para estudiante `(colegioId,tipo,valor,plataformaId)`, profesor `(colegioId,tipo,valor,plataformaId)`, acudiente `(acudienteId,tipo,valor,plataformaId)` (SQL crudo, PG16). Ver research §R3/R4.

### Servicio de unicidad cross-sujeto (§2.1)

- [ ] T012 [US1] Crear `src/lib/colegio/identificador-unicidad.ts`: dado `(colegioId, valorNormalizado, sujetoExcluido)`, consulta las tres tablas (`estado='activo'`) y devuelve `{ pertenece: [{ nombre, rol }] }` de otras personas del colegio. Un solo lugar (candado 22 v5).
- [ ] T013 [P] [US1] Test `src/lib/colegio/identificador-unicidad.test.ts`: mismo valor en otra persona del colegio → lo reporta; en otro colegio → no; misma persona → no; respeta `estado`.

### Repos — escribir colegioId + búsqueda de unicidad

- [ ] T014 [US1] `identificador-estudiante.ts`: `crear()` escribe `colegioId`; ajustar `buscarDuplicado` a la constraint por colegio; sin tocar `buscarActivosPorValor` (cross-tenant). Actualizar `identificador-estudiante.test.ts` (candado 24 v2: assert fuerte del nuevo comportamiento + cobertura del colegioId).
- [ ] T015 [P] [US1] `identificador-profesor.ts`: ajustar `buscarDuplicado` a la constraint por colegio; `buscarActivosPorValor` intacto. Actualizar `identificador-profesor.test.ts`.
- [ ] T016 [P] [US1] `identificador-acudiente.ts`: `buscarDuplicado` se mantiene por-acudiente (excepción); `buscarActivosPorValor` intacto. Actualizar `identificador-acudiente.test.ts` con el caso padre-de-dos-hijos.

### Callsites de validación (los 8 del barrido) — invocar el servicio de unicidad

- [ ] T017 [US1] `src/app/api/colegio/alumnos/[id]/identificadores/route.ts:103` (alta estudiante) — usar el servicio de unicidad + warn/override.
- [ ] T018 [P] [US1] `src/app/api/colegio/identificadores/[id]/route.ts:68` (edición estudiante).
- [ ] T019 [P] [US1] `src/app/api/colegio/acudientes/[id]/identificadores/route.ts:102` (alta acudiente).
- [ ] T020 [P] [US1] `src/app/api/colegio/acudientes/[id]/identificadores/[identificadorId]/route.ts:75` (edición acudiente).
- [ ] T021 [P] [US1] `src/app/api/colegio/profesores/[id]/identificadores/route.ts:102` (alta profesor).
- [ ] T022 [P] [US1] `src/app/api/colegio/identificadores-profesor/[id]/route.ts:67` (edición profesor).
- [ ] T023 [P] [US1] `src/app/api/colegio/cursos/unificado/route.ts:157` (carga unificada, en tx) — unicidad cross-sujeto.
- [ ] T024 [P] [US1] `src/lib/colegio/carga/importer.ts:111` (carga masiva, en tx) — unicidad cross-sujeto + `crear()` escribe colegioId.
- [ ] T025 [US1] Contrato del warn: shape `{ aviso: { code, message, pertenece } }` + parámetro `confirmarCompartido` + `AuditLog` del override (contracts §B; FR-018). Aplicar consistente en los 8 callsites.
- [ ] T026 [US1] Tests de integración de API para el warn/override (al menos alta estudiante + alta acudiente padre-de-dos-hijos) usando `Request` nativo (patrón AGENTS.md).

**Checkpoint**: US1 entregable e independientemente testeable. El bug de alerta duplicada (`alertas.ts`, NO tocado) queda resuelto en origen.

---

## Phase 4: User Story 2 — El profesor tiene identidad completa (Priority: P1)

**Goal**: documento de identidad del profesor obligatorio (tipo, número, año de nacimiento, sexo, teléfono, email), llave `(colegioId, tipoDocumento, numeroDocumento)`, sin backfill. Bonus: normalizar búsqueda por nombre.

**⚠️ BLOQUEO**: la migración T028 NO se ejecuta hasta que el CEO decida la estrategia (research §R5). Dos opciones en mesa: **(1) truncate** de `Profesor`+hijas (arrastra `AlertaColegio` vía FK `identificadorProfesorId` — confirmado en schema:1391) o **(2) placeholder por-fila** `numeroDocumento='MIGR-'||id` + NOT NULL (sin truncate, sin tocar FKs, los 2 profesores de prueba sobreviven editables). El resto del diseño/código puede prepararse.

**Independent Test**: crear profesor sin documento → no deja; documento repetido en el colegio → no deja.

- [ ] T027 [US2] Extender `model Profesor` en `prisma/schema.prisma`: `tipoDocumento`, `numeroDocumento`, `anioNacimiento Int`, `sexo`, `telefono` (ya no nullable), `email` (ya no nullable), todos obligatorios; `@@unique([colegioId, tipoDocumento, numeroDocumento])`. Ver data-model §2.
- [ ] T028 [US2] ⚠️ **BLOQUEADA** — Migración C (identidad profesor): columnas obligatorias + `NOT NULL`. Estrategia PENDIENTE de veredicto del CEO (una de las dos opciones arriba). Si opción (2) placeholder: `UPDATE` por-fila con `numeroDocumento='MIGR-'||id` (único, no choca con el UNIQUE) antes de `SET NOT NULL` — sin truncate ni toque a FKs. Si opción (1): la tabla se trunca antes (lo corre el CEO). Verificar estado de `Profesor` antes; reportar señal pre-migración. No ejecutar hasta confirmación de Fábrica.
- [ ] T029 [US2] `profesorBodySchema` en `src/lib/schemas/index.ts`: agregar los campos de identidad obligatorios; `tipoDocumento` validado contra el catálogo (clave activa); `sexo` set cerrado.
- [ ] T030 [US2] `src/lib/dal/repositories/profesor.ts`: `crear()` con identidad; nueva búsqueda de duplicado por documento `(colegioId, tipoDocumento, numeroDocumento)`.
- [ ] T031 [US2] `src/app/api/colegio/profesores/route.ts:113`: exigir identidad (400 por campo faltante); 409 por documento duplicado en el colegio; conservar 409 nombre+apellidos.
- [ ] T032 [US2] Normalizar `buscarPorNombreApellidosEnColegio` (insensible a mayúsculas/acentos) en `profesor.ts` (FR-011, research §R7).
- [ ] T033 [P] [US2] Actualizar `profesor.test.ts` + test de integración de `POST /api/colegio/profesores`: alta sin documento → 400; documento duplicado por colegio → 409; nombres "JUAN"/"Juan" → mismo (normalizado).

**Checkpoint**: US2 entregable (excepto la aplicación de la migración C, que espera el truncate).

---

## Phase 5: User Story 3 — Un solo catálogo de tipos de documento, administrable (Priority: P2)

**Goal**: admin CRUD del catálogo; los tres sujetos + los 6 sitios del vocabulario comité consumen la fuente única; migrar datos existentes al vocabulario unificado.

**Independent Test**: admin agrega un tipo → aparece en los tres formularios; `CC` y `CEDULA_CIUDADANIA` quedan referidos a la misma clave.

- [ ] T034 [US3] Endpoints admin del catálogo: `GET/POST /api/admin/tipos-documento`, `PATCH /api/admin/tipos-documento/[id]` (contracts §A; rol ADMIN, patrón admin existente).
- [ ] T035 [US3] Migración A' (datos): unificar vocabulario comité → clave del catálogo (`CEDULA_CIUDADANIA`→`CC`, `CEDULA_EXTRANJERIA`→`CE`, `PASAPORTE`→`PA`). Verificar valores distintos presentes antes; reportar señal pre-migración.
- [ ] T036 [US3] Re-apuntar los **6 sitios** del vocabulario comité al catálogo (data-model §4, ninguno afuera): `schema.prisma:419` (retirar/deprecar enum `TipoIdentificacionIntegrante`), `schemas/index.ts:415`, `admin/comite/integrantes/route.ts:10`, `admin/comite/integrantes/[id]/route.ts:10`, `colegio/comite/integrantes/[id]/route.ts:17`, `dal/types/comite.ts:25,35`.
- [ ] T037 [P] [US3] Reemplazar el enum estudiante `documentoTipoEstudianteSchema` (`schemas/index.ts:244`) por validación contra el catálogo.
- [ ] T038 [P] [US3] Reemplazar el hardcode `DOCUMENTO_TIPO_OPCIONES` (`src/components/modules/colegio/unificado/tipos.ts:52`) por consumo del catálogo (activos).
- [ ] T039 [P] [US3] Tests: CRUD del catálogo (`admin/tipos-documento` `.test.ts`); comité/estudiante validan contra catálogo; datos migrados quedan en la misma clave.

**Checkpoint**: vocabulario único (3→1); tipo agregado por admin visible en los tres formularios.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T040 Regenerar artefactos de `docs/architecture/` (schema/DAL cambiaron) y dejar `npm run arch:check` en VERDE en el mismo PR (exigido por CI/AGENTS.md).
- [ ] T041 Verificar que `scripts/verify-hnsw-indexes.ts` (5 índices críticos) NO se ve afectado (los nuevos índices parciales no son de esa lista).
- [ ] T042 Gate de calidad completo antes de push (coordinar turno con Fábrica): `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build` + `./scripts/dev-restart.sh`.
- [ ] T043 Disciplina de specs: `Status` canónico actualizado, sección "Impacto en arquitectura:" real, fila en `specs/README.md`.
- [ ] T044 Evidencia §6 en producción (quickstart.md, 5 ejercicios) — Jelkin prueba, capturas al PR; Fábrica audita.

---

## Dependencies & Order

- **Setup (P1)** → **Foundational (P2, catálogo base)** → historias.
- **US1 (§2.1)** es independiente del catálogo; puede ir en paralelo a Foundational salvo el gate de build.
- **US2 (§2.2)** depende de Foundational (catálogo para `tipoDocumento`). Su **migración C (T028) está BLOQUEADA** hasta el truncate confirmado por el CEO.
- **US3 (§2.3)** cierra el consumo del catálogo por los tres sujetos + 6 sitios comité + migración de datos.
- **Polish** al final; T040 (arch:check) obligatorio en el PR.

## Orden de migraciones (plan.md)

A (catálogo tabla+seed, T004/T005 + datos A' T035) → B (unicidad, T010/T011) → C (identidad profesor, T028 · BLOQUEADA). Verificación de datos antes de cada una (señal pre-migración a Fábrica).

## MVP sugerido

US1 (§2.1) — cierra el bug de integridad de la llave del producto (I-213) y la alerta duplicada. Es el mayor valor y no depende del truncate ni del catálogo.
