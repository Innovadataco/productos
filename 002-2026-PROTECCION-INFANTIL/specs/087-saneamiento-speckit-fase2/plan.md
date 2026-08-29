# Implementation Plan: Spec 087 — Saneamiento Spec Kit, fase 2

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

> Backfill documental (cola 002-PI-025, B2): plan reconstruido a partir del spec.md,
> research.md, tasks.md y cierre.md. Documenta lo hecho.

## Summary

Continuación de la Spec 044 (que saneó 022-043) sobre las 69 specs: status canónicos en
001-021 inferidos de artefactos y código, backlog sano (050b con spec.md propio y renombre
a 088, duplicado 050 resuelto, 074 reconciliada), completar spec 084 y `data-model.md` en
080/082/083, documentar la deuda de 001-021 sin retrofitar, y un chequeo automático en el
gate (`specs-discipline.test.ts`) que falla ante recaídas (status canónico, cierres,
duplicados, índice consistente con las carpetas). Higiene documental: no se tocó código de
aplicación.

## Diseño (por US)

1. **US1 (status 001-021)**: inferencia desde artefactos y código (mismo método que la 044);
   cada spec.md declara Status del catálogo canónico.
2. **US2 (backlog)**: `050b` conservada como spec viva → `spec.md` propio y renombre a
   `088-pendientes-afinamiento` (número libre); `050-mejora-prompt-clasificador` conserva el
   número (cerrada, más referencias); 074 reconciliada con su evidencia.
3. **US3 (completar)**: spec 084 cerrada posterior a la disciplina; `data-model.md` agregado
   en 080/082/083.
4. **US4 (deuda documentada, sin retrofit)**: tabla de deuda de 001-021 en research.md;
   cierres en lotes bajo `docs/` (nunca reescribir specs cerradas — principio de la 044).
5. **US5 (chequeo en gate)**: `src/lib/specs-discipline.test.ts` — status canónico, cierre
   presente en CERRADAs post-021, sin números duplicados, índice `specs/README.md`
   consistente con las carpetas reales; corre en `npm run test` y falla ante recaídas.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Retrofit accidental de specs cerradas | Regla explícita: solo metadatos; nunca reescribir contenido histórico |
| Índice desincronizado con carpetas | El propio chequeo US5 lo hace fallar en el gate |

## Pruebas

- `specs-discipline.test.ts` verde tras el saneamiento y rojo ante recaídas provocadas;
  `specs/README.md` regenerado desde las carpetas reales.
