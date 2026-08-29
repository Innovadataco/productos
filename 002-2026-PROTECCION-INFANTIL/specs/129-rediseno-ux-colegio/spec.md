# Feature Specification: SPEC-129 — Rediseño de UX del panel del colegio

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-01

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-051 PARTE B (radica ZEUS; dirección aprobada por el CEO con
mockup de ZEUS). El módulo colegio FUNCIONA pero su diseño es malo: es rediseño de UX,
NO de funcionalidad. Principio innegociable: FÁCIL e INTUITIVO (menos clicks, acciones
en línea) MANTENIENDO el estilo gráfico del producto — se reusan las primitivas UI
(SPEC-124) y el patrón AdminNav. NO se inventa un look nuevo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El colegio aterriza y vive en SU área (Priority: P1)

Como administrador de un colegio (SCHOOL_ADMIN), cuando inicio sesión o navego por la
aplicación, quiero llegar siempre a MI panel (`/dashboard/colegio`) y no al home público
de reportar, de modo que no me pierda buscando mi área de trabajo.

**Why this priority**: Es la queja de entrada del CEO en el smoke: el usuario principal
del módulo aterriza fuera de su área. Mismo patrón que el home del padre (SPEC-127).

**Independent Test**: login como SCHOOL_ADMIN → aterriza en `/dashboard/colegio`; desde
cualquier página (incluidas las públicas), el logo lo lleva a su panel.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN autenticado, **When** inicia sesión, **Then** aterriza en
   `/dashboard/colegio` (ya cubierto por `login/page.tsx:35`; se verifica y se guarda
   con test).
2. **Given** un SCHOOL_ADMIN en una página pública (home, dashboard público,
   seguimiento), **When** pulsa el logo, **Then** llega a `/dashboard/colegio` y NO al
   home público de reportar (hoy el logo en zona pública apunta a `/` por SPEC-106:
   para SCHOOL_ADMIN se corrige apuntando a su panel).
3. **Given** un SCHOOL_ADMIN, **When** entra a `/dashboard/colegio`, **Then** ve la
   consulta pública y las estadísticas (el contenido de `/dashboard-publico`) integradas
   en su home, sin salir de su área (C2/C3).

---

### User Story 2 — Navegación lateral limpia y consistente (Priority: P1)

Como administrador de un colegio, quiero un menú vertical limpio y consistente con el
patrón AdminNav, de modo que sepa dónde estoy y a dónde puedo ir, sin iconos sueltos
ni barras de tabs duplicadas.

**Why this priority**: La navegación actual (tabs horizontales + acciones sueltas) es la
fuente principal del "diseño malo". Consistencia con el resto del producto = menos
aprendizaje (patrón AdminNav ya aprobado).

**Independent Test**: todas las páginas del colegio muestran el mismo menú lateral con
los ítems de `COLEGIO_NAV_ITEMS` (filtrados por módulo ∧ predicado, D-41) y el ítem
activo marcado; no hay tabs horizontales ni acciones sueltas duplicadas.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN en cualquier página del área, **When** mira la navegación,
   **Then** es vertical (patrón AdminNav), con estado activo visible.
2. **Given** la navegación actual, **When** se rediseña, **Then** desaparecen los iconos
   sueltos de la parte inferior y las tabs; "Cambiar contraseña" y "Cerrar sesión" viven
   SOLO en el menú de sesión del header (C7 ya aplicado en PARTE A).

---

### User Story 3 — Cursos, alumnos e identificadores con acciones en línea (Priority: P2)

Como administrador de un colegio, quiero gestionar cursos, alumnos e identificadores
desde listas con acciones EN LÍNEA (ver, editar, dar de baja en la fila), de modo que
cada gestión cueste uno o dos clicks, no una navegación por pantalla.

**Why this priority**: Es la operación diaria del colegio. La FUNCIÓN no cambia: mismos
endpoints, mismas validaciones; solo se compacta la interacción.

**Independent Test**: en cursos y alumnos, las acciones principales se ejecutan desde la
fila (con confirmación inline) sin salir de la lista; los flujos de creación/carga
masiva siguen existiendo y pasan sus tests.

**Acceptance Scenarios**:

1. **Given** la lista de cursos, **When** el usuario quiere editar o desactivar un curso,
   **Then** lo hace desde la fila (acciones en línea), sin navegar a otra pantalla salvo
   confirmación.
