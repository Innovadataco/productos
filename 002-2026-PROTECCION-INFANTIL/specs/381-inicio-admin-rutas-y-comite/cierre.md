# SPEC-381 · Cierre — Inicio del admin: rutas + candado + log defensivo del comité

**Fecha**: 2026-09-03 · **Dev**: PI-2 · **Rama**: `work/pi-SPEC-381-inicio-admin-rutas-y-comite`.

## I-269 · resuelto sin duplicar pantalla

`/api/admin/notificaciones/salud` devuelve `SaludMotorDto` — cola, tasa de entrega, errores
24h, latencia. **Esos MISMOS datos ya se pintan** en `/dashboard/admin/estadisticas/salud-motor`
con el componente `SaludMotorBloque`. Crear una pantalla nueva habría duplicado el bloque; la
decisión correcta es apuntar las 2 señales de correos ahí. Cambio de 2 líneas en
`inicio-admin.ts` (72 y 80).

## Candado del "menú honesto" para rutas devueltas en runtime

`src/lib/dal/services/inicio-admin.ratchet.test.ts` escanea el módulo, extrae los literales de
`ruta:` y afirma un `page.tsx` por cada una. Antes del fix el test estaba **rojo** por la ruta
`/notificaciones/salud`; después del fix pasan 7/7. Cierra el hueco que el ratchet de
`nav-items` no cubre (evalúa hrefs pintados, no rutas devueltas).

## I-270 · candado 26 aplicado — no es bug de código

Reproducción en vivo con admin (`soporte@innovadataco.com`):
- `GET /api/admin/comite/solicitudes?page=1&limit=20` → **200**, 256 solicitudes.
- `GET /api/admin/comite/consolidacion?page=1&pageSize=50` → **200**, items:[].
- `GET /dashboard/admin/comite` → carga, 20 filas visibles.
- `docker compose logs app --since 24h`: cero errores comité/500.

Confirmé la hipótesis del CEO:

    docker inspect pi-app --format "{{.State.StartedAt}}"
    → 2026-09-03T05:48:29.191Z

    journalctl -u docker (05:48:18 UTC): "stopping restart-manager" en cascada.

**Ventana de corte de 11 s** durante el deploy `6136af5d`. Cualquier fetch en vuelo del comité
en esos segundos moría sin logear del lado del servidor y el `catch {}` mudo del cliente lo
traducía a "No pudimos cargar las solicitudes · Reintentar". No hay bug de código; es
transitorio de despliegue.

## Log defensivo (para la próxima)

Los dos `catch {}` de `ComiteBandeja.tsx` (fetchSolicitudes y fetchConsolidaciones) ahora
capturan el error y lo pasan a `console.error("[ComiteBandeja] ...")`. El comportamiento visible
no cambia. La próxima vez que aparezca el mismo síntoma, la evidencia estará en la consola del
navegador y podremos distinguir rápido: tirón de red del deploy vs. bug real.

## Nota anotada (no se hace ahora)

Vale la pena revisar si el deploy puede quedar sin cortar peticiones en vuelo, o si la pantalla
debería reintentar sola sin mostrar error en la ventana del rollout. **Anotado y no implementado
en esta spec** por acuerdo con el CEO.

## Gate

`tsc` limpio · tests del candado 7/7 · tests unitarios completos verdes.
