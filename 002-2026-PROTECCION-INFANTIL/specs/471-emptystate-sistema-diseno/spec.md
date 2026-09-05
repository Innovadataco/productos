# SPEC-471 · OLA 4: el EmptyState al Sistema de Diseño

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: plan maestro · catálogo §6 · orden de Jelkin · **Autoridad de forma**: Diseño (certifica)

**Impacto en arquitectura:** ninguno. Cirugía sobre `EmptyState.tsx`. No cambia conducta.

## Qué se hizo
El círculo del ícono `bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400` → token neutro `bg-tinta/5 text-muted` (voltea solo en oscuro). El copy con verbo / «el vacío nunca dice solo No hay datos» (catálogo §6) es del **call site**: `title`/`description` son props, el mueble no hornea texto de vacío. Conducta/a11y intactas (`role="status"`, `aria-live`).

## Candados
- `tokens:check` baja (conteo real; **NO se toca el PISO** — regla SPEC-466: el apriete va por `--tension`, no por PR). Medición: 1017 < piso 1021 → VERDE.
- `emptystate-tokens.candado.test.ts` (fuente, sin BD): 0 color crudo. Contraprueba por mutación.

## Certificación
La da **Diseño**.
