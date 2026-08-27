/**
 * SPEC-290 (002-PI-190): tests unitarios del touch de vida del worker de sesiones.
 * El helper vive en un módulo puro (worker-sesiones-heartbeat.mjs) sin deps de
 * pg-boss/Prisma, para poder testearlo sin BD.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";

// Mock ANTES de importar el módulo bajo prueba para que la referencia interna
// a `writeFileSync` sea la del mock.
vi.mock("node:fs", async () => {
    const actual = await vi.importActual("node:fs");
    return { ...actual, writeFileSync: vi.fn() };
});

const { touchAliveFile, ALIVE_FILE_PATH, HEARTBEAT_INTERVAL_MS } = await import("./worker-sesiones-heartbeat.mjs");

describe("touchAliveFile (SPEC-290)", () => {
    beforeEach(() => {
        vi.mocked(fs.writeFileSync).mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("escribe /tmp/pi-sesiones-alive con timestamp en milisegundos", () => {
        touchAliveFile();
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        const [ruta, contenido] = vi.mocked(fs.writeFileSync).mock.calls[0];
        expect(ruta).toBe("/tmp/pi-sesiones-alive");
        expect(ruta).toBe(ALIVE_FILE_PATH);
        // El timestamp es un entero (ms desde epoch); debe ser una cadena numérica.
        expect(String(contenido)).toMatch(/^\d{13,}$/);
    });

    it("no lanza cuando writeFileSync falla (FS de solo lectura)", () => {
        const spyErr = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.mocked(fs.writeFileSync).mockImplementation(() => {
            throw new Error("EROFS: read-only file system");
        });
        expect(() => touchAliveFile()).not.toThrow();
        expect(spyErr).toHaveBeenCalledWith(expect.stringMatching(/no pude tocar.*EROFS/));
    });

    it("el heartbeat interval está configurado en 30s (< healthcheck de 90s)", () => {
        expect(HEARTBEAT_INTERVAL_MS).toBe(30_000);
        expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(90_000);
    });
});
