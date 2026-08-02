# Feature Specification: SPEC-142 — Patrones institucionales para colegios (F6)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-02

**Status**: PLANEADO

**Input**: Instructivo 002-PI-056 (BANDA 3; radica ZEUS). Fuentes:
PROPUESTA-FUNCIONALIDADES-ESTRATEGICAS §F6 (patrones institucionales: post-hook del
worker, entidad `PatronInstitucional` sin PII, k-anonimato k=3, solo aprobados D-08) +
PLAN-DE-TRABAJO-READINESS §Fase 6b fila F6 ("No es blocker de código; techo = masa de
datos"). Reverificado en fuente 2026-08-02: el post-hook del worker ya existe
(`scripts/worker-reportes.mjs:218` llama `notificarColegioSiCorresponde` tras el 200 de
`/api/reportes/procesar`, mismo punto donde F5 enganchará `EventoMatch`); la resolución
identificador → alumno → colegio ya existe (`src/lib/colegio/alertas.ts:50`); el
predicado único de aprobado ya existe (`src/lib/reporte-aprobado.ts:17`); el colegio ya
tiene estadísticas propias sin PII (`src/app/api/colegio/estadisticas/route.ts`,
`src/lib/colegio/estadisticas.ts:46`). Lo que NO existe: la tabla agregada por
(grado, conducta, plataforma, período), la regla de k-anonimato y la vista de patrones.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Acumulación automática de patrones por colegio (Priority: P1)

Como plataforma, quiero que cada reporte APROBADO cuyo identificador esté vinculado a
un alumno de un colegio incremente un agregado por (colegio, grado, conducta,
plataforma, período) — sin persistir nunca el identificador, el alumno, el reporte ni
el texto — de modo que el colegio acumule inteligencia de patrones sin que ningún dato
personal cruce la frontera.

**Why this priority**: Es la base de datos de toda la funcionalidad; sin acumulación
correcta (solo aprobados, idempotente, sin PII) la vista no existe o miente.

**Independent Test**: se crea un colegio con curso (grado "7"), alumno e identificador;
se procesa un reporte aprobado sobre ese identificador → existe exactamente una fila
agregada con conteo 1 para (colegio, "7", categoría, plataforma, trimestre actual); un
reporte SPAM o en REVISION_MANUAL sobre el mismo identificador NO cambia el agregado;
re-procesar el mismo reporte NO lo cuenta dos veces.

**Acceptance Scenarios**:

1. **Given** un reporte que termina CLASIFICADO (categoría de riesgo, no SPAM/OTRO) y
   su identificador está vinculado a un alumno activo de un colegio, **When** el worker
   termina de procesarlo, **Then** el agregado del colegio para (grado del curso del
   alumno, categoría, plataforma del reporte, trimestre del `creadoEn`) incrementa en 1.
2. **Given** un reporte en estado REVISION_MANUAL, POSIBLE_SPAM, DUPLICADO o con
   categoría SPAM/OTRO, **When** el worker termina, **Then** el agregado NO cambia
   (predicado único `esReporteAprobado`, D-08).
3. **Given** el mismo identificador registrado por DOS colegios distintos, **When** se
   procesa un reporte aprobado, **Then** cada colegio acumula en SU propio agregado
   (cross-tenant a propósito, como las alertas) y ninguno ve nada del otro.
4. **Given** un reporte que pasa de REVISION_MANUAL a CORREGIDO por corrección humana,
   **When** la corrección se persiste, **Then** el agregado se actualiza en ese momento
   (segundo punto de disparo).
5. **Given** un reporte ya contado que se da de baja (`eliminado = true`), **When** la
   baja se persiste, **Then** su aporte al agregado se revierte (decremento exacto) —
   el agregado sigue contando solo aprobados vigentes (D-08).

---

### User Story 2 — Vista de patrones para SCHOOL_ADMIN con k-anonimato (Priority: P1)

Como coordinador de convivencia (SCHOOL_ADMIN), quiero ver en el panel de mi colegio un
informe de patrones del trimestre — conteos por grado, conductas más frecuentes,
plataformas de origen y tendencia vs. el trimestre anterior — de modo que pueda pasar
de reactivo a preventivo sin ver jamás quién reportó, qué decía el reporte ni qué
alumno específico está involucrado.

**Why this priority**: Es el valor entregable al colegio (justifica la suscripción);
la regla de k-anonimato es la condición de privacidad sin la cual la vista no puede
existir.

**Independent Test**: con datos sembrados, `GET /api/colegio/patrones` devuelve los
agregados SOLO del colegio del usuario autenticado; un grado con 2 reportes NO aparece
desglosado (k=3) pero sus conteos sí están en el total del colegio; un SCHOOL_ADMIN de
otro colegio (o sin colegio) no puede leerlo.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN autenticado y vigente, **When** consulta la vista de
   patrones, **Then** ve: total del período, desglose por grado (solo grados con
   conteo ≥ k), conductas más frecuentes, plataformas de origen y tendencia vs. el
   período anterior.
2. **Given** un grado con conteo < k (default k=3), **When** se renderiza el informe,
   **Then** ese grado NO se desglosa (se indica que hay grados no desglosables por
   umbral de privacidad) y sus conteos solo figuran en el total del colegio.
3. **Given** un SCHOOL_ADMIN de otro colegio, un PARENT, un OPERADOR o un anónimo,
   **When** intenta acceder, **Then** recibe 401/403 (mismas guardas que
   `/api/colegio/estadisticas`: rol + módulo + vigencia + colegio propio).
4. **Given** un colegio sin volumen suficiente en el período, **When** abre la vista,
   **Then** ve un estado vacío explícito y neutral ("aún no hay datos suficientes para
   mostrar patrones"), nunca ceros ambiguos.
5. **Given** cualquier texto de la vista, **When** se renderiza, **Then** usa lenguaje
   descriptivo/estadístico ("N reportes registrados"), nunca veredictos ("grado
   peligroso") — presunción de inocencia; contenido curado y determinista (D-23), sin
   IA.

---

### User Story 3 — Informe descargable (PDF) del mismo informe (Priority: P3)

Como rector, quiero descargar el informe de patrones en PDF con el logo del colegio y
el período, de modo que pueda presentarlo a la secretaría de educación o al consejo
directivo.

**Why this priority**: Es la forma de circulación institucional del mismo dato (la
propuesta lo lista como paso 4), pero la pantalla ya entrega el valor; el PDF puede
entrar después sin bloquear.

**Independent Test**: con los mismos datos de US2, la descarga produce un PDF que
contiene exactamente el mismo contenido k-anonimizado (ningún grado suprimido aparece)
y el encabezado del colegio + período.

**Acceptance Scenarios**:

1. **Given** la vista de patrones, **When** el SCHOOL_ADMIN descarga el informe,
   **Then** el PDF aplica la MISMA regla de k-anonimato (una sola fuente de la regla)
   y no incluye identificadores, nombres ni textos.

---

### Edge Cases

- **Varios vínculos del mismo identificador en el MISMO colegio** (dos alumnos con el
  mismo teléfono registrado): el reporte cuenta UNA vez por colegio (no por vínculo);
  el grado se toma del vínculo más antiguo (determinístico) y se documenta.
- **Reintentos del worker** (reproceso, drain de pendientes): la agregación es
  idempotente por (colegio, reporte) — el marcador aditivo en `AlertaColegio` impide el
  doble conteo.
- **Curso sin grado declarado** (`Curso.grado` nullable, `prisma/schema.prisma:462`):
  se agrega bajo una categoría explícita "Sin grado registrado" (sentinel no nulo, para
  que la restricción única del agregado funcione).
- **Cambio de grado del alumno entre períodos**: el grado se captura como snapshot al
  momento de agregar; no se recalcula retroactivamente.
- **Ataque por diferencia** (total del colegio − grados mostrados = conteo de grados
  suprimidos): riesgo residual ACEPTADO y documentado — el colegio ya ve sus alertas
  individuales (identificador + categoría, `listarAlertasColegio`); el k-anonimato
  protege la RESOLUCIÓN por grado, no el conteo total que el colegio ya conoce.
- **Corrección que CAMBIA la categoría** (REVISION_MANUAL → CORREGIDO con categoría
  distinta de la original): el reporte no había contado (no era aprobado), cuenta una
  sola vez con la categoría corregida.
- **k aplicado a otras dimensiones**: la propuesta fija k=3 SOLO para el desglose por
  grado; extender k a conducta/plataforma queda como decisión de ZEUS en clarify (ver
  Assumptions).
- **Colegio sin vigencia**: no acumula ni muestra (misma regla que las alertas:
  `colegioEstaVigente`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE agregar en `PatronInstitucional` (upsert, `conteo + 1`)
  por cada colegio cuyo identificador de alumno activo coincida con el identificador
  de un reporte APROBADO, en el post-hook del worker (mismo punto que
  `notificarColegioSiCorresponde`, `scripts/worker-reportes.mjs:218`), con dimensiones:
  grado (snapshot del curso del alumno), conducta (categoría de `ClasificacionIA`),
  plataforma del reporte y período trimestral derivado de `Reporte.creadoEn`.
- **FR-002**: La entidad `PatronInstitucional` NO DEBE persistir jamás identificador,
  reporteId, alumnoId, nombres, textos ni ningún dato personal: solo
  (colegioId, grado, conducta, plataforma, período, conteo).
- **FR-003**: La agregación DEBE ser idempotente por (colegio, reporte): un mismo
  reporte nunca cuenta dos veces para el mismo colegio (marcador aditivo nullable en
  `AlertaColegio` con la fila agregada aportada — mecanismo exacto en plan).
- **FR-004**: El sistema DEBE disparar la agregación también cuando un reporte
  transita a CORREGIDO por corrección humana (admin o comité), y DEBE revertir el
  aporte (decremento exacto, piso 0) cuando un reporte ya contado se da de baja
  (`eliminado = true`).
- **FR-005**: La puerta de conteo DEBE ser el predicado ÚNICO `esReporteAprobado`
  (D-08, `src/lib/reporte-aprobado.ts:17`); está PROHIBIDO reusar `ESTADOS_VISIBLES`
  de las alertas (más amplio: incluye REVISION_MANUAL y POSIBLE_SPAM).
- **FR-006**: El sistema DEBE exponer `GET /api/colegio/patrones` con las mismas
  guardas que `/api/colegio/estadisticas` (verifyAuth SCHOOL_ADMIN + `assertModulo` +
  vigencia + `colegioId` propio + rate limit), devolviendo exclusivamente los agregados
  del colegio del usuario.
- **FR-007**: La lectura DEBE aplicar k-anonimato con k=3 (parametrizable vía
  `ParametroSistema`, default 3): ningún desglose por grado con conteo < k; la
  supresión se aplica en la capa de consulta (una sola fuente de la regla, compartida
  por pantalla y PDF), no en el almacenamiento.
- **FR-008**: La migración DEBE ser ADITIVA y no destructiva (tabla nueva + columna
  nullable en `AlertaColegio`); no toca ni migra datos existentes.
- **FR-009**: La vista DEBE mostrar: total del período, desglose por grado (con k),
  conductas más frecuentes, plataformas de origen, tendencia vs. período anterior y un
  estado vacío explícito cuando no hay datos suficientes.
- **FR-010**: Todo texto de la vista DEBE ser descriptivo/estadístico (presunción de
  inocencia), curado y determinista (D-23): la funcionalidad NO usa IA.
- **FR-011**: El acceso a datos DEBE vivir en el DAL con tenant obligatorio
  (SPEC-134: repositorio con `colegioId` en toda firma, tx opcional D2).

### Key Entities *(include if feature involves data)*

- **`PatronInstitucional` (NUEVA)**: `colegioId` (FK Colegio), `grado` (String, con
  sentinel "Sin grado registrado"), `conducta` (enum `CategoriaConducta` existente),
  `plataformaId` (FK Plataforma), `periodo` (String "2026-Q3"), `conteo` (Int). Única
  por (colegioId, período, grado, conducta, plataforma). Sin PII por construcción.
- **`AlertaColegio` (existente, ADITIVA)**: columna nullable que marca qué fila de
  `PatronInstitucional` aportó esta alerta (idempotencia + reversa exacta).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tests de integración: reporte aprobado vinculado → fila agregada con
  conteo correcto; reporte SPAM/OTRO/REVISION_MANUAL → sin cambio; reproceso → conteo
  idéntico (idempotencia).
- **SC-002**: Test de corrección a CORREGIDO → agrega una vez con la categoría
  corregida; test de baja posterior → el conteo vuelve a su valor previo.
- **SC-003**: Test del endpoint: con un grado de 2 reportes y otro de 3 (k=3), el
  desglose muestra solo el de 3 y marca que hay grados no desglosables; el total
  incluye ambos. Cross-tenant: SCHOOL_ADMIN de otro colegio → 403/aislamiento.
- **SC-004**: Migración aditiva aplicada (`prisma migrate dev`) sin alterar tablas ni
  datos existentes; `arch:check` en verde con la línea base regenerada (SPEC-126).
- **SC-005**: Suite completa + tsc + lint + build verdes; tono neutral verificado en
  los textos de la vista (sin veredictos, sin voseo).

## Assumptions

- **Masa crítica**: la utilidad del informe depende del volumen de reportes vinculados
  (la propuesta ordena F6 tras F1/volumen). No es blocker de código: con pocos datos la
  vista muestra el estado vacío honesto.
- **BL-5 cerrado** (SPEC-131): `esReporteAprobado` ya gobierna la superficie pública;
  F6 solo lo consume, no lo redefine.
- **Período**: trimestre calendario del `creadoEn` del reporte (cuando la plataforma lo
  recibió), no de la fecha del incidente — decisión documentada; el informe de la
  propuesta es trimestral.
- **k solo en grado**: la propuesta fija k=3 para el desglose por grado. Si ZEUS quiere
  k también en conducta/plataforma (celdas pequeñas re-identificables en colegios
  pequeños), se decide en clarify antes de implementar.
- **El colegio ya ve sus alertas individuales**: el k-anonimato protege la resolución
  por grado del AGREGADO, no el conteo total (ver Edge Cases, ataque por diferencia).
- **Sin IA**: agregación y vista son deterministas; no se toca el motor ni Ollama.

## Impacto en arquitectura

Impacto en arquitectura: entidad NUEVA `PatronInstitucional` (+ columna aditiva en
`AlertaColegio`), endpoint nuevo `GET /api/colegio/patrones` (+ PDF P3), página nueva
en el panel del colegio y post-hook de agregación en el worker. NO toca el motor de
clasificación, la visibilidad pública ni el proxy. Al implementar: regenerar
`docs/architecture/` y dejar `npm run arch:check` en VERDE en el mismo PR (SPEC-126).
