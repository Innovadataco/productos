# Feature Specification: SPEC-141 — Admin ve (solo lectura) círculo de confianza de padres + cursos/alumnos de colegios (N-1)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-02

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-056 (BANDA 3; radica ZEUS). Fuentes: HALLAZGOS N1
(`HALLAZGOS-VALIDACION-2026-07-30.md`: "Ver (**solo lectura**) el círculo de
confianza de padres + cursos/alumnos de colegios") y PLAN-DE-TRABAJO-READINESS
§Fase 6 (ítem N-1, refs I-37). Reverificado en fuente 2026-08-02: (a) el admin ya
gestiona cuentas de padres (`api/admin/padres/route.ts:17`, spec 117/I-37) con
privacidad explícita — "solo metadatos de cuenta y conteo agregado; nunca textos,
identificadores ni menores" — pero NO puede ver el círculo de confianza del padre:
`api/circulo-confianza/route.ts:30` exige `verifyAuth("PARENT")` y solo sirve al
dueño (`listarContactos(usuario.id)`). (b) El admin ya gestiona colegios
(`api/admin/colegios/route.ts:64`, módulo `colegios_gestion`) pero NO puede ver
cursos/alumnos: `api/colegio/cursos/route.ts:22` exige `SCHOOL_ADMIN` del propio
tenant. Sin esta visibilidad no hay soporte operativo (un padre llama porque "no
ve a su hijo en el círculo" y el admin opera a ciegas).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin consulta el círculo de confianza de un padre, sin poder editarlo (Priority: P1)

Como ADMIN de plataforma, quiero ver los contactos del círculo de confianza de un
padre (etiqueta, nota, identificadores con tipo/plataforma, estado derivado de
reportes) en solo lectura, de modo que pueda dar soporte ("¿por qué no me llegan
alertas de este número?") sin pedirle capturas al padre ni tocar su configuración.

**Why this priority**: Es la mitad del hallazgo N1 y la carencia de soporte más
frecuente: el círculo es donde el padre configura qué identificadores vigila, y
hoy es invisible para quien atiende el soporte.

**Independent Test**: con una cuenta ADMIN, `GET /api/admin/padres/[id]/circulo-confianza`
devuelve el mismo contenido que el padre ve en `GET /api/circulo-confianza`
(contactos + identificadores + estados derivados); con cualquier otro rol (PARENT
de otra cuenta, SCHOOL_ADMIN, OPERADOR) devuelve 401/403; no existe verbo de
escritura para ADMIN sobre ese recurso.

**Acceptance Scenarios**:

1. **Given** un padre con contactos e identificadores en su círculo, **When** el
   ADMIN consulta el endpoint, **Then** recibe contactos con sus identificadores
   (valor, tipo, plataforma) y el estado derivado de cada contacto (mismo
   predicado `whereReportesCirculo`, spec 093-US1: solo aprobados + en revisión).
2. **Given** un padre sin contactos, **When** el ADMIN consulta, **Then** recibe
   lista vacía con 200 (no es error).
3. **Given** el ADMIN autenticado, **When** intenta crear/editar/inhabilitar un
   contacto del padre por cualquier vía, **Then** no hay ruta que lo permita: las
   mutaciones siguen siendo exclusivas del padre en `api/circulo-confianza/*`.
4. **Given** un usuario con rol PARENT ajeno, SCHOOL_ADMIN u OPERADOR, **When**
   consulta el endpoint de admin, **Then** recibe 401/403.

---

### User Story 2 — Admin consulta cursos y alumnos de un colegio, sin poder editarlos (Priority: P1)

Como ADMIN de plataforma, quiero ver los cursos de un colegio y, por curso, sus
alumnos con sus identificadores (tipo, valor, plataforma, etiqueta de relación)
en solo lectura, de modo que pueda verificar cargas de roster y diagnosticar
alertas sin impersonar al SCHOOL_ADMIN ni modificar datos del colegio.

**Why this priority**: Es la otra mitad del hallazgo N1. El roster es PII de
menores gestionada por el colegio; el admin de plataforma la necesita para
soporte y auditoría, pero la escritura debe seguir siendo exclusiva del
SCHOOL_ADMIN (responsable del tratamiento, convenio del colegio).

**Independent Test**: con una cuenta ADMIN, `GET /api/admin/colegios/[id]/cursos`
devuelve los cursos del colegio y `GET /api/admin/colegios/[id]/cursos/[cursoId]/alumnos`
los alumnos con identificadores; con SCHOOL_ADMIN de OTRO colegio u otro rol,
403; un curso de otro colegio bajo el id del colegio consultado, 404 (aislamiento
por tenant heredado del DAL, SPEC-134).

**Acceptance Scenarios**:

1. **Given** un colegio con cursos y alumnos cargados, **When** el ADMIN consulta,
   **Then** recibe cursos (nombre, grado, año lectivo, estado, conteo de alumnos)
   y, por curso, alumnos (nombre, estado) con sus identificadores (tipo, valor,
   plataforma, etiqueta de relación).
2. **Given** un colegio sin cursos, **When** el ADMIN consulta, **Then** recibe
   lista vacía con 200.
3. **Given** un `cursoId` que no pertenece al `colegioId` de la ruta, **When** el
   ADMIN consulta sus alumnos, **Then** recibe 404 (no oráculo entre tenants).
4. **Given** el ADMIN autenticado, **When** intenta crear/editar/desactivar cursos,
   alumnos o identificadores, **Then** no hay ruta de admin que lo permita: las
   mutaciones siguen siendo exclusivas del SCHOOL_ADMIN en `api/colegio/*`.

---

### User Story 3 — Todo acceso a identificadores queda auditado (Priority: P2)

Como responsable de tratamiento de datos (Ley 1581), quiero que cada consulta del
ADMIN a datos sensibles (identificadores del círculo de un padre; nombres e
identificadores de alumnos menores) deje una fila en `AuditLog` con quién accedió,
a qué recurso y cuándo, de modo que el acceso de soporte sea trazable y
rendible ante el titular o la autoridad.

**Why this priority**: La visibilidad de apoyo es legítima, pero estos datos son
identificadores de menores y de terceros vigilados por familias: el acceso sin
traza sería incompatible con la política de auditoría del producto (precedente de
lectura sensible auditada: `APELACION_DOCUMENTO_ACCESO`, `TEXTO_ORIGINAL_REVELADO`).

**Independent Test**: cada GET de los endpoints de US1/US2 que expone
identificadores genera exactamente una fila `AuditLog` con la acción dedicada,
`usuarioId` = admin, `recursoId` = padre/colegio consultado, y metadatos SIN
valores de identificadores.

**Acceptance Scenarios**:

1. **Given** el ADMIN consulta el círculo de un padre, **When** la respuesta es
   200, **Then** existe una fila `AuditLog` con la acción de acceso al círculo,
   el id del admin y el id del padre (sin identificadores en metadatos).
2. **Given** el ADMIN consulta alumnos de un curso (incluye identificadores de
   menores), **When** la respuesta es 200, **Then** existe la fila de acceso al
   roster con el id del colegio.
3. **Given** un acceso denegado (403/404), **When** ocurre, **Then** NO se genera
   fila de acceso (no se auditó una lectura que no ocurrió).

---

### Edge Cases

- **Padre inactivo**: el círculo sigue consultable en solo lectura (soporte
  histórico); la desactivación de la cuenta no borra contactos.
- **Colegio vencido o desactivado**: el ADMIN de plataforma puede consultar la
  estructura histórica (la vigencia `verificarVigenciaColegio` bloquea al
  SCHOOL_ADMIN, no al soporte de plataforma). Documentado como decisión.
- **Módulo desactivado por permisos** (`PermisoModulo`): sin `padres` o sin
  `colegios_gestion` activos para el rol ADMIN → 403 (`assertModulo`, denegar por
  defecto).
- **Listas grandes**: roster de colegio grande — la lista de alumnos por curso
  usa la paginación estándar (`page`/`pageSize`, default 25, máx 100).
- **Lenguaje**: los estados derivados se muestran con el lenguaje estadístico del
  módulo ("N reportes registrados" / "En proceso"), nunca veredictos (§1.3).
- **AuditLog sin PII en metadatos**: se registra recurso y actor, nunca valores
  de identificadores ni nombres de alumnos (regla de logs del producto).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer `GET /api/admin/padres/[id]/circulo-confianza`
  con guard `verifyAuth("ADMIN")` + `assertModulo(admin, "padres")` + rate limit
  `admin_read`, reutilizando el servicio de lectura del círculo
  (`listarContactos(usuarioId)` — ya parametrizado por usuario, sin N+1 desde
  SPEC-135) sobre el padre indicado. 404 si el id no existe o no es PARENT.
- **FR-002**: El sistema DEBE exponer `GET /api/admin/colegios/[id]/cursos` y
  `GET /api/admin/colegios/[id]/cursos/[cursoId]/alumnos` (paginado) con guard
  `verifyAuth("ADMIN")` + `assertModulo(admin, "colegios_gestion")` + rate limit
  `admin_read`, leyendo SOLO vía repositorios del DAL con `colegioId` obligatorio
  (SPEC-134; la ruta no toca `prisma` directamente).
- **FR-003**: El sistema NO DEBE crear ningún verbo de escritura (POST/PATCH/
  DELETE) para ADMIN sobre círculo de confianza ni sobre cursos/alumnos/
  identificadores. Las mutaciones permanecen exclusivas del padre
  (`api/circulo-confianza/*`, rol PARENT) y del SCHOOL_ADMIN (`api/colegio/*`).
- **FR-004**: El sistema DEBE registrar en `AuditLog` cada lectura que expone
  identificadores (círculo de un padre; alumnos con identificadores), con
  acciones dedicadas nuevas del enum `AccionAudit` (migración ADITIVA de enum —
  precedente `APELACION_DOCUMENTO_ACCESO`), `usuarioId` del admin, `recursoId`
  del padre/colegio, y metadatos sin valores de identificadores ni nombres.
- **FR-005**: La UI de admin DEBE enlazar desde el listado/detalle de padres a la
  vista del círculo y desde el de colegios a la vista de estructura; ambas vistas
  son de solo lectura (sin controles de edición), con indicador visible de "Solo
  lectura" y el lenguaje estadístico existente (sin veredictos, §1.3).
- **FR-006**: Todo endpoint nuevo DEBE traer su `.test.ts` (patrón del repo:
  handler llamado con `Request` nativo; roles cruzados → 401/403; 200 con seed;
  fila de auditoría generada) y la suite debe quedar verde.

### Key Entities *(include if feature involves data)*

No hay entidades nuevas. Lectura sobre modelos existentes: `ContactoConfianza` +
`IdentificadorContacto` (círculo del padre), `Curso` + `Alumno` +
`IdentificadorAlumno` (roster del colegio). Único cambio de schema: valores nuevos
en el enum `AccionAudit` (migración aditiva, sin datos).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `GET /api/admin/padres/[id]/circulo-confianza` devuelve 200 con los
  contactos+identificadores del padre para rol ADMIN y 401/403 para cualquier
  otro rol (test de ruta que afirma ambos lados).
- **SC-002**: `GET /api/admin/colegios/[id]/cursos` y `...[cursoId]/alumnos`
  devuelven 200 con la estructura del colegio para ADMIN, 403 para SCHOOL_ADMIN
  de otro colegio, y 404 para `cursoId` ajeno al colegio (tests).
- **SC-003**: Cada respuesta 200 de los endpoints con identificadores genera
  exactamente una fila `AuditLog` con la acción dedicada y sin PII en metadatos
  (test que cuenta filas y revisa metadatos).
- **SC-004**: No existe handler de escritura para ADMIN sobre círculo ni roster
  (verificable: `api/admin/padres/[id]/circulo-confianza` y
  `api/admin/colegios/[id]/cursos*` solo exportan `GET`).
- **SC-005**: Suite completa + `tsc --noEmit` + lint + build + `arch:check`
  verdes (línea base regenerada por las rutas/páginas nuevas).

## Assumptions

- Se REUSAN los módulos de permiso existentes (`padres` para el círculo,
  `colegios_gestion` para la estructura): el ADMIN ya tiene ambos. Si ZEUS
  prefiere un permiso separado de "visibilidad de soporte", es NEEDS
  CLARIFICATION antes de implementar.
- La vista del admin muestra exactamente lo que ve el dueño del dato (mismos
  servicios/repos, mismo predicado de estados `whereReportesCirculo`): no se
  inventa una vista "más completa" para el admin.
- Colegio vencido/desactivado y padre inactivo siguen siendo consultables por el
  ADMIN (soporte histórico); la vigencia solo restringe al SCHOOL_ADMIN.
- La enumeración `AccionAudit` se amplía con dos acciones de acceso (círculo y
  roster); nombres exactos se fijan en implementación siguiendo el estilo del
  enum (p.ej. `CIRCULO_CONFIANZA_ACCESO_ADMIN`, `COLEGIO_ROSTER_ACCESO_ADMIN`).
- La consulta pública y los umbrales de visibilidad NO se tocan: esto es
  visibilidad interna de soporte, sin efecto en la superficie pública.

## Impacto en arquitectura

Impacto en arquitectura: 3 endpoints GET nuevos bajo `api/admin/**` + 2 páginas
admin de solo lectura (navegación nueva) + enum `AccionAudit` ampliado (migración
aditiva). NO toca schema de negocio, proxy (las rutas admin ya están cubiertas
por rol), workers ni stack. `arch:check` requerirá regenerar la línea base en el
mismo PR (rutas y navegación nuevas).

## Implementación (cierre)

Implementada el 2026-08-02 en `feature/001-scaffolding` vía PR #10 (CI verde).

- **Permiso separado (decisión ZEUS 3)**: módulo `soporte_lectura` (esCritico, default
  SOLO ADMIN — NO reuso de padres/colegios_gestion).
- **3 GETs (cero escritura, probado que no exportan verbos de escritura)**:
  `GET /api/admin/padres/[id]/circulo-confianza` (reuso de `listarContactos` del DAL;
  audita `CIRCULO_CONFIANZA_ACCESO_ADMIN` con metadatos sin valores),
  `GET /api/admin/colegios/[id]/cursos`, `GET /api/admin/colegios/[id]/cursos/[cursoId]/alumnos`
  (paginado; 404 cross-tenant; audita `COLEGIO_ROSTER_ACCESO_ADMIN`).
- **UI**: páginas de solo lectura (badge, sin formularios) enlazadas en contexto desde
  las vistas de padres/colegios; módulo justificado en la whitelist de nav (sin ítem
  propio, acceso contextual).
- **Tests**: cero escritura, audit de acceso sin PII, no-auditoría en 403/404, 404
  cross-tenant; regresión verde.
