# SPEC-429 · Tasks

## Hecho (este PR)

- [x] Migración `20260904000000_spec_429_encuestas_y_cruce`: drop `EncuestaPrimeraCita`, crear `EncuestaCita` + `IncidenteContradiccionEncuesta`, agregar `Usuario.encuestaPendiente`, dos `AccionAudit`.
- [x] `EncuestaCitaRepository` + `IncidenteContradiccionEncuestaRepository` (Q-3).
- [x] `UsuarioRepository.findEncuestaPendiente` (patrón `findDebeCambiarPassword`).
- [x] `alCumplirCita(solicitudId)` — contrato de unión con SPEC-427; idempotente.
- [x] `encuestas.service.ts` — validar, persistir, cruzar, recalcular guardia.
- [x] `GUARDIAS_ACCESO.encuesta` + invariante `destino ∈ exentas` + `esExentaEncuesta`.
- [x] `SesionEstadoPayload.encuestaPendiente` + `buildSesionEstadoValue`.
- [x] Bloque en `middleware.ts` (después de `debeCambiarPassword`).
- [x] `GET`/`POST /api/encuesta`.
- [x] `/encuesta/page.tsx` + `EncuestaFormulario.tsx`.
- [x] `EncuestaProfesionalPendiente.tsx` (montaje de una línea en `PanelProfesional`).
- [x] Preguntas de §9-bis en `encuestas-preguntas.ts`.
- [x] Tests desde el primer commit — 11/11 en `encuestas.service.test.ts` + suite `esExentaEncuesta` en `guardias.test.ts` (40 en total).
- [x] `arch:check` VERDE en los 7 gates.
- [x] `tokens:check` piso 1079.
- [x] `npm run lint` 0 errors.

## Seguimiento (fuera de este PR)

- [ ] Notificar por correo/push la encuesta pendiente (L7 · motor de notif).
- [ ] UI del Verificador para resolver `IncidenteContradiccionEncuesta` (SPEC aparte).
- [ ] E2E Playwright del ciclo completo (cita → cumplir → dos encuestas → cruce → incidente).
- [ ] Métricas de agregado sobre r3/r4/r5 (aportan al brief — no disparan incidente).
