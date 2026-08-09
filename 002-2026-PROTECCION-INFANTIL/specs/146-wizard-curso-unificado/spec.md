# Feature Specification: SPEC-146 — Wizard unificado curso + estudiantes + identificadores

**Feature Branch**: `work/002-pi-058`

**Created**: 2026-08-03

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-058 (lote D-51, orden 146→147→158; radica ZEUS). Fuentes
VINCULANTES: BRIEF-DISEÑO-UX-RECTOR v3.0 — §5.3 (mockup wizard), §5.4 (import Excel
con dry-run), §3 (terminología), §4 (sistema de diseño ya instalado), §9
(accesibilidad: primitivos nuevos con test), §10 (anclaje: reemplaza los flujos de
`cursos/nuevo`, `cursos/carga`; nuevo `POST /api/colegio/cursos/unificado` con
`withUnitOfWork`; primitivo `Accordion`; redirects de rutas viejas). Patrones:
SPEC-134 (tenant-first), SPEC-137 (`withUnitOfWork` atómico), SPEC-144 (Estudiante +
AcudienteEstudiante), SPEC-145 (profesorTitularId).

Verificado en fuente 2026-08-03 (exploración dirigida): el backend YA soporta por
separado todo lo que el wizard necesita (curso+titular, estudiante con
documento+2 acudientes atómico, identificador con tipo inferido); NO existe un
endpoint único atómico curso+estudiantes+identificadores; NO existe `Accordion` en
`ui/` ni ningún `<details>`; la carga masiva actual es todo-o-nada a nivel archivo
(el wizard pide "guardar solo los correctos"); las rutas de la nav y los CTAs de la
home (SPEC-143) apuntan a `cursos/nuevo` y `cursos/carga`.

**Decisión de alcance documentada (D-51, sin compuerta)**: la fila §10 de la 146
lista también `cursos/[id]` y `alumnos/[id]` como reemplazados, pero la fila de la
147 reconstruye `cursos/[id]` "SOBRE la 146" y ambas se construyen en el mismo lote.
Interpretación: la 146 entrega el wizard (creación unificada) + redirects de
`cursos/nuevo` y `cursos/carga`; `cursos/[id]` y `alumnos/[id]` siguen funcionando
hasta que la 147 los reconstruya. Se reporta en la Nota del lote.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Crear un curso completo en una pantalla (Priority: P1)

Como rector/secretaría, quiero crear un curso con sus estudiantes (y opcionalmente
sus identificadores digitales) en UNA sola pantalla con tres secciones, y guardarlo
todo de una vez, de modo que no tenga que dar 5 clics en 4 pantallas.

**Why this priority**: Es el dolor #1 del contexto puente ("crear un curso con
estudiantes le cuesta 5 clics en 4 pantallas"). Todo lo demás (Excel, redirects) lo
sirve.

**Independent Test**: desde `/dashboard/colegio/cursos/unificado`, diligenciar datos
del curso (nombre, grado, año, profesor titular opcional con "+ Nuevo"), agregar 3
estudiantes uno por uno (solo nombre+apellidos obligatorios, acudiente opcional
inline) y 2 identificadores → "Guardar todo" → 201 y TODO existe en BD (curso,
estudiantes, acudientes, identificadores) con una sola escritura atómica.

**Acceptance Scenarios**:

1. **Given** el wizard, **When** se abre, **Then** muestra las 3 secciones del
   mockup §5.3 con el primitivo `Accordion` (1. Datos del curso abierta, 2.
   Estudiantes, 3. Identificadores digitales colapsada marcada opcional), indicador
   de pasos y botón "Guardar todo →" sticky.
2. **Given** estudiantes agregados inline, **When** falta nombre o apellidos en una
   fila, **Then** esa fila se marca con mensaje humano y NO se puede guardar hasta
   corregirla o quitarla — el resto de campos (documento, acudiente) es opcional y
   nunca bloquea (§7.1 del brief).
3. **Given** el guardado, **When** se confirma, **Then** `POST
   /api/colegio/cursos/unificado` persiste TODO en una transacción
   (`withUnitOfWork`): si algo falla a mitad, la BD vuelve a cero (cero curso
   huérfano sin estudiantes ni estudiantes sin curso).
4. **Given** un profesor titular, **When** se elige existente o se crea con "+
   Nuevo" (nombre+apellidos), **Then** queda asignado validando same-tenant
   (SPEC-145, D1).
