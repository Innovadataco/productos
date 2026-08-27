# Plan SPEC-291 — Instrumentación + acciones admin sobre servicios

## Estructura de archivos

```
src/lib/
  monitoreo/
    tick-vida.ts                       ← NUEVO
    tick-vida.test.ts                  ← NUEVO
    tick-vida.ratchet.test.ts          ← NUEVO (ratchet 1)
    probes.ts                          ← extendido: probeTickVida()
  servicios/
    docker-adapter.ts                  ← NUEVO
    docker-adapter.test.ts             ← NUEVO (ratchet 4)
    compose.ratchet.test.ts            ← NUEVO (ratchet 2)
    api-guard.ratchet.test.ts          ← NUEVO (ratchet 3)
  permisos-catalogo.ts                 ← +1 entrada sistema_admin

src/app/api/admin/servicios/
  estado/route.ts                      ← NUEVO
  estado/route.test.ts
  [nombre]/start/route.ts              ← NUEVO
  [nombre]/start/route.test.ts
  [nombre]/stop/route.ts               ← NUEVO
  [nombre]/stop/route.test.ts
  [nombre]/restart/route.ts            ← NUEVO
  [nombre]/restart/route.test.ts       ← ratchet 5

scripts/
  worker-supervisor.mjs                ← +escribirTickVida("pi-worker")
  worker-notificaciones.mjs            ← +escribirTickVida("pi-notificaciones")
  worker-senal-comunitaria.mjs         ← +escribirTickVida("pi-senal-comunitaria")
  worker-analisis-score.mjs            ← +escribirTickVida("pi-analisis-score")
  worker-vigencia-pagos.mjs            ← +escribirTickVida("pi-vigencia")
  worker-analisis-reglas.mjs           ← +escribirTickVida("pi-analisis-reglas")
  worker-expediente-motor.mjs          ← +escribirTickVida("pi-expediente-motor")
  worker-anomalias.mjs                 ← +escribirTickVida("pi-anomalias")
  simulador-abuso.mjs                  ← +escribirTickVida("pi-simulador-abuso")
  monitor-probes.mjs                   ← +escribirTickVida("pi-monitor") + SENALES extendidas + probeTickVida

docker-compose.prod.yml                 ← +7 healthchecks (app + 6 workers) · +mount /var/run/docker.sock en app

specs/291-instrumentacion-acciones-servicios/{spec,plan,tasks}.md
specs/README.md                          ← entrada SPEC-291
```

---

## Tarea 1 — Helper `tick-vida.ts`

```ts
// src/lib/monitoreo/tick-vida.ts
import fs from "node:fs";
import path from "node:path";

const RUN_DIR = process.env.WORKER_RUN_DIR ?? "/tmp";

export function rutaTickVida(nombreServicio: string): string {
    return path.join(RUN_DIR, `tick-vida-${nombreServicio}`);
}

export function escribirTickVida(nombreServicio: string): void {
    try {
        fs.writeFileSync(rutaTickVida(nombreServicio), Date.now().toString());
    } catch (err) {
        console.warn(`[tick-vida] fallo escribiendo ${nombreServicio}:`, err instanceof Error ? err.message : err);
    }
}

export function leerAntiguedadTickSeg(nombreServicio: string, ahora: number = Date.now()): number | null {
    try {
        const stat = fs.statSync(rutaTickVida(nombreServicio));
        return Math.floor((ahora - stat.mtimeMs) / 1000);
    } catch {
        return null;
    }
}
```

Tests unit: escritura idempotente, tolerancia a EROFS/EPERM (mock), lectura antigüedad correcta.

---

## Tarea 2 — `probes.ts` extendido

Añadir función:

```ts
export function probeTickVida(nombreServicio: string, maxAntiguedadSeg: number = 90): ResultadoProbe {
    const seg = leerAntiguedadTickSeg(nombreServicio);
    if (seg === null) return { ok: false, latenciaMs: 0, detalle: `tick-vida ausente para ${nombreServicio}`, metodo: "PING" };
    return seg <= maxAntiguedadSeg
        ? { ok: true, latenciaMs: 0, metodo: "PING" }
        : { ok: false, latenciaMs: 0, detalle: `tick-vida ${nombreServicio} tiene ${seg}s (>${maxAntiguedadSeg})`, metodo: "PING" };
}
```

