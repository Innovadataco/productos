> DEPENDE DE: SPEC-200 (timezone Bogotá).

# Research: SPEC-201 — Motor de Notificaciones · Núcleo (002-PI-098)

## Hallazgos verificados en fuente

- `src/lib/email.ts` (2026-08-22): ya usa Resend con `RESEND_API_KEY` y `EMAIL_FROM`. Existen funciones como `enviarEmailBienvenidaColegio` que el BRIEF §6/§7 indica migrar al motor en SPEC-204.
- `src/lib/dal/repositories/notificacion-in-app.ts` (2026-08-22): bandeja in-app actual del colegio (`NotificacionInAppRepository`). El motor puede reutilizarlo para notificaciones in-app o unificarlo en el futuro; en v1 se propone reutilizarlo para no duplicar.
- `src/components/modules/colegio/CentroNotificaciones.tsx` (2026-08-22): componente de campana que consume `/api/colegio/notificaciones`. Formatea fechas con `toLocaleString("es-CO", ...)` sin timezone (esto se corregirá en SPEC-200/203).
- `src/app/api/colegio/notificaciones/**` (2026-08-22): endpoints CRUD de notificaciones in-app del colegio. Pueden servir como base para endpoints de bandeja del motor.
- `src/lib/parametros.ts` (2026-08-22): helper `getParametroSistemaValor` para leer parámetros; el motor lo usará para leer config.
- `prisma/seed.ts` (2026-08-22): estructura clara para sembrar parámetros con `upsert`.
- `scripts/worker-supervisor.mjs` (2026-08-22): patrón de advisory lock ya establecido.
- BRIEF-MOTOR-NOTIFICACIONES.md §5.1-§5.6: modelo de datos, parámetros y reglas semilla cerradas.
- BRIEF §7: API pública del motor con firmas exactas.
- BRIEF §9: accesibilidad/rendimiento (paginación server-side, batch 20-50, idempotencia webhook).

## Decisiones tomadas

- Reutilizar `src/lib/email.ts` para envío real por Resend, pero envolverlo en el worker del motor para tracking de estado.
- Reutilizar `NotificacionInAppRepository` para canal `IN_APP` (minimiza duplicación de bandejas).
- Worker con poll directo a BD + advisory lock (patrón conocido) en lugar de `pg-boss` para evitar doble cola; se evalúa en implementación si `pg-boss` aporta ventajas.
- Quiet hours parseado desde string `"20:00-07:00"` a horas/minutos Bogotá.
- Bounce tracking vía webhook Resend + fallback en error de envío.
- `variablesSchema` de plantilla validado con JSON Schema ligero (sin nueva dependencia pesada).
