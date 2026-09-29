# SPEC-780 · Tasks

## Fase 1 · Verificar el modelo — HECHO

- [x] T001 Confirmar que reprogramar/reasignar COPIAN `presentacion` a fila nueva con `solicitudPreviaId`; la original queda con sucesor (historial). `cita.service.ts:291,342`

## Fase 2 · Motor — HECHO

- [x] T002 Enum `AccionAudit CITA_PROFESIONAL_RELATO_CORREGIDO` + migración aditiva. `prisma/schema.prisma` · `prisma/migrations/20260929234500_spec780_accionaudit_relato_corregido`
- [x] T003 Repo: `findParaCorreccionRelato` + `corregirRelato`. `src/lib/dal/repositories/solicitud-cita.ts`
- [x] T004 Service `corregirRelatoCita` (rechaza historial, corrige la viva, rastro sin texto). `src/lib/profesional/cita/corregir-relato.service.ts`
- [x] T005 Camino sancionado `PATCH /api/operador/citas/[id]/relato`. `src/app/api/operador/citas/[id]/relato/route.ts`

## Fase 3 · Copy + candados — HECHO

- [x] T006 Copy del límite (§2 forma, verbatim). `src/lib/profesional/cita/copy-correccion-relato.ts`
- [x] T007 [P] Candado de integración: conteo de la cadena + gate de historial + rastro sin texto. `src/lib/profesional/cita/corregir-relato.candado.test.ts`
- [x] T008 [P] Candado del copy del límite. `src/lib/profesional/cita/copy-correccion-relato.candado.test.ts`

## Fase 4 · Cableado / cierre — PENDIENTE

- [ ] T009 Render del copy + petición del padre en el canal de «Mis datos» (752/772) → al cablearlo, quitar `copy-correccion-relato.ts` de la allowlist de huérfanos.
- [ ] T010 Copy §3 (salida para las versiones anteriores) — depende de la respuesta legal (Diseño la redacta con el motivo).
- [ ] T011 [ABOGADO] Cerrar la interpretación: ¿la rectificación alcanza los registros históricos? Si cambia, cambia la conducta.
