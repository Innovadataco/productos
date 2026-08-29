> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Research: SPEC-203 — Preferencias de Notificaciones del Usuario (002-PI-100)

## Hallazgos verificados en fuente

- `src/components/modules/colegio/CentroNotificaciones.tsx` (2026-08-22): componente de campana actual, hardcodeado para `SCHOOL_ADMIN` y consume `/api/colegio/notificaciones`. Usa `toLocaleString("es-CO")` sin timezone.
- `src/app/api/colegio/notificaciones/**` (2026-08-22): CRUD de notificaciones in-app legacy del colegio.
- `src/lib/dal/repositories/notificacion-in-app.ts` (2026-08-22): repositorio legacy.
- BRIEF-MOTOR-NOTIFICACIONES.md §5.4: modelo `NotificacionPreferencia`.
- BRIEF §3: terminología "Transaccional (no se puede apagar)" para reglas obligatorias.

## Decisiones tomadas

- Crear componente `CentroNotificaciones` generalizado en `src/components/modules/notificaciones/`.
- Mantener endpoints legacy de colegio si son usados por otros flujos, pero el header usará el nuevo endpoint unificado `/api/notificaciones`.
- El panel de preferencias vivirá en `/dashboard/perfil/notificaciones`.
- Preferencia deshabilitada evita programación futura; no se cancelan notificaciones ya programadas salvo que el usuario lo solicite (para no ser sorpresivo).
