# Tasks — SPEC-778 · El padre (y el profesional) ven el enlace de la reunión

> Compuerta §4 primero: PARO tras spec+plan+tasks para OK del CEO + copy de Diseño.
> Orden: **778 → 752 → 754**. #743 (754) queda SIN mergear hasta que 778 exista.

## Fase §4 — DISEÑO (este entregable)
- [x] T001 Medición (mecanismo primero): reloj = `estadoEfectivoDeCita` (746); `enlaceVisibleParaCita` sin llamadores; alcance DOBLE; fallback `: nueva` ya fail-closed.
- [x] T002 spec.md v2 (condiciones 1 y 2 resueltas; profesional §5; copy verbatim; candados).
- [x] T003 plan.md v2 (derivación desde 746 + INDETERMINADO + 3 superficies + copy + candados).
- [ ] T004 **PARO** · OK del CEO a las dos condiciones + confirmación de alcance (profesional ya resuelto en `50384ba`).

## Fase implementación (tras aprobación)
- [ ] T005 Exportar `relojUtilizable`/`aEpochMs` de `estado-efectivo.ts`; `derivarEnlaceParaCita(cita, now)` en módulo import-light (deriva de `estadoEfectivoDeCita`, NO comparación nueva); tipo `EnlaceParaCita` compartido con los 4 estados.
- [ ] T006 `toCitaParaPadre` + `toCitaParaProfesional`: agregar `enlace` derivado.
- [ ] T007 `BloqueCalendario` / `calendarioDelProfesional`: agregar `enlace` derivado (misma fuente).
- [ ] T008 Reserva: `enlaceOperadorId`/`enlacePublicadoEn` sin salir; ajustar `dto-reserva.candado` para el valor gateado bajo `enlace.url` sin aflojar los nombres crudos.
- [ ] T009 UI padre (`EsperaCitaPanel`) — copy `160fa5f` verbatim; link escapado; PUBLICADO sin adjetivos.
- [ ] T010 UI profesional (`Paneles.tsx` + vista de solicitudes) — copy §5 `50384ba` («casi nada»), sin «no lo compartas».
- [ ] T011 Candados: C-visible (3 superficies, url real, cruzar el vivo) · C-sin-reloj (condición 2) · C-fuente-reloj (condición 1) · C-copy-sin-adjetivos · C-fuente-única · C-reserva · C-no-crudo · C-no-BI/no-HTML.
- [ ] T012 Gates: `tsc` + `lint` + `arch:check` + `test:unit` COMPLETO. Sin migración.
- [ ] T013 Índice de specs (`specs/README.md`) + cierre.

## Notas
- Condición 1: el reloj sale de `estadoEfectivoDeCita` (746), no de una frontera nueva ni de `enlaceVisibleParaCita` (redundante, sin llamadores).
- Condición 2: estado desacoplado del reloj (publicación = hecho de datos); `now` inválido → INDETERMINADO (sin mentir); la url y la fase PASADA usan el reloj.
- Alcance DOBLE resuelto por Diseño §5 (`50384ba`): profesional = «casi nada». Se implementan las 3 superficies.
- Interacción (D-5): `BloqueCalendario` lo tocan 778 (+enlace) y 754 (−contactoEmail); 778 primero; al llegar a 754 no revertir el enlace.
- El enlace es acceso a la sesión de un MENOR: nunca a `AuditLog.metadatos`, nunca por correo, nunca como HTML.
