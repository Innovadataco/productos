# Feature Specification: SPEC-147 — Vista de curso (escritorio del curso)

**Feature Branch**: `work/002-pi-058`

**Created**: 2026-08-03

**Status**: DESARROLLO

**Input**: Instructivo 002-PI-058 (lote D-51, 146→147→158; radica ZEUS). Fuentes
VINCULANTES: BRIEF-DISEÑO-UX-RECTOR v3.0 — §5.5 (mockup vista de curso), §4.3
(anillo pequeño 88px por curso), §3 (terminología), §9 (accesibilidad), §10 (anclaje:
`cursos/[id]/` como detalle, contactos del acudiente visibles, `tel:`/`mailto:`
clicables, badge ámbar "sin contactos", patrón `ui/Tabla.tsx`). Se construye SOBRE
SPEC-146 (el wizard ya crea estudiantes con acudientes) y reusando SPEC-143
(cobertura, alertas 30d, Anillo). Patrones: SPEC-134 (tenant-first), SPEC-144 D1
(acudiente solo vía estudiante acotado).

Verificado en fuente 2026-08-03 (exploración): `CursoDetallePageClient.tsx` actual
(355 líneas) tiene edición inline + tabla cruda (sin `ui/Tabla`) + modal solo
nombre/apellidos + toggle estado, pero NO muestra titular, acudientes,
identificadores ni actividad; `EstudianteRepository.listarPorCurso` no incluye
acudientes; `contarCobertura` no acepta cursoId; `Anillo` soporta size ≤ 96 de
fábrica; no existe ningún `tel:`/`mailto:` en el repo; `ui/Tabla` es markup sin
sorting.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El escritorio del curso con sus números (Priority: P1)

Como rector, al entrar a un curso quiero ver de un vistazo su estado — profesor
titular, cuántos estudiantes tiene, reportes de los últimos 30 días y cobertura de
identificadores en un anillo pequeño — de modo que sepa si el curso necesita
atención sin leer tablas.

**Why this priority**: Es el drill-down natural desde la home (SPEC-143) y del
wizard (SPEC-146): la unidad de acción del rector es el curso.

**Independent Test**: con un curso (titular asignado, 10 estudiantes — 7 con
identificador, 5 con acudiente —, 2 reportes distintos en 30d y 3 en los 30d
anteriores), la página muestra titular, "10 estudiantes", tarjeta "Reportes 30d: 2
(↓ 1 vs mes previo)", anillo 88px al 70%/50% — solo datos del colegio de la sesión.

**Acceptance Scenarios**:

