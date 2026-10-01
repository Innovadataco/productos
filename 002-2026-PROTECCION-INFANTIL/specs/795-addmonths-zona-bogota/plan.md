# Plan · SPEC-795

## Método único (ambos PRs)
`fromZonedTime(addMonths(toZonedTime(base, "America/Bogota"), N), "America/Bogota")` — el del hermano freemium (FR-003). `addMonths` CLAMPA al último día del mes destino; `toZonedTime`/`fromZonedTime` fijan el calendario en Bogotá. Reemplaza tanto `Date.setMonth` nativo (desborda) como `addMonths` sobre instante crudo (recorta en UTC).

## PR 1 · sitio 4 (desborde)
1. `src/lib/colegio/periodo.ts` · `calcularFinServicio`: `setMonth` → método Bogotá-aware.
2. `src/lib/pagos/vigencia-colegio.service.ts` · `calcularFinDesdeDuracionPlan` (rama MES_2/MES_3): idem.
3. Candados con literales + control positivo de desborde:
   - `periodo.test.ts`: frontera MENSUAL/SEMESTRAL/ANUAL (31→clamp), literales.
   - `vigencia-colegio.service.test.ts`: reescribir el oráculo `getUTCMonth`/mitad-de-mes a literal completo + frontera MES_2/MES_3.
4. Gates: tsc · lint · periodo (unit) · vigencia-colegio + colegios/route (integración, BD aislada) · test:unit completo · arch:check.

## PR 2 · sitios 1, 2, 3 (zona) — después del merge de PR 1
- `referido.service.ts:276`, `admin-autorizar-solicitud.service.ts:146`, `admin-activacion-manual.service.ts:176`: método Bogotá-aware; en 1/3 la base pasa a `fechaPagoReal ?? new Date()` (se retira el `ahoraBogota()` local, que queda muerto).
- Candados de frontera con literales; oráculos tautológicos existentes reescritos a literal.

## Verificación de datos
Sin medición de producción (CEO ya la hizo: cero exposición viva). Preventivo.
