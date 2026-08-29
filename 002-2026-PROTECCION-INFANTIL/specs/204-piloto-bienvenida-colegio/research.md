> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Research: SPEC-204 — Piloto Migración Bienvenida Colegio (002-PI-101)

## Hallazgos verificados en fuente

- `src/lib/email.ts:84` (2026-08-22): función `enviarEmailBienvenidaColegio(email, tempPassword)`.
- `src/app/api/admin/colegios/route.ts:208` (2026-08-22): llama a `enviarEmailBienvenidaColegio` tras crear colegio.
- `src/app/api/admin/colegios/[id]/reenviar-email/route.ts:72` (2026-08-22): llama a `enviarEmailBienvenidaColegio` al reenviar credenciales.
- Tests de ambas rutas mockean `enviarEmailBienvenidaColegio`.
- BRIEF-MOTOR-NOTIFICACIONES.md §8: SPEC-204 es el piloto de migración.
- BRIEF §6: reglas semilla no incluyen `colegio.bienvenida` originalmente; se agrega en este piloto.

## Decisiones tomadas

- Evento de dominio: `colegio.bienvenida`.
- Plantilla clave: `colegio.bienvenida.email`.
- Regla obligatoria (`obligatoria: true`) porque es transaccional de alta de cuenta.
- Offset `+0m` (inmediato).
- Se conserva `enviarEmailBienvenidaColegio` marcada como `@deprecated` por compatibilidad hasta que otras alertas migren; o se elimina si no quedan usos tras migración.
