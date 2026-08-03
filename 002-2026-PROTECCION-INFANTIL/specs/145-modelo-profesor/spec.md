# Feature Specification: SPEC-145 — Modelo `Profesor` mínimo

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-03

**Status**: PLANEADO

**Input**: Instructivo 002-PI-058 (orden 2 del brief §10; radica ZEUS, luz verde tras
CUMPLE de SPEC-157). Fuente VINCULANTE: BRIEF-DISEÑO-UX-RECTOR v3.0 §7.2 (`Profesor`
mínimo) + §7.4 (candados de datos) + §3 (terminología: siempre "profesor", nunca
docente/maestro/instructor). Cargas adicionales del REVISO de 157: **O-2** (test de
`LuzAmbiental`), **O-1** (restaurar oráculo amplio con fixture `M1`/`M2` en
mayúscula), **I-49** (verificar que la migración no pise el drift de índices). Lo que
NO existe hoy: el modelo `Profesor` en el schema (verificado 2026-08-03: `Curso` solo
tiene `nombre/grado/anioLectivo/estado`), la relación `Curso.profesorTitularId` y el
CRUD `/api/colegio/profesores`. La pantalla de profesores es SPEC-148; la asignación
en el wizard es SPEC-146 — esta SPEC entrega modelo + API.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Modelo `Profesor` y relación con `Curso`, sin pisar la mina del drift (Priority: P1)

Como plataforma, quiero un modelo `Profesor` mínimo (nombre, apellidos, email?,
teléfono?, estado) por colegio y la relación aditiva `Curso.profesorTitularId`, de
modo que las vistas del rector (146/147/148) tengan al actor central sin retro-
asignar nada a los cursos existentes.

**Why this priority**: Es la base de datos de las specs 146/147/148; y es la PRIMERA
migración nueva tras la 144: si pisa el drift de índices (trigram de ciudades,
vectoriales del motor, `AlertaColegio_patronInstitucionalId_idx`) rompe producción.

**Independent Test**: `migrate deploy` aplica SOLO `CREATE TABLE "Profesor"` +
`ALTER TABLE "Curso" ADD COLUMN "profesorTitularId"` + índices/FK + `ALTER TYPE
"AccionAudit" ADD VALUE …`; el SQL no contiene NINGÚN `DROP INDEX` (I-49);
`migrate reset && migrate deploy && db seed` recrea todo en la BD de test.

**Acceptance Scenarios**:

1. **Given** la migración generada, **When** se inspecciona el SQL, **Then** es 100%
   aditiva (CREATE TABLE/COLUMN, índices, FK, ADD VALUE de enum) y **cero `DROP
   INDEX`/`DROP TABLE`/`ALTER TYPE … DROP`** — si aparece uno, PARA y se reporta
   (I-49: ahí se van el trigram de ciudades y los dos vectoriales del motor).
2. **Given** un curso creado antes de la SPEC, **When** se migra, **Then** su
   `profesorTitularId` queda en NULL — no se retro-asigna (§7.2).
3. **Given** la BD de test, **When** se corre `migrate reset --force && migrate
   deploy && db seed`, **Then** todo se recrea y el seed pasa (reversibilidad §7.4).

---

### User Story 2 — CRUD `/api/colegio/profesores` tenant-first con baja suave (Priority: P1)

Como secretaría del colegio (vía las pantallas de SPEC-148), quiero crear, listar,
editar y dar de baja profesores de MI colegio, de modo que el directorio quede listo
antes de que exista su pantalla.

**Why this priority**: Es el contrato que consumen 146 (selector de titular) y 148
(pantalla). Sin él, el modelo es una tabla muerta.

**Independent Test**: con dos colegios (A/B) sembrados: A crea un profesor y lo ve en
su lista; B no lo ve ni lo alcanza por id (404); la baja lo marca `inactivo` y sigue
existiendo en BD (soft delete, nunca borrado físico).

**Acceptance Scenarios**:

1. **Given** sesión SCHOOL_ADMIN del colegio A, **When** `POST /api/colegio/profesores`
   con `{ nombre, apellidos }` (email/teléfono opcionales), **Then** 201 y el
   profesor queda activo con `colegioId` de la sesión; sin `apellidos` → 400 humano;
   email mal formado → 400.
2. **Given** un profesor del colegio A, **When** el colegio B intenta GET/PATCH por
   id, **Then** 404 en ambos (patrón E-1: `where { id, colegioId }` + conteo → 404 si
   0 filas) — test A/B en cada verbo.
3. **Given** un profesor activo, **When** PATCH con `estado: "inactivo"`, **Then**
   queda dado de baja pero la fila EXISTE (soft delete §7.2); los listados por
   default solo muestran activos y se puede filtrar.
4. **Given** un profesor con el mismo `nombre + apellidos` ya activo en el colegio,
   **When** se intenta crear otro idéntico, **Then** 409 (patrón de estudiantes).
5. **Given** cualquier mutación, **When** se persiste, **Then** registra `AuditLog`
   con las acciones nuevas `COLEGIO_PROFESOR_CREADO/EDITADO/DESACTIVADO` (metadatos,
   nunca datos sensibles extra).

