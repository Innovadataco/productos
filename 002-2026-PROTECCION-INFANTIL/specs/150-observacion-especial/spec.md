# Feature Specification: SPEC-150 — Observación especial de estudiantes

**Feature Branch**: `work/002-pi-058`

**Created**: 2026-08-09

**Status**: DESARROLLO

**Input**: Instructivo 002-PI-058 (continuación D-51; orden ZEUS: …159 → 150 → 151 →
…). Fuentes VINCULANTES: BRIEF-DISEÑO-UX-RECTOR v3.0 — §10 fila 10 ("Observación
especial — estudiantes destacados que elevan la sensibilidad del aviso. **Auditable**
(Ley 1581). Nuevo `EstudianteObservacion` (soft delete, conserva histórico).
Marca/desmarca al `AuditLog` existente. Ícono `Star`"), §3 (traducción cerrada:
watchlist → **observación especial**). Patrones: SPEC-134 (tenant-first), SPEC-149
(pipeline de avisos, punto exacto del umbral por estudiante en
`src/lib/colegio/avisos.ts` `evaluarUmbralesPorAlerta`), soft delete estilo `Reporte`
(conserva fila con quién/cuándo).

Verificado en fuente 2026-08-09 (exploración): NO existe nada de
observación/watchlist en el repo; `lucide-react@1.28.0` ya instalado (`Star` sin
uso); el punto de sensibilidad natural existe (`avisos.ts`: umbral M=2/30d por
estudiante); la tabla del curso (SPEC-147) y la ficha vieja `alumnos/[id]` son los
dos puntos de UI; `AccionAudit` no tiene valores de observación.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Marcar y desmarcar con evidencia (Priority: P1)

Como rector, quiero marcar a un estudiante con una estrella de observación especial
(y quitarla cuando ya no haga falta), sabiendo que cada marca y desmarca queda
registrada con quién y cuándo, de modo que la decisión sea auditable (Ley 1581).

**Why this priority**: Es la acción central; la sensibilidad y la UI la sirven.

**Independent Test**: marcar → `EstudianteObservacion` activa + audit
`COLEGIO_OBSERVACION_MARCADA`; marcar dos veces → no duplica (idempotente);
desmarcar → la fila se CONSERVA con `desactivadaEn/desactivadaPorId` + audit
`COLEGIO_OBSERVACION_DESMARCADA`; el colegio B no puede marcar al estudiante de A
(404).

**Acceptance Scenarios**:

1. **Given** un estudiante del colegio, **When** se marca, **Then** `POST
   /api/colegio/alumnos/[id]/observacion` crea la observación activa (con `motivo`
   opcional ≤ 500) y audita; re-marcar devuelve la existente sin duplicar (200
   idempotente, no 409).
2. **Given** una observación activa, **When** se desmarca, **Then** `DELETE
   /api/colegio/alumnos/[id]/observacion` hace soft delete (fila conservada con
   fecha y actor) y audita — el histórico completo sigue consultable.
3. **Given** otro colegio, **When** intenta marcar/desmarcar un estudiante ajeno,
   **Then** 404 sin tocar nada (A/B).

---

### User Story 2 — Sensibilidad elevada del aviso (Priority: P1)

Como rector, quiero que los estudiantes en observación especial me generen aviso
al PRIMER reporte (no al segundo como el resto), de modo que la marca signifique
atención real y no solo decoración.

**Why this priority**: "Eleva la sensibilidad del aviso" es el propósito funcional
de la marca (§10) — si no cambia nada, la estrella es adorno.

**Independent Test**: con umbral estándar M=2: un estudiante normal necesita 2
reportes distintos para `ESTUDIANTE_REPETIDO`; uno observado dispara el aviso al
PRIMERO (idempotente por día como siempre).

**Acceptance Scenarios**:

