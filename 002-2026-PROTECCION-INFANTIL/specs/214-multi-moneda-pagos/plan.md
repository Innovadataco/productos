# Plan · SPEC-214 · Multi-moneda + API tasas

## Fases

### Fase 1 — Especificación (compuerta §4)
1. Redactar `spec.md` con alcance, US, AS, FR/NFR.
2. Redactar `data-model.md` confirmando que no hay cambios de schema (usa `TasaCambio` de SPEC-210).
3. Redactar `research.md` con análisis de API exchangerate.host y workers existentes.
4. Redactar `contracts/` con endpoints de tasas.
5. Redactar `tasks.md`, `checklists/requirements.md`, `quickstart.md`.
6. Commit docs: `docs(SPEC-214/002-PI-114): multi-moneda y API tasas`.

### Fase 2 — Implementación
1. Extender `pagos-repository.ts` con métodos de `TasaCambio` (listar, crear, obtener vigente, verificar desactualización).
2. Crear servicio `src/lib/pagos/tasas.ts` para consultar API externa con timeout/reintento y parsear respuesta.
3. Agregar parámetro `pagos.tasas.monedas_destino` al seed si no existe.
4. Crear script/worker `scripts/worker-tasas.mjs` que invoque el servicio y persista tasas.
5. Crear endpoint `POST /api/admin/pagos/tasas` para inyección manual.
6. Crear endpoint `GET /api/admin/pagos/tasas` para listar tasas vigentes con flag de desactualización.
7. Exponer función pública `calcularMontoLocal(precioNetoUSD, monedaDestino)` para consumo de SPECs 211/212.
8. Tests unitarios e integración (API mockeada, worker, endpoint manual).
9. Gate local completo.
10. Commit feat: `feat(SPEC-214/002-PI-114): multi-moneda y API tasas`.

### Fase 3 — Integración y cierre
1. Rebasear si es necesario.
2. Push único junto con SPEC-212.
3. Verificar CI 6/6 verde.
4. Documentar cierre y deuda técnica.

## Riesgos y mitigaciones

- **Riesgo**: API externa no disponible en CI.  
  **Mitigación**: mockear fetch en tests; worker debe fallar graceful y no romper gate.
- **Riesgo**: Worker aislado requiere infra adicional.  
  **Mitigación**: script liviano invocable manualmente o por cron; no modifica worker principal.
