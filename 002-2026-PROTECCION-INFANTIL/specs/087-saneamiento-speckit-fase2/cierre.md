# Cierre — Spec 087: Saneamiento Spec Kit, fase 2

**Fecha**: 2026-07-23
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/087-saneamiento-speckit-fase2/`
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS

## Resumen por User Story

| US | Resultado |
|---|---|
| US1 Status canónico 001-021 | 11 corregidas (ver tabla abajo); todas las specs declaran valor canónico |
| US2 Backlog | 050b conservada como spec viva (`088-pendientes-afinamiento`) con spec.md propio; duplicado 050 resuelto; 074 → CERRADA |
| US3 Completar 084/080/082/083 | 084 con research+data-model+tasks+checklist; data-model.md añadido a 080, 082, 083 |
| US4 Deuda documentada | Tabla en research.md; nota: cierres de 001-009/02 solo en lotes de docs/, sin trazabilidad individual (no se retrofita) |
| US5 Chequeo en gate | `src/lib/specs-discipline.test.ts` (4 reglas) — corre en `npm run test` y atrapó 2 recaídas durante su propia creación (regex estricto, índice desactualizado) |

## Status antes/después

| Spec | Antes | Después |
|---|---|---|
| 006, 007 | `Implemented` | `IMPLEMENTADO` |
| 011, 012, 013, 014, 015, 016, 020, 021 | (sin Status) | `CERRADA` (inferida de `reporte-cierre.md`) |
| 017 | `EN DISEÑO` | `PLANEADO` |
| 074 | `PLANEADO` | `CERRADA` (reconciliada con evidencia) |

## Decisiones (respuesta a ZEUS)

- **050b**: CONSERVADA como spec viva. No era un borrador: `registro.md` es un registro ACTIVO de 5 pendientes de afinamiento (A1-A5) referenciado desde deuda técnica. Se le creó `spec.md` (Status PLANEADO) y se movió al número libre 088.
- **Duplicado 050**: `050-mejora-prompt-clasificador` conserva el número (cerrada, más referencias); la viva se movió a `088-pendientes-afinamiento` y se actualizaron sus 6 referencias.

## Validación

- `specs-discipline.test.ts`: 4/4 (canónico, cierre >021, duplicados, índice).
- `specs/README.md` regenerado desde carpetas: **70 specs**, 3 pendientes (017, 053, 088).
- Suite completa y lint: ver reporte final.
- Sin cambios de código de aplicación (solo `src/lib/specs-discipline.test.ts`, que es el propio chequeo).

## Commit

- `docs(specs): saneamiento Spec Kit fase 2 — status canónico, 050b→088, artefactos 084/080/082/083, chequeo en gate (spec 087)`
