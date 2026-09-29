# SPEC-753 · Tasks

## Fase 1 · Esquema (Datos, D-121) — HECHO

- [x] T001 EncuestaCita + IncidenteContradiccionEncuesta + enums + CHECKs (razón-IFF, venceEn>reclamadoEn) — `prisma/schema.prisma` + migración.
- [x] T002 `duracion` nulable + CHECK espejo `(duracion IS NOT NULL) = seRealizo` — migración re-datada `07fa8f7ab`.

## Fase 2 · Piezas puras — HECHO

- [x] T003 `estado-efectivo-incidente.ts` — estado derivado + `esIncumplimiento` (fuente única, incluye RESUELTO_TARDE).
- [x] T004 `encuestas-preguntas.ts` — las 5 preguntas (texto legal v0.1).
- [x] T005 `venceEn` del incidente con el calculador CANÓNICO `sumarDiasHabilesColombia` (rebase sobre 768; sin deuda diferida).

## Fase 3 · Motor del cruce — HECHO (esta entrega)

- [x] T006 `plazo-incidente.ts` — fuente única del término POR CLASE (legal clavado 15/ancla padre; interno 10/ancla detección). `src/lib/profesional/cita/plazo-incidente.ts`
- [x] T007 `encuestas-cita-cruce.service.ts` — `detectarContradicciones` + `cruzarEncuestasCita` (upsert idempotente, cliente inyectado). `src/lib/profesional/cita/encuestas-cita-cruce.service.ts`
- [x] T008 [P] Candado de paridad claves↔enums. `src/lib/profesional/cita/encuestas-preguntas-enums.candado.test.ts`
- [x] T009 [P] Candado del término por clase (legal clavado, legal≠interno). `src/lib/profesional/cita/plazo-incidente.candado.test.ts`
- [x] T010 Candado de integración del cruce (clases + ancla + control positivo + ambos-no + idempotencia + no-op). `src/lib/profesional/cita/encuestas-cita-cruce.service.candado.test.ts`
- [x] T011 Declarar el service `hueco-funcional` con condición de salida. `scripts/arch/modulos-huerfanos-allowlist.json`

## Fase 4 · Cableado — PENDIENTE (pieza posterior)

- [ ] T012 Endpoint de ENVÍO de encuesta que persiste EncuestaCita y llama `cruzarEncuestasCita` dentro de su tx; al cablearlo, quitar el service (y `plazo-incidente` si aplica) de la allowlist en el mismo PR.
