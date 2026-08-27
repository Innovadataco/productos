/**
 * SPEC-291 (002-PI-191) — Adapter seguro para acciones docker desde `app`.
 *
 * Guardas (los 3 obligatorios, verificados por tests):
 *  1. Whitelist HARD-CODED de comandos: solo `start | stop | restart`.
 *  2. Whitelist HARD-CODED de contenedores: 10 servicios (los 12 menos `db` y `pi-app`).
 *  3. `execFile("docker", [cmd, container])` — NUNCA shell (evita interpolación).
 *
 * Excluidos absolutos:
 *  - `db`   → reinicio catastrófico (pérdida de conexiones activas).
 *  - `pi-app` → auto-referencia (el request se corta y el admin queda sin sesión).
 *  - `up | down | exec | kill | rm | ...` → cambian estado más allá de "operación".
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AppError, ERROR_CODES } from "@/lib/errors";

// Runner reemplazable (inyección para tests). En producción llama al `execFile`
// real; los tests pueden hacer `setDockerRunner(...)` para inspeccionar/simular.
export type DockerRunner = (
    cmd: string,
    args: string[],
    opts: { timeout: number },
) => Promise<{ stdout: string; stderr: string }>;

const defaultRunner: DockerRunner = (cmd, args, opts) =>
    promisify(execFile)(cmd, args, opts) as unknown as Promise<{ stdout: string; stderr: string }>;

let currentRunner: DockerRunner = defaultRunner;

export function setDockerRunner(runner: DockerRunner | null): void {
    currentRunner = runner ?? defaultRunner;
}

function execFileP(cmd: string, args: string[], opts: { timeout: number }): Promise<{ stdout: string; stderr: string }> {
    return currentRunner(cmd, args, opts);
}

export const COMANDOS_SERVICIO = ["start", "stop", "restart"] as const;
export type ComandoServicio = (typeof COMANDOS_SERVICIO)[number];

export const CONTENEDORES_PERMITIDOS = [
    "pi-worker",
    "pi-monitor",
    "pi-simulador-abuso",
    "pi-notificaciones",
    "pi-senal-comunitaria",
    "pi-analisis-score",
    "pi-vigencia",
    "pi-analisis-reglas",
    "pi-expediente-motor",
    "pi-anomalias",
] as const;
export type ContenedorPermitido = (typeof CONTENEDORES_PERMITIDOS)[number];

const CMDS: ReadonlySet<string> = new Set(COMANDOS_SERVICIO);
const CONTS: ReadonlySet<string> = new Set(CONTENEDORES_PERMITIDOS);

export function esComandoPermitido(cmd: string): cmd is ComandoServicio {
    return CMDS.has(cmd);
}

export function esContenedorPermitido(container: string): container is ContenedorPermitido {
    return CONTS.has(container);
}

/**
 * Ejecuta `docker <cmd> <container>` con doble validación de whitelist y sin shell.
 * Timeout de 30s (más que suficiente para start/stop/restart de un contenedor).
 * Lanza AppError con status 400 si algún argumento no está en whitelist.
 */
export async function ejecutarAccionDocker(cmd: string, container: string): Promise<{ ok: true }> {
    if (!esComandoPermitido(cmd)) {
        throw new AppError(`Comando no permitido: ${cmd}`, ERROR_CODES.VALIDATION_ERROR, 400);
    }
    if (!esContenedorPermitido(container)) {
        throw new AppError(`Contenedor no permitido: ${container}`, ERROR_CODES.VALIDATION_ERROR, 400);
    }
    await execFileP("docker", [cmd, container], { timeout: 30_000 });
    return { ok: true };
}

/**
 * Devuelve el estado observado (via `docker ps -a`) de los 12 contenedores conocidos
 * (los 10 permitidos + db + pi-app). Útil para el endpoint GET /api/admin/servicios/estado.
 */
const TODOS_LOS_CONTENEDORES = [
    "pi-db",
    "pi-app",
    ...CONTENEDORES_PERMITIDOS,
] as const;

export interface EstadoServicio {
    nombre: string;
    estado: string;
    salud: "healthy" | "unhealthy" | "starting" | null;
    permiteAccion: boolean;
}

export async function inspeccionarEstado(): Promise<EstadoServicio[]> {
    const { stdout } = await execFileP(
        "docker",
        ["ps", "-a", "--format", "{{.Names}}\t{{.State}}\t{{.Status}}"],
        { timeout: 10_000 },
    );
    const filas = stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
            const [nombre, estado, status] = l.split("\t");
            return { nombre, estado, status };
        });
    const porNombre = new Map(filas.map((f) => [f.nombre, f]));
    return TODOS_LOS_CONTENEDORES.map((nombre) => {
        const f = porNombre.get(nombre);
        let salud: EstadoServicio["salud"] = null;
        if (f?.status?.includes("(healthy)")) salud = "healthy";
        else if (f?.status?.includes("(unhealthy)")) salud = "unhealthy";
        else if (f?.status?.includes("(health: starting)")) salud = "starting";
        return {
            nombre,
            estado: f?.estado ?? "missing",
            salud,
            permiteAccion: CONTS.has(nombre),
        };
    });
}
