# Tareas · SPEC-425 — El panel del profesional (L5)

- [x] T001 Barrido del motor: `Confirmar` y `No puedo` existen (L4); «Proponer otro horario» es acción del padre; **nada escribe `CUMPLIDA` ni `NO_ASISTIO_PADRE`**. Reportado al CEO antes de construir.
- [x] T002 `lib/profesional/cita/comision.ts`: el porcentaje y el desglose en un solo lugar, con el mismo redondeo que el cobro. `api/padre/citas` pasa a importarlo.
- [x] T003 `contarPorProfesional` y `contarFamiliasAtendidas` en el repositorio — el marcador se cuenta en la base, no sobre `take: 100`.
- [x] T004 `panel.service.ts`: agrega solicitudes, agenda, casos por cerrar, por cobrar, marcador (§3), verificación y expedientes compartidos (§9, solo listar).
- [x] T005 `GET /api/profesional/panel`.
- [x] T006 Pantalla `/dashboard/profesional` + `PanelProfesional` + `SolicitudAcciones` (los dos botones con motor).
- [x] T007 Los **dos** mapas de aterrizaje (`homeParaRol` y `homeForRole`) apuntan al panel.
- [x] T008 14 candados estáticos, incluido el que avisa cuándo deja de aplicar el alcance (si alguien implementa el cierre, cae).
- [x] T009 8 tests de integración contra BD propia + **prueba negativa** de la regla §3.
- [x] T010 Gate (`tsc`, `lint`, `tokens:check`, unit) + fila en `specs/README.md` + PR.

## Anotado

- **El mockup dice 10 % de comisión y el producto cobra 15 %.** Se muestra 15; reportado al CEO como decisión de negocio.
- L6 (cierre y encuestas) y L7 (la plata) traen los tres controles que este lote no pinta.
- `PROFESIONAL_NAV_ITEMS` es de SPEC-424: la entrada del panel se agrega cuando ese PR entre.
