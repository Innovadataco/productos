# Spec 087 — Saneamiento Spec Kit, fase 2

**Status**: `FINALIZADO` (pendiente ACTA-VALIDACION de ZEUS → `CERRADA`)
**Rama**: `feature/001-scaffolding`
**Creado**: 2026-07-23

## Contexto

Continúa la Spec 044 (que saneó 022-043). Auditoría de ZEUS sobre las 69 specs: status no canónicos o ausentes en 001-021, backlog activo con problemas (050b sin spec.md, número 050 duplicado, 074 desactualizada), spec 084 incompleta y 080/082/083 sin `data-model.md`, y ausencia de un chequeo automático que evite la recaída. **No se toca código de aplicación** (higiene documental).

## User Stories

- **US1 (P1)**: Status canónico en specs 001-021 — inferir de artefactos y código (como hizo la 044).
- **US2 (P1)**: Backlog sano — 050b con spec.md propio, número duplicado resuelto, 074 reconciliada con su evidencia.
- **US3 (P1)**: Completar spec 084 (posterior a la disciplina) + `data-model.md` en 080/082/083.
- **US4 (P2)**: Documentar la deuda de 001-021 sin retrofitar (tabla en research.md; cierres en lotes de `docs/`).
- **US5 (P2)**: Chequeo automático en el gate: status canónico, cierre para CERRADAs (post-021), sin números duplicados, índice consistente con las carpetas.

## Decisiones

- **050b**: se conserva como spec viva (registro de afinamiento A1-A5) → se creó su `spec.md` y se renombró a `088-pendientes-afinamiento` (número libre). Justificación en research.md.
- **Duplicado 050**: `050-mejora-prompt-clasificador` conserva el número (cerrada, más referencias); la viva se mueve a 088.
- **Retrofit**: nunca en specs cerradas (principio de la 044). Solo metadatos.

## Criterios de éxito

- Todo spec.md declara Status del catálogo canónico.
- `specs/README.md` regenerado desde las carpetas reales.
- El chequeo de US5 corre en `npm run test` (gate) y falla ante recaídas.
