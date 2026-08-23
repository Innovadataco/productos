# Research · SPEC-212 · Panel admin Pagos

## Componentes vivos a reutilizar

### Navegación

- `src/components/modules/AdminNav.tsx`: lee `ADMIN_NAV_ITEMS` desde `src/lib/nav-items.ts` y filtra por `modulosPermitidos` + `esDestinoPermitidoPorRol`. El item activo se resalta con `accent-gradient` (cielo por defecto). Para Pagos se requerirá ajustar a tokens `ambar` vía className condicional o tema específico.
- `src/lib/nav-items.ts`: array `ADMIN_NAV_ITEMS`. Para agregar "Pagos" se añade entrada `{ href: "/dashboard/admin/pagos", label: "Pagos", modulo: "pagos_admin" }`.
- `src/lib/proxy.ts` y `src/lib/permisos-catalogo.ts`: deben incluir el nuevo módulo `pagos_admin` y la ruta `/dashboard/admin/pagos/**` en el predicado de ADMIN.

### Tabs

- `src/components/modules/admin/UsuariosSubNav.tsx`: patrón simple de sub-nav con tabs y `usePathname`. Sirve como base para el sub-nav de `/dashboard/admin/pagos`.

### Tablas y CRUD

- `src/components/modules/admin/tables/OperadoresTable.tsx`: tabla paginada con acciones (editar, reactivar). Patrón reutilizable para bonos/planes/pagos.
- Formularios vivos en admin usan Zod + server actions o API routes; se seguirá el mismo patrón.

### Repositorio

- `src/lib/dal/repositories/pagos-repository.ts` (SPEC-210): tiene CRUD base sobre Plan, Suscripcion, Pago, BonoPromocional. Para SPEC-212 se extenderá con:
  - `listarPagosPendientes(paginacion)`
  - `autorizarPago(id, adminId)`
  - `rechazarPago(id, motivo, adminId)`
  - `listarSuscripcionesPorVencer(dias, paginacion)`
  - `listarSuscripcionesEnMora(paginacion)`
  - `listarBonosPromocionales(paginacion)`
  - `listarPlanes(paginacion)`
  - `registrarReembolso(id, datos, adminId)`
  - `obtenerFichaCliente(suscripcionId)` (suscripción + pagos + audit logs)

## Schema

- `EstadoPago` actualmente en SPEC-210: `PENDIENTE_AUTORIZACION | AUTORIZADO | RECHAZADO`. SPEC-212 agrega `REEMBOLSADO` aditivamente.
- Modelo `Pago` no tiene campos de reembolso; se agregarán aditivamente (`montoReembolsoUSD`, `motivoReembolso`, `referenciaReembolso`).

## Decisiones técnicas preliminares

1. **Sub-nav propio**: crear `PagosSubNav.tsx` similar a `UsuariosSubNav.tsx` con 7 tabs.
2. **Layout**: `src/app/dashboard/admin/pagos/layout.tsx` incluye `PagosSubNav` y protege con rol ADMIN.
3. **Endpoints API**: bajo `src/app/api/admin/pagos/**/route.ts`, un archivo por recurso/tabla.
4. **Color `ambar`**: aplicar tokens `ambar-*` en estado activo del sub-nav y badges de la sección.
