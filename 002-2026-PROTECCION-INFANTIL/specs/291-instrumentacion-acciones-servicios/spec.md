# SPEC-291 — Instrumentación de vida + acciones admin sobre servicios

**Radicado**: 002-PI-191 · cierra I-135 + parte I-133 · implementa D-91 · habilita D-83  
**Tipo**: Instrumentación + endpoints admin  
**Estado**: IMPLEMENTADO  
**Fecha**: 2026-08-27  
**Impacto en arquitectura:** healthchecks docker en 7 servicios · helper `tick-vida` en 11 workers · monitor extendido a 13 señales (14 con `sesiones` que agrega SPEC-290) · 4 endpoints admin con nuevo módulo `sistema_admin` · docker socket montado en `app` con whitelist estricta.

---

## Verificación previa (candado D-007)

Sobre `origin/feature/001-scaffolding@667cd3a1` (post-merge SPEC-288):

- **12 servicios en compose** (grep `^  [a-z]` en `docker-compose.prod.yml`): db, app, worker, monitor, simulador-abuso, pi-notificaciones, pi-senal-comunitaria, pi-analisis-score, pi-vigencia, pi-analisis-reglas, pi-expediente-motor, pi-anomalias.
- **5 tienen healthcheck** (db `pg_isready` + 4 workers con `kill -0 1`): pi-vigencia, pi-analisis-reglas, pi-expediente-motor, pi-anomalias. **7 sin healthcheck** — coincide con brief.
- **11 workers `.mjs`**, cero con tick-vida (grep `escribirTickVida|/tmp/.*-alive` → 0 resultados).
- **`sistema_admin` NO existe** en `src/lib/permisos-catalogo.ts` ni en `AccionAudit` → ambos nuevos.
- **`monitor-probes.mjs:51`** — `SENALES = ["app", "worker", "bd", "ollama_ping", "ollama_smoke", "tailscale"]` (6). SPEC-291 añade 7 (sesiones lo agrega SPEC-290/D-1).
- **Servicio ↔ script**:
  | Servicio | Script | Healthcheck actual |
  |---|---|---|
  | app | Next.js | ninguno |
  | worker | worker-supervisor.mjs (levanta worker-reportes) | ninguno |
  | monitor | monitor-probes.mjs | ninguno |
  | simulador-abuso | simulador-abuso.mjs | ninguno |
  | pi-notificaciones | worker-notificaciones.mjs | ninguno |
  | pi-senal-comunitaria | worker-senal-comunitaria.mjs | ninguno |
  | pi-analisis-score | worker-analisis-score.mjs | ninguno |
  | pi-vigencia | worker-vigencia-pagos.mjs | kill -0 1 |
  | pi-analisis-reglas | worker-analisis-reglas.mjs | kill -0 1 |
  | pi-expediente-motor | worker-expediente-motor.mjs | kill -0 1 |
  | pi-anomalias | worker-anomalias.mjs | kill -0 1 |
  | db | postgres | pg_isready |

**Hallazgo lateral (no cambia scope):** los 4 workers con `kill -0 1` detectan proceso vivo, NO bucle silencioso (I-130). Tick-vida los cubrirá vía el monitor extendido; su healthcheck docker propio queda como estaba para no ampliar alcance.

---

## Alcance · 4 capas

### 4.1 Docker healthchecks (7 nuevos)

En `docker-compose.prod.yml`:

- **`app`** → HTTP: `test: ["CMD-SHELL", "wget -q --spider http://localhost:3000/api/health || exit 1"]`. El endpoint `/api/health` ya existe (verificado en `src/app/api/health/route.ts`).
- **6 workers** (worker, monitor, simulador-abuso, pi-notificaciones, pi-senal-comunitaria, pi-analisis-score) → touchfile:
  ```yaml
  healthcheck:
    test: ["CMD-SHELL", "test -f /tmp/<servicio>-alive && test $(($(date +%s) - $(stat -c %Y /tmp/<servicio>-alive))) -lt 90 || exit 1"]
    interval: 30s
    timeout: 5s
    retries: 3
  ```
- **NO tocar** healthchecks existentes (db + 4 workers).
- **NO tocar** `pi-sesiones` (lo agrega SPEC-290 · D-1).

### 4.2 Helper `escribirTickVida`

`src/lib/monitoreo/tick-vida.ts` — función pura con try/catch tolerante:

```ts
export function escribirTickVida(nombreServicio: string): void {
    try {
        fs.writeFileSync(`/tmp/${nombreServicio}-alive`, Date.now().toString());
    } catch (err) {
        console.warn(`[tick-vida] fallo escribiendo ${nombreServicio}:`, err instanceof Error ? err.message : err);
        // NUNCA throw — no debe tumbar el worker.
    }
}
```

Se llama al final de cada tick en los 11 workers `.mjs` (incluidos los 4 que ya tienen `kill -0`, para que el monitor externo también los vea).

### 4.3 Monitor extendido

`scripts/monitor-probes.mjs` — extender `SENALES` con 7 nuevas (sesiones lo agrega SPEC-290):

