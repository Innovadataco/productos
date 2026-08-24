> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Research: SPEC-202 — Panel Admin del Motor de Notificaciones (002-PI-099)

## Hallazgos verificados en fuente

- BRIEF-MOTOR-NOTIFICACIONES.md §4 y §5: sistema visual, mockups, requisitos de reutilización (no rutas paralelas).
- BRIEF §7: API pública del motor (la usa el panel para recalcular).
- BRIEF §9: webhook Resend idempotente, paginación server-side.
- `src/components/modules/colegio/CentroNotificaciones.tsx` (2026-08-22): patrón de campana/bandeja que el motor puede generalizar.
- Arquitectura actual: panel admin bajo `/dashboard/admin/**`, API bajo `src/app/api/admin/**`.
- `src/lib/nav-items.ts` y `src/components/modules/NavHeader.tsx`: fuentes para regenerar roles/capacidades y pantallas.

## Decisiones tomadas

- Sección dentro de `/dashboard/admin/configuracion` (no ruta paralela).
- Tab de salud dentro de `/dashboard/admin/estadisticas` o `/dashboard/admin/monitoreo` según la navegación que exista al momento de implementar.
- Preview de plantilla en endpoint separado (`POST .../preview`) para no complicar el guardado.
- Recálculo con confirmación explícita en UI para evitar reprogramaciones accidentales masivas.
- Webhook Resend expuesto en `src/app/api/webhooks/resend/route.ts` (público con validación de firma/token).
