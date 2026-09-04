# Tareas · SPEC-427b — El código de expediente, de punta a punta

- [x] T001 Migración: 2 valores de `AccionAudit` (`CODIGO_DIGITADO`, `EXPEDIENTE_ABIERTO`), lección I-277.
- [x] T002 `expediente.service.ts`: emitir (barredor), digitar (consumir+auditar en tx), leer (con H-2 por lectura), `tieneAccesoAlExpediente`.
- [x] T003 `barrerRecordatoriosDeExpediente` en el worker `pi-citas` (quinto barredor); repo `listarConfirmadasConExpedientePorArrancar`.
- [x] T004 `lecturaDelExpedientePorId` en el DAL (Q-3); el servicio del profesional no toca Prisma.
- [x] T005 Endpoints POST (digitar) + GET (leer, auditado) `/api/profesional/citas/[id]/expediente`.
- [x] T006 Panel: `AbrirExpediente.tsx` activa el bloque «Expedientes compartidos» (SPEC-425 lo dejó listado sin abrir).
- [x] T007 Seed del evento `cita.codigo_expediente.recordatorio` + guardián (no bloqueante).
- [x] T008 6 tests de integración + 6 candados estáticos con contraprueba; candado del worker al quinto barredor; candado del panel al quinto botón.
- [x] T009 Gate, fila en `specs/README.md`, PR.

## Anotado

- Apilada sobre #339 (SPEC-427). Se mergea después.
- BI ya tiene los 7 valores de enum (5 de 427 + 2 de 427b). Sin coordinación pendiente.
