# Tasks — SPEC-296 · Migrar email.ts al Motor de Notificaciones

## Estado: IMPLEMENTADO

| # | Tarea | Estado |
|---|-------|--------|
| 1 | Inventario formal (20 funciones · 16 callsites · mapeo evento/plantilla/rol) | ✅ Hecho |
| 2 | `src/lib/email.ts` · 19 funciones convertidas a wrappers de `programar()` | ✅ Hecho |
| 3 | `src/lib/notificaciones/enviar-email.ts` (nuevo) · `enviarEmailNotificacion` (proveedor real del motor) | ✅ Hecho |
| 4 | `scripts/worker-notificaciones.mjs` + `admin-service.ts` + `notificacion-admin.ts` · imports actualizados | ✅ Hecho |
| 5 | `prisma/seed.ts` · `seedEventosEmailMigrados()` con 19 plantillas + 19 reglas | ✅ Hecho |
| 6 | `.github/workflows/ci.yml` · step `Ratchet Resend fuera del motor` en `verificaciones` | ✅ Hecho |
| 7 | `src/lib/email.migracion.test.ts` · 4 tests integration (cobertura + wrapper básico + wrapper con vars + fanout N destinatarios) | ✅ Hecho |
| 8 | Reajuste `motor.ts` + 4 repos de notificación a imports relativos (SPEC-197 · I-88) | ✅ Hecho |
| 9 | `src/lib/url-privacy.test.ts` · actualizado a la nueva arquitectura (wrapper + plantilla) | ✅ Hecho |
| 10 | `specs/README.md` · entrada SPEC-296 | ✅ Hecho |

## Verificación local

- `grep -rn "resend\.emails\.send" src/ | grep -v "src/lib/notificaciones/" | grep -v "src/lib/email/" | grep -v test` → **0 líneas** ✅
- `npm run arch:check` → VERDE (cadena de worker sin nuevos alias) ✅
- `npx tsc --noEmit` → verde ✅
- Los 16 callsites externos NO se modificaron.

## Ajuste al plan

Durante la implementación se descubrió que **`enviarEmailNotificacion` es el proveedor real del motor** (inyectado por `worker-notificaciones.mjs:149` a `procesarLote`). Se movió a `src/lib/notificaciones/enviar-email.ts` en lugar de convertirla en wrapper (documentado en `plan.md` §Hallazgo).

También, al importar `motor.ts` desde `email.ts` (thin wrapper), la cadena de imports alcanzable desde `worker-reportes.mjs` (via `colegio/alertas.ts → avisos.ts → email.ts → motor.ts`) trajo `motor.ts` + 4 repos al scope del ratchet SPEC-197. Se migraron todos a imports relativos (patrón `src/lib/monitoreo/**`).
