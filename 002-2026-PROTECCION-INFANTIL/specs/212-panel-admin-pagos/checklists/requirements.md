# Checklist · SPEC-212 · Panel admin Pagos

## Requisitos funcionales

- [ ] `/dashboard/admin/pagos` accesible solo por rol `ADMIN`.
- [ ] `AdminNav` incluye item "Pagos" con color `ambar`.
- [ ] 7 tabs funcionales: Pendientes, Vencimientos, Mora, Bonos, Planes, Reembolsos, Analítica stub.
- [ ] Bandeja pendientes lista pagos `PENDIENTE_AUTORIZACION` paginados.
- [ ] Acción autorizar pago actualiza estado + `AuditLog`.
- [ ] Acción rechazar pago exige motivo + `AuditLog`.
- [ ] Tabs vencimientos/mora filtran por fecha y estado en Bogotá.
- [ ] CRUD bonos con validaciones y `AuditLog`.
- [ ] CRUD planes edita precios sin afectar pagos históricos.
- [ ] Reembolso marca pago como `REEMBOLSADO` + `AuditLog`.
- [ ] Ficha cliente muestra historial, timeline y acciones.
- [ ] Tab analítica es stub con mensaje SPEC-218.

## Candados

- [ ] Cero imports de `@/lib/prisma` en endpoints/servicios de pagos.
- [ ] Cero cambios en `src/lib/ai/**`.
- [ ] Migración aditiva pura (sin `DROP`).
- [ ] `arch:check` verde.
- [ ] CI 6/6 verde.
