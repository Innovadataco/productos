# Plan: SPEC-338 · aviso cuenta-existente (I-226)

**Branch**: `work/pi-SPEC-338-registro-email-existe` | **Spec**: [spec.md](spec.md)

## Cambios
- `prisma/seed.ts` (seedEventosEmailMigrados): plantilla `auth.cuenta_existente.email` + regla `{evento:"auth.cuenta_existente", rol:"ALL", obligatoria:true}`.
- `src/lib/email.ts`: `enviarEmailCuentaExistente(email)` (programar, fail-closed si 0 reglas).
- `src/app/api/auth/verificar/solicitar/route.ts`: rama `existente` envía el aviso (fire-and-forget, fallo silencioso). Pantalla sin cambio.
- `src/lib/email.migracion.test.ts`: +auth.cuenta_existente (19→20).
- `route.test.ts`: correo registrado → 202 genérico + Notificacion auth.cuenta_existente.

## Verificación
tsc·lint·tokens·arch·ratchets·specs-discipline. Los tests de BD (route/migracion) validan en CI (la BD de test local está detrás de main en Usuario.apellidos; prisma migrate bloqueado por classifier). Evidencia buzón post-deploy (CEO).