Actualizar `SENALES_MONITOREO` para reflejar las 13 (agregar 7 nuevas).

---

## Tarea 3 — `monitor-probes.mjs` extendido

```js
const SENALES_TICK_VIDA = [
    "pi-notificaciones", "pi-senal-comunitaria", "pi-analisis-score",
    "pi-vigencia", "pi-analisis-reglas", "pi-expediente-motor", "pi-anomalias",
];
const SENALES = ["app", "worker", "bd", "ollama_ping", "ollama_smoke", "tailscale", ...SENALES_TICK_VIDA];

// en correrProbe(senal, config):
if (SENALES_TICK_VIDA.includes(senal)) {
    return probeTickVida(senal, config.tickVidaMaxSeg ?? 90);
}
```

Añadir parámetro sembrado `monitoreo.tickVida.maxAntiguedadSeg` = `90` en `prisma/seed.ts` (patrón `monitoreoViejos` de SPEC-186, con `update: {}`, anti-I-100).

Al final, `escribirTickVida("pi-monitor")` en el loop del monitor.

---

## Tarea 4 — Módulo `sistema_admin` + grants

`src/lib/permisos-catalogo.ts` (aditivo, orden 200):
```ts
{ clave: "sistema_admin", nombre: "Administración del sistema (servicios)", categoria: "admin", esCritico: true, orden: 200 },
```

`prisma/seed-modulos-grants.ts` — NO añadir `sistema_admin` a `clavesPorRol` de OPERADOR/COMITE/SCHOOL_ADMIN. ADMIN lo obtiene por `ADMIN: modulosSeed.map(...)`.

`prisma/seed-security.test.ts` — extender el test de comité: aserción negativa que `sistema_admin` NO está en las 4 claves de COMITE_VALIDACION.

`docs/architecture/02-roles-capacidades.md` — regenerar.

---

## Tarea 5 — `docker-adapter.ts`

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AppError, ERROR_CODES } from "@/lib/errors";

const execFileP = promisify(execFile);

export const COMANDOS_SERVICIO = ["start", "stop", "restart"] as const;
export type ComandoServicio = (typeof COMANDOS_SERVICIO)[number];

export const CONTENEDORES_PERMITIDOS = [
    "pi-worker", "pi-monitor", "pi-simulador-abuso",
    "pi-notificaciones", "pi-senal-comunitaria", "pi-analisis-score",
    "pi-vigencia", "pi-analisis-reglas", "pi-expediente-motor", "pi-anomalias",
] as const;
export type ContenedorPermitido = (typeof CONTENEDORES_PERMITIDOS)[number];

const CMDS = new Set<string>(COMANDOS_SERVICIO);
const CONTS = new Set<string>(CONTENEDORES_PERMITIDOS);

export async function ejecutarAccionDocker(cmd: string, container: string): Promise<{ ok: true }> {
    if (!CMDS.has(cmd)) throw new AppError(`Comando no permitido: ${cmd}`, ERROR_CODES.VALIDATION_ERROR, 400);
    if (!CONTS.has(container)) throw new AppError(`Servicio no permitido: ${container}`, ERROR_CODES.VALIDATION_ERROR, 400);
    await execFileP("docker", [cmd, container], { timeout: 30_000 });
    return { ok: true };
}

