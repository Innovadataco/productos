# Feature Specification: SPEC-139 — Evento de match: segundo reporte independiente del mismo identificador (F5)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-02

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-056 (BANDA 3; radica ZEUS). Fuentes:
PROPUESTA-FUNCIONALIDADES-ESTRATEGICAS §F5 (línea 357) + PLAN-DE-TRABAJO-READINESS
línea 82 (Fase 6b). El match — dos personas que no se conocen reportan el mismo
identificador — es el KPI estrella de la tesis del producto (conectar señal
dispersa) y hoy no tiene nombre, no se mide y no se muestra. Condiciones de
arranque del plan reverificadas en fuente 2026-08-02, AMBAS CERRADAS: (a) **BL-5**
— SPEC-131: la visibilidad y los contadores se rigen por el predicado único
`esReporteAprobado` (D-08: estado ∈ {CLASIFICADO, CORREGIDO} ∧ categoría ∉
{SPAM, OTRO} ∧ no eliminado; `reporte-aprobado.ts:17-25`, `visibility.ts:23-33`,
contadores `reportesAprobados` en `schema.prisma:783-786`). (b) **S-1** — la huella
anti-abuso con salt obligatorio existe (`fuente-reporte.ts:7-10`, modelo
`FuenteReporte` con `ipHash`/`fingerprintHash`, `schema.prisma:757-774`): con ella
se distingue "denunciante distinto" en reportes anónimos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El match se detecta y se registra (Priority: P1)

Como responsable de producto, quiero que cuando un reporte queda APROBADO (D-08)
sobre un identificador que ya tiene ≥1 reporte aprobado previo de OTRO denunciante,
el sistema registre un `EventoMatch` (conteo acumulado, ciudades, conductas
coincidentes), de modo que el evento que prueba la tesis exista como dato.

**Why this priority**: Sin el registro no hay KPI: ni alerta, ni prioridad de
comité, ni contador. Es la pieza de la que cuelga todo lo demás.

**Independent Test**: dos reportes aprobados de fuentes distintas sobre el mismo
identificador (mismo `identificador` + `plataformaId`) → exactamente UN
`EventoMatch` con `conteoAcumulado = 2`; el mismo par con el MISMO denunciante →
cero eventos; reprocesar el mismo reporte (reintento del worker) → sigue habiendo
un solo evento.

**Acceptance Scenarios**:

1. **Given** un identificador con 1 reporte aprobado del denunciante A, **When** un
   reporte del denunciante B (distinto) finaliza APROBADO sobre el mismo
   identificador, **Then** se persiste un `EventoMatch` con el identificador, el
   reporte nuevo, `conteoAcumulado = 2`, las ciudades de los reportes aprobados de
   fuentes independientes y las conductas coincidentes.
2. **Given** el mismo identificador, **When** el segundo reporte es del MISMO
   denunciante (autenticado: mismo `usuarioId`; anónimo: misma huella de fuente
   S-1), **Then** NO se registra evento.
3. **Given** un reporte ya procesado, **When** el worker reintenta/reprocesa,
   **Then** el post-hook no duplica el evento (idempotencia por `reporteNuevoId`
   único).
4. **Given** un reporte que finaliza en estado NO aprobado (POSIBLE_SPAM,
   REVISION_MANUAL, DUPLICADO, REQUIERE_ANONIMIZACION) o con categoría SPAM/OTRO,
   **When** termina el pipeline, **Then** el post-hook no registra nada.

---

### User Story 2 — Acciones automáticas del match (Priority: P1)

Como comité de validación, quiero que un match con reportes desde ≥2 ciudades
distintas quede marcado para revisión prioritaria, y como familia quiero que la
alerta del Círculo de Confianza llegue por el mecanismo existente, de modo que la
reincidencia inter-ciudad y la protección familiar no dependan de que alguien mire
un panel.

**Why this priority**: Es el valor operativo inmediato del evento: la reincidencia
entre ciudades es el patrón que el comité debe ver primero, y la familia ya tiene
un canal de alerta que el match debe aprovechar (no crear uno nuevo).

