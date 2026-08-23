> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Checklist de requisitos: SPEC-202 — Panel Admin del Motor de Notificaciones (002-PI-099)

- [x] Sección "Notificaciones" en `/dashboard/admin/configuracion`.
- [x] Tab "Salud motor" en `/dashboard/admin/estadisticas/salud-motor`.
- [x] `GET /api/admin/notificaciones/bandeja` con filtros y paginación.
- [x] CRUD de plantillas con preview (`/api/admin/notificaciones/plantillas/**`).
- [x] CRUD de reglas con confirmación de recálculo (`/api/admin/notificaciones/reglas/**`).
- [x] Endpoint de recálculo `POST /api/admin/notificaciones/reglas/:id/recalcular` (+ preview).
- [x] Edición de parámetros `notificaciones.*` (`/api/admin/notificaciones/parametros/**`).
- [x] Endpoint de salud `/api/admin/notificaciones/salud`.
- [x] Webhook Resend idempotente (`/api/webhooks/resend`).
- [x] `AuditLog` en mutaciones de reglas, plantillas y parámetros.
- [x] Navegación actualizada (`ConfiguracionTabs.tsx`, `EstadisticasSubNav.tsx`) y permisos (`permisos-catalogo.ts`).
- [x] No se tocó `src/lib/ai/**`.
- [ ] CI verde 6/6 (pendiente de ejecución de suite completa por tiempo de runner).
