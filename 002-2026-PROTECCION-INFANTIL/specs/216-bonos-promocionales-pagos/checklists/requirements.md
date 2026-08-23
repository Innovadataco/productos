# Checklist de requerimientos — SPEC-216

## Functional Requirements

- [ ] FR-001 Endpoint `POST /api/pagos/aplicar-bono` expuesto y protegido.
- [ ] FR-002 Validación de existencia, activo y vigencia del bono.
- [ ] FR-003 Validación de tope global de usos.
- [ ] FR-004 Validación de tope por cliente.
- [ ] FR-005 Validación de `aplicaSoloA` vs `tipoTitular`.
- [ ] FR-006 Validación de `aplicaANuevos` / `aplicaARenovaciones`.
- [ ] FR-007 Cálculo de descuento por tipo (`DESCUENTO_PCT`, `DESCUENTO_FIJO_USD`, `MESES_GRATIS`).
- [ ] FR-008 Regla del mayor descuento cuando no son combinables.
- [ ] FR-009 Idempotencia: rechazo de segunda aplicación.
- [ ] FR-010 Creación de `BonoAplicado`.
- [ ] FR-011 Emisión de evento `bono.aplicado` al motor notif.
- [ ] FR-012 Registro en `AuditLog`.
- [ ] FR-013 Frontera DAL: sin imports de `@/lib/prisma` fuera del repositorio.

## Non-Functional Requirements

- [ ] NFR-001 Gate local completo verde.
- [ ] NFR-002 Tests de integración cubren éxito y principales rechazos.
- [ ] NFR-003 Respuesta < 300 ms en BD local.
- [ ] NFR-004 Logs con formato estándar.

## Success Criteria

- [ ] SC-001 Validaciones de las 5 reglas del BRIEF §7.5.
- [ ] SC-002 Registro en `BonoAplicado`.
- [ ] SC-003 Test de monto no negativo.
- [ ] SC-004 Test de idempotencia.
- [ ] SC-005 Evento en motor notif.
- [ ] SC-006 CI 6/6 verde.
