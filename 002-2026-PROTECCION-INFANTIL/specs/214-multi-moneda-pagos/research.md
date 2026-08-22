# Research · SPEC-214 · Multi-moneda + API tasas

## API externa

- **Candidata principal**: `https://api.exchangerate.host/latest?base=USD`.
  - Sin API key.
  - Respuesta JSON: `{ "rates": { "COP": 4000, "MXN": 18.5, ... }, "base": "USD", "date": "..." }`.
  - Límites desconocidos; se asume uso moderado (1 vez cada 24h).
- **Fallback**: si la API falla, el sistema usa la última tasa registrada y alerta desactualización.
- **Configuración**: parámetro `pagos.tasas.api_url_default` permite cambiar URL sin deploy.

## Workers existentes

- `scripts/worker-reportes.mjs`: consume cola pg-boss para procesar reportes.
- `scripts/worker-supervisor.mjs`: supervisa worker único.
- `scripts/pi-vigencia.mjs` (SPEC-213): maneja transiciones de vigencia. SPEC-214 podría añadir un tick en ese worker, pero por independencia se recomienda un worker separado `scripts/worker-tasas.mjs` o un cron script.

## Repositorio

- `pagos-repository.ts` ya tiene `crearTasaCambio` y `obtenerTasaCambioMasReciente`. Se extenderá con:
  - `listarTasasVigentes(ahora)`
  - `obtenerTasaVigente(monedaDestino, ahora)`
  - `estaDesactualizada(monedaDestino, horas, ahora)`

## Patrones a seguir

- Fetch con timeout usando `AbortController`.
- Mocks de `fetch` en tests (vitest proporciona `vi.fn()`).
- Timezone Bogotá con `date-fns-tz` heredado de SPEC-200.
- `AuditLog` en inyección manual.
