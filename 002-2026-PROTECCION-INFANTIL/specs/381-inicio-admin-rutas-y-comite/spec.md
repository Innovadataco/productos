# SPEC-381 · Rutas del Inicio del admin (I-269) + candado del menú honesto + log defensivo del comité (I-270)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-2 · **Origen**: recorrido de Jelkin en prod `6136af5d`.

## Los dos hallazgos

### I-269 · Botón «Ver» del Inicio manda a 404
Las 2 señales de correos en `src/lib/dal/services/inicio-admin.ts` (líneas 72 y 80) apuntaban a
`/dashboard/admin/notificaciones/salud`, que **no existe** como pantalla — solo existe el endpoint
`GET /api/admin/notificaciones/salud`. El guardián "menú honesto" (ratchet de `nav-items`) evalúa
hrefs pintados por el nav, no rutas devueltas en runtime, y este hueco lo dejó pasar.

### I-270 · «No pudimos cargar las solicitudes» del comité
Reproducido por Jelkin, no reproducible ahora con admin (`soporte@innovadataco.com`, cuenta e2e
viva): ambos endpoints (`/api/admin/comite/solicitudes` y `/api/admin/comite/consolidacion`)
responden 200 con datos, y `docker compose logs app --since 24h` no muestra 500 ni errores
relacionados. **Hipótesis del CEO confirmada con evidencia**: pi-app se detuvo a **05:48:18 UTC**
y arrancó a **05:48:29 UTC** para el deploy `6136af5d`. Peticiones en vuelo en esa ventana de 11 s
mueren sin logear (el proceso murió antes de escribir). El `catch {}` mudo del cliente traduce
cualquier tirón de red al mismo mensaje humano, sin evidencia. **No es un bug de código.**

## Requisitos

- **FR-001 (I-269)**: Cada `ruta` que devuelva `inicio-admin.ts` DEBE resolver a un `page.tsx` real.
- **FR-002 (I-269)**: `/dashboard/admin/notificaciones/salud` DEBE alcanzarse. Elegido: redirigir a
  la pantalla que ya muestra los mismos datos (`/dashboard/admin/estadisticas/salud-motor` con el
  bloque `SaludMotorBloque`), sin duplicar código.
- **FR-003 (candado)**: Un test unitario DEBE escanear `inicio-admin.ts`, extraer los literales de
  `ruta`, y afirmar que cada uno tiene su `page.tsx`. Este candado cierra el hueco del "menú
  honesto" para hrefs devueltos en runtime.
- **FR-004 (I-270 · defensa)**: El `catch {}` de `ComiteBandeja.tsx` DEBE logear el error a la
  consola además de mostrar el mensaje al usuario. El comportamiento visible no cambia; queda
  evidencia para el próximo diagnóstico.

## Impacto en arquitectura:

Sin cambios de esquema, sin endpoints nuevos, sin migraciones. Un test-ratchet nuevo, dos rutas
redirigidas y dos `catch` que ahora conservan la evidencia.
