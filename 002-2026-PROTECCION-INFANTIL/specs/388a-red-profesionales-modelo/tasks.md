# Tasks · SPEC-388a · L1a

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1)

- [x] T001 Leer brief A-75 §2 + reportar hallazgos 15v5 al CEO (choque fechaNacimiento/documento vs Usuario) y esperar veredicto
- [x] T002 Aplicar veredicto CEO: (a) reusar Usuario para fechaNacimiento y documento; (b) email primero, perfil después; BORRADOR como estado inicial; storage protegido; PDF/PNG/JPG
- [x] T003 Enum `RolUsuario += PROFESIONAL` con migración aditiva idempotente
- [x] T004 Enums nuevos: `EstadoPerfilProfesional`, `ResultadoVerificacion`, `ModalidadCita`, `UrgenciaSolicitud`, `EstadoSolicitudCita`
- [x] T005 Modelo `PerfilProfesional` (1:1 con Usuario, campos §2, índice `[estado, ciudadId]`)
- [x] T006 Modelo `VerificacionProfesional` (historial, `venceEn` = revisadoEn + 4 meses, índices para L2)
- [x] T007 Modelo `FranjaDisponible`
- [x] T008 Modelo `SolicitudCita` con montos denormalizados; adenda CEO 04:50: `REPROGRAMADA` + `solicitudPreviaId` + `pagoHeredadoDeId` (auto-relaciones)
- [x] T009 Modelo `EncuestaPrimeraCita`
- [x] T010 Back-relations en Usuario, Ciudad, Expediente
- [x] T011 Escribir migración SQL a mano (CREATE TYPE, CREATE TABLE, FK, índices, `ADD VALUE IF NOT EXISTS`)
- [x] T012 Placeholder `PROFESIONAL` en 5 `Record<RolUsuario, ...>` para que compile
- [x] T013 Reset BD test + migrate deploy limpio; `prisma validate` + `prisma generate` + `tsc`
- [x] T014 Regenerar `docs/architecture/01-modelo-datos.md`; gates arch/tokens/locks/ratchets/lint verdes
- [x] T015 Spec / plan / tasks + fila `specs/README.md`; commit + push + PR
- [ ] T016 L1b encima de este PR mergeado (registro, perfil, autorización)