1. **Given** un curso del colegio, **When** se abre `/dashboard/colegio/cursos/[id]`,
   **Then** el encabezado muestra nombre del curso, profesor titular (o "sin titular
   asignado") y conteo de estudiantes activos, con enlace "← Volver a cursos".
2. **Given** las tarjetas de estado, **When** se calculan, **Then** "Reportes 30d"
   usa la métrica D2 (reportes DISTINTOS, con delta vs los 30 días anteriores) e
   "Identificadores" muestra el total activo y la cobertura en % — cero scores
   (I-29).
3. **Given** el anillo pequeño, **When** el curso tiene estudiantes, **Then**
   dibuja vigilancia (% con identificador activo) y reacción (% con acudiente) del
   CURSO en 88px con aria-label completo; con 0 estudiantes no hay NaN.
4. **Given** otro colegio, **When** pide la URL del curso ajeno, **Then** 404
   (tenant-first E-1, test A/B).

---

### User Story 2 — Los acudientes visibles y clicables (Priority: P1)

Como rector, quiero ver junto a cada estudiante el nombre y relación de su
acudiente con su teléfono y email CLICABLES (llamar/escribir de un toque), y un
badge ámbar "sin contactos" cuando no hay a quién llamar, de modo que cuando haya
un caso pueda llamar a la casa YA.

**Why this priority**: "La comunicación con el acudiente es el corazón del
producto" (§7.1). Es la razón de ser de SPEC-144 hecha pantalla.

**Independent Test**: estudiante con acudiente (teléfono y email) → enlaces
`tel:` y `mailto:` funcionales; estudiante sin acudiente o sin ningún dato de
contacto → badge ámbar "sin contactos"; la tabla se filtra por nombre al buscar.

**Acceptance Scenarios**:

1. **Given** la tabla de estudiantes (patrón `ui/Tabla`), **When** un estudiante
   tiene acudiente principal, **Then** se muestra "Marta Torres (madre)" con
   `tel:+57…` y/o `mailto:` clicables (render condicional: solo si el dato existe);
   si tiene 2 acudientes, se ve el principal y hay forma de ver el segundo.
2. **Given** un estudiante sin acudiente O con acudiente sin teléfono ni email,
   **When** se renderiza la fila, **Then** badge ámbar "sin contactos" (nunca rojo
   agresivo — paleta §4.2).
3. **Given** el buscador, **When** se escribe, **Then** filtra la tabla por
   nombre/apellidos con debounce 250-300 ms (§9 del brief).
4. **Given** PII de terceros (teléfono/email del acudiente), **When** se audita o
   loguea, **Then** NUNCA aparece en audit logs ni logs (D1 de SPEC-144).

---

### User Story 3 — Agregar estudiante y gestionar el curso sin salir (Priority: P2)

Como secretaría, quiero agregar un estudiante (con su acudiente opcional) y
activar/desactivar estudiantes desde la misma vista, y editar los datos del curso
(incluido el titular), de modo que no tenga que ir a otra pantalla para lo básico.

**Why this priority**: Mantiene las capacidades que la pantalla actual ya tiene
(edición, toggle) — no se puede regresionar — y las completa con acudiente y
titular.

**Independent Test**: agregar estudiante con acudiente desde la vista → 201 y la
fila aparece con su acudiente; editar el titular del curso (selector same-tenant)
→ persistido; desactivar un estudiante → sale del listado por default.

**Acceptance Scenarios**:

1. **Given** "+ Agregar estudiante", **When** se abre el formulario, **Then** pide
   nombre+apellidos (obligatorios) y permite acudiente opcional (máx 2) — usa el
   endpoint existente `POST /api/colegio/cursos/[id]/alumnos` (ya atómico con
   acudientes, SPEC-144) sin tocarlo.
2. **Given** la edición del curso, **When** se cambia el titular, **Then** valida
   same-tenant (SPEC-145 D1: profesor de otro colegio → 404/400, test negativo).
3. **Given** un estudiante desactivado, **When** se lista, **Then** por default no
   aparece y puede verse con filtro — el toggle usa el endpoint existente.

---

### Edge Cases

- **Curso sin estudiantes**: empty state propio ("este curso aún no tiene
  estudiantes") con CTA al wizard/agregar — nunca tabla vacía rota.
- **Acudiente con email pero sin teléfono** (o al revés): solo el enlace disponible;
  sin ninguno → badge.
- **Nombre largo de acudiente/relación libre** (texto corto): trunca con ellipsis,
  title completo.
- **Curso archivado/inactivo**: la vista sigue accesible (histórico) pero marcada;
  los estudiantes inactivos fuera del default.
- **Relación eliminada por baja del profesor (COND-2 de 145)**: el titular inactivo
  se muestra como tal ("María López · inactiva") — trazabilidad forense.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `/dashboard/colegio/cursos/[id]` DEBE reemplazarse por la vista del
  mockup §5.5: encabezado (nombre, titular, conteo), tarjetas "Reportes 30d" (D2 +
  delta) e "Identificadores" (total + cobertura %), anillo 88px del curso, tabla de
  estudiantes con acudiente visible. 100% tokens, terminología §3.
- **FR-002**: Los datos DEBEN salir de UNA llamada a un método del DAL
  (`ColegioResumenRepository.cursoDetalle(colegioId, cursoId)` o equivalente):
  consultas paralelas/agregadas (include de acudientes+identificadores en UN
  findMany, counts, cobertura parametrizada por curso) — cero N+1; 404 si el curso
  no es del colegio.
- **FR-003**: El acudiente DEBE mostrarse con `tel:`/`mailto:` clicables (render
  condicional por dato existente, tap target ≥ 48px) y el badge ámbar "sin
  contactos" cuando no hay teléfono NI email en ningún acudiente del estudiante.
  Acudiente solo vía include del estudiante acotado (D1); jamás en audit/logs.
- **FR-004**: La tabla DEBE usar `ui/Tabla`, con buscador por nombre/apellidos
  (debounce 250-300 ms), orden alfabético por default y empty state propio.
- **FR-005**: La vista DEBE conservar las capacidades actuales (editar curso —
  ahora con titular visible/editable same-tenant —, agregar estudiante con
  acudiente opcional, activar/desactivar) usando los endpoints EXISTENTES sin
  tocarlos; el titular inactivo se muestra marcado (COND-2 de SPEC-145).
- **FR-006**: Tests nuevos: repo (A/B tenant, cobertura por curso, alertas 30d por
  curso, include sin N+1, 404 ajeno) + componentes (badge, tel:/mailto:
  condicional, buscador, anillo mini) + los tests/journeys existentes de
  `cursos/[id]` y endpoints verdes sin debilitar.
- **FR-007**: I-29 intacto (solo conteos); cero color crudo (tokens); reduced-motion
  quieto; no se toca `src/lib/ai/**` ni endpoints existentes.

### Key Entities

- **CursoDetalle (DTO)**: curso + titular (con estado), estudiantes[] con
  acudientes[] e identificadores activos, cobertura del curso, alertas30d + delta,
  conteo de identificadores activos.
- **AcudienteEstudiante** (existente): se lee solo por include; `orden` 1 =
  principal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La vista carga con UNA llamada al repo (queries paralelas; el test
  cuenta las invocaciones) y 404 para curso ajeno (A/B).
- **SC-002**: Cada estudiante con acudiente muestra `tel:`/`mailto:` funcionales
  solo cuando el dato existe; sin ninguno → badge ámbar (test de componente por
  caso: solo tel, solo email, ambos, ninguno).
- **SC-003**: El anillo mini coincide con la cobertura del fixture (70%/50%) y 0
  estudiantes no rompe.
- **SC-004**: Cero regresiones: los tests existentes de cursos/alumnos endpoints y
  journeys colegio quedan verdes sin tocar assertions.
- **SC-005**: `tokens:check` ≤ piso vigente (1135) y checks de día verdes.

## Assumptions

- `alumnos/[id]` (ficha del estudiante) se conserva como está; el "Ver" de la tabla
  apunta ahí.
- El orden de la tabla es alfabético (apellidos, nombre) calculado server-side;
  no hay sorting client en esta versión.
- "Sin contactos" = sin teléfono NI email en los (0..2) acudientes del estudiante.
- Los 30 días corren en UTC como en la home (consistencia de métrica).

## Impacto en arquitectura

Impacto en arquitectura: **ninguno estructural** — reemplaza una página existente
(misma ruta), extiende repos del DAL de forma aditiva. No modifica schema, proxy,
navegación ni stack.
