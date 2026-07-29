# Feature Specification: SPEC-110 — Apelación del identificador reportado

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-29

**Status**: DESARROLLO

**Input**: BRIEF-SPEC-110 (cola 002-PI-041, bloque B0). Diseño CERRADO con el CEO: (1) el
apelante se AUTENTICA; (2) desde su área declara el identificador, expone su motivo y
adjunta evidencia documental (PDF) SOBRE SÍ MISMO; (3) el caso va DIRECTO a la bandeja
del comité, sin triaje automático; (4) un humano decide sí/no con motivación escrita;
(5) SOLO entonces cambia la visibilidad. Sustituye al módulo eliminado en SPEC-109 (D-34).

## Contexto

La Ley 1581 de 2012 otorga al titular de un dato el derecho de solicitar revisión,
corrección o supresión. SPEC-109 eliminó el módulo viejo de apelación (ocultamiento
automático sin revisión humana, SMS simulado). Esta spec crea el reemplazo con las dos
reglas duras del CEO:

- **Ningún ocultamiento automático**: apelar NO cambia la visibilidad; solo la resolución
  del comité la cambia.
- **El apelante NO ve contenido de ningún reporte**: solo se le informa que existen N
  reportes asociados. Sin texto, sin fechas, sin plataforma de los reportes.

Decisiones del CEO (vinculantes):

- Puede apelar el titular autenticado o un representante que acredite su condición (el
  comité valora la acreditación; no hay verificación técnica de titularidad).
- Si acepta, el comité elige: quitar visibilidad pública del identificador, dar de baja
  reportes concretos por falsos, o ambas.
- Si rechaza: no cambia nada; el apelante puede volver a apelar.
- Reportes nuevos posteriores hacen reaparecer al identificador según las reglas normales
  (NO lista blanca permanente).
- Evidencia: cifrada en reposo, accesible SOLO al comité de validación, borrado
  automático 30 días después de resolver (parámetro). El usuario NO puede retirarla con
  el caso abierto.
- Auditoría permanente: que hubo documento, quién lo vio, cuándo, qué se decidió (sin
  conservar el dato sensible).
- Plazo de respuesta: 15 días hábiles (Ley 1581), con aviso automático al comité a los
  10 días (ambos parámetros).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El titular autenticado presenta su apelación (Priority: P1)

Una persona cuyo número o nick aparece en la consulta pública crea una cuenta, entra a
su área y presenta una apelación: declara el identificador y la plataforma, escribe su
motivo y adjunta un PDF con evidencia sobre sí mismo (p. ej. certificado de titularidad
de la línea). Si apela en nombre de otro (representante), declara esa condición y
describe su acreditación.

**Why this priority**: Es la puerta de entrada del derecho de petición; sin ella no hay
flujo. La regla dura "sin cuenta no hay apelación" se exige aquí.

**Independent Test**: Crear apelación autenticado con PDF válido → 201, estado RECIBIDA;
anónimo → 401; adjunto no-PDF → 400; PDF sobre el tamaño máximo → 413.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado, **When** envía identificador + plataforma + motivo +
   PDF válido (≤ tamaño máximo), **Then** se crea la apelación en estado RECIBIDA con su
   plazo de respuesta calculado (15 días hábiles) y el documento queda cifrado en disco
   fuera de la raíz web, con hash SHA-256 registrado.
2. **Given** un visitante sin sesión, **When** intenta crear una apelación, **Then**
   recibe 401 y no se persiste nada.
3. **Given** un usuario autenticado, **When** adjunta un archivo que no es PDF (por MIME
   y por magic bytes), **Then** recibe 400 y no se persiste nada.
4. **Given** un usuario autenticado, **When** el PDF supera `apelacion.max_tamano_documento_mb`,
   **Then** recibe 413; y si el ADMIN cambia ese parámetro, el umbral de rechazo cambia
   (test de efecto, lección I-14/I-20).
5. **Given** un representante, **When** marca `esRepresentante` sin describir su
   acreditación, **Then** recibe 400 (la acreditación es obligatoria para representantes).

---

### User Story 2 - El apelante consulta el estado de sus apelaciones (Priority: P1)

