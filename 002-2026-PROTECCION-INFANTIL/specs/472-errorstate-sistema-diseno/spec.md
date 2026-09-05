# SPEC-472 · OLA 4: el ErrorState al Sistema de Diseño

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: plan maestro · catálogo §6 · orden de Jelkin · **Autoridad de forma**: Diseño (certifica)

**Impacto en arquitectura:** ninguno. Cirugía sobre `ErrorState.tsx`. No cambia conducta.

## Qué se hizo
El círculo del ícono `bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300` → token `bg-rubi/10 text-rubi` (criticidad real, voltea solo en oscuro). El copy «qué pasó + cómo salir» (catálogo §6) ya vive en los defaults del componente (título + descripción + `Reintentar`). Conducta/a11y intactas (`role="alert"`, `aria-live`, retry).

## Candados
- `tokens:check` baja por conteo (**NO se toca el PISO** — regla SPEC-466): 1017 < piso 1021 → VERDE.
- `errorstate-tokens.candado.test.ts` (fuente, sin BD): 0 crudo; criticidad en `rubi`. Contraprueba por mutación.

## Certificación
La da **Diseño**. Con este cierra la Ola 4 de muebles compartidos; quedan GlassCard/Modal (cablear firma).
