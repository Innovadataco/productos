# Feature Specification: SPEC-148 — Profesores + buscador global ⌘K

**Feature Branch**: `work/002-pi-058`

**Created**: 2026-08-08

**Status**: DESARROLLO

**Input**: Instructivo 002-PI-058 (continuación lote D-51; orden ZEUS: 148 → 149 →
159 → …). Fuentes VINCULANTES: BRIEF-DISEÑO-UX-RECTOR v3.0 — §10 fila 7
("/dashboard/colegio/profesores/. Primitivo `CommandPalette` (portal como
`ui/Modal.tsx`), resultados agrupados. Baja = soft delete"), §3 (terminología:
**profesor**, nunca docente/maestro), §9 (buscador global < 200 ms con 500
registros · debounce 250-300 ms · primitivos nuevos con test de accesibilidad:
focus trap, Esc, ↑↓, Enter). Patrones: SPEC-145 (CRUD `/api/colegio/profesores` ya
existe), SPEC-134 (tenant-first), SPEC-157 (sistema de diseño).

Verificado en fuente 2026-08-08: el CRUD de profesores (SPEC-145) ya existe
(`GET/POST /api/colegio/profesores`, `GET/PATCH /[id]`, baja suave); NO existe la
pantalla `/dashboard/colegio/profesores/`, ni `CommandPalette`, ni ningún endpoint
de búsqueda del colegio; el layout del colegio monta `ColegioSideNav`; la acción
"Profesores" de la home (SPEC-143) apunta a cursos como placeholder — esta SPEC le
da destino real.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Pantalla de profesores (Priority: P1)

Como rector/secretaría, quiero ver, crear, editar y dar de baja a los profesores de
mi colegio en una pantalla propia, de modo que el directorio quede al día sin
pedirle nada a nadie.

**Why this priority**: El profesor es actor central de las vistas (home, curso,
wizard) y hoy no tiene cara: el CRUD existe pero no hay pantalla.

**Independent Test**: crear una profesora con email/teléfono, editarla, darla de
baja (desaparece del listado por default pero la fila EXISTE y sigue como titular
histórico — COND-2 de SPEC-145) y reactivarla; el colegio B nunca la ve (A/B).

**Acceptance Scenarios**:

1. **Given** la página `/dashboard/colegio/profesores`, **When** se abre, **Then**
   lista los profesores del colegio (activos por default, filtro para ver
   inactivos) con `ui/Tabla`, buscador por nombre con debounce y estado vacío
   honesto con CTA "Agregar profesor".
2. **Given** el formulario, **When** falta nombre o apellidos o el email es
   inválido, **Then** mensaje humano (§4.6) y nada se guarda; duplicado
   nombre+apellidos activo → 409 convertido en aviso claro.
3. **Given** una profesora activa, **When** se da de baja, **Then** `estado:
   "inactivo"` (NUNCA borrado físico), sale del listado por default y los cursos
   donde es titular la conservan marcada "· inactiva" (COND-2 SPEC-145).
4. **Given** la acción "Profesores" de la home, **When** se pulsa, **Then** lleva a
   esta pantalla (placeholder de SPEC-143 reemplazado).

---

### User Story 2 — Buscador global ⌘K (Priority: P1)

Como rector con 400+ estudiantes, quiero pulsar ⌘K (o Ctrl+K) desde cualquier
pantalla del colegio y encontrar un estudiante, curso o profesor por nombre en
menos de un parpadeo, de modo que nunca tenga que navegar listas largas.

**Why this priority**: "crítico con 400+ estudiantes" (§10). Es la utilidad que
hace viable el resto del escritorio.

**Independent Test**: con 500 estudiantes sembrados, `GET /api/colegio/buscar?q=ana`
responde en < 200 ms con resultados agrupados (estudiantes/cursos/profesores) del
propio colegio solamente; el palette abre con ⌘K, navega con ↑↓, selecciona con
Enter y cierra con Esc (test a11y).

**Acceptance Scenarios**:

1. **Given** el palette, **When** se escribe, **Then** consulta con debounce
   250-300 ms y muestra resultados AGRUPADOS por tipo (estudiantes, cursos,
   profesores) con contexto mínimo (curso del estudiante, titular del curso); Enter
   navega al destino (estudiante → su ficha, curso → su escritorio, profesor → la
   pantalla de profesores).
2. **Given** la búsqueda, **When** la ejecuta el colegio A, **Then** NUNCA devuelve
   nada del colegio B (tenant-first, test A/B) y solo entidades ACTIVAS.
3. **Given** el palette, **When** se audita accesibilidad, **Then** portal como
   `Modal`, focus trap, `aria` del combobox/listbox, Esc cierra, ↑↓ navega, Enter
   selecciona, foco restaurado al cerrar — todo con test.
