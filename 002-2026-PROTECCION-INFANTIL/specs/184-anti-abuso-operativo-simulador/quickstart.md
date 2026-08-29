# Quickstart: SPEC-184 — validación manual

Base: app corriendo (`./scripts/dev-restart.sh`), admin logueado, Ollama disponible (para simulador).

## Bloque A — Tablero operativo y blocklist

1. Ir a `/dashboard/admin/anti-abuso` → pestaña **Operativo**.
2. Verificar que aparecen 4 secciones: top IPs bloqueadas, top identificadores, top fingerprints, alertas activas.
3. Cambiar el selector de ventana a 7d y 30d → los números cambian (o quedan en 0 si no hay tráfico).
4. Si hay IPs bloqueadas, hacer clic en "Bloquear IP" de una fila → modal pide motivo y duración.
   - Dejar motivo vacío → no deja guardar.
   - Elegir "24h" + motivo → 201, la IP aparece en "Alertas activas" como vigente.
5. Desde una terminal, hacer un POST a `/api/reportes` con header `x-forwarded-for: 192.0.2.10` (la IP cuyo hash se bloqueó) → debe responder 429 inmediatamente y NO incrementar el contador de `RateLimit` para esa IP.
6. Hacer clic en "Desbloquear" → la IP desaparece de vigentes; un nuevo reporte desde la misma IP pasa al rate-limit normal.

## Bloque B — Alerta email throttled

1. Configurar en Configuración → Alertas: `alerts.ratelimit.destinatarios = tu-email@test.com`, `alerts.ratelimit.umbral_bloqueos_hora = 5`, `alerts.ratelimit.throttle_min = 60`.
2. Bloquear una IP de test (RFC 5737).
3. Desde script/curl, generar 6 requests 429 desde esa IP en menos de una hora.
4. Verificar que llega **1 solo email** con el `ipHash`, la cantidad de bloqueos y la ventana.
5. Verificar en `/dashboard/admin/estadisticas/operacion` o en BD que existe un `IncidenteInfra` con señal `rate_limit:report:<ipHash>`.

## Bloque C — Simulador de abusos

1. Ir a `/dashboard/admin/anti-abuso` → pestaña **Simulador**.
2. Seleccionar escenario **"Robot inundando"** y lanzar.
3. La UI muestra progreso en vivo: reportes exitosos, bloqueados por rate-limit, spam, latencia por reporte.
4. Antes de que termine, pulsar **"Cancelar"** → el progreso se detiene; los reportes ya creados siguen en la bandeja de reportes.
5. Ir a `/dashboard/admin` y verificar que aparecen reportes nuevos (estados PENDIENTE/CLASIFICADO/POSIBLE_SPAM/DUPLICADO) sin marca de simulación.
6. Probar el escenario personalizado con IP `8.8.8.8` → debe responder 400 con mensaje claro y no crear reportes.
7. Probar el escenario personalizado con IP `192.0.2.50`, identificador y plataforma válidos → debe crear reportes reales.

## Bloque D — Simulador de scoring (tab secundario)

1. Ir a `/dashboard/admin/anti-abuso` → pestaña **Scoring por fuente**.
2. Verificar que el contenido del simulador de scoring actual sigue funcionando (tabla de comparación score actual vs. ajustado).
3. Si ZEUS decidió retirarlo, esta pestaña no existe.

## Invariantes de privacidad y seguridad

- En ninguna vista aparece una IP en claro; siempre `ipHash`.
- En ningún email o `AuditLog` aparece texto de reportes.
- El simulador rechaza IPs fuera de RFC 5737.
