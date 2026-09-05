# SPEC-470 · OLA 4: el Select al Sistema de Diseño

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: plan maestro · catálogo §5 · orden de Jelkin · **Autoridad de forma**: Diseño (certifica)

**Impacto en arquitectura:** ninguno. Cirugía de una línea sobre `Select.tsx` (56 pantallas). No cambia conducta.

## Qué se hizo
El único crudo era el par del error `text-red-600 dark:text-red-400` → token `rubi` (voltea solo en oscuro). El resto ya vivía en token (foco con halo del acento, 48px, mismo criterio que Input). Conducta/a11y intactas (valor, opciones, disabled, foco por teclado).

## Candados
- `tokens:check`: piso **1021 → 1019** (2 crudos menos). Medido sobre `origin/main` fresco.
- `select-error-token.candado.test.ts` (fuente, sin BD): 0 crudo; error en `rubi`. Contraprueba por mutación.

## Certificación
La da **Diseño**.
