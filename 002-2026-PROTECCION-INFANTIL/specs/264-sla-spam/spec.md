# Feature Specification: SLA de spam — 48 h configurable con aviso al ADMIN

**Feature Branch**: `work/002-PI-ciclo-operador`
**SPEC**: 264
**Radicado**: 002-PI-167
**Created**: 2026-08-26
**Status**: DESARROLLO
**Input**: INSTRUCTIVO-002-PI-164 · BRIEF-CICLO-OPERADOR-Y-SPAM v1.0 §4.7 §5.6 · I-116

Impacto en arquitectura: el flujo de SLA para `POSIBLE_SPAM` **ya existe en código** — `src/lib/spam/sla.ts::revisarSlaSpam()`, invocado cada 15 minutos por `scripts/monitor-probes.mjs` (línea 214), sobre `SpamReporteRepository.findSpamVencidos`. Lo que falta es (a) el **parámetro `spam.sla_horas` seedeado con valor 48** en `ParametroSistema` con el candado `upsert({create,update:{}})` (anti-I-100) y (b) verificar en vivo que el ciclo dispara el aviso al **ADMIN** vía `enviarAlertaRevision`. Sin migraciones. Cero cambios en `src/lib/ai/**`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Parámetro editable sin desplegar (Priority: P1)

Después del deploy, `SELECT * FROM "ParametroSistema" WHERE clave='spam.sla_horas'` devuelve una fila con `valor='48'`. Un ADMIN puede editar ese parámetro desde `/dashboard/admin/configuracion` sin desplegar; el siguiente ciclo del monitor usa el valor nuevo.

**Why this priority**: SPEC-195 declaró el SLA pero nunca sembró el parámetro; el job cae al default hard-coded (`?? "48"`) y no hay control operativo.

**Independent Test**: seed del proyecto (`npm run db:seed`) crea la fila; `getParametroSistema("spam.sla_horas")` devuelve `{ valor: "48", tipo: "INTEGER" }`.

**Acceptance Scenarios**:

1. **Given** una BD sin el parámetro, **When** corre el seed, **Then** aparece la fila `spam.sla_horas=48`.
2. **Given** una BD con `spam.sla_horas=24` (editado por un admin), **When** el seed vuelve a correr, **Then** el valor **NO** se sobreescribe (upsert `create` con `update: {}` — candado I-100).
3. **Given** un ADMIN, **When** cambia el valor a `72` desde el panel de parámetros, **Then** `revisarSlaSpam()` en la siguiente pasada usa 72 h.

### User Story 2 — Aviso al ADMIN cuando un `POSIBLE_SPAM` supera el SLA (Priority: P1)

Un reporte `POSIBLE_SPAM` cuya `creadoEn < NOW() - 48h` dispara `enviarAlertaRevision` al ADMIN. Los operadores NO reciben el correo (candado del CEO: el aviso va al ADMIN).

**Independent Test**:
- Seed: `spam.sla_horas=48`, 1 reporte `POSIBLE_SPAM` `creadoEn: NOW() - 49h`, 1 admin con email válido, alertas admin habilitadas.
- `revisarSlaSpam()` invoca `enviarAlertaRevision({ estado: "POSIBLE_SPAM", prioridadAlta: true })` con destinatario ADMIN.

**Acceptance Scenarios**:

1. **Given** parámetro 48h y reporte 49h antiguo, **When** corre el job, **Then** se envía 1 alerta al ADMIN con `estado="POSIBLE_SPAM"`.
2. **Given** el mismo reporte 47h antiguo, **When** corre el job, **Then** **no** se envía alerta.
3. **Given** `alerts.admin.enabled=false`, **When** corre el job, **Then** no se envía alerta (respeta el interruptor global vigente).
4. **Given** el parámetro se sube a 72h, **When** corre el job, **Then** el reporte de 49h ya no genera alerta hasta cumplir 72h.

### User Story 3 — Job reutiliza el worker existente (Priority: P2)

Se preserva la orquestación actual (`monitor-probes.mjs`), sin crear worker nuevo ni cola nueva. Restart del monitor vuelve a arrancar el ciclo.

**Independent Test**: `dev-restart.sh` reinicia monitor y worker; `ps aux | grep monitor-probes` muestra un solo proceso; `revisarSlaSpam` corre cada 15 min.

### Edge Cases

- `spam.sla_horas` con valor no numérico o negativo: se ignora (comportamiento vigente de `revisarSlaSpam`).
- Reporte `POSIBLE_SPAM` `eliminado: true`: no se alerta (repositorio ya filtra `eliminado: false`).
- Muchos vencidos en una pasada: se procesan hasta 100 (paginación implícita) — comportamiento vigente que se conserva.
- Sin admins con email válido (`getAdminEmails() === []`): `enviarAlertaRevision` no envía y no crashea.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `prisma/seed.ts` DEBE sembrar la fila:
  ```ts
  {
    clave: "spam.sla_horas",
    valor: "48",
    tipo: TipoParametro.INTEGER,
    categoria: CategoriaParametro.SYSTEM,
    esPublico: false,
    descripcion: "Horas máximas para resolver un POSIBLE_SPAM antes de alertar al admin",
  }
  ```
  usando `upsert({ where: { clave: "spam.sla_horas" }, create: {...}, update: {} })` (candado anti-I-100).
- **FR-002**: `src/lib/spam/sla.ts::revisarSlaSpam` NO cambia — ya lee `getParametroSistema("spam.sla_horas")` con default 48. Se conserva.
- **FR-003**: `enviarAlertaRevision` NO cambia — ya envía a `getAdminEmails()`. Se **verifica con test** que llega SOLO al ADMIN y NO al OPERADOR asignado.
- **FR-004**: `scripts/monitor-probes.mjs` NO cambia — el intervalo de 15 min ya está fijado en `SLA_SPAM_INTERVALO_MS = 15 * 60 * 1000`. Se documenta que reiniciar el monitor aplica cambios de parámetro sin desplegar.
- **FR-005**: DEBEN crearse tests de integración en `src/lib/spam/sla.test.ts` que cubran los 4 escenarios de US2.
- **FR-006**: El parámetro DEBE aparecer en el panel de parámetros del ADMIN sin trabajo extra (el panel lista todo `ParametroSistema` con `esPublico=false` para ADMIN). Se verifica que aparece.

### Key Entities

- `ParametroSistema`: nueva fila `spam.sla_horas`. Sin cambio de schema.
- `Reporte`, `AuditLog`: sin cambio.

---

## Success Criteria *(mandatory, measurable)*

- **SC-011**: `SELECT valor FROM "ParametroSistema" WHERE clave='spam.sla_horas'` devuelve `'48'` tras deploy.
- **SC-012**: un reporte `POSIBLE_SPAM` con 49 h dispara `enviarAlertaRevision` al ADMIN en el siguiente tick del monitor.
- **SC-013**: verificación en vivo post-deploy — el CEO ve la fila y puede editar el valor desde el panel.

---

## Assumptions

- `revisarSlaSpam` ya se invoca cada 15 min desde `monitor-probes.mjs` (verificado, línea 214). No hay que agregar cola nueva.
- `enviarAlertaRevision` está gated por `alerts.admin.enabled`; el flag ya se seedea (comportamiento vigente).
- El panel de parámetros ADMIN lee todas las filas de `ParametroSistema`; no hace falta whitelisting adicional.
- Si un futuro requerimiento pidiera alertar al operador asignado, será una SPEC nueva; hoy el CEO fija que el aviso va al ADMIN.

---

## Dependencies

- Independiente de 261, 262, 263. Merges secuenciales tras 002-PI-157.