2. **Given** la lista de alumnos de un curso, **When** gestiona identificadores,
   **Then** las acciones frecuentes están en línea; la carga masiva (Excel/CSV) queda
   como acción destacada, no como pantalla escondida.

---

### User Story 4 — Alertas entendibles por un rector (Priority: P2)

Como rector sin perfil técnico, quiero entender qué son las alertas del colegio y ver
un estado vacío claro cuando no hay, de modo que sepa para qué sirve la pantalla aunque
nunca haya recibido una.

**Why this priority**: La lógica de alertas (SPEC-077) está bien y NO se toca; lo roto
es la presentación (pantalla vacía sin explicación).

**Independent Test**: sin datos, la pantalla muestra encabezado explicativo + texto de
vacío claro + CTA a Alumnos; con datos, lista anonimizada con estado
(nueva/vista/gestionada).

**Acceptance Scenarios**:

1. **Given** un colegio sin alertas, **When** entra a Alertas, **Then** ve qué son y el
   texto: "Aparecerán cuando un identificador que registres para un alumno salga en un
   reporte", con CTA a Alumnos.
2. **Given** un colegio con alertas, **When** entra, **Then** la lista es anonimizada
   (SPEC-077 intacto) con estado por alerta: nueva / vista / gestionada.

---

### User Story 5 — Auditoría legible para un rector no técnico (Priority: P3)

Como rector, quiero leer la auditoría de mi colegio en lenguaje claro, de modo que
entienda quién hizo qué y cuándo, sin ver JSON crudo.

**Why this priority**: La auditoría muestra objetos tipo `{colegioId, timestamp}` que un
rector no sabe leer. P3 porque es consulta, no operación diaria.

**Independent Test**: cada fila de auditoría muestra acción en lenguaje natural, actor,
fecha/hora legible y detalle formateado; cero JSON crudo visible.

**Acceptance Scenarios**:

