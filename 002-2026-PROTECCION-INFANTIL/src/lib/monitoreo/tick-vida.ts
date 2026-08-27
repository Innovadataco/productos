/**
 * SPEC-291 (002-PI-191) — Tick de vida de los workers.
 *
 * Cada worker escribe un touchfile en `${WORKER_RUN_DIR}/tick-vida-<servicio>`
 * al final de cada tick de su ciclo principal. El healthcheck del contenedor
 * (docker-compose.prod.yml) y el vigilante externo (scripts/monitor-probes.mjs)
 * leen la antigüedad de ese archivo para saber si el worker está avanzando
 * (no basta con `kill -0 1`: un worker en bucle silencioso también responde).
 *
 * Tolerante a fs errors: try/catch + console.warn, NUNCA throw. Un fallo al
 * escribir el tick no puede tumbar el worker.
 */
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
        console.warn(
            `[tick-vida] fallo escribiendo ${nombreServicio}:`,
            err instanceof Error ? err.message : err,
        );
    }
}

export function leerAntiguedadTickSeg(
    nombreServicio: string,
    ahora: number = Date.now(),
): number | null {
    try {
        const stat = fs.statSync(rutaTickVida(nombreServicio));
        return Math.floor((ahora - stat.mtimeMs) / 1000);
    } catch {
        return null;
    }
}

/**
 * Arranca un latido periódico que llama `escribirTickVida` cada `intervaloMs`
 * (por defecto 30s, coherente con `healthcheck.interval` de docker-compose).
 * El interval se desprende con `.unref()` para no bloquear el shutdown del
 * event loop.
 *
 * Ventaja sobre "llamar al final de cada tick": si el event loop se bloquea
 * (bucle silencioso, I-130), el interval no dispara → healthcheck rojo → monitor
 * abre incidente. Detecta el defecto que `kill -0 1` no detecta.
 *
 * Retorna el `NodeJS.Timeout` por si el caller necesita `clearInterval` en tests.
 */
export function iniciarTickVida(nombreServicio: string, intervaloMs: number = 30_000): NodeJS.Timeout {
    escribirTickVida(nombreServicio); // Primer tick inmediato al arrancar.
    const handle = setInterval(() => escribirTickVida(nombreServicio), intervaloMs);
    handle.unref();
    return handle;
}