El apelante ve en su área la lista de sus apelaciones con: identificador declarado,
estado del caso, fecha de radicado, plazo de respuesta y, al resolverse, la decisión y su
motivación. Se le informa cuántos reportes existen asociados al identificador (solo el
número N), y de forma explícita que no puede ver su contenido ni sus fechas.

**Why this priority**: La transparencia hacia el titular es un requisito legal (respuesta
fundamentada) y la restricción de contenido es una regla dura del diseño.

**Independent Test**: GET de las apelaciones propias devuelve N reportes asociados y
NINGÚN campo con contenido, fecha o plataforma de los reportes.

**Acceptance Scenarios**:

1. **Given** un apelante con una apelación radicada, **When** consulta su lista, **Then**
   ve estado, fechas del caso, plazo y `numeroReportesAsociados` (N), sin texto, fechas
   ni plataforma de reportes.
2. **Given** un apelante con caso resuelto, **When** consulta su lista, **Then** ve la
   decisión (ACEPTADA/RECHAZADA) y la motivación escrita del comité.
3. **Given** otro usuario autenticado, **When** consulta la lista, **Then** solo ve sus
   propias apelaciones, nunca las de terceros.

---

### User Story 3 - El comité revisa y resuelve el caso (Priority: P1)

El caso llega DIRECTO a la bandeja de apelaciones del comité (sin triaje automático). Un
miembro del comité toma el caso (queda EN_REVISION), estudia el motivo y la acreditación,
descarga la evidencia PDF (cada descarga queda auditada: quién, cuándo) y resuelve con
motivación escrita:

- **ACEPTADA**: elige quitar la visibilidad pública del identificador y/o dar de baja
  reportes concretos por falsos (motivo REPORTE_FALSO, patrón de baja existente).
- **RECHAZADA**: no cambia nada; el apelante puede volver a apelar.

**Why this priority**: Es el núcleo del diseño cerrado: solo la decisión humana motivada
cambia la visibilidad.

**Independent Test**: Resolver ACEPTADA con quitar-visibilidad → `esVisiblePublicamente`
pasa a false (efecto real, vía la dueña única del flag); resolver RECHAZADA → nada cambia.

**Acceptance Scenarios**:

1. **Given** una apelación RECIBIDA, **When** un miembro del comité la toma, **Then**
   pasa a EN_REVISION asignada a él y otro miembro no puede tomarla (409).
2. **Given** un caso EN_REVISION, **When** el comité resuelve ACEPTADA con
   `quitarVisibilidad: true`, **Then** el identificador deja de ser visible públicamente
   de inmediato (flag recalculado por `actualizarVisibilidadPublica`).
3. **Given** un caso EN_REVISION, **When** el comité resuelve ACEPTADA con
   `reportesABajar: [id1]`, **Then** ese reporte queda eliminado con motivo
   REPORTE_FALSO y su expediente/auditoría lo registran.
4. **Given** un caso EN_REVISION, **When** el comité resuelve RECHAZADA, **Then** la
   visibilidad y los reportes quedan intactos.
5. **Given** un identificador ocultado por apelación aceptada, **When** llega un reporte
   NUEVO posterior, **Then** el ocultamiento se levanta y la visibilidad se rige de nuevo
   por las reglas normales (sin lista blanca permanente).
6. **Given** cualquier caso, **When** alguien intenta resolver sin motivación escrita,
   **Then** recibe 400.

---

### User Story 4 - La evidencia se protege y se purga (Priority: P2)

El PDF de evidencia vive cifrado en reposo, fuera de la raíz web, con nombre opaco. Solo
el rol COMITE_VALIDACION puede descargarlo (endpoint autenticado que descifra y streamea;
nunca URL pública), y cada acceso queda en auditoría. ADMIN, OPERADOR y PARENT reciben
403. Cumplidos `apelacion.retencion_documento_dias` (30) días desde la resolución, un job
diario borra el archivo del disco y conserva solo sus metadatos (hash, tamaño, nombre) y
la traza de accesos.

**Why this priority**: Protege el dato sensible más delicado del flujo (documento de
identidad) y cumple la minimización de datos.

