# SPEC-934 · I-450 · El padre ve el total que se cobra (consulta + servicio de la red)

**Status**: IMPLEMENTADO

**Rama:** `work/pi-SPEC-934-precio-cita-desglose` desde `origin/main` (741e86fb). 🔴 dinero cara al usuario.
**Decisión de negocio:** D-103(c) (Jelkin, 03-09): «el profesional fija su tarifa; PI le cobra al padre esa tarifa
MÁS un porcentaje configurable (10 %)».

## Problema

La ficha del profesional y el modal de la cita mostraban solo el precio de la consulta ($50.000), mientras
`crearSolicitudCita` guardaba `montoTotal` = consulta + servicio ($55.000). Y el panel de espera decía «Monto
pagado $55.000» antes de que el pago se aprobara.

## Cambio

- **Fuente única** `src/lib/profesional/cita/cotizacion-cita.ts` → `cotizarCitaNueva()`: lee los MISMOS dos
  parámetros que la creación (precio estándar de la 1ª cita, SPEC-428; `comision.porcentaje`, SPEC-403) y los
  pasa por `desglosarTarifa`. `crearSolicitudCita` ahora calcula con `desglosarTarifa` (antes tenía una copia de
  la fórmula).
- **Ficha y modal** (`ProfesionalPerfil`, `SolicitarCitaPanel`) reciben la cotización del servidor
  (`profesionales/[id]/page.tsx`): la cifra principal es el TOTAL y debajo va el desglose
  (`DesgloseCostoCita`: consulta · servicio de la red (N %) · total).
- **Lo que el padre acepta es lo que se guarda:** el modal envía `totalEsperado`; `POST /api/padre/citas` crea con
  `cotizarCitaNueva()` y, si el total aceptado ya no es el vigente (el admin cambió la comisión o el precio entre
  ver y confirmar), responde **409** con un mensaje para el padre, sin crear la solicitud ni tomar la franja. Al
  409 el modal refresca la cotización.
- **Panel de espera:** «Monto pagado» solo con `pagoAprobadoEn`; antes, «Total a pagar» (`etiquetaMontoCita`).

## Copy

**PROVISIONAL** las etiquetas del desglose («Consulta», «Servicio de la red (N %)», «Total») y el mensaje del 409:
los define Diseño (el CEO los pidió). Voz tú (padre).

## Hallazgos (no corregidos acá; cambian el veredicto)

- **La tarifa del profesional nunca se cobra.** La ruta inyecta el precio estándar como `montoConsultaOverride` en
  TODA solicitud nueva (no solo en la 1ª con ese profesional), así que «De la segunda cita en adelante: $X
  (tarifa del profesional)» describe una regla que el código no aplica.
- Esa misma línea informativa muestra la tarifa SIN el servicio de la red; si algún día se cobra, el padre pagará
  la tarifa + N %.

## Candados

- `src/app/api/padre/citas/precio-desglose.candado.test.ts` (integración, ruta real + BD): `cotizarCitaNueva()`
  == `montoTotal`/`montoConsulta`/`montoServicio` guardados; control positivo: cambiar la comisión cambia la
  cotización, el total viejo → 409 sin solicitud y con la franja libre, el nuevo → se guarda igual.
- `src/components/modules/padre/profesionales/precio-cita-desglose.candado.test.tsx` (unit): la cifra grande de la
  ficha es el total y el desglose suma; otra comisión → otra cifra; el modal envía `totalEsperado`; la creación no
  copia la fórmula; «Monto pagado» solo con pago aprobado. Mutaciones probadas: volver a pintar la consulta → rojo;
  «Monto pagado» literal → rojo.
