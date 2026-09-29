# SPEC-750 · El operador convoca la reunión (enlace por cita + cola + límites + registro del hecho)

**Feature Branch**: `work/pi-SPEC-750-enlace-operador-sesion`
**Created**: 2026-09-29
**Status**: DESARROLLO (compuerta §4 pendiente de aprobación del CEO)
**Base medida**: `main` @ `96dfd4f2a` (incluye SPEC-758, esquema del enlace firmado por Datos)

**Radicado**: RADICADO-SPEC-750-2026-09-29 (`53713a5`). Decisiones vinculantes: BRIEF A-79 §2/§5/§7 · FORMA-FLUJO-REUNION-OPERADOR-ENLACE §3/§5/§6/§9/§10/§12 · GUION-OPERADOR-SESION v0.1 (líneas **[NORMA]**).

## Contexto

Una cita CONFIRMADA hoy no tiene forma de realizarse: no hay sala, ni enlace, ni operador. El modelo (Jelkin): un **operador** del pool se asigna a la cita, crea el enlace de la reunión en una plataforma de video **ajena**, lo publica en PI, entra el día de la cita, presenta un guion **NO clínico** y se retira. El **esquema** del enlace ya está en `main` y firmado (SPEC-758: `SolicitudCita.enlaceReunion` + `enlaceOperadorId` + `enlacePublicadoEn`). Esta SPEC construye **el lado del OPERADOR** (se LEE el esquema de 758, no se toca).

## Impacto en arquitectura

**Impacto en arquitectura:** Nuevo rol-superficie: el OPERADOR gana un módulo (`sesiones_operador`) y una pantalla de
sesiones que REUSA el componente de calendario del profesional con un DTO propio SIN PII
(imposibilidad estructural). La asignación de citas extiende el modelo de asignación de
operadores con SIMULTANEIDAD (ventana de tiempo), sin tocar el asignador de reportes. El
esquema de SPEC-758 se LEE (no se toca): el operador asignado y la publicación viven en
`enlaceOperadorId`/`enlacePublicadoEn`. El HECHO de la sesión se registra en `AuditLog`
(append-only, en `PRESERVADOS.tablas`) con `metadatos` TIPADO y SIN url — la columna se
replica entera a `bi_replica`, así que la url nunca entra por construcción. Sin cambios de
schema en esta SPEC. `AccionAudit` no se migra (discriminador en `metadatos.tipo`).

## User Scenarios & Testing

### User Story 1 — El operador ve su cola/calendario SIN PII (Priority: P1)

El operador abre su pantalla de sesiones y ve las citas que le tocan preparar: fecha, hora inicio/fin, duración, modalidad, estado (tomada/enlace), profesional (`nombreVisible`), identificador corto de la cita y el campo del enlace. **Nada del padre ni del menor.**

**Why P1**: es donde se gana o se pierde la minimización [NORMA] (Ley 1581). El componente del calendario del profesional hoy trae `familia`/`relato`/`contactoEmail`; reusarlo sin un DTO propio filtra PII a un rol que no la necesita.

**Independent Test**: sembrar una cita con nombre/relato/correo del padre reales y pedir la vista del operador → ninguno de esos tres aparece en la respuesta (estructural: no se seleccionan, no se «esconden»).

**Acceptance Scenarios**:
1. **Given** una cita asignada con `familia`, `relato` y `contactoEmail` poblados, **When** el operador consulta su calendario, **Then** el DTO no contiene ninguno de esos campos.
2. **Given** el mismo escenario, **When** se inspecciona el tipo del DTO del operador, **Then** no existe la propiedad para cargar esos campos (imposibilidad estructural, no un `omit` en render).

### User Story 2 — Asignación con SIMULTANEIDAD (Priority: P1)

Una cita se asigna a un operador **libre en esa ventana** (franja + duración). Ningún operador queda con dos citas solapadas. Si no hay operador libre a esa hora, la cita **queda sin asignar** y **sube al admin como capacidad** (ámbar, «Sin operador libre»), **antes** del día.

**Why P1**: el asignador existente cuenta CANTIDAD (`menor_carga`) y no mira la hora — reusarlo tal cual rompe en silencio y se descubre el día de la cita.

**Independent Test**: intentar asignar una cita a un operador ya ocupado en esa ventana → rechazo. Control positivo: con la ventana libre → asigna.