1. **Given** eventos de auditoría del colegio, **When** el rector abre Auditoría,
   **Then** cada fila traduce la acción a lenguaje claro ("Se creó el curso X", "Se
   cargaron 25 alumnos") con fecha y actor legibles.
2. **Given** un evento con metadatos técnicos, **When** se muestra, **Then** el detalle
   se presenta formateado (etiquetas y valores), nunca como JSON crudo.

---

### Edge Cases

- Colegio con el servicio vencido (SPEC-119): la pantalla de "servicio no vigente" se
  mantiene; el rediseño no debe esconder ese estado.
- Colegio con permisos de módulos reducidos: el menú lateral sigue la misma regla D-41
  (módulo ∧ predicado); no se pintan ítems sin acceso.
- Listas largas de cursos/alumnos: las acciones en línea no deben romper la paginación
  existente.
- Alertas en estados intermedios (marcadas como vistas por otro admin del colegio):
  la lista muestra el estado real compartido.
- El rediseño NO toca la lógica de permisos/rutas salvo el logo del colegio (C1,
  acotado como SPEC-127): la puerta (proxy) queda intacta.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El logo DEBE llevar al SCHOOL_ADMIN a `/dashboard/colegio` también desde
  páginas públicas (excepción acotada al comportamiento SPEC-106, solo para este rol;
  test de regresión como SPEC-127).
- **FR-002**: El aterrizaje post-login del SCHOOL_ADMIN en `/dashboard/colegio` DEBE
  quedar cubierto por un test (el comportamiento ya existe; se guarda).
- **FR-003**: `/dashboard/colegio` DEBE integrar la consulta pública y las estadísticas
  (contenido de `/dashboard-publico`) reutilizando los componentes existentes.
- **FR-004**: Toda el área del colegio DEBE usar una navegación lateral única patrón
  AdminNav (ítems de `COLEGIO_NAV_ITEMS`, filtro D-41, estado activo), eliminando tabs
  horizontales e iconos sueltos.
- **FR-005**: Las listas de cursos y alumnos DEBEN ofrecer las acciones frecuentes en
  línea (editar, activar/desactivar, gestionar identificadores) sin cambiar endpoints
  ni validaciones.
- **FR-006**: Alertas DEBE mostrar encabezado explicativo, estado vacío claro con CTA a
  Alumnos y, con datos, lista anonimizada con estado (nueva/vista/gestionada). La lógica
  SPEC-077 NO se modifica.
- **FR-007**: Auditoría DEBE presentar cada evento en lenguaje natural (acción, actor,
  fecha legible, detalle formateado) sin JSON crudo.
- **FR-008**: Toda la UI nueva DEBE construirse con las primitivas de SPEC-124
  (`src/components/ui/`) y el patrón AdminNav; prohibido inventar un sistema visual nuevo.
- **FR-009**: Los tests existentes DEBEN seguir verdes sin debilitarse; las páginas
  rediseñadas conservan sus guards de módulo (`verificarAccesoPagina`).

### Key Entities *(include if feature involves data)*

Sin entidades nuevas ni cambios de schema. Se reusan: `Colegio`, `Curso`, `Alumno`,
`IdentificadorAlumno`, `AlertaColegio`, `AuditLog` (solo lectura/presentación).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Login + logo llevan al SCHOOL_ADMIN a su panel en todos los caminos
  probados (test de regresión tipo SPEC-127).
- **SC-002**: La home del colegio muestra consulta + estadísticas sin navegación extra
  (una sola pantalla, verificada en quickstart).
- **SC-003**: Cualquier gestión frecuente de cursos/alumnos se completa en ≤ 2 clicks
  desde la lista (medido en quickstart).
- **SC-004**: Un rector puede decir qué es la pantalla de Alertas leyéndola vacía
  (texto explícito presente) y leer cualquier fila de Auditoría sin JSON.
- **SC-005**: Suite completa + `tsc --noEmit` + build + `arch:check` verdes; cero
  componentes nuevos fuera de las primitivas SPEC-124/AdminNav.

## Assumptions

- La dirección visual del mockup de ZEUS = reutilizar AdminNav + primitivas; no hay un
  look nuevo que interpretar.
- `/dashboard-publico` sigue existiendo para el público; el colegio ve ese contenido
  integrado en su home (se reusan componentes, no se duplica código).
- SPEC-077 (alertas) y SPEC-119 (vigencia) quedan intactos en lógica.
- C1 se limita al destino del logo para SCHOOL_ADMIN y al test del aterrizaje: no se
  toca el proxy (el home-por-rol del colegio ya es correcto desde SPEC-127).

## Impacto en arquitectura

Impacto en arquitectura: TOCA `src/components/modules/NavHeader.tsx` SOLO en el destino
del logo para SCHOOL_ADMIN (C1), páginas y componentes del área
`src/app/dashboard/colegio/**` y un nuevo `ColegioSideNav` (patrón AdminNav). NO toca
proxy, nav-items, permisos, schema ni lógica de negocio. Si `03-pantallas.md` cambia por
la navegación, se regenera con `arch:check` VERDE.

## Implementación (cierre)

Implementada el 2026-08-01 en `feature/001-scaffolding` (compuerta §4 ABIERTA por ZEUS con
decisiones D-a/D-b y condiciones O-1..O-4, registradas aquí). Un commit por frente:

- **C1** (`2f0c3e58`): logo del SCHOOL_ADMIN a su panel también en zona pública
  (**D-a aprobado**; los demás roles conservan SPEC-106). Decisión extraída a
  `destinoLogo()` pura con test de regresión por TODOS los roles (**O-1**).
- **C3** (`61fbfbfa`): `ColegioSideNav` patrón AdminNav (filtro D-41, estado activo)
  reemplaza a `ColegioNav` (tabs + acciones sueltas).
- **C2/C3** (`08bd6e70`): home = consulta pública + RESUMEN de estadísticas
  (**D-b**): `ConsultaPublica` extraído y compartido con la home pública, y
  `PublicDashboard` con variant resumen/completo — mismo componente, **cero fork (O-2)**;
  la vista ampliada (mapa/categorías) queda en la subsección Estadísticas.
- **C4** (`3a541453`): edición de curso en línea desde la lista (modal SPEC-124) y
  "Carga masiva" como acción de encabezado. Parser xlsx intacto (**O-3**).
- **C5** (`963c6d5e`): alertas con encabezado explicativo y empty state con CTA a
  Alumnos; lógica SPEC-077 intacta.
- **C6** (`75281bb2`): auditoría legible (frases naturales + pares etiqueta-valor, sin
  JSON crudo; vista expandida colapsada por defecto, **O-4** — sin denunciante, sin
  texto de reportes, sin otros tenants).
- Gates: suite 1257+ tests verdes por commit y al cierre, `tsc --noEmit`, `lint`
  (0 errores), build y `arch:check` verdes. `03-pantallas.md` no requirió regeneración
  (sin rutas nuevas).
