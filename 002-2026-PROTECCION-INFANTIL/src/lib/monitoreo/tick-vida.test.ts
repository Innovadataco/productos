/**
 * SPEC-291 (002-PI-191) — tests del helper tick-vida.
 * Tests unitarios puros; no tocan Prisma.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let TMP_DIR: string;

beforeEach(() => {
    TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "tick-vida-"));
    process.env.WORKER_RUN_DIR = TMP_DIR;
    vi.resetModules();
});

afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    delete process.env.WORKER_RUN_DIR;
});

describe("tick-vida", () => {
    it("escribe el archivo y devuelve antigüedad ~0s", async () => {
        const { escribirTickVida, leerAntiguedadTickSeg, rutaTickVida } = await import("./tick-vida");
        escribirTickVida("pi-anomalias");
        expect(fs.existsSync(rutaTickVida("pi-anomalias"))).toBe(true);
        const seg = leerAntiguedadTickSeg("pi-anomalias");
        expect(seg).not.toBeNull();
        expect(seg!).toBeLessThan(2);
    });

    it("devuelve null si el archivo no existe", async () => {
        const { leerAntiguedadTickSeg } = await import("./tick-vida");
        expect(leerAntiguedadTickSeg("no-existe")).toBeNull();
    });

    it("no lanza si fs falla (permisos, ENOSPC) — solo warn", async () => {
        const { escribirTickVida } = await import("./tick-vida");
        const spyWrite = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
            const err = new Error("EACCES: permission denied");
            (err as NodeJS.ErrnoException).code = "EACCES";
            throw err;
        });
        const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(() => escribirTickVida("pi-worker")).not.toThrow();
        expect(spyWarn).toHaveBeenCalledOnce();
        spyWrite.mockRestore();
        spyWarn.mockRestore();
    });

    it("usa /tmp por defecto si WORKER_RUN_DIR no está seteado", async () => {
        delete process.env.WORKER_RUN_DIR;
        vi.resetModules();
        const { rutaTickVida } = await import("./tick-vida");
        expect(rutaTickVida("pi-monitor")).toBe("/tmp/tick-vida-pi-monitor");
    });

    it("iniciarTickVida escribe inmediato + repite cada intervalo (unref para no bloquear shutdown)", async () => {
        const { iniciarTickVida, leerAntiguedadTickSeg, rutaTickVida } = await import("./tick-vida");
        const handle = iniciarTickVida("pi-vigencia", 25);
        try {
            // Inmediato
            expect(fs.existsSync(rutaTickVida("pi-vigencia"))).toBe(true);
            const seg = leerAntiguedadTickSeg("pi-vigencia");
            expect(seg).toBeLessThan(2);
            // Confirmar que hay repetición: retrocedo el mtime y espero un tick del interval.
            fs.utimesSync(rutaTickVida("pi-vigencia"), 0, 0);
            await new Promise((r) => setTimeout(r, 60));
            const seg2 = leerAntiguedadTickSeg("pi-vigencia");
            expect(seg2!).toBeLessThan(2);
        } finally {
            clearInterval(handle);
        }
    });

    it("calcula antigüedad correctamente al desfasar mtime", async () => {
        const { escribirTickVida, leerAntiguedadTickSeg, rutaTickVida } = await import("./tick-vida");
        escribirTickVida("pi-notificaciones");
        const p = rutaTickVida("pi-notificaciones");
        // Retrocedo el mtime 120s
        const hace120s = Date.now() - 120_000;
        fs.utimesSync(p, hace120s / 1000, hace120s / 1000);
        const seg = leerAntiguedadTickSeg("pi-notificaciones");
        expect(seg).toBeGreaterThanOrEqual(119);
        expect(seg).toBeLessThanOrEqual(121);
    });
});
