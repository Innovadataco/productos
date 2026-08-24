# Checklist de requerimientos — SPEC-217

## Functional Requirements

- [ ] FR-001 Activación de freemium al crear suscripción si parámetro activo.
- [ ] FR-002 Asignación de plan básico del rol.
- [ ] FR-003 Cálculo de `freemiumFechaFin` Bogotá.
- [ ] FR-004 Anti-doble freemium por histórico.
- [ ] FR-005 Extensión de vigencia al pagar durante freemium.
- [ ] FR-006 Transición a `SUSPENDIDA` por SPEC-213.
- [ ] FR-007 Notificaciones T-7, T-1, T=0.
- [ ] FR-008 Endpoint con datos freemium.
- [ ] FR-009 AuditLog.
- [ ] FR-010 Frontera DAL.

## Non-Functional Requirements

- [ ] NFR-001 Gate local completo.
- [ ] NFR-002 Tests de integración.
- [ ] NFR-003 Logs con formato estándar.

## Success Criteria

- [ ] SC-001 Activación correcta.
- [ ] SC-002 Vista muestra días restantes.
- [ ] SC-003 Evento T-7.
- [ ] SC-004 Corte por vencimiento.
- [ ] SC-005 Anti-doble.
- [ ] SC-006 Extensión al pagar.
- [ ] SC-007 CI 6/6 verde.
