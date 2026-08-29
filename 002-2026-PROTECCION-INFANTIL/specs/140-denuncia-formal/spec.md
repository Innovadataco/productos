# Feature Specification: SPEC-140 — Botón "Llevar a denuncia formal" + panel forense para autoridades (F2 + N-4)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-02

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-056 (BANDA 3; radica ZEUS). Fuentes:
PROPUESTA-FUNCIONALIDADES-ESTRATEGICAS §F2 (línea 99) y PLAN-DE-TRABAJO-READINESS
Fase 6 línea 72 (N-4, panel/exportación forense para autoridades) + línea 81 (F2 = N-4:
PDF por plantilla por conducta, D-23 nunca IA; evento sin contenido en AuditLog, D-22;
canales/plantillas en `mensaje.padre.canales`; la plataforma NO retiene el PDF; revisión
legal de la plantilla = CEO, no bloquea el código). Reverificado en fuente 2026-08-02:
(a) el patrón de PDF existe — pdfmake en Node con Buffer en memoria y descarga por
attachment SIN persistir (`src/lib/colegio/pdf-estadisticas.ts:94`,
`src/app/api/colegio/estadisticas/pdf/route.ts:53-77`); (b) las plantillas deterministas
por conducta y los canales oficiales ya existen — `PLANTILLAS_CONDUCTA` y
`cargarCanalesPadre()` leyendo el parámetro `mensaje.padre.canales`
(`src/lib/expediente/mensaje-padre.ts:36-79,158-173`; semilla con Línea 141 ICBF, CAI
Virtual y Te Protejo en `prisma/seed.ts:1010-1019`); (c) el enum `AccionAudit`
(`prisma/schema.prisma:45-119`) NO tiene acción de denuncia formal ni de exportación
forense — requiere migración ADITIVA de enum; (d) el expediente del reporte (donde va el
botón) ya gatea campos sensibles por módulo (`expediente_revelar_original`,
`src/app/api/admin/reportes/[id]/expediente/route.ts:61-76`) y audita sin contenido.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Generar documento de denuncia formal desde el expediente (Priority: P1)

Como ADMIN o integrante del COMITE_VALIDACION con un reporte ya clasificado, quiero un
botón "Llevar a denuncia formal" en el detalle del reporte que genere y descargue un PDF
estructurado para presentar ante un canal oficial (Línea 141 ICBF, CAI Virtual, Te
Protejo), de modo que el salto entre "vi algo preocupante" y "hice una denuncia formal"
deje de perderse por fricción.

**Why this priority**: Es el ítem F2 completo y la métrica de impacto del producto
("N denuncias formales facilitadas"); sin ella el flujo termina en la clasificación.

**Independent Test**: desde el expediente de un reporte en estado CLASIFICADO, elegir
canal y confirmar → se descarga un PDF con plantilla determinista por conducta (sin IA),
la respuesta es `application/pdf` por attachment, NO queda ningún archivo persistido en
servidor ni en BD, y existe UNA fila en `AuditLog` con la acción nueva, el reporte_id,
el canal_destino, la fecha y el usuario_id — sin contenido del documento.

**Acceptance Scenarios**:

1. **Given** un reporte con clasificación (CLASIFICADO, CORREGIDO o REVISION_MANUAL) y
   un usuario con el módulo `denuncia_formal`, **When** pulsa el botón, elige canal y
   confirma, **Then** descarga el PDF por plantilla determinista de las conductas
   confirmadas y se registra el evento de auditoría sin contenido.
2. **Given** un reporte PENDIENTE/PROCESANDO/POSIBLE_SPAM/DUPLICADO o sin clasificación,
   **When** se invoca el endpoint, **Then** responde 409 (el botón no se muestra en la
   vista).
3. **Given** un usuario sin el módulo `denuncia_formal` (o rol PARENT/SCHOOL_ADMIN),
   **When** invoca el endpoint, **Then** responde 403 y no se genera documento ni evento.
4. **Given** la generación completada, **When** se inspecciona el servidor y la BD,
   **Then** no existe el PDF retenido: solo el evento en `AuditLog` (metadatos, nunca el
   documento ni el texto del reporte).

