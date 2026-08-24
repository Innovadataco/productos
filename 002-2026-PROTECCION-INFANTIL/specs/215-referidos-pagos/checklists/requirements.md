# Checklist de requerimientos — SPEC-215

## Functional Requirements

- [ ] FR-001 Generación automática de código al crear suscripción.
- [ ] FR-002 Formato `PI-<TIPO>-<HASH8>` sin O/0/I/1.
- [ ] FR-003 Garantía de unicidad.
- [ ] FR-004 Endpoint de aplicación de código.
- [ ] FR-005 Validaciones: existe/activo, no autorreferido, no duplicado, tope anual 5.
- [ ] FR-006 Creación de `CodigoReferidoUso` + evento `referido.registrado`.
- [ ] FR-007 Recompensas al autorizar pago.
- [ ] FR-008 Evento `referido.tope_anual` al 4º uso.
- [ ] FR-009 Tope anual en año calendario Bogotá.
- [ ] FR-010 AuditLog en uso y recompensa.
- [ ] FR-011 Frontera DAL.

## Non-Functional Requirements

- [ ] NFR-001 Gate local completo.
- [ ] NFR-002 Tests de integración.
- [ ] NFR-003 Logs con formato estándar.

## Success Criteria

- [ ] SC-001 Códigos únicos (0 duplicados).
- [ ] SC-002 6º uso controlado.
- [ ] SC-003 Autorreferido rechazado.
- [ ] SC-004 Recompensa al autorizar pago.
- [ ] SC-005 Notificación al 4º uso.
- [ ] SC-006 CI 6/6 verde.
