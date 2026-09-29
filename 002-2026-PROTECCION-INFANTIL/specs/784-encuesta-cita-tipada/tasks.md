# Tasks · SPEC-784 · Rescatar las pantallas de la encuesta sobre el modelo tipado

> **PARÁ en §4.** La implementación espera aprobación del CEO (D-1..D-6). El gate (T5) además espera
> que SPEC-751 (`SUPERFICIES_PROTECCION` + candado) esté en `main`. Nada marcado salvo el diseño.

## §4 · Diseño (compuerta)
- [x] **T0** · `spec.md` + `plan.md`: medición del middleware (Edge, no lee BD → gate en página), mapeo
  intacto/reescribir/no-rescata de #341, derivación única, hallazgo D-3 (copy de Diseño ≠ labels de 753),
  cierre de 2 de 3 huecos, D-1..D-6. **PARÁ.**

## Tras aprobación §4 — parte que NO depende de 751
- [ ] **T1** · Derivación única (FR-2): núcleo puro `esEncuestaPendientePara` + envoltura
  `citasConEncuestaPendiente` en `src/lib/profesional/cita/encuesta-pendiente.ts`. Candado C-1 (unit)
  born-verde, registrado en `vitest.unit.includes.ts`. Control positivo por mutación.
- [ ] **T2** · `POST /api/encuesta` (FR-1/5/6): valida `key`s (`opcionesValidas`), deriva `origen`,
  coherencia P1 server-side, persiste `EncuestaCita`, llama `cruzarEncuestasCita`, 409 en `@@unique`.
  Test de integración C-2 (201 / 409). **En este commit:** quitar de la allowlist de huérfanos
  `encuestas-preguntas.ts` y `encuestas-cita-cruce.service.ts` (salida autoexigida).
- [ ] **T3** · `EncuestaFormulario` (FR-3/5/7): opciones cerradas de `PREGUNTAS_SERVICIO`; flujo
  condicional de la P1 (duración sii Sí, razón sii No; 3/4/5 siempre; duración desaparece, no «N/A»);
  capa de copy `copy-encuesta.ts` con la palabra de Diseño (`d682cdb`), voz tú/usted, role-relative de
  `OTRA_PARTE_NO_CONECTO`, intro y desenlace por audiencia. Candado estructural C-3 (no monta la casilla
  incoherente; cero texto libre).
- [ ] **T4** · Shell `/encuesta` (`page.tsx`) + panel `EncuestaProfesionalPendiente`: re-derivan pendiente
  con `citasConEncuestaPendiente`; montan el form del lado correcto; redirigen si no hay pendiente.

## Tras SPEC-751 en `main` — el gate (FR-4)
- [ ] **T5** · `src/lib/routing/encuesta-gate.ts`: `encuestaGateDetiene(ruta, hayPendiente)` puro,
  referencia `esSuperficieDeProteccion` (751). Cablear el redirect server-side en la navegación del
  padre/profesional (nunca en un shell que envuelva `/dashboard/padre/reportar`). **Sumar al candado**
  `proteccion-siempre-abierta.candado.test.ts` con control positivo (C-4).

## Cierre
- [ ] **T6** · Recorrido caminado (padre + profesional) en la app desplegada; `tsc`+`lint`+`test:unit`+
  candados verdes; `arch:check` verde; regenerar `docs/architecture/` si el barrido lo exige.
- [ ] **T7** · Cerrar **#341 (SPEC-429)** con el motivo escrito en el PR de 784 — **al entrar esto, no
  antes**.