```
notificaciones, senal_comunitaria, analisis_score,
vigencia, analisis_reglas, expediente_motor, anomalias
```

Nueva función genérica `probeTickVida(nombreArchivo, maxAntiguedadSeg)` en `src/lib/monitoreo/probes.ts` que lee `/tmp/<nombre>-alive` desde el volumen compartido `pi_worker_run` (ya montado en el contenedor `monitor`). El monitor exporta un helper "check file age" reutilizable.

Reutiliza el patrón "doble rojo antes de abrir" + email throttled (ya probado en SPEC-171).

**Estrategia de acceso al touchfile desde `monitor`:** los touchfiles se escriben en `/tmp/` de cada contenedor. Para que el monitor los lea sin exec al contenedor, se cambia la ruta canónica a `/app/run/<servicio>-alive` (dentro del volumen compartido `pi_worker_run` que ya montan todos los servicios worker/monitor). Documentado en la interfaz de `escribirTickVida` para que el healthcheck docker use la misma ruta.

**Decisión de diseño:** ruta canónica del touchfile = `${WORKER_RUN_DIR}/tick-vida-<servicio>` (aprovecha el env var existente). El healthcheck del compose usa `$WORKER_RUN_DIR` (que ya está en cada worker service). Esto resuelve dos problemas de una: (a) monitor lee sin exec, (b) healthcheck en el contenedor mismo lee su propio archivo.

### 4.4 Endpoints admin `/api/admin/servicios/*`

- `GET /api/admin/servicios/estado` — devuelve `[{nombre, healthState, containerState, healthcheck}]` para los 12.
- `POST /api/admin/servicios/<nombre>/start`
- `POST /api/admin/servicios/<nombre>/stop`
- `POST /api/admin/servicios/<nombre>/restart`

Los POST:
1. `verifyAuth()` → `assertModulo(user, "sistema_admin")`.
2. Guard header `X-Confirm-Action: yes` → 400 si falta.
3. Validación en whitelist (ver §Docker socket seguro).
4. `logAudit({ accion: "LOGS_MANTENIMIENTO_PURGA", tipoRecurso: "Servicio", metadatos: { tipo: "servicio_start|stop|restart", servicio, ejecutadoPor: user.id, ipAddress } })`. **Decisión candado migración:** reutilizar `LOGS_MANTENIMIENTO_PURGA` con `metadatos.tipo` (patrón SPEC-265/285), evitando ampliar el enum `AccionAudit` con `SERVICIO_START/STOP/RESTART`. Si CEO prefiere añadir 3 valores al enum → decir en APROBADO y agrego la migración.
5. Ejecuta `execFile("docker", [cmd, containerName])` con timeout 30s.
6. Responde `202 Accepted` + `{estado:"pending", servicio}`.

---

## Docker socket seguro (§Candado crítico)

**Montaje:** en `docker-compose.prod.yml`, `app` monta `/var/run/docker.sock:/var/run/docker.sock` (RW real — no existe modo "read-only" para el socket).

**Guard defensivo en código** (`src/lib/servicios/docker-adapter.ts`):

```ts
const COMANDOS = new Set(["start", "stop", "restart"] as const);
const SERVICIOS_PERMITIDOS = new Set([
    "pi-worker", "pi-monitor", "pi-simulador-abuso",
    "pi-notificaciones", "pi-senal-comunitaria", "pi-analisis-score",
    "pi-vigencia", "pi-analisis-reglas", "pi-expediente-motor", "pi-anomalias",
] as const);

export async function ejecutarAccionDocker(cmd: string, container: string): Promise<void> {
    if (!COMANDOS.has(cmd as never)) throw new AppError(...);
    if (!SERVICIOS_PERMITIDOS.has(container as never)) throw new AppError(...);
    await execFile("docker", [cmd, container], { timeout: 30_000 });
}
```

**Nunca `db` (catastrófico). Nunca `pi-app` (auto-referencia, admin queda desconectado).** Ambos EXCLUIDOS de `SERVICIOS_PERMITIDOS`.

**Nunca shell interpolation:** `execFile` con array de args (no `exec`, no template strings).

**Tests estrictos** en `src/lib/servicios/docker-adapter.test.ts`: cada comando y servicio fuera de las 2 whitelists lanza `AppError`.

---

## Módulo `sistema_admin`

- **Aditivo puro** en `src/lib/permisos-catalogo.ts` — sin migración Prisma:
  ```ts
  { clave: "sistema_admin", nombre: "Administración del sistema (servicios)", categoria: "admin", esCritico: true, orden: 200 },
  ```
- **Default solo ADMIN**: `ADMIN: modulosSeed.map(...)` lo captura automáticamente. NO se agrega a otros roles en `clavesPorRol`. Cualquier PR que lo grantee a OPERADOR/COMITE/SCHOOL_ADMIN → HALLAZGO.
- **Post-deploy** (prod): `docker compose exec app npx tsx prisma/sync-modulos-grants.ts` — patrón conocido de SPEC-266 (aditivo, no revoca).
- **Ratchet en `prisma/seed-security.test.ts`**: aserción negativa — `sistema_admin` NO aparece en `clavesPorRol` de OPERADOR, COMITE_VALIDACION, SCHOOL_ADMIN, PARENT.

