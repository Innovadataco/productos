# Cierre — SPEC-208 · fechaCorta helper central (002-PI-141)

## Estado

Implementada en `work/002-PI-140-142-lote-parches`.

## Resumen de cambios

- Nuevo `src/lib/format/fecha.ts`: `fechaCorta`, `fechaHora`, `fechaISO` con `timeZone: America/Bogota` y locale `es-CO`.
- Migradas 8 copias locales de `fechaCorta` a import del helper:
  - DetalleAdmin, DetalleComiteConvivencia, DetalleComiteValidacion, DetalleOperador, DetallePadre, DetalleRector.
  - PadresPageClient.
  - ApelacionesBandejaClient (`formatFecha` → `fechaCorta`).
  - ColegioDetalleSecciones, ColegiosAnalyticsTable.
  - `admin/tables/utils.ts` reexporta el helper.
- `vitest.unit.includes.ts`: añadidos `fecha.test.ts` y `sandbox.test.ts`.
- Test `src/lib/format/fecha.test.ts`: null/inválido, TZ Bogotá, fechaHora, fechaISO.

## Evidencia

- `grep -rn "function fechaCorta" src/` solo devuelve `src/lib/format/fecha.ts`.
- Gate local: `tsc --noEmit` ✓, `lint --no-cache` ✓ (0 errores), `arch:check` ✓, `test:unit` ✓.

## Deuda técnica

Ninguna.