**Independent Test**: Comité → 200 con el PDF descifrado íntegro + AuditLog de acceso;
admin/operador/padre → 403; job con retención=30 borra el documento resuelto hace 31
días y con retención=60 no (test de efecto del parámetro).

**Acceptance Scenarios**:

1. **Given** una apelación con documento, **When** un miembro del comité descarga la
   evidencia, **Then** recibe el PDF original (verificable por hash) y se registra
   AuditLog + fila de acceso con usuario, fecha, IP y user-agent.
2. **Given** el mismo documento, **When** lo pide un ADMIN, un OPERADOR o el propio
   apelante, **Then** recibe 403 y no hay acceso al archivo.
3. **Given** una apelación resuelta hace más de `apelacion.retencion_documento_dias`
   días, **When** corre el job de mantenimiento, **Then** el archivo se elimina del
   disco, el registro conserva sus metadatos y queda AuditLog de la purga.
4. **Given** el documento ya purgado, **When** el comité intenta descargarlo, **Then**
   recibe 410 (Gone) y el metadato sigue disponible en el detalle del caso.

---

### User Story 5 - El plazo de respuesta se vigila (Priority: P2)

El sistema calcula el plazo de respuesta al radicar (15 días hábiles, parámetro). Cumplidos
`apelacion.aviso_previo_dias` (10) días hábiles sin resolución, el comité recibe un aviso
automático por email (digest diario con los casos en aviso) y la bandeja marca el caso
como próximo a vencer. El plazo usa días hábiles (lunes a viernes; sin calendario de
festivos — ver Assumptions).

**Why this priority**: Da cumplimiento operativo al plazo legal sin bloquear el flujo
principal.

**Independent Test**: Cambiar `apelacion.aviso_previo_dias` cambia qué casos entran en el
digest/marca (test de efecto); el job respalda el envío con tolerancia a fallos de email.

**Acceptance Scenarios**:

1. **Given** una apelación con 10 días hábiles transcurridos sin resolver, **When** corre
   el job diario, **Then** se envía el aviso al (a los) miembro(s) del comité y queda
   AuditLog del aviso.
2. **Given** la misma apelación, **When** el comité abre la bandeja, **Then** el caso
   aparece marcado como próximo a vencer.
3. **Given** una apelación resuelta antes del día 10, **When** corre el job, **Then** no
   se genera aviso.

---

### Edge Cases

- **Apelación duplicada abierta**: el mismo usuario no puede tener dos apelaciones
  abiertas (RECIBIDA/EN_REVISION) sobre el mismo identificador + plataforma → 409. Tras
  un rechazo sí puede volver a apelar (decisión CEO).
- **Identificador sin reportes**: se admite la apelación igual (N=0); el comité decide.
- **Identificador inexistente como agregado**: quitar visibilidad no falla: si no hay
  agregado `IdentificadorReportado`, no hay nada que ocultar (no-op documentado).
- **Documento faltante en disco** (borrado manual): la descarga responde 410 y registra
  la anomalía en logs; el caso no se rompe.
- **Clave de cifrado no configurada**: la creación falla 503 (fail-closed: nunca se
  guarda evidencia en claro).
- **Resolución sobre caso no tomado o ya resuelto**: 409.
- **Baja de reporte de otro identificador**: el resolver valida que cada `reportesABajar`
  pertenece al identificador + plataforma declarados → 400 si no.
- **Re-aparición tras ocultamiento**: un reporte nuevo levanta `ocultoPorComiteEn`; las
  bajas/reactivaciones posteriores NO lo levantan (solo reportes nuevos).
- **El apelante no puede retirar la evidencia con el caso abierto** (no existe endpoint
  de borrado para el apelante; decisión CEO).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exigir autenticación para crear una apelación (401 al
  anónimo) y DEBE persistir: identificador, plataforma, motivo (≤ 4000 chars), condición
  de representante y acreditación (obligatoria si es representante), apelante, estado
  RECIBIDA y plazo de respuesta calculado con `apelacion.plazo_respuesta_dias_habiles`
  (default 15) en días hábiles (lun-vie).
