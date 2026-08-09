# Feature Specification: SPEC-149 — Avisos por email configurables

**Feature Branch**: `work/002-pi-058`

**Created**: 2026-08-08

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-058 (continuación D-51; orden ZEUS: 148✓ → 149 → 159 →
…). Fuentes VINCULANTES: BRIEF-DISEÑO-UX-RECTOR v3.0 — §10 fila 8 ("sin aviso el
rector no vuelve: reporte nuevo, umbral por curso, estudiante repetido, resumen del
lunes. Extender `src/lib/mailer/` (no reemplazar) + encolar por `src/lib/queue.ts`
(responder 201 sin bloquear). Nuevo `PreferenciaAlertaColegio`. Idempotencia por
hash{colegioId,tipoEvento,entidadId,día} + tope diario con digest"), §3 (terminología:
**aviso** / "te avisamos", nunca "notificación"), §4.0.1 (la calma se muestra como
trabajo). Patrones: SPEC-134 (tenant-first), SPEC-137 (withUnitOfWork), molde de cron
`apelacion-mantenimiento` (`worker-reportes.mjs:524`).

Verificado en fuente 2026-08-08 (exploración): **`src/lib/mailer/` NO existe** — el
mailer real es `src/lib/email.ts` (Resend, texto plano; se EXTIENDE, no se
reemplaza). Ya hay un email genérico por alerta (`enviarNotificacionColegio` en
`colegio/alertas.ts:136`, inline, copy ciego, cooldown 24 h por parámetro NO
seedeado) que esta SPEC SUPERA (riesgo de doble email si conviven). No existe:
preferencias por tipo de evento, idempotencia por hash, tope diario, digest, umbral
por curso, conteo por estudiante, scheduler semanal, página de configuración del
colegio. `AccionAudit` no tiene acciones de avisos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Aviso cuando hay un reporte nuevo (Priority: P1)

Como rector, quiero recibir un email cuando llega un reporte sobre un estudiante de
mi colegio, sin entrar a la plataforma, de modo que me entere el mismo día y no una
semana después.

**Why this priority**: "Sin aviso el rector no vuelve" — es el evento fundamental;
los otros tres lo complementan.

**Independent Test**: se procesa un reporte visible sobre un identificador del
colegio → se encola un job `colegio-aviso` (201/200 sin bloquear al worker) → el
worker envía UNA vez el email al destinatario configurado (copy ciego, cero PII del
reporte) y registra idempotencia; re-procesar el mismo reporte NO reenvía.

**Acceptance Scenarios**:

1. **Given** una alerta nueva creada, **When** el evento se procesa, **Then** se
   encola (no se envía inline) y el handler envía UNA sola vez por
   `{colegioId, REPORTE_NUEVO, reporteId, día}` — la segunda corrida es no-op por
   unique en BD (idempotencia de verdad, no por cooldown).
2. **Given** la preferencia `REPORTE_NUEVO` deshabilitada, **When** llega el
   evento, **Then** no se envía ni se encola (y queda registrado como omitido por
   preferencia si aplica — auditable).
3. **Given** el email, **When** se lee, **Then** es copy ciego en español humano
   ("Tienes un reporte nuevo sobre tu colegio para revisar", link a
   `/dashboard/colegio/alertas`) — cero texto del reporte, cero identificadores,
   cero scores (I-29, I-28).
4. **Given** el email genérico viejo (`enviarNotificacionColegio`), **When** entra
   la SPEC, **Then** queda SUPERADO por el nuevo pipeline (cero doble email:
   documentado y con tests actualizados a la nueva conducta — nunca debilitados).

---

### User Story 2 — Umbral por curso y estudiante repetido (Priority: P2)

Como rector, quiero que me avisen cuando un curso supera N reportes en una ventana
o cuando un estudiante acumula M reportes, de modo que los patrones puntuales no se
pierdan entre el ruido.

**Why this priority**: Es la señal de "algo está pasando aquí" que un conteo diario
no da; pero sin ella el aviso básico (US1) ya funciona.

**Independent Test**: con umbral N=2 en 7 días para el curso y M=2 en 30 días para
el estudiante: al llegar el segundo reporte del curso/estudiante se envía el aviso
UNA vez por día por entidad; al día siguiente puede volver a avisar si sigue
superando.

**Acceptance Scenarios**:

