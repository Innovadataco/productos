# Quickstart · SPEC-212 · Panel admin Pagos

## Prerrequisitos

- SPEC-210 aplicada (modelos, seed y `pagos-repository`).
- BD migrada y seed ejecutado.
- Usuario `ADMIN` creado.

## Verificación local

1. Login como ADMIN.
2. Navegar a `/dashboard/admin/pagos`.
3. Verificar que el sidebar muestra "Pagos" con color ámbar/dorado.
4. Abrir cada uno de los 7 tabs; el último debe mostrar "Disponible en SPEC-218".
5. Crear un pago de prueba (vía API o seed) en estado `PENDIENTE_AUTORIZACION`.
6. En tab "Pendientes", autorizar/rechazar el pago y verificar cambio en BD + `AuditLog`.
7. Crear/editar un bono en tab "Bonos".
8. Editar precio de un plan en tab "Planes".
9. Abrir ficha de un cliente y verificar historial + timeline.

## Comandos

```bash
npx prisma migrate dev   # aplica migración aditiva REEMBOLSADO
npm run test:integration # valida endpoints
npm run build            # build de producción
```
