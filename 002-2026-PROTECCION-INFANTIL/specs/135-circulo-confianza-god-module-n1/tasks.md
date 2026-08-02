# Tasks: SPEC-135 — circulo-confianza: god-module + N+1

**Input**: plan.md + spec.md (APROBADO por ZEUS 2026-08-01, prompt único BANDA 2;
reglas de aceptación 1-7 en ese prompt).

## Fase 1 — Partir el god-module (FR-001/FR-002)

- [x] T001 `tipos.ts` (EstadoContacto, IdentificadorInput, DatosReporte, helpers puros)
- [x] T002 `estado.ts` (calcularEstado, whereReportesCirculo, determinarEstadoContacto,
      contarContactosActivos, obtenerTopeContactos, obtenerUmbralAgregacion)
- [x] T003 `contactos.ts` (listarContactos, agregarContacto, actualizarContacto,
      obtenerDetalleContacto, validarPlataformas, normalizarIdentificadores)
- [x] T004 `agregado.ts` (obtenerVistaAgregada, construirAgregado)
- [x] T005 `preferencias.ts` + `notificaciones.ts`
- [x] T006 `index.ts` barrel (API pública completa) + borrar `circulo-confianza.ts`;
      suite del módulo verde sin tocar expectativas

## Fase 2 — N+1 (FR-003/FR-004)

- [x] T007 `listarContactos` con UNA query de reportes + agrupación en memoria (mismo
      resultado por construcción)
- [x] T008 Test anti-N+1: conteo de queries constante con N contactos
- [x] T009 Revisar `notificarCambioCirculoSiCorresponde` y `obtenerVistaAgregada`:
      N+1 real → mismo fix; loop de emails legítimo → documentar

## Fase 3 — Gates y cierre

- [x] T010 Suite completa + tsc + lint + build + arch:check verdes; ningún archivo > ~250 L
- [x] T011 Cierre documental: spec.md (Status + §Implementación), checklist, specs/README.md
