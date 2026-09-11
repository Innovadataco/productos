/**
 * SPEC-143 (D3-b) — Latido del sistema: lectura del heartbeat del worker.
 * Misma fuente que `src/app/api/health/worker/route.ts` (spec 097): el archivo
 * `worker.heartbeat` en `WORKER_RUN_DIR ?? process.cwd()` contiene un timestamp en
 * milisegundos escrito por el worker en cada ciclo.
 *
 * `leerHeartbeatWorker()` mide que el PROCESO del worker RESPIRA (último latido),
 * no que el motor clasifique: el worker late aunque cada job falle con Ollama
 * caído. Lo consumen el probe del worker (`probes.ts`) y `/api/health/worker`.
 *
 * SPEC-670 / I-396: la franja del rector YA NO usa este latido como "última
 * revisión del sistema" —afirmaba frescura que no tenía—; para eso está
 * `leerLatidoMotor()` (sonda activa del motor). No lo recablees a una pantalla
 * como prueba de que el sistema revisó: esa es la fuente equivocada de I-396.
 *
 * Devuelve la fecha del último latido o null si no hay archivo o su contenido no
 * es un timestamp válido.
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
