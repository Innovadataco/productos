# Feature Specification: Afinamiento del motor (rúbrica) — targeting, principal por gravedad y métrica

**Feature Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Status**: DESARROLLO

## Contexto

Cola nocturna 002-PI-014, Fase 4. Línea base limpia sobre el banco curado (spec 095):
rúbrica accuracy 70.5%, subestimaciones 4, ESPS 625, 0 silenciosos peligrosos. Los 2
hallazgos de motor de la adjudicación entran ahora a afinamiento. **DISCIPLINA: una
variable a la vez — NO tocar la terna de modelos ni el umbral 60%.**

## Requisitos

- **FR-001 (decisiva de targeting)**: en `OFRECIMIENTO_REGALOS` y `CONTACTO_INSISTENTE`,
  pregunta DECISIVA que distinga "dirigido a ESTE menor (vínculo interpersonal)" vs
  "publicidad/estafa masiva". Si es masivo, no cuenta. Casos guía del banco: #178, #184,
  #188, #180, #185 (SPAM masivo) y #193, #197, #200 (benignos). La rúbrica vive en el
  parámetro `ia.rubrica.preguntas` (editable sin desplegar) — el afinamiento es de
  parámetro + su semilla en `seed.ts`/constantes, no de la terna ni del umbral.
- **FR-002 (principal interna por gravedad)**: cuando el motor colapsa a UNA `categoria`
  (campo requerido), la elección interna debe ser la de MAYOR gravedad (según severidades
  parametrizadas), no la más leve — caso guía #131 (los 3 modelos votaron EXTORSION y el
  colapso eligió CONTACTO_INSISTENTE). La presentación sigue mostrando todas las conductas
  (D-13); esto solo corrige la selección interna.
- **FR-003 (métrica)**: en `scripts/eval-dual-banco.ts`, NO contar como "silencioso" los
  OTRO→OTRO correctos (Δseveridad=0 por abstención): si `esperada === asignada`, no es
  error silencioso.
- **FR-004 (re-medición)**: correr SOLO la rúbrica sobre el banco curado (REUSAR el número
  del legacy, no re-correrlo) — al FINAL y SOLA, sin builds/tests en paralelo. Comparar
  contra la línea base: el ESPS debe bajar (< 625), subestimaciones ≤ 4 y silenciosos
  peligrosos (Δ<0) = 0.

## Success Criteria

- **SC-001**: Rúbrica afinada con FR-001/FR-002 y medida sobre el banco curado: ESPS < 625,
  subestimaciones ≤ 4, silenciosos peligrosos 0; accuracy reportada (ideal ≥ 70.5%).
- **SC-002**: La propagación del parámetro a prod queda documentada (seed + actualización
  explícita de `ia.rubrica.preguntas` en la BD de prod, porque el seed es upsert no
  destructivo).
- **SC-003**: Gate verde y cierre.md con antes/después.
