/**
 * SPEC-291 (002-PI-191) — Adapter seguro para acciones docker desde `app`.
 *
 * Guardas (los 3 obligatorios, verificados por tests):
 *  1. Whitelist HARD-CODED de comandos: solo `start | stop | restart`.
 *  2. Whitelist HARD-CODED de contenedores: 10 servicios (los 12 menos `db` y `pi-app`).
 *  3. Habla con la Docker Engine API por HTTP sobre `/var/run/docker.sock` —
 *     NUNCA shell, NUNCA `docker` CLI (evita interpolación y no requiere binary
 *     en la imagen `app`, que solo tenía Node/Next.js).
 *
 * Excluidos absolutos:
 *  - `pi-db`  → reinicio catastrófico (pérdida de conexiones activas).
 *  - `pi-app` → auto-referencia (el request se corta y el admin queda sin sesión).
 */
import http from "node:http";
import { AppError, ERROR_CODES } from "@/lib/errors";

const DOCKER_SOCKET = "/var/run/docker.sock";
const REQUEST_TIMEOUT_MS = 30_000;

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
    "pi-verificacion-vencimiento",
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

// Runner reemplazable (inyección para tests). En producción llama a la Docker
// Engine API por HTTP sobre unix socket; los tests reemplazan con setDockerRunner.
export type DockerRunner = (
    method: "GET" | "POST",
    path: string,
) => Promise<{ status: number; body: string }>;

function defaultRunner(method: "GET" | "POST", path: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                socketPath: DOCKER_SOCKET,
                method,
                path,
                timeout: REQUEST_TIMEOUT_MS,
                headers: { "content-type": "application/json" },
            },
            (res) => {
                let body = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => (body += chunk));
                res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
            },
        );
        req.on("error", (err) => reject(err));
        req.on("timeout", () => {
            req.destroy();
            reject(new Error(`Docker API timeout after ${REQUEST_TIMEOUT_MS}ms`));
        });
        req.end();
    });
}

let currentRunner: DockerRunner = defaultRunner;

export function setDockerRunner(runner: DockerRunner | null): void {
    currentRunner = runner ?? defaultRunner;
}

/**
 * Ejecuta `docker <cmd> <container>` vía Docker Engine API. Doble validación
 * de whitelist + sin shell (nunca ejecuta ningún binario). AppError 400 si
 * algún argumento no está en whitelist; AppError 502 si Docker respondió mal.
 */
export async function ejecutarAccionDocker(cmd: string, container: string): Promise<{ ok: true }> {
    if (!esComandoPermitido(cmd)) {
        throw new AppError(`Comando no permitido: ${cmd}`, ERROR_CODES.VALIDATION_ERROR, 400);
    }
    if (!esContenedorPermitido(container)) {
        throw new AppError(`Contenedor no permitido: ${container}`, ERROR_CODES.VALIDATION_ERROR, 400);
    }
    // POST /containers/{name}/{cmd}  → 204 No Content en éxito.
    // 304 Not Modified si el contenedor ya está en el estado deseado (aceptable).
    const path = `/containers/${encodeURIComponent(container)}/${cmd}`;
    const res = await currentRunner("POST", path);
    if (res.status !== 204 && res.status !== 304) {
        throw new AppError(
            `Docker API ${cmd} ${container}: HTTP ${res.status} ${res.body.slice(0, 300)}`,
            ERROR_CODES.INTERNAL_ERROR,
            502,
        );
    }
    return { ok: true };
}

/**
 * Devuelve el estado observado (via `GET /containers/json?all=true`) de los 12
 * contenedores conocidos (los 10 permitidos + pi-db + pi-app).
 */
const TODOS_LOS_CONTENEDORES = ["pi-db", "pi-app", ...CONTENEDORES_PERMITIDOS] as const;

export interface EstadoServicio {
    nombre: string;
    estado: string;
    salud: "healthy" | "unhealthy" | "starting" | null;
    permiteAccion: boolean;
}

interface DockerContainer {
    Names: string[];
    State: string;
    Status: string;
}

export async function inspeccionarEstado(): Promise<EstadoServicio[]> {
    const res = await currentRunner("GET", "/containers/json?all=true");
    if (res.status !== 200) {
        throw new AppError(
            `Docker API list: HTTP ${res.status} ${res.body.slice(0, 300)}`,
            ERROR_CODES.INTERNAL_ERROR,
            502,
        );
    }
    const filas: DockerContainer[] = JSON.parse(res.body);
    // Docker prefija los nombres con "/". Normalizamos.
    const porNombre = new Map<string, DockerContainer>();
    for (const f of filas) {
        for (const n of f.Names) porNombre.set(n.replace(/^\//, ""), f);
    }
    return TODOS_LOS_CONTENEDORES.map((nombre) => {
        const f = porNombre.get(nombre);
        let salud: EstadoServicio["salud"] = null;
        if (f?.Status?.includes("(healthy)")) salud = "healthy";
        else if (f?.Status?.includes("(unhealthy)")) salud = "unhealthy";
        else if (f?.Status?.includes("(health: starting)")) salud = "starting";
        return {
            nombre,
            estado: f?.State ?? "missing",
            salud,
            permiteAccion: CONTS.has(nombre),
        };
    });
}
