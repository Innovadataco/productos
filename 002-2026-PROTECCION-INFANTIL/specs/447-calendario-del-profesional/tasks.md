# Tareas · SPEC-447 — El profesional publica su disponibilidad

- [x] T001 Barrido de consumidores de `POST /api/profesional/franjas` en `src/`, `scripts/` **y** `tests/`, sin truncar. Resultado: cero. Verificado por el CEO en prod: `FranjaDisponible` = 0 filas.
- [x] T002 `instanteDesdeHoraBogota` + `sumarMinutos` en `lib/fechas/formato-bogota.ts`, con `fromZonedTime`. La hora en un solo lugar.
- [x] T003 Pantalla `/dashboard/profesional/calendario` (ruta fijada por el CEO): publicar, ver agrupado por día, retirar. El fin sale de `duracionMinutos`.
- [x] T004 Validación de **solape** en el `POST` + consulta `existeSolapada` en el repositorio (incluye las tomadas).
- [x] T005 Validación de **modalidad no atendida** en el `POST`.
- [x] T006 11 candados de conducta contra la base + 4 de clase + 6 de hora de Bogotá.
- [x] T007 Probarlos muriendo: quitar las dos validaciones → 2 rojos y solo esos; que la pantalla deje de llamar al endpoint → el candado de clase en rojo.
- [x] T008 Regenerar `02-roles-capacidades.md` y `03-pantallas.md` (`arch:check` los exige con una ruta nueva).
- [x] T009 Gate: `tsc`, lint, `arch:check`, unit, integración de lo tocado, `specs/README.md`, PR.

- [x] T010 **SPEC-449 · tope de horizonte** (decisión del CEO 17:06: vive acá, no en 449). Una franja no puede terminar después del `venceEn` vigente del profesional, y sin verificación aprobada no se publica. Candados en las dos direcciones, probados muriendo.

## Anotado

- **«Editar» = retirar + publicar.** La API no tiene `PATCH` y el radicado prohíbe reescribirla. Dicho, no sobreentendido.
- **La puerta deja pasar a PARENT** a esta ruta igual que a `/dashboard/profesional`: preexistente, el dato está protegido por `verifyAuth`, pero el padre recibe error en vez de redirect. Reportado, no ensanchado.
- El ítem «Calendario» del menú de **SPEC-437** apunta acá y solo se pinta cuando esta spec esté en main.
- La franja de prueba que siembre el CEO en prod para el recorrido de Jelkin es un rodeo y **no cierra I-311**.
