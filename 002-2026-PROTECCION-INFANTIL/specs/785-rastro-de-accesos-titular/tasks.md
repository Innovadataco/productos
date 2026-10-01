# Tasks — SPEC-785 · Rastro de accesos del titular (MOTOR)

- [x] T001 Medir la fuente: mapear accesos a datos del padre; hallazgo `LecturaReporte` > `AuditLog`; reportar al CEO (decisión de modelo).
- [x] T002 Repo `rastroDeAccesosDelTitular` (filtro por titular dos direcciones + exclusión autoacceso + select lista blanca).
- [x] T003 Service + DTO `AccesoAlDatoTitularDto` (mapa a ISO, consulta pura).
- [x] T004 Declarar `hueco-funcional` en la allowlist (salida autoexigida: SPEC-772 p2).
- [x] T005 spec.md con los TRES límites declarados (L-1 círculo/«no todos los accesos», L-2 VOLUMEN/truncamiento, L-3 autoacceso/suplantación) + decisión de auto-registro.
- [x] T006 Candado de integración con dato REAL (otra familia fuera + propio dentro + sin crudos + autoacceso + truncamiento por volumen).
- [x] T007 Gates: tsc + lint + arch:check + test:unit + integración.
- [x] T008 (hallazgo CEO) Señal de truncamiento en el contrato: el retorno trae `total`/`limite`/`truncado` para que 772 p2 pueda rotular la parcialidad por volumen; candado C-truncamiento con dato plantado.

## Cierre
- [ ] T009 Deploy/consumo: la superficie (SPEC-772 p2) importa el motor y quita el hueco-funcional.
