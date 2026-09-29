# Tasks — SPEC-778 · El padre (y el profesional) ven el enlace de la reunión

> Compuerta §4 primero: PARO tras spec+plan+tasks para OK del CEO + copy de Diseño.
> Orden: **778 → 752 → 754**. #743 (754) queda SIN mergear hasta que 778 exista.

## Fase §4 — DISEÑO (este entregable)
- [x] T001 Medición (mecanismo primero): visibilidad ya existe (750 `enlaceVisibleParaCita`); alcance DOBLE (padre + profesional, medido); fallback `: nueva` ya fail-closed.
- [x] T002 spec.md (hallazgo, alcance doble, FR, estados §7, decisiones, candados).
- [x] T003 plan.md (derivación única + consumo en 3 superficies + reserva mantenida + UI + candados).
- [ ] T004 **PARO** · OK del CEO al contrato + copy de Diseño para los 3 estados.

## Fase implementación (tras aprobación)
- [ ] T005 `derivarEnlaceParaCita(cita, now)` en módulo import-light (reusa `enlaceVisibleParaCita`); tipo `EnlaceParaCita` compartido.
- [ ] T006 `toCitaParaPadre` + `toCitaParaProfesional`: agregar `enlace` derivado.
- [ ] T007 `BloqueCalendario` / `calendarioDelProfesional`: agregar `enlace` derivado (misma fuente).
- [ ] T008 Reserva: `enlaceOperadorId`/`enlacePublicadoEn` siguen sin salir; ajustar `dto-reserva.candado` para el valor gateado bajo `enlace.url` sin aflojar los nombres crudos.
- [ ] T009 UI padre (`EsperaCitaPanel`) por estado — copy [DISEÑO]; link escapado, nunca HTML.
- [ ] T010 UI profesional (`Paneles.tsx` calendario y/o vista de solicitudes) por estado — copy [DISEÑO].
- [ ] T011 Candados: C-visible (3 superficies, url real, cruzar el vivo) · C-fuente-única · C-reserva · C-no-crudo (fail-closed) · C-no-BI/no-HTML.
- [ ] T012 Gates: `tsc` + `lint` + `arch:check` + `test:unit` COMPLETO. Sin migración.
- [ ] T013 Índice de specs (`specs/README.md`) + cierre.

## Notas
- Visibilidad NO se reinventa (D-1): se reusa `enlaceVisibleParaCita` (750). 778 = consumo + 3.º estado.
- Alcance DOBLE (D-2): el profesional se sirve por sus dos superficies.
- El enlace es acceso a la sesión de un MENOR: nunca a `AuditLog.metadatos`, nunca por correo, nunca como HTML.
