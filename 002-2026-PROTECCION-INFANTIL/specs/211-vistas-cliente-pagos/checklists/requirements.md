# Checklist de requerimientos — SPEC-211

## Functional Requirements

- [ ] FR-001 Página rector `/dashboard/colegio/suscripcion`.
- [ ] FR-002 Página padre `/dashboard/padre/suscripcion`.
- [ ] FR-003 7 bloques estándar.
- [ ] FR-004 Formulario de renovación.
- [ ] FR-005 Upload comprobante con validaciones y SHA256.
- [ ] FR-006 Creación de `Pago` pendiente.
- [ ] FR-007 Endpoints vía `PagosRepository`.
- [ ] FR-008 Timezone Bogotá.
- [ ] FR-009 Colores por rol.
- [ ] FR-010 Responsive.
- [ ] FR-011 AuditLog.
- [ ] FR-012 No crear sidebar padre.

## Non-Functional Requirements

- [ ] NFR-001 Gate local completo.
- [ ] NFR-002 Tests E2E/componente.
- [ ] NFR-003 Contraste AA.
- [ ] NFR-004 Sin `Math.random()` en render.

## Success Criteria

- [ ] SC-001 Rutas responden 200.
- [ ] SC-002 Card de estado correcto.
- [ ] SC-003 Formulario funcional.
- [ ] SC-004 Paleta correcta.
- [ ] SC-005 Sin imports `@/lib/prisma` en `src/app/**`.
- [ ] SC-006 CI 6/6 verde.