5. **Given** el guardado exitoso, **When** termina, **Then** toast de éxito humano
   ("¡Listo! Curso 8-B creado con 27 estudiantes 🎉" §4.8) y navegación a la vista
   del curso.

---

### User Story 2 — Importar la lista desde Excel con dry-run (Priority: P1)

Como secretaría, quiero subir mi Excel dentro del wizard, ver la vista previa con
los estudiantes listos y las filas con problemas ANTES de guardar, y poder guardar
solo los correctos, de modo que no tenga que corregir todo el archivo para empezar.

**Why this priority**: "¿Ya tienes tu lista en Excel?" es el otro camino de entrada
(mockup §5.4); el dry-run con "guardar solo los correctos" es la diferencia con la
carga vieja (todo-o-nada).

**Independent Test**: Excel con 5 filas (4 buenas, 1 sin apellidos) → vista previa
"4 estudiantes listos · 1 fila con problemas (fila 4 — falta el apellido)" →
"Guardar solo los 4 correctos" → esos 4 quedan en la lista del wizard (editables)
y se persisten al "Guardar todo"; el archivo NUNCA se rechaza entero.

**Acceptance Scenarios**:

1. **Given** la sección 2 en modo Excel, **When** se sube un archivo,
   **Then** `POST /api/colegio/cursos/unificado/validar` (multipart) devuelve
   `{ filasValidas, problemas }` (parser + validator del pipeline existente, SIN
   persistir nada ni crear sesión roster) y la vista previa §5.4 se muestra antes
   de guardar.
2. **Given** filas con problemas, **When** el usuario elige "guardar solo los
   correctos", **Then** las filas válidas entran a la tabla editable del wizard y
   las problemáticas se descartan con su motivo visible.
3. **Given** la plantilla, **When** se descarga, **Then** incluye las columnas de
   acudiente (nombre/relación/teléfono/email) además de las existentes — la
   plantilla la genera la plataforma.
4. **Given** datos importados, **When** llegan al "Guardar todo", **Then** el
   endpoint unificado re-valida TODO server-side con Zod (defensa en profundidad:
   no se confía en la dry-run del cliente).

---

### User Story 3 — Redirects y navegación coherentes (Priority: P2)

Como plataforma, quiero que las rutas viejas (`cursos/nuevo`, `cursos/carga`)
lleven al wizard y que la navegación use la terminología del brief, de modo que
ningún enlace quede muerto ni diga "carga masiva".

**Why this priority**: Candado de terminología §3 ("carga masiva" prohibida en UI
del rector: es "subir lista") y cero clics muertos.

**Independent Test**: `GET /dashboard/colegio/cursos/nuevo` y
`/dashboard/colegio/cursos/carga` → redirect al wizard; la side nav dice "Subir
lista" y apunta al wizard; los CTAs de la home (SPEC-143) siguen funcionando.

**Acceptance Scenarios**:

1. **Given** las rutas viejas, **When** se piden, **Then** responden redirect
   permanente a `/dashboard/colegio/cursos/unificado` (la de carga, al wizard en
   modo Excel).
2. **Given** la nav del colegio, **When** se renderiza, **Then** el ítem antes
   "Carga masiva" dice "Subir lista" y apunta al wizard (href alcanzable —
   aserción B de arch:check verde).
3. **Given** los endpoints API existentes (`/api/colegio/cursos`, `/alumnos`,
   `/carga/*`), **When** se consumen, **Then** siguen funcionando intactos (los usa
   `cursos/[id]` hasta la 147; journeys y tests existentes verdes sin tocarlos).

---

### Edge Cases

- **Wizard sin estudiantes**: se puede guardar el curso solo (estudiantes = 0) —
  "lo puedes completar después".
- **Duplicados**: curso duplicado (nombre+grado+año) → 409 con mensaje humano;
  estudiante duplicado (nombre+apellidos en el mismo payload o contra BD) → se
  marca la fila, no se guarda duplicado; identificador duplicado → mismo criterio
  (único por estudiante+valor+tipo+plataforma).
- **Falla a mitad de la transacción** (p.ej. identificador viola unique): rollback
  total y error humano; nada parcial en BD.
- **Excel > límites**: se respetan `carga.max_archivo_bytes` y
  `colegio.carga.max_filas` del pipeline existente (413/400 con copy humano).
- **Profesor "+ Nuevo" duplicado**: nombre+apellidos duplicado activo → se ofrece
  usar el existente (409 convertido en sugerencia).