**Acceptance Scenarios**:
1. **Given** un operador con una cita 10:00–10:50, **When** se intenta asignarle otra cita que se solapa, **Then** no se le asigna.
2. **Given** ese operador y otro libre a esa hora, **When** se asigna la cita, **Then** cae en el operador libre (desempate por la estrategia existente).
3. **Given** ningún operador libre en la ventana, **When** corre la asignación, **Then** la cita queda `sin asignar` y aparece como problema de capacidad en el tablero del admin antes del día.

### User Story 3 — El operador publica el enlace (Priority: P2)

El operador pega el enlace de la reunión de la cita. PI valida en servidor (solo `https`, jamás interpretado como HTML), lo guarda en la cita y lo marca publicado. PI **muestra/oculta** el enlace derivándolo del tiempo (oculto pasada la hora). **Nunca** se envía por correo.

**Why P2**: sin publicar el enlace la cita no se realiza; pero depende de US1/US2 (asignación + pantalla).

**Independent Test**: publicar un enlace `http://` o con HTML → rechazo servidor; `https://…` válido → se guarda y queda `enlacePublicadoEn` no nulo.

**Acceptance Scenarios**:
1. **Given** una cita asignada al operador, **When** publica un `https://…`, **Then** se guarda `enlaceReunion` + `enlacePublicadoEn`.
2. **Given** un valor `http://…` o con `<script>`, **When** intenta publicar, **Then** el servidor lo rechaza.
3. **Given** una cita cuya hora ya pasó, **When** se deriva la visibilidad, **Then** PI no muestra el enlace.

### User Story 4 — Los límites [NORMA] del operador, en su pantalla (Priority: P2)

Al abrir/entrar, la pantalla del operador muestra sus límites (no grabar, no tomar notas, no quedarse durante el contenido, no reingresar, no dar consejo de salud, nunca a solas con el menor), donde actúa — no en un manual aparte.

**Why P2**: sostiene que el operador es logística y no atención clínica (REPORTE-066). Es copy [NORMA]/legal.

**Independent Test**: la pantalla del operador renderiza las frases de límite marcadas [NORMA].

**Acceptance Scenarios**:
1. **Given** el operador en su pantalla de una sesión, **When** la abre, **Then** ve los límites [NORMA].

### User Story 5 — El registro del HECHO, sin contenido y sin URL (Priority: P2)

El sistema registra el HECHO de la convocatoria en un store durable/append-only: identificador de la cita, convocatoria, marca de ingreso por parte (padre/profesional/operador), timestamps, versión del protocolo. **Cero contenido** del encuentro. **La URL del enlace NUNCA entra al registro** ni a nada que se replique a `bi_replica`.

**Why P2**: la prueba de que el operador convocó es la marca de ingreso + versión de protocolo + timestamp — no una grabación. Y la URL es acceso a la sesión de un menor.

**Independent Test**: plantar un enlace real y correr la convocatoria/registro → el enlace no aparece en ningún `AuditLog.metadatos` (ni en nada BI-bound); el HECHO sí tiene actor+cita+timestamp+versión.

**Acceptance Scenarios**:
1. **Given** una cita con `enlaceReunion` poblado, **When** se registra el HECHO, **Then** ningún registro replicable contiene la URL.
2. **Given** la convocatoria, **When** se consulta el HECHO, **Then** tiene id de cita, marca de ingreso, timestamps y versión de protocolo, y ningún campo de contenido.

### Edge Cases

- **Llegó el día y no hay enlace** (US-caso-feo, FORMA §10): la cita `Atrasada`/sin asignar salta al admin como capacidad. (La copy al padre es FUERA de alcance — espera Diseño.)
- **Reasignar/reprogramar**: el fallback `: nueva` de `padre/citas/[id]/reasignar` y `reprogramar` devuelve el modelo CRUDO al padre. Hoy benigno (enlace null); al poblar el enlace, **debe pasar por DTO** o filtra la URL.
- **Cuenta de operador borrada**: `enlaceOperadorId` es `SetNull` → la cita queda sin operador (reasignable). No es el registro de responsabilidad (ese vive en el HECHO).

## Requirements

### Functional Requirements

