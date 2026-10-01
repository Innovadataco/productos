# Tasks · SPEC-796 · Contrato firmado del colegio

## Fase 1 · Motor (sobre el modelo de Datos #786)
- [x] T001 Storage `contrato-colegio-storage.ts` + test (cifrado, opaco, PDF-only, eliminar).
- [x] T002 DAL `contrato-colegio.ts` (crear/vigentePorColegio/porId).
- [x] T003 Servicio `contrato-colegio.service.ts` (adjuntar/vista/leer; snapshots; Q-3).

## Fase 2 · Endpoints
- [x] T004 POST subida admin `/api/admin/pagos/cliente/[id]/contrato` (ADMIN + pagos_admin + rate-limit + PDF).
- [x] T005 GET descarga admin `.../contrato/pdf`.
- [x] T006 GET descarga colegio `/api/colegio/contrato/pdf` (dueño por sesión).

## Fase 3 · Superficies + recableo
- [x] T007 Componente admin `AdjuntarContratoColegio` (elegir/subir/subiendo/falla+reintentar/éxito).
- [x] T008 Cablearlo en la ficha cliente (solo colegios).
- [x] T009 Recablear `ContratoCard` + `suscripcion-vista.service/types` a `ContratoColegio` (copy de la forma; SIN-contrato intacto; enlace guardado). NO se escribe `contratoPDFUrl`.

## Fase 4 · Candados
- [x] T010 No-fuga + aislamiento + append-only (integración, RED-first).
- [x] T011 Forma (sin validez, SIN-contrato intacto, enlace guardado).

## Fase 5 · Cierre
- [ ] T012 Gates: tsc + eslint + candados + arch:check + test:unit completo.
- [ ] T013 Rebase sobre main (tras merge de #786) + consolidar commits + push + PR + reporte.