**Independent Test**: match con reportes desde 2 ciudades → el evento queda marcado
(`interCiudad`) y es visible en la bandeja del comité como prioritario; match con 1
sola ciudad → evento sin marca; la notificación al círculo sigue llegando por
`notificarCambioCirculoSiCorresponde` (post-hook existente del worker), sin canal
nuevo.

**Acceptance Scenarios**:

1. **Given** un `EventoMatch` cuyas ciudades distintas son ≥2, **When** se
   registra, **Then** queda marcado para revisión prioritaria y el comité lo ve en
   su bandeja con ese distintivo (patrón de reincidencia inter-ciudad).
2. **Given** un match sobre un identificador que está en el Círculo de Confianza
   de un usuario, **When** el reporte visible lo dispara, **Then** la alerta a la
   familia sale por el mecanismo existente (mismo post-hook, mismo cooldown, misma
   preferencia de notificación) — el match NO crea un canal nuevo ni revela más
   datos que la alerta ciega actual.
3. **Given** el comité, **When** revisa el evento, **Then** ve identificador,
   conteo, ciudades y conductas coincidentes — NUNCA quién reportó ni el contenido
   de los reportes.

---

### User Story 3 — El match se mide y se muestra (Priority: P2)

Como responsable de producto, quiero el contador agregado de matches en las
estadísticas públicas y el listado con detalle y tendencia en el panel admin, de
modo que el KPI alimente el informe de impacto y la operación interna.

**Why this priority**: Es la visibilidad del KPI (pitch, informe, decisiones), pero
sin US1/US2 no hay nada que mostrar — por eso va después.