- **FR-001**: El sistema DEBE exponer al operador un DTO de calendario que **estructuralmente** no pueda cargar `familia`, `relato` ni `contactoEmail` (select explícito / tipo sin esas propiedades), no un ocultamiento en render.
- **FR-002**: El sistema DEBE reusar el **componente** del calendario del profesional para la vista del operador (misma pantalla, DTO propio).
- **FR-003**: El sistema DEBE asignar una cita solo a un operador **sin otra cita solapada** en la ventana `[inicio, inicio+duración)`; entre los libres, elige por la estrategia existente.
- **FR-004**: Si ningún operador está libre en la ventana, el sistema DEBE dejar la cita **sin asignar** y exponerla al admin como **capacidad** (ámbar, D-120), antes del día.
- **FR-005**: El sistema DEBE validar el enlace **en el servidor**: solo `https`, nunca interpretado como HTML; y publicarlo **solo en PI**, jamás por correo.
- **FR-006**: El sistema DEBE derivar del tiempo la visibilidad del enlace (oculto pasada la hora).
- **FR-007**: El sistema NO DEBE tener ningún campo ni copy de caducidad, vida o «un solo uso» del enlace.
- **FR-008**: La pantalla del operador DEBE mostrar los límites **[NORMA]** (copy exacta pendiente — ver Clarifications).
- **FR-009**: El sistema DEBE registrar el HECHO (id de cita, convocatoria, marca de ingreso por parte, timestamps, versión de protocolo) en un store durable/append-only, **sin ningún campo de contenido**.
- **FR-010**: El HECHO (y todo lo que se replique a `bi_replica`, p. ej. `AuditLog.metadatos`) NO DEBE contener la URL del enlace.
- **FR-011**: El fallback crudo (`: nueva`) de `padre/citas/[id]/reasignar` y `reprogramar` DEBE pasar por DTO (nunca devolver el modelo crudo con el enlace).
- **FR-012**: El acceso del operador a su pantalla DEBE ir por un módulo propio (p. ej. `sesiones_operador`) concedido al rol OPERADOR, con guardia de página.
- **FR-013**: El sistema DEBE decidir y **documentar** si las rutas admin `pagos/cita/pendientes` y `pagos/citas-vencidas` proyectan o aceptan la exposición interna del enlace (no dejarlo por descuido).

### Candados (criterios de auditoría — radicado + D-121)

- **C-a (PII del operador)**: plantar nombre/relato/correo del padre → **ninguno** aparece en la respuesta del operador. Control positivo: los campos existen en la fuente.
- **C-b (simultaneidad)**: asignar a un operador ya ocupado en la ventana → **rechazo**; con la ventana libre → asigna.
- **C-c (URL fuera del HECHO)**: enlace real plantado → **no aparece** en el registro del hecho ni en nada BI-bound (`AuditLog.metadatos`).
- **C-d (fallback DTO)**: el camino crudo de reasignar/reprogramar no devuelve el enlace al padre.

## Success Criteria

- **SC-001**: 0 apariciones de `familia`/`relato`/`contactoEmail` en el DTO del operador (medido con los tres campos poblados).
- **SC-002**: 0 asignaciones con solape por operador; toda cita sin operador libre visible al admin antes del día.
- **SC-003**: 0 apariciones de la URL del enlace en `AuditLog.metadatos` / superficies BI, con el enlace poblado.
- **SC-004**: 0 rutas que devuelvan al padre el modelo crudo de cita con el enlace.

## Assumptions / [NEEDS CLARIFICATION]

- **[NEEDS CLARIFICATION · Diseño/legal]** Copy visible EXACTA de los límites del operador (FR-008). FORMA §6 da la tabla de límites; el GUION v0.1 es **borrador [ABOGADO], no publicado**. ¿Se usa la copy de FORMA §6 como texto de pantalla, o espera firma? «Desarrollo no inventa copy ni criterio legal».
- **[NEEDS CLARIFICATION · Estrategia/legal]** Fuente y valor de la **versión de protocolo** que se guarda en el HECHO (¿el hash/fecha del GUION versionado?).
- **[NEEDS CLARIFICATION · CEO]** Superficie del **tablero de capacidad** del admin (FR-004): ¿widget nuevo, o se reusa `/dashboard/admin/operadores/asignar`?
- **Assumption**: el «operador asignado» de la cita se persiste en `enlaceOperadorId` (SPEC-758), que ya es el operador responsable del enlace; no se agrega campo nuevo. Si la asignación necesita más (p. ej. `asignadoEn`), se **pide** a Datos (no se agrega acá).
- **Assumption**: el HECHO se registra vía `AuditLog` (append-only existente) con `metadatos` **sin URL**; si se prefiere un modelo dedicado no replicado a BI, es decisión de la compuerta.

## FUERA de alcance (a propósito)

Pantalla del padre y del profesional **mostrando** el enlace (espera copy de `CONFIRMADA`-pasada + cierre de SPEC-749 FR-2) · la encuesta · el canal de continuidad · **cualquier cosa que vigile el paso 8** (presencia, asistencia, grabación, «probar que presentó»).

## Precondición legal (no bloquea construir, sí cobrar)

Habilitación de telemedicina (REPS) — BRIEF §8.
