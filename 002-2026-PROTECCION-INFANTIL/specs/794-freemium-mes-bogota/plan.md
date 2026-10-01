# Plan · SPEC-794 · Freemium: suma de meses en calendario Bogotá

## Enfoque

Hotfix mínimo y revisable que desbloquea `main`: una función pura corregida + cobertura de frontera
que la fija, sin tocar los otros cálculos (no medidos).

## Pasos

1. **Fix** `calcularFechaFinTrasPagoFreemium` (`freemium-calculos.ts`): `toZonedTime(base, Bogotá)` →
   `addMonths` → `fromZonedTime`, espejo de `calcularFreemiumFechaFin`. No se toca el `max(...)`.
2. **Unit RED-first** (`freemium-calculos.test.ts`): dos casos de frontera con fechas FIJAS —
   fin-de-día 30-oct +1mes = fin-de-día 30-nov; y clamp fuerte fin-de-día 30-ene +1mes = 28-feb
   (2026 no bisiesto). El primero reproduce EXACTAMENTE la firma del fallo de prod. Verificado:
   rojos sin el fix, verdes con el fix; los 9 casos no-frontera siguen verdes.
3. **Endurecer T010** (`freemium.service.integration.test.ts`): quitar `setMonth` nativo; el oráculo
   usa `calcularFechaFinTrasPagoFreemium` (verifica cableado; la aritmética la fijan los unitarios).
4. **Gates**: tsc + eslint + unit (freemium) + integración (freemium) + arch:check + preflight
   `test:unit` completo (specs-discipline, por spec nueva).

## Fuera de alcance (SPEC propia, medir antes de arreglar)

`admin-autorizar-solicitud:146`, `referido:276`, `admin-activacion-manual:176`, `vigencia-colegio:53`.