---

### User Story 3 — Cargas de calidad O-1 y O-2 (Priority: P2)

Como plataforma, quiero cerrar dos cabos del REVISO de SPEC-157: el test que falta de
`LuzAmbiental` (SC-004 al pie de la letra) y el oráculo antitrace restaurado a su
barrido amplio con fixture `M1`/`M2` en mayúscula.

**Why this priority**: Son deuda de criterio de aceptación: un criterio que no se
hace cumplir pasa a ser adorno (O-2), y el oráculo amplio vuelve a ser el barrido
original sin flake (O-1: los cuid son alfanuméricos en minúscula, "M1"/"M2" en
mayúscula no pueden colisionar).

**Independent Test**: `LuzAmbiental.test.tsx` verde (render + estado + reduced-
motion); `mis-reportes/[id]/route.test.ts` usa fixture `rubrica:M1+M2` y asserta
`not.toContain("M1")`/`not.toContain("M2")` amplio, verde.

**Acceptance Scenarios**:

1. **Given** `LuzAmbiental`, **When** se renderiza con cada estado
   (pino/ámbar/rubí), **Then** el test verifica el token de color aplicado y que es
   decorativo (aria-hidden) — 4 primitivos con test, SC-004 de SPEC-157 completo.
2. **Given** el fixture antitrace, **When** `modeloUsado: "rubrica:M1+M2"` y votos
   con `modelo: "M2"`, **Then** las aserciones `not.toContain("M1")` y
   `not.toContain("M2")` son imposibles de falsear por cuids (minúsculas) y el test
   pasa de forma determinista.

---

### Edge Cases

- **Drift de índices (I-49)**: si `migrate dev`/`migrate diff` genera un `DROP INDEX`
  por los índices no declarados en el schema (trigram `Ciudad`, vectoriales
  `Embedding*`, `AlertaColegio_patronInstitucionalId_idx`), PARA y se reporta — no se
  aplica así.
- **Curso con profesorTitularId de OTRO colegio**: la asignación (D1) valida que el
  profesor pertenece al mismo colegio → 400/404, nunca cross-tenant.
- **Profesor dado de baja con cursos asignados (CONDICIÓN 2, decidido)**: la baja
  suave CONSERVA la asignación — `profesorTitularId` no se anula ni se bloquea la
  baja (el titular histórico es información forense); las pantallas (147/148) lo
  muestran como titular inactivo y los selectores (146) solo ofrecen activos.
- **Enum AccionAudit**: `ALTER TYPE … ADD VALUE` es aditivo y seguro en PG16
  (precedente: `MATCH_DETECTADO`, `CONSULTA_*` en migraciones recientes).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE crear el modelo `Profesor` con `id`, `colegioId`,
  `nombre`, `apellidos`, `email?`, `telefono?`, `estado` (default `"activo"`),
  timestamps, relación a `Colegio`, `@@index([colegioId, estado])`. NADA más
  (materias, contrato, salario, documento = otro alcance, §7.2).
- **FR-002**: El sistema DEBE agregar `Curso.profesorTitularId String?` + relación
  `profesorTitular`, nullable, sin retro-asignación (existentes en NULL).
- **FR-003**: La migración DEBE ser 100% aditiva y su SQL DEBE ser inspeccionado:
  cero `DROP INDEX`/`DROP TABLE` (I-49). `migrate reset && migrate deploy` recrea
  todo.
- **FR-004**: El enum `AccionAudit` DEBE ganar `COLEGIO_PROFESOR_CREADO`,
  `COLEGIO_PROFESOR_EDITADO`, `COLEGIO_PROFESOR_DESACTIVADO` (ALTER TYPE ADD VALUE).
- **FR-005**: El sistema DEBE exponer `GET /api/colegio/profesores` (paginación
  estándar `page`/`pageSize` + filtro `estado`, default activos), `POST` (Zod:
  `nombre` + `apellidos` requeridos, `email?` con formato, `telefono?`), `GET
  /api/colegio/profesores/[id]` y `PATCH` (edición de campos + baja suave via
  `estado: "inactivo"`). NUNCA delete físico.
- **FR-006**: Todo verbo DEBE ser tenant-first (`where { id, colegioId }` + conteo →
  404, patrón E-1/SPEC-134) con test A/B de dos colegios por verbo.
- **FR-007**: Duplicado exacto `nombre + apellidos` activo en el mismo colegio → 409.
- **FR-008**: Toda mutación DEBE registrar `AuditLog` con las acciones de FR-004
  (metadatos solamente).
- **FR-009**: (D1=A) Los endpoints de curso (`POST` y `PATCH`) DEBEN aceptar
  `profesorTitularId?` (`null` desasigna) validando que el profesor es del mismo
  colegio (400/404 si no). El caso NEGATIVO cross-tenant es test explícito del A/B
  (CONDICIÓN 1): asignar a un curso de A un profesor de B DEBE fallar, nunca tener
  éxito.
