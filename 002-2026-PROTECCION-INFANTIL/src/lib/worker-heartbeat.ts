/**
 * SPEC-143 (D3-b) — Latido del sistema: lectura del heartbeat del worker.
 * Misma fuente que `src/app/api/health/worker/route.ts` (spec 097): el archivo
 * `worker.heartbeat` en `WORKER_RUN_DIR ?? process.cwd()` contiene un timestamp en
 * milisegundos escrito por el worker en cada ciclo.
 *
 * `leerHeartbeatWorker()` es la verdad global "última revisión del sistema" de la
 * franja de vigilancia de la home del rector: devuelve la fecha del último latido
 * o null si no hay archivo o su contenido no es un timestamp válido.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const RUN_DIR = process.env.WORKER_RUN_DIR ?? process.cwd();
const HEARTBEAT_FILE = resolve(RUN_DIR, "worker.heartbeat");

export function existeHeartbeatWorker(): boolean {
    return existsSync(HEARTBEAT_FILE);
}

export function leerHeartbeatWorker(): Date | null {
    if (!existsSync(HEARTBEAT_FILE)) return null;
    try {
        const ts = parseInt(readFileSync(HEARTBEAT_FILE, "utf8").trim(), 10);
        if (Number.isNaN(ts)) return null;
        return new Date(ts);
    } catch {
        return null;
    }
}
