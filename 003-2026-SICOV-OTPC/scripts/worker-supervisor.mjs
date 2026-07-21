// Supervisor del worker de despachos: lo relanza si cae, con límite de reintentos.
// Garantiza UN solo worker (el propio worker toma un advisory lock). Escribe worker.pid.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER = join(__dirname, "worker.mjs");
const MAX_RESTARTS = 5;
const RESTART_DELAY_MS = 2000;
const PID_FILE = join(__dirname, "..", "worker.pid");

let restarts = 0;
let hijo = null;
let deteniendo = false;

function lanzar() {
  hijo = spawn("node", ["--env-file=.env", "--import", "tsx", WORKER], {
    stdio: "inherit",
    env: process.env,
  });
  writeFileSync(PID_FILE, String(hijo.pid ?? ""));

  hijo.on("exit", (code) => {
    if (deteniendo) return;
    // exit(2) = otra instancia tiene el lock → no reintentar.
    if (code === 2) {
      console.error("[supervisor] worker reporta otra instancia activa; no se relanza.");
      limpiar();
      process.exit(2);
    }
    if (restarts >= MAX_RESTARTS) {
      console.error(`[supervisor] máximo de reinicios (${MAX_RESTARTS}) alcanzado; abortando.`);
      limpiar();
      process.exit(1);
    }
    restarts += 1;
    console.warn(`[supervisor] worker salió (code=${code}); reinicio ${restarts}/${MAX_RESTARTS} en ${RESTART_DELAY_MS}ms`);
    setTimeout(lanzar, RESTART_DELAY_MS);
  });
}

function limpiar() {
  try {
    rmSync(PID_FILE, { force: true });
  } catch {
    /* noop */
  }
}

function detener(sig) {
  deteniendo = true;
  console.log(`[supervisor] ${sig} recibido; deteniendo worker.`);
  if (hijo) hijo.kill("SIGTERM");
  setTimeout(() => {
    if (hijo) hijo.kill("SIGKILL");
    limpiar();
    process.exit(0);
  }, 10000);
}

process.on("SIGTERM", () => detener("SIGTERM"));
process.on("SIGINT", () => detener("SIGINT"));

lanzar();
