/**
 * SPEC-290 (002-PI-190): touch de vida para el healthcheck del contenedor
 * `pi-sesiones`. Módulo puro (sin deps de pg, Prisma o queue) para poder
 * testearlo en unit sin arrancar el worker.
 *
 * Cadencia esperada: el worker llama a `touchAliveFile()` al arranque y
 * cada `HEARTBEAT_INTERVAL_MS` (30 s), más una vez al final de cada tick
 * del `boss.work`. El healthcheck del compose exige archivo con < 90 s
 * de antigüedad — margen 3× sobre el heartbeat.
 *
 * NO se generaliza este patrón a otros workers aquí — eso es A-31.
 */
// SPEC-290: se importa el namespace completo (no `{ writeFileSync }`) para que
// `vi.mock("node:fs")` del test unitario intercepte la llamada — con binding
// directo el mock queda tarde y el binding apunta al original.
import * as fs from "node:fs";

export const ALIVE_FILE_PATH = "/tmp/pi-sesiones-alive";
export const HEARTBEAT_INTERVAL_MS = 30_000;

export function touchAliveFile() {
    try {
        fs.writeFileSync(ALIVE_FILE_PATH, String(Date.now()));
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[WORKER-SESIONES] no pude tocar ${ALIVE_FILE_PATH}: ${msg}`);
    }
}
