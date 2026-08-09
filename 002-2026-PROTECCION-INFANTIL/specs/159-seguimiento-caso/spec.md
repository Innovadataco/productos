# Feature Specification: SPEC-159 — Seguimiento del caso con bitácora

**Feature Branch**: `work/002-pi-058`

**Created**: 2026-08-09

**Status**: DESARROLLO

**Input**: Instructivo 002-PI-058 (continuación D-51; orden ZEUS: …149✓ → 159 →
150 → …). Fuentes VINCULANTES: BRIEF-DISEÑO-UX-RECTOR v3.0 — §10 fila 9 ("Línea de
tiempo (detectado → confirmado → avisado → **lo que falta que haga el rector**) y
campo para **registrar lo actuado**. Memoria institucional y respaldo Ley 1581.
Reusa `AuditLog`. Nuevo `SeguimientoCaso` + `NotaSeguimiento`. Se alimenta de
`EventoMatch` (SPEC-139)"), §3 (terminología), §4.0.1. Patrones: SPEC-134
(tenant-first), SPEC-149 (RegistroAvisoColegio como evidencia de "avisado").

Verificado en fuente 2026-08-09 (exploración): el "caso" del colegio ya existe y es
`AlertaColegio` (único por colegio+reporte+identificador); NO hay página de
detalle de alerta ni GET `/api/colegio/alertas/[id]`; la línea de tiempo se deriva
de fuentes reales (AlertaColegio.creadoEn · AuditLog `COLEGIO_ALERTA_CREADA /
COLEGIO_ALERTA_ESTADO` con timestamps · `RegistroAvisoColegio` ENVIADO por
reporteId · `EventoMatch` por reporteId — todos verificados); `EventoMatch` es
global sin tenant (join por `reporteNuevoId → AlertaColegio.reporteId`, solo
metadatos agregados FR-009); NO existe modelo de notas reutilizable
(`CASO_NOTA_AGREGADA` del enum está muerto y NO se reusa — rompería el aislamiento
por prefijo `COLEGIO_*`); `PasosProcesamiento` es del pipeline admin, no aplica
(el brief: no crearlo aquí).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — La línea de tiempo del caso (Priority: P1)

Como rector, al abrir una alerta quiero ver su historia en una línea de tiempo —
cuándo se detectó, cuándo se corroboró (si hubo match), cuándo la vi, cuándo se me
avisó por email, cuándo la gestioné — de modo que entienda qué pasó sin preguntar
a nadie.

**Why this priority**: "Memoria institucional y respaldo Ley 1581": la traza del
caso es la prueba de que el colegio actuó a tiempo.

**Independent Test**: con una alerta (creada hace 2 días, vista ayer, aviso email
ENVIADO, match de corroboración, gestionada hoy), el detalle muestra los 5 hitos
ordenados asc con sus timestamps reales — cada uno trazable a su fuente (alerta,
AuditLog, RegistroAvisoColegio, EventoMatch).

**Acceptance Scenarios**:

1. **Given** una alerta del colegio, **When** se abre `/dashboard/colegio/alertas/[id]`,
   **Then** la línea de tiempo muestra: detectado (creación de la alerta),
   corroborado (si existe EventoMatch del reporte: "segundo reporte independiente",
   solo metadatos agregados — cero denunciantes/textos), vista/gestionada (desde
   AuditLog `COLEGIO_ALERTA_ESTADO` con fecha real), avisado (email ENVIADO de
   SPEC-149) — asc, con fuente honesta por hito; si un hito no ocurrió, aparece
   como pendiente, nunca inventado (solo verdades).
2. **Given** otra colegio B, **When** pide el detalle de la alerta de A, **Then**
   404 (tenant-first, test A/B) y ningún dato cruza (ni por API ni por timeline).
3. **Given** la lista de alertas, **When** el rector pulsa una, **Then** navega al
   detalle (la lista enlaza al caso).

---

### User Story 2 — "Lo que falta que haga el rector" (Priority: P1)

Como rector, quiero que el propio caso me diga qué me falta por hacer — ver la
alerta, marcarla gestionada, registrar lo que hice — de modo que ningún caso
quede a medias.

**Why this priority**: "Cada pantalla termina en un verbo" (§4.0.3): la línea de
tiempo dice qué pasó; esto dice qué sigue.

**Independent Test**: con una alerta nueva sin gestionar ni notas, el bloque muestra
los pendientes (revisarla, gestionarla, registrar lo actuado); al completarlos, el
bloque muestra el caso al día con copy positivo.

**Acceptance Scenarios**:

1. **Given** el estado real del caso (alerta.estado, existencia de notas), **When**
   se computa server-side, **Then** los pendientes se derivan de datos reales (nada
   hardcodeado): "revisa la alerta" si está nueva · "márcala gestionada cuando
   termines" si no está gestionada · "registra lo que hiciste" si no hay notas.
2. **Given** un caso al día (gestionada + ≥1 nota), **When** se renderiza, **Then**
   copy positivo ("caso al día — quedó registrado lo actuado").
3. **Given** el botón "márcala gestionada", **When** se usa, **Then** llama al
   endpoint EXISTENTE de estado (sin tocarlo) y la línea de tiempo gana el hito.

---

### User Story 3 — Registrar lo actuado (bitácora) (Priority: P1)

Como rector, quiero escribir en el caso lo que hice ("llamé a la acudiente, citada
para el jueves") con fecha y hora, de modo que quede memoria institucional y
respaldo si alguien pregunta después (Ley 1581).

**Why this priority**: Es la bitácora — el propósito nominal de la SPEC junto a la
línea de tiempo.

**Independent Test**: POST nota en el caso → aparece en la bitácora con su
timestamp, queda en AuditLog (`COLEGIO_CASO_NOTA_AGREGADA`), y el pendiente
"registra lo que hiciste" desaparece; la nota NO se puede editar ni borrar
(inmutable, como el texto de un reporte).

**Acceptance Scenarios**:

1. **Given** el campo de nota, **When** se envía, **Then** `POST
   /api/colegio/alertas/[id]/notas` crea `SeguimientoCaso` (si no existe, en la
   misma transacción — withUnitOfWork) + `NotaSeguimiento` (texto ≤ 1000, sanitizado,
   tenant-first) + audit — 201 sin bloquear.
2. **Given** notas existentes, **When** se listan, **Then** ordenadas asc con fecha
   y autor legible, en la misma página del caso.
3. **Given** cualquier nota, **When** se intenta editar/borrar, **Then** no hay
   verbo para ello (inmutable por construcción — respaldo forense; error humano si
   se fuerza por API inexistente → 404).

---

### Edge Cases

- **Alerta sin aviso enviado aún** (OMITIDO/PENDIENTE_DIGEST): el hito "avisado"
  muestra su estado honesto ("aviso pendiente de digest" / "aviso desactivado en
  preferencias") — nunca un check falso.
- **Match global sin tenant**: solo se muestra el hito agregado (corroborado, N
  reportes acumulados, inter-ciudad sí/no) — FR-009 intacto.
- **Nota con HTML/inyección**: sanitizada server-side (texto plano renderizado tal
  cual — React escapa; validación Zod 1..1000).
- **I-49**: migración (2 tablas + 1-2 valores enum) con SQL inspeccionado línea a
  línea.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Modelos `SeguimientoCaso` (`colegioId`, `alertaId` único, `estado`
  default "en_seguimiento", timestamps) y `NotaSeguimiento` (`seguimientoId`,
  `colegioId`, `texto` 1..1000, `autorId`, `creadoEn`) — tenant-first; migración
  aditiva inspeccionada (I-49) + `AccionAudit` += `COLEGIO_CASO_NOTA_AGREGADA`.
- **FR-002**: `GET /api/colegio/alertas/[id]` DEBE devolver el caso completo en UNA
  llamada (alerta + timeline derivada + match agregado + seguimiento con notas),
  404 si no es del colegio — queries paralelas, cero N+1.
- **FR-003**: La línea de tiempo DEBE derivarse de fuentes reales: creación
  (alerta), estados (AuditLog `COLEGIO_ALERTA_ESTADO`), aviso
  (`RegistroAvisoColegio` por reporteId), corroboración (`EventoMatch` por
  reporteId, solo agregados) — hitos pendientes marcados, nunca inventados.
- **FR-004**: `POST /api/colegio/alertas/[id]/notas` DEBE crear caso+nota atómicos
  (withUnitOfWork) + audit `COLEGIO_CASO_NOTA_AGREGADA`; notas inmutables (sin
  PATCH/DELETE — 404 por construcción).
- **FR-005**: La página `/dashboard/colegio/alertas/[id]` DEBE mostrar: resumen del
  caso (estado, curso/estudiante sin PII excesiva — nombre del estudiante y curso,
  plataforma, tipo de identificador), línea de tiempo, "lo que falta que haga el
  rector" (computado server-side), bitácora con formulario. La lista de alertas
  DEBE enlazar al detalle. 100% tokens, terminología §3.
- **FR-006**: Tests: repo/timeline (A/B, hitos con fuentes reales, match agregado),
  POST notas (atómico, A/B, inmutabilidad 404), pendientes computados, componentes
  — cero tests existentes debilitados; `tokens:check` ≤ 1122; arch:check VERDE
  (página nueva: oráculo 56→57; modelos 54→56).
- **FR-007**: I-28/I-29 intactos (cero texto de reporte, cero denunciantes, cero
  scores); no se toca `src/lib/ai/**` ni endpoints existentes (el de estado se
  reusa).

### Key Entities

- **SeguimientoCaso** (nuevo): la continuidad del caso para el colegio — ancla de
  la bitácora, 1:1 con la alerta.
- **NotaSeguimiento** (nuevo): lo actuado, inmutable, con autor y fecha.
- **CasoTimeline (DTO)**: hitos `{ tipo, fecha | null, estado: cumplido|pendiente,
  detalle }` derivados de alerta + AuditLog + RegistroAviso + EventoMatch.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La timeline del fixture muestra los 5 hitos con timestamps reales y
  ningún dato inventado (test por hito presente/ausente).
- **SC-002**: POST nota dos veces seguidas = 2 notas, 1 solo SeguimientoCaso
  (unique alertaId), 2 filas de audit — atómico (fallo provocado = 0 filas).
- **SC-003**: A/B: B recibe 404 en GET y POST del caso de A, sin filas creadas.
- **SC-004**: Inmutabilidad: no existe verbo de edición/borrado de notas (test 404
  a PATCH/DELETE) y la nota sale en Auditoría del colegio (prefijo COLEGIO_*).
- **SC-005**: Checks de día verdes + CI del PR verde.

## Assumptions

- El caso ES la alerta (no se crea otra entidad de caso); `SeguimientoCaso` nace
  con la primera nota (1:1, lazy).
- El match se muestra como hito agregado ("corroborado por un segundo reporte
  independiente") sin ciudades ni conductas al rector — mínimo necesario (si ZEUS
  quiere más detalle, es una línea).
- El estado del caso de seguimiento (`en_seguimiento | cerrado`) queda derivado de
  la alerta gestionada + notas en esta versión; no hay flujo de cierre manual.
- La página de lista enlaza al detalle (cambio mínimo en su client).

## Impacto en arquitectura

Impacto en arquitectura: **modifica el modelo de datos** (2 entidades nuevas + 1
valor enum, migración aditiva I-49 ⇒ regenerar `01-modelo-datos.md`, oráculo
54→56) y **añade** página (`/dashboard/colegio/alertas/[id]`, oráculo 56→57) +
endpoint (`GET/POST /api/colegio/alertas/[id](\/notas)`). No modifica proxy ni
stack.