4. **Given** una búsqueda sin resultados, **When** no hay match, **Then** empty
   state honesto ("sin resultados para 'xyz'") — nunca una lista rota.

---

### Edge Cases

- **Query de 1 carácter o vacía**: umbral mínimo (≥2 caracteres) para no barrer la
  BD; respuesta vacía inmediata si no.
- **500+ estudiantes con nombres repetidos**: resultados limitados por grupo
  (top N) con conteo ("+12 más") y orden por relevancia simple (prefijo primero).
- **Profesor inactivo**: fuera de la búsqueda y del listado default, pero su
  nombre sigue visible como titular histórico en cursos.
- **Nav**: el ítem "Profesores" aparece en `COLEGIO_NAV_ITEMS` (href alcanzable —
  aserción B verde).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La página `/dashboard/colegio/profesores/` DEBE listar/crear/editar/
  dar de baja profesores con el CRUD EXISTENTE de SPEC-145 (sin tocar endpoints):
  `ui/Tabla`, filtro activos/inactivos, buscador con debounce, formulario con
  validación humana, baja suave y reactivación. 100% tokens, terminología §3, tap
  targets ≥ 48px.
- **FR-002**: El primitivo `CommandPalette` (nuevo en `src/components/ui/`, portal
  como `Modal`) DEBE abrirse con ⌘K/Ctrl+K desde cualquier pantalla del colegio,
  con focus trap, combobox/listbox aria, ↑↓/Enter/Esc y restauración de foco —
  con test de accesibilidad completo.
- **FR-003**: `GET /api/colegio/buscar?q=` DEBE devolver resultados agrupados
  (estudiantes, cursos, profesores) del colegio de la sesión — tenant-first
  (`colegioId` en cada query), solo activos, mínimo 2 caracteres, límite por grupo
  con conteo de restantes, prefijo antes que contiene, rate limit `admin_read` —
  con test A/B.
- **FR-004**: Rendimiento: la búsqueda DEBE responder < 200 ms con 500 estudiantes
  (§9) — verificado con test de timing sobre el repo o la ruta (fixture de 500).
- **FR-005**: La home (SPEC-143) DEBE enlazar "Profesores" a la pantalla nueva
  (reemplaza el placeholder a cursos) y la nav gana "Profesores" (aserción B).
- **FR-006**: Tests nuevos: buscar (A/B, mínimo caracteres, agrupación, solo
  activos, timing 500 registros) + CommandPalette (a11y completa) + página de
  profesores (render, filtros, formulario, baja/reactivación) — cero tests
  existentes debilitados; los de SPEC-145 verdes intactos.
- **FR-007**: I-29 intacto; no se toca `src/lib/ai/**`; cero color crudo nuevo
  (`tokens:check` ≤ piso vigente 1122); reduced-motion quieto.

### Key Entities

- **Profesor** (SPEC-145): se gestiona por su CRUD existente; baja = soft delete.
- **ResultadoBusqueda (DTO)**: `{ estudiantes: [{ id, nombre, apellidos, curso }],
  cursos: [{ id, nombre, titular }], profesores: [{ id, nombre, apellidos }],
  restantes: { estudiantes, cursos, profesores } }`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Búsqueda "ana" con fixture de 500 estudiantes: < 200 ms y cero
  resultados del otro colegio (test A/B + timing).
- **SC-002**: ⌘K abre el palette desde la home, el tablero y la vista de curso;
  teclado completo (↑↓ Enter Esc) cubierto por test.
- **SC-003**: Baja suave: la profesora dada de baja no aparece en lista ni
  búsqueda, pero su curso sigue mostrándola como titular "· inactiva" (COND-2).
- **SC-004**: `tokens:check` ≤ 1122; checks de día verdes (tsc/lint/arch:check +
  tests del área); CI del PR verde.

## Assumptions

- El destino de un estudiante en la búsqueda es su ficha actual
  (`/dashboard/colegio/alumnos/[id]`, pantalla vieja) — su renovación es otra SPEC.
- Búsqueda por `ilike` sobre nombre+apellidos/nombre (a 500-2000 registros sobra;
  si crece, índice trigram como el de ciudades — fuera de alcance).
- El palette se monta en el layout del colegio (solo rol SCHOOL_ADMIN).
- No hay búsqueda de identificadores (nicks) en esta SPEC — personas y cursos
  primero; ampliable después.

## Impacto en arquitectura

Impacto en arquitectura: **añade una página** (`/dashboard/colegio/profesores/`),
**un endpoint** (`/api/colegio/buscar`) y un ítem de nav ⇒ aserciones A/B de
`arch:check` VERDES y oráculo de páginas 54→55. No modifica schema ni stack.