1. **Given** el 2º reporte distinto del curso en 7 días, **When** se evalúa tras la
   alerta, **Then** se encola aviso `UMBRAL_CURSO` (cursoId) — el primero NO dispara
   (cruza al llegar a N, no antes ni en cada uno).
2. **Given** el 2º reporte distinto sobre identificadores del MISMO estudiante
   (aunque sean nicks distintos) en 30 días, **When** se evalúa, **Then** se encola
   `ESTUDIANTE_REPETIDO` (estudianteId) — copy ciego ("un estudiante de tu colegio
   acumula reportes esta semana", sin nombre en el email).
3. **Given** umbrales configurables por colegio (N, M, ventanas), **When** el
   colegio los cambia, **Then** rigen desde el siguiente evento y quedan en
   AuditLog (`COLEGIO_AVISO_PREFERENCIA_ACTUALIZADA`).

---

### User Story 3 — Tope diario con digest y resumen del lunes (Priority: P2)

Como rector, quiero recibir como máximo un puñado de emails al día y un resumen el
lunes por la mañana con lo de la semana, de modo que los avisos sigan siendo
señal y no ruido que aprendo a ignorar.

**Why this priority**: Fatiga de alarma es la muerte del canal (el mismo principio
del ámbar a 72 h). El digest semanal es el motivo de volver cada lunes.

**Independent Test**: con tope 3/día: los 3 primeros eventos del día envían email
inmediato; el 4º y 5º NO envían y quedan para el digest; el lunes 07:00
(America/Bogota) el schedule envía UN resumen con KPIs de la semana y los eventos
pendientes de digest.

**Acceptance Scenarios**:

1. **Given** el tope diario (parámetro, default 5), **When** se alcanza, **Then**
   los eventos siguientes del día se marcan `PENDIENTE_DIGEST` en el registro y NO
   se envían — nunca se pierden: van en el próximo resumen.
2. **Given** el lunes 07:00 Bogotá, **When** corre el schedule del worker,
   **Then** cada colegio con `RESUMEN_SEMANAL` habilitado recibe UN email con:
   reportes de la semana (D2), lo que "te espera" (embudo de SPEC-158), eventos
   pendientes de digest y link al tablero — cero PII.
3. **Given** un colegio sin actividad en la semana, **When** corre el schedule,
   **Then** el resumen igual llega con copy positivo ("semana tranquila — la
   vigilancia siguió activa") o se omite según preferencia (default: llega — la
   calma se muestra, §4.0.1).

---

### User Story 4 — Página de configuración de avisos (Priority: P3)

Como rector, quiero elegir qué avisos recibo, a qué email y con qué umbrales, desde
mi panel, de modo que el canal se adapte a mi colegio sin llamar a soporte.

**Why this priority**: La configuración hace durable al canal; pero con defaults
sanos los avisos ya funcionan (US1-3).

**Independent Test**: `/dashboard/colegio/configuracion` lista los 4 tipos con
toggle, email destino y umbrales → PATCH persiste en `PreferenciaAlertaColegio` +
audit → el siguiente evento usa lo nuevo.

**Acceptance Scenarios**:

1. **Given** la página, **When** se abre, **Then** muestra los 4 tipos de aviso con
   toggle, email destino (default: el del SCHOOL_ADMIN), N/días de umbral por curso
   y M/días de estudiante repetido, todo con la terminología §3 ("avisos", "te
   avisamos") — cero jerga ("idempotencia", "digest", "cola").
2. **Given** un cambio, **When** se guarda, **Then** `PATCH
   /api/colegio/preferencias-avisos` upsert por tipo (tenant-first), valida email y
   umbrales (1-100 / 1-90 días) y audita.
3. **Given** otro colegio, **When** lee/escribe preferencias, **Then** solo ve las
   suyas (A/B) y no hay defaults por colegio duplicados (upsert único por
   `{colegioId, tipoEvento}`).

---

### Edge Cases

- **Resend caído**: el handler registra el fallo y reintenta por pg-boss (backoff);
  el registro de idempotencia se marca ENVIADO solo tras el 200 del proveedor — un
  fallo no consume la idempotencia.
- **Múltiples colegios con el mismo identificador**: cada uno recibe SU aviso
  (cross-tenant a propósito, como las alertas) sin ver nada del otro.
- **Cambio de email destino a mitad del día**: los envíos posteriores usan el
  nuevo; los ya enviados no se reenvían.
- **Schedule con worker caído**: pg-boss reintenta el schedule; el resumen es
  idempotente por `{colegioId, RESUMEN_SEMANAL, "semanal", semanaISO}`.
- **I-49**: la migración (2 tablas + 2 valores de enum) se genera con diff + shadow
  y se inspecciona línea a línea: cero DROP INDEX (el drift sigue activo).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Modelo `PreferenciaAlertaColegio` (`colegioId`, `tipoEvento` ∈
  {REPORTE_NUEVO, UMBRAL_CURSO, ESTUDIANTE_REPETIDO, RESUMEN_SEMANAL}, `habilitado`,
  `emailDestino?`, `umbral?`, `ventanaDias?`, `@@unique([colegioId, tipoEvento])`)
  y modelo `RegistroAvisoColegio` (`colegioId`, `tipoEvento`, `entidadId`, `dia`
  DATE, `estado` ∈ {ENVIADO, OMITIDO, PENDIENTE_DIGEST, FALLIDO}, `@@unique(
  [colegioId, tipoEvento, entidadId, dia])` — LA idempotencia por constraint).
  Migración aditiva, SQL inspeccionado (I-49), `AccionAudit` +=
  `COLEGIO_AVISO_ENVIADO`, `COLEGIO_AVISO_PREFERENCIA_ACTUALIZADA`.
- **FR-002**: Cola `colegio-aviso` (pg-boss): el enganche de alerta nueva ENCOLA el
  evento (nunca envía inline — "responder 201 sin bloquear"); el worker consume y
  envía con retry. El email genérico viejo queda superado (cero doble envío).
- **FR-003**: Evaluadores de `UMBRAL_CURSO` (N reportes distintos del curso en X
  días) y `ESTUDIANTE_REPETIDO` (M reportes distintos por estudiante en Y días,
  vía join alerta→identificador→estudiante) tras cada alerta nueva — cruzan una
  vez al llegar al umbral, idempotentes por día y entidad.
- **FR-004**: Tope diario por colegio (parámetro `colegio.avisos.tope_diario`,
  default 5): al superarlo, los eventos quedan `PENDIENTE_DIGEST` y se incluyen en
  el próximo resumen — nunca se pierden ni se envían de más.
- **FR-005**: Schedule `colegio-resumen-semanal` (`boss.schedule` lunes 07:00
  America/Bogota, molde `apelacion-mantenimiento`): un email por colegio con
  `RESUMEN_SEMANAL` habilitado — KPIs de la semana (D2), "te espera", pendientes de
  digest, copy positivo en semana tranquila. Idempotente por semana.
- **FR-006**: `src/lib/email.ts` EXTENDIDO (no reemplazado; `src/lib/mailer/` no
  existe — documentado) con las funciones por tipo de evento, copy ciego humano en
  español (§3: "aviso"/"te avisamos"), cero PII/scores.
- **FR-007**: Página `/dashboard/colegio/configuracion` + nav "Configuración" +
  `GET/PATCH /api/colegio/preferencias-avisos` (upsert por tipo, tenant-first,
  validación Zod, audit) — A/B en tests.
- **FR-008**: Seeds: `colegio.notificaciones.*` (los que ya usan los tests sin
  seed) y `colegio.avisos.*` en `prisma/seed.ts`.
- **FR-009**: Tests: idempotencia real (segunda corrida = no-op por constraint),
  umbral cruza solo al llegar a N/M, tope diario + PENDIENTE_DIGEST, schedule del
  lunes (handler invocado directamente), preferencias A/B, email mockeado (patrón
  `vi.mock("resend")` / `vi.mock("@/lib/email")`) — cero llamadas reales.
- **FR-010**: I-28/I-29 intactos (cero PII en emails); no se toca `src/lib/ai/**`;
  `tokens:check` ≤ 1122; arch:check VERDE (ruta + nav + oráculo 55→56).

### Key Entities

- **PreferenciaAlertaColegio** (nuevo): qué avisos quiere el colegio, a dónde y con
  qué umbrales.
- **RegistroAvisoColegio** (nuevo): la bitácora de envíos — idempotencia por
  `@@unique([colegioId, tipoEvento, entidadId, dia])` y fuente del digest/tope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Idempotencia probada a nivel BD: mismo evento/entidad/día dos veces ⇒
  UNA fila, UN email (test con re-proceso del mismo reporte).
- **SC-002**: Umbral y repetido cruzan exactamente al llegar a N/M (test con 1, 2 y
  3 reportes) y respetan la ventana móvil.
- **SC-003**: Tope diario: con tope 3, el 4º evento del día no envía y aparece en
  el resumen del lunes (test del handler del schedule).
- **SC-004**: Cero doble email: el pipeline nuevo reemplaza al genérico (test que
  el hook ya no llama al email viejo inline) y Resend nunca se llama en tests.
- **SC-005**: Migración con SQL inspeccionado (cero DROP INDEX) + `migrate reset &&
  deploy && seed` verde en test + checks de día verdes + CI del PR verde.

## Assumptions

- El destinatario por defecto es el email del SCHOOL_ADMIN del colegio (como el
  flujo actual); `emailDestino` lo sobrescribe por colegio.
- Los parámetros globales nuevos (`colegio.avisos.*`) rigen ventanas y tope; las
  preferencias por colegio rigen habilitación, destino y umbrales N/M.
- El email viejo genérico se SUPERA (no se mantiene modo dual): los tests de
  `alertas.test.ts` que lo verifican se actualizan a la nueva conducta encolada —
  fortaleciendo (verifican encolado + dedup), nunca debilitando.
- `AlertaSuscripcion`/otros canales de email existentes no se tocan.

## Impacto en arquitectura

Impacto en arquitectura: **modifica el modelo de datos** (2 entidades nuevas +
2 valores de enum `AccionAudit`, migración aditiva con inspección I-49 ⇒ regenerar
`docs/architecture/01-modelo-datos.md`, oráculo de modelos 52→54) y **añade**
página (`/dashboard/colegio/configuracion`, oráculo de páginas 55→56), endpoint
(`/api/colegio/preferencias-avisos`), cola pg-boss (`colegio-aviso`) y schedule
semanal en el worker. No modifica proxy ni stack.

## Implementación (2026-08-09)

- Rama `work/002-pi-058`, commits: schema+repos (9ea8fca3) · pipeline+cola+
  emails+worker (19ac4aee) · api+página+seeds (0576eca0) · arch+oráculos
  (dd2a4575) · DAL Q-3+lint worker (495eea3c) · docs de spec.
- Migración `20260809060000_avisos_colegio` 100% aditiva: 2 ALTER TYPE + 2 CREATE
  TABLE + 3 CREATE INDEX + 2 FK. I-49: el diff crudo traía los DROP INDEX del
  drift conocido (AlertaColegio_patronInstitucionalId_idx, Ciudad trgm,
  EmbeddingDataset/Reporte vector), un RENAME INDEX en patrones_institucionales
  y un CREATE EXTENSION vector — NINGUNO se aplica (misma convención de SPEC-145).
  `migrate reset --force && deploy && seed` verde en `proteccion_infantil_test3`.
- Idempotencia real por constraint probada a nivel BD (segunda corrida = no-op,
  UNA fila, UN email). FALLIDO no consume: el retry de pg-boss actualiza la
  misma fila a ENVIADO.
- Cero doble email: `enviarNotificacionColegio` (email inline viejo) eliminado
  del hook; los tests de `alertas.test.ts` ahora verifican encolado + bitácora
  y que NO existen registros ENVIADO inline (fortalecidos, no debilitados).
- Tests nuevos: repos A/B + idempotencia; pipeline (preferencia, tope diario con
  PENDIENTE_DIGEST, FALLIDO/retry, umbrales que cruzan solo al llegar a N/M,
  ventana móvil); resumen semanal (KPIs D2, "te espera", digest entregado,
  idempotencia por semana, semana tranquila, colegio vencido/fallido); emails
  (copy ciego §3, cero PII); ruta A/B; página (§3, cero jerga).
- Checks: tsc 0 · lint 0 · tokens:check 1122/1135 VERDE · arch:check VERDE ·
  build limpia (rm -rf .next) OK.
- Desviaciones: (1) `tipoEvento`/`estado` como String con valores cerrados
  (patrón AlertaColegio.estado) para que la migración quede EXACTAMENTE en lo
  que exige I-49 (CREATE TYPE habría sumado SQL no listado). (2) Tests corridos
  contra `proteccion_infantil_test3` (override de DATABASE_URL por la contención
  FK fantasma de la BD compartida, indicado en el instructivo).
- Pendiente de cierre (ZEUS): deploy limpio con `scripts/dev-restart.sh` +
  quickstart + `cierre.md`.
