# Tasks · SPEC-784 · Rescatar las pantallas de la encuesta sobre el modelo tipado

> §4 aprobado (veredictos CEO 29-09: D-1..D-7). **Sin gate** (D-7: Diseño eligió tarjeta) → 784 NO
> depende de SPEC-751. Copy de Diseño: `d682cdb` (formulario) + `439d1c3` (punto de entrada).

## §4 · Diseño (compuerta) — HECHO
- [x] **T0** · `spec.md` + `plan.md` + `tasks.md`: medición del middleware (Edge, no lee BD), mapeo de
  #341, derivación única, hallazgo D-3 (copy Diseño ≠ labels 753), D-1..D-7.

## Implementación — HECHO
- [x] **T1** · Derivación única (FR-2): `esEncuestaPendientePara` (puro) + `citasConEncuestaPendiente`
  (envoltura, cliente inyectado) en `encuesta-pendiente.ts`. Estados {PASADA, CUMPLIDA, NO_ASISTIO_*}
  (D-2). Candado **C-1** exhaustivo, born-verde, en el manifiesto unit.
- [x] **T2** · `POST/GET /api/encuesta` → delega en el DAL `encuesta-cita.ts` (Q-3, no toca Prisma).
  origen derivado del rol + participación; 409 en 2º envío; coherencia del CHECK. Candado **C-2**
  (integración, 5 casos contra la BD). Sale de la allowlist `encuestas-cita-cruce.service.ts`.
- [x] **T3a** · `encuestas-preguntas.ts` → copy de Diseño (`d682cdb`) + eje de audiencia (role-relative
  `OTRA_PARTE_NO_CONECTO`); keys intactas. Candado reescrito a **estructura + morfología anti-clínica**
  (no prosa), control positivo.
- [x] **T3b** · `EncuestaFormulario` (opciones cerradas, P1 gobierna el árbol → imposibilidad estructural
  del CHECK, FR-3; cero texto libre, FR-5; voz + desenlace por audiencia) + `/encuesta` (page). Candado
  **C-3** (jsdom). Sale de la allowlist `encuestas-preguntas.ts` (el form la importa).
- [x] **T4** · Puntos de entrada (D-7, sin compuerta): `TarjetaEncuestaPendiente` (padre) en
  `DashboardUsuarioClient` (bajo el reporte, sobre «Mis reportes») + `EsperaCitaPanel`; `Bloque`
  «Sesiones por registrar» en `PanelProfesional` (conteo por la fuente única vía DAL). Candado de ORDEN
  **C-4** (árbol de render: el reporte precede a la tarjeta; control positivo por mutación).
- [x] **T5** · ~~Gate de página~~ **ELIMINADA** (D-7): Diseño eligió tarjeta, no compuerta. No se
  construye `encuestaGateDetiene` ni la exención de `SUPERFICIES_PROTECCION`.

## Cierre — EN CURSO
- [ ] **T6** · Gate de calidad: `tsc` + `lint` + `test:unit` + candados + `arch:check` verdes; recorrido
  caminado (padre + profesional) en la app desplegada.
- [ ] **T7** · Cerrar **#341 (SPEC-429)** con el motivo en el PR — **al entrar 784, no antes** (lo mergea
  el CEO).