---

## 5 ratchets CI (§4 brief)

### Estáticos (unit, job `verificaciones`)

1. **`workers-usan-tick-vida`** — `src/lib/monitoreo/tick-vida.ratchet.test.ts`: enumera `scripts/worker-*.mjs` + `scripts/simulador-abuso.mjs` + `scripts/monitor-probes.mjs`, verifica por regex que cada uno importa `escribirTickVida` y lo llama ≥1 vez. Excepciones documentadas: workers de un solo disparo (backfills, si los hay).
2. **`healthcheck-completo`** — `src/lib/servicios/compose.ratchet.test.ts`: parsea `docker-compose.prod.yml` con `yaml`, verifica que cada servicio tiene `healthcheck`. Exención documentada: db (pg_isready). Se salta explícitamente `pi-sesiones` con un TODO hasta que SPEC-290 mergee.
3. **`endpoints-servicios-restringidos`** — `src/lib/servicios/api-guard.ratchet.test.ts`: lee `src/app/api/admin/servicios/**/*.ts`, verifica que cada `route.ts` con export POST/DELETE llama `assertModulo(..., "sistema_admin")` y `logAudit`.

### E2E (integration, job `test-integration`)

4. **`docker-adapter-whitelist`** — `src/lib/servicios/docker-adapter.test.ts`: unit test con mock de `execFile`. Cada comando fuera de whitelist → error. Cada servicio fuera de whitelist (incluido `db`, `pi-app`, `hackerman`) → error.
5. **`admin-reinicia-servicio-integration`** — `src/app/api/admin/servicios/[nombre]/restart/route.test.ts`: mock del docker adapter, valida flujo completo (auth → assertModulo → header → adapter llamado con args correctos → AuditLog registrado → 202).

**Los ratchets E2E "docker kill contra prod" del brief NO se cablean en CI** — CI no tiene el compose real. Se documentan como verificación en vivo (SC-5) que corre Desarrollo pre-REALIZADO.

---

## Coordinación con SPEC-290 (D-1)

D-1 toca `docker-compose.prod.yml` (bloque `pi-sesiones` + healthcheck) y `scripts/worker-sesiones.mjs` (agrega `escribirTickVida`).

**Estrategia:**
- Yo NO toco esos 2 archivos en el bloque `pi-sesiones` ni el worker-sesiones.
- Los ratchets §Estáticos incluyen exención explícita de `pi-sesiones` hasta que SPEC-290 mergee.
- Cuando D-1 mergee → rebasear y conservar ambos bloques (patrón §9.6). Al rebasear, remuevo la exención de `pi-sesiones` del ratchet `healthcheck-completo`.
- Si yo mergeo antes → D-1 rebasea sobre mi base y usa mi `escribirTickVida` sin cambios.

---

## Candados críticos

- **Docker socket:** RW real (no read-only), pero whitelist estricta en app: 3 comandos × 10 servicios. `db` y `pi-app` EXCLUIDOS.
- **`sistema_admin` solo ADMIN** por default. Test estático lo verifica en seed-security.
- **`escribirTickVida` tolerante a fs errors**: try/catch + console.warn, NUNCA throw.
- **Header `X-Confirm-Action: yes`** obligatorio en los 3 POST.
- **CERO cambios en `src/lib/ai/**`**.
- **CERO migraciones** (catálogo TS aditivo + reutiliza `LOGS_MANTENIMIENTO_PURGA`).
- **NO tocar `pi-sesiones`** ni `worker-sesiones.mjs` (SPEC-290).
- **NO tocar lógica de workers** — solo agregar 1 línea `escribirTickVida(...)` al final del tick.
- **NO construir tablero frontend** — solo endpoints (D-83 es aparte).
- **NO reiniciar db · NO reiniciar app desde app** — excluidos de whitelist.

---

## Verificación en vivo (SC-5)

Pre-REALIZADO, Desarrollo ejecuta contra prod (VPS):

1. `docker ps` → verificar los 12 con `(healthy)` / `(unhealthy)` (sin `Up` ambiguo).
2. `docker kill pi-anomalias` → esperar ≤3 min → `SELECT ... FROM "HealthProbe" WHERE senal='anomalias' AND ok=false ORDER BY creadoEn DESC LIMIT 1` → confirmar incidente + email disparado.
3. `curl -X POST -H "X-Confirm-Action: yes" -H "Cookie: token=..." https://pi.innovadataco.com/api/admin/servicios/pi-analisis-score/restart` → 202 → polling `/estado` → healthy en ≤60s.
4. `SELECT metadatos FROM "AuditLog" WHERE tipoRecurso='Servicio' ORDER BY creadoEn DESC LIMIT 5` → confirmar `tipo=servicio_restart` + usuarioId + servicio.

Reportar cada paso en `002-PI-191 · VERIFICADO EN VIVO`.
