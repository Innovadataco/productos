#!/usr/bin/env node
/**
 * Supervisor del worker de reportes
 * - Lanza scripts/worker-reportes.mjs
 * - Reinicia automáticamente si muere (max 5 intentos)
 * - Guarda PID del worker activo en worker.pid
 * - Escucha SIGTERM/SIGINT para terminar hijo limpiamente
 */

import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const WORKER_SCRIPT = resolve(import.meta.dirname, "worker-reportes.mjs");
const PID_FILE = resolve(import.meta.dirname, "..", "worker.pid");
const MAX_RESTARTS = 5;
const RESTART_DELAY_MS = 2000;

let restartCount = 0;
let worker = null;
let shuttingDown = false;

function log(msg) {
    console.log(`[SUPERVISOR] ${msg}`);
}

function savePid(pid) {
    try {
        writeFileSync(PID_FILE, String(pid), "utf8");
    } catch (err) {
        log(`No se pudo guardar PID: ${err.message}`);
    }
}

function clearPid() {
    try {
        if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
    } catch {
        // ignore
    }
}

function startWorker() {
    if (shuttingDown) return;

    log(`Iniciando worker (intento ${restartCount + 1}/${MAX_RESTARTS})`);
    worker = spawn("node", ["--env-file=.env", "--import", "tsx", WORKER_SCRIPT], {
        stdio: "inherit",
        cwd: process.cwd(),
    });

    savePid(worker.pid);

    worker.on("exit", (code, signal) => {
        worker = null;
        clearPid();

        if (shuttingDown) {
            log("Worker terminado por cierre controlado");
            process.exit(0);
        }

        log(`Worker terminado (code=${code}, signal=${signal})`);

        if (restartCount < MAX_RESTARTS - 1) {
            restartCount++;
            log(`Reiniciando en ${RESTART_DELAY_MS}ms...`);
            setTimeout(startWorker, RESTART_DELAY_MS);
        } else {
            log(`Maximo de reinicios (${MAX_RESTARTS}) alcanzado. Supervisor se detiene.`);
            process.exit(1);
        }
    });

    worker.on("error", (err) => {
        log(`Error del worker: ${err.message}`);
    });
}

function shutdown(signal) {
    shuttingDown = true;
    log(`Recibida señal ${signal}. Cerrando worker...`);
    if (worker) {
        worker.kill(signal);
        // Si no termina en 10s, forzar
        setTimeout(() => {
            if (worker && !worker.killed) {
                log("Forzando cierre del worker");
                worker.kill("SIGKILL");
            }
        }, 10000);
    } else {
        process.exit(0);
    }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startWorker();
