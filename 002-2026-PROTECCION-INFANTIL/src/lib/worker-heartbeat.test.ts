/**
 * SPEC-143 (D3-b) — Tests del helper de heartbeat del worker: lee
 * `WORKER_RUN_DIR/worker.heartbeat` (timestamp en ms) o null si falta/es inválido.
 * El módulo resuelve la ruta al importarse: cada caso reimporta con
 * `vi.resetModules()` y un WORKER_RUN_DIR temporal propio.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RUN_DIR_ORIGINAL = process.env.WORKER_RUN_DIR;

let dir: string;

async function importarModulo() {
    vi.resetModules();
    process.env.WORKER_RUN_DIR = dir;
    return import("./worker-heartbeat");
}

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "heartbeat-test-"));
});

afterEach(() => {
    if (RUN_DIR_ORIGINAL === undefined) {
        delete process.env.WORKER_RUN_DIR;
    } else {
        process.env.WORKER_RUN_DIR = RUN_DIR_ORIGINAL;
    }
    rmSync(dir, { recursive: true, force: true });
});

describe("leerHeartbeatWorker", () => {
    it("devuelve null cuando no existe el archivo", async () => {
        const { leerHeartbeatWorker, existeHeartbeatWorker } = await importarModulo();
        expect(existeHeartbeatWorker()).toBe(false);
        expect(leerHeartbeatWorker()).toBeNull();
    });

    it("devuelve la fecha del timestamp en milisegundos", async () => {
        const ts = 1_785_772_800_000; // 2026-08-03T12:00:00.000Z
        writeFileSync(join(dir, "worker.heartbeat"), `${ts}\n`);
        const { leerHeartbeatWorker, existeHeartbeatWorker } = await importarModulo();
        expect(existeHeartbeatWorker()).toBe(true);
        expect(leerHeartbeatWorker()?.getTime()).toBe(ts);
    });

    it("devuelve null con contenido inválido (el archivo existe pero no es un ts)", async () => {
        writeFileSync(join(dir, "worker.heartbeat"), "basura-no-numerica");
        const { leerHeartbeatWorker, existeHeartbeatWorker } = await importarModulo();
        expect(existeHeartbeatWorker()).toBe(true);
        expect(leerHeartbeatWorker()).toBeNull();
    });
});
