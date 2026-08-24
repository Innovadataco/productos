# Checklist de requerimientos — SPEC-213

## Functional Requirements

- [ ] FR-001 Worker con advisory lock.
- [ ] FR-002 Servicio `pi-vigencia` en docker-compose.
- [ ] FR-003 Ejecución diaria a hora configurable.
- [ ] FR-004 Uso de `date-fns-tz` America/Bogota.
- [ ] FR-005 Máquina de estados exacta del BRIEF §6.
- [ ] FR-006 AuditLog con `usuarioId=SYSTEM`.
- [ ] FR-007 Emisión de 18 eventos vía `motor.programar()`.
- [ ] FR-008 Idempotencia con marca de última corrida.
- [ ] FR-009 Procesamiento paginado.
- [ ] FR-010 No recalcular pagos ni tocar vistas.
- [ ] FR-011 Frontera DAL.
- [ ] FR-012 Fail-open para notificaciones.

## Non-Functional Requirements

- [ ] NFR-001 Gate local completo verde.
- [ ] NFR-002 Tests de integración.
- [ ] NFR-003 Logs con formato estándar.
- [ ] NFR-004 Docker healthcheck.

## Success Criteria

- [ ] SC-001 Advisory lock funciona.
- [ ] SC-002 Docker compose incluye servicio.
- [ ] SC-003 Simulación ACTIVA → EN_GRACIA.
- [ ] SC-004 Idempotencia verificada.
- [ ] SC-005 Freemium → SUSPENDIDA.
- [ ] SC-006 AuditLog con SYSTEM.
- [ ] SC-007 CI 6/6 verde.
