# Plan de implementación — SPEC-290 · Levantar `worker-sesiones` como servicio

## Alcance del trabajo

Cambio de infra + 1 línea al worker + 1 sección al panel de configuración + 1 fila actualizada en `ADVISORY-LOCKS.md`. **Cero cambios de lógica**, cero migraciones, cero endpoint nuevo.

## Archivos que se tocan

| Archivo | Cambio |
|---|---|
| `docker-compose.prod.yml` | +bloque `pi-sesiones` con `image: pi-app:${PI_APP_TAG:-latest}`, `command: node --import tsx scripts/worker-sesiones.mjs`, `depends_on.db+app`, healthcheck de archivo con edad. |
| `docker-compose.yml` (dev) | +mismo bloque, sin `env_file` (usa `.env` local del dev), `restart: unless-stopped`. |
| `scripts/worker-sesiones.mjs` | +helper `touchAliveFile()` que hace `fs.writeFileSync("/tmp/pi-sesiones-alive", timestamp)`. Se llama al final de cada tick del `boss.work`. Bloque `try/catch` que loguea y sigue. |
| `scripts/worker-sesiones.test.mjs` (nuevo) | Test unitario del helper: escribe, no lanza en FS de solo lectura (mock de `writeFileSync`), no duplica escritura si el archivo ya existe. |
| `src/components/modules/config-panel/types.ts` | +entrada `{ key: "sesiones", label: "Sesiones", description: "...", prefixes: ["sesion."] }` en `SECTIONS`. Debe ir antes de `"other"`. |
| `src/components/modules/config-panel/types.test.ts` (nuevo) | Test: `sectionForParam({clave:"sesion.timeout_inactividad_minutos", ...})` → devuelve la sección `sesiones`, no `other`. Grep-style test para el ratchet §4.3 del brief. |
| `scripts/ADVISORY-LOCKS.md` | Fila 8 (ID `123456797`): columna 3 (Servicio) pasa de `— sin servicio (I-132 pendiente)` a `` `pi-sesiones` ``. Columna 4 (Qué protege) quita `(latente)`. |
| `specs/README.md` | +entrada SPEC-290. |
| `specs/290-levantar-worker-sesiones/tasks.md` | Marcador de estado. |

## Diseño técnico

### Servicio del compose (patrón heredado de `pi-vigencia`)

```yaml
# SPEC-290 (002-PI-190): worker de cierre automático de sesiones por inactividad.
# Advisory lock 123456797 (ADVISORY-LOCKS.md fila 8), reutiliza pi-app image.
# Healthcheck: /tmp/pi-sesiones-alive debe existir y tener < 90s de antigüedad
# (el worker lo actualiza al final de cada tick, cadencia ~5 min).
pi-sesiones:
  image: pi-app:${PI_APP_TAG:-latest}
  container_name: pi-sesiones
  restart: always
  env_file: .env.production
  command: node --import tsx scripts/worker-sesiones.mjs
  environment:
    TZ: America/Bogota
  depends_on:
    db:
      condition: service_healthy
    app:
      condition: service_started
  healthcheck:
    test: ["CMD-SHELL", "test -f /tmp/pi-sesiones-alive && test $(($(date +%s) - $(stat -c %Y /tmp/pi-sesiones-alive))) -lt 90 || exit 1"]
    interval: 60s
    timeout: 5s
    retries: 3
```

**Justificación del healthcheck de edad**: el patrón de PID 1 usado por `pi-vigencia` (`kill -0 1`) solo verifica que el proceso vive, no que esté haciendo trabajo. Para `worker-sesiones` el brief pide "touch al final de cada tick" — el tick real es cada 5 min pero el healthcheck reacciona a un colgado silencioso del `boss.work`. Un tick cae ≈ cada 300 s; damos 90 s de gracia sobre 60 s de intervalo → si el worker se cuelga, el healthcheck falla en < 3 min y `restart: always` recicla.

### Touch de vida en el worker

```js
// Helper puro en el propio archivo (no importable — el brief pide "cambio menor").
function touchAliveFile() {
    try {
        writeFileSync("/tmp/pi-sesiones-alive", String(Date.now()));
    } catch (err) {
        console.error(`[WORKER-SESIONES] no pude tocar /tmp/pi-sesiones-alive: ${err.message}`);
    }
}
```

