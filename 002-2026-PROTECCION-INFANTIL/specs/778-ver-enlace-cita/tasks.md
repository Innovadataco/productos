# Tasks — SPEC-778 · El padre (y el profesional) ven el enlace de la reunión

> Compuerta §4 primero: PARO tras spec+plan+tasks para OK del CEO + copy de Diseño.
> Orden: **778 → 752 → 754**. #743 (754) queda SIN mergear hasta que 778 exista.

## Fase §4 — DISEÑO (este entregable)
- [x] T001 Medición (mecanismo primero): reloj = `estadoEfectivoDeCita` (746); `enlaceVisibleParaCita` sin llamadores; alcance DOBLE; fallback `: nueva` ya fail-closed.
- [x] T002 spec.md v2 (condiciones 1 y 2 resueltas; profesional §5; copy verbatim; candados).
- [x] T003 plan.md v2 (derivación desde 746 + INDETERMINADO + 3 superficies + copy + candados).
- [x] T004 §4 APROBADO por el CEO (dos condiciones + alcance doble con el profesional). Borrado de `enlaceVisibleParaCita` exigido en esta misma SPEC.
- [x] T004b Borrar `enlaceVisibleParaCita` (3 clases: definición, re-export, test). HALLAZGO check: cero referencias restantes, tsc verde — nada se rompió.

## Fase implementación (tras aprobación)
- [x] T005 `relojUtilizable` exportado de `estado-efectivo.ts`; `derivarEnlaceParaCita(cita, now)` en `enlace-derivado.ts` (deriva de `estadoEfectivoDeCita`, sin comparación nueva); `EnlaceParaCita` con 4 estados.
- [x] T006 `toCitaParaPadre` + `toCitaParaProfesional`: `enlace` derivado (solo CONFIRMADA).
- [x] T007 `BloqueCalendario` / `calendarioDelProfesional`: `enlace` derivado (misma fuente) + select del repo amplía `enlaceReunion`/`enlacePublicadoEn`.
- [x] T008 Reserva intacta: expuse bajo la clave NUEVA `enlace` (no los nombres crudos), así `dto-reserva.candado` sigue verde sin aflojar; `enlaceOperadorId`/`enlacePublicadoEn` no salen ni por valor.
- [x] T009 UI padre (`EsperaCitaPanel`) — copy `160fa5f` verbatim (3 estados + INDETERMINADO defensivo); link escapado; PUBLICADO sin adjetivos.
- [x] T010 UI profesional (`Paneles.tsx`) — copy §5 `50384ba` («casi nada»), sin «no lo compartas»; comentario stale de `CalendarioProfesional` corregido.
- [x] T011 Candados: C-visible (cruzar el vivo, url real, verificado por MUTACIÓN) · C-sin-reloj · C-fuente-reloj · C-copy-sin-adjetivos (padre + profesional). Reserva/no-BI/no-HTML se mantienen por diseño (clave nueva + validación de 750).
- [x] T012 Gates: tsc 0 · lint 0 errores · arch:check VERDE · test:unit 425/3265. Sin migración.
- [ ] T013 Índice de specs (`specs/README.md`) + cierre (tras merge/deploy).

## Notas
- Condición 1: el reloj sale de `estadoEfectivoDeCita` (746), no de una frontera nueva ni de `enlaceVisibleParaCita` (redundante, sin llamadores).
- Condición 2: estado desacoplado del reloj (publicación = hecho de datos); `now` inválido → INDETERMINADO (sin mentir); la url y la fase PASADA usan el reloj.
- Alcance DOBLE resuelto por Diseño §5 (`50384ba`): profesional = «casi nada». Se implementan las 3 superficies.
- Interacción (D-5): `BloqueCalendario` lo tocan 778 (+enlace) y 754 (−contactoEmail); 778 primero; al llegar a 754 no revertir el enlace.
- El enlace es acceso a la sesión de un MENOR: nunca a `AuditLog.metadatos`, nunca por correo, nunca como HTML.
