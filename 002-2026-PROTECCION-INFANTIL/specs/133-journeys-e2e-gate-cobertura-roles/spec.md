# Feature Specification: SPEC-133 — Journeys E2E por rol como gate de merge + cobertura completa por rol (Q-1)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-01

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-056 (BANDA 1, ítem Q-1; radica ZEUS). Los journeys E2E por
rol YA existen (`src/lib/e2e/journeys/`: admin, colegio, padre, operador-comite,
aislamiento, publico-agregacion, sesion-roles, cola-041) y corren en CI dentro de la
suite vitest. Q-1 pide: (a) volverlos GATE de merge explícito en CI y (b) completar la
cobertura por rol. Gap analysis 2026-08-01 (journeys × `docs/architecture/02-roles-capacidades.md`):
los journeys cubren los caminos felices centrales pero NO ejercitan capacidades críticas
(apelaciones Ley 1581 en PARENT y COMITE, carga masiva y alertas del colegio,
anonimización del operador, configuración del admin) ni los negativos a nivel handler
(el proxy es grueso: OPERADOR/COMITE pasan a todo `/api/admin/**` y PARENT a
`/api/colegio/**`; el 403 fino vive en los handlers y casi no tiene tests), ni el
aislamiento multi-tenant colegio A vs colegio B.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Gate de merge explícito para los journeys por rol (Priority: P1)

Como responsable de calidad, quiero que los journeys por rol corran como un paso CI
propio, identificable y obligatorio antes de merge, de modo que un fallo de journey se
atribuya de inmediato (no se diluya entre 1300 tests) y ningún PR entre sin ellos.

**Why this priority**: Hoy corren dentro de la suite (bien), pero un fallo aparece como
"npm run test:coverage falló" sin señalar que es un journey de rol; y la protección de
rama (merge gate real en GitHub) no está documentada como paso operativo.

**Independent Test**: el workflow de CI tiene un paso `test:journeys` que ejecuta SOLO
los journeys por rol y falla de forma visible si alguno cae; el runbook documenta la
branch protection que el CEO debe activar (require status check).

**Acceptance Scenarios**:

1. **Given** un PR a `feature/001-scaffolding`, **When** corre el CI, **Then** hay un
   paso dedicado que ejecuta los 8 journeys por rol (`npm run test:journeys`) y su
   resultado es visible por separado en el check.
2. **Given** un journey roto, **When** corre el CI, **Then** el paso de journeys es el
   que falla (atribución inmediata).
3. **Given** el runbook de despliegue, **When** el CEO lo lee, **Then** encuentra el
   paso exacto para exigir el check de CI en la rama (branch protection), marcado como
   acción suya (no de ODIN).

---

### User Story 2 — Cada rol ejercita sus capacidades críticas (Priority: P1)

Como responsable de calidad, quiero que el journey de cada rol recorra sus capacidades
críticas de negocio (no solo el camino feliz central), de modo que una regresión en un
flujo esencial rompa el gate.

**Why this priority**: Los gaps son capacidades por las que el producto existe:
apelaciones (obligación legal Ley 1581) sin cobertura en PARENT ni COMITE, carga masiva
y alertas sin cobertura en SCHOOL_ADMIN, anonimización sin cobertura en OPERADOR,
parámetros de visibilidad sin cobertura en ADMIN.

**Independent Test**: por rol, los flujos listados pasan por la API real contra la BD de
test y afirman estado final (§9 del patrón: no solo 200, el efecto en BD).

**Acceptance Scenarios**:

1. **Given** el journey padre, **When** corre, **Then** además cubre: `POST /api/apelaciones`
   (titular apela un identificador), `GET /api/apelaciones/mias`, alertas
   (`POST /api/alertas/suscribir`, `GET /api/alertas`, `DELETE /api/alertas/[id]`), y
   recuperación de contraseña (`recuperar/solicitar|validar|restablecer`).
2. **Given** el journey colegio, **When** corre, **Then** además cubre: carga masiva
   (`carga/plantilla`, `carga/validar`, `carga/confirmar` con import real), alertas del
   colegio (`GET /api/colegio/alertas`, `PATCH .../estado`) y `GET /api/colegio/auditoria`.
3. **Given** el journey operador-comite, **When** corre, **Then** además cubre: flujo de
   anonimización del operador (`REQUIERE_ANONIMIZACION` → `anonimizar` →
   `validar-anonimizacion`) y apelaciones del comité (`GET /api/admin/comite/apelaciones`,
   `tomar`, `resolver`).
4. **Given** el journey admin, **When** corre, **Then** además cubre: configuración
   (`GET/PATCH /api/config/parametros` con efecto en `ParametroSistema`),
   `POST /api/admin/spam/[id]/resolver` y `POST /api/admin/correcciones` (RAG).

