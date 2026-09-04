# Tareas · SPEC-449 — La verificación vencida saca al profesional del directorio

- [x] T001 Leer en fuente y verificar los cuatro eslabones del callejón `VENCIDO` **antes** de construir. Escalado al CEO: sin arreglarlo, la spec creaba un defecto peor.
- [x] T002 `reenviarParaVerificacion` acepta `BORRADOR` **o** `VENCIDO`. `RECHAZADO` y `SUSPENDIDO` siguen sin poder.
- [x] T003 Filtro de vigencia en `listarActivos` y `obtenerPublicoPorId` — estado ∧ vigencia, en la consulta.
- [x] T004 `debeExponerContacto` falso para `VENCIDO`, **cableado** en el mapper.
- [x] T005 Consultas del reloj en el repositorio + escrituras con CAS.
- [x] T006 `corrida-vencimiento.service.ts`: pide la decisión a `decidirAcciones` y la aplica. Falla ruidosamente.
- [x] T007 `worker-verificacion-vencimiento.mjs` con `createQueue` antes de `schedule`/`work`.
- [x] T008 Registro en los CINCO sitios: advisory lock 123456800, los dos compose, `docker-adapter`, señal del monitor.
- [x] T009 Hora de corrida parametrizable con default duro + aviso sembrado (plantilla y regla).
- [x] T010 Candados: cableado, registro, hora, y los de conducta del directorio. Probados muriendo.
- [x] T011 Test del monitor pasado de lista literal a **derivada** de `SENALES_MONITOREO`.
- [x] T012 Gate: `tsc`, lint, `locks:check`, `arch:check`, `tokens:check`, unit, integración de lo tocado, `06-stack.md` regenerado.

## Anotado

- **El tope de horizonte vive en SPEC-447**, por decisión del CEO: es alcance natural de «publicar disponibilidad», evita un conflicto de código real y la protección entra un despliegue antes.
- **I-314 (no hay rail de devolución: `Pago` no tiene FK a `SolicitudCita`)** quedó radicado aparte. **No se construyó acá.**
- El residuo del punto 4 —cita confirmada que igual cae después del vencimiento, solo posible si un verificador acorta `venceEn` a mano— se resuelve con aviso al padre y al verificador, **humano en el circuito**. Queda para su spec.