export async function inspeccionarEstado(): Promise<Array<{ nombre: string; estado: string; salud: string | null }>> {
    const { stdout } = await execFileP("docker", ["ps", "-a", "--format", "{{.Names}}\t{{.State}}\t{{.Status}}"], { timeout: 10_000 });
    // parse y filtrar los 12 conocidos + db + pi-app
    ...
}
```

Test unit (`docker-adapter.test.ts`): mockear `execFile`. 3 casos positivos × 10 servicios = 30 OK. Casos negativos: comandos inválidos (`up`, `down`, `kill`, `exec`, ``), servicios inválidos (`db`, `pi-app`, `hackerman`, ``, ``pi-worker; rm -rf``). Todos → `AppError`.

---

## Tarea 6 — Endpoints admin

`src/app/api/admin/servicios/[nombre]/restart/route.ts` (patrón idéntico para start/stop):

```ts
export async function POST(request: Request, { params }: { params: Promise<{ nombre: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "sistema_admin");
        if (request.headers.get("x-confirm-action") !== "yes") {
            throw new AppError("Falta header X-Confirm-Action: yes", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const { nombre } = await params;
        await ejecutarAccionDocker("restart", nombre);
        await logAudit({
            accion: "LOGS_MANTENIMIENTO_PURGA",
            tipoRecurso: "Servicio",
            recursoId: nombre,
            usuarioId: user.id,
            ipAddress: request.headers.get("x-forwarded-for") ?? "unknown",
            userAgent: request.headers.get("user-agent") ?? "unknown",
            metadatos: { tipo: "servicio_restart", servicio: nombre },
        });
        return NextResponse.json({ estado: "pending", servicio: nombre }, { status: 202 });
    } catch (error) { ... }
}
```

`GET /api/admin/servicios/estado`: `assertModulo(user, "sistema_admin")` + `inspeccionarEstado()`.

Tests integration: mock `execFile`, mock `next/headers`, verificar flujo completo (auth, assertModulo, header, adapter, AuditLog, 202).

---

## Tarea 7 — Workers · +1 línea cada uno

Insertar al final del tick principal (después del try/catch principal, antes del setTimeout/setInterval siguiente):

```js
import { escribirTickVida } from "../src/lib/monitoreo/tick-vida.ts";
// ...
escribirTickVida("pi-<servicio>");
```

11 archivos, 1 import + 1 llamada cada uno. NO cambiar lógica de negocio del worker (candado).

---

## Tarea 8 — `docker-compose.prod.yml`

Añadir 7 bloques `healthcheck` (patrón consistente). Añadir en `app` el volume mount del socket:

```yaml
    volumes:
      - pi_worker_run:/app/run
      - pi_apelaciones_storage:/app/storage
      - /var/run/docker.sock:/var/run/docker.sock  # SPEC-291: acciones admin
```

**No tocar** el bloque `pi-sesiones` (SPEC-290 lo agrega).

---

## Tarea 9 — Ratchets estáticos (unit tests)

- **`tick-vida.ratchet.test.ts`**: `readdirSync("scripts/")` filtra `worker-*.mjs` + `monitor-probes.mjs` + `simulador-abuso.mjs`. Para cada archivo, `readFileSync` → assert que contiene `escribirTickVida(` al menos una vez.
- **`compose.ratchet.test.ts`**: `yaml.parse(readFileSync("docker-compose.prod.yml"))` → para cada servicio en `services`, asertar `healthcheck` presente. Exención documentada: ninguna (db ya tiene pg_isready).
- **`api-guard.ratchet.test.ts`**: `readdirSync` recursivo sobre `src/app/api/admin/servicios/`. Para cada `route.ts` con export POST, assert `assertModulo` con `"sistema_admin"` y `logAudit` presentes.

---

## Tarea 10 — CI guards + docs

- `specs/291-instrumentacion-acciones-servicios/tasks.md` (guard vacío)
- `specs/README.md` — entrada SPEC-291
- `docs/architecture/02-roles-capacidades.md` — regenerar via `npx tsx scripts/arch/generar-roles-capacidades.ts`

---

## Verificación pre-push

```bash
npx tsc --noEmit
npx eslint src/lib/monitoreo/tick-vida.ts src/lib/servicios/ src/app/api/admin/servicios/
npx vitest run --config vitest.unit.config.ts \
  src/lib/monitoreo/tick-vida.test.ts \
  src/lib/monitoreo/tick-vida.ratchet.test.ts \
  src/lib/servicios/docker-adapter.test.ts \
  src/lib/servicios/compose.ratchet.test.ts \
  src/lib/servicios/api-guard.ratchet.test.ts \
  prisma/seed-security.test.ts \
  src/lib/specs-discipline.test.ts
npm run arch:check
```

## Verificación en vivo (SC-5, pre-REALIZADO)

Contra VPS prod tras deploy (o local si prod no está lista):
1. `docker ps` → 12 servicios `(healthy)`/`(unhealthy)`.
2. `docker kill pi-anomalias` → esperar ≤3 min → `HealthProbe` marca `ok=false` para `anomalias`.
3. `curl -X POST -H "X-Confirm-Action: yes" -H "Cookie: token=<admin>" https://pi.innovadataco.com/api/admin/servicios/pi-analisis-score/restart` → 202 → healthy ≤60s.
4. `SELECT metadatos FROM "AuditLog" WHERE tipoRecurso='Servicio' ORDER BY creadoEn DESC LIMIT 5` → `tipo=servicio_restart`.