- **Tenant**: todo el payload se persiste con `colegioId` de sesión; profesor e
  IDs referenciados se validan same-tenant (404/400 si no).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La página `/dashboard/colegio/cursos/unificado` DEBE implementar el
  wizard del mockup §5.3 (3 secciones con `Accordion`, pasos, tabla editable de
  estudiantes, sección de identificadores opcional, "Guardar todo →" sticky),
  100% tokens del sistema de diseño, terminología §3 y tap targets ≥ 48px.
- **FR-002**: `POST /api/colegio/cursos/unificado` DEBE persistir
  `{ curso, estudiantes[], identificadores[] }` en UNA transacción
  (`withUnitOfWork`, SPEC-137): todo o nada; validación Zod completa server-side;
  tenant-first en cada entidad; audit con las acciones históricas `COLEGIO_*`
  (metadatos solamente).
- **FR-003**: `POST /api/colegio/cursos/unificado/validar` DEBE aceptar el archivo
  (multipart), reusar parser+validator del pipeline de carga y devolver
  `{ filasValidas, problemas }` SIN persistir (dry-run, sin sesión roster); la
  plantilla descargable DEBE incluir columnas de acudiente.
- **FR-004**: El primitivo `Accordion` (nuevo en `src/components/ui/`, patrón de
  `Modal.tsx`) DEBE tener test de accesibilidad: teclado, `aria-expanded`,
  foco visible, reduced-motion.
- **FR-005**: `cursos/nuevo` y `cursos/carga` DEBEN redirigir al wizard (redirect
  permanente en sus `page.tsx`); la nav del colegio DEBE decir "Subir lista"
  (terminología §3) apuntando al wizard; los CTAs de la home siguen alcanzables.
- **FR-006**: Los endpoints API existentes (`/api/colegio/cursos*`, `/alumnos/*`,
  `/carga/*`) NO se tocan: los consume `cursos/[id]` hasta SPEC-147; los tests y
  journeys existentes quedan verdes sin modificación.
- **FR-007**: El wizard DEBE permitir profesor titular existente (selector
  same-tenant) o nuevo inline (nombre+apellidos), y acudientes inline por
  estudiante (máx 2, tabla hija de SPEC-144).
- **FR-008**: Tests nuevos: endpoint unificado (A/B tenant, atomicidad con fallo
  provocado, 400s humanos, 409 duplicados), validar (dry-run sin persistir),
  Accordion (a11y), componentes del wizard (render, validación de filas, import
  con "guardar solo correctos"). Cero tests existentes debilitados.
- **FR-009**: I-29 intacto; no se toca `src/lib/ai/**`; `tokens:check` ≤ piso en
  código nuevo; reduced-motion apaga las transiciones del wizard.

### Key Entities

- **Payload unificado** (DTO de entrada): `{ curso: { nombre, grado?, anioLectivo?,
  profesorTitularId? | profesorNuevo? }, estudiantes: [{ nombre, apellidos,
  documentoTipo?, documentoNumero?, acudientes?≤2 }], identificadores: [{
  estudianteIndex, tipo?, valor, plataformaId?, etiquetaRelacion? }] }`.
- **Resultado dry-run**: `{ filasValidas: EstudianteConIdentificador[], problemas:
  [{ fila, campos, mensaje }] }`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Crear curso con 3 estudiantes + 2 identificadores = 1 pantalla, 1
  clic de guardado, 1 request de escritura, 1 transacción (verificado: fallo
  provocado en la última entidad ⇒ 0 filas persistidas).
- **SC-002**: El dry-run de un Excel con errores permite "guardar solo los
  correctos" sin re-subir el archivo; el archivo nunca se rechaza entero.
- **SC-003**: Tests A/B: el colegio B no puede escribir ni validar contra el
  colegio A (profesor de B en el payload → 404/400, nunca éxito).
- **SC-004**: Redirects verificados (301/308 o redirect de server component) y nav
  "Subir lista" alcanzable (aserción B de `arch:check`).
- **SC-005**: Suite de los endpoints viejos + journeys verde sin tocar un solo
  assertion; `tokens:check` ≤ 1166; checks de día verdes (tsc/lint/arch:check +
  tests del área).

## Assumptions

- `cursos/[id]` y `alumnos/[id]` NO se reemplazan en esta SPEC (los reconstruye
  SPEC-147 sobre esta; ver decisión de alcance en el encabezado).