---

### User Story 3 — Los negativos viven donde está el control real: los handlers (Priority: P1)

Como responsable de seguridad, quiero tests que afirmen los 403 a nivel handler para los
roles que el proxy deja pasar (OPERADOR/COMITE → `/api/admin/**`, PARENT →
`/api/colegio/**`), la asignación estricta de casos y el aislamiento multi-tenant,
de modo que la puerta gruesa no pueda confundirse con autorización real.

**Why this priority**: Es el hueco de seguridad más serio del gap analysis: el control
de acceso fino no tiene red de tests. Un refactor de un handler podría abrir `/api/admin`
a un operador sin que nada lo detecte.

**Independent Test**: llamadas API reales con sesión de cada rol afirman 403/404 donde
corresponde; colegio A no lee ni escribe nada del colegio B.

**Acceptance Scenarios**:

1. **Given** sesión OPERADOR, **When** llama APIs admin-only (`POST /api/admin/operadores`,
   `PATCH /api/config/parametros`, `GET /api/admin/comite/integrantes`,
   `GET /api/admin/ia/rubrica`), **Then** recibe 403 en TODAS (aunque el proxy lo deja pasar).
2. **Given** sesión PARENT, **When** llama `/api/colegio/cursos` u otra API del colegio,
   **Then** recibe 403 (el proxy lo deja pasar; el handler es la barrera).
3. **Given** dos colegios A y B con cursos/alumnos/alertas, **When** SCHOOL_ADMIN de A
   intenta leer o modificar recursos de B (cursos, alumnos, alertas, estadísticas),
   **Then** recibe 403/404 en todos los caminos.
4. **Given** un OPERADOR no asignado a un caso, **When** intenta confirmar/escalar ese
   caso, **Then** recibe 403; igual para COMITE con solicitud ajena.
5. **Given** un padre B, **When** pide `GET /api/reportes/mis-reportes/[id]` de un
   reporte del padre A, **Then** recibe 403/404.

---

### Edge Cases

- Los journeys nuevos siembran con `sembrarBase`/`datosCiclo` como los actuales (patrón
  SPEC-114, ciclo parametrizable por `E2E_CICLO`); la suite es secuencial por diseño
  (`fileParallelism: false`) y el tiempo total no debe crecer más de ~2×.
- Estados que dependen del motor de IA (p.ej. llegar a `REQUIERE_ANONIMIZACION`): se
  siembra el estado directamente (transición controlada por BD), NO se invoca Ollama —
  los journeys corren en CI sin modelo.
- Doble envío / repetición: apelar dos veces el mismo identificador se comporta según la
  regla de negocio actual (se afirma el comportamiento existente, no se cambia).
- Alertas con identificador inexistente o de otro padre: 403/404 según handler actual.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBE existir `npm run test:journeys` que ejecute SOLO los journeys por rol
  (`src/lib/e2e/journeys/`) y el workflow de CI DEBE correrlo como paso dedicado
  (además de la suite completa, que sigue siendo gate con cobertura Q-2).
- **FR-002**: El runbook de despliegue DEBE documentar la branch protection (require
  status check del workflow CI) como acción del CEO.
- **FR-003**: El journey padre DEBE cubrir apelaciones (crear + listar), alertas
  (suscribir + listar + borrar) y recuperación de contraseña, con efecto verificado en BD.
- **FR-004**: El journey colegio DEBE cubrir carga masiva (plantilla → validar →
  confirmar con import real verificado), alertas del colegio y auditoría.
- **FR-005**: El journey operador-comite DEBE cubrir anonimización del operador y
  apelaciones del comité (tomar + resolver), con estados finales verificados.
- **FR-006**: El journey admin DEBE cubrir parámetros de configuración (PATCH con efecto
  en `ParametroSistema`), resolución de spam y correcciones RAG.
- **FR-007**: DEBE existir un journey (o ampliación de `aislamiento`) con los negativos
  handler-level: OPERADOR/COMITE → APIs admin-only (403), PARENT → `/api/colegio/**`
  (403), asignación estricta (operador/comité no asignado, 403), cross-parent
  (`mis-reportes/[id]` ajeno, 403/404).
- **FR-008**: DEBE existir el negativo multi-tenant: colegio A no lee ni escribe
  cursos/alumnos/alertas/estadísticas del colegio B.
- **FR-009**: NADA de comportamiento de producto cambia: solo tests, script npm, CI y
  documentación. Si un journey nuevo descubre un defecto real, se REPORTA a ZEUS y se
  radica aparte (no se arregla en esta spec salvo candado explícito).

### Key Entities *(include if feature involves data)*

