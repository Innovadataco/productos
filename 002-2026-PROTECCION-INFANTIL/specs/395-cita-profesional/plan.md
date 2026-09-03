# Plan · SPEC-395 · Red de Profesionales · L4 — la cita

## Estrategia

Sobre L1a (schema base ya en main · #294) + L1b (registro · #299 en cola). El PR toca:

1. **Schema + migración** (aditivo) — `pagoAprobadoEn` en `SolicitudCita` y 10 valores nuevos en `AccionAudit`.
2. **DAL** — 2 repos nuevos (`solicitud-cita`, `franja-disponible`) + 1 método nuevo en `audit-log`. Duplicación temporal de `perfil-profesional` mientras SPEC-391 no mergea (queda idéntico al de #299).
3. **Dominio** — `src/lib/profesional/cita/` con DTO + service + worker.
4. **Endpoints** — 9 rutas REST bajo `/api/profesional`, `/api/padre/citas`, `/api/publico/profesionales`, `/api/admin/pagos/cita`.
5. **Tests** — 10 unit (DTO) + 4 integration (worker).
6. **Doc** — spec/plan/tasks + fila README.

## Q-3 (DAL isolation)

Ningún `prisma` fuera de `src/lib/dal/`. El worker delega en `AuditLogRepository.ultimoPorAccionYRecurso` para el candado I-280 (no importa `prisma` directo).

## Candado I-280 (SPEC-387) en los workers

`ultimoAviso48h.creadoEn ≥ solicitud.actualizadoEn` → salta. Escrito así porque:

- **Nunca reintenta correos vencidos** — evita spam.
- **Cuando el estado se mueve** (`actualizadoEn` cambia), la ventana se reabre.
- **Si el correo trueca**, el audit no se registra y la vuelta siguiente reintenta.

Test de defensa en profundidad: se inserta un audit previo con `creadoEn > actualizadoEn`, el worker DEBE saltar y NO mover el estado.

## Contrato de contacto (candado del brief §4)

`debeExponerContacto(solicitud, now): boolean` es una función pura, exportada, testeada. El DTO `toCitaParaPadre` la consulta; nadie más monta el objeto `contactoProfesional`. Simétrico para el email del padre en `toCitaParaProfesional`.

## Reprogramación como fila nueva

Adenda del CEO 04-32/04-50 (SPEC-388a): reprogramar CREA otra `SolicitudCita` con `solicitudPreviaId` + `pagoHeredadoDeId` apuntando a la original, que queda `REPROGRAMADA` (terminal). La regla «una gratis por dupla padre × profesional» se verifica con: **si el padre tiene cualquier solicitud con este profesional y `pagoHeredadoDeId != null`, ya usó la gratis**.

## Suspensión y alarma

Cada `evaluarSuspensionYAlarma(profesionalId)` corre al final del barrido para cada profesional que quedó con al menos una vencida nueva (evita evaluar a los 200):

- **3 consecutivas vencidas** → `EstadoPerfilProfesional.SUSPENDIDO` + audit.
- **`vencidas / total > 1/3` con `total ≥ 3`** → audit `CITA_PROFESIONAL_ALARMA_TASA_VENCIMIENTOS` (no suspende — el tablero de IDC decide).

## Riesgos

- **Duplicación de `perfil-profesional` repo** entre esta rama y #299 — mismo contenido, no habrá conflicto al mergear.
- **La franja se libera al vencer plazo del padre** — si la UI del padre confía en «la franja está esperando tu pago», debe consultar el estado antes de mostrar el CTA. L5 lo cubrirá.
- **Los correos no se disparan acá** — el audit es la fuente única del «se avisó»; el dispatcher externo (o `logAudit`) es quien manda el email. Si mañana se integra un provider distinto, no cambia la lógica del worker.

## Gates locales

- `npx tsc --noEmit` = 0
- `npx eslint` sobre paths tocados = 0
- `npx vitest run --config vitest.unit.config.ts src/lib/profesional/cita/dto.test.ts` = 10/10
- `node --env-file=.env.test ... run src/lib/profesional/cita/` = 4/4
- `npx prisma migrate deploy` en test = ok