---

### User Story 2 — Panel forense para autoridades (N-4) (Priority: P2)

Como ADMIN o integrante del COMITE_VALIDACION, quiero una vista forense del expediente
con los datos autorizados (identificador reportado, plataforma, fechas, ubicación,
conductas confirmadas y traza de estados) y su exportación a PDF, de modo que una
autoridad (ICBF 141, CAI, Te Protejo) reciba un insumo estructurado SIN la identidad del
denunciante.

**Why this priority**: N-4 es la base declarada de F2 (PLAN línea 72: "= base de F2");
sin la vista controlada, compartir el expediente con autoridades sería copiar pantallas
internas con datos del denunciante.

**Independent Test**: `GET` de la vista forense de un reporte con denunciante
autenticado → el JSON y el PDF contienen los campos autorizados y NUNCA `usuarioId`,
email, IP ni huella del denunciante; cada exportación registra su propio evento de
auditoría (quién exportó, qué reporte, cuándo — sin contenido).

**Acceptance Scenarios**:

1. **Given** un reporte con denunciante autenticado, **When** se consulta la vista
   forense, **Then** responde solo los campos autorizados (lista explícita en plan) y
   ningún dato que identifique al denunciante (ni directo ni en metadatos).
2. **Given** la vista forense, **When** se exporta el PDF, **Then** se descarga por
   attachment, no se retiene, y se registra `EXPEDIENTE_FORENSE_EXPORTADO` en AuditLog.
3. **Given** un reporte anónimo, **When** se consulta, **Then** la vista funciona igual
   (el campo de origen dice "anónimo", sin intentar resolver identidad).

---

### User Story 3 — Métrica de impacto "denuncias formales facilitadas" (Priority: P3)

Como responsable de producto, quiero contar los eventos de denuncia formal generada
(total y por período) de forma agregada, de modo que la métrica de impacto que exige un
fondo o aliado institucional sea consultable sin exponer reportes.

**Why this priority**: Es la salida medible de F2, pero depende de que US1 ya registre
eventos; con US1 hecho, esto es una agregación sobre AuditLog.

**Independent Test**: tras N generaciones (US1), la consulta agregada devuelve N (total)
y el desglose por mes cuadra con las fechas de los eventos; la respuesta es solo números
(sin reporte_id ni usuario_id).

**Acceptance Scenarios**:

1. **Given** 3 eventos `DENUNCIA_FORMAL_GENERADA` en el mes, **When** se consulta el
   contador, **Then** devuelve total 3 y el período correcto, sin identificadores.
2. **Given** cero eventos, **When** se consulta, **Then** devuelve 0 (no error).

---

### Edge Cases

- Doble clic / reintentos: cada generación es un evento propio (no hay dedup — el
  documento no se retiene; el conteo de eventos es el dato fiel de uso). La UI deshabilita
  el botón mientras corre la generación.
- Reporte eliminado (`eliminado = true`) o dado de baja: el endpoint responde 404/409 —
  no se generan documentos de reportes fuera de circulación.
- Conductas sin plantilla específica (OTRO, SPAM): se usa la plantilla genérica (mismo
  fallback que `PLANTILLA_GENERICA`, `mensaje-padre.ts:31-34`).
- Parámetro `mensaje.padre.canales` ausente o inválido: el PDF sale sin sección de
  canales (degradación elegante, como `cargarCanalesPadre`, `mensaje-padre.ts:160-173`)
  y se registra warn; nunca rompe la generación.
- El PDF de denuncia NUNCA incluye el texto original del reporte (posible evidencia;
  constitución: no modificar ni exponer — la revelación gated existente,
  `TEXTO_ORIGINAL_REVELADO`, es un flujo aparte y humano). La denuncia estructura
  metadatos y conductas; la evidencia la aporta quien denuncia.
- Vista forense de reporte con texto anonimizado o en REQUIERE_ANONIMIZACION: se muestra
  el estado y la traza, nunca campos gated no revelados.