- **FR-002**: El sistema DEBE aceptar exactamente un documento PDF por apelación,
  validado por MIME y por magic bytes (`%PDF-`), con tamaño máximo
  `apelacion.max_tamano_documento_mb` (default 5; propuesta documentada: 2-5 MB es el
  rango razonable; 5 evita rechazos de certificados escaneados multi-página). Rechazos:
  400 no-PDF, 413 sobre-tamaño.
- **FR-003**: El sistema DEBE almacenar la evidencia cifrada (AES-256-GCM) en
  `storage/apelaciones/` FUERA de la raíz web, con nombre opaco, hash SHA-256 del
  original, tamaño y MIME; NUNCA bajo `public/` ni servida por URL pública. Sin clave de
  cifrado configurada, la creación falla cerrado (503).
- **FR-004**: Apelar NO DEBE cambiar `esVisiblePublicamente` ni el estado de ningún
  reporte. La visibilidad solo cambia por resolución del comité.
- **FR-005**: El apelante DEBE poder listar solo sus apelaciones con: identificador y
  plataforma declarados, estado, fechas del caso, plazo, decisión y motivación una vez
  resuelta, y `numeroReportesAsociados` (conteo de reportes no eliminados del
  identificador + plataforma). La respuesta NO DEBE incluir texto, fechas, plataforma ni
  ningún dato de los reportes.
- **FR-006**: El sistema DEBE impedir una segunda apelación abierta del mismo usuario
  sobre el mismo identificador + plataforma (409), permitiendo re-apelar tras resolución.
- **FR-007**: El comité DEBE tener una bandeja propia de apelaciones (módulo
  `comite_bandeja`) con estados, fechas, días hábiles transcurridos y marca de próximo a
  vencer; y un detalle con motivo, acreditación, metadatos del documento (nombre, tamaño,
  hash, accesos) y la lista de reportes del identificador (el comité SÍ puede verlos:
  decide bajas).
- **FR-008**: Solo el rol COMITE_VALIDACION DEBE poder descargar la evidencia
  (`GET .../documento`): el endpoint descifra y streamea el PDF, registra AuditLog
  (APELACION_DOCUMENTO_ACCESO) y fila de acceso (usuario, fecha, IP, user-agent).
  ADMIN/OPERADOR/PARENT/otros → 403; documento purgado o ausente → 410.
- **FR-009**: El comité DEBE poder tomar un caso (RECIBIDA → EN_REVISION, asignado a sí)
  y resolverlo con `decision` (ACEPTADA/RECHAZADA) y `motivacion` obligatoria. Solo el
  asignado (o ADMIN) resuelve; caso no tomado o ya resuelto → 409.
- **FR-010**: Al resolver ACEPTADA con `quitarVisibilidad: true`, el sistema DEBE marcar
  el agregado con `ocultoPorComiteEn` y recalcular el flag con
  `actualizarVisibilidadPublica` (dueña única), que DEBE devolver no-visible mientras la
  marca exista. Con `reportesABajar: [ids]`, DEBE dar de baja cada reporte (motivo
  REPORTE_FALSO, patrón `darDeBajaReporte`) validando que pertenezcan al identificador +
  plataforma de la apelación. RECHAZADA no cambia nada.
- **FR-011**: Un reporte NUEVO posterior al ocultamiento DEBE levantar la marca
  (`ocultoPorComiteEn = null`) de modo que la visibilidad vuelva a regirse por las reglas
  normales. Ninguna otra operación la levanta.
- **FR-012**: El sistema DEBE registrar AuditLog permanente de: creación, cada acceso a
  evidencia, resolución (decisión + motivación + efectos), aviso de plazo y purga de
  documento; y DEBE conservar tras la purga los metadatos del documento (que hubo
  documento, hash, tamaño, accesos) sin conservar el dato sensible.
- **FR-013**: Un job diario (cola pg-boss programada) DEBE: (a) enviar aviso por email al
  comité de los casos sin resolver con ≥ `apelacion.aviso_previo_dias` (default 10) días
  hábiles transcurridos, con AuditLog; (b) eliminar del disco los documentos de casos
  resueltos hace ≥ `apelacion.retencion_documento_dias` (default 30), marcando el registro
  y con AuditLog. Cambiar los parámetros DEBE cambiar el comportamiento del job.
