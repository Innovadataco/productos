# Tasks · SPEC-383 · I-277

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1)

- [x] T001 Verificar en `prisma/schema.prisma` cuáles de los 7 valores literales que se castean están y cuáles faltan (candado 22v5)
- [x] T002 Agregar `COLEGIO_ALERTA_ASIGNADA` y `COLEGIO_ALERTA_ESCALADA` al enum + migración con `ADD VALUE IF NOT EXISTS`
- [x] T003 `npx prisma generate` para regenerar el cliente
- [x] T004 Quitar los 4 `as AccionAudit` con literal en `src/lib/colegio/alertas.ts`
- [x] T005 Quitar los 2 `as AccionAudit` en `contactos-mutaciones.ts` y el 1 en `estadisticas/pdf/route.ts`
- [x] T006 Verificar callers de `escalarAlerta` (`src/lib/colegio/alertas.ts:398`) — cero — y borrarla; dejar comentario que apunte al servicio real
- [x] T007 Quitar imports huérfanos de `AccionAudit` donde el único uso era el cast
- [x] T008 Crear `asignar/route.test.ts` con dos tests (asignar → 200 con audit; desasignar → 200 con segundo audit)
- [x] T009 Regresión: correr integration de alertas + informes + circulo — 76/76
- [x] T010 Docs: spec/plan/tasks + fila `specs/README.md`
- [x] T011 Gates: tsc, arch/tokens/locks/ratchets, lint, specs-discipline
- [ ] T012 Verificación en vivo del CEO con la cuenta del rector real de Jelkin