**Independent Test**: con N identificadores con match registrado, las estadísticas
públicas exponen el conteo agregado con lenguaje estadístico ("N identificadores
con reportes de múltiples fuentes independientes"); el admin lista los eventos con
detalle (conductas, ciudades, fecha) y la tendencia temporal, paginado.

**Acceptance Scenarios**:

1. **Given** existen eventos de match, **When** se consultan las estadísticas
   públicas, **Then** incluyen el conteo agregado de identificadores con match —
   lenguaje descriptivo/estadístico, sin veredictos ni identidades (presunción de
   inocencia).
2. **Given** un admin, **When** abre el listado de matches, **Then** ve cada evento
   con identificador, conteo acumulado, ciudades, conductas coincidentes y fecha,
   paginado (page/pageSize estándar), y la tendencia temporal de matches.
3. **Given** cualquier consumidor de estas superficies, **When** inspecciona la
   respuesta, **Then** no hay `usuarioId`, huellas de fuente ni texto de reportes.

---

### Edge Cases

- **Idempotencia ante reintentos**: el worker reintenta y el endpoint de procesar
  es idempotente por estado final (`ESTADOS_FINALES`, `procesar/index.ts:53-68`),
  pero el post-hook corre tras cada HTTP OK del worker — la unicidad la garantiza
  `reporteNuevoId @unique`, no el orden de llegada.
- **Mismo denunciante, varios reportes**: la dedup del embudo (paso 4) ya colapsa
  la mayoría como DUPLICADO; el match re-verifica por fuente y no cuenta (autenti-
  cados: mismo `usuarioId`; anónimos: misma huella S-1).
- **Mixto autenticado/anónimo**: cuentan como denunciantes distintos por
  construcción (uno tiene `usuarioId`, el otro no).
- **Reportes históricos sin `FuenteReporte`** (previos a S-1): no prueban fuente
  distinta → NO cuentan como "denunciante distinto" (conservador: no inflar el KPI
  ni acusar sin evidencia; presunción de inocencia).
- **Corrección humana posterior**: un reporte que pasa a CORREGIDO (aprobado) por
  corrección del operador no atraviesa el post-hook del worker. Decisión propuesta:
  invocar el mismo servicio de detección desde el flujo de corrección; si ZEUS lo
  descarta, el match se registra con el próximo reporte aprobado del identificador
  (queda documentado como límite).
- **Eliminación posterior**: si un reporte que participó en un match se elimina
  (baja), el evento histórico permanece pero el conteo vigente se recalcula solo
  con aprobados vigentes en las superficies de lectura (los contadores nunca
  contradicen D-08).
- **Sin IA**: la detección es un query + predicado — ningún texto sale hacia el
  clasificador ni hacia terceros.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE evaluar el match como post-hook ADITIVO tras el
  estado final del pipeline de procesamiento, solo cuando el reporte queda aprobado
  según el predicado único `esReporteAprobado` (D-08). La lógica de clasificación
  del worker NO cambia (ni umbrales, ni categorías, ni estados).
- **FR-002**: La detección DEBE exigir ≥1 reporte aprobado previo del mismo
  identificador (`identificador` + `plataformaId`, la clave del agregado
  `IdentificadorReportado`) de DENUNCIANTE DISTINTO: autenticados por `usuarioId`
  distinto; anónimos por huella de fuente distinta (`FuenteReporte.ipHash` /
  `fingerprintHash`, S-1); mixto autenticado/anónimo = distinto. Reporte previo sin
  huella de fuente NO prueba fuente distinta (conservador).
- **FR-003**: El sistema DEBE persistir un `EventoMatch` por reporte disparador con
  los campos: `identificadorId` (FK al agregado), `reporteNuevoId` (FK al reporte,
  único), `conteoAcumulado` (fuentes independientes aprobadas, ≥2), `ciudades[]`,
  `conductasCoincidentes[]`, `creadoEn` — migración ADITIVA, sin tocar tablas
  existentes.
- **FR-004**: El registro DEBE ser idempotente ante reintentos del worker
  (`reporteNuevoId` único; un reintento no duplica ni incrementa el evento).
- **FR-005**: El post-hook DEBE ser fail-open: un error en la detección/registro se
  loguea y NO reprocesa el reporte ni tumba el job (mismo patrón `.catch` de los
  hooks existentes del worker).
- **FR-006**: Cuando el match involucra ≥2 ciudades distintas, el sistema DEBE
  marcar el evento y exponerlo al comité como revisión prioritaria (bandeja
  existente, con distintivo de reincidencia inter-ciudad).
- **FR-007**: La alerta al Círculo de Confianza DEBE usar el mecanismo existente
  (`notificarCambioCirculoSiCorresponde`, post-hook del worker): el match no crea
  canal nuevo, no cambia el cooldown ni las preferencias del usuario, y la alerta
  sigue siendo ciega (conteo de novedades, sin identificador ni texto).
- **FR-008**: Las estadísticas públicas DEBEN incluir el conteo agregado de
  identificadores con match (lenguaje estadístico), y el panel admin DEBE listar
  los eventos con detalle (identificador, conteo, ciudades, conductas, fecha) y
  tendencia temporal, con paginación estándar (`page`/`pageSize`).
- **FR-009**: Ninguna superficie (pública, admin, comité, alertas) DEBE exponer la
  identidad de los denunciantes (`usuarioId`, huellas de fuente) ni el texto de los
  reportes. El evento y sus lecturas guardan/muestran solo metadatos agregados.
- **FR-010**: El match NO altera visibilidad pública, scoring, dedup ni estados:
  es un registro aditivo con lecturas propias (los contadores vigentes se derivan
  siempre del predicado D-08).

### Key Entities *(include if feature involves data)*

- **`EventoMatch`** (NUEVA, migración aditiva; tabla `eventos_match`, dominio
  global sin tenant — la consulta pública agrega todos los tenants): `id`,
  `identificadorId` → `IdentificadorReportado`, `reporteNuevoId` → `Reporte`
  (único, idempotencia), `conteoAcumulado` Int, `ciudades` String[],
  `conductasCoincidentes` String[], `interCiudad` Boolean (derivado:
  ciudades distintas ≥2), `creadoEn`.
- Relaciones de lectura existentes: `Reporte` (`usuarioId`, `ciudad`, `esAnonimo`,
  `schema.prisma:614-648`), `FuenteReporte` (huellas S-1, `schema.prisma:757-774`),
  `IdentificadorReportado` (agregado por identificador+plataforma,
  `schema.prisma:776-804`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Test de integración: 2 reportes aprobados de fuentes distintas sobre
  el mismo identificador → exactamente 1 `EventoMatch` con `conteoAcumulado = 2`;
  un tercer reporte de otra fuente → segundo evento con `conteoAcumulado = 3`.
- **SC-002**: Mismo denunciante (mismo `usuarioId`, o misma huella en anónimos) →
  0 eventos; reporte previo sin huella → 0 eventos (conservador probado).
- **SC-003**: Reintento del worker sobre el mismo reporte → el conteo de eventos
  del identificador no cambia (idempotencia probada).
- **SC-004**: Match con 2 ciudades → evento marcado `interCiudad` y visible como
  prioritario en la bandeja del comité (test del endpoint).
- **SC-005**: Estadísticas públicas incluyen el contador agregado; el listado admin
  devuelve detalle + tendencia paginados y NO contiene `usuarioId`, huellas ni
  textos (test que lo afirma).
- **SC-006**: Gates verdes: `tsc --noEmit`, `lint`, `test`, `build`,
  `dev-restart.sh` y `arch:check` con los artefactos de `docs/architecture`
  regenerados en el mismo PR (el schema cambia).

## Assumptions

- BL-5 y S-1 están cerrados (SPEC-131 y módulo anti-abuso): el predicado D-08 y la
  huella de fuente existen y son la fuente de verdad — reverificado en fuente.
- El trigger principal es el post-hook del worker (tras estado final); el disparo
  desde la corrección humana queda como decisión de ZEUS (Edge Cases).
- La alerta al círculo NO es un canal nuevo: el worker ya la dispara por reporte
  visible (`worker-reportes.mjs:214-216`); F5 la reutiliza.
- `EventoMatch` es entidad global (sin `tenantId`): el match cruza tenants como la
  consulta pública, sin identificar la fuente institucional.
- La consulta pública del identificador (`GET /api/consulta`) NO cambia: su conteo
  ya se rige por D-08 tras SPEC-131; el KPI nuevo vive en estadísticas públicas y
  admin (si ZEUS quiere el desglose "reportes independientes" en la consulta, es un
  cambio aditivo aparte).

## Impacto en arquitectura

Impacto en arquitectura: entidad NUEVA `EventoMatch` (migración aditiva) + repo y
servicio DAL nuevos (`evento-match`) + post-hook aditivo en
`scripts/worker-reportes.mjs` + dos superficies de lectura (estadísticas públicas,
admin/comité). Altera el schema → regenerar `docs/architecture` y dejar
`arch:check` verde en el mismo PR (el CI lo exige). NO toca clasificación,
visibilidad, scoring ni dedup.

## Implementación (cierre)

Implementada el 2026-08-02 en `feature/001-scaffolding` vía PR #9 (CI verde).

- **Detección (ambos caminos, decisión ZEUS 1)**: `EventoMatchService.detectarYRegistrarMatch`
  con puerta `esReporteAprobado` (D-08) y "denunciante distinto" = `usuarioId` ∨ huella
  S-1 (históricos sin huella NO cuentan — regla conservadora). Disparo en el post-hook
  del worker (fire-and-forget, fail-open) Y en la corrección humana (correcciones admin
  y resolver del comité, nunca rompen la corrección persistida).
- **Entidad**: tabla `eventos_match` (aditiva) con idempotencia por `reporteNuevoId
  @unique` + carrera P2002; AuditLog `MATCH_DETECTADO` (valor aditivo del enum).
- **Superficies**: `GET /api/admin/matches` (ADMIN + módulo estadisticas; items +
  tendencia); estadísticas públicas += conteo `identificadoresConMatch` (sin detalle,
  §1.3); bandeja del comité con matches al tope y badge "Reincidencia inter-ciudad"
  (etiqueta + orden, NO sección nueva — decisión ZEUS 4).
- **Alerta al círculo**: por el mecanismo existente (`notificarCambioCirculoSiCorresponde`),
  sin canal nuevo.
- **Tests**: 9/9 servicio + 7/7 endpoints; regresión 329/329 en las áreas tocadas.
