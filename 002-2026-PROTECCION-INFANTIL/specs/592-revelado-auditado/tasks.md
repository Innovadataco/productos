# Tasks: Revelado auditado del texto (SPEC-592)

## Fase 1 — Detalle admin (a + b)

- [x] T001 [P] `src/components/modules/reporte-detalle/TextoOriginalPanel.tsx` — prop `textoActual`, nota cuando el revelado es idéntico
- [x] T002 [P] `src/components/modules/AdminReporteDetalle.tsx` — pasar `reporte.texto`
- [x] T003 [P] `src/lib/dal/services/descifrar-contenido.ts` — `OpcionesDescifrado.registrarLectura`
- [x] T004 [P] `src/app/api/admin/reportes-revision/[id]/route.ts` — GET con `registrarLectura: false`
- [x] T005 [P] `src/app/api/reportes/acceso/acceso.test.ts` — test «render no audita ni notifica»

## Fase 2 — Step-up OAuth (c)

- [x] T006 [P] `src/lib/routing/stepup-sello.ts` — `firmarCodigoStepUpEmail`/`leerCodigoStepUpEmail`
- [x] T007 [P] `src/app/api/padre/step-up/codigo/route.ts` — solicitud del código
- [x] T008 [P] `src/app/api/padre/step-up/verificar/route.ts` — verificación y sello
- [x] T009 [P] `src/app/api/padre/reportes/[id]/texto/route.ts` — `metodos` en el 403
- [x] T010 [P] `src/components/modules/padre/TextoSensible.tsx` — UI código por correo
- [x] T011 [P] `prisma/seed.ts` — plantilla + regla `padre.stepup.codigo.email`
- [x] T012 [P] `src/app/api/padre/step-up/codigo/route.test.ts` — 6 casos del flujo