1. **Given** un estudiante con observación ACTIVA, **When** llega su primer
   reporte distinto en la ventana, **Then** `evaluarUmbralesPorAlerta` usa umbral
   efectivo 1 y registra el evento de aviso (con `detalle` que indica "observación
   especial").
2. **Given** la observación desactivada, **When** llega el siguiente reporte,
   **Then** vuelve el umbral estándar del colegio.
3. **Given** la idempotencia existente, **When** hay varios reportes el mismo día,
   **Then** un solo aviso por día por estudiante (la constraint lo garantiza).

---

### User Story 3 — La estrella visible donde trabaja el rector (Priority: P2)

Como rector, quiero ver la estrella junto al nombre del estudiante en la vista del
curso y en su ficha, y poder marcar/desmarcar desde ahí, de modo que la observación
esté donde trabajo.

**Why this priority**: La visibilidad cierra el ciclo; pero la marca ya funciona
por API (US1).

**Independent Test**: en `cursos/[id]` la fila del estudiante observado muestra la
estrella llena (amarillo ámbar del sistema) y el botón alterna marca/desmarca; en
`alumnos/[id]` igual; todo con test de componente.

**Acceptance Scenarios**:

1. **Given** la tabla del curso, **When** un estudiante tiene observación activa,
   **Then** `Star` lleno junto al nombre (con `aria-label` "en observación
   especial") y el toggle funciona con feedback humano.
2. **Given** la ficha del estudiante, **When** se abre, **Then** muestra el estado
   de la observación (activa: desde cuándo y quién; inactiva: historial visible)
   con el mismo toggle.
3. **Given** `prefers-reduced-motion` y teclado, **When** se usa el toggle,
   **Then** es un botón accesible (foco visible, tap ≥ 48px, sin animación).

---

### Edge Cases

- **Estudiante inactivo**: se puede conservar la observación (histórico), pero no
  genera avisos (los identificadores inactivos no alertan — ya garantizado).
- **Doble clic rápido**: la creación es idempotente en servicio (buscar activa
  antes de crear) — no hay duplicados aunque lleguen dos requests.
- **Motivo con HTML**: texto plano sanitizado (Zod ≤ 500, render escapado).
- **I-49**: migración (1 tabla + 2 valores enum) con SQL inspeccionado línea a
  línea.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Modelo `EstudianteObservacion` (`estudianteId`, `colegioId`, `activa
  Boolean @default(true)`, `motivo?`, `creadaPorId`, `desactivadaEn?`,
  `desactivadaPorId?`, timestamps) con índice `(estudianteId, activa)` — soft
  delete que CONSERVA el histórico; migración aditiva inspeccionada (I-49) +
  `AccionAudit` += `COLEGIO_OBSERVACION_MARCADA`, `COLEGIO_OBSERVACION_DESMARCADA`.
- **FR-002**: `POST /api/colegio/alumnos/[id]/observacion` (marcar, idempotente,
  motivo opcional) y `DELETE` (desmarcar, soft delete) — tenant-first, audit en
  ambas, A/B en tests.
- **FR-003**: El pipeline de avisos (`evaluarUmbralesPorAlerta`) DEBE usar umbral
  efectivo 1 para `ESTUDIANTE_REPETIDO` cuando el estudiante tiene observación
  activa, conservando la idempotencia por día; el `detalle` del registro indica
  "observación especial".
- **FR-004**: UI: `Star` toggle en la tabla del curso (el DTO de `cursoDetalle`
  gana el flag `observado` por estudiante) y en la ficha `alumnos/[id]` (estado +
  historial) — accesible, tokens, terminología §3 ("observación especial").
- **FR-005**: Tests: marcar/desmarcar (A/B, idempotencia, soft delete con
  histórico, audit), sensibilidad (observado → aviso al primer reporte; desmarcado
  → umbral estándar), componentes (toggle, estados) — cero tests existentes
  debilitados.
- **FR-006**: I-29 intacto; no se toca `src/lib/ai/**`; `tokens:check` ≤ piso;
  arch:check VERDE (modelos 56→57).

### Key Entities

- **EstudianteObservacion** (nuevo): la marca auditable — activa o histórica,
  siempre con quién y cuándo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Marcar dos veces = 1 observación activa; desmarcar = fila conservada
  con fecha/actor + audit de ambas acciones (test).
- **SC-002**: Observado → aviso al primer reporte; no observado → al segundo (test
  del pipeline con ambos casos).
- **SC-003**: A/B: B recibe 404 en marcar/desmarcar sobre A y nunca ve la estrella
  de A en sus vistas.
- **SC-004**: Checks de día verdes + CI del PR verde.

## Assumptions

- Umbral para observados = 1 fijo (avisar al primer reporte): es la semántica de la
  marca; si se quisiera configurable, es una línea en preferencias (fuera de
  alcance).
- La observación no aparece en la home ni en el tablero en esta versión (sin
  diseño en el brief; la tabla del curso y la ficha cubren el uso).
- El `motivo` es opcional y solo visible para el colegio (nunca en emails).
- La búsqueda global (SPEC-148) no filtra por observados en esta versión.

## Impacto en arquitectura

Impacto en arquitectura: **modifica el modelo de datos** (1 entidad nueva + 2
valores enum, migración aditiva I-49 ⇒ regenerar `01-modelo-datos.md`, oráculo
56→57) y **añade** endpoints (`/api/colegio/alumnos/[id]/observacion`). No modifica
proxy, navegación ni stack.
