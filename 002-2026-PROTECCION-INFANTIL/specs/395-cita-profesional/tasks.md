# Tasks · SPEC-395 · L4 — la cita

## Fase 1 · Setup

- [x] T001 Rama `work/pi-SPEC-395-cita-profesional` desde `origin/main`.

## Fase 2 · Schema y migración

- [x] T010 Añadir `SolicitudCita.pagoAprobadoEn` (aditivo) en `prisma/schema.prisma`.
- [x] T011 Cambiar default de `SolicitudCita.estado` a `SIN_CONFIRMAR` (nuevo flujo manual).
- [x] T012 Añadir 10 valores a `AccionAudit` (`CITA_PROFESIONAL_*`).
- [x] T013 Escribir migración `20260903060000_spec_395_cita_profesional/migration.sql` con `ADD COLUMN` + 10 `ADD VALUE IF NOT EXISTS` + cambio del default.
- [x] T014 Regenerar cliente Prisma.

## Fase 3 · DAL

- [x] T020 [US1] `src/lib/dal/repositories/solicitud-cita.ts` con crear/find/listar/marcar y `contarConsecutivasVencidas`, `tasaVencimientos`.
- [x] T021 [US1] `src/lib/dal/repositories/franja-disponible.ts` con `marcarTomadaSiLibre`, `liberar`, `borrarSiLibre`.
- [x] T022 [US1] Añadir `AuditLogRepository.ultimoPorAccionYRecurso` para el candado I-280.
- [x] T023 [US1] Copiar `PerfilProfesionalRepository` de SPEC-391 (duplicación temporal, idéntico al de #299 · CEO informado).

## Fase 4 · Dominio

- [x] T030 [US2] `src/lib/profesional/cita/dto.ts` con `debeExponerContacto`, `toCitaParaPadre`, `toCitaParaProfesional`.
- [x] T031 [US2] `src/lib/profesional/cita/dto.test.ts` — 10 tests unit del candado del contacto.
- [x] T032 [US2] `src/lib/profesional/cita/cita.service.ts` con crear / aprobarPago / confirmar / rechazar / reprogramar / reasignar / evaluarSuspensionYAlarma.
- [x] T033 [US2] `src/lib/profesional/cita/worker.ts` con `barrerAvisoVencimiento48h` (candado I-280) y `barrerPlazoPagoDelPadre` (libera franja al vencer).
- [x] T034 [US2] `src/lib/profesional/cita/worker.test.ts` — 4 tests integration (2 corridas = 1 audit, defensa I-280, sub-48h no avisa, plazo pago vence libera franja).

## Fase 5 · Endpoints

- [x] T040 [US3] `GET/POST /api/profesional/franjas` + `DELETE /api/profesional/franjas/[id]`.
- [x] T041 [US3] `GET /api/profesional/solicitudes` + `PATCH .../[id]/confirmar` + `PATCH .../[id]/rechazar`.
- [x] T042 [US3] `GET/POST /api/padre/citas` + `POST /api/padre/citas/[id]/reprogramar` + `POST /api/padre/citas/[id]/reasignar`.
- [x] T043 [US3] `GET /api/publico/profesionales/[id]/franjas` (no autenticada — directorio abierto).
- [x] T044 [US3] `GET /api/admin/pagos/cita/pendientes` + `POST /api/admin/pagos/cita/[id]/activar`.

## Fase 6 · Gates y docs

- [x] T050 `npx tsc --noEmit` → 0
- [x] T051 `npx eslint` sobre paths tocados → 0
- [x] T052 Vitest unit `dto.test.ts` → 10/10
- [x] T053 Vitest integration `worker.test.ts` → 4/4
- [x] T054 `specs/395-cita-profesional/{spec,plan,tasks}.md`
- [ ] T055 Fila README de `specs/`
- [ ] T056 Ratchets/tokens/arch/locks/specs-discipline (script del proyecto)
- [ ] T057 Commit + push + PR

## Dependencias

- **Depende de**: SPEC-388a (#294, en main) para modelos base.
- **Coexiste con**: SPEC-391 (#299, en cola de merge). El PerfilProfesionalRepository se duplica idéntico. Al mergear #299, esta rama rebasea y queda un solo repo canónico.
- **Prepara**: L5 (UI del padre/profesional/admin) y L6 (métricas del tablero).

## MVP

Todo lo anterior. Sin este PR no hay agenda, no hay pago, no hay confirmación — la primera cita profesional es imposible.