- **FR-014**: Toda interfaz de apelación DEBE mostrar los canales oficiales (Línea 141
  ICBF, CAI Virtual, Te Protejo) y explicar al apelante: plazo de 15 días hábiles, que NO
  verá contenido de reportes (solo su número) y por qué (protección de víctimas).
- **FR-015**: El sistema NO DEBE exponer la evidencia por URL pública, ni permitir al
  apelante borrarla con el caso abierto, ni permitir a terceros subir archivos sobre otra
  persona (el único upload del sistema es este, del titular sobre sí mismo o de un
  representante acreditado, valorado por el comité).

### Key Entities

- **Apelacion**: caso de apelación (número único, apelante, identificador + plataforma
  declarados, motivo, esRepresentante + acreditación, estado RECIBIDA/EN_REVISION/
  ACEPTADA/RECHAZADA, comité asignado, plazo, decisión + motivación + efectos, fechas).
- **DocumentoApelacion**: evidencia (ruta cifrada opaca, hash SHA-256, tamaño, MIME,
  fecha de purga). Relación 1:1 con Apelacion en esta fase.
- **AccesoDocumentoApelacion**: traza de accesos a la evidencia (quién, cuándo, IP, UA).
- **IdentificadorReportado.ocultoPorComiteEn**: marca temporal del ocultamiento decidido
  por el comité; la respeta la dueña del flag y la levanta solo un reporte nuevo.

## Success Criteria *(mandatory)*

- **SC-001**: Un titular autenticado radica su apelación con PDF en < 2 minutos; el caso
  aparece de inmediato en la bandeja del comité en estado RECIBIDA con plazo calculado.
- **SC-002**: Apelar no altera ninguna métrica pública: test que verifica
  `esVisiblePublicamente` idéntico antes y después de crear la apelación.
- **SC-003**: Ninguna respuesta al apelante contiene contenido de reportes: test que
  recorre la carga JSON y no halla texto/fechas/plataforma de reportes (solo N).
- **SC-004**: Resolver ACEPTADA con quitar-visibilidad deja el identificador no visible
  (test de efecto real); RECHAZADA lo deja igual; un reporte nuevo posterior lo hace
  reaparecer según reglas normales (test).
- **SC-005**: La evidencia solo la descarga el comité (403 a admin/operador/padre) y cada
  descarga deja rastro auditable (test).
- **SC-006**: Los cuatro parámetros tienen test de efecto (plazo, aviso, retención,
  tamaño máximo): cambiar el valor cambia el comportamiento observable.
- **SC-007**: Tras 30 días de resuelto el caso, la evidencia ya no existe en disco y sus
  metadatos + accesos + decisiones siguen auditables (test del job).
- **SC-008**: Gate verde: tsc + lint + tests + build, y quickstart.md ejecutable.

## Assumptions

- **Días hábiles = lunes a viernes**, sin calendario de festivos colombianos (simplificación
  documentada; el parámetro permite ajustar el plazo si se exige festivos).
- **Sin verificación técnica de titularidad** (decisión CEO): cuenta identificada +
  evidencia + juicio humano del comité.
- **Un documento por apelación** en esta fase (el modelo admite N si se requiere después).
- **Alcance del ocultamiento**: la marca `ocultoPorComiteEn` gobierna el flag
  `esVisiblePublicamente` (listado/dashboard y señales derivadas). La consulta directa
  constitucional (§1.4) sigue mostrando estadísticas de reportes aprobados; si el comité
  quiere suprimir datos concretos usa la baja de reportes (efecto 2). Documentado para el
  CEO: una supresión total de la consulta directa requeriría otra decisión de diseño.
- **Notificación al apelante**: la decisión se consulta en su área (pull); el email al
  apelante queda como mejora futura (no hay plantilla transaccional para ello en esta
  fase). El aviso automático por email es SOLO al comité (plazo).
- **Almacenamiento local**: `storage/apelaciones/` en el servidor (mismo host que la app,
  fuera de `public/`), con `APELACIONES_STORAGE_DIR` como override de entorno para prod.
- ADMIN gestiona casos (bandeja, asignación, resolución) pero NO descarga evidencia:
  la enmienda constitucional restringe la evidencia al comité de validación.

## Implementación

*(Se completa al cierre.)*
