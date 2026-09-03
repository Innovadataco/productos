# Tasks · SPEC-373 · guardianes alertas + informes

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1)

- [x] T001 Leer los 6 handlers de alertas + POST informes + helper `verificarVigenciaColegio` (candado 15v5)
- [x] T002 I-266: import `verificarVigenciaColegio` + bloque de guard en POST informes (NO en GET, NO en verificar público)
- [x] T003 I-266: 2 tests nuevos — vencido→403 con assert fuerte (0 filas), lectura post-vencimiento→200
- [x] T004 I-251: quitar import + bloque de vigencia en los 7 sitios (6 archivos)
- [x] T005 I-251: 7 tests en archivo dedicado `vigencia.spec-373.test.ts` — vencido→2xx en cada handler (asignar → status ≠ 403 por bug preexistente)
- [x] T006 Candado 26: test *"sin módulo colegios_gestion sigue 403"* con `permisoModulo.activo=false`
- [x] T007 Regresión: correr los 4 tests preexistentes de alertas + informes/route.test.ts (37/37)
- [x] T008 Reportar al CEO el bug preexistente en `asignarAlerta` (enum `AccionAudit` sin `COLEGIO_ALERTA_ASIGNADA`) para radicado aparte
- [x] T009 Docs: spec/plan/tasks + fila en `specs/README.md`
- [x] T010 Gates: tsc, arch/tokens/locks/ratchets, lint, specs-discipline
- [ ] T011 Verificación en vivo del CEO: colegio vencido NO emite pero SÍ lee, bandeja de alertas con colegio vencido lista y actúa, `/verificar/<código>` sigue abierto
