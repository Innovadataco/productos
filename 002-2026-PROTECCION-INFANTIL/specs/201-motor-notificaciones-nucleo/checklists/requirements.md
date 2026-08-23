> DEPENDE DE: SPEC-200 (timezone Bogotá).

# Checklist de requisitos: SPEC-201 — Motor de Notificaciones · Núcleo (002-PI-098)

- [ ] 5 modelos Prisma nuevos creados según BRIEF §5.
- [ ] Enums `CanalNotificacion` y `EstadoNotificacion` declarados.
- [ ] Índices requeridos creados.
- [ ] Migración aditiva `add_motor_notificaciones` generada y aplicable.
- [ ] Seed crea 6 reglas semilla y 6 parámetros del BRIEF §5.6/§6.
- [ ] `src/lib/notificaciones/motor.ts` exporta `programar`, `cancelar`, `estado`, `recalcular`.
- [ ] Helpers internos: cálculo de envío, render de plantilla, quiet hours, preferencias.
- [ ] Worker `scripts/worker-notificaciones.mjs` con advisory lock.
- [ ] Worker envía email (Resend) e in-app (reutilizando bandeja existente).
- [ ] Worker aplica reintentos con backoff y quiet hours.
- [ ] Webhook Resend idempotente por `proveedorId`.
- [ ] Bounce tracking y bloqueo tras umbral.
- [ ] `docker-compose.prod.yml` incluye servicio `pi-notificaciones`.
- [ ] No se tocó `src/lib/ai/**`.
- [ ] CI verde 6/6.