- El wizard no edita cursos existentes (solo creación); la edición vive en
  `cursos/[id]` y luego en la 147.
- La dry-run es stateless (las filas válidas vuelven al cliente y se re-validan en
  el guardado final); no se crea sesión roster para el wizard.
- El toast de éxito usa el copy de §4.8; la navegación posterior es a
  `cursos/[id]` (que la 147 reconstruirá).
- Accordion se construye sobre el patrón de `Modal.tsx` (portal no necesario;
  sí focus/aria/teclado).

## Impacto en arquitectura

Impacto en arquitectura: **añade rutas** (`/dashboard/colegio/cursos/unificado` +
`POST /api/colegio/cursos/unificado` + `/validar`) y redirects de dos rutas viejas;
cambia un label de nav ("Subir lista") ⇒ las aserciones A/B de `arch:check` deben
quedar VERDES (rutas nuevas cubiertas por la puerta del proxy). No modifica el
modelo de datos ni el stack.

## Implementación

Cerrada 2026-08-04 en `work/002-pi-058` (commits `525a3170` datos+endpoints,
`40c5e19e` UI wizard, y el de redirects+nav+docs). Detalle y evidencia en
[cierre.md](./cierre.md).

- **T001**: `payloadUnificadoSchema` en `src/lib/schemas/index.ts` (reusa
  `cursoBodySchema`, `estudianteBodySchema`, `identificadorEstudianteBodySchema`;
  `estudianteIndex` validado contra la lista; profesor existente XOR nuevo) +
  `src/lib/schemas/unificado.test.ts` (11 tests).
- **T002**: `POST /api/colegio/cursos/unificado` — `withUnitOfWork` todo-o-nada,
  profesor same-tenant (404) o nuevo inline (409 con sugerencia), duplicados 409
  humanos, tipo de identificador inferido, audit `COLEGIO_CURSO_CREADO` con
  metadatos del resumen. 16 tests (A/B tenant, atomicidad con fallo provocado en
  la última entidad ⇒ 0 filas, 400 humanos, 409).
- **T003**: `POST .../unificado/validar` (dry-run stateless: reuso de
  `parseArchivoCarga` + `validarFilasCarga` vía `validarFilasUnificado`, sin
  persistir ni sesión roster; identificador opcional) + `GET .../unificado/
  plantilla` con las 4 columnas de acudiente. 9 tests (dry-run no persiste).
- **T004**: `src/components/ui/Accordion.tsx` + test a11y (8 tests).
- **T005**: wizard en `src/components/modules/colegio/unificado/` (21 tests).
- **T006**: página + redirects permanentes (308) de `nuevo/` y `carga/`
  (`?modo=excel`), nav "Subir lista", CTAs de home y de la lista de cursos al
  wizard. PageClients viejos eliminados.
- **T007**: tsc/lint/tokens:check (piso baja a 1135 por los archivos eliminados)/
  arch:check VERDES + tests del área verdes (incluye oráculo de páginas 52→53,
  actualización intencional documentada).

Decisiones tomadas al implementar (no cambian los FR):

1. **Identificadores por estudiante en el estado del wizard**: la UI los anida
   por estudiante y `construirPayload` los aplana a `estudianteIndex` al
   guardar — la forma del wire es la del DTO de la spec.
2. **Filas sin identificador en la dry-run**: el validator viejo las marca como
   problema (su `validator.test.ts` lo fija y no se toca); el wrapper
   `validarFilasUnificado` delega en él SOLO las filas con identificador y
   valida las demás con los mismos schemas Zod (en el wizard el identificador
   es opcional — sección 3).
3. **Plantilla del wizard**: conserva las columnas base de la plantilla de
   carga (los archivos que la secretaría ya tiene sirven tal cual) y añade las
   4 de acudiente; el parser las lee de forma aditiva (cero cambio para
   plantillas viejas).
4. **`tokens:check`**: el piso baja de 1166 a 1135 (los dos PageClients
   eliminados tenían 31 ocurrencias de color crudo) — ratchet documentado en
   `scripts/tokens-check.ts`.

Deuda técnica: ninguna nueva. `cursos/[id]` y `alumnos/[id]` siguen sobre los
endpoints viejos hasta SPEC-147 (decisión de alcance del encabezado).

## Implementación

Implementada 2026-08-03 en `work/002-pi-058` (lote D-51: `525a3170` + `40c5e19e` +
`f82d6676`). Evidencia, desviaciones y deuda en [cierre.md](./cierre.md).