- **FR-014** (CONDICIÓN 2): La baja suave de un profesor que es titular de un curso
  CONSERVA la asignación: `profesorTitularId` NO se anula y la baja NO se bloquea —
  el titular histórico es información forense. El curso conserva el titular inactivo
  y las pantallas (SPEC-147/148) lo mostrarán como tal. Caso de prueba obligatorio:
  bajar al titular → la relación sigue intacta.
- **FR-010** (O-2): `LuzAmbiental` DEBE tener su test (render, token por estado,
  aria-hidden, reduced-motion).
- **FR-011** (O-1): el fixture antitrace DEBE usar `M1`/`M2` en mayúscula y las
  aserciones `not.toContain("M1")`/`not.toContain("M2")` amplias restauradas.
- **FR-012**: Todo cambio de schema DEBE regenerar `docs/architecture/01-modelo-datos.md`
  y dejar `arch:check` VERDE (oráculo de modelos 51 → 52).
- **FR-013**: Esta SPEC NO crea UI (pantalla = SPEC-148), NO toca el motor IA y
  mantiene I-29 intacto.

### Key Entities

- **Profesor** (nuevo): docente del colegio. Mínimo: nombre, apellidos, email?,
  teléfono?, estado. Baja = soft delete. Tenant obligatorio.
- **Curso** (extensión): `profesorTitularId?` → el profesor titular del curso
  (opcional, sin retro-asignación).

## Decisión de ZEUS (compuerta §4, 2026-08-03 — REVISO `acb02777` → CUMPLE)

- **D1 = A**: los endpoints de curso aceptan `profesorTitularId?` YA, con validación
  same-tenant. Razón de ZEUS: un campo que no se puede asignar no se puede probar, y
  un `profesorTitularId` apuntando al profesor de OTRO colegio es una fuga
  cross-tenant — la validación es una propiedad de seguridad, no una comodidad.
  - **CONDICIÓN 1**: el test clave es el NEGATIVO explícito: asignar a un curso del
    colegio A un profesor del colegio B DEBE fallar (404/400), nunca tener éxito —
    en el A/B, no solo el camino feliz.
  - **CONDICIÓN 2**: la baja suave de un profesor que ES titular CONSERVA la
    asignación (FR-014): no se anula `profesorTitularId` ni se bloquea la baja —
    saber quién era el titular cuando ocurrió un reporte es información forense.
- **Cuidado ADD VALUE**: el valor nuevo del enum NO se puede usar en la misma
  migración que lo crea; si un backfill/seed lo necesitara, va en migración aparte
  (no es el caso: el seed no usa los valores nuevos).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El SQL de la migración contiene solo `CREATE TABLE "Profesor"`,
  `ADD COLUMN "profesorTitularId"`, índices/FK y `ALTER TYPE "AccionAudit" ADD VALUE`;
  **cero `DROP INDEX`** (verificado línea a línea antes de aplicar).
- **SC-002**: Tests A/B verdes en los 4 verbos (GET lista, POST, GET id, PATCH) +
  400 sin apellidos + 400 email inválido + 409 duplicado + baja suave conserva fila
  + **negativo cross-tenant de asignación (profesor de B a curso de A falla)** +
  **baja del titular conserva `profesorTitularId`**.
- **SC-003**: `LuzAmbiental.test.tsx` verde; los 4 primitivos del sistema tienen test
  (cierra O-2 / SC-004 de SPEC-157).
- **SC-004**: `mis-reportes/[id]` con fixture `M1`/`M2` mayúscula y barrido amplio
  restaurado, verde y determinista (cierra O-1).
- **SC-005**: `arch:check` VERDE con `01-modelo-datos.md` regenerado (52 modelos) y
  `tokens:check` sin subir del piso (1166).
- **SC-006**: Gate completo local verde (tsc && lint && tokens:check &&
  test:coverage && build && arch:check) y CI del HEAD post-merge = success.

## Assumptions

- Sin UI en esta SPEC: la pantalla de profesores es SPEC-148 y la asignación en el
  wizard es SPEC-146 (mapa §10 del brief).
- El CRUD sigue el patrón de los endpoints de curso/estudiante (assertModulo
  `colegios_gestion`, vigencia, rate limits `admin_read`/`admin_write`, Zod, errores
  canónicos).
- `estado` es `String` (patrón existente en `Curso`/`Estudiante`), no enum de BD.
- La terminología en código y UI es "profesor" (§3): `Profesor`,
  `profesorTitularId`, `/api/colegio/profesores`.
- O-1 y O-2 son cambios de TEST solamente (fortalecen/restauran, no debilitan).

## Impacto en arquitectura

Impacto en arquitectura: **modifica el modelo de datos** — entidad NUEVA `Profesor`
(+ columna aditiva `Curso.profesorTitularId` + 3 valores aditivos en enum
`AccionAudit`), migración aditiva verificada sin `DROP INDEX` (I-49). Obliga a
regenerar `docs/architecture/01-modelo-datos.md` y pasar `arch:check` en el mismo PR
(oráculo 51→52 modelos). Añade rutas `/api/colegio/profesores*` (quedan cubiertas
por las aserciones A/B de la línea base). No toca proxy, navegación ni stack.
