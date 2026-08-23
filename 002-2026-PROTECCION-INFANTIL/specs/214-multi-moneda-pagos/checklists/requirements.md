# Checklist · SPEC-214 · Multi-moneda + API tasas

## Requisitos funcionales

- [ ] Worker/API consulta tasas desde exchangerate.host (o URL configurable).
- [ ] Timeout 5s + 1 reintento.
- [ ] Catálogo de monedas configurable vía `pagos.tasas.monedas_destino`.
- [ ] Refresco automático cada 24h a hora Bogotá.
- [ ] Histórico `TasaCambio` append-only (cero DELETE).
- [ ] Endpoint admin inyecta tasa manual + `AuditLog`.
- [ ] Servicio expone tasa vigente y calcula monto local.
- [ ] Banner de desactualización cuando tasa >48h.

## Candados

- [ ] Cero imports de `@/lib/prisma` en endpoints/servicios de pagos.
- [ ] Cero cambios en `src/lib/ai/**`.
- [ ] No borrar histórico de tasas.
- [ ] `arch:check` verde.
- [ ] CI 6/6 verde.
