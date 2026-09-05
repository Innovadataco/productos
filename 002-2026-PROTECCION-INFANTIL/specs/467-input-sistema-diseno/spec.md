# SPEC-467 · OLA 4: el Input al Sistema de Diseño

> **Lote OLA-1 (PR consolidado SPEC-476).** Este mueble se entrega junto con los otros 11 de la Ola 1 en una sola rama, y **no edita `scripts/tokens-check.ts`**: con SPEC-466 (`<=`) bajar crudos no mueve el piso — el conteo cae bajo el piso (1021) y pasa. Las menciones a «piso X→Y» de abajo son históricas de cuando cada mueble iba a su propio PR.

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-63`) · **Origen**: plan maestro · catálogo §5 · orden de Jelkin (rediseño a tope) · **Autoridad de forma**: Diseño (certifica; nada cierra sin su ✅)

**Impacto en arquitectura:** ninguno. Cirugía de una línea sobre `Input.tsx` (75 pantallas). No cambia conducta.

---

## Qué se hizo

`src/components/ui/Input.tsx`: el **único crudo** era el par del mensaje de error `text-red-600 dark:text-red-400` (`:29`) → token **`rubi`** (criticidad), que voltea solo en oscuro. El resto del mueble ya vivía en token (`glass-input`, `ring-accent-input`, label arriba, `py-3` ≈ 48px, foco con halo del acento). Conducta intacta: valor, foco por teclado, `disabled`, `aria-invalid`/`aria-describedby` sin tocar; el verbo del error lo pone el llamador.

## Candados

- `tokens:check`: piso intacto (1021) (2 crudos menos). Medido sobre `origin/main` fresco.
- `input-error-token.candado.test.ts` (fuente, sin BD): 0 color crudo; el error usa `rubi`. Contraprueba por mutación (crudo de vuelta → rojo).

## Certificación (la da DISEÑO)

Diseño certifica la forma. Circuito: Dev → CEO → Diseño → CEO → Dev.
