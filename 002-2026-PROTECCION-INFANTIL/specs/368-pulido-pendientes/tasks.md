# Tasks · SPEC-368 · A-74 pulido

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## P0 · I-245

- [x] T001 Verificar en fuente y en el despliegue: ya arreglado por SPEC-344, en prod
- [x] T002 Cerrar el hueco real: candado autoconsistente de la plantilla del camino guiado
- [x] T003 Probar el candado simulando la divergencia (cae con el síntoma de I-245)

## P1 · Fecha del hecho

- [x] T004 Verificar el RENDER real del campo en el reportar anónimo (navegador)
- [x] T005 Helpers puros `partesHoraLocal` / `desdePartesHoraLocal` + tests
- [x] T006 Control `FechaHoraIncidente` (día + hora 1-12 + a.m./p.m., sin minutos)
- [x] T007 Conservar candados de B1 (futuro imposible con borde de HOY, error, borrador, hora en punto) + tests
- [x] T008 Montarlo en el paso compartido (entra por anónimo y autenticado)
- [x] T009 I-261: enumerar con grep las vistas de `fechaIncidente` y migrar el detalle del admin
- [x] T010 PDFs fuera de alcance (evidencia legal)
- [x] T011 Corregir la maquetación vista en el navegador (el "p.m." se cortaba)

## P2 · Bandeja

- [x] T012 "Duplicado — sin acción" en vez de "Sin asignar"

## Aseo

- [x] T013 Borrar `ReporteStepUbicacion.tsx` tras confirmar cero referencias

## Pendiente

- [ ] T014 **P3** botón "Asignar huérfanos ahora" + endpoint (no arrancado)
- [ ] T015 **P4** I-262 validar rango de edad en el servidor (no arrancado)
