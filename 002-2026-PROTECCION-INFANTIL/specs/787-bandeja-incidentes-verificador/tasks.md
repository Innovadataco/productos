# Tasks · SPEC-787 · Bandeja del verificador «Reportes que no coinciden»

## Fase 1 · Fuente única de clase
- [x] T001 Extraer `claseDeContradiccion` a `src/lib/profesional/cita/plazo-incidente.ts`.
- [x] T002 Refactor `encuestas-cita-cruce.service.ts` para reusarla (conducta preservada).

## Fase 2 · Datos
- [x] T003 [P] DAL `src/lib/dal/repositories/incidente-contradiccion.ts` (`listarAbiertos` orderBy venceEn, `findPorId`, `resolver`).
- [x] T004 Service + DTO `src/lib/profesional/cita/bandeja-incidentes.service.ts` (cablea `estado-efectivo-incidente.ts`; `incumplida` = fuente única; resumen desde la misma fuente).

## Fase 3 · API
- [x] T005 [P] GET `src/app/api/admin/verificacion-profesionales/incidentes-contradiccion/route.ts`.
- [x] T006 [P] POST `.../incidentes-contradiccion/[id]/resolver/route.ts`.

## Fase 4 · UI
- [x] T007 [P] Copy `src/components/modules/verificacion/copy-incidente-verificador.ts`.
- [x] T008 Tarjeta simétrica `src/components/modules/verificacion/IncidenteContradiccionCard.tsx`.
- [x] T009 Client `src/components/modules/verificacion/ReportesNoCoincidenClient.tsx`.
- [x] T010 Página `src/app/dashboard/admin/verificacion/reportes-no-coinciden/page.tsx` (gate `admin_verificacion_profesionales`).

## Fase 5 · Candados
- [x] T011 [P] `bandeja-incidentes.service.candado.test.ts` (orden venceEn, fuente única + control positivo, cero sesión, simetría de shape).
- [x] T012 [P] `IncidenteContradiccionCard.candado.test.tsx` (simetría invert→tono igual, sin adjudicar, sin rubí, «a favor del padre» solo legal).

## Fase 6 · Salida autoexigida + gates
- [x] T013 Quitar `estado-efectivo-incidente.ts` de `scripts/arch/modulos-huerfanos-allowlist.json` (mismo commit).
- [ ] T014 Gates: tsc + lint + candados (RED-first) + arch:check + preflight test:unit.
- [ ] T015 Commit + push + PR + reporte al CEO + envío de pantalla a certificación de Diseño (vía CEO).
