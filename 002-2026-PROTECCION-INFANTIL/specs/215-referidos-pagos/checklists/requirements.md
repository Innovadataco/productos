# Checklist de requerimientos — SPEC-215

## Functional Requirements

- [x] FR-001 Generación automática de código al crear suscripción.
- [x] FR-002 Formato `PI-<TIPO>-<HASH8>` sin O/0/I/1.
- [x] FR-003 Garantía de unicidad.
- [x] FR-004 Endpoint de aplicación de código.
- [x] FR-005 Validaciones: existe/activo, no autorreferido, no duplicado, tope anual 5.
- [x] FR-006 Creación de `CodigoReferidoUso` + evento `referido.registrado`.
- [x] FR-007 Recompensas al autorizar pago.
- [x] FR-008 Evento `referido.tope_anual` al 4º uso.
- [x] FR-009 Tope anual en año calendario Bogotá.
- [x] FR-010 AuditLog en uso y recompensa.
- [x] FR-011 Frontera DAL.

## Non-Functional Requirements

- [x] NFR-001 Gate local completo.
- [x] NFR-002 Tests de integración.
- [x] NFR-003 Logs con formato estándar.

## Success Criteria

- [x] SC-001 Códigos únicos (0 duplicados).
- [x] SC-002 6º uso controlado.
- [x] SC-003 Autorreferido rechazado.
- [x] SC-004 Recompensa al autorizar pago.
- [x] SC-005 Notificación al 4º uso.
- [ ] SC-006 CI 6/6 verde. *(lo verifica el coordinador en el gate de integración)*