Se llama **al final** del handler de `boss.work` — antes del `return { success: true, ... }`. Si el handler tira, no se toca el archivo (el healthcheck detectará el fallo).

### Nueva sección en el panel

```ts
// types.ts (justo antes de "system" para respetar el orden semántico):
{ key: "sesiones", label: "Sesiones", description: "Cierre por inactividad y cadencia del worker de sesiones.", prefixes: ["sesion."] },
```

Los 4 parámetros `sesion.*` sembrados (`timeout_inactividad_minutos`, `ping_intervalo_minutos`, `retencion_dias`, `worker_intervalo_minutos`) aparecerán agrupados. La auditoría es la de `PARAM_UPDATE` que ya emite `ConfiguracionService.actualizar` (SPEC-053) — sin código nuevo.

### Fila de ADVISORY-LOCKS.md

Antes:
```
| `123456797` | `scripts/worker-sesiones.mjs` | — sin servicio (I-132 pendiente) | Corte de sesiones expiradas (latente) | SPEC-284 (antes `123456790`) |
```

Después:
```
| `123456797` | `scripts/worker-sesiones.mjs` | `pi-sesiones` | Corte de sesiones expiradas | SPEC-284 · SPEC-290 |
```

`locks:check` (SPEC-284) valida 1:1 el ID en el archivo vs el `.mjs` — el cambio de columna Servicio no rompe la compuerta.

## Riesgo y candados

- **Riesgo bajo**. El worker está auditado (SPEC-206) y su lógica no cambia. El servicio replica un patrón que ya corre con 8 hermanos.
- **Candado FR-009 (NO tocar lógica)**: el único cambio a `worker-sesiones.mjs` es la línea `touchAliveFile()` al final del tick. Cualquier otro cambio → HALLAZGO.
- **Candado FR-007 (NO migración)**: se rehúsa el `accion="CONFIG_SESIONES_ACTUALIZADA"` del brief §2 y se reutiliza `PARAM_UPDATE` porque agregar un enum value a `AccionAudit` requiere migración de Prisma — prohibido por §3.candados del INSTRUCTIVO. El AuditLog cumple lo que pide el CEO (valor viejo/nuevo, usuario, timestamp); la diferencia es solo el string de `accion`. Se documenta en `tasks.md` para transparencia.
- **Candado FR-010 (NO tocar SesionLog)**: el mecanismo de cierre ya está en `SessionLogService.cerrarPorInactividad` y no se toca.
- **NO se generaliza el patrón touch** a otros workers — eso es A-31 (candado explícito del brief).
- **Compat dev vs prod**: en dev el compose usa `.env` local por defecto; el healthcheck idéntico (usa `/tmp` que existe en Linux/macOS Docker).

## Pruebas

- **Unitario**: `scripts/worker-sesiones.test.mjs` — el helper `touchAliveFile()` no lanza cuando `writeFileSync` tira (mock), y sí escribe con timestamp cuando puede. 2 tests, sin BD.
- **Unitario (grep ratchet §4.3)**: `src/components/modules/config-panel/types.test.ts` — verifica que `sectionForParam({clave:"sesion.timeout_inactividad_minutos"})` retorna `key="sesiones"`, no `"other"`.
- **Verificación empírica**: correr `docker compose -f docker-compose.yml up -d pi-sesiones` en la Mac → esperar 60 s → `docker compose ps pi-sesiones` reporta `healthy`. Con `docker compose logs pi-sesiones --tail=20` confirmar `Advisory lock adquirido` + `Iniciado. timeout=30min, intervalo=5min`.
- **Post-deploy prod** (SC-A28-5): login → esperar timeout + intervalo + 1 min → siguiente request devuelve 401 (Desarrollo verifica antes de decir REALIZADO).

## Rollback

Revertir el commit — al eliminar el bloque del compose el servicio se apaga en el próximo `docker compose up`. La línea del touch en `worker-sesiones.mjs` es idempotente: dejarla no hace daño aunque el compose no la use. La sección `sesiones` del panel muestra parámetros que ya están sembrados; retirarla los devuelve a "Otros".
