# Tasks · SPEC-387 · I-280

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1)

- [x] T001 Leer `spam/sla.ts` y el patrón hermano `tareas-motor.ts:117-118` (candado 15v5)
- [x] T002 Candado 22v5: enumerar callers de `enviarAlertaRevision` en `src/` y confirmar que solo `spam/sla.ts` es periódico
- [x] T003 Agregar valor `SPAM_ALERTA_REVISION_ENVIADA` al enum `AccionAudit` + migración idempotente
- [x] T004 `npx prisma generate` + `prisma migrate deploy` a la BD de test
- [x] T005 `SpamReporteRepository.obtenerUltimoAvisoSlaSpam(reporteId)` — mismo patrón que `obtenerUltimoAvisoSla`
- [x] T006 `findSpamVencidos`: agregar `actualizadoEn` al `select`
- [x] T007 `revisarSlaSpam`: check del último aviso antes de enviar, audit tras éxito, log final
- [x] T008 Test: dos corridas → 1 correo + 1 audit
- [x] T009 Test: cambio de `actualizadoEn` → 2 correos
- [x] T010 Test: SMTP truena → 0 audits, reintenta en la siguiente vuelta
- [x] T011 Docs: spec/plan/tasks + fila `specs/README.md`
- [x] T012 Gates: tsc, arch/tokens/locks/ratchets, lint, specs-discipline
- [ ] T013 Verificación en vivo del CEO en prod