N/A — no cambia schema ni entidades; los journeys siembran y afirman sobre los modelos
existentes (`Reporte`, `ApelacionIdentificador`, `AlertaSuscripcion`, `Curso`/`Alumno`,
`ParametroSistema`, `TransicionReporte`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: CI muestra un paso `test:journeys` propio y verde; romper un journey rompe
  ese paso específicamente.
- **SC-002**: Los 4 journeys de rol (admin, colegio, padre, operador-comite) cubren los
  flujos de FR-003..FR-006 con afirmaciones de estado en BD.
- **SC-003**: Los negativos de FR-007 y FR-008 están verdes y fallan si se relaja un
  handler (verificable borrando temporalmente una guarda en un test manual de humo).
- **SC-004**: Suite completa + `tsc --noEmit` + lint + build + `arch:check` verdes; el
  piso de cobertura (Q-2) sube o se mantiene, nunca baja.
- **SC-005**: Ningún archivo de producto (`src/app`, `src/lib` no-test) modificado;
  si la implementación descubre un defecto, hay señal a ZEUS antes de seguir.

## Assumptions

- Los journeys siguen el patrón SPEC-114 (helpers `entrarComo`, `sembrarBase`, ciclo);
  no se introduce un framework nuevo ni Playwright (los specs de `tests/e2e/` quedan
  fuera de esta spec).
- La branch protection se configura en GitHub por el CEO (ODIN no tiene ese permiso);
  la spec entrega el paso documentado.
- Los estados que hoy produce el motor de IA se siembran directo en BD (CI no tiene
  Ollama); esto NO debilita nada: lo que se prueba es el flujo de revisión humana,
  no la clasificación (que tiene sus propias evals).
- La suite es secuencial por diseño; añadir ~4-6 archivos de journey es aceptable si el
  tiempo total se mantiene < 2× el actual (~6 min).

## Impacto en arquitectura

Impacto en arquitectura: NINGUNO en runtime — solo tests (`src/lib/e2e/journeys/**`),
script npm, paso de CI y docs. NO toca proxy, handlers, DAL, schema ni navegación; por
tanto `arch:check` no debería requerir regeneración (si el script nuevo aparece en
`06-stack.md`, se regenera en el mismo PR).

## Implementación (cierre)

Implementada el 2026-08-01 en `feature/001-scaffolding` (compuerta §4 APROBADA por ZEUS
con las condiciones O-1..O-4). Cero cambios de producto (O-4 verificado: solo tests,
script npm, CI y docs). Ningún negativo destapó un hueco real → O-1 no requirió radicar
nada; los 6 bloques de negativos quedaron como `it` activos.

- **Gate (US1)**: `npm run test:journeys` (8→9 archivos de journeys) + paso dedicado
  `Journeys por rol` en el workflow CI + runbook §14 con la branch protection como
  acción del CEO. `06-stack.md` regenerado.
- **Padre (FR-003)**: apelaciones (multipart con PDF, §9 `Apelacion` RECIBIDA + documento),
  alertas (suscribir/listar/borrar — baja lógica `activa: false`), recuperar contraseña
  completo (§9: hash cambia, login nuevo 200 / viejo 401).
- **Colegio (FR-004)**: carga masiva plantilla→validar→confirmar (§9: curso + alumnos +
  identificadores; sesión de roster consumida single-use — confirma SPEC-132 en journey),
  alertas del colegio (§9: estado + AuditLog), auditoría aislada por colegio.
- **Operador-comité (FR-005)**: anonimización por AMBOS caminos reales de salida de
  `REQUIERE_ANONIMIZACION` (PATCH admin `anonimizar` y POST operador
  `validar-anonimizacion` — son alternativas, no secuencia; la spec los describía en
  cadena y la máquina de estados real no lo permite: se cubrió con dos casos);
  apelaciones del comité tomar→resolver (§9: ACEPTADA, visibilidad recalculada).
- **Admin (FR-006)**: parámetros (PATCH por clave con §9 y restauración del valor),
  spam en sus dos caminos (falso positivo → CLASIFICADO; spam real → baja con purga D4
  y dataset `spam_revisado`), correcciones RAG (§9: `CorreccionAdmin` + dataset).
- **Negativos (FR-007/FR-008, O-3)**: OPERADOR/COMITE → 5 superficies admin-only = 403;
  PARENT → `/api/colegio/**` = 403; cross-parent = 403 sin filtrar datos; asignación
  estricta (operador y comité) = 403; multi-tenant A/B: listados sin filas ajenas y
  recursos ajenos = 404 (ni la existencia se revela).
- **Test-infra**: `resetDatabase()` limpia ahora `AlertaSuscripcion` y
  `TokenRecuperacion` (deuda latente detectada en fase 2).
- **Gates**: suite completa + cobertura (piso Q-2 intacto o mejorado), `tsc --noEmit`,
  lint y `arch:check` verdes.