- El lenguaje del documento es descriptivo/estadístico ("se registraron reportes que
  describen…"), nunca veredictos ("número peligroso") — presunción de inocencia.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer el botón "Llevar a denuncia formal" en el detalle/
  expediente del reporte (admin/comité) SOLO cuando el reporte tiene clasificación
  (CLASIFICADO, CORREGIDO, REVISION_MANUAL), no está eliminado, y el usuario tiene el
  módulo de permisos `denuncia_formal` (nuevo, hijo de `bandeja_reportes`, aditivo al
  catálogo de `src/lib/permisos-catalogo.ts:14-38`, patrón de
  `expediente_revelar_original`).
- **FR-002**: El sistema DEBE generar el PDF con pdfmake en memoria (Buffer) siguiendo
  el patrón de `src/lib/colegio/pdf-estadisticas.ts:94` y responderlo por
  `Content-Disposition: attachment` como `src/app/api/colegio/estadisticas/pdf/route.ts:73-77`.
  El documento se arma por PLANTILLA DETERMINISTA por conducta (D-23: NUNCA IA, nunca
  LLM — mismo principio que `mensaje-padre.ts:4-5`).
- **FR-003**: La plataforma NO DEBE retener el PDF: ni en disco, ni en BD, ni en la cola.
  Solo se genera y descarga en la misma respuesta.
- **FR-004**: El sistema DEBE registrar en `AuditLog` el evento con acción nueva
  `DENUNCIA_FORMAL_GENERADA` (valor ADITIVO del enum `AccionAudit`,
  `prisma/schema.prisma:45-119`; migración aditiva de enum) con metadatos
  `{ reporteId, canalDestino, usuarioId, fecha }` — NUNCA contenido del documento ni del
  reporte (D-22; IP hasheada por `logAudit`, `src/lib/audit.ts:12-16`).
- **FR-005**: Los canales destino DEBEN leerse del parámetro `mensaje.padre.canales`
  (Línea 141 ICBF, CAI Virtual, Te Protejo; `prisma/seed.ts:1010-1019`), editables sin
  desplegar y revisables por legal; el canal elegido se selecciona en el flujo antes de
  generar.
- **FR-006**: El sistema DEBE ofrecer la vista forense (N-4) con una lista EXPLÍCITA de
  campos autorizados (definida en plan) y DEBE excluir siempre la identidad del
  denunciante (`usuarioId`, email, IP, huella anti-abuso, datos de sesión). La
  exportación a PDF forense sigue las mismas reglas de FR-002/FR-003 y registra
  `EXPEDIENTE_FORENSE_EXPORTADO` (segundo valor aditivo del enum).
- **FR-007**: El PDF de denuncia y la vista/exportación forense NO DEBEN incluir el texto
  original del reporte (posible evidencia; la revelación gated existente queda intacta y
  separada).
- **FR-008**: El sistema DEBE exponer el conteo agregado de eventos
  `DENUNCIA_FORMAL_GENERADA` (total y por período) sin identificadores, como métrica de
  impacto (US3).
- **FR-009**: Todo texto del documento y de la UI DEBE usar lenguaje
  descriptivo/estadístico (presunción de inocencia, constitución §1.3) y mostrar los
  canales oficiales de forma visible (constitución); tono neutral sin voseo.
- **FR-010**: Los endpoints nuevos DEBEN validar entrada con Zod, aplicar rate limit
  (scope `admin_read`), autenticar con `verifyAuth` + `assertModulo`, y traer su
  `.test.ts` (patrón de test de API del repo).

### Key Entities *(include if feature involves data)*

Sin tablas nuevas. Cambio de datos ADITIVO: dos valores nuevos en el enum `AccionAudit`
(`DENUNCIA_FORMAL_GENERADA`, `EXPEDIENTE_FORENSE_EXPORTADO`). Los eventos viven en el
modelo `AuditLog` existente (`prisma/schema.prisma:357-381`), con los metadatos del
evento en su campo `metadatos` (Json) — sin contenido.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Generar una denuncia desde el expediente produce un PDF válido por
  attachment y exactamente UNA fila `AuditLog` con acción `DENUNCIA_FORMAL_GENERADA` y
  metadatos sin contenido (test de integración del endpoint).
- **SC-002**: Tras la generación, no existe ningún artefacto del PDF persistido (test que
  afirma que la respuesta es el único destino del Buffer).
- **SC-003**: La vista forense de un reporte con denunciante autenticado no contiene
  `usuarioId`, email, IP ni huella en ningún nivel del JSON (test de ausencia, no solo de
  presencia de los campos autorizados).
- **SC-004**: Cada exportación forense registra `EXPEDIENTE_FORENSE_EXPORTADO` (test).
- **SC-005**: El contador agregado cuadra con los eventos generados en prueba (N = N).
- **SC-006**: Migración aditiva aplicada (enum con 2 valores nuevos, ninguno eliminado);
  suite completa + tsc + lint + build + arch:check verdes.

## Assumptions

- Roles habilitados por defecto: `ADMIN` y `COMITE_VALIDACION` vía el módulo
  `denuncia_formal` (el instructivo dice "admin/comité"). Si ZEUS quiere incluir
  `OPERADOR`, es solo otorgar el módulo — el mecanismo no cambia.
- Las plantillas de denuncia por conducta viven en código (o parámetro) con texto
  base provisional; la revisión legal es del CEO y NO bloquea el código (PLAN línea 81):
  el texto final se ajusta editando la plantilla, sin tocar la mecánica.
- El flujo de "envío directo al canal" (convenio con ICBF/Policía) queda FUERA: sin
  convenio, el documento se descarga y el usuario lo presenta por su cuenta (PROPUESTA
  §F2 restricciones).
- El texto original del reporte no viaja en ningún artefacto de esta spec (FR-007); si
  una autoridad lo requiere, es decisión humana por el flujo gated existente — no se
  automatiza.
- La métrica de impacto (US3) se resuelve con agregación sobre `AuditLog`; no requiere
  tabla nueva ni dashboard dedicado en esta iteración (endpoint/consulta agregada mínima).

## Impacto en arquitectura

Impacto en arquitectura: endpoints nuevos bajo `src/app/api/admin/reportes/[id]/`
(denuncia-formal, forense), nuevo módulo de permisos en el catálogo y dos valores
aditivos en el enum `AccionAudit`. NO toca el motor de clasificación, la visibilidad
pública ni el flujo del reporte. Al añadir rutas API, hay que REGENERAR los artefactos
de `docs/architecture/` y dejar `npm run arch:check` en VERDE en el mismo PR (regla de
oro).

## Implementación (cierre)

Implementada el 2026-08-02 en `feature/001-scaffolding` vía PR #10 (CI verde).

- **PDF determinista (D-23)**: `PLANTILLAS_DENUNCIA` por conducta con fallback genérico
  (pdfmake, `info.creationDate` fija → byte-idéntico con mismos datos, testeado).
  NUNCA IA. La plataforma NO retiene el PDF (descarga directa).
- **Evento sin contenido**: `AccionAudit` += `DENUNCIA_FORMAL_GENERADA` /
  `EXPEDIENTE_FORENSE_EXPORTADO` (aditivos); metadatos `{reporteId, canalDestino,
  usuarioId, fecha}`. Nota de integración: escritas vía SQL crudo
  (`audit-nuevas-acciones.ts`, TODO migrar a `logAudit`) porque el cliente Prisma se
  regeneró después; con el cliente actualizado el listado audit-logs lee todo.
- **Panel forense (N-4)**: `armarExpedienteForense` por WHITELIST cerrada (nunca
  usuarioId/IP/huella/texto/tenant); vista JSON + exportación PDF auditada.
- **Permiso**: módulo `denuncia_formal` (hijo de bandeja_reportes, esCritico; default
  ADMIN + COMITE_VALIDACION — los guard-tests del seed se actualizaron por decisión ZEUS,
  sin reabrir D-43). Botón en el expediente compartido solo con el módulo y estados
  CLASIFICADO/CORREGIDO/REVISION_MANUAL.
- **Tests**: 52 nuevos (PDF determinista, no-persistencia, AuditLog sin contenido,
  guards, whitelist sin identidad); regresión 189/189 + 78/78.
